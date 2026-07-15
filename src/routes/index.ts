import { Router } from 'express';
import {
  getHome,
  getCourses,
  getContact,
  postSubscribe,
} from '../controllers/homeController.js';
import { getUserProfile } from '../controllers/profileController.js';
import { ensureAuthenticated, isAdmin } from '../middleware/auth.js';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import courseRoutes from './courseRoutes.js';
import subscriberRoutes from './subscriberRoutes.js';

/* ================================================================================
 * 主路由 — 整合所有子路由并挂载
 * ================================================================================
 * 路由设计分为三层：
 *
 *   【公开】无需认证：
 *     /            首页
 *     /courses     课程展示（从 Course 表读取）
 *     /contact     联系我们（含订阅表单）
 *     /subscribe   订阅提交（POST，访客入口）
 *     /login       登录
 *     /register    注册
 *     /logout      登出
 *
 *   【用户自我服务】需要登录：
 *     /users/:id   查看自己的个人资料（含课程+订阅信息，只读）
 *
 *   【管理后台】/admin/*  需要管理员权限：
 *     /admin/users        用户 CRUD（无创建）
 *     /admin/courses      课程 CRUD（含软删除）
 *     /admin/subscribers  订阅者 CRUD
 *
 *   /admin 前缀的三重含义：
 *     1. URL 结构清晰，一眼区分前台和后台
 *     2. 避免冲突：前台 /courses（展示）vs 后台 /admin/courses（管理）
 *     3. 便于统一插认证中间件
 * ================================================================================ */

const router = Router();

/* ──────────── 认证路由（公开） ──────────── */
router.use(authRoutes);

/* ──────────── 公开页面路由（前台） ──────────── */

router.get('/', getHome);
router.get('/home', getHome);       // 首页别名
router.get('/courses', getCourses); // 课程展示页
router.get('/contact', getContact); // 联系我们（含订阅表单）

/* ──────────── 表单处理（前台） ──────────── */
// 访客通过 /contact 页面的表单订阅
router.post('/subscribe', postSubscribe);

/* ──────────── 用户自我资料（仅登录） ──────────── */
// 普通用户看自己的资料，管理员可看任意用户的资料（复用 show.ejs + readOnly）
router.get('/users/:id', ensureAuthenticated, getUserProfile);

/* ──────────── CRUD 管理路由（管理员后台） ──────────── */
//
// 注意：router.use('/admin/users', userRoutes) 会将 /admin/users 前缀
// 截去后传给 userRoutes，所以 userRoutes 内部的 '/' 实际对应 /admin/users。
//
// 路由顺序提示：
// userRoutes 中 '/new' 必须在 '/:id' 前注册（Express 从上到下匹配，先到先得），
// 否则 '/new' 会被 '/:id' 当作 id='new' 吃掉。
router.use('/admin/users', ensureAuthenticated, isAdmin, userRoutes);
router.use('/admin/courses', ensureAuthenticated, isAdmin, courseRoutes);
router.use('/admin/subscribers', ensureAuthenticated, isAdmin, subscriberRoutes);

export default router;
