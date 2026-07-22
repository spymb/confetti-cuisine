import { Router } from 'express';
import {
  getCourses,
  getCourse,
  postEnroll,
} from '../../../controllers/api/courseController.js';
import { requireJWT } from '../../../middleware/apiAuth.js';

/* ================================================================================
 * 课程 API 路由 — /api/v1/courses
 * ================================================================================ */

const router = Router();

// GET /api/v1/courses — 公开课程列表
router.get('/', getCourses);

// GET /api/v1/courses/:id — 课程详情
router.get('/:id', getCourse);

// POST /api/v1/courses/:id/enroll — 报名课程（需 JWT）
router.post('/:id/enroll', requireJWT, postEnroll);

export default router;
