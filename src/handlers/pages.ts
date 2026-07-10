import { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { sendHtml, sendPlain } from '../utils/response.js';

/* ──────────── 常量 ──────────── */

/**
 * views/ 目录的绝对路径（模块加载时计算）。
 */
const VIEWS_DIR = path.resolve(process.cwd(), 'views');

/**
 * 路由路径 → HTML 文件名映射。
 * / 和 /home 指向同一首页，其他路由各自对应一个视图文件。
 */
const VIEW_MAP: Record<string, string> = {
  '/': 'index.html',
  '/home': 'index.html',
  '/courses': 'courses.html',
  '/contact': 'contact.html',
};

/* ──────────── 主处理器 ──────────── */

/**
 * 处理 HTML 页面路由（/、/home、/courses、/contact）以及 404 回退。
 *
 * 对于 / 和 /home 返回 index.html；/courses 返回 courses.html；
 * /contact 返回 contact.html；未匹配的路径触发 404 处理。
 *
 * HTML 文件相对较小，使用 fs.readFile 一次性读取即可。
 */
export async function handlePage(
  req: IncomingMessage,
  res: ServerResponse,
  route?: string,
): Promise<void> {
  const viewFile = route ? VIEW_MAP[route] : undefined;

  if (viewFile) {
    const filePath = path.join(VIEWS_DIR, viewFile);
    try {
      const html = await fs.promises.readFile(filePath, 'utf-8');
      if (req.method === 'HEAD') { res.end(); return; }
      sendHtml(res, 200, html);
    } catch {
      await serve404(res);
    }
  } else {
    await serve404(res);
  }
}

/**
 * 提供 404 页面。优先读取 views/404.html，
 * 若文件本身也不存在则返回纯文本回退。
 */
async function serve404(res: ServerResponse): Promise<void> {
  try {
    const html = await fs.promises.readFile(
      path.join(VIEWS_DIR, '404.html'),
      'utf-8',
    );
    sendHtml(res, 404, html);
  } catch {
    sendPlain(res, 404, '404 未找到');
  }
}
