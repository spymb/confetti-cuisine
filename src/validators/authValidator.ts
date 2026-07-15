import { z } from 'zod';

/* ================================================================================
 * 认证输入校验 — Zod 层
 * ================================================================================
 * registerSchema — 注册表单：含确认密码跨字段比对
 * loginSchema — 登录表单：仅校验非空
 * ================================================================================ */

export const registerSchema = z
  .object({
    name: z.string().min(1, '姓名不能为空').max(100, '姓名不能超过100字'),
    email: z.string().min(1, '邮箱不能为空').email('邮箱格式不正确'),
    password: z.string().min(6, '密码至少需要6个字符'),
    confirmPassword: z.string().min(1, '请确认密码'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.string().min(1, '邮箱不能为空').email('邮箱格式不正确'),
  password: z.string().min(1, '密码不能为空'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
