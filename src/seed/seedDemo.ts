/* ================================================================================
 * 演示数据种子脚本
 * ================================================================================
 * 支持两种用法：
 *   1. 独立运行：pnpm tsx src/seed/seedDemo.ts （自建连接 → 灌数据 → 退出）
 *   2. 复用连接：由 main.ts --seed 调用 （共享 dev server 的 MongoDB 连接）
 *
 * 管理员账号：
 *   daming@example.com / password123
 * ================================================================================ */

import Course from '../models/Course.js';
import User from '../models/User.js';
import Subscriber from '../models/Subscriber.js';

/**
 * 灌入演示数据（需要已连接的 mongoose）。
 * 幂等：先清空三张表再灌入，多次运行结果一致。
 */
export async function seedDemo(): Promise<void> {
  // 清空已有数据
  await Course.deleteMany({});
  await User.deleteMany({});
  await Subscriber.deleteMany({});

  // ── 第一步：灌入课程 ──
  const courses = await Course.insertMany([
    { title: '法式甜点基础', description: '掌握法式烘焙艺术——学习从零开始制作可颂、闪电泡芙、马卡龙和水果挞。', duration: '8 周 • 初级', cost: 399 },
    { title: '意大利面食工坊', description: '从丝滑的宽面条到精致的意式饺子——探索手工意面的奥秘。', duration: '6 周 • 全等级', cost: 349 },
    { title: '寿司入门 101', description: '学习寿司的基本功——完美米饭、刀工技巧、卷寿司、握寿司和刺身。', duration: '4 周 • 初级', cost: 299 },
    { title: '纯素甜品', description: '打造令人惊艳的植物基底蛋糕、慕斯和曲奇。', duration: '4 周 • 中级', cost: 329 },
    { title: '亚洲街头美食', description: '将亚洲夜市的缤纷风味带入你的厨房——泰式炒河粉、刈包、饺子等。', duration: '6 周 • 全等级', cost: 369 },
    { title: '面包烘焙大师课', description: '从乡村酸面包到松软布里欧修——了解发酵、揉面和整形。', duration: '8 周 • 中级', cost: 449 },
  ]);
  console.log(`✅ 灌入 ${courses.length} 门课程`);

  // ── 第二步：灌入订阅者 ──
  const subscribers = await Subscriber.insertMany([
    { name: '张小红', email: 'xiaohong@example.com', zipCode: '10001' },
    { name: '李明远', email: 'mingyuan@example.com', zipCode: '20002' },
  ]);
  console.log(`✅ 灌入 ${subscribers.length} 位订阅者`);

  // ── 第三步：灌入用户 ──
  // 使用 create（触发 pre-save 钩子 → bcrypt 哈希密码）
  await User.create({
    name: '王大明',
    email: 'daming@example.com',
    password: 'password123',
    role: 'admin',
    enrolledCourses: [courses[0]._id, courses[1]._id, courses[5]._id],
    subscriberProfile: subscribers[0]._id,
  });
  await User.create({
    name: '陈小美',
    email: 'xiaomei@example.com',
    password: 'password123',
    role: 'user',
    enrolledCourses: [courses[2]._id, courses[3]._id],
    subscriberProfile: subscribers[1]._id,
  });
  await User.create({
    name: '赵小刚',
    email: 'xiaogang@example.com',
    password: 'password123',
    role: 'user',
    enrolledCourses: [courses[4]._id],
  });
  console.log('✅ 灌入 3 位用户（含 1 位管理员）');
}

