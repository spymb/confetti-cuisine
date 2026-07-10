import { IncomingMessage, ServerResponse } from 'node:http';
import { handleStatic } from './handlers/static.js';
import { handlePage } from './handlers/pages.js';
import { getRawPathname, sendPlain } from './utils/response.js';

/* ──────────── 常量 ──────────── */

const PAGE_ROUTES = new Set(['/', '/home', '/courses', '/contact']);

/* ──────────── 工具函数 ──────────── */

/**
 * 请求日志：格式 `[ISO时间戳] METHOD /path → 状态码 (响应时间ms)`
 */
function logRequest(
  method: string,
  pathname: string,
  statusCode: number,
  durationMs: number,
): void {
  console.log(
    `[${new Date().toISOString()}] ${method} ${pathname} → ${statusCode} (${durationMs}ms)`,
  );
}

/* ──────────── 主路由器 ──────────── */

/**
 * 核心路由分发器。
 *
 * 流程：
 *  1. 解析 req.url → URL 对象（非法 URL 返回 400）
 *  2. 仅处理 GET/HEAD（其他方法返回 405）
 *  3. /public/* → handleStatic
 *  4. 已知页面路由 → handlePage(route)
 *  5. 其他 → handlePage() → 触发 404
 *  6. 全局 try/catch 兜底 → 500
 */
export async function router(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const startTime = Date.now();
  const method = req.method ?? 'GET';

  // 1. 解析 URL
  let pathname: string;
  try {
    const url = new URL(req.url!, `http://${req.headers.host || 'localhost'}`);
    pathname = url.pathname;
  } catch {
    sendPlain(res, 400, '400 请求无效');
    logRequest(method, req.url ?? '(非法URL)', 400, Date.now() - startTime);
    return;
  }

  // 2. 仅处理 GET/HEAD
  if (method !== 'GET' && method !== 'HEAD') {
    sendPlain(res, 405, '405 方法不允许', { Allow: 'GET, HEAD' });
    logRequest(method, pathname, 405, Date.now() - startTime);
    return;
  }

  try {
    // 3. /public/* → 静态资源
    // 用原始 URL 检测前缀，否则 new URL() 会吃掉 ../ 导致路径遍历检测失效
    const rawPathname = getRawPathname(req);
    if (rawPathname.startsWith('/public/') || rawPathname === '/public') {
      await handleStatic(req, res);
      logRequest(method, rawPathname, res.statusCode || 200, Date.now() - startTime);
      return;
    }

    // 4. 已知页面路由
    if (PAGE_ROUTES.has(pathname)) {
      await handlePage(req, res, pathname);
      logRequest(method, pathname, res.statusCode || 200, Date.now() - startTime);
      return;
    }

    // 5. 未知路由 → 404
    await handlePage(req, res);
    logRequest(method, pathname, 404, Date.now() - startTime);
  } catch (err) {
    // 6. 全局兜底 → 500
    if (!res.headersSent) {
      sendPlain(res, 500, '500 服务器内部错误');
    } else {
      res.destroy();
    }
    logRequest(method, pathname, 500, Date.now() - startTime);
    console.error('[路由器错误]', err);
  }
}
