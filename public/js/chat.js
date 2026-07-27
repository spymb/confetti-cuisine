/* ================================================================================
 * 缤纷厨房 — 聊天室客户端（原生 ES Module + Socket.io）
 * ================================================================================
 * - 不依赖 jQuery，纯原生 Vanilla JS。
 * - 用户身份通过 socket 握手后服务端推送 chat:identity 获取，
 *   绝不在 HTML 模板或 JS 变量中硬编码用户信息。
 * - 跨标签页未读提示：非聊天页面收到消息时，通过 localStorage
 *   事件联动导航栏聊天图标闪烁（CSS Animation）。
 *
 * 本文件直接由浏览器加载（type="module"），必须是合法 JS，
 * 类型标注通过 JSDoc 提供，供 IDE 做类型检查（checkJs）。
 * ================================================================================ */

// @ts-check

/* ── Socket.io 客户端（ESM 构建，由服务端自动 serve） ── */
import { io } from '/socket.io/socket.io.esm.min.js';

/* ── 类型定义（与服务端事件负载对应） ── */

/**
 * @typedef {Object} ChatMessage
 * @property {string} _id
 * @property {string} userId
 * @property {string} userName
 * @property {string} content
 * @property {string} createdAt - ISO 时间字符串
 */

/* ── DOM 引用 ── */
const messagesEl = /** @type {HTMLElement} */ (document.getElementById('chat-messages'));
const formEl = /** @type {HTMLFormElement} */ (document.getElementById('chat-form'));
const inputEl = /** @type {HTMLInputElement} */ (document.getElementById('chat-input'));
const sendBtn = /** @type {HTMLButtonElement} */ (document.getElementById('chat-send-btn'));
const notificationEl = /** @type {HTMLElement} */ (document.getElementById('chat-notification'));
const onlineCountEl = /** @type {HTMLElement} */ (document.getElementById('online-count'));

/* ── 本地状态 ── */
/** @type {string | null} */
let myUserId = null;
let onlineCount = 1;

/* ── 常量 ── */
const STORAGE_KEY_UNREAD = 'confetti_chat_unread';

/* ════════════════════════════════════════════════════════════════
 * 跨标签页未读提示
 * ════════════════════════════════════════════════════════════════ */

/**
 * 在当前标签页触发闪烁动画。
 * 聊天页面自己收到消息时不闪烁（用户正在看），
 * 仅非聊天页面需要闪烁提醒。
 */
function triggerUnreadBlink() {
  // 如果当前页面就是聊天页，不清除未读但也不闪烁
  if (window.location.pathname === '/chat') return;

  // 写入时间戳触发其他标签页的 storage 事件
  localStorage.setItem(STORAGE_KEY_UNREAD, Date.now().toString());

  // 在当前标签页也闪烁（如果聊天图标存在）
  blinkChatIcon();
}

/** 对导航栏聊天链接添加闪烁动画 */
function blinkChatIcon() {
  // 查找导航栏中的聊天图标链接
  const chatLink = document.querySelector('a[href="/chat"]');
  if (!chatLink) return;

  chatLink.classList.add('chat-unread');
  // 点击聊天链接后移除闪烁
  chatLink.addEventListener(
    'click',
    () => {
      chatLink.classList.remove('chat-unread');
      localStorage.removeItem(STORAGE_KEY_UNREAD);
    },
    { once: true },
  );
}

/** 监听其他标签页的未读事件 */
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY_UNREAD && e.newValue) {
    blinkChatIcon();
  }
});

/** 进入聊天页面时清除未读 */
function clearUnread() {
  localStorage.removeItem(STORAGE_KEY_UNREAD);
  const chatLink = document.querySelector('a[href="/chat"]');
  if (chatLink) chatLink.classList.remove('chat-unread');
}

/* ════════════════════════════════════════════════════════════════
 * 渲染函数
 * ════════════════════════════════════════════════════════════════ */

/**
 * HTML 转义（防 XSS）
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * 格式化时间戳为中文可读格式
 * @param {string} iso - ISO 时间字符串
 * @returns {string}
 */
function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  /** @param {number} n */
  const pad = (n) => String(n).padStart(2, '0');

  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  // 同一天只显示时间
  if (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  ) {
    return time;
  }

  // 不同天显示完整日期
  return `${d.getMonth() + 1}/${d.getDate()} ${time}`;
}

/**
 * 渲染系统消息（居中、灰色）
 * @param {string} text
 */
function renderSystemMessage(text) {
  const el = document.createElement('div');
  el.className = 'flex justify-center py-1';
  el.innerHTML = `
    <span class="text-xs text-warm-muted bg-gray-100 rounded-full px-3 py-0.5">
      ${escapeHtml(text)}
    </span>`;
  messagesEl.appendChild(el);
  scrollToBottom();
}

