/**
 * 咖啡豆相关工具函数
 */

import type {
  CoffeeBean,
  PendingCoffeeBean,
  SelectableCoffeeBean,
} from '@/types/app';

const FLAVOR_SPLIT_REGEX = /[\n,，、;；]+/;

/**
 * 类型守卫：判断是否为待创建的咖啡豆
 * 待创建的咖啡豆没有 id，且有 isPending 标记
 */
export function isPendingCoffeeBean(
  bean: SelectableCoffeeBean | null | undefined
): bean is PendingCoffeeBean {
  if (!bean) return false;
  return 'isPending' in bean && bean.isPending === true && !bean.id;
}

/**
 * 类型守卫：判断是否为已持久化的咖啡豆
 */
export function isPersistedCoffeeBean(
  bean: SelectableCoffeeBean | null | undefined
): bean is CoffeeBean {
  if (!bean) return false;
  return typeof bean.id === 'string' && bean.id.length > 0;
}

/**
 * 创建一个待创建的咖啡豆对象
 * @param name 咖啡豆名称
 */
export function createPendingBean(name: string): PendingCoffeeBean {
  return {
    name: name.trim(),
    isPending: true,
  };
}

/**
 * 从冲煮参数中提取咖啡用量（克）
 * @param coffeeParam 咖啡参数字符串，如 "15g" 或 "15"
 * @returns 提取的数值，如果无法解析则返回 0
 */
export function extractCoffeeAmount(coffeeParam: string | undefined): number {
  if (!coffeeParam) return 0;
  const match = coffeeParam.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * 将任意格式的风味字段规范为字符串数组
 */
export function normalizeFlavorList(flavor: unknown): string[] {
  if (Array.isArray(flavor)) {
    return flavor
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean);
  }

  if (typeof flavor === 'string') {
    const normalized = flavor.trim();
    if (!normalized) return [];

    return normalized
      .split(FLAVOR_SPLIT_REGEX)
      .map(item => item.trim())
      .filter(Boolean);
  }

  if (flavor && typeof flavor === 'object') {
    const entries = Object.entries(flavor as Record<string, unknown>);
    const isArrayLikeObject =
      entries.length > 0 && entries.every(([key]) => /^\d+$/.test(key));

    if (isArrayLikeObject) {
      return normalizeFlavorList(entries.map(([, value]) => value));
    }
  }

  return [];
}

/**
 * 判断风味字段是否需要修复
 */
export function hasInvalidFlavorValue(flavor: unknown): boolean {
  if (flavor === undefined) return false;
  if (!Array.isArray(flavor)) return true;

  const normalized = normalizeFlavorList(flavor);
  if (normalized.length !== flavor.length) return true;

  return normalized.some((item, index) => item !== flavor[index]);
}

/**
 * 规范化咖啡豆对象，避免历史或导入数据中的异常字段导致界面报错
 */
export function normalizeCoffeeBean<T extends { flavor?: unknown }>(
  bean: T,
  options?: { ensureFlavorArray?: boolean }
): T {
  if (bean.flavor === undefined && !options?.ensureFlavorArray) {
    return bean;
  }

  return {
    ...bean,
    flavor: normalizeFlavorList(bean.flavor),
  };
}

/**
 * 批量规范化咖啡豆数据
 */
export function normalizeCoffeeBeans<T extends { flavor?: unknown }>(
  beans: T[],
  options?: { ensureFlavorArray?: boolean }
): T[] {
  return beans.map(bean => normalizeCoffeeBean(bean, options));
}
