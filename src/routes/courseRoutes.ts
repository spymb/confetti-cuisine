import { Router } from 'express';
import {
  getIndex,
  getNew,
  postCreate,
  getShow,
  getEdit,
  putUpdate,
  deleteRemove,
} from '../controllers/courseController.js';

/* ================================================================================
 * Course 子路由 — RESTful 七动作映射
 * ================================================================================
 * 挂载在 /admin/courses。结构与 userRoutes 完全一致，
 * 体现了约定优于配置的设计原则。
 *
 * 注意：与前台 /courses（getCourses）不是一回事 ——
 * 前台是访客浏览的课程展示，后台 /admin/courses 是管理员 CRUD。
 * ================================================================================ */

const router = Router();

router.get('/', getIndex);
router.get('/new', getNew);
router.post('/', postCreate);
router.get('/:id', getShow);
router.get('/:id/edit', getEdit);
router.put('/:id', putUpdate);
router.delete('/:id', deleteRemove);

export default router;
