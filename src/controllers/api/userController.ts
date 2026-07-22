import { Request, Response } from 'express';
import User from '../../models/User.js';
import { success, error } from '../../utils/apiResponse.js';

/* ================================================================================
 * 用户 API 控制器
 * ================================================================================
 * GET /api/v1/users/me — 当前用户信息（含 enrolledCourses，供前端判断已报名状态）
 * ================================================================================ */

/**
 * @swagger
 * /api/v1/users/me:
 *   get:
 *     summary: 获取当前登录用户信息
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 用户信息（含已报名课程 ID 列表）
 *       401:
 *         description: 未认证
 */
export async function getMe(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = req.jwtPayload!.userId;

  const user = await User.findById(userId)
    .populate('enrolledCourses')
    .lean();

  if (!user) {
    res.status(404).json(error(404, '用户不存在'));
    return;
  }

  res.json(
    success({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      enrolledCourses: user.enrolledCourses,
    }),
  );
}
