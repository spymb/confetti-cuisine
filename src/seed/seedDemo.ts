/* ================================================================================
 * 演示数据种子脚本
 * ================================================================================
 * 将课程、订阅者、用户（含关联）的示例数据写入 MongoDB。
 * 运行方式：pnpm tsx src/seed/seedDemo.ts
 *
 * 执行逻辑：
 *   1. 连接 MongoDB（优先外部数据库，无则启动内存实例）
 *   2. 清空三张表（deleteMany）
 *   3. 按依赖顺序灌入：课程 → 订阅者 → 用户（关联前两者）
 *   4. 断开连接，退出
 * ================================================================================ */

import 'dotenv/config';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Course from '../models/Course.js';
import User from '../models/User.js';
import Subscriber from '../models/Subscriber.js';

const MONGODB_URI = process.env.MONGODB_URI;

let uri = MONGODB_URI;
if (!uri) {
  const mongod = await MongoMemoryServer.create();
  uri = mongod.getUri();
}

await mongoose.connect(uri);

// 清空已有数据（先清除，确保每次运行结果一致）
await Course.deleteMany({});
await User.deleteMany({});
await Subscriber.deleteMany({});

// ── 第一步：灌入课程（作为后续用户的 enrolledCourses 引用） ──
const courses = await Course.insertMany([
  { title: '法式甜点基础', description: '掌握法式烘焙艺术——学习从零开始制作可颂、闪电泡芙、马卡龙和水果挞。', duration: '8 周 • 初级', cost: 399 },
  { title: '意大利面食工坊', description: '从丝滑的宽面条到精致的意式饺子——探索手工意面的奥秘。', duration: '6 周 • 全等级', cost: 349 },
  { title: '寿司入门 101', description: '学习寿司的基本功——完美米饭、刀工技巧、卷寿司、握寿司和刺身。', duration: '4 周 • 初级', cost: 299 },
  { title: '纯素甜品', description: '打造令人惊艳的植物基底蛋糕、慕斯和曲奇。', duration: '4 周 • 中级', cost: 329 },
  { title: '亚洲街头美食', description: '将亚洲夜市的缤纷风味带入你的厨房——泰式炒河粉、刈包、饺子等。', duration: '6 周 • 全等级', cost: 369 },
  { title: '面包烘焙大师课', description: '从乡村酸面包到松软布里欧修——了解发酵、揉面和整形。', duration: '8 周 • 中级', cost: 449 },
]);
console.log(`✅ 灌入 ${courses.length} 门课程`);

// ── 第二步：灌入订阅者（作为后续用户的 subscriberProfile 引用） ──
const subscribers = await Subscriber.insertMany([
  { name: '张小红', email: 'xiaohong@example.com', zipCode: '10001' },
  { name: '李明远', email: 'mingyuan@example.com', zipCode: '20002' },
]);
console.log(`✅ 灌入 ${subscribers.length} 位订阅者`);

// ── 第三步：灌入用户（关联前两步创建的课程和订阅者） ──
// 使用 create 而非 insertMany，因为每个用户的关联不同
await User.create({
  name: '王大明',
  email: 'daming@example.com',
  enrolledCourses: [courses[0]._id, courses[1]._id, courses[5]._id], // 报名了三门课
  subscriberProfile: subscribers[0]._id,                              // 关联张小红
});
await User.create({
  name: '陈小美',
  email: 'xiaomei@example.com',
  enrolledCourses: [courses[2]._id, courses[3]._id], // 报名了两门课
  subscriberProfile: subscribers[1]._id,              // 关联李明远
});
await User.create({
  name: '赵小刚',
  email: 'xiaogang@example.com',
  enrolledCourses: [courses[4]._id], // 只报了一门课
  // 未关联 subscriberProfile，默认为 null
});
console.log('✅ 灌入 3 位用户');

await mongoose.disconnect();
console.log('✅ 演示数据灌入完成');
process.exit(0);
