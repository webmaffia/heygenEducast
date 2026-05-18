import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'educast.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

function initSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      script TEXT NOT NULL,
      background_image TEXT,
      selected_avatar TEXT,
      selected_voice TEXT,
      avatar_video_url TEXT,
      rendered_video_url TEXT,
      video_duration_in_frames INTEGER DEFAULT 0,
      infographics TEXT DEFAULT '[]',
      status TEXT DEFAULT 'draft',
      subject_id TEXT,
      chapter_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT DEFAULT 'user',
      status TEXT DEFAULT 'active',
      avatar TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
    CREATE INDEX IF NOT EXISTS idx_videos_subject ON videos(subject_id);
    CREATE INDEX IF NOT EXISTS idx_chapters_subject ON chapters(subject_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  `);

  const subjectCount = database.prepare('SELECT COUNT(*) as count FROM subjects').get() as { count: number };
  if (subjectCount.count === 0) {
    const defaultSubjects = [
      { id: 'subj_organic_chem', name: 'Organic Chemistry' },
      { id: 'subj_physics', name: 'Physics' },
      { id: 'subj_biology', name: 'Biology' },
      { id: 'subj_math', name: 'Mathematics' },
    ];
    const insertSubject = database.prepare('INSERT OR IGNORE INTO subjects (id, name) VALUES (?, ?)');
    for (const subj of defaultSubjects) {
      insertSubject.run(subj.id, subj.name);
    }

    const defaultChapters = [
      { id: 'ch_chem_ch1', subject_id: 'subj_organic_chem', name: 'Ch 1 - Introduction' },
      { id: 'ch_chem_ch2', subject_id: 'subj_organic_chem', name: 'Ch 2 - Functional Groups' },
      { id: 'ch_chem_ch3', subject_id: 'subj_organic_chem', name: 'Ch 3 - Reactions' },
      { id: 'ch_phys_ch1', subject_id: 'subj_physics', name: 'Ch 1 - Mechanics' },
      { id: 'ch_phys_ch2', subject_id: 'subj_physics', name: 'Ch 2 - Thermodynamics' },
      { id: 'ch_bio_ch1', subject_id: 'subj_biology', name: 'Ch 1 - Cell Biology' },
      { id: 'ch_math_ch1', subject_id: 'subj_math', name: 'Ch 1 - Algebra' },
    ];
    const insertChapter = database.prepare('INSERT OR IGNORE INTO chapters (id, subject_id, name) VALUES (?, ?, ?)');
    for (const ch of defaultChapters) {
      insertChapter.run(ch.id, ch.subject_id, ch.name);
    }
  }

  const userCount = database.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const defaultUsers = [
      { id: 'user_admin_1', name: 'Admin User', email: 'admin@educast.com', role: 'admin', status: 'active' },
      { id: 'user_1', name: 'Dr. Priya Sharma', email: 'priya@educast.com', role: 'user', status: 'active' },
      { id: 'user_2', name: 'Prof. Arjun Mehta', email: 'arjun@educast.com', role: 'user', status: 'active' },
      { id: 'user_3', name: 'Demo User', email: 'demo@educast.com', role: 'user', status: 'inactive' },
    ];
    const insertUser = database.prepare('INSERT OR IGNORE INTO users (id, name, email, role, status) VALUES (?, ?, ?, ?, ?)');
    for (const u of defaultUsers) {
      insertUser.run(u.id, u.name, u.email, u.role, u.status);
    }
  }
}

export interface VideoRow {
  id: string;
  title: string;
  script: string;
  background_image: string | null;
  selected_avatar: string | null;
  selected_voice: string | null;
  avatar_video_url: string | null;
  rendered_video_url: string | null;
  video_duration_in_frames: number;
  infographics: string;
  status: string;
  subject_id: string | null;
  chapter_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubjectRow {
  id: string;
  name: string;
  created_at: string;
}

export interface ChapterRow {
  id: string;
  subject_id: string;
  name: string;
  created_at: string;
}

export const videoQueries = {
  getAll(db: Database.Database): VideoRow[] {
    return db.prepare('SELECT * FROM videos ORDER BY created_at DESC').all() as VideoRow[];
  },

  getById(db: Database.Database, id: string): VideoRow | undefined {
    return db.prepare('SELECT * FROM videos WHERE id = ?').get(id) as VideoRow | undefined;
  },

  getByStatus(db: Database.Database, status: string): VideoRow[] {
    return db.prepare('SELECT * FROM videos WHERE status = ? ORDER BY created_at DESC').all(status) as VideoRow[];
  },

  insert(db: Database.Database, video: Omit<VideoRow, 'created_at' | 'updated_at'>): void {
    db.prepare(`
      INSERT INTO videos (id, title, script, background_image, selected_avatar, selected_voice,
        avatar_video_url, rendered_video_url, video_duration_in_frames, infographics, status, subject_id, chapter_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      video.id, video.title, video.script, video.background_image, video.selected_avatar,
      video.selected_voice, video.avatar_video_url, video.rendered_video_url,
      video.video_duration_in_frames, video.infographics, video.status,
      video.subject_id, video.chapter_id
    );
  },

  update(db: Database.Database, id: string, updates: Partial<VideoRow>): void {
    const fields = Object.keys(updates).filter(k => k !== 'id');
    if (fields.length === 0) return;
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => (updates as any)[f]);
    values.push(id);
    db.prepare(`UPDATE videos SET ${setClause}, updated_at = datetime('now') WHERE id = ?`).run(...values);
  },

  delete(db: Database.Database, id: string): void {
    db.prepare('DELETE FROM videos WHERE id = ?').run(id);
  },

  getStats(db: Database.Database) {
    const total = db.prepare('SELECT COUNT(*) as count FROM videos').get() as { count: number };
    const published = db.prepare("SELECT COUNT(*) as count FROM videos WHERE status = 'published'").get() as { count: number };
    const drafts = db.prepare("SELECT COUNT(*) as count FROM videos WHERE status = 'draft'").get() as { count: number };
    const totalFrames = db.prepare('SELECT COALESCE(SUM(video_duration_in_frames), 0) as total FROM videos').get() as { total: number };
    const lastCreated = db.prepare('SELECT created_at FROM videos ORDER BY created_at DESC LIMIT 1').get() as { created_at: string } | undefined;
    const uniqueSubjects = db.prepare('SELECT COUNT(DISTINCT subject_id) as count FROM videos WHERE subject_id IS NOT NULL').get() as { count: number };

    return {
      total: total.count,
      published: published.count,
      drafts: drafts.count,
      totalDurationFrames: totalFrames.total,
      lastCreated: lastCreated?.created_at || null,
      uniqueSubjects: uniqueSubjects.count,
    };
  },
};

