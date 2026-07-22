/* ================================================================================
 * 缤纷厨房 — 前端交互（原生 Fetch + 模态框 + JWT Token 按需加载）
 * ================================================================================
 * - 按需从 /api/v1/auth/token 获取 JWT → sessionStorage
 * - apiFetch 封装所有 API 调用（自动带 Authorization 头）
 * - 课程模态框：打开时并行获取课程列表 + 报名状态
 * ================================================================================ */

/* ── Token 管理 ── */

/**
 * 按需获取 JWT token：先查 sessionStorage，miss 时请求服务端 Session 换取。
 * 未登录或 Session 过期 → 返回 null。
 */
async function ensureToken() {
  const cached = sessionStorage.getItem('jwt_token');
  if (cached) return cached;

  try {
    const resp = await fetch('/api/v1/auth/token'); // 自动带 Session Cookie
    const result = await resp.json();
    if (result.code === 0) {
      sessionStorage.setItem('jwt_token', result.data.token);
      return result.data.token;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 通用 API 调用封装。
 * - 自动获取 token 并带 Authorization 头
 * - 401 → 跳转登录页
 * - 返回解析后的 JSON
 */
async function apiFetch(path, options = {}) {
  const token = await ensureToken();
  if (!token) {
    window.location.href = '/login';
    return { code: 401, message: '未登录', data: null };
  }

  const resp = await fetch('/api/v1' + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
      ...options.headers,
    },
  });

  if (resp.status === 401) {
    sessionStorage.removeItem('jwt_token');
    window.location.href = '/login';
    return { code: 401, message: '未登录', data: null };
  }

  return resp.json();
}

/* ── 模态框 ── */

/**
 * 打开课程浏览模态框。
 * 并行请求：课程列表 + 当前用户已报名课程（决定按钮状态）。
 */
async function openCourseModal() {
  const modal = document.getElementById('courseModal');
  const list = document.getElementById('modalCourseList');
  modal.classList.remove('hidden');
  list.innerHTML = '<p class="text-warm-muted col-span-2 text-center py-8">加载中…</p>';

  // 并行获取数据
  const [coursesResult, meResult] = await Promise.all([
    fetch('/api/v1/courses').then(r => r.json()),
    apiFetch('/users/me').catch(() => ({ code: 401, data: null })),
  ]);

  const courses = coursesResult.data || [];
  const enrolledIds = meResult.data?.enrolledCourses
    ? meResult.data.enrolledCourses.map(c => (typeof c === 'object' ? c._id : c))
    : [];

  if (courses.length === 0) {
    list.innerHTML = '<p class="text-warm-muted col-span-2 text-center py-8">暂无课程。</p>';
    return;
  }

  list.innerHTML = courses
    .map(course => {
      const enrolled = enrolledIds.includes(course._id);
      const btnHtml = enrolled
        ? '<span class="inline-block px-3 py-2 rounded text-sm font-medium bg-gray-200 text-gray-500 cursor-not-allowed">已报名</span>'
        : `<button onclick="handleEnroll('${course._id}', this)" class="inline-block px-3 py-2 rounded text-sm font-medium bg-brand text-white hover:bg-brand-dark transition-colors cursor-pointer border-none">立即报名</button>`;

      return `
        <div class="bg-white rounded-lg shadow p-5 border-t-4 border-brand">
          <h3 class="text-brand font-bold text-lg mb-2">${escapeHtml(course.title)}</h3>
          <p class="text-warm-muted text-sm mb-3">${escapeHtml(course.description)}</p>
          <div class="flex items-center gap-3 flex-wrap">
            <span class="inline-block px-3 py-1 bg-brand-light text-brand rounded-full text-xs font-medium">${escapeHtml(course.duration)}</span>
            <span class="text-brand font-bold">¥${course.cost}</span>
            ${btnHtml}
          </div>
        </div>`;
    })
    .join('');
}

/** 关闭模态框 */
function closeCourseModal() {
  document.getElementById('courseModal').classList.add('hidden');
}

/** HTML 转义（防 XSS） */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** 报名课程 */
async function handleEnroll(courseId, btn) {
  btn.disabled = true;
  btn.textContent = '报名中…';

  const result = await apiFetch(`/courses/${courseId}/enroll`, { method: 'POST' });

  if (result.code === 0) {
    // 成功后替换为"已报名"状态
    btn.outerHTML = '<span class="inline-block px-3 py-2 rounded text-sm font-medium bg-gray-200 text-gray-500 cursor-not-allowed">已报名</span>';
    // 同步刷新"我的课程"页（如果用户当前在那边则标记）
    sessionStorage.setItem('my_courses_stale', '1');
  } else {
    btn.disabled = false;
    btn.textContent = '立即报名';
    alert(result.message || '报名失败，请重试');
  }
}

/* ── 初始化 ── */

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('courseModal');
  if (!modal) return;

  // 点击遮罩关闭
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeCourseModal();
  });

  // Escape 键关闭
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeCourseModal();
    }
  });
});
