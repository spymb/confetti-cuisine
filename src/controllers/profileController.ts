import { Request, Response } from 'express';
import User from '../models/User.js';

/* ================================================================================
 * Profile 控制器 — 用户自我资料查看
 * ================================================================================
 * 与 userController.getShow 共享查询逻辑（双 populate），但增加了：
 * - 所有权检查：普通用户只能看自己，管理员可看任意用户
 * - readOnly 标志：普通用户看自己时不显示编辑/删除按钮
 * ================================================================================ */

export async function getUserProfile(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const profileUser = await User.findById(req.params.id)
      .populate('enrolledCourses')
      .populate('subscriberProfile')
      .lean();

    if (!profileUser) {
      return void res.status(404).render('404', {
        title: '404',
        currentPage: '',
      });
    }

    // 所有权检查：管理员可看任意用户，普通用户只能看自己
    if (
      req.user!.role !== 'admin' &&
      req.user!._id.toString() !== req.params.id
    ) {
      req.flash('error', '你只能查看自己的资料。');
      return void res.redirect('/');
    }

    res.render('users/show', {
      title: profileUser.name,
      currentPage: 'profile',
      user: profileUser,
      readOnly: req.user!.role !== 'admin', // 非管理员只能看不能改
    });
  } catch (err) {
    if ((err as any).name === 'CastError') {
      return void res.status(404).render('404', {
        title: '404',
        currentPage: '',
      });
    }
    throw err;
  }
}
