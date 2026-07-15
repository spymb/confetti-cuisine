import { ZodError } from 'zod';

/* ================================================================================
 * Zod 错误格式化工具
 * ================================================================================
 * Zod 原生错误结构包含多层嵌套，这里提取为前端可直接消费的 {field, message} 数组，
 * 其中 field 对应表单字段名，用于在对应输入框旁定位显示错误消息。
 *
 * 原先四个控制器各有一份私有副本，现在统一为 import 共享实现。
 * ================================================================================ */

export function formatZodError(err: ZodError): Array<{ field: string; message: string }> {
  return err.issues.map((e) => ({
    field: e.path.join('.'),  // path 可能是 ['address','zipCode']，用 . 连接
    message: e.message,
  }));
}
