/* ================================================================================
 * Socket.io 客户端 ESM 构建的类型声明
 * ================================================================================
 * 浏览器从服务端自动 serve 的 /socket.io/socket.io.esm.min.js 加载客户端，
 * TypeScript 无法解析该 URL，此处为 chat.js 提供类型（配合 JSDoc @ts-check）。
 * 事件名与载荷须与 src/chat/index.ts 服务端实现保持一致。
 * ================================================================================ */

declare module '*/socket.io.esm.min.js' {
  /** 聊天消息载荷（对应服务端 ServerChatMessage） */
  interface ChatMessagePayload {
    _id: string;
    userId: string;
    userName: string;
    content: string;
    /** ISO 时间字符串 */
    createdAt: string;
  }

  /** 服务端 → 客户端事件 */
  interface ServerToClientEvents {
    'chat:identity': (data: { userId: string; userName: string }) => void;
    'chat:history': (messages: ChatMessagePayload[]) => void;
    'chat:message': (msg: ChatMessagePayload) => void;
    'chat:user-joined': (data: { userName: string; timestamp: string }) => void;
    'chat:user-left': (data: { userName: string; timestamp: string }) => void;
    connect_error: (err: Error) => void;
  }

  /** 客户端 → 服务端事件 */
  interface ClientToServerEvents {
    'chat:message': (
      data: { content: string },
      ack: (res: { ok: boolean }) => void,
    ) => void;
  }

  /** Socket 实例（仅声明本项目用到的 API） */
  interface Socket {
    on<E extends keyof ServerToClientEvents>(
      event: E,
      listener: ServerToClientEvents[E],
    ): void;
    emit<E extends keyof ClientToServerEvents>(
      event: E,
      ...args: Parameters<ClientToServerEvents[E]>
    ): void;
  }

  export function io(options?: {
    reconnection?: boolean;
    reconnectionAttempts?: number;
    reconnectionDelay?: number;
  }): Socket;
}
