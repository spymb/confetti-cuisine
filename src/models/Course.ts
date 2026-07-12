import mongoose, { Schema, type Document } from 'mongoose';

/* ================================================================================
 * Course 模型 — 烹饪课程
 * ================================================================================
 * - 被 User.enrolledCourses 多对多引用，因此不能硬删除（否则用户的报名记录出现悬挂 ID）。
 * - 删除策略：软删除（deletedAt + pre 中间件自动过滤 + partial unique index）。
 * - partial unique index 允许同一课程多次"上下架"——每次开课是独立记录，历史可追溯。
 * ================================================================================ */

export interface ICourse extends Document {
  title: string;          // 课程标题
  description: string;    // 课程简介
  duration: string;       // 课程时长描述（如 "8 周 • 初级"）
  cost: number;           // 课程价格（≥0）
  deletedAt: Date | null; // 软删除标记（null = 活跃，有值 = 已删除）
  createdAt: Date;        // 创建时间
  updatedAt: Date;        // 更新时间
}

const courseSchema = new Schema<ICourse>(
  {
    title: {
      type: String,
      required: [true, '课程标题不能为空'],
      trim: true, // 自动去首尾空格
      maxlength: [200, '课程标题不能超过200字'],
      // 注意：这里不设 unique: true，唯一约束由下方的 partial index 接管
    },
    description: {
      type: String,
      required: [true, '课程描述不能为空'],
    },
    duration: {
      type: String,
      required: [true, '课程时长不能为空'],
    },
    cost: {
      type: Number,
      required: [true, '课程价格不能为空'],
      min: [0, '价格不能为负数'], // Mongoose 层兜底校验，Zod 会先拦截
    },
    deletedAt: {
      type: Date,
      default: null, // 新建课程默认活跃
    },
  },
  { timestamps: true },
);

/* ── 软删除中间件：自动过滤已删除文档 ──
 *
 * 工作原理：
 * 每次执行 find / findOne / findOneAndUpdate 等查询前，
 * 自动在查询条件中注入 deletedAt: null，让已删除文档"不可见"。
 *
 * _includeDeleted 逃生门：
 * 查询时传入 { _includeDeleted: true }，中间件检测到此标记则跳过过滤，
 * 用于需要查看全部数据（含已删除）的场景。
 * 该字段不在 Schema 中，只作为临时查询标记使用，用完即删。
 *
 * 为什么没有 findById？因为 Mongoose 的 findById 底层调用 findOne，
 * 拦截 findOne 足以覆盖。
 */
courseSchema.pre(
  ['find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete', 'countDocuments'],
  function () {
    const filter = this.getFilter() as Record<string, unknown>;
    if (!filter._includeDeleted) {
      delete filter._includeDeleted; // 清理临时标记，防止传给 MongoDB
      this.setQuery({ ...filter, deletedAt: null });
    }
  },
);

/* ── 部分唯一索引：只对活跃文档强制 title 唯一 ──
 *
 * 普通 unique index 在整个集合上唯一，已删除文档也占坑 → 不能删后重建同名。
 * partialFilterExpression: { deletedAt: null } 令索引只覆盖活跃文档，
 * 已删除的同名课程不参与唯一性检查，可以重新创建。
 *
 * { title: 1 } 中 1 = 升序索引，与唯一性无关；唯一性由 unique: true 控制。
 */
courseSchema.index(
  { title: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

const Course = mongoose.model<ICourse>('Course', courseSchema);
export default Course;
