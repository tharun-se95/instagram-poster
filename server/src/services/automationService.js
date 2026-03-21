import cron from 'node-cron';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as db from '../models/db.js';
import { analyzePhoto } from './geminiService.js';
import { bridgeToPublic, bridgeFromBuffer, downloadForAnalysis, cropToInstagramRatio } from './mediaBridgeService.js';
import { postImage, archivePost } from './instagramService.js';
import { loadEditedImage } from './editingService.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THUMBNAIL_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'thumbnails');

let cronJobs = [];
let isPostingNow = false;

// In-memory progress tracking — keyed by item ID
// { stage, label, percent, startedAt }
const postingProgress = new Map();

function setProgress(itemId, stage, label, percent) {
    postingProgress.set(itemId, { stage, label, percent, startedAt: postingProgress.get(itemId)?.startedAt ?? Date.now() });
}

export function getPostingProgress(itemId) {
    return postingProgress.get(itemId) ?? null;
}

function generateId() {
    return randomUUID();
}

export async function runCurationBatch(photos, googleAccessToken) {
    logger.info({ count: photos.length }, '[Automation] Starting curation batch');
    const minScore = parseInt(db.getSetting('min_ai_score_threshold')) || 7;
    let approved = 0, rejected = 0, skipped = 0;

    for (const photo of photos) {
        try {
            logger.info({ url: photo.url.substring(0, 50) }, '[Automation] Analyzing photo');
            const { buffer, contentType } = await downloadForAnalysis(photo.url, googleAccessToken);
            const analysis = await analyzePhoto(buffer, contentType);

            // Null-safety: analyzePhoto should always return, but guard anyway
            if (!analysis) {
                skipped++;
                logger.warn('[Automation] analyzePhoto returned null — skipping photo');
                continue;
            }

            // API error (rate limit, network, timeout) — skip entirely, do NOT store as REJECTED
            // _apiError = transient failure, not a content decision
            if (analysis._apiError) {
                skipped++;
                logger.warn({ reason: analysis.rejection_reason }, '[Automation] Photo skipped — AI API error, not a content rejection');
                continue;
            }

            logger.info({
                score: analysis.aesthetic_score,
                ready: analysis.instagram_ready,
                subject: analysis.subject
            }, '[Automation] Analysis result');

            const status = (analysis.instagram_ready && analysis.aesthetic_score >= minScore)
                ? 'APPROVED'
                : 'REJECTED';

            if (status === 'APPROVED') approved++;
            else rejected++;

            const itemId = generateId();

            // Cache thumbnail to disk now while buffer is fresh — survives token/URL expiry
            fs.writeFile(path.join(THUMBNAIL_DIR, `${itemId}.jpg`), buffer).catch(() => {});

            db.insertQueueItem({
                id: itemId,
                google_base_url: photo.url,
                original_width: photo.metadata?.width,
                original_height: photo.metadata?.height,
                ai_score: analysis.aesthetic_score,
                mood: analysis.mood,
                subject: analysis.subject,
                suggested_caption: buildCaption(analysis),
                hashtags: analysis.hashtags,
                crop_recommendation: analysis.crop_recommendation,
                editing_suggestions: analysis.editing_suggestions,
                sharp_params: analysis.sharp_params || null,
                status,
                rejection_reason: analysis.rejection_reason || null,
                platform: 'INSTAGRAM',
            });

        } catch (err) {
            logger.error({ err: err.message }, '[Automation] Error processing photo');
        }

        await new Promise((r) => setTimeout(r, 7000)); // 7s between photos — stays under 10 RPM free tier
    }

    logger.info({ approved, rejected, skipped }, '[Automation] Batch complete');
    return { approved, rejected, skipped };
}