/**
 * 渲染聊天消息气泡
 * @param {ChatMessage} msg
 */
function renderMessage(msg) {
  const isMine = msg.userId === myUserId;

  const el = document.createElement('div');
  el.className = `flex ${isMine ? 'justify-end' : 'justify-start'} animate-fade-in`;

  el.innerHTML = isMine
    ? /* ── 自己的消息（右对齐，brand 色） ── */
      `<div class="max-w-[70%]">
        <div class="bg-brand text-white rounded-2xl rounded-br-md px-4 py-2.5 shadow-sm">
          <p class="text-sm leading-relaxed whitespace-pre-wrap break-words">${escapeHtml(msg.content)}</p>
        </div>
        <p class="text-xs text-warm-muted text-right mt-1 mr-1">${formatTime(msg.createdAt)}</p>
      </div>`
    : /* ── 别人的消息（左对齐，灰色） ── */
      `<div class="max-w-[70%]">
        <p class="text-xs text-warm-muted ml-3 mb-1 font-medium">${escapeHtml(msg.userName)}</p>
        <div class="bg-white rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm border border-gray-100">
          <p class="text-sm leading-relaxed whitespace-pre-wrap break-words">${escapeHtml(msg.content)}</p>
        </div>
        <p class="text-xs text-warm-muted ml-3 mt-1">${formatTime(msg.createdAt)}</p>
      </div>`;

  messagesEl.appendChild(el);
  scrollToBottom();
}

/** 滚动到底部 */
function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/**
 * 显示临时通知（自动消失）
 * @param {string} text
 */
function showNotification(text) {
  notificationEl.textContent = text;
  notificationEl.classList.remove('hidden');
  setTimeout(() => {
    notificationEl.textContent = '';
    notificationEl.classList.add('hidden');
  }, 3000);
}

/* ════════════════════════════════════════════════════════════════
 * Socket.io 连接与事件
 * ════════════════════════════════════════════════════════════════ */

const socket = io({
  // 自动发送同源 cookie，reconnection 默认开启
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

/* ── 连接错误：未登录 ── */
socket.on('connect_error', (err) => {
  if (err.message === 'Unauthorized') {
    alert('请先登录后再访问聊天室。');
    window.location.href = '/login';
  } else {
    console.error('[聊天] 连接错误:', err.message);
  }
});

/* ── 收到身份信息（连接成功后第一条消息） ── */
socket.on('chat:identity', (data) => {
  myUserId = data.userId;
  clearUnread();
});

/* ── 历史消息加载 ── */
socket.on('chat:history', (messages) => {
  messagesEl.innerHTML = '';
  for (const msg of messages) {
    renderMessage(msg);
  }
});

/* ── 新消息 ── */
socket.on('chat:message', (msg) => {
  renderMessage(msg);

  // 如果当前标签页不可见，触发未读提示
  if (document.hidden) {
    triggerUnreadBlink();
  }
});

/* ── 用户加入 ── */
socket.on('chat:user-joined', (data) => {
  onlineCount++;
  onlineCountEl.textContent = String(onlineCount);
  renderSystemMessage(`${data.userName} 加入了聊天室`);
  showNotification(`${data.userName} 加入了聊天室`);
});

/* ── 用户离开 ── */
socket.on('chat:user-left', (data) => {
  onlineCount = Math.max(1, onlineCount - 1);
  onlineCountEl.textContent = String(onlineCount);
  renderSystemMessage(`${data.userName} 离开了聊天室`);
});

/* ════════════════════════════════════════════════════════════════
 * 发送消息
 * ════════════════════════════════════════════════════════════════ */

formEl.addEventListener('submit', (e) => {
  e.preventDefault();
  const content = inputEl.value.trim();
  if (!content) return;

  // 乐观禁用按钮防重复提交
  sendBtn.disabled = true;
  sendBtn.textContent = '发送中…';

  socket.emit('chat:message', { content }, (ack) => {
    sendBtn.disabled = false;
    sendBtn.textContent = '发送';

    if (ack.ok) {
      inputEl.value = '';
      inputEl.focus();
    } else {
      alert('发送失败，请重试');
    }
  });
});

/* ── Enter 发送（Shift+Enter 换行暂不支持，纯文本聊天） ── */
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    formEl.requestSubmit();
  }
});

/* ════════════════════════════════════════════════════════════════
 * 初始化
 * ════════════════════════════════════════════════════════════════ */

// 页面可见性变化时清理未读状态
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && window.location.pathname === '/chat') {
    clearUnread();
  }
});

// 页面卸载前清理
window.addEventListener('beforeunload', () => {
  clearUnread();
});

// 检测是否有挂起的未读消息（从其他标签页携带过来）
if (localStorage.getItem(STORAGE_KEY_UNREAD)) {
  clearUnread();
}

console.log('💬 聊天室客户端已就绪');
