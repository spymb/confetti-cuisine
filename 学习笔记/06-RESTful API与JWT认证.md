# 第六课：RESTful API 与 JWT 认证 — 学习笔记

## 一、本课概览

在第五课 Passport 认证系统的基础上，引入 **RESTful JSON API 层**和**JWT 双轨认证**，并完成从自定义 CSS 到 **Tailwind CSS** 的 UI 重构，项目从前端不分的单体应用向**前后端分离的过渡态**演进。

| 主题 | 核心内容 |
|------|---------|
| 双轨认证 | Passport Session（EJS 页面） + JWT Bearer Token（客户端 JS API 调用）|
| JWT 工具层 | jsonwebtoken 签发/验证，24h 过期，载荷最小化 |
| 统一响应信封 | `{ code, message, data }` — 所有 API 端点同一格式 |
| Session→JWT 桥接 | `/api/v1/auth/token` 让浏览器 JS 用已有 cookie 换 token |
| API 版本化 | `/api/v1/` 前缀为未来升级预留空间 |
| Swagger 文档 | swagger-jsdoc 从 JSDoc 注释自动生成 OpenAPI 3.0 规范 |
| 前端 JS 交互 | 原生 fetch + sessionStorage 缓存 + 模态框 + 防 XSS |
| Tailwind CSS | 实用优先 CSS 框架，自定义设计令牌，原子类组合 |
| MongoDB 防重复 | `$addToSet` 原子操作防止重复选课 |

---

## 二、为什么要加 API 层

### 第五课的状态

第五课是纯服务端渲染（SSR）：所有页面都是 EJS 模板在服务端拼好 HTML 返回，交互靠传统表单 POST + 重定向。这有两个局限：

1. **无法做"不刷新页面"的交互** — 比如在首页弹一个模态框浏览课程并报名，每次操作都必须整页刷新
2. **无法给第三方客户端用** — 移动 App、小程序只能调 JSON API，不能解析 HTML

### 本课的解决方案

新增 `/api/v1/*` JSON API 层，与现有 EJS 页面**共存**：

```
EJS 页面（原有，不改动）          JSON API（新增）
─────────────────────────      ──────────────────────
GET  /courses        → HTML    GET  /api/v1/courses        → JSON
POST /login          → 302     POST /api/v1/auth/login     → JSON
GET  /my-courses     → HTML    GET  /api/v1/users/me       → JSON
                               POST /api/v1/courses/:id/enroll → JSON
```

EJS 页面继续用 Session 认证，API 端点用 JWT 认证——**两个认证体系并行不悖**。

---

## 三、双轨认证架构（本课最核心的概念）

### 为什么需要两套认证

| | Session（Passport） | JWT |
|---|---|---|
| 载体 | `connect.sid` cookie，浏览器自动发送 | `Authorization: Bearer <token>` 请求头，JS 手动携带 |
| 验证方式 | 每次请求查 MongoDB sessions 集合 | 本地验签，无需查库 |
| 适用场景 | EJS 页面（`<a>` 链接、`<form>` 提交） | 客户端 JS 的 `fetch()` 调用 |
| 过期控制 | 服务端 session 有过期时间 | token 自身带 `exp` 声明 |

**JWT 不是 Session 的替代品，而是补充。** 浏览器 JS 无法安全存储密码，但可以安全持有 session cookie——所以用桥接端点让 JS 拿 cookie 换 JWT。

### 桥接端点：/api/v1/auth/token

这是理解本课架构的钥匙：

```
浏览器 JS 调用 ensureToken()
  │
  ├─ 先查 sessionStorage.getItem('jwt_token')
  │   ├─ 有 → 直接用（可能是 30 秒前拿的）
  │   └─ 没有 ↓
  │
  └─ fetch('/api/v1/auth/token')
       │  浏览器自动带上 connect.sid cookie
       ▼
     requireSession 中间件 → req.isAuthenticated()？
       ├─ 是 → authController.getToken
       │         └─ jwt.generateToken(req.user) → 返回 JWT
       └─ 否 → 401 JSON
       │
       ▼
     JS 收到 token → 存 sessionStorage → 后续 API 调用都带 Authorization 头
```

**关键认知：** 用户不需要重新输入密码。浏览器的 session cookie 就是"我已经登录过"的凭证，桥接端点只是换了一种格式（从 cookie 换成 Bearer token）。

