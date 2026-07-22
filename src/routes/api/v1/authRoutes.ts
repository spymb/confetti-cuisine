import { Router } from 'express';
import {
  postLogin,
  getToken,
} from '../../../controllers/api/authController.js';
import { requireSession } from '../../../middleware/apiAuth.js';

/* ================================================================================
 * 认证 API 路由 — /api/v1/auth
 * ================================================================================ */

const router = Router();

// POST /api/v1/auth/login — 外部客户端登录（返回 JWT）
router.post('/login', postLogin);

// GET /api/v1/auth/token — Session 换 JWT（网页 JS 桥接，需 Session 认证）
router.get('/token', requireSession, getToken);

export default router;
