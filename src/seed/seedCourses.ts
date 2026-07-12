/* ──────────── 课程数据种子脚本 ────────────
 * 将静态课程数据写入 MongoDB。
 * 运行方式：pnpm tsx src/seed/seedCourses.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Course from '../models/Course.js';
import { courses } from '../data/courses.js';

const MONGODB_URI = process.env.MONGODB_URI;

let uri = MONGODB_URI;

if (!uri) {
  const mongod = await MongoMemoryServer.create();
  uri = mongod.getUri();
  console.log('🧪 使用内存 MongoDB 实例');
}

try {
  await mongoose.connect(uri);
  console.log('✅ MongoDB connected');
} catch (err) {
  console.error('❌ MongoDB 连接失败:', err);
  process.exit(1);
}

let seeded = 0;
for (const c of courses) {
  const exists = await Course.findOne({ title: c.title });
  if (!exists) {
    await Course.create(c);
    seeded++;
    console.log(`  ➕ ${c.title}`);
  } else {
    console.log(`  ⏭️  ${c.title}（已存在，跳过）`);
  }
}

console.log(`\n✅ 成功灌入 ${seeded} 条新课程（共 ${courses.length} 条）`);
await mongoose.disconnect();
process.exit(0);