### sessionStorage vs localStorage

```javascript
// ✅ 本课用 sessionStorage
sessionStorage.setItem('jwt_token', token);

// ❌ 不用 localStorage
localStorage.setItem('jwt_token', token);
```

原因：`sessionStorage` 在关闭标签页时自动清除，token 不会无限期留在浏览器里。`localStorage` 持久化到磁盘，攻击面更大。

---

## 四、JWT 工具函数设计

### generateToken — 签发时存什么

```typescript
// src/utils/jwt.ts
const payload: JwtPayload = {
  userId: String(user._id),
  email: user.email,
  role: user.role,
};
return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
```

载荷只含三个字段：`userId`、`email`、`role`。**不放 enrolledCourses**——用户选课后 JWT 不会自动更新，拿 JWT 里的 enrolledCourses 是过期的。所以 `GET /api/v1/users/me` 每次实时查库。

### verifyToken — 验证时区分解码

```typescript
export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
  return decoded;
}
```

调用方自己 try-catch。中间件根据错误类型给不同的中文提示：

```typescript
const message =
  err.name === 'TokenExpiredError'
    ? '认证令牌已过期，请重新登录'
    : '认证令牌无效';
```

### 环境变量隔离

```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
```

开发环境有默认值，生产环境必须通过 `.env` 注入——避免把密钥写死在代码里。

---

## 五、统一响应信封

### 为什么需要

如果每个 API 端点返回格式不同：

```json
// 有的这样
{ "success": true, "courses": [...] }

// 有的这样
{ "error": "未登录" }

// 有的这样
{ "ok": false, "errors": [{ "field": "email", "message": "格式错误" }] }
```

前端就要为每种格式写不同的处理逻辑。统一信封解决了这个问题。

### 本课的设计

```typescript
// src/utils/apiResponse.ts
interface ApiResponse<T> {
  code: number;    // 0 = 成功，非零 = HTTP 错误码
  message: string;  // 人类可读的提示
  data: T | null;   // 实际数据
}

// 成功
success("登录成功", { token: "eyJhb..." })
→ { code: 0, message: "登录成功", data: { token: "eyJhb..." } }

// 失败
error(401, "认证令牌已过期")
→ { code: 401, message: "认证令牌已过期", data: null }
```

前端只需统一判断 `result.code === 0`，不需要同时检查 HTTP 状态码和响应体。

---

## 六、API 中间件设计

### requireJWT — JWT 验证中间件

```typescript
export function requireJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  // ① 检查 Authorization 头是否存在
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json(error(401, '未提供认证令牌'));
    return;  // ← 注意：return，不是 next()
  }

  // ② 提取 token（"Bearer " 占 7 个字符）
  const token = authHeader.slice(7);

  // ③ 验证 token → 挂到 req.jwtPayload
  try {
    req.jwtPayload = verifyToken(token);
    next();
  } catch (err) {
    // ④ 区分过期 vs 无效
    res.status(401).json(error(401, ...));
  }
}
```

关键差异：失败时返回 **JSON + 401** 而不是 `res.redirect('/login')`。这是 API 中间件和页面中间件的根本区别——API 调用方通常是 JS 代码，它看不懂 HTML 重定向。

### requireSession — Session 验证中间件（JSON 版）

```typescript
export function requireSession(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json(error(401, '请先登录'));
}
```

这是 Passport 的 `isAuthenticated()` 套了一层 JSON 外壳。**只在桥接端点 `/api/v1/auth/token` 使用**——其他地方不需要，因为其他 API 端点都用 JWT。

### 中间件类型声明

```typescript
// src/types/express.d.ts 新增
interface Request {
  jwtPayload?: {
    userId: string;
    email: string;
    role: string;
  };
}
```

不给这个字段加类型声明，之后每个控制器里 `req.jwtPayload.userId` 都会报 TypeScript 编译错误。Declaration Merging 的又一次应用。

---

## 七、API 控制器设计要点

### postLogin — 邮箱密码换 JWT

```typescript
// 流程：Zod 校验 → 查用户 → bcrypt 比密码 → 签发 JWT
const user = await User.findOne({ email });
const isMatch = await user.comparePassword(password);
if (!isMatch) return res.status(401).json(error(401, '邮箱或密码错误'));

const token = generateToken(user);
return res.json(success({ token }, '登录成功'));
```

