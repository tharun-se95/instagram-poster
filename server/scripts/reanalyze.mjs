/**
 * One-time re-analysis script.
 * 1. Resets all FAILED items (posting errors) back to APPROVED.
 * 2. Re-analyzes REJECTED items that failed due to Gemini API errors using local disk cache.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Lazy import after dotenv — needed for ESM/dotenv ordering
const { analyzePhoto } = await import('../src/services/geminiService.js');
const { logger } = await import('../src/utils/logger.js');

const DB_PATH = path.join(__dirname, '..', '..', 'instaposter.db');
const THUMBNAIL_DIR = path.join(__dirname, '..', '..', 'uploads', 'thumbnails');
const DELAY_MS = 7000; // stay under 10 RPM Gemini free tier

const db = new Database(DB_PATH);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildCaption(analysis) {
    const caption = analysis.suggested_caption || '';
    const tags = Array.isArray(analysis.hashtags) ? analysis.hashtags : [];
    if (tags.length === 0) return caption;
    return `${caption}\n\n${tags.slice(0, 20).join(' ')}`;
}

// ── Step 1: Reset FAILED → APPROVED ──────────────────────────────────────────

const failedItems = db.prepare(
    `SELECT id, rejection_reason FROM media_queue WHERE status = 'FAILED'`
).all();

logger.info(`\n━━ Step 1: Resetting ${failedItems.length} FAILED items → APPROVED ━━`);

for (const item of failedItems) {
    db.prepare(
        `UPDATE media_queue SET status = 'APPROVED', rejection_reason = NULL WHERE id = ?`
    ).run(item.id);
    logger.info({ id: item.id, was: item.rejection_reason?.substring(0, 60) }, '[Reset] FAILED → APPROVED');
}

// ── Step 2: Re-analyze Gemini-error REJECTED items ───────────────────────────

const geminiErrorItems = db.prepare(`
    SELECT id, google_base_url, ai_score
    FROM media_queue
    WHERE status = 'REJECTED'
    AND rejection_reason LIKE '%Gemini error%'
`).all();

logger.info(`\n━━ Step 2: Re-analyzing ${geminiErrorItems.length} Gemini-error REJECTED items ━━`);

const minScore = parseInt(db.prepare(`SELECT value FROM settings WHERE key = 'min_ai_score_threshold'`).get()?.value) || 7;
logger.info({ minScore }, '[Reanalyze] Using score threshold');

let approved = 0, rejected = 0, skipped = 0;

for (let i = 0; i < geminiErrorItems.length; i++) {
    const item = geminiErrorItems[i];
    const cachePath = path.join(THUMBNAIL_DIR, `${item.id}.jpg`);

    // Check local cache
    let buffer;
    try {
        buffer = await fs.readFile(cachePath);
        logger.info({ id: item.id, index: `${i + 1}/${geminiErrorItems.length}` }, '[Reanalyze] Analyzing from local cache...');
    } catch {
        logger.warn({ id: item.id }, '[Reanalyze] No local cache — skipping (need fresh Google token to re-pick)');
        skipped++;
        continue;
    }

    const analysis = await analyzePhoto(buffer, 'image/jpeg');

    if (!analysis || analysis._apiError) {
        logger.warn({ id: item.id, reason: analysis?.rejection_reason }, '[Reanalyze] API error again — skipping');
        skipped++;
    } else {
        const newStatus = (analysis.instagram_ready && analysis.aesthetic_score >= minScore)
            ? 'APPROVED'
            : 'REJECTED';

        const updates = {
            status: newStatus,
            ai_score: analysis.aesthetic_score,
            mood: analysis.mood,
            subject: analysis.subject,
            suggested_caption: buildCaption(analysis),
            hashtags: JSON.stringify(analysis.hashtags || []),
            crop_recommendation: analysis.crop_recommendation || null,
            rejection_reason: newStatus === 'REJECTED' ? (analysis.rejection_reason || null) : null,
        };

        db.prepare(`
            UPDATE media_queue SET
                status = ?,
                ai_score = ?,
                mood = ?,
                subject = ?,
                suggested_caption = ?,
                hashtags = ?,
                crop_recommendation = ?,
                rejection_reason = ?
            WHERE id = ?
        `).run(
            updates.status, updates.ai_score, updates.mood, updates.subject,
            updates.suggested_caption, updates.hashtags, updates.crop_recommendation,
            updates.rejection_reason, item.id
        );

        if (newStatus === 'APPROVED') approved++;
        else rejected++;

        logger.info({
            id: item.id,
            score: analysis.aesthetic_score,
            status: newStatus,
            subject: analysis.subject,
        }, `[Reanalyze] ✅ ${newStatus}`);
    }

    // Throttle — stay under Gemini 10 RPM
    if (i < geminiErrorItems.length - 1) {
        logger.info(`[Reanalyze] Waiting ${DELAY_MS / 1000}s before next photo...`);
        await sleep(DELAY_MS);
    }
}

// ── Summary ───────────────────────────────────────────────────────────────────

const finalStats = db.prepare(`
    SELECT status, COUNT(*) as count FROM media_queue GROUP BY status
`).all();

logger.info({
    resetToApproved: failedItems.length,
    reanalyzed: geminiErrorItems.length - skipped,
    newlyApproved: approved,
    stillRejected: rejected,
    skipped,
}, '\n━━ Re-analysis complete ━━');

logger.info({ finalStats }, 'Final DB stats');
