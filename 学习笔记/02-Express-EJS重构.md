# 第二课：Express + EJS 重构 — 从手写轮子到工业化框架

## 课程概览

将 Unit 1 中用原生 `http` 模块手写的静态服务器，全面重构为 Express 5.x + EJS 的 MVC 架构。体验命令式到声明式、手写到框架的生产力飞跃。

---

## 一、命令式 → 声明式

```ts
// 旧（命令式）：告诉电脑怎么做每一步
if (pathname === '/') handlePage(req, res, '/')
else if (pathname === '/courses') handlePage(req, res, '/courses')
else if ...

// 新（声明式）：告诉电脑你要什么
router.get('/', getHome)
router.get('/courses', getCourses)
router.get('/contact', getContact)
```

命令式读起来是"操作手册"，声明式读起来是"功能清单"。需求越多差距越大。

---

## 二、中间件模型

Express 核心就是一条流水线，注册顺序决定执行顺序：

```
请求 → helmet → morgan → body解析 → 静态文件 → 路由 → 404 → 500
```

| # | 中间件 | 类型 | 作用 |
|---|--------|------|------|
| 1 | `helmet()` | 第三方 | 安全响应头（CSP、防点击劫持等） |
| 2 | `morgan()` | 第三方 | HTTP 请求日志 |
| 3 | `express.urlencoded()` | Express 内置 | 解析 POST 表单到 `req.body` |
| 4 | `express.static()` | Express 内置 | 静态文件服务 |
| 5 | `router` | 自定义 | 业务路由分发 |
| 6 | `notFound` | 自定义 | 404 兜底 |
| 7 | `internalError` | 自定义 | 500 异常兜底 |

前 4 个处理与业务无关的横切关注点，后 3 个是应用自身逻辑。

---

## 三、MVC 分层

一次 `/courses` 请求的完整链路：

```
浏览器 → routes/index.ts（分发）→ homeController.ts（取数据+调视图）
                                       │              │
                                       ▼              ▼
                              data/courses.ts    views/courses.ejs
                              （Model：纯数据）   （View：forEach 循环渲染）
```

| 层 | 只管什么 | 不碰什么 |
|----|---------|---------|
| M | 数据结构与数据 | HTTP / 模板 |
| V | HTML 渲染 | 数据库 / 文件系统 |
| C | req → 取数据 → res.render | 不写 HTML |

旧代码 `pages.ts` 把三层全揉在一个文件里，改一处牵动全身。

---

## 四、手写轮子 vs 工业化框架

| 旧（Unit 1） | 新（Express） | 省掉 |
|:---|:---|:---|
| 手写 MIME 映射表 | `express.static()` 自动识别 | 30 行 |
| `createReadStream` + 6 步安全流水线 | `express.static()` 一行 | 130 行 |
| 手写 try/catch 到处兜底 | Express 5 自动传播异步错误 | 7 处 |
| 4 个 HTML 各写一遍导航栏 | `_head.ejs` 写一次全部 include | 4 处重复 |
| 6 张课程卡片硬编码 | `forEach` 三行循环 | 60 行 |

---

## 五、Express 5 自动错误捕获

Express 5 核心改进：async 路由抛错自动传到错误处理中间件，无需 `express-async-errors`。

```ts
// 4 参数 = Express 识别为错误处理中间件
function internalError(err, req, res, _next) {
  // Express 5 自动跳过所有普通中间件直达这里
}
```

错误处理两个分支：

| 环境 | message | stack |
|------|---------|-------|
| 开发 | `err.message`（真实错误） | `err.stack`（完整堆栈） |
| 生产 | "服务器内部错误" | `null`（不渲染） |

---

## 六、CSP 精细配置

helmet 默认 CSP 会阻止内联 `style="..."`。不选一刀切关闭，而是只对 CSS 放行：

```ts
// ❌ 粗暴：整个 CSP 关掉
helmet({ contentSecurityPolicy: false })

// ✅ 精细：CSS 放行，JS 注入防御等全在
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
})
```

---

## 七、EJS 的 `<%=` vs `<%-`

```
<%= value %>  → HTML 转义（用户输入防 XSS）
<%- value %>  → 原始输出（嵌入 HTML 片段）
```

导航栏 `class="active"` 用 `<%=` 时引号被转义成 `&#34;`，浏览器解析失败导致高亮失效。改成 `<%-` 修复。但用户输入（如 `name`）必须用 `<%=`。

---

## 八、`views/` 为何在根目录而非 `src/`

- `.ejs` 在运行时由引擎直接从磁盘读取，不经 `tsc` 编译
- 前端框架的 `src/views/` 是因为 JSX/Vue SFC 需要打包编译
- **规则**：需要编译的放 `src/`，运行时直接读取的放根目录

---

## 项目结构对比

```
旧：src/router.ts + handlers/ + utils/ + types/       ← 6 文件，370 行
    views/*.html                                      ← 4 静态页面，硬编码

新：src/routes/index.ts + controllers/ + data/        ← 5 文件，220 行
    views/_head.ejs + _foot.ejs + 6 页面              ← 8 模板，共享布局
```

---

## 核心认知

| 领域 | 收获 |
|------|------|
| 声明式 | `router.get()` 读起来是功能清单，不是操作手册 |
| 分层 | M/V/C 各司其职，50 个页面时收益才真正显现 |
| 框架 | 框架的价值不在功能（手写也能做），在边界情况的覆盖 |
| 中间件 | 流水线模型——注册顺序就是执行顺序 |
| 安全 | CSP 精细配置比一刀切更值得花时间 |
| 布局 | EJS 原生 `include` 零依赖，比第三方布局库更可靠 |

---

## 验证清单

- [x] `pnpm build` — TypeScript 编译通过
- [x] `GET /` — 首页 + 导航高亮
- [x] `GET /courses` — 6 张卡片 EJS 循环渲染
- [x] `GET /contact` — 表单可提交
- [x] `POST /subscribe` — 感谢页显示用户名
- [x] `GET /nonexistent` — 404 带导航栏
- [x] `NODE_ENV=production` — 500 不暴露堆栈
