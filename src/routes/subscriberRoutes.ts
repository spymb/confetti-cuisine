import { Router } from 'express';
import {
  getIndex,
  getNew,
  postCreate,
  getShow,
  getEdit,
  putUpdate,
  deleteRemove,
} from '../controllers/subscriberController.js';

/* ================================================================================
 * Subscriber 子路由 — RESTful 七动作映射
 * ================================================================================
 * 挂载在 /admin/subscribers。三个子路由文件结构完全一致。
 *
 * 注意：不与前台 POST /subscribe 冲突 ——
 * POST /subscribe         → homeController.postSubscribe（访客订阅）
 * POST /admin/subscribers → subscriberController.postCreate（管理员新建）
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
