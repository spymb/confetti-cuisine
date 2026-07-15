import { Request, Response } from 'express';
import { ZodError } from 'zod';
import Course from '../models/Course.js';
import { formatZodError } from '../utils/formatZodError.js';
import {
  createCourseSchema,
  updateCourseSchema,
} from '../validators/courseValidator.js';

/* ================================================================================
 * Course 控制器 — 课程管理 CRUD
 * ================================================================================
 * 七个标准动作：index / new / create / show / edit / update / destroy。
 * 错误处理四分支：ZodError → ValidationError → 11000 → CastError。
 * 所有写操作统一 AJAX 模式（POST/PUT/DELETE → JSON 响应，前端执行跳转）。
 * ================================================================================ */

/* ================================================================================
 * GET /admin/courses — 课程列表
 * ================================================================================
 * .sort({ createdAt: -1 })：按创建时间倒序，最新课程排最前面。
 * .lean()：返回普通 JS 对象而非 Mongoose Document，速度更快，内存更省。
 *          EJS 模板不需要 Document 的 setter/getter/save 等方法，lean 即可。
 */
export async function getIndex(req: Request, res: Response): Promise<void> {
  const courses = await Course.find().sort({ createdAt: -1 }).lean();
  res.render('courses/index', {
    title: '课程管理',
    currentPage: 'courses-admin', // 导航栏高亮用
    courses,
  });
}

/* ================================================================================
 * GET /admin/courses/new — 新建课程表单
 * ================================================================================
 * 纯页面渲染，不查数据库。errors 和 formData 初始为空，表单是新开空白状态。
 */
export function getNew(req: Request, res: Response): void {
  res.render('courses/new', {
    title: '新建课程',
    currentPage: 'courses-admin',
  });
}

/* ================================================================================
 * POST /admin/courses — 创建课程（AJAX 模式）
 * ================================================================================
 * 成功 → JSON { ok: true, redirect: "..." }，前端执行跳转
 * 失败 → JSON { ok: false, errors: [...] }，前端渲染错误到 DOM
 * 与 putUpdate / deleteRemove 保持一致的通信方式。
 * ================================================================================
 */
export async function postCreate(req: Request, res: Response): Promise<void> {
  try {
    const data = createCourseSchema.parse(req.body);
    await Course.create(data);
    res.json({ ok: true, redirect: '/admin/courses' });
  } catch (err) {
    if (err instanceof ZodError) {
      return void res.json({ ok: false, errors: formatZodError(err) });
    }
    if ((err as any).name === 'ValidationError') {
      const messages = Object.values((err as any).errors).map(
        (e: any) => e.message,
      );
      return void res.json({ ok: false, errors: messages.map((m) => ({ field: '', message: m })) });
    }
    if ((err as any).code === 11000) {
      return void res.json({ ok: false, errors: [{ field: 'title', message: '该课程标题已存在' }] });
    }
    throw err;
  }
}

/* ================================================================================
 * GET /admin/courses/:id — 课程详情
 * ================================================================================
 * CastError 处理：当 :id 不是有效 ObjectId 时 Mongoose 抛出 CastError，
 * 本质是"你要查的东西不可能存在"，返回 404。
 * ================================================================================ */
export async function getShow(req: Request, res: Response): Promise<void> {
  try {
    const course = await Course.findById(req.params.id).lean();
    if (!course) {
      // ID 格式正确但数据库中不存在 → 404
      return void res.status(404).render('404', {
        title: '404',
        currentPage: '',
      });
    }
    res.render('courses/show', {
      title: course.title,
      currentPage: 'courses-admin',
      course,
    });
  } catch (err) {
    // ID 格式不对（如 /admin/courses/hello）→ 404
    if ((err as any).name === 'CastError') {
      return void res.status(404).render('404', {
        title: '404',
        currentPage: '',
      });
    }
    throw err;
  }
}

/* ================================================================================
 * GET /admin/courses/:id/edit — 编辑课程表单
 * ================================================================================
 * 查出现有课程数据，预填表单。errors 初始为空。
 * ================================================================================ */
export async function getEdit(req: Request, res: Response): Promise<void> {
  try {
    const course = await Course.findById(req.params.id).lean();
    if (!course) {
      return void res.status(404).render('404', {
        title: '404',
        currentPage: '',
      });
    }
    res.render('courses/edit', {
      title: `编辑 - ${course.title}`,
      currentPage: 'courses-admin',
      errors: [],
      formData: course, // 预填现有数据
      course,
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

/* ================================================================================
 * PUT /admin/courses/:id — 更新课程
 * ================================================================================
 * AJAX 通信模式（HTML 表单不支持 PUT）：
 *   成功 → JSON { ok: true, redirect: "跳转地址" }，前端 window.location.href
 *   失败 → JSON { ok: false, errors: [...] }，前端渲染错误到 DOM
 *
 * .partial() 让 updateCourseSchema 所有字段可选，只校验提交了的字段。
 * { runValidators: true } 确保 Mongoose 校验在更新时也触发（默认只在 create 时触发）。
 * { new: true } 返回更新后的文档而非更新前的。
 * ================================================================================ */
export async function putUpdate(req: Request, res: Response): Promise<void> {
  try {
    const data = updateCourseSchema.parse(req.body);
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      data,
      { runValidators: true, new: true },
    );
    if (!course) {
      return void res.status(404).render('404', {
        title: '404',
        currentPage: '',
      });
    }
    // 成功 → 返回 JSON，前端执行跳转
    res.json({ ok: true, redirect: `/admin/courses/${course._id}` });
  } catch (err) {
    if (err instanceof ZodError) {
      return void res.json({ ok: false, errors: formatZodError(err) });
    }
    if ((err as any).name === 'ValidationError') {
      const messages = Object.values((err as any).errors).map(
        (e: any) => e.message,
      );
      return void res.json({ ok: false, errors: messages.map((m: any) => ({ field: '', message: m })) });
    }
    if ((err as any).code === 11000) {
      return void res.json({ ok: false, errors: [{ field: 'title', message: '该课程标题已存在' }] });
    }
    if ((err as any).name === 'CastError') {
      return void res.status(404).render('404', { title: '404', currentPage: '' });
    }
    throw err;
  }
}

/* ================================================================================
 * DELETE /admin/courses/:id — 软删除课程
 * ================================================================================
 * 软删除：设置 deletedAt = 当前时间，而非物理删除。
 * - findByIdAndUpdate 设 deletedAt 而非 findByIdAndDelete
 * - pre 中间件自动过滤 deletedAt !== null 的文档
 * - partial unique index 允许删后重建同名课程
 * 原因：课程被 User.enrolledCourses 引用，硬删会产生悬挂引用。
 * ================================================================================ */
export async function deleteRemove(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, {
      deletedAt: new Date(),
    });
    if (!course) {
      return void res.status(404).render('404', {
        title: '404',
        currentPage: '',
      });
    }
    res.json({ ok: true, redirect: '/admin/courses' });
  } catch (err) {
    if ((err as any).name === 'CastError') {
      return void res.status(404).render('404', { title: '404', currentPage: '' });
    }
    throw err;
  }
}
