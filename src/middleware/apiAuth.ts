import { Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '../utils/jwt.js';
import { error } from '../utils/apiResponse.js';

/* ================================================================================
 * API 认证中间件（JWT + Session 双体系）
 * ================================================================================
 * - requireJWT：从 Authorization: Bearer <token> 提取验证 → 挂载 req.jwtPayload
 * - requireSession：包装 Passport Session 认证 → JSON 401 而非 redirect
 *
 * 两个中间件互斥使用，对应不同的 API 端点。
 * ================================================================================ */

/**
 * JWT 认证中间件。
 * 从 Authorization 头提取 Bearer Token → 验证 → 挂载 jwtPayload 到 req。
 * 失败时返回 JSON { code: 401, message: '...' }，不做重定向。
 */
export function requireJWT(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json(error(401, '未提供认证令牌'));
    return;
  }

  const token = authHeader.slice(7); // "Bearer " 之后的部分

  try {
    req.jwtPayload = verifyToken(token);
    next();
  } catch (err: any) {
    const message =
      err.name === 'TokenExpiredError'
        ? '认证令牌已过期，请重新登录'
        : '认证令牌无效';
    res.status(401).json(error(401, message));
  }
}

/**
 * Session 认证中间件（用于 API 端点，返回 JSON 而非 redirect）。
 * 适用于 /api/v1/auth/token 这种"用 Session 换 JWT"的桥接端点。
 */
export function requireSession(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json(error(401, '请先登录'));
}
