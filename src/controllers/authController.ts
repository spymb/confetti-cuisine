import { Request, Response, NextFunction } from 'express';
import passport from '../config/passport.js';
import User from '../models/User.js';
import Subscriber from '../models/Subscriber.js';
import { formatZodError } from '../utils/formatZodError.js';
import { registerSchema, loginSchema } from '../validators/authValidator.js';

/* ================================================================================
 * 认证控制器 — 登录 / 注册 / 登出
 * ================================================================================
 * 遵循传统 POST + PRG 模式（与 /subscribe 一致），不使用 AJAX JSON。
 * 注册成功后自动登录（req.login），用户无需再次输入密码。
 * 注册时自动匹配已有 Subscriber（订阅表格独立存在，用户注册时做关联）。
 * ================================================================================ */

/** GET /login — 渲染登录页面 */
export function getLogin(req: Request, res: Response): void {
  res.render('login', {
    title: '登录',
    currentPage: 'login',
    errors: [],
    formData: {},
  });
}

/** POST /login — 处理登录表单（Passport 本地策略）
 * passport.authenticate('local', callback) 手动处理，
 * 以便在失败时将错误信息传给 EJS 模板（而非默认的 JSON/重定向）。
 */
export function postLogin(req: Request, res: Response, next: NextFunction): void {
  // 先 Zod 校验
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(422).json({ ok: false, stage: 'zod', errors: formatZodError(result.error) });
    return;
  }

  // Passport 认证
  passport.authenticate(
    'local',
    (err: Error | null, user: Express.User | false, info: { message?: string } | undefined) => {
      if (err) {
        console.error('[postLogin] Passport 异常:', err.message);
        return next(err);
      }

      if (!user) {
        res.status(401).json({ ok: false, stage: 'passport', info: info?.message, bodyEmail: req.body.email });
        return;
      }

      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);

        req.flash('success', `欢迎回来，${user.name}！`);
        const redirectTo = req.session.returnTo || '/';
        delete req.session.returnTo;
        res.redirect(redirectTo);
      });
    },
  )(req, res, next);
}

/** GET /register — 渲染注册页面 */
export function getRegister(req: Request, res: Response): void {
  res.render('register', {
    title: '注册',
    currentPage: 'register',
    errors: [],
    formData: {},
  });
}

/** POST /register — 处理注册表单
 * 流程：Zod 校验 → 邮箱查重 → 匹配 Subscriber → User.create → 自动登录
 */
export async function postRegister(req: Request, res: Response, next: NextFunction): Promise<void> {
  // 1. Zod 校验
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    res.status(422).render('register', {
      title: '注册',
      currentPage: 'register',
      errors: formatZodError(result.error),
      formData: req.body,
    });
    return;
  }

  const { name, email, password } = result.data;

  try {
    // 2. 邮箱查重
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      res.status(422).render('register', {
        title: '注册',
        currentPage: 'register',
        errors: [{ field: 'email', message: '该邮箱已被注册' }],
        formData: req.body,
      });
      return;
    }

    // 3. 自动关联已有 Subscriber（如果注册邮箱匹配订阅列表中的邮箱）
    const subscriber = await Subscriber.findOne({
      email: email.toLowerCase().trim(),
    });

    // 4. 创建用户
    const user = await User.create({
      name,
      email,
      password, // pre-save 钩子自动 bcrypt 哈希
      role: 'user',
      subscriberProfile: subscriber ? subscriber._id : undefined,
    });

    // 5. 自动登录
    req.login(user, (loginErr) => {
      if (loginErr) return next(loginErr);

      req.flash('success', `注册成功！欢迎加入缤纷厨房，${name}。`);
      const redirectTo = req.session.returnTo || '/';
      delete req.session.returnTo;
      res.redirect(redirectTo);
    });
  } catch (err: any) {
    // Mongoose ValidationError
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e: any) => e.message);
      res.status(422).render('register', {
        title: '注册',
        currentPage: 'register',
        errors: messages.map((m) => ({ field: '', message: m })),
        formData: req.body,
      });
      return;
    }
    // 唯一索引冲突（极端并发场景的兜底）
    if (err.code === 11000) {
      res.status(422).render('register', {
        title: '注册',
        currentPage: 'register',
        errors: [{ field: 'email', message: '该邮箱已被注册' }],
        formData: req.body,
      });
      return;
    }
    next(err);
  }
}

/** GET /logout — 登出
 * req.logout() — 清除 Passport 会话中的用户
 * req.session.destroy() — 彻底销毁会话（清空 MongoDB 中的 session 记录）
 * res.clearCookie('connect.sid') — 清除浏览器 cookie
 *
 * 注意：不在登出时设置 flash 消息，因为 session.destroy() 会清空 flash 存储。
 *       导航栏从"欢迎,{name}"变为"登录/注册"已提供足够的登出反馈。
 */
export function getLogout(req: Request, res: Response, next: NextFunction): void {
  req.logout((err) => {
    if (err) return next(err);

    req.session.destroy((destroyErr) => {
      if (destroyErr) return next(destroyErr);

      res.clearCookie('connect.sid');
      res.redirect('/');
    });
  });
}
