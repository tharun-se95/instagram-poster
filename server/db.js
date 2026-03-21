const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'instaposter.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

function initDb() {
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
    ];
    const upsert = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
    for (const [key, value] of defaults) upsert.run(key, value);

    console.log('[DB] Database initialized at:', DB_PATH);
}

// ─── Queue Operations ──────────────────────────────────────────────────────
function insertQueueItem(item) {
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO media_queue
        (id, google_base_url, original_width, original_height, ai_score, mood, subject,
         suggested_caption, hashtags, crop_recommendation, status, rejection_reason, platform)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
        item.id, item.google_base_url, item.original_width, item.original_height,
        item.ai_score, item.mood, item.subject, item.suggested_caption,
        JSON.stringify(item.hashtags || []), item.crop_recommendation,
        item.status || 'PENDING', item.rejection_reason || null, item.platform || 'INSTAGRAM'
    );
}

function getQueue(status = null, limit = 50) {
    if (status) {
        return db.prepare(`SELECT * FROM media_queue WHERE status = ? ORDER BY ai_score DESC, created_at ASC LIMIT ?`).all(status, limit);
    }
    return db.prepare(`SELECT * FROM media_queue ORDER BY created_at DESC LIMIT ?`).all(limit);
}

function getNextPendingPost() {
    return db.prepare(`
        SELECT * FROM media_queue
        WHERE status = 'APPROVED'
        ORDER BY ai_score DESC, created_at ASC
        LIMIT 1
    `).get();
}

function updateStatus(id, status, extras = {}) {
    const fields = ['status = ?'];
    const values = [status];
    if (extras.platform_post_id) { fields.push('platform_post_id = ?'); values.push(extras.platform_post_id); }
    if (extras.posted_at) { fields.push('posted_at = ?'); values.push(extras.posted_at); }
    if (extras.rejection_reason) { fields.push('rejection_reason = ?'); values.push(extras.rejection_reason); }
    values.push(id);
    db.prepare(`UPDATE media_queue SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

function updateCaption(id, caption) {
    db.prepare(`UPDATE media_queue SET suggested_caption = ? WHERE id = ?`).run(caption, id);
}

// ─── Token Operations ──────────────────────────────────────────────────────
function saveToken(provider, accessToken, expiresAt) {
    db.prepare(`
        INSERT OR REPLACE INTO oauth_tokens (provider, access_token, expires_at, updated_at)
        VALUES (?, ?, ?, datetime('now'))
    `).run(provider, accessToken, expiresAt);
}

function getToken(provider) {
    return db.prepare(`SELECT * FROM oauth_tokens WHERE provider = ?`).get(provider);
}

// ─── Settings Operations ───────────────────────────────────────────────────
function getSetting(key) {
    const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key);
    return row ? row.value : null;
}

function setSetting(key, value) {
    db.prepare(`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`).run(key, String(value));
}

// ─── Stats ─────────────────────────────────────────────────────────────────
function getStats() {
    return {
        total: db.prepare(`SELECT COUNT(*) as c FROM media_queue`).get().c,
        pending: db.prepare(`SELECT COUNT(*) as c FROM media_queue WHERE status = 'PENDING'`).get().c,
        approved: db.prepare(`SELECT COUNT(*) as c FROM media_queue WHERE status = 'APPROVED'`).get().c,
        posted: db.prepare(`SELECT COUNT(*) as c FROM media_queue WHERE status = 'POSTED'`).get().c,
        rejected: db.prepare(`SELECT COUNT(*) as c FROM media_queue WHERE status = 'REJECTED'`).get().c,
        failed: db.prepare(`SELECT COUNT(*) as c FROM media_queue WHERE status = 'FAILED'`).get().c,
    };
}

module.exports = {
    initDb, db,
    insertQueueItem, getQueue, getNextPendingPost, updateStatus, updateCaption,
    saveToken, getToken,
    getSetting, setSetting,
    getStats,
};
