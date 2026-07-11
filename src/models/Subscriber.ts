import mongoose, { Schema, type Document } from 'mongoose';

export interface ISubscriber extends Document {
  name: string;
  email: string;
  zipCode?: string;
  createdAt: Date;
  updatedAt: Date;
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
      unique: true,
    },
    zipCode: {
      type: String,
      required: false,
      validate: {
        validator(v: string): boolean {
          return v == null || v === '' || /^\d{5}$/.test(v);
        },
        message: '邮编必须是5位数字',
      },
    },
  },
  { timestamps: true },
);

const Subscriber = mongoose.model<ISubscriber>('Subscriber', subscriberSchema);
export default Subscriber;
