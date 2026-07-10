# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

```bash
pnpm dev          # 开发服务器（tsx watch 热重载，端口 3000）
pnpm build        # TypeScript 编译到 dist/
pnpm start        # 生产运行（需先 build）
```

通过 `PORT` 环境变量自定义端口：`PORT=8080 pnpm dev`

## 架构概览

**零框架** — 仅使用 Node.js 内置 `http`、`fs`、`path` 模块。TypeScript 严格模式 + ES Modules + `node:` 前缀导入。

### 请求处理流水线（4 层）

```
main.ts → router.ts → handlers/static.ts  (静态资源)
                    → handlers/pages.ts   (HTML 页面)
                    → utils/response.ts   (被所有人调用)
```

1. **`main.ts`** — 创建 `http.createServer(router)`，注册 `uncaughtException` / `unhandledRejection` 全局兜底
2. **`router.ts`** — 解析 URL、验证方法（仅 GET/HEAD）、`/public/*` 前缀分发到 static、已知页面分发到 pages、其余走 404；全局 try/catch → 500；每个请求输出 `[ISO] METHOD /path → statusCode (ms)` 日志
3. **`handlers/static.ts`** — 6 步安全流水线：提取路径 → 规范化 → `startsWith` 检查 → 可读性检查 → 目录检查 → `createReadStream` 流式传输
4. **`handlers/pages.ts`** — 路由→文件名映射表，`fs.readFile` 读取 HTML（文件小，无需流式），404 回退链：`views/404.html` → 纯文本

### 共享工具（`utils/response.ts`）

| 函数 | 调用方 | 说明 |
|------|--------|------|
| `getRawPathname(req)` | router、static | 从 `req.url` 提取原始路径名，不做 URL 规范化 |
| `sendPlain(res, code, body, headers?)` | router、static、pages | 写 `text/plain` 响应 |
| `sendHtml(res, code, html)` | pages | 写 `text/html` 响应 |

### 核心安全模式

**路径遍历防御** — 两处使用 `getRawPathname()` 而非 `new URL()`：
- `router.ts` 第 67 行：用原始 URL 检测 `/public/` 前缀（`new URL()` 会吃掉 `../`）
- `static.ts` 第 77 行：提取 `/public/` 之后的相对路径

安全检查核心：
```
path.resolve(path.join(PUBLIC_DIR, relativePath)).startsWith(PUBLIC_DIR + path.sep)
```
`+ path.sep` 防止 `/public-fake/` 前缀绕过攻击。

**请求方法限制** — `router.ts` 统一拦截，非 GET/HEAD 返回 405 + `Allow: GET, HEAD` 头。

**MIME 白名单** — `static.ts` 仅对已知扩展名设置 Content-Type，未知的返回 `application/octet-stream`。

### 关键约定

- **所有代码文本使用中文**（注释、日志、错误消息、HTML内容）
- **`types/index.ts` 导出 `Handler` 和 `MimeMap`** — 项目仅有的两个共享类型
- **`views/` 放 HTML 页面，`public/` 放静态资源** — 两者都在项目根目录，不在 `src/` 内
- **无测试框架** — 验证通过手动 curl / 浏览器进行
