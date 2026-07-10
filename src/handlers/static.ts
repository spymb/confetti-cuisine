import { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { MimeMap } from '../types/index.js';
import { getRawPathname, sendPlain } from '../utils/response.js';

/* ──────────── 常量 ──────────── */

/**
 * public/ 目录的绝对路径（模块加载时计算一次，防止运行期变动）。
 * 所有静态资源请求必须解析到此目录内，否则视为路径遍历攻击。
 */
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

/**
 * 扩展名 → Content-Type 映射表。
 * 白名单策略：仅对已知扩展名设置类型，未知的用 application/octet-stream。
 */
const MIME_TYPES: MimeMap = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

/* ──────────── 工具函数 ──────────── */

/**
 * 根据文件路径获取对应的 Content-Type。
 * 从文件扩展名查表，未命中时返回安全的 application/octet-stream。
 */
function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

/**
 * 路径遍历安全检查。
 *
 * 攻击示例：GET /public/../../../etc/passwd
 * path.join + path.resolve 会将 ../ 折叠，
 * 然后 startsWith 检查确保最终路径仍在 PUBLIC_DIR 内。
 *
 * @returns true 表示安全，false 表示路径遍历攻击
 */
function isPathSafe(resolvedPath: string): boolean {
  const publicPrefix = PUBLIC_DIR + path.sep;
  return resolvedPath.startsWith(publicPrefix) || resolvedPath === PUBLIC_DIR;
}

/* ──────────── 主处理器 ──────────── */

/**
 * 处理 /public/* 静态资源请求。
 *
 * 安全流程：
 *  1. 从 URL 提取 /public/ 之后的相对路径
 *  2. path.join + path.resolve 规范化
 *  3. startsWith 检查防止路径遍历 → 403
 *  4. fs.access 检查文件可读性
 *  5. fs.stat 确保不是目录 → 403
 *  6. createReadStream 流式返回，设置正确的 Content-Type
 */
export async function handleStatic(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  // 1. 从原始 URL 提取相对路径
  // 不用 new URL()，因为它会规范化 ../ —— 那会让路径遍历攻击绕过检查
  const rawPathname = getRawPathname(req);
  const relativePath = rawPathname.replace(/^\/public\/?/, '');

  if (!relativePath) {
    sendPlain(res, 403, '403 禁止访问');
    return;
  }

  // 2. path.join + path.resolve 规范化
  const resolvedPath = path.resolve(path.join(PUBLIC_DIR, relativePath));

  // 3. startsWith 检查 → 403
  if (!isPathSafe(resolvedPath)) {
    sendPlain(res, 403, '403 禁止访问');
    return;
  }

  // 4. fs.access 检查文件可读性
  try {
    await fs.promises.access(resolvedPath, fs.constants.R_OK);
  } catch {
    sendPlain(res, 404, '404 未找到');
    return;
  }

  // 5. fs.stat 确保不是目录 → 403
  try {
    const stat = await fs.promises.stat(resolvedPath);
    if (stat.isDirectory()) {
      sendPlain(res, 403, '403 禁止访问');
      return;
    }
  } catch {
    sendPlain(res, 500, '500 服务器内部错误');
    return;
  }

  if (req.method === 'HEAD') {
    res.writeHead(200, { 'Content-Type': getContentType(resolvedPath) });
    res.end();
    return;
  }

  // 6. createReadStream 流式传输
  const readStream = fs.createReadStream(resolvedPath);

  readStream.on('error', (_err) => {
    if (!res.headersSent) {
      sendPlain(res, 500, '500 服务器内部错误');
    } else {
      res.destroy();
    }
  });

  req.on('close', () => readStream.destroy());

  res.writeHead(200, { 'Content-Type': getContentType(resolvedPath) });
  readStream.pipe(res);
}
