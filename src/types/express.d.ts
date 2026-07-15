import 'express';
import 'express-session';

/* ================================================================================
 * Express 类型扩展
 * ================================================================================
 * 为 connect-flash 和 returnTo 重定向功能补充类型声明。
 * ================================================================================ */

declare module 'express-session' {
  interface SessionData {
    /** 登录成功后跳回的原目标页面路径 */
    returnTo?: string;
  }
}

declare module 'express' {
  interface Request {
    /**
     * connect-flash 的类型签名：
     * - flash('error')          → 读取所有 error 消息（字符串数组）
     * - flash('error', 'msg')   → 写入一条 error 消息
     */
    flash(type: string, message?: string): string[];
    flash(type: string, message: string): number;
  }
}
