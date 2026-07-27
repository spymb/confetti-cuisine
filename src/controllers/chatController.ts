import { Request, Response } from 'express';

/* ================================================================================
 * 聊天室控制器
 * ================================================================================
 * 极简控制器 — 不传任何用户数据到模板。
 * 用户身份通过 Socket.io 握手从 session 解析，遵循"禁止将用户信息
 * 放在前端隐藏域或 JS 变量中"的安全要求。
 * ================================================================================ */

export function getChat(req: Request, res: Response): void {
  res.render('chat', {
    title: '聊天室',
    currentPage: 'chat',
    // 聊天页面使用 ES Module 加载 chat.js，不加载默认的 main.js
    pageScript: {
      src: '/public/js/chat.js',
      type: 'module',
    },
  });
}
