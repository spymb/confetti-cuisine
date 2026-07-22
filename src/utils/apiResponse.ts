/* ================================================================================
 * API 统一响应格式
 * ================================================================================
 * 所有 API 端点返回统一的 JSON 结构：
 *   { code: number, message: string, data: T | null }
 *
 * code = 0 表示成功，非 0 表示失败（对应 HTTP 状态码）。
 * ================================================================================ */

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T | null;
}

/** 成功响应 */
export function success<T>(data: T, message = 'success'): ApiResponse<T> {
  return { code: 0, message, data };
}

/** 错误响应 */
export function error(code: number, message: string): ApiResponse<null> {
  return { code, message, data: null };
}
