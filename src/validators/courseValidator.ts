import { z } from 'zod';

/* ================================================================================
 * Course 输入校验 — Zod 层（应用层第一道防线）
 * ================================================================================
 * - createCourseSchema：新建课程时的全字段校验。
 * - updateCourseSchema：编辑课程时的部分字段校验（.partial()）。
 * - 与 Mongoose schema 的约束规则一致，但作用在 HTTP 请求到达 Controller 之后、
 *   触碰数据库之前 —— 拦截 99% 的非法输入，提供友好的即时反馈。
 * ================================================================================ */

export const createCourseSchema = z.object({
  title: z.string()
    .min(1, '课程标题不能为空')
    .max(200, '课程标题不能超过200字'),
  description: z.string()
    .min(1, '课程描述不能为空'),
  duration: z.string()
    .min(1, '课程时长不能为空'),
  /* ── z.coerce.number() ──
   * HTML 表单 POST 的所有字段都是字符串，cost 传来的是 "399" 而非 399。
   * z.number() 收到字符串会直接报错。
   * z.coerce.number() 自动将字符串 "399" 转为数字 399，空字符串转为 0。
   */
  cost: z.coerce.number()
    .min(0, '价格不能为负数'),
});

/* ── .partial() ──
 * 将所有字段变为可选。用于编辑表单：用户只提交了改动的字段，
 * 不会因为没传 title 就报 "课程标题不能为空"。
 * 但这意味着控制器必须手动判断哪些字段真的被传了（undefined ≠ 不更新）。
 */
export const updateCourseSchema = createCourseSchema.partial();

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
