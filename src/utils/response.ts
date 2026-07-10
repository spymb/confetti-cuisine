import { IncomingMessage, ServerResponse } from 'node:http';

/**
 * 从原始 req.url 提取路径名，不做 URL 规范化（保留 ../ 等原始片段，
 * 以便后续安全检查能捕获路径遍历攻击）。
 */
export function getRawPathname(req: IncomingMessage): string {
  return (req.url ?? '/').split('?')[0];
}

/**
 * 简洁写入 HTTP 纯文本响应。
 * 自动设置 Content-Type、Content-Length，适用于短内容（如错误消息）。
 */
export function sendPlain(
  res: ServerResponse,
  statusCode: number,
  body: string,
  extraHeaders?: Record<string, string>,
): void {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(body, 'utf-8')),
    ...extraHeaders,
  });
  res.end(body);
}

/**
 * 写入 HTML 响应，自动设置 Content-Type 和 Content-Length。
 */
export function sendHtml(
  res: ServerResponse,
  statusCode: number,
  html: string,
): void {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(html, 'utf-8')),
  });
  res.end(html);
}
