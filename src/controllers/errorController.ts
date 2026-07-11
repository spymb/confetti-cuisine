import { Request, Response, NextFunction } from 'express';

/* ──────────── 404 捕获 ──────────── */

/**
 * 在所有路由之后注册，捕获未匹配的请求。
 * 渲染 404.ejs 并使用布局（保持与主站一致的导航体验）。
 */
export function notFound(req: Request, res: Response): void {
  res.status(404).render('404', { title: '404', currentPage: '' });
}

/* ──────────── 全局异常处理 ──────────── */

/**
 * Express 5 自动捕获 async 路由中抛出的错误，传递到此中间件。
 *
 * NODE_ENV=production 时不暴露堆栈信息。
 */
export function internalError(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = (err as any).status || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  console.error('[服务器错误]', err);

  res.status(statusCode).render('500', {
    title: '服务器错误',
    currentPage: '',
    message: isProduction ? '服务器内部错误，请稍后再试。' : err.message,
    stack: isProduction ? null : err.stack,
  });
}
