import { Router } from 'express';
import {
  getLogin,
  postLogin,
  getRegister,
  postRegister,
  getLogout,
} from '../controllers/authController.js';

/* ================================================================================
 * 认证路由 — 登录 / 注册 / 登出
 * ================================================================================
 * 挂载在根路径 /（由主路由 index.ts 的 router.use 处理）。
 * 全部公开访问，无需任何中间件保护。
 * ================================================================================ */

const router = Router();

router.get('/login', getLogin);
router.post('/login', postLogin);
router.get('/register', getRegister);
router.post('/register', postRegister);
router.get('/logout', getLogout);

export default router;
