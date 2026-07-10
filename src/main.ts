import http from 'node:http';
import { router } from './router.js';

/* ──────────── 全局异常守卫 ──────────── */

process.on('uncaughtException', (err) => {
  console.error('[未捕获异常]', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[未处理的Promise拒绝]', reason);
  process.exit(1);
});

/* ──────────── 服务器启动 ──────────── */

const PORT = Number(process.env.PORT) || 3000;

http.createServer(router).listen(PORT, () => {
  console.log(`\n🍳 缤纷厨房已启动 → http://localhost:${PORT}`);
  console.log(`   启动时间：${new Date().toISOString()}`);
  console.log(`   按 Ctrl+C 停止\n`);
});
