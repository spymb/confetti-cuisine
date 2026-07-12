import { Request, Response } from 'express';
import { ZodError } from 'zod';
import Subscriber from '../models/Subscriber.js';
import {
  createSubscriberSchema,
  updateSubscriberSchema,
} from '../validators/subscriberValidator.js';

/* ================================================================================
 * Subscriber 控制器 — 订阅者管理 CRUD
 * ================================================================================
 * 与 courseController 结构完全一致，差异仅在于：
 * - 不涉及软删除（真删除）
 * - zipCode 需要特殊处理空字符串
 * - 所有写操作统一 AJAX 模式
 * ================================================================================ */

function formatZodError(err: ZodError): Array<{ field: string; message: string }> {
  return err.issues.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
  }));
}

/* ── GET — 列表 ── */
export async function getIndex(req: Request, res: Response): Promise<void> {
  const subscribers = await Subscriber.find().sort({ createdAt: -1 }).lean();
  res.render('subscribers/index', {
    title: '订阅者管理',
    currentPage: 'subscribers',
    subscribers,
  });
}

/* ── GET — 新建表单 ── */
export function getNew(req: Request, res: Response): void {
  res.render('subscribers/new', {
    title: '新建订阅者',
    currentPage: 'subscribers',
  });
}

/* ── POST — 创建 ──
 * 特殊处理：如果用户未填 zipCode，body 中为 ''，Zod 通过 .or(z.literal('')) 放行后，
 * 需要手动 delete 掉空字符串 → 不传 zipCode 给 Mongoose → Mongoose 不存此字段 → 值为 undefined。
 * 如果直接传 { zipCode: '' } 给 Mongoose，自定义 validator 虽然也放行 ''，
 * 但会在数据库中写入空字符串，语义上不干净。
 */
export async function postCreate(req: Request, res: Response): Promise<void> {
  try {
    const data = createSubscriberSchema.parse(req.body);
    if (data.zipCode === '') delete data.zipCode;
    await Subscriber.create(data);
    res.json({ ok: true, redirect: '/admin/subscribers' });
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
      return void res.json({ ok: false, errors: [{ field: 'email', message: '该邮箱已订阅' }] });
    }
    throw err;
  }
}

/* ── GET — 详情 ── */
export async function getShow(req: Request, res: Response): Promise<void> {
  try {
    const subscriber = await Subscriber.findById(req.params.id).lean();
    if (!subscriber) {
      return void res.status(404).render('404', {
        title: '404',
        currentPage: '',
      });
    }
    res.render('subscribers/show', {
      title: subscriber.name,
      currentPage: 'subscribers',
      subscriber,
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
    const subscriber = await Subscriber.findById(req.params.id).lean();
    if (!subscriber) {
      return void res.status(404).render('404', {
        title: '404',
        currentPage: '',
      });
    }
    res.render('subscribers/edit', {
      title: `编辑 - ${subscriber.name}`,
      currentPage: 'subscribers',
      errors: [],
      formData: subscriber,
      subscriber,
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

/* ── PUT — 更新（AJAX） ──
 * 注意：更新时 zipCode 传空字符串需转为 null，让 Mongoose 将字段清空。
 * 与创建不同，更新时传 '' 意味着"清空此字段"，而非"不传此字段"。
 */
export async function putUpdate(req: Request, res: Response): Promise<void> {
  try {
    const data = updateSubscriberSchema.parse(req.body);
    if ((data as any).zipCode === '') (data as any).zipCode = null;
    const subscriber = await Subscriber.findByIdAndUpdate(
      req.params.id,
      data,
      { runValidators: true, new: true },
    );
    if (!subscriber) {
      return void res.status(404).render('404', {
        title: '404',
        currentPage: '',
      });
    }
    res.json({ ok: true, redirect: `/admin/subscribers/${subscriber._id}` });
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
      return void res.json({ ok: false, errors: [{ field: 'email', message: '该邮箱已订阅' }] });
    }
    if ((err as any).name === 'CastError') {
      return void res.status(404).render('404', { title: '404', currentPage: '' });
    }
    throw err;
  }
}

/* ── DELETE — 真删除 ──
 * Subscriber 无外部依赖需要保留（User.subscriberProfile 是可选字段），直接物理删除。
 * findByIdAndDelete 是 findOneAndDelete({ _id: id }) 的快捷方式。
 */
export async function deleteRemove(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const subscriber = await Subscriber.findByIdAndDelete(req.params.id);
    if (!subscriber) {
      return void res.status(404).render('404', {
        title: '404',
        currentPage: '',
      });
    }
    res.json({ ok: true, redirect: '/admin/subscribers' });
  } catch (err) {
    if ((err as any).name === 'CastError') {
      return void res.status(404).render('404', { title: '404', currentPage: '' });
    }
    throw err;
  }
}