第五课的 Passport 登录认证成功后会 `req.login()` 写 session，这里改为签发 JWT。其他逻辑完全一样（同一个 Zod schema、同一个 `comparePassword`）。

### postEnroll — $addToSet 防重复报名

```typescript
// 原子操作：如果 enrolledCourses 里已经有这个 courseId，什么都不做
await User.findByIdAndUpdate(
  userId,
  { $addToSet: { enrolledCourses: courseId } }
);
```

`$addToSet` vs `$push`：

| | `$push` | `$addToSet` |
|---|---|---|
| 重复值 | 会重复加入 | 自动去重，忽略重复 |
| 幂等性 | 不幂等 | 幂等 |
| 适用场景 | 有序列表、操作日志 | 集合、去重列表 |

用户快速双击"报名"按钮，两次请求几乎同时到达——如果用了 `$push`，两个请求都查到用户还没选课，都执行 push，就会产生重复记录。`$addToSet` 在 MongoDB 层面保证幂等性。

### getMe — 字段白名单

```typescript
// 返回字段白名单 —— 永远不返回 password
return res.json(success({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  enrolledCourses: user.enrolledCourses,
}));
```

手动挑选返回字段而非 `.lean()` 后直接返回整个对象。虽然 User 模型没设 `select: false`，但 API 层做一次白名单是**纵深防御**——万一模型层漏了，控制器层还能拦住。

---

## 八、前端 JS 架构

### 模块职责划分

```
ensureToken()       ← Token 获取 + 缓存策略（核心）
  └─ apiFetch()     ← 通用 fetch 封装（自动带 Authorization + 401 处理）
       ├─ openCourseModal()  ← 打开模态框 + 并行请求
       │    ├─ fetch('/api/v1/courses')       ← 公开接口
       │    └─ apiFetch('/users/me')           ← JWT 认证
       ├─ handleEnroll()     ← 报名操作
       │    └─ apiFetch('/courses/:id/enroll', POST)
       └─ escapeHtml()      ← XSS 防护工具
```

### apiFetch — 为什么需要封装

```javascript
async function apiFetch(path, options = {}) {
  // ① 自动获取 token（无感）
  const token = await ensureToken();

  // ② token 拿不到 → 跳到登录页
  if (!token) {
    window.location.href = '/login';
    return { code: 401, message: '未登录', data: null };
  }

  // ③ 自动带 Authorization 头
  const resp = await fetch('/api/v1' + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
      ...options.headers,
    },
  });

  // ④ 401 → 清缓存 + 跳登录
  if (resp.status === 401) {
    sessionStorage.removeItem('jwt_token');
    window.location.href = '/login';
  }

  return resp.json();
}
```

封装后控制器代码非常干净：

```javascript
// handleEnroll 只需要关心业务逻辑
const result = await apiFetch(`/courses/${courseId}/enroll`, { method: 'POST' });
if (result.code === 0) { /* 成功 */ }
else { /* 失败 */ }
```

不需要手动管 token、不需要管 401 跳转、不需要管错误格式。**好的封装让调用方只看到业务逻辑。**

### escapeHtml — 最简洁的 XSS 防护

```javascript
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;  // textContent 自动转义，不会解析 HTML
  return div.innerHTML;    // 读出转义后的文本
}
```

攻击者输入 `<img src=x onerror="stealCookie()">` → `textContent` 把它当纯文本设置 → `innerHTML` 读出 `&lt;img src=x onerror="stealCookie()"&gt;` → 浏览器渲染成文字而非执行代码。

**为什么用 DOM API 而不是正则？** 正则做 HTML 转义需要枚举所有特殊字符（`<` `>` `"` `'` `&`），容易遗漏。`textContent` 是浏览器原生实现，永远不会漏。

### 模态框事件绑定

```javascript
document.addEventListener('DOMContentLoaded', () => {
  // 点击遮罩关闭
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeCourseModal();
  });

  // Escape 键关闭
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeCourseModal();
    }
  });
});
```

两个细节：
- `e.target === modal` 而非 `e.target === e.currentTarget` — 确保只在点击遮罩（最外层）时关闭，点击模态框内部不关闭
- Escape 监听加 `!modal.classList.contains('hidden')` — 模态框隐藏时不响应，避免在其他页面误关

---

## 九、Swagger 文档自动化

### 工作流程

