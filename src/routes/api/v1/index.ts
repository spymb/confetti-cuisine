import { Router, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import courseRoutes from './courseRoutes.js';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import { error } from '../../../utils/apiResponse.js';

/* ================================================================================
 * API v1 聚合路由
 * ================================================================================
 * 挂载所有 v1 子路由，并提供 JSON 错误处理中间件。
 * ================================================================================ */

const router = Router();

// 挂载子路由
router.use('/courses', courseRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);

/* ── API 专用错误处理中间件 ── */
// 捕获 API 路由抛出的所有异常，返回 JSON（而非 HTML 500 页面）
router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // CastError：无效的 MongoDB ObjectId
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json(error(400, '无效的 ID 格式'));
    return;
  }

  console.error('[API 错误]', err);
  res.status(500).json(error(500, '服务器内部错误'));
});

export default router;
