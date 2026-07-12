# 第四课：完整 CRUD 管理系统 — 学习笔记

## 一、本课概览

从第三课的**单表订阅者 CRUD** 升级到 **多模型关联 + 完整管理系统**，涵盖 User、Course、Subscriber 三个资源的 CRUD，以及它们之间的关联操作。

| 主题 | 核心内容 |
|------|---------|
| 多模型设计 | 三个 Mongoose 模型的字段定义、约束、关联 |
| 双层校验 | Zod（应用层）+ Mongoose（数据库层）双重输入校验 |
| RESTful 七动作 | index / new / create / show / edit / update / destroy |
| 错误处理 | ZodError / ValidationError / 11000 / CastError 四分支 |
| 软删除 | deletedAt + pre 中间件 + partial unique index |
| 前后台路由 | 公开页面（/）vs 后台管理（/admin）的路由组织 |
| 开发流程 | 自底向上：Model → Validator → Controller → Route → View |

---

## 二、项目架构

### 前后端一体 MPA

本项目是**传统服务端渲染的多页应用**，所有路由由 Express 管理，EJS 在服务端拼装 HTML。

- **不是 SPA**：没有 React/Vue 前端，没有前端路由
- **有 AJAX 但不是分离**：`fetch` 用于所有 POST/PUT/DELETE 写操作（统一 JSON 通信），但处理完仍然整页跳转
- **本质**：全部是后端路由，URL 前缀区分了"前台"和"后台"

### 路由全景

```
公开页面（访客）：
  GET  /              首页
  GET  /courses       课程展示（只读）
  GET  /contact       联系表单
  POST /subscribe     订阅提交（简单校验，无 Zod）

后台管理（管理员，未来需认证）：
  GET    /admin/users           用户列表
  POST   /admin/users           创建用户  ── AJAX JSON 通信
  GET    /admin/users/:id       用户详情  ── populate 跨表关联
  PUT    /admin/users/:id       更新用户  ── AJAX JSON 通信
  DELETE /admin/users/:id       删除用户  ── 真删除

  /admin/courses         （7 动作，同上）── 软删除 + partial unique index
  /admin/subscribers     （7 动作，同上）── 真删除

所有后台写操作（POST/PUT/DELETE）统一走 fetch → JSON → { ok, redirect/errors }，
不再混用 PRG。仅前台 /subscribe 保留传统 <form> 提交。
```

---

## 三、多模型设计与关联

### 三个模型的关系

```
User ──多对多──→ Course    （enrolledCourses: [ObjectId]）
User ──一对一──→ Subscriber （subscriberProfile: ObjectId）
```

### 关联实现

**Schema 中声明 ref：**

```typescript
enrolledCourses: [{ type: Schema.Types.ObjectId, ref: 'Course' }]
subscriberProfile: { type: Schema.Types.ObjectId, ref: 'Subscriber' }
```

**查询时 populate 做 JOIN：**

```typescript
// 不用 populate：只有 ID 数组，需要手动循环查询
await User.find().lean()

// 用 populate：自动关联，返回完整子文档
await User.find().populate('enrolledCourses', 'title').lean()
// 第二个参数 'title' 表示只取 title 字段，减少数据传输
```

---

## 四、双层输入校验体系

| 层级 | 工具 | 职责 | 失败表现 |
|------|------|------|---------|
| 应用层 | Zod | 类型安全校验，`.parse()` / `.partial()` | 返回表单 + 字段级错误 |
| 数据库层 | Mongoose | `required` / `unique` / `min` / 自定义 validator | 兜底拦截，数据不落库 |

### 关键技巧

- **`z.coerce.number()`**：表单 POST 的 `cost` 是字符串 `"399"`，coerce 自动转数字
- **`.partial()`**：编辑表单只提交变更字段，partial 让所有字段可选
- **`.or(z.literal(''))`**：HTTP 表单留空是空字符串，不是 undefined，必须显式放行
- **两层规则一致**：Zod 拦截 99% 的非法输入，Mongoose 是最后防线（防 Zod 遗漏或直接 API 调用）

---

## 五、RESTful 七动作模式

三个资源遵循统一模式，体现了**约定优于配置**的设计思想：

| 动作 | HTTP | URL | 控制器函数 | 响应方式 |
|------|------|-----|-----------|---------|
| 列表 | GET | /resources | getIndex | EJS 渲染 |
| 新建表单 | GET | /resources/new | getNew | EJS 渲染 |
| 创建 | POST | /resources | postCreate | JSON `{ok, redirect}` |
| 详情 | GET | /resources/:id | getShow | EJS 渲染 |
| 编辑表单 | GET | /resources/:id/edit | getEdit | EJS 渲染 |
| 更新 | PUT | /resources/:id | putUpdate | JSON `{ok, redirect}` |
| 删除 | DELETE | /resources/:id | deleteRemove | JSON `{ok, redirect}` |

