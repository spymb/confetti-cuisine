import { Request, Response } from 'express';
import User from '../models/User.js';

/* ================================================================================
 * "我的课程"页面控制器
 * ================================================================================
 * GET /my-courses — 已登录用户查看自己报名的课程（populate 展开课程详情）
 * ================================================================================ */

export async function getMyCourses(
  req: Request,
  res: Response,
): Promise<void> {
  const user = await User.findById(req.user!._id)
    .populate('enrolledCourses')
    .lean();

  res.render('my-courses', {
    title: '我的课程',
    currentPage: 'my-courses',
    enrolledCourses: user?.enrolledCourses || [],
  });
}
