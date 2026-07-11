import { Request, Response } from 'express';
import { courses } from '../data/courses.js';
import Subscriber from '../models/Subscriber.js';

/* ──────────── 页面渲染 ──────────── */

/** 首页 */
export function getHome(req: Request, res: Response): void {
  res.render('index', { title: '首页', currentPage: 'home' });
}

/** 课程列表页（传入 courses 数组，EJS 循环渲染） */
export function getCourses(req: Request, res: Response): void {
  res.render('courses', { title: '课程', currentPage: 'courses', courses });
}

/** 联系表单页 */
export function getContact(req: Request, res: Response): void {
  res.render('contact', { title: '联系我们', currentPage: 'contact' });
}

/* ──────────── 表单处理 ──────────── */

/** 处理 POST /subscribe（存入 MongoDB subscribers 集合） */
export async function postSubscribe(
  req: Request,
  res: Response,
): Promise<void> {
  const { name, email } = req.body;
  const zipCodeRaw: string | undefined = req.body.zipCode;

  // urlencoded 会将字段以字符串形式发送；空字符串视为未提供
  const zipCode =
    zipCodeRaw && zipCodeRaw.trim() !== '' ? zipCodeRaw.trim() : undefined;

  try {
    await Subscriber.create({ name, email, zipCode });
    res.render('thanks', {
      title: '感谢订阅',
      name: name || '访客',
      currentPage: '',
    });
  } catch (err: any) {
    // 唯一索引冲突（重复邮箱）
    if (err.code === 11000) {
      res.render('contact', {
        title: '联系我们',
        currentPage: 'contact',
        error: '该邮箱已订阅，请使用其他邮箱。',
        formData: { name, email, zipCode: zipCodeRaw },
      });
      return;
    }

    // Mongoose 校验错误（name 缺失、zipCode 格式错误等）
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors)
        .map((e: any) => e.message)
        .join('；');
      res.render('contact', {
        title: '联系我们',
        currentPage: 'contact',
        error: messages,
        formData: { name, email, zipCode: zipCodeRaw },
      });
      return;
    }

    // 其他未知错误 → 交由 Express 5 的 async 错误捕获机制传递给 internalError
    throw err;
  }
}

/** GET /subscribers — 展示所有订阅者（仅开发环境） */
export async function getSubscribers(
  _req: Request,
  res: Response,
): Promise<void> {
  const subscribers = await Subscriber.find().sort({ createdAt: -1 }).lean();
  res.render('subscribers', {
    title: '订阅者列表',
    currentPage: 'subscribers',
    subscribers,
  });
}
