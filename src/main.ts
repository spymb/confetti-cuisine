import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import router from './routes/index.js';
import { notFound, internalError } from './controllers/errorController.js';

/* ──────────── 全局异常守卫 ──────────── */

process.on('uncaughtException', (err) => {
  console.error('[未捕获异常]', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[未处理的Promise拒绝]', reason);
  process.exit(1);
});

/* ──────────── Express 应用初始化 ──────────── */

const app = express();
const PORT = Number(process.env.PORT) || 3000;

/* ── 安全头中间件 ── */
// 只对 CSS 内联样式放行（unsafe-inline），其他 CSP 策略全开
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  }),
);

/* ── 请求日志 ── */
// 格式近似旧版 [ISO] METHOD /path → statusCode (ms) 风格
app.use(morgan(':method :url → :status (:response-time ms)'));

/* ── 视图引擎设置 ── */
app.set('view engine', 'ejs');
app.set('views', path.resolve(process.cwd(), 'views'));

/* ── 请求体解析 ── */
app.use(express.urlencoded({ extended: true }));

/* ── 静态资源 ── */
// 保持 /public/* 前缀，与现有 CSS <link> 引用路径完全兼容
app.use('/public', express.static(path.resolve(process.cwd(), 'public')));

/* ── 路由 ── */
app.use(router);

/* ── 错误处理（顺序敏感：404 在先，500 在后） ── */
app.use(notFound); // 全路由未命中 → 404
app.use(internalError); // 任何错误（含 Express 5 自动传播的异步错误）→ 500

/* ──────────── 服务器启动 ──────────── */

app.listen(PORT, () => {
  console.log(`\n🍳 缤纷厨房已启动 → http://localhost:${PORT}`);
  console.log(`   启动时间：${new Date().toISOString()}`);
  console.log(`   按 Ctrl+C 停止\n`);
});

export default app;