```
JSDoc 注释（写在控制器里）
  ↓ swagger-jsdoc 扫描并解析
OpenAPI 3.0 JSON
  ↓ swagger-ui-express 读取并渲染
浏览器 /api-docs 交互式文档
```

### JSDoc 注释示例

```typescript
/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: 用户登录（返回 JWT）
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       200: { description: 登录成功，返回 JWT }
 *       401: { description: 邮箱或密码错误 }
 */
```

**注释即文档**——改代码时顺便改注释，文档永远不会和实现脱节。不需要单独维护一份 API 文档。

### Swagger 配置

```typescript
// src/config/swagger.ts
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: '缤纷厨房 API', version: '1.0.0' },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/controllers/api/*.ts'],  // ← 扫描哪个目录
});
```

`securitySchemes.bearerAuth` 配置后，Swagger UI 会自动在右上角显示 "Authorize" 按钮，填入 token 后所有测试请求自动带 `Authorization: Bearer <token>` 头。

---

## 十、Tailwind CSS 实用优先

### 从自定义 CSS 到 Tailwind 的迁移

本课**删除了** 576 行的 `public/css/style.css`，全部用 Tailwind 原子类改写。对比：

```html
<!-- 之前：HTML 只有一个 class 名 -->
<input class="form-input" />
<!-- 要查 style.css 才知道 .form-input 长什么样 -->

<!-- 之后：所有样式都在标签上 -->
<input class="w-full px-3 py-2.5 border border-gray-300 rounded text-base
              transition-colors focus:outline-none focus:border-brand
              focus:ring-2 focus:ring-brand/15" />
<!-- 一眼看全：宽度、内边距、边框、圆角、字号、过渡、聚焦态 -->
```

### 设计令牌：先定义色板，再全局引用

```javascript
// _head.ejs
tailwind.config = {
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#b33c2b', light: '#fef0ed', dark: '#922b1f' },
        warm: { bg: '#fefaf5', text: '#3d2c2c', muted: '#6b4e4e' },
      }
    }
  }
}
```

全站只使用这 6 个语义化颜色令牌，从不直接写色值：

| 令牌 | 色值 | 用途 |
|------|------|------|
| `brand` | #b33c2b | 导航栏、主按钮、标题 |
| `brand-light` | #fef0ed | 次要按钮、标签底色 |
| `brand-dark` | #922b1f | hover 加深 |
| `warm-bg` | #fefaf5 | 页面底色 |
| `warm-text` | #3d2c2c | 正文文字 |
| `warm-muted` | #6b4e4e | 次要文字 |

以后换品牌色，只改这几行配置，整个站点自动生效。

### 响应式的条件语法

```html
<!-- 手机：单列；md(≥768px)：双列 -->
<div class="grid grid-cols-1 md:grid-cols-2 gap-4">

<!-- 自适应列数：每列最小 280px -->
<div class="grid gap-6 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
```

没有一行 `@media` 查询。`md:` 前缀就是断点条件，`auto-fill + minmax` 让列数随浏览器宽度自动变化。

### 交互状态的就地声明

```html
<!-- 斑马纹 + 悬停高亮 -->
<tr class="even:bg-warm-bg hover:bg-brand-light transition-colors">

<!-- 按钮悬停加深 -->
<button class="bg-brand hover:bg-brand-dark transition-colors">

<!-- 输入框聚焦光晕 -->
<input class="focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15">
```

`hover:` `focus:` `even:` 等前缀让你在同一行看到元素在所有交互状态下的表现。

### 粘性页脚：Flex 模式

```html
<body class="min-h-screen flex flex-col">
  <nav>...</nav>           <!-- 固定高度 -->
  <main class="flex-1">...</main>  <!-- flex-1 撑满剩余空间 -->
  <footer>...</footer>
</body>
```

`flex-1` 让 `<main>` 吃掉所有剩余空间，把 footer 推到底部。不用 `calc()`，不用 `position: fixed`。

---

## 十一、CSP 策略的同步更新

每次添加外部资源或内联脚本，都必须同步更新 CSP：

```typescript
// main.ts — 本课新增/修改的指令
scriptSrc:  ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
//                                                ↑ Tailwind CDN
connectSrc: ["'self'"],
//           ↑ JS fetch 调用自家 API 需要这个
imgSrc:     ["'self'", "data:"],
//                     ↑ data URI（如果有的话）
```

