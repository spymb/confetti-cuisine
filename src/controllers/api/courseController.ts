import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Course from '../../models/Course.js';
import User from '../../models/User.js';
import { success, error } from '../../utils/apiResponse.js';

/* ================================================================================
 * 课程 API 控制器 — RESTful CRUD（仅公开读 + JWT 报名）
 * ================================================================================
 * GET    /api/v1/courses          — 课程列表（公开）
 * GET    /api/v1/courses/:id      — 课程详情（公开）
 * POST   /api/v1/courses/:id/enroll — 报名课程（需 JWT）
 * ================================================================================ */

/**
 * @swagger
 * /api/v1/courses:
 *   get:
 *     summary: 获取所有课程列表
 *     tags: [Courses]
 *     responses:
 *       200:
 *         description: 课程列表
 */
export async function getCourses(
  _req: Request,
  res: Response,
): Promise<void> {
  const courses = await Course.find().sort({ createdAt: -1 }).lean();
  res.json(success(courses));
}

/**
 * @swagger
 * /api/v1/courses/{id}:
 *   get:
 *     summary: 获取单个课程详情
 *     tags: [Courses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 课程详情
 *       404:
 *         description: 课程不存在
 */
export async function getCourse(
  req: Request,
  res: Response,
): Promise<void> {
  const id = req.params.id as string;

  // 无效的 ObjectId → 400
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json(error(400, '无效的课程 ID'));
    return;
  }

  const course = await Course.findById(id).lean();

  if (!course) {
    res.status(404).json(error(404, '课程不存在'));
    return;
  }

  res.json(success(course));
}

/**
 * @swagger
 * /api/v1/courses/{id}/enroll:
 *   post:
 *     summary: 报名课程（需 JWT）
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 报名成功
 *       400:
 *         description: 参数错误
 *       401:
 *         description: 未认证
 *       404:
 *         description: 课程不存在
 */
export async function postEnroll(
  req: Request,
  res: Response,
): Promise<void> {
  const id = req.params.id as string;
  const userId = req.jwtPayload!.userId;

  // 无效的 ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json(error(400, '无效的课程 ID'));
    return;
  }

  // 课程是否存在（已软删除的自动过滤）
  const course = await Course.findById(id);
  if (!course) {
    res.status(404).json(error(404, '课程不存在'));
    return;
  }

  // 用户是否存在
  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json(error(404, '用户不存在'));
    return;
  }

  // $addToSet 避免重复报名
  await User.findByIdAndUpdate(userId, {
    $addToSet: { enrolledCourses: id },
  });

  res.json(success(null, '报名成功'));
}
