import { Request, Response } from 'express';
import { courses } from '../data/courses.js';

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

/** 处理 POST /subscribe（演示用，不存数据库） */
export function postSubscribe(req: Request, res: Response): void {
  const { name, email } = req.body;
  console.log(`[订阅] 姓名：${name || '(未填写)'}  邮箱：${email || '(未填写)'}`);
  res.render('thanks', {
    title: '感谢留言',
    name: name || '访客',
    currentPage: '', // thanks 页不标亮任何导航项
  });
}
