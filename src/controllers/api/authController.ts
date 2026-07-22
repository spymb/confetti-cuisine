import { Request, Response } from 'express';
import User from '../../models/User.js';
import { generateToken } from '../../utils/jwt.js';
import { success, error } from '../../utils/apiResponse.js';
import { loginSchema } from '../../validators/authValidator.js';
import { formatZodError } from '../../utils/formatZodError.js';

/* ================================================================================
 * 认证 API 控制器 — JWT 认证 + Session 桥接
 * ================================================================================
 * POST /api/v1/auth/login  — 外部客户端用邮箱密码换取 JWT
 * GET  /api/v1/auth/token  — 网页 JS 用已登录 Session 换取 JWT（桥接端点）
 * ================================================================================ */

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: 邮箱密码登录，返回 JWT
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: 登录成功，返回 token
 *       400:
 *         description: 参数校验失败
 *       401:
 *         description: 邮箱或密码错误
 */
export async function postLogin(
  req: Request,
  res: Response,
): Promise<void> {
  // Zod 校验
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(error(400, formatZodError(parsed.error)[0].message));
    return;
  }

  const { email, password } = parsed.data;

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    res.status(401).json(error(401, '邮箱或密码错误'));
    return;
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    res.status(401).json(error(401, '邮箱或密码错误'));
    return;
  }

  const token = generateToken({
    _id: String(user._id),
    email: user.email,
    role: user.role,
  });
  res.json(success({ token }));
}

/**
 * @swagger
 * /api/v1/auth/token:
 *   get:
 *     summary: 用 Session Cookie 换取 JWT（网页 JS 桥接端点）
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: 返回 JWT token
 *       401:
 *         description: 未登录
 */
export async function getToken(
  req: Request,
  res: Response,
): Promise<void> {
  // requireSession 中间件已确保 req.user 存在
  const user = req.user!;
  const token = generateToken({
    _id: String(user._id),
    email: user.email,
    role: user.role,
  });
  res.json(success({ token }));
}