**CSP 必须最后调整**——因为只有所有代码写完才知道用了哪些外部资源。先改 CSP 后写代码可能导致页面被浏览器拦截，排查起来很痛苦。

---

## 十二、API 路由版本化

```
/api/v1/
  ├── auth/       POST login, GET token
  ├── courses/    GET /, GET /:id, POST /:id/enroll
  └── users/      GET /me
```

`v1` 前缀为未来升级预留空间。比如 v2 可能改变响应格式或业务逻辑，但 v1 继续维护给旧客户端用。**版本号在 URL 里而非请求头里**——URL 版本化最直观、最便于调试（curl 一眼能看出来调的哪个版本）。

### API 专属错误处理

```typescript
// src/routes/api/v1/index.ts
app.use((err, req, res, next) => {
  if (err.name === 'CastError') {
    return res.status(400).json(error(400, 'ID 格式不正确'));
  }
  res.status(500).json(error(500, '服务器内部错误'));
});
```

对比页面路由的错误处理返回 HTML（`res.render('500')`），API 路由始终返回 JSON——调用方是机器，不是人眼。

---

## 十三、公开 vs 受保护的 API

| 端点 | 认证 | 原因 |
|------|------|------|
| `GET /api/v1/courses` | 无 | 课程目录是公开信息 |
| `GET /api/v1/courses/:id` | 无 | 课程详情也是公开的 |
| `POST /api/v1/auth/login` | 无 | 你还没登录，怎么带 token |
| `GET /api/v1/auth/token` | `requireSession` | 这是一个特例——用 Session 换 JWT |
| `POST /api/v1/courses/:id/enroll` | `requireJWT` | 报名需要知道是谁 |
| `GET /api/v1/users/me` | `requireJWT` | 返回当前用户信息 |

规律：**读课程是公开的，写操作和用户数据需要认证。** 这与第五课的页面路由权限逻辑一致（前台页面公开，管理后台受保护）。

---

## 十四、开发流程总结

自底向上，每层独立可验证：

```
① apiResponse.ts    — 定义成功/失败两个工厂函数
② jwt.ts            — generateToken + verifyToken，REPL 里直接测
③ express.d.ts      — 追加 jwtPayload 类型声明
④ apiAuth.ts        — requireJWT + requireSession 中间件
⑤ API 控制器         — auth → course → user，挂临时路由用 curl 验证
⑥ API 子路由         — 3 个路由文件 + 聚合器 + API 错误处理
⑦ main.ts 挂载      — /api/v1 + /api-docs
⑧ JSDoc 注释        — 补到 3 个控制器里 → swagger.ts → 浏览器 /api-docs 验证
⑨ main.js           — ensureToken → apiFetch → openCourseModal → handleEnroll
⑩ EJS 页面          — _courseModal.ejs → my-courses.ejs → index.ejs 集成
⑪ CSP 策略          — 最后收紧：scriptSrc / connectSrc / imgSrc
⑫ 全流程走查        — 用户视角从头到尾走一遍
```

核心原则：**每一步写完就能立刻验证，永远不写"等后面那步写完了才能测"的代码。**

---

## 十五、代码阅读顺序建议

不是按目录结构看，而是按**依赖关系从底层到上层**：

```
第一轮：理解"地基"
  ① apiResponse.ts     — 5 分钟，最简单的工厂函数
  ② jwt.ts             — 10 分钟，签发/验证逻辑
  ③ apiAuth.ts         — 15 分钟，双轨认证的核心

第二轮：理解"做什么"
  ④ authController.ts  — 15 分钟，两种登录方式
  ⑤ courseController.ts — 20 分钟，重点看 $addToSet
  ⑥ userController.ts  — 10 分钟，字段白名单

第三轮：理解"怎么串"
  ⑦ 3 个路由文件       — 各 3 分钟，中间件 + 控制器的排列组合
  ⑧ api/v1/index.ts    — 5 分钟，聚合 + 错误处理

第四轮：理解"怎么用"
  ⑨ main.js            — 30 分钟，从 ensureToken 开始沿调用链走

第五轮：理解"文档"
  ⑩ swagger.ts         — 10 分钟，对照 JSDoc 注释回看

第六轮：理解"骨架"
  ⑪ _courseModal.ejs   — 5 分钟，HTML 骨架如何配合 JS
  ⑫ my-courses.ejs     — 5 分钟，纯 SSR 渲染对比 JS 动态渲染
  ⑬ _head.ejs          — 5 分钟，Tailwind CDN + 设计令牌 + 导航栏
```

