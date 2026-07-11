# 第三课：MongoDB + Mongoose 数据持久化 — 从"能展示"到"能存储"

## 课程概览

为 Express + EJS 重构版接入 MongoDB，通过 Mongoose 数据建模，将联系表单改为订阅功能并持久化保存，新增后台订阅者列表页。实现了"前端能提交 → 数据能入库 → 后台能查看"的完整闭环。

---

## 一、数据建模：Schema = 对数据的宪法

```ts
const subscriberSchema = new Schema<ISubscriber>(
  {
    name:  { type: String, required: true },
    email: { type: String, required: true, unique: true },
    zipCode: {
      type: String,
      validate: {
        validator: (v) => v == null || v === '' || /^\d{5}$/.test(v),
        message: '邮编必须是5位数字',
      },
    },
  },
  { timestamps: true },  // 自动 createdAt / updatedAt
);
```

| 能力 | 写法 | 作用 |
|------|------|------|
| 必填 | `required: true` | 服务端断言，不下于浏览器的 `required` |
| 唯一 | `unique: true` | 自动建唯一索引，重复插入返回 `error.code 11000` |
| 自定义校验 | `validate: { validator, message }` | 5 位数字以外的邮编统统拒绝 |
| 时间戳 | `{ timestamps: true }` | 免手写 `Date.now()`，Mongoose 全自动 |

### `unique: true` 做了两层事

1. **应用层**：Mongoose 保存前额外检查邮箱是否已存在
2. **数据库层**：连接时自动调 MongoDB 的 `createIndex({ email: 1 }, { unique: true })`，在 `subscribers` 集合上建一个物理唯一索引

第二条才是真正的防线。验证实验：绕过 Mongoose，用 MongoDB 原生 driver 直插重复数据——

```
1. Subscriber.create({ email: 'a@test.com' })  ✅ Mongoose 正常写入
2. db.collection('subscribers').insertOne({ email: 'a@test.com' })  ❌ 被拒
   → MongoServerError: E11000 duplicate key error
```

索引存在 MongoDB 存储引擎内部，是物理层约束。哪怕你把 Node 服务关了，换 Python 去连同一个库同一个集合，插重复邮箱一样被拒。**这就是"数据库层"防线 vs"应用层"防线的区别。**

### String vs Number：邮编为什么用 String

教学文档写的是 `Number`，但邮编如 `02134`（波士顿）转 Number 后变成 `2134`——丢失前导零，通不过 5 位校验。**邮编不是数学数字，是标识符**，应该用 String。Schema 定义要服务于业务语义，而不是教条地照搬需求文档的类型。

---

## 二、数据库连接：先连库，再监听

### 旧代码

```ts
// 不管数据库死活，直接启动
app.listen(PORT, () => { ... });
```

### 新代码

```ts
let uri = process.env.MONGODB_URI;

// 无外部 MongoDB → 自动启动内存实例
if (!uri) {
  const mongod = await MongoMemoryServer.create();
  uri = mongod.getUri();
}

// 先连库
try {
  await mongoose.connect(uri);
  console.log('✅ MongoDB connected');
} catch (err) {
  console.error('❌ MongoDB 连接失败，进程即将退出:', err);
  process.exit(1);  // 快速失败（fail fast）
}

// 连上了才启动 HTTP
app.listen(PORT, () => { ... });
```

**核心原则：数据库不可用时，服务器绝不能接收请求。** 否则每个 `/subscribe` 都会在请求时才发现数据库挂了，难排查且用户体验差。

### 顶层 await

项目使用 ES Module（`"type": "module"`）且 target 为 ES2022，**顶层 await 完全可用**。之前用 async IIFE 是保守习惯，重构后直接用顶层 await，少两层嵌套：

```ts
// 之前：async IIFE（多两层缩进）
(async () => {
  try { await mongoose.connect(uri); } catch { ... }
})();

// 现在：顶层 await（直接）
try {
  await mongoose.connect(uri);
} catch (err) {
  process.exit(1);
}
```

async IIFE 的适用场景是 CJS 模块或不支持顶层 await 的构建工具，本项目不需要。

---

## 三、异步错误处理：三类分流

