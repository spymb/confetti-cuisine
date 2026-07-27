import mongoose, { Schema, type Document } from 'mongoose';

/* ================================================================================
 * Message 模型 — 聊天消息
 * ================================================================================
 * - 每条消息关联一个用户和一个可选的课程（rooms 加分项）。
 * - userName 冗余存储，广播时无需额外 populate 查询。
 * - 无需软删除：聊天消息无其他表引用。
 * ================================================================================ */

export interface IMessage extends Document {
  user: mongoose.Types.ObjectId;       // 发送者 ID
  userName: string;                     // 发送者姓名（冗余，避免 populate）
  content: string;                      // 消息内容（纯文本）
  courseId?: mongoose.Types.ObjectId;   // 可选：课程群聊 ID（rooms 加分项）
  createdAt: Date;                      // 发送时间
  updatedAt: Date;                      // 更新时间
}

const messageSchema = new Schema<IMessage>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, '消息必须关联用户'],
    },
    userName: {
      type: String,
      required: [true, '消息必须包含用户名'],
    },
    content: {
      type: String,
      required: [true, '消息内容不能为空'],
      trim: true,
      maxlength: [500, '消息不能超过500字'],
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
    },
  },
  { timestamps: true },
);

// 消息列表按时间倒序索引，查询最近 N 条更快
messageSchema.index({ createdAt: -1 });
// 按课程查历史消息
messageSchema.index({ courseId: 1, createdAt: -1 });

const Message = mongoose.model<IMessage>('Message', messageSchema);
export default Message;
