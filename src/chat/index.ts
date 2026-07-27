import { Server as HttpServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import type { RequestHandler, Response } from 'express';
import { Server, type Socket } from 'socket.io';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Message, { type IMessage } from '../models/Message.js';

/* ================================================================================
 * Socket.io 聊天服务端
 * ================================================================================
 * - 通过包装 express-session 中间件共享 Session，实现连接认证。
 * - 认证失败抛出 Unauthorized → 前端捕获后提示"请先登录"。
 * - 所有用户信息从 socket.data.user 获取，不依赖前端传入。
 * ================================================================================ */

/* ── socket.data 类型扩展 ── */
declare module 'socket.io' {
  interface SocketData {
    user?: {
      _id: mongoose.Types.ObjectId;
      name: string;
      email: string;
      role: 'admin' | 'user';
    };
  }
}

/* ── 聊天用户类型 ── */
interface ChatUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

/* ── 事件载荷类型 ── */
interface ServerChatMessage {
  _id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

interface ServerSystemEvent {
  userName: string;
  timestamp: string;
}

interface ServerIdentity {
  userId: string;
  userName: string;
}

/* ── 常量 ── */
const GENERAL_ROOM = 'chat:general';
const HISTORY_LIMIT = 20;

/* ── Session 中间件包装器 ──
 * 将 express-session 适配到 Socket.io 的中间件签名。
 * 创建最小 Mock Response，因为 session 中间件在读取已有会话时
 * 只需要 req 头（cookie），saveUninitialized: false 确保不会创建空会话。
 */
function wrapSession(
  middleware: RequestHandler,
): (socket: Socket, next: (err?: Error) => void) => void {
  return (socket, next) => {
    // 最小化的 Mock Response — express-session 仅在某些代码路径
    // 访问 res 方法，但 saveUninitialized: false 下不会写入。
    const res = {
      setHeader: () => res,
      getHeader: () => undefined,
      removeHeader: () => res,
      end: () => res,
      on: () => res,
      once: () => res,
      emit: () => false,
      statusCode: 200,
    } as unknown as Response;

    // 类型断言：express-session 只需要 req.headers.cookie，socket.request 已提供
    // Socket.io next 与 Express NextFunction 签名兼容性问题，使用 any 桥接
    middleware(socket.request as any, res, next as any);
  };
}

/**
 * Socket.io 认证中间件。
 * 从 session 中提取 passport 用户 ID → 查库 → 挂到 socket.data.user。
 * 未登录或无对应用户 → 抛出 Unauthorized。
 */
async function authMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
): Promise<void> {
  try {
    const req = socket.request as IncomingMessage & {
      session?: { passport?: { user?: string } };
    };

    // Passport 序列化时只存 _id，即 session.passport.user === userId
    const userId = req.session?.passport?.user;

    if (!userId) {
      return next(new Error('Unauthorized'));
    }

    const user = await User.findById(userId)
      .select('name email role')
      .lean() as ChatUser | null;

    if (!user) {
      return next(new Error('Unauthorized'));
    }

    socket.data.user = user;
    next();
  } catch (err) {
    next(err instanceof Error ? err : new Error('认证失败'));
  }
}

/**
 * 启动 Socket.io 聊天服务。
 * @param httpServer — Node.js HTTP Server 实例（socket.io 绑定其上）
 * @param sessionMiddleware — express-session 中间件（用于共享会话）
 */
export function setupChat(
  httpServer: HttpServer,
  sessionMiddleware: RequestHandler,
): Server {
  const io = new Server(httpServer, {
    // Socket.io 客户端从 /socket.io/socket.io.js 加载，同源无跨域问题
    cors: { origin: [], credentials: true },
  });

  /* ── 中间件链 ── */
  io.use(wrapSession(sessionMiddleware)); // ① 共享 Session
  io.use(authMiddleware);                 // ② 验证并加载用户

  /* ── 连接处理 ── */
  io.on('connection', async (socket) => {
    const user = socket.data.user!;

    // 发送身份信息（仅 userId，客户端据此判断消息归属）
    socket.emit('chat:identity', {
      userId: String(user._id),
      userName: user.name,
    } satisfies ServerIdentity);

    // 加入全站聊天室
    socket.join(GENERAL_ROOM);

    // 广播"加入"给房间内其他用户
    socket.to(GENERAL_ROOM).emit('chat:user-joined', {
      userName: user.name,
      timestamp: new Date().toISOString(),
    } satisfies ServerSystemEvent);

    // 加载最近 20 条历史消息（倒序查 → 前端正序渲染）
    try {
      const history = await Message.find()
        .sort({ createdAt: -1 })
        .limit(HISTORY_LIMIT)
        .lean<IMessage[]>();

      socket.emit(
        'chat:history',
        history
          .reverse() // 前端需要正序
          .map(
            (msg): ServerChatMessage => ({
              _id: String(msg._id),
              userId: String(msg.user),
              userName: msg.userName,
              content: msg.content,
              createdAt: msg.createdAt.toISOString(),
            }),
          ),
      );
    } catch (err) {
      console.error('[聊天] 加载历史消息失败:', err);
    }

    /* ── 消息发送 ── */
    socket.on(
      'chat:message',
      async (
        data: { content: string },
        ack?: (res: { ok: boolean }) => void,
      ) => {
        const content = data?.content?.trim();
        if (!content) {
          ack?.({ ok: false });
          return;
        }

        try {
          const msg = (await Message.create({
            user: user._id,
            userName: user.name,
            content: content.slice(0, 500), // 截断保护
          })) as IMessage;

          const payload: ServerChatMessage = {
            _id: String(msg._id),
            userId: String(msg.user),
            userName: msg.userName,
            content: msg.content,
            createdAt: msg.createdAt.toISOString(),
          };

          // 广播给房间内所有人（含自己）
          io.to(GENERAL_ROOM).emit('chat:message', payload);
          ack?.({ ok: true });
        } catch (err) {
          console.error('[聊天] 保存消息失败:', err);
          ack?.({ ok: false });
        }
      },
    );

    /* ── 断开连接 ── */
    socket.on('disconnect', () => {
      socket.to(GENERAL_ROOM).emit('chat:user-left', {
        userName: user.name,
        timestamp: new Date().toISOString(),
      } satisfies ServerSystemEvent);
    });
  });

  console.log('💬 聊天 WebSocket 服务已启动');
  return io;
}