// ── Core posting logic (shared by auto and manual post) ──────────────────────
async function postItem(item, googleAccessToken) {
    db.updateStatus(item.id, 'POSTING');
    setProgress(item.id, 'preparing', 'Preparing image…', 10);
    logger.info({ id: item.id, subject: item.subject, score: item.ai_score }, '[Automation] Posting item');

    try {
        // Priority: edited version → local thumbnail cache → Google Photos download
        let imageBuffer;
        const localCachePath = path.join(THUMBNAIL_DIR, `${item.id}.jpg`);

        // 1. Try Nano Banana edited version first
        const editedBuffer = await loadEditedImage(item.id);
        if (editedBuffer) {
            imageBuffer = editedBuffer;
            logger.info({ id: item.id }, '[Automation] Using Nano Banana edited image');
        } else {
            // 2. Fall back to local thumbnail cache
            try {
                imageBuffer = await fs.readFile(localCachePath);
                logger.info({ id: item.id }, '[Automation] Using local image cache');
            } catch {
                logger.warn({ id: item.id }, '[Automation] Local cache miss — downloading from Google Photos');
                if (item.google_base_url === 'generated') {
                    throw new Error('Generated image file not found in cache — please re-generate the image');
                }
                setProgress(item.id, 'bridging', 'Downloading from Google Photos…', 20);
                const googleToken = googleAccessToken || db.getToken('google')?.access_token;
                if (!googleToken) throw new Error('No Google access token available and no local cache found');
                const googleUrl = item.google_base_url.includes('=w') ? item.google_base_url : `${item.google_base_url}=w1080`;
                const { buffer } = await downloadForAnalysis(googleUrl, googleToken);
                imageBuffer = buffer;
            }
        }

        // Crop to a valid Instagram aspect ratio (4:5 → 1.91:1) before uploading
        setProgress(item.id, 'preparing', 'Adjusting aspect ratio…', 28);
        imageBuffer = await cropToInstagramRatio(imageBuffer);

        setProgress(item.id, 'bridging', 'Uploading to public bridge…', 38);
        const publicUrl = await bridgeFromBuffer(imageBuffer);

        const caption = buildCaption({
            suggested_caption: item.suggested_caption,
            hashtags: JSON.parse(item.hashtags || '[]'),
        });

        // postImage emits 'creating_container' (50%) and 'publishing' (75%) via onProgress
        const postId = await postImage(publicUrl, caption, (stage, label, percent) => {
            setProgress(item.id, stage, label, percent);
        });

        db.updateStatus(item.id, 'POSTED', {
            platform_post_id: postId,
            posted_at: new Date().toISOString(),
        });

        // Test mode: archive immediately so post is hidden from public grid
        const testMode = db.getSetting('test_mode') === 'true';
        let archived = false;
        if (testMode) {
            setProgress(item.id, 'archiving', 'Archiving post (test mode)…', 92);
            archived = await archivePost(postId);
            if (!archived) {
                logger.warn({ postId }, '[Automation] Archive failed — post is live despite test mode');
            }
        }

        postingProgress.delete(item.id); // clean up — signals completion to polling clients
        logger.info({ postId, testMode, archived }, '[Automation] ✅ Posted successfully');
        return { success: true, postId, archived };

    } catch (err) {
        postingProgress.delete(item.id);
        logger.error({ err: err.message }, '[Automation] ❌ Posting failed');
        db.updateStatus(item.id, 'FAILED', { rejection_reason: err.message });
        return { success: false, error: err.message };
    }
}

// Auto-post: picks the highest-score APPROVED item
export async function runPostingCycle(googleAccessToken) {
    if (isPostingNow) {
        logger.info('[Automation] Post cycle skipped — already posting');
        return { success: false, error: 'Already posting' };
    }

    const paused = db.getSetting('posting_paused') === 'true';
    if (paused) {
        logger.info('[Automation] Posting is paused');
        return { success: false, error: 'Posting is paused' };
    }

    const next = db.getNextPendingPost();
    if (!next) {
        logger.info('[Automation] Queue empty — nothing to post');
        return { success: false, error: 'No approved items in queue' };
    }

    isPostingNow = true;
    try {
        return await postItem(next, googleAccessToken);
    } finally {
        isPostingNow = false;
    }
}

// Manual post: posts a specific item chosen by the user
export async function postSpecificItem(itemId, googleAccessToken) {
    if (isPostingNow) {
        return { success: false, error: 'Another post is already in progress — try again in a moment' };
    }

    const item = db.getQueueItemById(itemId);
    if (!item) return { success: false, error: 'Item not found' };
    if (item.status !== 'APPROVED') return { success: false, error: `Item is ${item.status}, not APPROVED` };

    isPostingNow = true;
    try {
        return await postItem(item, googleAccessToken);
    } finally {
        isPostingNow = false;
    }
}

function buildCaption(analysis) {
    const caption = analysis.suggested_caption || '';
    const tags = Array.isArray(analysis.hashtags) ? analysis.hashtags : [];
    if (tags.length === 0) return caption;
    return `${caption}\n\n${tags.slice(0, 5).join(' ')}`;
}

export function startScheduler(getGoogleToken) {
    cronJobs.forEach((job) => job.stop());
    cronJobs = [];

    const schedules = ['7 9 * * *', '7 19 * * *'];

    for (const schedule of schedules) {
        const job = cron.schedule(schedule, async () => {
            logger.info({ schedule }, '[Scheduler] Triggered');
            await runPostingCycle(getGoogleToken());
        });
        cronJobs.push(job);
    }

    logger.info('[Scheduler] ✅ Posting scheduler started (9:07 AM & 7:07 PM)');
}

export function stopScheduler() {
    cronJobs.forEach((job) => job.stop());
    cronJobs = [];
    logger.info('[Scheduler] Stopped');
}
