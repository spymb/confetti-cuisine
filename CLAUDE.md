# CLAUDE.md

## 常用命令

```bash
pnpm dev          # 开发服务器（tsx watch 热重载，端口 3000）
pnpm build        # TypeScript 编译到 dist/
pnpm start        # 生产运行（需先 build）
pnpm tsx src/seed/seedDemo.ts    # 灌入演示数据（课程+订阅者+用户）
```

通过 `PORT` 环境变量自定义端口：`PORT=8080 pnpm dev`

## 技术栈

**Express 5.2 + EJS 6 + Mongoose 9 + Zod 4 + TypeScript 严格模式 + ES Modules。**

## 架构概览

```
main.ts                    ← Express 应用入口：helmet、morgan、视图引擎、body 解析、MongoDB 连接
├── routes/index.ts        ← 公开路由（首页、课程展示、联系我们、订阅） + 挂载 CRUD 子路由
│   ├── routes/userRoutes.ts       ← /admin/users CRUD
│   ├── routes/courseRoutes.ts     ← /admin/courses CRUD
│   └── routes/subscriberRoutes.ts ← /admin/subscribers CRUD
├── controllers/
│   ├── homeController.ts          ← 公开页面 + 订阅表单
│   ├── userController.ts          ← 用户 CRUD（含 populate 关联展示）
│   ├── courseController.ts        ← 课程 CRUD
│   ├── subscriberController.ts    ← 订阅者 CRUD
│   └── errorController.ts         ← 404 / 500
├── models/
│   ├── User.ts            ← 用户（关联 Course 多对多 + Subscriber 一对一）
│   ├── Course.ts          ← 课程（软删除 + 部分唯一索引）
│   └── Subscriber.ts      ← 订阅者（真删除，无外部引用）
├── validators/            ← Zod 校验 schema（每个模型 create + update）
└── data/courses.ts        ← 静态课程数据（仅用于 seed 脚本）
```

### 路由设计：公开 vs 管理后台

| 路由 | 受众 | 说明 |
|------|------|------|
| `/courses` | 访客 | 课程卡片展示页，数据来自 MongoDB |
| `/admin/courses` | 管理员 | 课程 CRUD 管理 |
| `/admin/users` | 管理员 | 用户 CRUD 管理 |
| `/admin/subscribers` | 管理员 | 订阅者 CRUD 管理 |

**原则**：一个页面面向两种受众时才用前缀区分。User 和 Subscriber 没有访客展示需求，直接被管理后台替代。

### 视图布局

所有页面共用 `_head.ejs` / `_foot.ejs`（`include` 方式），不使用 layout.ejs —— EJS 没有 slot 机制，两段式渲染无额外收益。导航栏在 `_head.ejs` 中，公开链接和管理后台链接用 `|` 分隔。

## 关键设计决策

### 删除策略：按引用关系决定

| 模型 | 策略 | 原因 |
|------|------|------|
| Course | **软删除**（deletedAt + pre 中间件 + 部分唯一索引） | 被 User.enrolledCourses 引用，真删除会产生悬挂 ID |
| User | **真删除** | 顶层实体，无外部引用 |
| Subscriber | **真删除** | 被 User.subscriberProfile 引用但非强制，退订即移除 |

软删除实现：
- `deletedAt: { type: Date, default: null }`
- `schema.pre(['find', 'findOne', 'findOneAndUpdate', ...], ...)` 自动注入 `deletedAt: null`
- `_includeDeleted: true` 逃生舱 → 查询包含已删除文档
- Course 用 `partialFilterExpression: { deletedAt: null }` 做部分唯一索引，允许删除后重建同名课程

### 所有写操作统一 AJAX + JSON

POST / PUT / DELETE 全部走 fetch → JSON → { ok, redirect/errors }，不与 HTML 表单原生提交混用：

```ts
// ✅ 控制器
res.json({ ok: true, redirect: '/admin/courses' });      // 成功
res.json({ ok: false, errors: [...] });                   // 失败

// ✅ 前端
const result = await resp.json();
if (result.ok) window.location.href = result.redirect;     // 跳转
else showErrors(result.errors);                            // 局部渲染错误
```

仅前台 `/subscribe` 仍走传统 `<form method="POST">` + 服务端渲染（prg），因为访客页面不需要 AJAX 交互。

### CSP 与模板变更的耦合

helmet CSP 配置在 `main.ts`。每次在 EJS 模板中添加内联 `<script>` 或 `onclick`，必须同步检查 CSP 是否放行：

```ts
scriptSrc: ["'self'", "'unsafe-inline'"],     // <script> 标签
scriptSrcAttr: ["'unsafe-inline'"],             // onclick 等内联事件
```

只用 curl 验证会漏掉 CSP 问题 —— curl 不执行浏览器安全策略。

### Zod + Mongoose 双层校验

Zod 做第一道拦截（HTTP 层），Mongoose 做第二道兜底（数据库层）。`findByIdAndUpdate` 必须带 `{ runValidators: true }`，否则 Mongoose 校验不触发。

### 模型关联与 populate

User Show 页面使用 populate 展示关联数据：

```ts
await User.findById(id)
  .populate('enrolledCourses')
  .populate('subscriberProfile')
  .lean();
```

## 编码约定

- **所有面向用户的文本使用中文**（注释、日志、错误消息、页面内容）
- 变量名、函数名、字段名使用英文
- 控制器函数命名：`getIndex` / `getNew` / `postCreate` / `getShow` / `getEdit` / `putUpdate` / `deleteRemove`
- `views/` 按模型分子目录：`users/`、`courses/`、`subscribers/`
- `currentPage` 变量控制导航高亮，管理后台页面使用 `courses-admin` 避免与公开页面 `courses` 冲突