```ts
export async function postSubscribe(req, res) {
  try {
    await Subscriber.create({ name, email, zipCode });
    res.render('thanks', { ... });                     // ✅ 成功
  } catch (err) {
    if (err.code === 11000) {                         // 🔴 重复邮箱
      res.render('contact', { error: '该邮箱已订阅', formData: ... });
    } else if (err.name === 'ValidationError') {       // 🟡 校验失败
      res.render('contact', { error: messages, formData: ... });
    } else {
      throw err;                                       // 💀 未知错误 → 500
    }
  }
}
```

| 错误类型 | 判断方式 | 响应 | HTTP |
|----------|----------|------|------|
| 重复邮箱 | `err.code === 11000` | 回渲 contact + "该邮箱已订阅" | 200 |
| 校验失败 | `err.name === 'ValidationError'` | 回渲 contact + 拼好的错误消息 | 200 |
| 未知错误 | 其他所有 | `throw err` → Express 5 捕获 → internalError → 500.ejs | 500 |

**关键点：已知错误不 throw，重新渲染表单给用户重试机会；未知错误 throw 给框架兜底。**

### `err.code === 11000` 是哪来的

`11000` 不是我们定义的，是 MongoDB 官方的错误码，固定代表"唯一索引冲突"。所有唯一索引冲突——不管哪个字段、哪个集合——返回的 code 都是 11000。完整的错误信息是：

```
MongoServerError: E11000 duplicate key error collection: confetti.subscribers
  index: email_1 dup key: { email: "zhangsan@example.com" }
```

从中可以提取：
- `err.code` → `11000`（判断是唯一索引冲突）
- `err.errorResponse.keyValue` → `{ email: "zhangsan@example.com" }`（知道是哪个字段、哪个值冲突）

### Express 5 的自动错误传播

async 函数中 `throw err` 等价于 `Promise.reject(err)`。Express 5 自动捕获 rejected promise 并转发给 4 参数错误中间件（`internalError`）。不需要 `express-async-errors` 包。

---

## 四、双重校验：前端体验 + 后端底线

```
浏览器校验（HTML 属性）
  required / type="email" / pattern="\d{5}"
  → 即时反馈，减少无效请求
  → 可被绕过（curl / Postman / F12 删属性）
          ↓
服务端校验（Mongoose Schema）
  required / validate / unique
  → 最后防线，脏数据绝不过
  → 失败 → 重新渲染表单 + 红色提示条 + 回填用户输入
```

**前端校验是体验，后端校验是底线。** 永远不能只靠前端校验。

---

## 五、环境变量与 dotenv

### dotenv 是什么

`dotenv` 做的事情就一句：**把 `.env` 文件里的键值对读到 `process.env` 上。**

```bash
# .env
MONGODB_URI=mongodb://localhost:27017/confetti
PORT=8080
```

```ts
import 'dotenv/config';

process.env.MONGODB_URI  // → "mongodb://localhost:27017/confetti"
process.env.PORT         // → "8080"
```

没有它的话，每次启动要手动设一堆环境变量，或者写在启动脚本里，既麻烦又容易出错。

### 为什么不覆盖已存在的环境变量

dotenv 有一个关键默认行为：**系统环境变量优先级高于 `.env` 文件。** 如果系统已经设了 `MONGODB_URI`，dotenv 检测到后跳过，不会用 `.env` 的值覆盖。

这恰好构成了开发/生产的环境隔离：

```
                开发环境                    生产环境
               ─────────                  ─────────
系统环境变量     （无）            MONGODB_URI=mongodb://prod-cluster...
                  │                         │
dotenv 加载      .env 中 MONGODB_URI=空      dotenv 检测到系统已有值，跳过
                  │                         │
代码逻辑        !uri → 内存实例              uri 有值 → 直连生产库
                  │                         │
结果            🧪 内存 MongoDB              ✅ 生产 MongoDB
               （重启消失）                 （持久化）
```

### 为什么不降级

配置了 `MONGODB_URI` 但连不上时，代码**不会**回退到内存实例：

```ts
if (!uri) {
  mongod = await MongoMemoryServer.create();  // 只有 uri 为空才走这里
}
try {
  await mongoose.connect(uri);  // uri 有值就直接连，连不上就 exit
} catch (err) {
  process.exit(1);
}
```

这是故意设计的——你明确配了数据库地址，说明你有意使用它。连不上就该报错，而不是偷偷降级到一个临时数据库。否则你可能以为自己连的是生产库，实际数据全存到了内存里，重启就没了。

### 三层配置设计

