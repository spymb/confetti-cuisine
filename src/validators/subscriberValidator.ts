import { z } from 'zod';

/* ================================================================================
 * Subscriber 输入校验 — Zod 层
 * ================================================================================
 * - zipCode 是最复杂的字段：选填，但一旦填了必须是 5 位数字。
 * - HTTP 表单"不填"的表现是空字符串 ''，不是 undefined/null。
 * - 因此必须同时放行 '' 和有效值，否则空提交会报校验错误。
 * ================================================================================ */

export const createSubscriberSchema = z.object({
  name: z.string()
    .min(1, '姓名不能为空')
    .max(100, '姓名不能超过100字'),
  email: z.string()
    .min(1, '邮箱不能为空')
    .email('邮箱格式不正确'),
  zipCode: z
    .string()
    .regex(/^\d{5}$/, '邮编必须是5位数字')  // 填了必须是 5 位数字
    .optional()                                // 允许不传此字段（undefined）
    .or(z.literal('')),                        // 允许传了但是空字符串（HTTP 表单的"没填"）
  /* ── 三种放行路径 ──
   * undefined  → .optional() 放行（字段压根没出现在请求 body 中）
   * ''         → .or(z.literal('')) 放行（字段在 body 中但用户没填）
   * '20002'    → .regex(/^\d{5}$/) 放行（有效值）
   * 'abc'      → 全部不匹配，报错
   *
   * 注意：Zod 放行 '' 后，Mongoose validator 也需放行 ''（见 Subscriber.ts），
   * 否则 Zod 通过的数据会在 Mongoose 层被拦截。两层必须对齐。
   */
});

export const updateSubscriberSchema = createSubscriberSchema.partial();

export type CreateSubscriberInput = z.infer<typeof createSubscriberSchema>;
export type UpdateSubscriberInput = z.infer<typeof updateSubscriberSchema>;
