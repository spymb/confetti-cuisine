import { Router } from 'express';
import {
  getIndex,
  getNew,
  // postCreate,  // 已移除：用户创建由 /register 接管，管理员不再代建账号
  getShow,
  getEdit,
  putUpdate,
  deleteRemove,
} from '../controllers/userController.js';

/* ================================================================================
 * User 子路由 — RESTful 六动作映射（原七动作，移除 POST / 创建）
 * ================================================================================
 * 挂载在 /admin/users（由主路由 index.ts 的 router.use 处理前缀）。
 *
 * 路由顺序是关键：'/'、'/new' 等固定路径必须在 '/:id' 之前，
 * 否则 Express 会将 'new' 匹配为 :id 参数，导致 /new 永远不可达。
 *
 * 六个标准动作：
 *   GET    /          → index    （列表）
 *   GET    /new       → new      （新建表单 — 保留路由但页面不再链接至此）
 *   GET    /:id       → show     （详情）
 *   GET    /:id/edit  → edit     （编辑表单）
 *   PUT    /:id       → update   （更新）  ← AJAX JSON
 *   DELETE /:id       → destroy  （删除）  ← AJAX JSON，真删除
 *
 * 已移除路由：
 *   POST / → 由 GET/POST /register 接管用户创建
 * ================================================================================ */

const router = Router();

router.get('/', getIndex);
router.get('/new', getNew);       // ← 固定路径，必须在 /:id 前！（保留以备将来恢复）
// router.post('/', postCreate);  // 已移除：用户创建由 /register 接管
router.get('/:id', getShow);
router.get('/:id/edit', getEdit);
router.put('/:id', putUpdate);    // PUT：HTML 表单不支持，必须 AJAX 发送
router.delete('/:id', deleteRemove); // DELETE：同上

export default router;
