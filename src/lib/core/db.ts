/**
 * Database Layer - 使用 SQLite Backend API
 * 
 * 此文件保持与原 Dexie 接口兼容，但底层改为 HTTP API 调用
 */

import { BrewingNote, Method, CustomEquipment } from './config';
import { CoffeeBean } from '@/types/app';
import {
  beansAPI,
  notesAPI,
  grindersAPI,
  settingsAPI,
  equipmentsAPI,
  methodsAPI,
  reportsAPI,
} from '@/lib/api/client';

// ========== 类型定义 ==========

export interface GrindSizeHistory {
  grindSize: string;
  timestamp: number;
  equipment?: string;
  method?: string;
  coffeeBean?: string;
}

export interface Grinder {
  id: string;
  name: string;
  currentGrindSize?: string;
  grindSizeHistory?: GrindSizeHistory[];
  createdAt?: number;
  updatedAt?: number;
}

export interface YearlyReport {
  id: string;
  year: number;
  username: string;
  content: string;
  createdAt: number;
}

export interface FlavorDimension {
  id: string;
  label: string;
  order: number;
  isDefault: boolean;
}

export interface RoasterFlavorPeriod {
  light: { startDay: number; endDay: number };
  medium: { startDay: number; endDay: number };
  dark: { startDay: number; endDay: number };
}

export interface RoasterConfig {
  roasterName: string;
  logoData?: string;
  flavorPeriod?: RoasterFlavorPeriod;
  updatedAt: number;
}

export const DEFAULT_FLAVOR_DIMENSIONS: FlavorDimension[] = [
  { id: 'acidity', label: '酸度', order: 0, isDefault: true },
  { id: 'sweetness', label: '甜度', order: 1, isDefault: true },
  { id: 'bitterness', label: '苦度', order: 2, isDefault: true },
  { id: 'body', label: '口感', order: 3, isDefault: true },
];

export interface AppSettings {
  notificationSound: boolean;
  hapticFeedback: boolean;
  textZoomLevel: number;
  showFlowRate: boolean;
  username: string;
  decrementPresets: number[];
  enableAllDecrementOption: boolean;
  enableCustomDecrementInput: boolean;
  dateDisplayMode: 'date' | 'flavorPeriod' | 'agingDays';
  showFlavorInfo: boolean;
  showBeanNotes: boolean;
  [key: string]: any;
}

// 为了兼容旧代码，导出 SettingsOptions 作为 AppSettings 的别名
export type SettingsOptions = AppSettings;

// ========== 模拟 Dexie 接口 ==========

class TableWrapper<T> {
  constructor(private api: any) {}

  async toArray(): Promise<T[]> {
    return this.api.list();
  }

  async get(id: string): Promise<T | undefined> {
    try {
      return await this.api.get(id);
    } catch {
      return undefined;
    }
  }

  async put(item: T): Promise<T> {
    const id = (item as any).id;
    try {
      return await this.api.update(id, item);
    } catch {
      return await this.api.create(item);
    }
  }

  async delete(id: string): Promise<void> {
    await this.api.delete(id);
  }

  async bulkPut(items: T[]): Promise<void> {
    for (const item of items) await this.put(item);
  }

  async count(): Promise<number> {
    const items = await this.api.list();
    return items.length;
  }

  async clear(): Promise<void> {
    const items = await this.api.list();
    for (const item of items) {
      await this.api.delete((item as any).id);
    }
  }
}

// ========== 主数据库类 ==========

export class BrewGuideDB {
  brewingNotes = new TableWrapper<BrewingNote>(notesAPI);
  coffeeBeans = new TableWrapper<CoffeeBean>(beansAPI);
  customEquipments = new TableWrapper<CustomEquipment>(equipmentsAPI);
  customMethods = new TableWrapper<{ equipmentId: string; methods: Method[] }>({
    list: async () => {
      const methods = await methodsAPI.list();
      const grouped: Record<string, Method[]> = {};
      for (const m of methods) {
        if (!grouped[m.equipmentId]) grouped[m.equipmentId] = [];
        grouped[m.equipmentId].push(m);
      }
      return Object.entries(grouped).map(([equipmentId, methods]) => ({ equipmentId, methods }));
    },
    get: async (id: string) => {
      const methods = await methodsAPI.byEquipment(id);
      return { equipmentId: id, methods };
    },
    create: async (item: any) => item,
    update: async (id: string, item: any) => item,
    delete: async (id: string) => {},
  });
  grinders = new TableWrapper<Grinder>(grindersAPI);
  yearlyReports = new TableWrapper<YearlyReport>(reportsAPI);
  appSettings = new TableWrapper<{ id: string; data: AppSettings }>({
    list: async () => {
      const data = await settingsAPI.get();
      return [{ id: 'main', data }];
    },
    get: async (id: string) => {
      const data = await settingsAPI.get();
      return { id, data };
    },
    create: async (item: any) => {
      await settingsAPI.update(item.data);
      return item;
    },
    update: async (id: string, item: any) => {
      await settingsAPI.update(item.data || item);
      return { id, data: item.data || item };
    },
    delete: async () => {},
  });
  settings = new TableWrapper<{ key: string; value: string }>({
    list: async () => [],
    get: async (key: string) => {
      const data = await settingsAPI.get();
      return { key, value: JSON.stringify(data[key]) };
    },
    create: async (item: any) => item,
    update: async (key: string, item: any) => {
      const data = await settingsAPI.get();
      await settingsAPI.update({ ...data, [key]: JSON.parse(item.value) });
      return item;
    },
    delete: async () => {},
  });
  pendingOperations = new TableWrapper<any>({
    list: async () => [],
    get: async () => undefined,
    create: async (item: any) => item,
    update: async (_: string, item: any) => item,
    delete: async () => {},
  });

  async open(): Promise<void> {
    // API 不需要显式打开连接
    console.log('[DB] API mode initialized');
  }
}

// 单例导出
export const db = new BrewGuideDB();

// ========== 工具方法 ==========

export const dbUtils = {
  async initialize(): Promise<void> {
    console.log('[DB] SQLite API mode');
  },

  async migrateFromLocalStorage(): Promise<boolean> {
    // API 模式不需要从 localStorage 迁移
    return true;
  },

  async clearAllData(): Promise<void> {
    // 谨慎：这会删除所有数据
    const beans = await beansAPI.list();
    for (const b of beans) await beansAPI.delete(b.id);
    
    const notes = await notesAPI.list();
    for (const n of notes) await notesAPI.delete(n.id);
    
    const equipments = await equipmentsAPI.list();
    for (const e of equipments) await equipmentsAPI.delete(e.id);
    
    const methods = await methodsAPI.list();
    for (const m of methods) await methodsAPI.delete(m.id);
    
    const grinders = await grindersAPI.list();
    for (const g of grinders) await grindersAPI.delete(g.id);
    
    await settingsAPI.update({});
  },

  async logStorageInfo(): Promise<void> {
    const beans = await beansAPI.list();
    const notes = await notesAPI.list();
    console.log(`[DB] Beans: ${beans.length}, Notes: ${notes.length}`);
  },
};
