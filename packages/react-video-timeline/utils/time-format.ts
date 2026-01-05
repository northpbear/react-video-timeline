/**
 * 格式化时间显示
 * @param seconds - 秒数
 * @returns 格式化后的时间字符串
 */
export function formatTime(seconds: number): string {
  if (seconds < 60) {
    return Math.floor(seconds).toString();
  }
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * 计算合适的刻度间隔
 * @param duration - 视频总时长（秒）
 * @returns 刻度间隔（秒）
 */
export function calculateScaleInterval(duration: number): number {
  if (duration <= 10) return 1;
  if (duration <= 30) return 5;
  if (duration <= 60) return 10;
  if (duration <= 300) return 30;
  return 60;
}

/**
 * 将秒数格式化为 mm:ss 格式
 * @param seconds - 秒数
 * @returns 格式化后的时间字符串
 */
export function formatTimeMMSS(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * 将秒数格式化为 mm:ss.xx 格式（精确到小数点后两位）
 * @param seconds - 秒数
 * @returns 格式化后的时间字符串
 */
export function formatTimePrecise(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const sInt = Math.floor(s);
  const sDecimal = Math.round((s - sInt) * 100)
    .toString()
    .padStart(2, '0');
  return `${m.toString().padStart(2, '0')}:${sInt.toString().padStart(2, '0')}.${sDecimal}`;
}

/**
 * 四舍五入到指定小数位
 * @param value - 数值
 * @param decimals - 小数位数
 */
export function roundToDecimals(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