```
.env              ← 真实配置，gitignore，只管本地开发
.env.example      ← 模板文件，提交到 git，告诉队友需要哪些变量
生产环境变量        ← 在服务器/容器上 export，不依赖 .env 文件
```

### 加载时机

```ts
import 'dotenv/config';  // 必须是整个项目的第一行，在任何 process.env 读取之前
```

---

## 六、表单错误回填

校验失败时，除了显示错误消息，还回填用户已输入的数据：

```ejs
<!-- 错误提示 -->
<% if (error) { %>
  <div style="background: #fff0f0; ...">⚠️ <%= error %></div>
<% } %>

<!-- 回填输入 -->
<input name="email" value="<%= formData.email %>" >
```

用户不用重新敲一遍数据，只管更正错误字段即可。这是表单体验的基本修养。

---

## 七、mongodb-memory-server：零依赖开发

本地没装 MongoDB？自动下载临时二进制文件并启动进程：

```ts
if (!process.env.MONGODB_URI) {
  const mongod = await MongoMemoryServer.create();
  uri = mongod.getUri();   // mongodb://127.0.0.1:xxxxx/
}
```

| 场景 | 配置 | 行为 |
|------|------|------|
| 本地开发 | `.env` 中 `MONGODB_URI` 注释掉 | 自动启内存实例，进程即数据库 |
| 生产/持久化 | `.env` 中配 `MONGODB_URI` | 直连外部 MongoDB |

这样新成员 clone 项目后 `pnpm dev` 即开即用，零环境配置成本。

---

## 八、页面状态的三层语言

一个订阅者列表页包含了三种"无数据"场景的思考：

```ejs
<% if (subscribers.length === 0) { %>
  <p>暂无订阅者。</p>           <!-- 空数据，系统正常但没内容 -->
<% } %>
```

```html
<td><%= sub.zipCode || '—' %></td>  <!-- 单字段为空，用 em dash 占位 -->
```

配合之前的 `404.ejs`（路由不存在）和 `500.ejs`（系统异常），覆盖了全部"No Data"场景。

---

## 九、编码常识：curl 中文陷阱

Windows 下 curl 的 `-d` 用系统默认的 GBK 编码，不是 UTF-8：

```bash
# ❌ Windows curl — GBK 编码 → 数据库存成乱码
curl -d "name=张三" http://localhost:3000/subscribe

# ✅ 浏览器表单 — 页面 charset=utf-8 → 正常
```

这个坑常见于终端 API 测试。解决方案：用 `--data-urlencode` 或直接改浏览器测。

---

## 项目结构演进

```
旧（Unit 2）：src/routes/ + controllers/ + data/ + types/     ← MVC 雏形
    views/ 6 个 EJS 模板
    无数据持久化

新（Unit 3）：+ src/models/Subscriber.ts                       ← 数据层
    + src/controllers/homeController.ts（postSubscribe 重写）   ← 异步写库 + 错误分流
    + views/subscribers.ejs                                    ← 后台列表页
    + .env + .env.example                                      ← 环境管理
    + public/css/style.css（表格样式）                           ← 视觉闭环
```

---

## 核心认知

| 领域 | 收获 |
|------|------|
| 数据建模 | Schema 是数据的宪法，类型选择服务于业务语义 |
| 启动顺序 | 先连库 → 再监听，fail fast |
| 错误处理 | 已知错误安抚用户（回渲表单），未知错误甩给框架（500） |
| 双重校验 | 前端快速反馈，后端最终防线，缺一不可 |
| 环境管理 | `.env` + `.env.example` + 代码默认值，三层兜底 |
| 开发体验 | mongodb-memory-server 消灭了"还得装个 MongoDB"的门槛 |
| 表单闭环 | 提交→校验→入库→回填，每一个分支用户都不会丢数据 |
| 编码意识 | 请求的编码 = 数据存的编码 ≠ 你看到的字符 |

---

## 验证清单

- [x] `pnpm build` — TypeScript 编译通过
- [x] `GET /contact` — 订阅表单（name + email + zipCode）
- [x] `POST /subscribe` — 成功入库 + 跳转感谢页
- [x] `POST /subscribe` 重复邮箱 — 红色错误提示 + 表单回填
- [x] `POST /subscribe` 无效邮编 — 后端校验拒绝
- [x] `GET /subscribers` — 表格展示所有订阅者，中文正常
- [x] MongoDB 不可用时 — 进程退出，不假装正常
- [x] 内存 MongoDB 重启后 — 不丢数据
