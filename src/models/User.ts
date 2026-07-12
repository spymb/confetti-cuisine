import mongoose, { Schema, type Document } from 'mongoose';

/* ================================================================================
 * User 模型 — 系统用户/学员
 * ================================================================================
 * - 三个模型中最复杂的：同时关联 Course（多对多）和 Subscriber（一对一）。
 * - 删除策略：真删除 —— 顶层实体，无外部表引用，注销即彻底移除。
 * - urlencoded 多选表单的边界处理见 userController.postCreate。
 * ================================================================================ */

export interface IUser extends Document {
  name: string;                                // 用户姓名
  email: string;                               // 邮箱（唯一）
  enrolledCourses: mongoose.Types.ObjectId[];   // 已报名课程 ID 数组（多对多）
  subscriberProfile?: mongoose.Types.ObjectId;  // 关联的订阅者 ID（一对一，可选）
  createdAt: Date;                              // 注册时间
  updatedAt: Date;                              // 更新时间
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

const User = mongoose.model<IUser>('User', userSchema);
export default User;
