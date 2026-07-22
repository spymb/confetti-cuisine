import jwt from 'jsonwebtoken';

/* ================================================================================
 * JWT 工具函数
 * ================================================================================
 * - generateToken：用 userId、email、role 签名生成 24h 有效期的 JWT。
 * - verifyToken：验证并解码 JWT，失败时抛出异常（调用方自行 catch）。
 * ================================================================================ */

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = '24h';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

/** 生成 JWT（payload 仅含最小必要字段） */
export function generateToken(user: {
  _id: string;
  email: string;
  role: string;
}): string {
  const payload: JwtPayload = {
    userId: String(user._id),
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/** 验证 JWT，成功返回解码后的 payload，失败抛出异常 */
export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
  return decoded;
}
