import { Request, Response } from 'express';
import { ZodError } from 'zod';
import User from '../models/User.js';
import Course from '../models/Course.js';
import Subscriber from '../models/Subscriber.js';
import {
  createUserSchema,
  updateUserSchema,
} from '../validators/userValidator.js';

/* ================================================================================
 * User 控制器 — 用户管理 CRUD（三个控制器中最复杂的）
 * ================================================================================
 * 相比 courseController 和 subscriberController，User 控制器多了：
 * 1. 跨表关联：populate Course 和 Subscriber
 * 2. 表单下拉选项：新建/编辑时需要查 courses 和 subscribers 全表
 * 3. putUpdate 手动构建 updateData：partial schema 下 undefined ≠ 不更新
 * 4. 所有写操作统一 AJAX 模式
 * ================================================================================ */

function formatZodError(err: ZodError): Array<{ field: string; message: string }> {
  return err.issues.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
  }));
}

/* ── 获取表单下拉选项 ──
 * 新建和编辑用户表单需要两个 <select>：
 * - enrolledCourses（多选课程列表）→ 查 Course 全表
 * - subscriberProfile（单选关联订阅者）→ 查 Subscriber 全表
 * Promise.all 并行查询，减少串行等待时间。
 * .lean() 返回普通对象，EJS 模板不需要 Document 实例。
 */
async function getFormOptions() {
  const [allCourses, allSubscribers] = await Promise.all([
    Course.find().sort({ title: 1 }).lean(),
    Subscriber.find().sort({ name: 1 }).lean(),
  ]);
  return { allCourses, allSubscribers };
}

/* ================================================================================
 * GET /admin/users — 用户列表
 * ================================================================================
 * .populate('enrolledCourses', 'title')
 *   → 只取课程 title 而非整个 Course 文档，减少内存和带宽。
 *   → 本质是 Mongoose 自动做 $lookup（MongoDB 版的 SQL JOIN）。
 * 如果不 populate，列表中只能显示 ObjectId 字符串，不可读。
 * ================================================================================ */
export async function getIndex(req: Request, res: Response): Promise<void> {
  const users = await User.find()
    .populate('enrolledCourses', 'title')
    .sort({ createdAt: -1 })
    .lean();
  res.render('users/index', {
    title: '用户管理',
    currentPage: 'users',
    users,
  });
}

/* ── GET — 新建表单 ── */
export async function getNew(req: Request, res: Response): Promise<void> {
  const { allCourses, allSubscribers } = await getFormOptions();
  res.render('users/new', {
    title: '新建用户',
    currentPage: 'users',
    allCourses,
    allSubscribers,
  });
}

/* ================================================================================
 * POST /admin/users — 创建用户（AJAX 模式）
 * ================================================================================
 * 两个特殊处理：
 *
 * 1. enrolledCourses 多选：前端用 formData.getAll() 获取数组，
 *    不再需要像旧版 urlencoded 那样在服务端标准化。
 *
 * 2. subscriberProfile / enrolledCourses 中的空字符串需过滤后再写入。
 * ================================================================================ */
export async function postCreate(req: Request, res: Response): Promise<void> {
  try {
    const parsed = createUserSchema.parse(req.body);

    // 空字符串 subscriberProfile → 不存
    const subscriberProfile =
      parsed.subscriberProfile && parsed.subscriberProfile !== ''
        ? parsed.subscriberProfile
        : undefined;

    // 过滤课程数组中的空字符串
    const enrolledCourses = parsed.enrolledCourses.filter((id) => id !== '');

    await User.create({
      name: parsed.name,
      email: parsed.email,
      enrolledCourses,
      subscriberProfile,
    });
    res.json({ ok: true, redirect: '/admin/users' });
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
      return void res.json({ ok: false, errors: [{ field: 'email', message: '该邮箱已存在' }] });
    }
    throw err;
  }
}

