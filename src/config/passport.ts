import mongoose from 'mongoose';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import User from '../models/User.js';

/* ================================================================================
 * Passport 本地策略配置
 * ================================================================================
 * 使用 email 作为登录凭据（而非 username），bcrypt 校验密码。
 * 序列化：只存 _id 到会话 cookie，最小化会话存储。
 * 反序列化：从数据库重建用户对象挂到 req.user，每次请求触发一次。
 * ================================================================================ */

/* ── 扩展 Express.User 类型 ──
 * 告诉 TypeScript req.user 上有什么字段，后续中间件和控制器不用再类型断言。
 */
declare global {
  namespace Express {
    interface User {
      _id: mongoose.Types.ObjectId;
      name: string;
      email: string;
      role: 'admin' | 'user';
    }
  }
}

/* ── 本地策略 ──
 * usernameField: 'email' — 用邮箱字段作为"用户名"。
 * done(systemErr, user | false, options?) — Passport 的标准回调模式：
 *   - done(null, user)   → 认证成功，user 进入序列化管线
 *   - done(null, false)  → 认证失败（密码错/用户不存在）
 *   - done(err)          → 系统错误
 */
passport.use(
  new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email, password, done) => {
      try {
        console.log('[LocalStrategy] 邮箱:', email, '密码长度:', password?.length);
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        console.log('[LocalStrategy] 用户存在:', !!user, '密码字段存在:', !!user?.password);
        if (!user) {
          return done(null, false, { message: '邮箱或密码错误' });
        }

        const isMatch = await user.comparePassword(password);
        console.log('[LocalStrategy] 密码匹配:', isMatch);
        if (!isMatch) {
          return done(null, false, { message: '邮箱或密码错误' });
        }

        return done(null, user);
      } catch (err) {
        console.error('[LocalStrategy] 异常:', (err as Error).message);
        return done(err);
      }
    },
  ),
);

/* ── 序列化：user → session ──
 * 只存 _id，会话数据越小越好。
 */
passport.serializeUser((user, done) => {
  done(null, user._id);
});

/* ── 反序列化：session → user ──
 * 每次请求从数据库用 _id 重建 user，.lean() 返回普通对象（不需要 Document 方法）。
 */
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id).lean();
    done(null, user);
  } catch (err) {
    done(err);
  }
});

export default passport;
