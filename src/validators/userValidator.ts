import { z } from 'zod';

/* ================================================================================
 * User 输入校验 — Zod 层
 * ================================================================================
 * - enrolledCourses 是数组，来自 <select multiple>。urlencoded 编码下，
 *   选一项时 body 中是字符串，选多项时是数组，控制器需做标准化处理。
 * - subscriberProfile 关联订阅者，空字符串表示"不关联"。
 * ================================================================================ */

export const createUserSchema = z.object({
  name: z.string()
    .min(1, '姓名不能为空')
    .max(100, '姓名不能超过100字'),
  email: z.string()
    .min(1, '邮箱不能为空')
    .email('邮箱格式不正确'),
  /* ── enrolledCourses: ObjectId 在 HTTP 层面是字符串 ── */
  enrolledCourses: z.array(z.string())
    .optional()
    .default([]), // 不选课程时为空数组而非 undefined
  /* ── subscriberProfile: 空字符串 → 控制器中转为 undefined（不关联） ── */
  subscriberProfile: z.string()
    .optional()
    .default(''),
});

export const updateUserSchema = createUserSchema.partial();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
