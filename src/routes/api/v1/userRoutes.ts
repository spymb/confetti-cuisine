import { Router } from 'express';
import { getMe } from '../../../controllers/api/userController.js';
import { requireJWT } from '../../../middleware/apiAuth.js';

/* ================================================================================
 * 用户 API 路由 — /api/v1/users
 * ================================================================================ */

const router = Router();

// GET /api/v1/users/me — 当前用户信息（需 JWT）
router.get('/me', requireJWT, getMe);

export default router;
