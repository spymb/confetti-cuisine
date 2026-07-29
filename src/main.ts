import 'dotenv/config';
import path from 'node:path';
import { createServer } from 'node:http';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import flash from 'connect-flash';
import swaggerUi from 'swagger-ui-express';
import passport from './config/passport.js';
import { swaggerSpec } from './config/swagger.js';
import { setupChat } from './chat/index.js';
import apiV1Router from './routes/api/v1/index.js';
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
const isProduction = process.env.NODE_ENV === 'production';

// 生产环境必须显式配置 MongoDB —— 内存实例重启即丢数据，绝不允许兜底
if (isProduction && !MONGODB_URI) {
  console.error('❌ 生产环境缺少 MONGODB_URI 环境变量，进程退出');
  process.exit(1);
}

let uri = MONGODB_URI;

// 未配置外部 MongoDB 时，自动启动内存实例（仅开发环境；
// 动态导入避免生产环境加载 devDependency 导致启动崩溃）
if (!uri) {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const mongod = await MongoMemoryServer.create();
  uri = mongod.getUri();
  console.log('🧪 使用内存 MongoDB 实例');
}

/* ──────────── Express 应用初始化 ──────────── */

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// 生产环境运行在 Render/Zeabur 等反向代理之后：必须信任代理头，
// 否则 Express 认为连接非 HTTPS，secure cookie 永不写入 → 登录即掉线
if (isProduction) {
  app.set('trust proxy', 1);
}

/* ── 安全头中间件 ── */
// CSP：default 只允许同源；EJS 模板中有内联 <script> 和 onclick，因此放行 script/style 的内联
// connectSrc 添加 ws:/wss: 以支持 Socket.io WebSocket 连接
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
        scriptSrcAttr: ["'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "ws:", "wss:"],
      },
    },
  }),
);

/* ── 会话中间件（MongoDB 存储） ── */
// 生产环境必须显式配置 SESSION_SECRET —— 默认密钥是公开的，
// 任何人都能伪造 session，静默回退等于没有认证
const SESSION_SECRET = process.env.SESSION_SECRET;
if (isProduction && (!SESSION_SECRET || SESSION_SECRET === 'dev-secret-change-in-production')) {
  console.error('❌ 生产环境缺少 SESSION_SECRET（或仍在使用开发默认值），进程退出');
  process.exit(1);
}
const sessionMiddleware = session({
  secret: SESSION_SECRET || 'dev-secret-change-in-production',
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
});
app.use(sessionMiddleware);

/* ── Passport 初始化 ── */
app.use(passport.initialize());
app.use(passport.session());

/* ── Flash 消息 ── */
app.use(flash());

/* ── 请求日志 ── */
// 生产环境用 Apache combined 格式（平台日志工具可直接解析），并跳过静态资源请求避免噪音；
// 开发环境保持简洁的自定义格式
app.use(
  morgan(isProduction ? 'combined' : ':method :url → :status (:response-time ms)', {
    skip: (req) => isProduction && req.url.startsWith('/public'),
  }),
);

/* ── 健康检查 ──
 * 供 Render/Zeabur 的 Health Check Path 和部署后验证使用。
 * 检查 MongoDB 连接状态：断开时返回 503，让平台能区分"进程活着"和"真健康"。
 */
app.get('/health', (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  res.status(dbReady ? 200 : 503).json({
    status: dbReady ? 'ok' : 'degraded',
    db: dbReady ? 'connected' : 'disconnected',
    uptime: Math.floor(process.uptime()),
  });
});

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

/* ── API v1 路由 ── */
app.use('/api/v1', apiV1Router);

/* ── Swagger 文档 ── */
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/* ── 页面路由 ── */
app.use(router);

/* ── 错误处理（顺序敏感：404 在先，500 在后） ── */
app.use(notFound); // 全路由未命中 → 404
app.use(internalError); // 任何错误（含 Express 5 自动传播的异步错误）→ 500

/* ── HTTP Server + Socket.io 聊天 ── */
const server = createServer(app);
setupChat(server, sessionMiddleware);

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

server.listen(PORT, () => {
  console.log(`\n🍳 缤纷厨房已启动 → http://localhost:${PORT}`);
  console.log(`   启动时间：${new Date().toISOString()}`);
  console.log(`   按 Ctrl+C 停止\n`);
});

export default app;
