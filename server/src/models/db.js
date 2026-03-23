import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../../instaposter.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

export function initDb() {
    db.exec(`
    CREATE TABLE IF NOT EXISTS media_queue (
      id TEXT PRIMARY KEY,
      google_base_url TEXT NOT NULL,
      original_width INTEGER,
      original_height INTEGER,
      ai_score INTEGER,
      mood TEXT,
      subject TEXT,
      suggested_caption TEXT,
      hashtags TEXT,
      crop_recommendation TEXT,
      status TEXT DEFAULT 'PENDING',
      rejection_reason TEXT,
      scheduled_at TEXT,
      posted_at TEXT,
      platform TEXT DEFAULT 'INSTAGRAM',
      platform_post_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS oauth_tokens (
      provider TEXT PRIMARY KEY,
      access_token TEXT,
      refresh_token TEXT,
      expires_at TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS post_metrics (
      id TEXT PRIMARY KEY,
      media_queue_id TEXT,
      platform_post_id TEXT,
      likes INTEGER DEFAULT 0,
      reach INTEGER DEFAULT 0,
      saves INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      fetched_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

    // Seed default settings
    const defaults = [
        ['posting_paused', 'false'],
        ['daily_post_limit', '2'],
        ['min_ai_score_threshold', '7'],
        ['niche', 'lifestyle'],
        ['post_times', '["7 9 * * *", "5 18 * * *"]'],
        ['test_mode', 'true'],  // Archive posts immediately — hidden from public, visible only to you
        ['ai_provider', 'gemini'],
        ['ai_model', 'gemini-2.5-flash'],
    ];
    const upsert = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
    for (const [key, value] of defaults) upsert.run(key, value);

    // Migrate: add editing_suggestions column if it doesn't exist yet
    try {
        db.exec(`ALTER TABLE media_queue ADD COLUMN editing_suggestions TEXT`);
    } catch { /* column already exists — ignore */ }

    // Migrate: add sharp_params column (Gemini-generated Sharp.js editing params)
    try {
        db.exec(`ALTER TABLE media_queue ADD COLUMN sharp_params TEXT`);
    } catch { /* column already exists — ignore */ }

    // generated_images table
    db.exec(`
      CREATE TABLE IF NOT EXISTS generated_images (
        id TEXT PRIMARY KEY,
        prompt TEXT NOT NULL,
        model TEXT DEFAULT 'flux',
        width INTEGER DEFAULT 1080,
        height INTEGER DEFAULT 1080,
        image_path TEXT,
        status TEXT DEFAULT 'DRAFT',
        caption TEXT,
        hashtags TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    logger.info({ dbPath: DB_PATH }, '[DB] Database initialized');
}

// ─── Queue Operations ──────────────────────────────────────────────────────
export function insertQueueItem(item) {
    const stmt = db.prepare(`
    INSERT OR REPLACE INTO media_queue
    (id, google_base_url, original_width, original_height, ai_score, mood, subject,
     suggested_caption, hashtags, crop_recommendation, status, rejection_reason, platform,
     editing_suggestions, sharp_params)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    return stmt.run(
        item.id, item.google_base_url, item.original_width, item.original_height,
        item.ai_score, item.mood, item.subject, item.suggested_caption,
        JSON.stringify(item.hashtags || []), item.crop_recommendation,
        item.status || 'PENDING', item.rejection_reason || null, item.platform || 'INSTAGRAM',
        JSON.stringify(item.editing_suggestions || []),
        item.sharp_params ? JSON.stringify(item.sharp_params) : null
    );
}

export function getQueue(status = null, limit = 50, createdAfter = null) {
    if (status && createdAfter) {
        return db.prepare(`SELECT * FROM media_queue WHERE status = ? AND created_at > ? ORDER BY ai_score DESC, created_at ASC LIMIT ?`).all(status, createdAfter, limit);
    }
    if (createdAfter) {
        return db.prepare(`SELECT * FROM media_queue WHERE created_at > ? ORDER BY created_at DESC LIMIT ?`).all(createdAfter, limit);
    }
    if (status) {
        return db.prepare(`SELECT * FROM media_queue WHERE status = ? ORDER BY ai_score DESC, created_at ASC LIMIT ?`).all(status, limit);
    }
    return db.prepare(`SELECT * FROM media_queue ORDER BY created_at DESC LIMIT ?`).all(limit);
}

export function getQueueItemById(id) {
    return db.prepare(`SELECT * FROM media_queue WHERE id = ?`).get(id);
}

export function getNextPendingPost() {
    return db.prepare(`
    SELECT * FROM media_queue
    WHERE status = 'APPROVED'
    ORDER BY ai_score DESC, created_at ASC
    LIMIT 1
  `).get();
}

export function updateStatus(id, status, extras = {}) {
    const fields = ['status = ?'];
    const values = [status];
    if (extras.platform_post_id) { fields.push('platform_post_id = ?'); values.push(extras.platform_post_id); }
    if (extras.posted_at) { fields.push('posted_at = ?'); values.push(extras.posted_at); }
    if (extras.rejection_reason) { fields.push('rejection_reason = ?'); values.push(extras.rejection_reason); }
    // Clear stale rejection_reason when item successfully posts
    if (status === 'POSTED') { fields.push('rejection_reason = ?'); values.push(null); }
    values.push(id);
    db.prepare(`UPDATE media_queue SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function updateCaption(id, caption) {
    db.prepare(`UPDATE media_queue SET suggested_caption = ? WHERE id = ?`).run(caption, id);
}

export function updateQueueItemAnalysis(id, fields) {
    // Updates Gemini-generated fields without touching status or platform_post_id
    const stmt = db.prepare(`
        UPDATE media_queue SET
            editing_suggestions = ?,
            suggested_caption = ?,
            hashtags = ?,
            subject = ?,
            mood = ?,
            crop_recommendation = ?,
            ai_score = ?,
            sharp_params = ?
        WHERE id = ?
    `);
    return stmt.run(
        JSON.stringify(fields.editing_suggestions || []),
        fields.suggested_caption,
        JSON.stringify(fields.hashtags || []),
        fields.subject,
        fields.mood,
        fields.crop_recommendation,
        fields.ai_score,
        fields.sharp_params ? JSON.stringify(fields.sharp_params) : null,
        id
    );
}

// ─── Token Operations ──────────────────────────────────────────────────────
export function saveToken(provider, accessToken, expiresAt) {
    db.prepare(`
    INSERT OR REPLACE INTO oauth_tokens (provider, access_token, expires_at, updated_at)
    VALUES (?, ?, ?, datetime('now'))
  `).run(provider, accessToken, expiresAt);
}

export function getToken(provider) {
    return db.prepare(`SELECT * FROM oauth_tokens WHERE provider = ?`).get(provider);
}

// ─── Settings Operations ───────────────────────────────────────────────────
export function getSetting(key) {
    const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key);
    return row ? row.value : null;
}

export function setSetting(key, value) {
    db.prepare(`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`).run(key, String(value));
}

// ─── Stats ─────────────────────────────────────────────────────────────────
export function getStats() {
    return {
        total: db.prepare(`SELECT COUNT(*) as c FROM media_queue`).get().c,
        pending: db.prepare(`SELECT COUNT(*) as c FROM media_queue WHERE status = 'PENDING'`).get().c,
        approved: db.prepare(`SELECT COUNT(*) as c FROM media_queue WHERE status = 'APPROVED'`).get().c,
        posted: db.prepare(`SELECT COUNT(*) as c FROM media_queue WHERE status = 'POSTED'`).get().c,
        rejected: db.prepare(`SELECT COUNT(*) as c FROM media_queue WHERE status = 'REJECTED'`).get().c,
        failed: db.prepare(`SELECT COUNT(*) as c FROM media_queue WHERE status = 'FAILED'`).get().c,
    };
}

// ─── Generated Images Operations ───────────────────────────────────────────
export function insertGeneratedImage(item) {
    db.prepare(`
        INSERT INTO generated_images (id, prompt, model, width, height, image_path, status, caption, hashtags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(item.id, item.prompt, item.model, item.width, item.height, item.image_path,
           item.status || 'DRAFT', item.caption || null, JSON.stringify(item.hashtags || []));
}

export function getGeneratedImages() {
    return db.prepare(`SELECT * FROM generated_images ORDER BY created_at DESC LIMIT 100`).all()
        .map(r => ({ ...r, hashtags: (() => { try { return JSON.parse(r.hashtags); } catch { return []; } })() }));
}

export function getGeneratedImageById(id) {
    return db.prepare(`SELECT * FROM generated_images WHERE id = ?`).get(id);
}

export function updateGeneratedImageStatus(id, status) {
    db.prepare(`UPDATE generated_images SET status = ? WHERE id = ?`).run(status, id);
}

export function deleteGeneratedImage(id) {
    db.prepare(`DELETE FROM generated_images WHERE id = ?`).run(id);
}

export { db };
