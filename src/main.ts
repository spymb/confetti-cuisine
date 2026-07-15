import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import flash from 'connect-flash';
import { MongoMemoryServer } from 'mongodb-memory-server';
import passport from './config/passport.js';
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

/* ──────────── MongoDB URI 提前解析 ────────────
 * session 配置需要 uri 来初始化 MongoStore，所以 URI 解析必须
 * 在 Express app 初始化之前完成。mongoose.connect() 保持原位不动。
 */

const MONGODB_URI = process.env.MONGODB_URI;

let uri = MONGODB_URI;

// 未配置外部 MongoDB 时，自动启动内存实例
if (!uri) {
  const mongod = await MongoMemoryServer.create();
  uri = mongod.getUri();
  console.log('🧪 使用内存 MongoDB 实例');
}

/* ──────────── Express 应用初始化 ──────────── */

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

/* ── 安全头中间件 ── */
// CSP：default 只允许同源；EJS 模板中有内联 <script> 和 onclick，因此放行 script/style 的内联
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
      },
    },
  }),
);

/* ── 会话中间件（MongoDB 存储） ── */
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,                         // 不强制每次请求都重新保存
    saveUninitialized: false,              // 未修改的会话不存储（避免空 session）
    store: MongoStore.create({
      mongoUrl: uri,
      ttl: 14 * 24 * 60 * 60,             // 14 天过期
    }),
    cookie: {
      httpOnly: true,                      // 浏览器 JS 不可读取
      secure: isProduction,                // 生产环境仅 HTTPS
      sameSite: 'lax',                     // 跨站 GET 导航发送 cookie，POST 不发送
      maxAge: 14 * 24 * 60 * 60 * 1000,    // 14 天（毫秒）
    },
  }),
);

/* ── Passport 初始化 ── */
app.use(passport.initialize());
app.use(passport.session());

/* ── Flash 消息 ── */
app.use(flash());

/* ── 请求日志 ── */
// 格式近似旧版 [ISO] METHOD /path → statusCode (ms) 风格
app.use(morgan(':method :url → :status (:response-time ms)'));

/* ── 视图引擎设置 ── */
app.set('view engine', 'ejs');
app.set('views', path.resolve(process.cwd(), 'views'));

/* ── 请求体解析 ── */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* ── 静态资源 ── */
// 保持 /public/* 前缀，与现有 CSS <link> 引用路径完全兼容
app.use('/public', express.static(path.resolve(process.cwd(), 'public')));

/* ── 将当前用户和 flash 消息注入所有视图 ──
 * res.locals 是 Express 的全局模板变量容器，EJS 模板通过
 * locals.xxx 访问这些值，无需每个控制器手动传入。
 */
app.use((req, res, next) => {
  res.locals.user = req.user;                          // Passport 注入的用户
  res.locals.messages = {
    error: req.flash('error')[0] || null,              // 错误 flash 消息
    success: req.flash('success')[0] || null,          // 成功 flash 消息
  };
  next();
});

/* ── 路由 ── */
app.use(router);

/* ── 错误处理（顺序敏感：404 在先，500 在后） ── */
app.use(notFound); // 全路由未命中 → 404
app.use(internalError); // 任何错误（含 Express 5 自动传播的异步错误）→ 500

/* ──────────── MongoDB 连接与服务器启动 ──────────── */

try {
  await mongoose.connect(uri);
  console.log('✅ MongoDB connected');
} catch (err) {
  console.error('❌ MongoDB 连接失败，进程即将退出:', err);
  process.exit(1);
}

// --seed 标志：在 dev server 进程内灌入种子数据（共享同一个 MongoDB 连接）
if (process.argv.includes('--seed')) {
  const { seedDemo } = await import('./seed/seedDemo.js');
  await seedDemo();
}

app.listen(PORT, () => {
  console.log(`\n🍳 缤纷厨房已启动 → http://localhost:${PORT}`);
  console.log(`   启动时间：${new Date().toISOString()}`);
  console.log(`   按 Ctrl+C 停止\n`);
});

export default app;
