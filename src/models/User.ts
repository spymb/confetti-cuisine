import bcrypt from 'bcrypt';
import mongoose, { Schema, type Document } from 'mongoose';

/* ================================================================================
 * User 模型 — 系统用户/学员
 * ================================================================================
 * - 三个模型中最复杂的：同时关联 Course（多对多）和 Subscriber（一对一）。
 * - 删除策略：真删除 —— 顶层实体，无外部表引用，注销即彻底移除。
 * - 认证：bcrypt 哈希存储密码（成本因子 12），pre-save 钩子仅在密码被修改时触发。
 * ================================================================================ */

const BCRYPT_COST = 12;

export interface IUser extends Document {
  name: string;                                // 用户姓名
  email: string;                               // 邮箱（唯一，即登录凭据）
  password: string;                            // bcrypt 哈希密码
  role: 'admin' | 'user';                     // 角色：管理员 / 普通用户
  enrolledCourses: mongoose.Types.ObjectId[];   // 已报名课程 ID 数组（多对多）
  subscriberProfile?: mongoose.Types.ObjectId;  // 关联的订阅者 ID（一对一，可选）
  createdAt: Date;                              // 注册时间
  updatedAt: Date;                              // 更新时间
  comparePassword(candidate: string): Promise<boolean>;  // 校验密码
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, '姓名不能为空'],
      trim: true,
      maxlength: [100, '姓名不能超过100字'],
    },
    email: {
      type: String,
      required: [true, '邮箱不能为空'],
      unique: true,     // 全局唯一，不允许重复注册
      trim: true,
      lowercase: true,  // 统一转小写，避免大小写差异导致的"假重复"
    },
    password: {
      type: String,
      required: [true, '密码不能为空'],
      minlength: [6, '密码至少需要6个字符'],
      // 不设 select: false — isModified 需要访问密码字段，
      // 且 Passport 策略查用户时需拿到密码做 comparePassword
    },
    role: {
      type: String,
      enum: {
        values: ['admin', 'user'],
        message: '角色类型无效',
      },
      default: 'user', // 新注册用户默认为普通用户
    },
    enrolledCourses: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Course',  // 指向 Course 集合，populate 时自动 JOIN
      },
    ],
    subscriberProfile: {
      type: Schema.Types.ObjectId,
      ref: 'Subscriber', // 指向 Subscriber 集合
      default: null,     // 新用户默认不关联订阅者
    },
  },
  { timestamps: true },
);

/* ── pre-save 钩子：密码哈希 ──
 * isModified('password') 确保只在密码被修改时才重新哈希，
 * 避免每次 save() 都重复加密已哈希的密码。
 * Mongoose 9 的 pre-save 支持 async 函数，无需 next 回调。
 */
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, BCRYPT_COST);
});

/* ── 实例方法：密码比对 ── */
userSchema.methods.comparePassword = async function (
  candidate: string,
): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

const User = mongoose.model<IUser>('User', userSchema);
export default User;
