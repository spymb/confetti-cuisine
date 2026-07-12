import { Router } from 'express';
import {
  getHome,
  getCourses,
  getContact,
  postSubscribe,
} from '../controllers/homeController.js';
import userRoutes from './userRoutes.js';
import courseRoutes from './courseRoutes.js';
import subscriberRoutes from './subscriberRoutes.js';

/* ================================================================================
 * 主路由 — 整合所有子路由并挂载
 * ================================================================================
 * 路由设计分为两层：
 *
 *   【前台】公开访问，无需认证：
 *     /           首页
 *     /courses    课程展示（从 Course 表读取）
 *     /contact    联系我们（含订阅表单）
 *     /subscribe  订阅提交（POST，访客入口）
 *
 *   【后台】/admin/* 前缀，管理员操作（未来需加认证中间件）：
 *     /admin/users        用户 CRUD
 *     /admin/courses      课程 CRUD（含软删除）
 *     /admin/subscribers  订阅者 CRUD
 *
 *   /admin 前缀的三重含义：
 *     1. URL 结构清晰，一眼区分前台和后台
 *     2. 避免冲突：前台 /courses（展示）vs 后台 /admin/courses（管理）
 *     3. 便于统一插认证中间件：router.use('/admin', requireAuth, ...)
 * ================================================================================ */

const router = Router();

/* ──────────── 公开页面路由（前台） ──────────── */

router.get('/', getHome);
router.get('/home', getHome);       // 首页别名
router.get('/courses', getCourses); // 课程展示页
router.get('/contact', getContact); // 联系我们（含订阅表单）

/* ──────────── 表单处理（前台） ──────────── */
// 访客通过 /contact 页面的表单订阅
router.post('/subscribe', postSubscribe);

/* ──────────── CRUD 管理路由（后台 /admin） ──────────── */
//
// 注意：router.use('/admin/users', userRoutes) 会将 /admin/users 前缀
// 截去后传给 userRoutes，所以 userRoutes 内部的 '/' 实际对应 /admin/users。
//
// 路由顺序提示：
// userRoutes 中 '/new' 必须在 '/:id' 前注册（Express 从上到下匹配，先到先得），
// 否则 '/new' 会被 '/:id' 当作 id='new' 吃掉。
router.use('/admin/users', userRoutes);
router.use('/admin/courses', courseRoutes);
router.use('/admin/subscribers', subscriberRoutes);

export default router;
