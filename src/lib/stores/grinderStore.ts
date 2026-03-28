/**
 * 磨豆机状态管理 - 使用 Zustand + API 实现
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { grindersAPI } from '@/lib/api/client';
import { nanoid } from 'nanoid';

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

interface GrinderState {
  grinders: Grinder[];
  initialized: boolean;
  isLoading: boolean;
  currentSyncState: {
    grinderId: string | null;
    isSyncEnabled: boolean;
  };
  initialize: () => Promise<void>;
  addGrinder: (grinder: Omit<Grinder, 'id'>) => Promise<Grinder>;
  updateGrinder: (id: string, updates: Partial<Grinder>) => Promise<void>;
  deleteGrinder: (id: string) => Promise<void>;
  setGrinders: (grinders: Grinder[]) => Promise<void>;
  updateGrinderScaleByName: (name: string, scale: string) => Promise<void>;
  setSyncState: (grinderId: string | null, isSyncEnabled: boolean) => void;
  resetSyncState: () => void;
  refreshGrinders: () => Promise<void>;
}

/**
 * 同步磨豆机刻度到设置（辅助函数）
 */
export function syncGrinderScale(
  grindSize: string,
  grinderName?: string,
  ...context: unknown[]
): void {
  // 此函数用于向后兼容，实际同步逻辑由组件调用 updateGrinderScaleByName 处理
  console.log('[syncGrinderScale]', grindSize, grinderName, ...context);
}

export function parseGrinderFromGrindSize(
  grindSize: string,
  grinderNames: string[]
): { grinderName: string; scale: string } | null {
  if (!grindSize || grinderNames.length === 0) return null;
  const sortedNames = [...grinderNames].sort((a, b) => b.length - a.length);
  for (const name of sortedNames) {
    if (grindSize.startsWith(name)) {
      const remainder = grindSize.slice(name.length).trim();
      const scale = remainder.replace(/^[·\s]+/, '').trim();
      if (scale) return { grinderName: name, scale };
    }
  }
  return null;
}

export const useGrinderStore = create<GrinderState>()(
  subscribeWithSelector((set, get) => ({
    grinders: [],
    initialized: false,
    isLoading: false,
    currentSyncState: { grinderId: null, isSyncEnabled: false },

    initialize: async () => {
      if (get().initialized) return;
      try {
        const grinders = await grindersAPI.list();
        set({ grinders, initialized: true });
      } catch (e) {
        console.error('[GrinderStore] initialize failed:', e);
        set({ initialized: true });
      }
    },

    addGrinder: async grinderData => {
      const newGrinder: Grinder = {
        ...grinderData,
        id: nanoid(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const created = await grindersAPI.create(newGrinder);
      set(state => ({ grinders: [...state.grinders, created] }));
      return created;
    },

    updateGrinder: async (id, updates) => {
      const updated = await grindersAPI.update(id, { ...updates, updatedAt: Date.now() });
      set(state => ({
        grinders: state.grinders.map(g => (g.id === id ? updated : g)),
      }));
    },

    deleteGrinder: async id => {
      await grindersAPI.delete(id);
      set(state => ({ grinders: state.grinders.filter(g => g.id !== id) }));
    },

    setGrinders: async grinders => {
      set({ grinders });
    },

    updateGrinderScaleByName: async (name, scale) => {
      const { grinders } = get();
      const grinder = grinders.find(g => g.name === name);
      if (grinder) {
        const grindSize = `${name} ${scale}`;
        const historyEntry: GrindSizeHistory = {
          grindSize,
          timestamp: Date.now(),
        };
        const history = grinder.grindSizeHistory || [];
        const newHistory = [historyEntry, ...history].slice(0, 10);
        await get().updateGrinder(grinder.id, {
          currentGrindSize: grindSize,
          grindSizeHistory: newHistory,
        });
      }
    },

    setSyncState: (grinderId, isSyncEnabled) => {
      set({ currentSyncState: { grinderId, isSyncEnabled } });
    },

    resetSyncState: () => {
      set({ currentSyncState: { grinderId: null, isSyncEnabled: false } });
    },

    refreshGrinders: async () => {
      try {
        const grinders = await grindersAPI.list();
        set({ grinders });
      } catch (e) {
        console.error('[GrinderStore] refreshGrinders failed:', e);
      }
    },
  }))
);

// 获取 store 实例的辅助函数
export const getGrinderStore = () => useGrinderStore.getState();
