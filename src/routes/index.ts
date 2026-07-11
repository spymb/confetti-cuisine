import { Router } from 'express';
import {
  getHome,
  getCourses,
  getContact,
  postSubscribe,
  getSubscribers,
} from '../controllers/homeController.js';

const router = Router();

/* ──────────── GET 路由 ──────────── */

router.get('/', getHome);
router.get('/home', getHome); // /home 别名，重定向到首页逻辑
router.get('/courses', getCourses);
router.get('/contact', getContact);

/* ──────────── POST 路由 ──────────── */

router.post('/subscribe', postSubscribe);
router.get('/subscribers', getSubscribers);

export default router;