export const subjectQueries = {
  getAll(db: Database.Database): SubjectRow[] {
    return db.prepare('SELECT * FROM subjects ORDER BY name').all() as SubjectRow[];
  },

  getById(db: Database.Database, id: string): SubjectRow | undefined {
    return db.prepare('SELECT * FROM subjects WHERE id = ?').get(id) as SubjectRow | undefined;
  },

  insert(db: Database.Database, id: string, name: string): void {
    db.prepare('INSERT INTO subjects (id, name) VALUES (?, ?)').run(id, name);
  },

  update(db: Database.Database, id: string, name: string): void {
    db.prepare('UPDATE subjects SET name = ? WHERE id = ?').run(name, id);
  },

  delete(db: Database.Database, id: string): void {
    db.prepare('DELETE FROM subjects WHERE id = ?').run(id);
  },
};

export const chapterQueries = {
  getAll(db: Database.Database): ChapterRow[] {
    return db.prepare('SELECT * FROM chapters ORDER BY subject_id, name').all() as ChapterRow[];
  },

  getBySubject(db: Database.Database, subjectId: string): ChapterRow[] {
    return db.prepare('SELECT * FROM chapters WHERE subject_id = ? ORDER BY name').all(subjectId) as ChapterRow[];
  },

  getById(db: Database.Database, id: string): ChapterRow | undefined {
    return db.prepare('SELECT * FROM chapters WHERE id = ?').get(id) as ChapterRow | undefined;
  },

  insert(db: Database.Database, id: string, subjectId: string, name: string): void {
    db.prepare('INSERT INTO chapters (id, subject_id, name) VALUES (?, ?, ?)').run(id, subjectId, name);
  },

  update(db: Database.Database, id: string, name: string): void {
    db.prepare('UPDATE chapters SET name = ? WHERE id = ?').run(name, id);
  },

  delete(db: Database.Database, id: string): void {
    db.prepare('DELETE FROM chapters WHERE id = ?').run(id);
  },
};

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  avatar: string | null;
  created_at: string;
  updated_at: string;
}

export const userQueries = {
  getAll(db: Database.Database): UserRow[] {
    return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as UserRow[];
  },

  getById(db: Database.Database, id: string): UserRow | undefined {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  },

  getByRole(db: Database.Database, role: string): UserRow[] {
    return db.prepare('SELECT * FROM users WHERE role = ? ORDER BY created_at DESC').all(role) as UserRow[];
  },

  insert(db: Database.Database, user: Omit<UserRow, 'created_at' | 'updated_at'>): void {
    db.prepare(`
      INSERT INTO users (id, name, email, role, status, avatar)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(user.id, user.name, user.email, user.role, user.status, user.avatar);
  },

  update(db: Database.Database, id: string, updates: Partial<UserRow>): void {
    const fields = Object.keys(updates).filter(k => k !== 'id');
    if (fields.length === 0) return;
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => (updates as any)[f]);
    values.push(id);
    db.prepare(`UPDATE users SET ${setClause}, updated_at = datetime('now') WHERE id = ?`).run(...values);
  },

  delete(db: Database.Database, id: string): void {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  },

  getStats(db: Database.Database) {
    const total = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const active = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'active'").get() as { count: number };
    const admins = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as { count: number };
    const users = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'user'").get() as { count: number };
    return { total: total.count, active: active.count, admins: admins.count, users: users.count };
  },
};