/* ================================================================================
 * GET /admin/users/:id — 用户详情（双 populate 跨表关联）
 * ================================================================================
 * .populate('enrolledCourses')     → 展开为完整 Course 文档（含 title、duration、cost）
 * .populate('subscriberProfile')   → 展开为完整 Subscriber 文档（含 name、email、zipCode）
 * 两个 populate 分别对应详情页的"已报名课程"表格和"订阅信息"卡片。
 * 注意：这里未限制字段，因为详情页需要课程的 duration 和 cost 等信息。
 * ================================================================================ */
export async function getShow(req: Request, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.params.id)
      .populate('enrolledCourses')
      .populate('subscriberProfile')
      .lean();
    if (!user) {
      return void res.status(404).render('404', {
        title: '404',
        currentPage: '',
      });
    }
    res.render('users/show', {
      title: user.name,
      currentPage: 'users',
      user,
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

/* ── GET — 编辑表单 ── */
export async function getEdit(req: Request, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) {
      return void res.status(404).render('404', {
        title: '404',
        currentPage: '',
      });
    }
    const { allCourses, allSubscribers } = await getFormOptions();
    res.render('users/edit', {
      title: `编辑 - ${user.name}`,
      currentPage: 'users',
      errors: [],
      formData: user,
      user,
      allCourses,
      allSubscribers,
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
 * PUT /admin/users/:id — 更新用户
 * ================================================================================
 * 为什么不能直接用 parsed 作为更新数据，而要手动构建 updateData？
 *
 * updateUserSchema = createUserSchema.partial()
 * 用户只改了名字 → parsed = { name: '新名字' }
 * 其余字段都是 undefined。
 *
 * 如果直接 User.findByIdAndUpdate(id, parsed)：
 *   { name: '新名字', email: undefined, enrolledCourses: undefined, ... }
 *   Mongoose 会把 email 设为 undefined → 触发 required 校验失败
 *
 * 所以必须手动判断：只有 req.body 中实际传了的字段才加入 updateData。
 * 这是 .partial() 的代价 —— 获得了灵活性，但失去了"直接塞进去就行"的便利。
 * ================================================================================ */
export async function putUpdate(req: Request, res: Response): Promise<void> {
  const { allCourses, allSubscribers } = await getFormOptions();
  try {
    const parsed = updateUserSchema.parse(req.body);

    // 只更新实际提交了的字段
    const updateData: Record<string, unknown> = {};
    if (parsed.name !== undefined) updateData.name = parsed.name;
    if (parsed.email !== undefined) updateData.email = parsed.email;
    if (parsed.enrolledCourses !== undefined) {
      updateData.enrolledCourses = parsed.enrolledCourses.filter(
        (id) => id !== '',
      );
    }
    if (parsed.subscriberProfile !== undefined) {
      // 空字符串 → null（清空关联）
      updateData.subscriberProfile =
        parsed.subscriberProfile && parsed.subscriberProfile !== ''
          ? parsed.subscriberProfile
          : null;
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      runValidators: true, // 更新时也触发 Mongoose 校验
      new: true,           // 返回更新后的文档
    });
    if (!user) {
      return void res.status(404).render('404', {
        title: '404',
        currentPage: '',
      });
    }
    res.json({ ok: true, redirect: `/admin/users/${user._id}` });
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
      return void res.json({ ok: false, errors: [{ field: 'email', message: '该邮箱已存在' }] });
    }
    if ((err as any).name === 'CastError') {
      return void res.status(404).render('404', { title: '404', currentPage: '' });
    }
    throw err;
  }
}

/* ── DELETE — 真删除 ──
 * User 是顶层实体，无外部表引用，注销即彻底删除。
 */
export async function deleteRemove(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return void res.status(404).render('404', {
        title: '404',
        currentPage: '',
      });
    }
    res.json({ ok: true, redirect: '/admin/users' });
  } catch (err) {
    if ((err as any).name === 'CastError') {
      return void res.status(404).render('404', { title: '404', currentPage: '' });
    }
    throw err;
  }
}