### 路由顺序陷阱

`/new` 必须在 `/:id` **之前**，否则 Express 会把 `"new"` 当作 `:id` 参数匹配，`/new` 永远不可达。原则：**固定路径在前，动态参数在后**。

### 统一的 AJAX 写操作

所有 POST/PUT/DELETE 使用相同的 fetch → JSON 模式，新建表单和编辑表单的交互代码完全一致：

- 表单用 `fetch` 提交，`e.preventDefault()` 阻止原生提交
- 控制器返回 `{ ok: true, redirect }` 或 `{ ok: false, errors }`
- 成功跳转，失败局部渲染错误 DOM
- `<select multiple>` 用 `formData.getAll()` 直接拿数组，不再需要服务端做 urlencoded 标准化

仅前台 `/subscribe` 保留传统 `<form method="POST">` + 服务端渲染，因为它不需要 AJAX 交互。

---

## 六、错误处理四层分类

每个控制器精确捕获四种错误（以创建用户为例）：

```typescript
try {
  const parsed = createUserSchema.parse(req.body);  // ① 先过 Zod
  await User.create(parsed);                         // ② 再过 Mongoose
} catch (err) {
  // ① ZodError —— 输入格式不合法
  if (err instanceof ZodError) { return 表单 + 字段级错误 }

  // ② ValidationError —— Mongoose schema 校验失败
  if (err.name === 'ValidationError') { return 表单 + 错误消息 }

  // ③ E11000 —— MongoDB 唯一索引冲突
  if (err.code === 11000) { return 表单 + "已存在" }

  // ④ 未知错误 → 抛出，由 500 中间件兜底
  throw err;
}
```

| 错误 | 触发条件 | 示例 |
|------|---------|------|
| ZodError | 输入格式不合法 | 邮箱没写 `@`、价格是负数 |
| ValidationError | Mongoose 校验失败 | name 为空、cost 为负数 |
| E11000 | 唯一索引冲突 | 重复 title、重复 email |
| CastError | 无效 ObjectId | `/users/notAnId` |

CastError 返回 404："你要查的东西不可能存在"。

---

## 七、软删除 vs 真删除

### 规则：有依赖关系的表用软删除，无依赖关系的用真删除

| 模型 | 删除策略 | 原因 |
|------|---------|------|
| Course | **软删除** | 被 `User.enrolledCourses` 引用，删了课程不能断学习记录 |
| User | 真删除 | 顶层实体，无外部表引用 |
| Subscriber | 真删除 | 仅被 `User.subscriberProfile` 可选引用，删了设为 null |

### 软删除三层实现

**① Schema 字段：**

```typescript
deletedAt: { type: Date, default: null }
```

**② pre 中间件自动过滤：**

```typescript
schema.pre(['find', 'findOne', ...], function() {
  if (!this.getFilter()._includeDeleted) {
    this.setQuery({ ...this.getFilter(), deletedAt: null });
  }
});
```

**③ partial unique index 允许删后重建同名：**

```typescript
schema.index(
  { title: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);
```

只对活跃文档做唯一约束。同一门课可以多期开设，每期是独立记录。

### `_includeDeleted` 逃生门

查询时临时标记，绕过自动过滤：

```
不带 _includeDeleted → 自动加 deletedAt: null → 只看到活跃数据
带 _includeDeleted: true → 跳过过滤 → 看到全部数据（含已删除）
```

---

## 八、编写代码的标准流程

添加一个新资源时，遵循**自底向上**的 7 步：

```
① Model       ② Validator      ③ Controller    ④ Route      ⑤ 挂载
──────→       ───────→        ───────────→     ─────→      ────→
 底层数据       输入规则         业务逻辑        URL映射      主路由注册

⑥ View        ⑦ 联动
──────→       ────→
 模板渲染      跨资源调整
```

每一步写完立即验证，不要等全部完成再跑。

---

## 九、关键设计决策汇总

| 决策 | 选择 | 理由 |
|------|------|------|
| partial unique index | Course 独有 | 允许同名课程多期开设 |
| 写操作统一 AJAX | POST/PUT/DELETE | 不与 HTML 表单原生提交混用，统一 JSON 通信 |
| 更新手动构建 updateData | userController | partial schema 的 undefined ≠ 不传 |
| Mongoose validator 三种放行 | `null \|\| '' \|\| regex` | null（数据库）、''（HTTP）、5位数字（有效值） |

---

## 十、未完成事项

- [ ] 为 `/admin/*` 路由添加认证中间件
- [ ] 为 User 模型添加 GDPR 硬删除后门
- [ ] 考虑 Course 模型添加 `batch`（期次）字段
