/**
 * API Client for Brew Guide SQLite Backend
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Beans
export const beansAPI = {
  list: () => fetchAPI<{ data: any[] }>('/api/beans').then(r => r.data),
  get: (id: string) => fetchAPI<{ data: any }>(`/api/beans/${id}`).then(r => r.data),
  create: (data: any) => fetchAPI<{ data: any }>('/api/beans', { method: 'POST', body: JSON.stringify(data) }).then(r => r.data),
  update: (id: string, data: any) => fetchAPI<{ data: any }>(`/api/beans/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then(r => r.data),
  delete: (id: string) => fetchAPI<void>(`/api/beans/${id}`, { method: 'DELETE' }),
};

// Brewing Notes
export const notesAPI = {
  list: () => fetchAPI<{ data: any[] }>('/api/notes').then(r => r.data),
  get: (id: string) => fetchAPI<{ data: any }>(`/api/notes/${id}`).then(r => r.data),
  create: (data: any) => fetchAPI<{ data: any }>('/api/notes', { method: 'POST', body: JSON.stringify(data) }).then(r => r.data),
  update: (id: string, data: any) => fetchAPI<{ data: any }>(`/api/notes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then(r => r.data),
  delete: (id: string) => fetchAPI<void>(`/api/notes/${id}`, { method: 'DELETE' }),
};

// Equipments
export const equipmentsAPI = {
  list: () => fetchAPI<{ data: any[] }>('/api/equipments').then(r => r.data),
  create: (data: any) => fetchAPI<{ data: any }>('/api/equipments', { method: 'POST', body: JSON.stringify(data) }).then(r => r.data),
  update: (id: string, data: any) => fetchAPI<{ data: any }>(`/api/equipments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then(r => r.data),
  delete: (id: string) => fetchAPI<void>(`/api/equipments/${id}`, { method: 'DELETE' }),
};

// Methods
export const methodsAPI = {
  list: () => fetchAPI<{ data: any[] }>('/api/methods').then(r => r.data),
  byEquipment: (equipmentId: string) => fetchAPI<{ data: any[] }>(`/api/methods/by-equipment/${equipmentId}`).then(r => r.data),
  create: (data: any) => fetchAPI<{ data: any }>('/api/methods', { method: 'POST', body: JSON.stringify(data) }).then(r => r.data),
  update: (id: string, data: any) => fetchAPI<{ data: any }>(`/api/methods/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then(r => r.data),
  delete: (id: string) => fetchAPI<void>(`/api/methods/${id}`, { method: 'DELETE' }),
};

// Grinders
export const grindersAPI = {
  list: () => fetchAPI<{ data: any[] }>('/api/grinders').then(r => r.data),
  get: (id: string) => fetchAPI<{ data: any }>(`/api/grinders/${id}`).then(r => r.data),
  create: (data: any) => fetchAPI<{ data: any }>('/api/grinders', { method: 'POST', body: JSON.stringify(data) }).then(r => r.data),
  update: (id: string, data: any) => fetchAPI<{ data: any }>(`/api/grinders/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then(r => r.data),
  delete: (id: string) => fetchAPI<void>(`/api/grinders/${id}`, { method: 'DELETE' }),
};

// Settings
export const settingsAPI = {
  get: () => fetchAPI<{ data: any }>('/api/settings').then(r => r.data),
  update: (data: any) => fetchAPI<{ data: any }>('/api/settings', { method: 'PUT', body: JSON.stringify(data) }).then(r => r.data),
};

// Reports
export const reportsAPI = {
  list: () => fetchAPI<{ data: any[] }>('/api/reports').then(r => r.data),
  get: (year: number) => fetchAPI<{ data: any }>(`/api/reports/${year}`).then(r => r.data),
  create: (data: any) => fetchAPI<{ data: any }>('/api/reports', { method: 'POST', body: JSON.stringify(data) }).then(r => r.data),
  update: (id: string, data: any) => fetchAPI<{ data: any }>(`/api/reports/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then(r => r.data),
  delete: (id: string) => fetchAPI<void>(`/api/reports/${id}`, { method: 'DELETE' }),
};

// Import/Export
export const backupAPI = {
  export: () => fetchAPI<any>('/api/export'),
  import: (data: any) => fetchAPI<{ success: boolean; stats: any }>('/api/import', { method: 'POST', body: JSON.stringify(data) }),
};

// Health
export const healthAPI = {
  check: () => fetchAPI<{ status: string; timestamp: number }>('/api/health'),
};
