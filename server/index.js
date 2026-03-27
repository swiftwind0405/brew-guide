import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'brew-guide.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

function generateId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function parseJSON(str) {
  try { return JSON.parse(str); } catch { return null; }
}

const normalize = {
  bean: (r) => r ? { id: r.id, name: r.name, roaster: r.roaster, origin: r.origin, process: r.process, variety: r.variety, roastLevel: r.roast_level, roastDate: r.roast_date, capacity: r.capacity, remaining: r.remaining, price: r.price, flavor: parseJSON(r.flavor) || [], notes: r.notes, type: r.type, isFrozen: !!r.is_frozen, freezeDate: r.freeze_date, createdAt: r.created_at, updatedAt: r.updated_at } : null,
  note: (r) => r ? { id: r.id, timestamp: r.timestamp, equipment: r.equipment, method: r.method, coffeeBeanId: r.coffee_bean_id, coffeeBeanName: r.coffee_bean_name, params: parseJSON(r.params) || {}, stages: parseJSON(r.stages) || [], rating: r.rating, flavorRatings: parseJSON(r.flavor_ratings) || {}, notes: r.notes, images: parseJSON(r.images) || [], createdAt: r.created_at, updatedAt: r.updated_at } : null,
  equipment: (r) => r ? { id: r.id, name: r.name, icon: r.icon, orderIndex: r.order_index, createdAt: r.created_at } : null,
  method: (r) => r ? { id: r.id, equipmentId: r.equipment_id, name: r.name, params: parseJSON(r.params) || {}, createdAt: r.created_at } : null,
  grinder: (r) => r ? { id: r.id, name: r.name, currentGrindSize: r.current_grind_size, grindSizeHistory: parseJSON(r.grind_size_history) || [], createdAt: r.created_at, updatedAt: r.updated_at } : null,
  report: (r) => r ? { id: r.id, year: r.year, username: r.username, content: r.content, createdAt: r.created_at } : null,
};

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS coffee_beans (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, roaster TEXT, origin TEXT, process TEXT, variety TEXT,
      roast_level TEXT, roast_date TEXT, capacity REAL, remaining REAL, price REAL, flavor TEXT, notes TEXT,
      type TEXT DEFAULT 'filter', is_frozen INTEGER DEFAULT 0, freeze_date TEXT,
      created_at INTEGER DEFAULT (unixepoch() * 1000), updated_at INTEGER DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_beans_created ON coffee_beans(created_at);

    CREATE TABLE IF NOT EXISTS brewing_notes (
      id TEXT PRIMARY KEY, timestamp INTEGER DEFAULT (unixepoch() * 1000), equipment TEXT, method TEXT,
      coffee_bean_id TEXT, coffee_bean_name TEXT, params TEXT, stages TEXT, rating REAL, flavor_ratings TEXT,
      notes TEXT, images TEXT, created_at INTEGER DEFAULT (unixepoch() * 1000), updated_at INTEGER DEFAULT (unixepoch() * 1000),
      FOREIGN KEY (coffee_bean_id) REFERENCES coffee_beans(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notes_timestamp ON brewing_notes(timestamp);

    CREATE TABLE IF NOT EXISTS custom_equipments (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT, order_index INTEGER DEFAULT 0, created_at INTEGER DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS custom_methods (
      id TEXT PRIMARY KEY, equipment_id TEXT NOT NULL, name TEXT NOT NULL, params TEXT, created_at INTEGER DEFAULT (unixepoch() * 1000),
      FOREIGN KEY (equipment_id) REFERENCES custom_equipments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS grinders (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, current_grind_size TEXT, grind_size_history TEXT,
      created_at INTEGER DEFAULT (unixepoch() * 1000), updated_at INTEGER DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id TEXT PRIMARY KEY DEFAULT 'main', data TEXT NOT NULL, updated_at INTEGER DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS yearly_reports (
      id TEXT PRIMARY KEY, year INTEGER NOT NULL, username TEXT, content TEXT, created_at INTEGER DEFAULT (unixepoch() * 1000)
    );
  `);
}

initTables();

// ========== Health ==========
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

// ========== Beans ==========
app.get('/api/beans', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM coffee_beans ORDER BY created_at DESC').all();
    res.json({ data: rows.map(normalize.bean) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/beans/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM coffee_beans WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ data: normalize.bean(row) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/beans', (req, res) => {
  try {
    const id = req.body.id || generateId();
    const now = Date.now();
    const bean = {
      id, name: req.body.name || '', roaster: req.body.roaster || null, origin: req.body.origin || null,
      process: req.body.process || null, variety: req.body.variety || null, roast_level: req.body.roastLevel || null,
      roast_date: req.body.roastDate || null, capacity: req.body.capacity || null,
      remaining: req.body.remaining ?? req.body.capacity ?? null, price: req.body.price || null,
      flavor: JSON.stringify(req.body.flavor || []), notes: req.body.notes || null, type: req.body.type || 'filter',
      is_frozen: req.body.isFrozen ? 1 : 0, freeze_date: req.body.freezeDate || null,
      created_at: req.body.createdAt || now, updated_at: now
    };
    db.prepare(`INSERT INTO coffee_beans (id, name, roaster, origin, process, variety, roast_level, roast_date, capacity, remaining, price, flavor, notes, type, is_frozen, freeze_date, created_at, updated_at)
      VALUES (@id, @name, @roaster, @origin, @process, @variety, @roast_level, @roast_date, @capacity, @remaining, @price, @flavor, @notes, @type, @is_frozen, @freeze_date, @created_at, @updated_at)`).run(bean);
    res.status(201).json({ data: normalize.bean(bean) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/beans/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM coffee_beans WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updates = [], params = { id: req.params.id, updated_at: Date.now() };
    const fields = ['name', 'roaster', 'origin', 'process', 'variety', 'roastLevel', 'roastDate', 'capacity', 'remaining', 'price', 'notes', 'type', 'freezeDate'];
    const sqlMap = { roastLevel: 'roast_level', roastDate: 'roast_date', freezeDate: 'freeze_date' };
    fields.forEach(f => {
      if (req.body[f] !== undefined) { updates.push(`${sqlMap[f] || f} = @${f}`); params[f] = req.body[f]; }
    });
    if (req.body.flavor !== undefined) { updates.push('flavor = @flavor'); params.flavor = JSON.stringify(req.body.flavor); }
    if (req.body.isFrozen !== undefined) { updates.push('is_frozen = @is_frozen'); params.is_frozen = req.body.isFrozen ? 1 : 0; }
    if (updates.length === 0) return res.json({ data: normalize.bean(existing) });
    db.prepare(`UPDATE coffee_beans SET ${updates.join(', ')}, updated_at = @updated_at WHERE id = @id`).run(params);
    const row = db.prepare('SELECT * FROM coffee_beans WHERE id = @id').get(params);
    res.json({ data: normalize.bean(row) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/beans/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM coffee_beans WHERE id = ?').run(req.params.id);
    res.status(204).send();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== Brewing Notes ==========
app.get('/api/notes', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM brewing_notes ORDER BY timestamp DESC').all();
    res.json({ data: rows.map(normalize.note) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/notes/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM brewing_notes WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ data: normalize.note(row) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/notes', (req, res) => {
  try {
    const id = req.body.id || generateId();
    const now = Date.now();
    const note = {
      id, timestamp: req.body.timestamp || now, equipment: req.body.equipment || null, method: req.body.method || null,
      coffee_bean_id: req.body.coffeeBeanId || null, coffee_bean_name: req.body.coffeeBeanName || null,
      params: JSON.stringify(req.body.params || {}), stages: JSON.stringify(req.body.stages || []),
      rating: req.body.rating || null, flavor_ratings: JSON.stringify(req.body.flavorRatings || {}),
      notes: req.body.notes || null, images: JSON.stringify(req.body.images || []),
      created_at: req.body.createdAt || now, updated_at: now
    };
    db.prepare(`INSERT INTO brewing_notes (id, timestamp, equipment, method, coffee_bean_id, coffee_bean_name, params, stages, rating, flavor_ratings, notes, images, created_at, updated_at) VALUES (@id, @timestamp, @equipment, @method, @coffee_bean_id, @coffee_bean_name, @params, @stages, @rating, @flavor_ratings, @notes, @images, @created_at, @updated_at)`).run(note);
    res.status(201).json({ data: normalize.note(note) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/notes/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM brewing_notes WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updates = [], params = { id: req.params.id, updated_at: Date.now() };
    if (req.body.timestamp !== undefined) { updates.push('timestamp = @timestamp'); params.timestamp = req.body.timestamp; }
    if (req.body.equipment !== undefined) { updates.push('equipment = @equipment'); params.equipment = req.body.equipment; }
    if (req.body.method !== undefined) { updates.push('method = @method'); params.method = req.body.method; }
    if (req.body.coffeeBeanId !== undefined) { updates.push('coffee_bean_id = @coffee_bean_id'); params.coffee_bean_id = req.body.coffeeBeanId; }
    if (req.body.coffeeBeanName !== undefined) { updates.push('coffee_bean_name = @coffee_bean_name'); params.coffee_bean_name = req.body.coffeeBeanName; }
    if (req.body.params !== undefined) { updates.push('params = @params'); params.params = JSON.stringify(req.body.params); }
    if (req.body.stages !== undefined) { updates.push('stages = @stages'); params.stages = JSON.stringify(req.body.stages); }
    if (req.body.rating !== undefined) { updates.push('rating = @rating'); params.rating = req.body.rating; }
    if (req.body.flavorRatings !== undefined) { updates.push('flavor_ratings = @flavor_ratings'); params.flavor_ratings = JSON.stringify(req.body.flavorRatings); }
    if (req.body.notes !== undefined) { updates.push('notes = @notes'); params.notes = req.body.notes; }
    if (req.body.images !== undefined) { updates.push('images = @images'); params.images = JSON.stringify(req.body.images); }
    if (updates.length === 0) return res.json({ data: normalize.note(existing) });
    db.prepare(`UPDATE brewing_notes SET ${updates.join(', ')}, updated_at = @updated_at WHERE id = @id`).run(params);
    const row = db.prepare('SELECT * FROM brewing_notes WHERE id = @id').get(params);
    res.json({ data: normalize.note(row) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/notes/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM brewing_notes WHERE id = ?').run(req.params.id);
    res.status(204).send();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== Equipments ==========
app.get('/api/equipments', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM custom_equipments ORDER BY order_index, created_at').all();
    res.json({ data: rows.map(normalize.equipment) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/equipments', (req, res) => {
  try {
    const id = req.body.id || generateId();
    const eq = { id, name: req.body.name || '', icon: req.body.icon || null, order_index: req.body.orderIndex || 0, created_at: Date.now() };
    db.prepare('INSERT INTO custom_equipments (id, name, icon, order_index, created_at) VALUES (@id, @name, @icon, @order_index, @created_at)').run(eq);
    res.status(201).json({ data: normalize.equipment(eq) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/equipments/:id', (req, res) => {
  try {
    const updates = [], params = { id: req.params.id };
    if (req.body.name !== undefined) { updates.push('name = @name'); params.name = req.body.name; }
    if (req.body.icon !== undefined) { updates.push('icon = @icon'); params.icon = req.body.icon; }
    if (req.body.orderIndex !== undefined) { updates.push('order_index = @order_index'); params.order_index = req.body.orderIndex; }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    db.prepare(`UPDATE custom_equipments SET ${updates.join(', ')} WHERE id = @id`).run(params);
    const row = db.prepare('SELECT * FROM custom_equipments WHERE id = ?').get(req.params.id);
    res.json({ data: normalize.equipment(row) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/equipments/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM custom_equipments WHERE id = ?').run(req.params.id);
    res.status(204).send();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== Methods ==========
app.get('/api/methods', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM custom_methods ORDER BY created_at').all();
    res.json({ data: rows.map(normalize.method) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/methods/by-equipment/:equipmentId', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM custom_methods WHERE equipment_id = ? ORDER BY created_at').all(req.params.equipmentId);
    res.json({ data: rows.map(normalize.method) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/methods', (req, res) => {
  try {
    const id = req.body.id || generateId();
    const method = { id, equipment_id: req.body.equipmentId, name: req.body.name || '', params: JSON.stringify(req.body.params || {}), created_at: Date.now() };
    db.prepare('INSERT INTO custom_methods (id, equipment_id, name, params, created_at) VALUES (@id, @equipment_id, @name, @params, @created_at)').run(method);
    res.status(201).json({ data: normalize.method(method) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/methods/:id', (req, res) => {
  try {
    const updates = [], params = { id: req.params.id };
    if (req.body.name !== undefined) { updates.push('name = @name'); params.name = req.body.name; }
    if (req.body.params !== undefined) { updates.push('params = @params'); params.params = JSON.stringify(req.body.params); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    db.prepare(`UPDATE custom_methods SET ${updates.join(', ')} WHERE id = @id`).run(params);
    const row = db.prepare('SELECT * FROM custom_methods WHERE id = ?').get(req.params.id);
    res.json({ data: normalize.method(row) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/methods/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM custom_methods WHERE id = ?').run(req.params.id);
    res.status(204).send();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== Grinders ==========
app.get('/api/grinders', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM grinders ORDER BY created_at').all();
    res.json({ data: rows.map(normalize.grinder) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/grinders/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM grinders WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ data: normalize.grinder(row) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/grinders', (req, res) => {
  try {
    const id = req.body.id || generateId();
    const now = Date.now();
    const grinder = { id, name: req.body.name || '', current_grind_size: req.body.currentGrindSize || null, grind_size_history: JSON.stringify(req.body.grindSizeHistory || []), created_at: req.body.createdAt || now, updated_at: now };
    db.prepare('INSERT INTO grinders (id, name, current_grind_size, grind_size_history, created_at, updated_at) VALUES (@id, @name, @current_grind_size, @grind_size_history, @created_at, @updated_at)').run(grinder);
    res.status(201).json({ data: normalize.grinder(grinder) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/grinders/:id', (req, res) => {
  try {
    const updates = [], params = { id: req.params.id, updated_at: Date.now() };
    if (req.body.name !== undefined) { updates.push('name = @name'); params.name = req.body.name; }
    if (req.body.currentGrindSize !== undefined) { updates.push('current_grind_size = @current_grind_size'); params.current_grind_size = req.body.currentGrindSize; }
    if (req.body.grindSizeHistory !== undefined) { updates.push('grind_size_history = @grind_size_history'); params.grind_size_history = JSON.stringify(req.body.grindSizeHistory); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    db.prepare(`UPDATE grinders SET ${updates.join(', ')}, updated_at = @updated_at WHERE id = @id`).run(params);
    const row = db.prepare('SELECT * FROM grinders WHERE id = @id').get(params);
    res.json({ data: normalize.grinder(row) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/grinders/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM grinders WHERE id = ?').run(req.params.id);
    res.status(204).send();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== Settings ==========
app.get('/api/settings', (req, res) => {
  try {
    const row = db.prepare("SELECT * FROM app_settings WHERE id = 'main'").get();
    res.json({ data: row ? parseJSON(row.data) : {} });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/settings', (req, res) => {
  try {
    const data = JSON.stringify(req.body || {});
    const updated_at = Date.now();
    db.prepare("INSERT INTO app_settings (id, data, updated_at) VALUES ('main', @data, @updated_at) ON CONFLICT(id) DO UPDATE SET data = @data, updated_at = @updated_at").run({ data, updated_at });
    res.json({ data: req.body });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== Reports ==========
app.get('/api/reports', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM yearly_reports ORDER BY year DESC').all();
    res.json({ data: rows.map(normalize.report) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reports/:year', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM yearly_reports WHERE year = ?').get(req.params.year);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ data: normalize.report(row) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/reports', (req, res) => {
  try {
    const id = req.body.id || generateId();
    const report = { id, year: req.body.year, username: req.body.username || '', content: req.body.content || '', created_at: Date.now() };
    db.prepare('INSERT INTO yearly_reports (id, year, username, content, created_at) VALUES (@id, @year, @username, @content, @created_at)').run(report);
    res.status(201).json({ data: normalize.report(report) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/reports/:id', (req, res) => {
  try {
    const updates = [], params = { id: req.params.id };
    if (req.body.content !== undefined) { updates.push('content = @content'); params.content = req.body.content; }
    if (req.body.username !== undefined) { updates.push('username = @username'); params.username = req.body.username; }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    db.prepare(`UPDATE yearly_reports SET ${updates.join(', ')} WHERE id = @id`).run(params);
    const row = db.prepare('SELECT * FROM yearly_reports WHERE id = ?').get(req.params.id);
    res.json({ data: normalize.report(row) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/reports/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM yearly_reports WHERE id = ?').run(req.params.id);
    res.status(204).send();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== Import/Export ==========
app.post('/api/import', (req, res) => {
  try {
    const { beans, notes, equipments, methods, grinders, settings } = req.body;
    const stats = { beans: 0, notes: 0, equipments: 0, methods: 0, grinders: 0 };
    if (beans?.length) {
      for (const b of beans) {
        try {
          const id = b.id || generateId();
          db.prepare(`INSERT OR REPLACE INTO coffee_beans (id, name, roaster, origin, process, variety, roast_level, roast_date, capacity, remaining, price, flavor, notes, type, is_frozen, freeze_date, created_at, updated_at)
            VALUES (@id, @name, @roaster, @origin, @process, @variety, @roast_level, @roast_date, @capacity, @remaining, @price, @flavor, @notes, @type, @is_frozen, @freeze_date, @created_at, @updated_at)`)
            .run({ id, name: b.name || '', roaster: b.roaster || null, origin: b.origin || null, process: b.process || null, variety: b.variety || null, roast_level: b.roastLevel || b.roast_level || null, roast_date: b.roastDate || b.roast_date || null, capacity: b.capacity || null, remaining: b.remaining ?? b.capacity ?? null, price: b.price || null, flavor: JSON.stringify(b.flavor || []), notes: b.notes || null, type: b.type || 'filter', is_frozen: b.isFrozen || b.is_frozen ? 1 : 0, freeze_date: b.freezeDate || b.freeze_date || null, created_at: b.createdAt || b.created_at || Date.now(), updated_at: Date.now() });
          stats.beans++;
        } catch (err) { console.error('Import bean error:', err.message); }
      }
    }
    if (notes?.length) {
      for (const n of notes) {
        try {
          const id = n.id || generateId();
          db.prepare(`INSERT OR REPLACE INTO brewing_notes (id, timestamp, equipment, method, coffee_bean_id, coffee_bean_name, params, stages, rating, flavor_ratings, notes, images, created_at, updated_at)
            VALUES (@id, @timestamp, @equipment, @method, @coffee_bean_id, @coffee_bean_name, @params, @stages, @rating, @flavor_ratings, @notes, @images, @created_at, @updated_at)`)
            .run({ id, timestamp: n.timestamp || Date.now(), equipment: n.equipment || null, method: n.method || null, coffee_bean_id: n.coffeeBeanId || n.coffee_bean_id || null, coffee_bean_name: n.coffeeBeanName || n.coffee_bean_name || null, params: JSON.stringify(n.params || {}), stages: JSON.stringify(n.stages || []), rating: n.rating || null, flavor_ratings: JSON.stringify(n.flavorRatings || n.flavor_ratings || {}), notes: n.notes || null, images: JSON.stringify(n.images || []), created_at: n.createdAt || n.created_at || Date.now(), updated_at: Date.now() });
          stats.notes++;
        } catch (err) { console.error('Import note error:', err.message); }
      }
    }
    if (equipments?.length) {
      for (const e of equipments) {
        try {
          const id = e.id || generateId();
          db.prepare('INSERT OR REPLACE INTO custom_equipments (id, name, icon, order_index, created_at) VALUES (@id, @name, @icon, @order_index, @created_at)')
            .run({ id, name: e.name || '', icon: e.icon || null, order_index: e.orderIndex || e.order_index || 0, created_at: e.createdAt || e.created_at || Date.now() });
          stats.equipments++;
        } catch (err) { console.error('Import equipment error:', err.message); }
      }
    }
    if (methods?.length) {
      for (const m of methods) {
        try {
          const id = m.id || generateId();
          db.prepare('INSERT OR REPLACE INTO custom_methods (id, equipment_id, name, params, created_at) VALUES (@id, @equipment_id, @name, @params, @created_at)')
            .run({ id, equipment_id: m.equipmentId || m.equipment_id, name: m.name || '', params: JSON.stringify(m.params || {}), created_at: m.createdAt || m.created_at || Date.now() });
          stats.methods++;
        } catch (err) { console.error('Import method error:', err.message); }
      }
    }
    if (grinders?.length) {
      for (const g of grinders) {
        try {
          const id = g.id || generateId();
          db.prepare('INSERT OR REPLACE INTO grinders (id, name, current_grind_size, grind_size_history, created_at, updated_at) VALUES (@id, @name, @current_grind_size, @grind_size_history, @created_at, @updated_at)')
            .run({ id, name: g.name || '', current_grind_size: g.currentGrindSize || g.current_grind_size || null, grind_size_history: JSON.stringify(g.grindSizeHistory || g.grind_size_history || []), created_at: g.createdAt || g.created_at || Date.now(), updated_at: Date.now() });
          stats.grinders++;
        } catch (err) { console.error('Import grinder error:', err.message); }
      }
    }
    if (settings) {
      const data = JSON.stringify(settings);
      db.prepare("INSERT INTO app_settings (id, data, updated_at) VALUES ('main', @data, @updated_at) ON CONFLICT(id) DO UPDATE SET data = @data, updated_at = @updated_at").run({ data, updated_at: Date.now() });
    }
    res.json({ success: true, stats });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/export', (req, res) => {
  try {
    const beans = db.prepare('SELECT * FROM coffee_beans').all().map(normalize.bean);
    const notes = db.prepare('SELECT * FROM brewing_notes').all().map(normalize.note);
    const equipments = db.prepare('SELECT * FROM custom_equipments').all().map(normalize.equipment);
    const methods = db.prepare('SELECT * FROM custom_methods').all().map(normalize.method);
    const grinders = db.prepare('SELECT * FROM grinders').all().map(normalize.grinder);
    const settingsRow = db.prepare("SELECT * FROM app_settings WHERE id = 'main'").get();
    const settings = settingsRow ? parseJSON(settingsRow.data) : {};
    res.json({ beans, notes, equipments, methods, grinders, settings, exportedAt: Date.now() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Start server
app.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`);
  console.log(`[DB] SQLite at ${DB_PATH}`);
});