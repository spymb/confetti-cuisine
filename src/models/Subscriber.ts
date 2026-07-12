import mongoose, { Schema, type Document } from 'mongoose';

/* ================================================================================
 * Subscriber 模型 — 邮件订阅者
 * ================================================================================
 * - 最简单的模型，用于演示 Mongoose schema 定义、校验、唯一索引。
 * - 被 User.subscriberProfile 可选引用（一对一）。
 * - 删除策略：真删除 —— 订阅者退订即彻底移除，无外部依赖需要保留。
 * ================================================================================ */

export interface ISubscriber extends Document {
  name: string;       // 订阅者姓名
  email: string;      // 邮箱（唯一，作为订阅标识）
  zipCode?: string;   // 邮编（选填，5 位数字）
  createdAt: Date;    // 订阅时间（由 timestamps 自动管理）
  updatedAt: Date;    // 更新时间（由 timestamps 自动管理）
}

const subscriberSchema = new Schema<ISubscriber>(
  {
    name: {
      type: String,
      required: [true, '姓名是必填项'],
    },
    email: {
      type: String,
      required: [true, '邮箱是必填项'],
      unique: true, // 全局唯一索引 —— 同一邮箱只能订阅一次
    },
    zipCode: {
      type: String,
      required: false, // 选填字段，不设 required
      validate: {
        /* ── 自定义校验器：三种情况放行，其余拒绝 ──
         * null  → 数据库读出时字段不存在
         * ''    → HTTP 表单留空提交
         * 5位数字 → 有效值通过正则校验
         * 为什么不用 required + match？因为 required: false 时 match 对空值行为不一致
         */
        validator(v: string): boolean {
          return v == null || v === '' || /^\d{5}$/.test(v);
        },
        message: '邮编必须是5位数字',
      },
    },
  },
  {
    /* ── timestamps: true ──
     * 自动添加 createdAt 和 updatedAt 字段，并自动维护：
     * - 新建时两者都设为当前时间
     * - 更新时 updatedAt 自动刷新
     * 等同于手写：
     *   createdAt: { type: Date, default: Date.now, immutable: true }
     *   updatedAt: { type: Date, default: Date.now }
     */
    timestamps: true,
  },
);

const Subscriber = mongoose.model<ISubscriber>('Subscriber', subscriberSchema);
export default Subscriber;
