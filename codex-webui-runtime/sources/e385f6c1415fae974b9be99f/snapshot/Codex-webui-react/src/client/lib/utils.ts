import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtDate(value?: number | string | null) {
  if (!value) return '未知时间';
  const date = new Date(typeof value === 'number' ? value : String(value));
  if (Number.isNaN(date.getTime())) return '未知时间';
  return date.toLocaleString('zh-CN', { hour12: false });
}

export function shortPath(value?: string | null) {
  if (!value) return '未选择项目';
  const parts = String(value).split(/[\\/]+/).filter(Boolean);
  if (parts.length <= 2) return value;
  return `${parts.at(-2)} / ${parts.at(-1)}`;
}

export function toKB(value?: number | null) {
  if (!value) return '0 KB';
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function textOf(value: unknown, fallback = '') {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
