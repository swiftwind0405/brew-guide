/**
 * Legacy Bridge - 兼容层，让现有代码逐步迁移到 API
 * 
 * 使用方式：
 * 1. 新代码直接用 src/lib/api/client.ts
 * 2. 旧 store 逐步替换为此 bridge
 * 3. 完全迁移后删除此文件
 */

import { beansAPI, notesAPI, grindersAPI, settingsAPI, equipmentsAPI, methodsAPI } from './client';

// 模拟 Dexie 接口的桥接
export const dbBridge = {
  coffeeBeans: {
    toArray: async () => beansAPI.list(),
    get: async (id: string) => beansAPI.get(id),
    put: async (bean: any) => {
      const existing = await beansAPI.list().then(list => list.find(b => b.id === bean.id));
      if (existing) {
        return beansAPI.update(bean.id, bean);
      }
      return beansAPI.create(bean);
    },
    delete: async (id: string) => { await beansAPI.delete(id); return id; },
    bulkPut: async (beans: any[]) => {
      for (const bean of beans) await dbBridge.coffeeBeans.put(bean);
    },
    count: async () => beansAPI.list().then(list => list.length),
  },

  brewingNotes: {
    toArray: async () => notesAPI.list(),
    get: async (id: string) => notesAPI.get(id),
    put: async (note: any) => {
      try {
        return await notesAPI.update(note.id, note);
      } catch {
        return notesAPI.create(note);
      }
    },
    delete: async (id: string) => { await notesAPI.delete(id); return id; },
    bulkPut: async (notes: any[]) => {
      for (const note of notes) await dbBridge.brewingNotes.put(note);
    },
    count: async () => notesAPI.list().then(list => list.length),
  },

  grinders: {
    toArray: async () => grindersAPI.list(),
    get: async (id: string) => grindersAPI.get(id),
    put: async (grinder: any) => {
      try {
        return await grindersAPI.update(grinder.id, grinder);
      } catch {
        return grindersAPI.create(grinder);
      }
    },
    delete: async (id: string) => { await grindersAPI.delete(id); return id; },
    bulkPut: async (grinders: any[]) => {
      for (const g of grinders) await dbBridge.grinders.put(g);
    },
    count: async () => grindersAPI.list().then(list => list.length),
  },

  appSettings: {
    get: async (id: string) => {
      const data = await settingsAPI.get();
      return { id, data };
    },
    put: async (setting: { id: string; data: any }) => settingsAPI.update(setting.data),
  },


  settings: {
    get: async (key: string) => {
      const data = await settingsAPI.get();
      return { key, value: JSON.stringify(data[key]) };
    },
    put: async (item: { key: string; value: string }) => {
      const data = await settingsAPI.get();
      await settingsAPI.update({ ...data, [item.key]: JSON.parse(item.value) });
    },
    delete: async (key: string) => {
      const data = await settingsAPI.get();
      delete data[key];
      await settingsAPI.update(data);
    },
  },

  customEquipments: {
    toArray: async () => equipmentsAPI.list(),
    get: async (id: string) => equipmentsAPI.list().then(list => list.find(e => e.id === id)),
    put: async (eq: any) => {
      try {
        return await equipmentsAPI.update(eq.id, eq);
      } catch {
        return equipmentsAPI.create(eq);
      }
    },
    delete: async (id: string) => { await equipmentsAPI.delete(id); return id; },
    bulkPut: async (eqs: any[]) => {
      for (const eq of eqs) await dbBridge.customEquipments.put(eq);
    },
  },

  customMethods: {
    toArray: async () => methodsAPI.list(),
    get: async (id: string) => methodsAPI.list().then(list => list.find(m => m.id === id)),
    put: async (method: any) => {
      try {
        return await methodsAPI.update(method.id, method);
      } catch {
        return methodsAPI.create(method);
      }
    },
    delete: async (id: string) => { await methodsAPI.delete(id); return id; },
    bulkPut: async (methods: any[]) => {
      for (const m of methods) await dbBridge.customMethods.put(m);
    },
  },
};

// 导出快捷方式
export { beansAPI, notesAPI, grindersAPI, settingsAPI, equipmentsAPI, methodsAPI, reportsAPI, backupAPI, healthAPI } from './client';