读完后在脑中模拟一次完整用户流程——如果每一步都能说清楚是哪个文件、哪个函数在干活，就说明读透了。

---

## 十六、关键文件索引

| 文件 | 职责 | 行数 |
|------|------|------|
| [src/utils/apiResponse.ts](../src/utils/apiResponse.ts) | 统一 API 响应格式（success + error） | 22 |
| [src/utils/jwt.ts](../src/utils/jwt.ts) | JWT 签发 + 验证 + 类型定义 | 37 |
| [src/middleware/apiAuth.ts](../src/middleware/apiAuth.ts) | requireJWT + requireSession 中间件 | 58 |
| [src/types/express.d.ts](../src/types/express.d.ts) | req.jwtPayload 类型声明 | ~31 |
| [src/controllers/api/authController.ts](../src/controllers/api/authController.ts) | postLogin / getToken + Swagger JSDoc | ~80 |
| [src/controllers/api/courseController.ts](../src/controllers/api/courseController.ts) | getCourses / getCourse / postEnroll | ~90 |
| [src/controllers/api/userController.ts](../src/controllers/api/userController.ts) | getMe（字段白名单 + populate） | ~40 |
| [src/controllers/myCoursesController.ts](../src/controllers/myCoursesController.ts) | "我的课程"页面控制器 | ~25 |
| [src/routes/api/v1/index.ts](../src/routes/api/v1/index.ts) | API v1 聚合器 + 错误处理 | ~30 |
| [src/routes/api/v1/authRoutes.ts](../src/routes/api/v1/authRoutes.ts) | POST /login + GET /token | ~15 |
| [src/routes/api/v1/courseRoutes.ts](../src/routes/api/v1/courseRoutes.ts) | GET / + GET /:id + POST /:id/enroll | ~20 |
| [src/routes/api/v1/userRoutes.ts](../src/routes/api/v1/userRoutes.ts) | GET /me | ~10 |
| [src/config/swagger.ts](../src/config/swagger.ts) | Swagger 配置 + /api-docs 挂载 | ~40 |
| [public/js/main.js](../public/js/main.js) | Token 管理 + apiFetch + 模态框 + XSS 防护 | 161 |
| [views/_head.ejs](../views/_head.ejs) | Tailwind CDN + 设计令牌 + 导航栏 | 76 |
| [views/index.ejs](../views/index.ejs) | 首页（含"快速预览"按钮 + 模态框引入） | 27 |
| [views/partials/_courseModal.ejs](../views/partials/_courseModal.ejs) | 模态框 HTML 骨架 | 14 |
| [views/my-courses.ejs](../views/my-courses.ejs) | "我的课程"页面（纯 SSR） | 25 |
| [views/courses/index.ejs](../views/courses/index.ejs) | 课程管理列表（Tailwind 表格 + AJAX 删除） | 48 |
| [views/login.ejs](../views/login.ejs) | 登录表单（Tailwind 样式） | 35 |
| [src/main.ts](../src/main.ts) | 入口：CSP 更新 + /api/v1 + /api-docs 挂载 | ~160 |

---

## 十七、与第五课的关系

本课**不是替代**第五课，而是**在第五课基础上加了一层**：

```
第五课产物                      第六课新增
─────────────────────────      ──────────────────────
Passport Session 认证    →     保留不动，继续服务 EJS 页面
EJS 页面路由             →     保留不动，继续服务浏览器导航
User/Course/Subscriber   →     保留不动，API 复用同一个模型
CRUD 控制器              →     保留不动，管理后台继续用

                               ✚  JWT 工具层（jwt.ts）
                               ✚  API 认证中间件（apiAuth.ts）
                               ✚  API 控制器（复用模型，新的响应格式）
                               ✚  API 路由（/api/v1/*）
                               ✚  桥接端点（/api/v1/auth/token）
                               ✚  前端 JS（main.js）
                               ✚  Swagger 文档
                               ✚  Tailwind CSS 全局样式改造
```

旧代码一行没删，新代码作为独立子系统加上去。这是真实项目中架构演进的典型方式——**增量叠加而非推倒重来。**
