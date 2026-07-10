import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * HTTP 请求处理函数签名。
 * 所有路由处理器（页面、静态资源等）必须符合此类型。
 */
export type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
) => void | Promise<void>;

/**
 * MIME 类型映射表：文件扩展名（含点号）→ Content-Type 值。
 */
export type MimeMap = Record<string, string>;
