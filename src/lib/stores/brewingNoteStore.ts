/**
 * 冲煮笔记 Store
 *
 * 架构：Store ↔ IndexedDB ↔ Supabase
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { BrewingNote } from '@/lib/core/config';
import { notesAPI } from '@/lib/api/client';
import { nanoid } from 'nanoid';

interface BrewingNoteStore {
  notes: BrewingNote[];
  isLoading: boolean;
  error: string | null;
  initialized: boolean;

  loadNotes: () => Promise<void>;
  addNote: (
    note: BrewingNote | Omit<BrewingNote, 'id'>
  ) => Promise<BrewingNote>;
  updateNote: (
    id: string,
    updates: Partial<BrewingNote>
  ) => Promise<BrewingNote | null>;
  deleteNote: (id: string) => Promise<boolean>;

  setNotes: (notes: BrewingNote[]) => void;
  upsertNote: (note: BrewingNote) => Promise<void>;
  removeNote: (id: string) => Promise<void>;

  getNoteById: (id: string) => BrewingNote | undefined;
  refreshNotes: () => Promise<void>;
}

export const useBrewingNoteStore = create<BrewingNoteStore>()(
  subscribeWithSelector((set, get) => ({
    notes: [],
    isLoading: false,
    error: null,
    initialized: false,

    loadNotes: async () => {
      if (get().isLoading) return;
      set({ isLoading: true, error: null });
      try {
        const notes = await notesAPI.list();
        set({ notes, isLoading: false, initialized: true });
      } catch (e) {
        console.error('[BrewingNoteStore] loadNotes failed:', e);
        set({ error: '加载笔记失败', isLoading: false, initialized: true });
      }
    },

    addNote: async noteData => {
      const inputNote = noteData as BrewingNote;
      const now = Date.now();
      const timestamp = inputNote.timestamp || now;
      const newNote: BrewingNote = {
        ...noteData,
        id: inputNote.id || nanoid(),
        timestamp,
        updatedAt: inputNote.updatedAt || timestamp,
      };

      const created = await notesAPI.create(newNote);
      set(state => ({ notes: [created, ...state.notes] }));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('brewingNoteDataChanged', {
            detail: { action: 'create', noteId: created.id, note: created },
          })
        );
      }
      return created;
    },

    updateNote: async (id, updates) => {
      const existingNote = get().notes.find(n => n.id === id);
      if (!existingNote) return null;

      // 检测需要移除的变动记录字段（显式设为 undefined 表示要删除）
      const shouldRemoveSource =
        'source' in updates && updates.source === undefined;
      const shouldRemoveQuickDecrement =
        'quickDecrementAmount' in updates &&
        updates.quickDecrementAmount === undefined;
      const shouldRemoveChangeRecord =
        'changeRecord' in updates && updates.changeRecord === undefined;

      const updatedNote: BrewingNote = {
        ...existingNote,
        ...updates,
        id,
        // 如果 updates 包含 timestamp，使用它（用户修改了记录时间）；否则保留原始创建时间
        timestamp:
          'timestamp' in updates && updates.timestamp !== undefined
            ? updates.timestamp
            : existingNote.timestamp,
        updatedAt: Date.now(), // 更新时间用于同步
      };

      // 移除变动记录字段
      if (shouldRemoveSource) delete (updatedNote as any).source;
      if (shouldRemoveQuickDecrement)
        delete (updatedNote as any).quickDecrementAmount;
      if (shouldRemoveChangeRecord) delete (updatedNote as any).changeRecord;

      const updated = await notesAPI.update(id, { ...updates, updatedAt: Date.now() });
      set(state => ({
        notes: state.notes.map(n => (n.id === id ? updated : n)),
      }));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('brewingNoteDataChanged', {
            detail: { action: 'update', noteId: id, note: updated },
          })
        );
      }
      return updated;
    },

    deleteNote: async id => {
      try {
        await notesAPI.delete(id);
        set(state => ({ notes: state.notes.filter(n => n.id !== id) }));

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('brewingNoteDataChanged', {
              detail: { action: 'delete', noteId: id },
            })
          );
        }
        return true;
      } catch {
        return false;
      }
    },

    setNotes: notes => set({ notes, initialized: true }),

    upsertNote: async note => {
      await db.brewingNotes.put(note);
      set(state => {
        const exists = state.notes.some(n => n.id === note.id);
        return exists
          ? { notes: state.notes.map(n => (n.id === note.id ? note : n)) }
          : { notes: [note, ...state.notes] };
      });
    },

    removeNote: async id => {
      await db.brewingNotes.delete(id);
      set(state => ({ notes: state.notes.filter(n => n.id !== id) }));
    },

    getNoteById: id => get().notes.find(n => n.id === id),

    refreshNotes: async () => {
      set({ initialized: false });
      await get().loadNotes();
    },
  }))
);

export const getBrewingNoteStore = () => useBrewingNoteStore.getState();
