import { Request, Response, NextFunction } from 'express';

/* ================================================================================
 * 认证中间件
 * ================================================================================
 * ensureAuthenticated — 要求用户已登录，否则跳转登录页。
 * isAdmin — 要求当前用户角色为 admin，否则拒绝访问。
 * ================================================================================ */

/**
 * 确保请求来自已认证用户。
 * 未登录 → 保存目标 URL 到 session → flash 提示 → 重定向 /login。
 */
export function ensureAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.isAuthenticated()) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  req.flash('error', '请先登录后再访问该页面。');
  res.redirect('/login');
}

/**
 * 确保请求来自管理员用户。
 * 非管理员 → flash 提示 → 重定向首页。
 * 必须在 ensureAuthenticated 之后使用（依赖 req.user）。
 */
export function isAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  req.flash('error', '你没有管理员权限。');
  res.redirect('/');
}
