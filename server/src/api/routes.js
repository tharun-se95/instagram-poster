import express from 'express';
import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as db from '../models/db.js';
import { runCurationBatch, runPostingCycle, postSpecificItem, getPostingProgress, startScheduler, stopScheduler } from '../services/automationService.js';
import { regenerateCaption, analyzePhoto } from '../services/geminiService.js';
import { downloadForAnalysis } from '../services/mediaBridgeService.js';
import { logger } from '../utils/logger.js';
import { hasEditedVersion, loadEditedImage, deleteEditedVersion, EDITED_DIR } from '../services/editingService.js';
import { sharpEditAndSave } from '../services/sharpEditingService.js';
import { generateImage, saveGeneratedImage, GENERATED_DIR } from '../services/pollinationsService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THUMBNAIL_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'thumbnails');
fs.mkdir(THUMBNAIL_DIR, { recursive: true }).catch(() => {});

const router = express.Router();

// Closure to handle the in-memory token
let currentGoogleAccessToken = null;
let reanalyzeProgress = { running: false, total: 0, done: 0, current: null, errors: [], quotaExhausted: false };

// Per-item edit progress: Map<itemId, { status, error }>
const editProgress = new Map();

export const setGoogleToken = (token) => {
    currentGoogleAccessToken = token;
};

export const getGoogleToken = () => currentGoogleAccessToken;

// Health check
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Dashboard stats
router.get('/stats', (req, res) => {
    res.json(db.getStats());
});

// Get the media queue
router.get('/queue', (req, res) => {
    const { status, limit, created_after } = req.query;
    const items = db.getQueue(status || null, parseInt(limit) || 50, created_after || null);
    const parsed = items.map((item) => ({
        ...item,
        hashtags: (() => { try { return JSON.parse(item.hashtags); } catch { return []; } })(),
        editing_suggestions: (() => { try { return JSON.parse(item.editing_suggestions); } catch { return []; } })(),
        sharp_params: (() => { try { return item.sharp_params ? JSON.parse(item.sharp_params) : null; } catch { return null; } })(),
    }));
    res.json(parsed);
});

// Receive Google access token
router.post('/auth/google', (req, res) => {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ error: 'accessToken required' });
    setGoogleToken(accessToken);
    db.saveToken('google', accessToken, new Date(Date.now() + 3600 * 1000).toISOString());
    res.json({ success: true, message: 'Google token stored' });
});

// Start curation
router.post('/curate', async (req, res) => {
    const { photos } = req.body;
    if (!photos || !Array.isArray(photos) || photos.length === 0) {
        return res.status(400).json({ error: 'photos array required' });
    }
    if (!currentGoogleAccessToken) {
        return res.status(401).json({ error: 'Google not authenticated. POST /api/auth/google first.' });
    }

    res.json({ success: true, message: `Processing ${photos.length} photos in background...` });

    runCurationBatch(photos, currentGoogleAccessToken)
        .then(({ approved, rejected, skipped }) => {
            logger.info({ approved, rejected, skipped }, '[API] Curation batch completed');
            if (skipped > 0) {
                logger.warn({ skipped }, '[API] Some photos skipped due to Gemini API errors — they were NOT marked as rejected');
            }
        })
        .catch((err) => logger.error({ err: err.message }, '[API] Curation error'));
});

// Approve item
router.post('/queue/:id/approve', (req, res) => {
    db.updateStatus(req.params.id, 'APPROVED');
    res.json({ success: true });
});

// Reject item
router.post('/queue/:id/reject', (req, res) => {
    db.updateStatus(req.params.id, 'REJECTED', { rejection_reason: req.body.reason || 'Manual rejection' });
    res.json({ success: true });
});

// Update caption
router.patch('/queue/:id/caption', (req, res) => {
    const { caption } = req.body;
    if (!caption) return res.status(400).json({ error: 'caption required' });
    db.updateCaption(req.params.id, caption);
    res.json({ success: true });
});

// Regenerate caption
router.post('/queue/:id/regenerate-caption', async (req, res) => {
    const item = db.getQueue(null).find((i) => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const niche = db.getSetting('niche') || 'lifestyle';
    const newCaption = await regenerateCaption(item.subject, item.mood, niche);
    if (newCaption) {
        db.updateCaption(item.id, newCaption);
        res.json({ success: true, caption: newCaption });
    } else {
        res.status(500).json({ error: 'Gemini caption generation failed' });
    }
});

// Auto-post: picks highest-score APPROVED item
router.post('/post/now', async (req, res) => {
    const result = await runPostingCycle(currentGoogleAccessToken);
    res.json(result);
});

// Manual post: post a specific item chosen by the user
router.post('/queue/:id/post', async (req, res) => {
    const result = await postSpecificItem(req.params.id, currentGoogleAccessToken);
    res.json(result);
});

// Live posting progress — poll this while item.status === 'POSTING'
// Returns { stage, label, percent, startedAt } or null when done
router.get('/queue/:id/post-progress', (req, res) => {
    const progress = getPostingProgress(req.params.id);
    res.json(progress);
});

// Scheduler controls
router.post('/scheduler/pause', (req, res) => {
    db.setSetting('posting_paused', 'true');
    res.json({ success: true, message: 'Posting paused' });
});

router.post('/scheduler/resume', (req, res) => {
    db.setSetting('posting_paused', 'false');
    res.json({ success: true, message: 'Posting resumed' });
});

// Settings
router.get('/settings', (req, res) => {
    const keys = ['posting_paused', 'daily_post_limit', 'min_ai_score_threshold', 'niche', 'post_times', 'test_mode'];
    const settings = {};
    for (const key of keys) settings[key] = db.getSetting(key);
    res.json(settings);
});

router.patch('/settings', (req, res) => {
    const allowed = ['daily_post_limit', 'min_ai_score_threshold', 'niche', 'test_mode'];
    for (const key of allowed) {
        if (req.body[key] !== undefined) db.setSetting(key, req.body[key]);
    }
    res.json({ success: true });
});

// Thumbnail proxy — serves from local cache, falls back to Google, then caches locally
router.get('/queue/:id/thumbnail', async (req, res) => {
    const itemId = req.params.id;
    const localPath = path.join(THUMBNAIL_DIR, `${itemId}.jpg`);

    // Serve from local cache first (survives token expiry)
    try {
        const cached = await fs.readFile(localPath);
        res.set('Content-Type', 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        return res.send(cached);
    } catch { /* not cached yet */ }

    // Fetch from Google and cache locally
    try {
        const item = db.getQueueItemById(itemId);
        if (!item?.google_base_url) return res.status(404).send('Not found');

        const baseUrl = item.google_base_url;
        const url = baseUrl.includes('=w') ? baseUrl : `${baseUrl}=w600`;
        const token = currentGoogleAccessToken;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const response = await axios.get(url, { headers, responseType: 'arraybuffer', timeout: 8000 });
        const buffer = Buffer.from(response.data);

        // Cache to disk — fire and forget
        fs.writeFile(localPath, buffer).catch(() => {});

        res.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(buffer);
    } catch (e) {
        logger.warn({ err: e.message }, '[API] Thumbnail proxy failed');
        res.status(502).send('Thumbnail unavailable');
    }
});

// POST — re-analyze a single queue item on demand
router.post('/queue/:id/reanalyze', async (req, res) => {
    const item = db.getQueueItemById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    let imageBuffer, mimeType = 'image/jpeg';
    const localPath = path.join(THUMBNAIL_DIR, `${item.id}.jpg`);

    try {
        imageBuffer = await fs.readFile(localPath);
        logger.info({ id: item.id }, '[Reanalyze] Using cached thumbnail');
    } catch {
        const token = currentGoogleAccessToken || db.getToken('google')?.access_token;
        if (!token) return res.status(401).json({ error: 'No Google token — reconnect Google Photos' });
        const url = item.google_base_url.includes('=w') ? item.google_base_url : `${item.google_base_url}=w1080`;
        try {
            const { buffer, contentType } = await downloadForAnalysis(url, token);
            imageBuffer = buffer;
            mimeType = contentType;
            fs.writeFile(localPath, imageBuffer).catch(() => {});
        } catch (e) {
            return res.status(502).json({ error: `Failed to download image: ${e.message}` });
        }
    }

    const analysis = await analyzePhoto(imageBuffer, mimeType);
    if (analysis._apiError) {
        return res.status(503).json({ error: analysis.rejection_reason || 'Gemini API error' });
    }

    db.updateQueueItemAnalysis(item.id, {
        editing_suggestions: analysis.editing_suggestions || [],
        suggested_caption: analysis.suggested_caption || item.suggested_caption,
        hashtags: analysis.hashtags || [],
        subject: analysis.subject || item.subject,
        mood: analysis.mood || item.mood,
        crop_recommendation: analysis.crop_recommendation || item.crop_recommendation,
        ai_score: analysis.aesthetic_score || item.ai_score,
        sharp_params: analysis.sharp_params || null,
    });

    logger.info({ id: item.id, score: analysis.aesthetic_score }, '[Reanalyze] ✅ Single item re-analyzed');
    res.json({ success: true, score: analysis.aesthetic_score, subject: analysis.subject });
});

// GET reanalysis progress
router.get('/reanalyze-approved/progress', (req, res) => {
    res.json(reanalyzeProgress);
});

// POST — triggers background re-analysis of all APPROVED items
router.post('/reanalyze-approved', async (req, res) => {
    if (reanalyzeProgress.running) {
        return res.status(409).json({ error: 'Reanalysis already in progress' });
    }

    const items = db.getQueue('APPROVED', 100);
    if (items.length === 0) return res.json({ message: 'No APPROVED items to reanalyze', total: 0 });

    reanalyzeProgress = { running: true, total: items.length, done: 0, current: null, errors: [], quotaExhausted: false };
    res.json({ success: true, message: `Reanalysis started for ${items.length} items`, total: items.length });

    // Run in background
    (async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const isDailyQuota = (err) => err?.message?.includes('GenerateRequestsPerDay');

        for (const item of items) {
            reanalyzeProgress.current = { id: item.id, subject: item.subject };
            try {
                // Try local thumbnail cache first
                let imageBuffer;
                let mimeType = 'image/jpeg';
                const localPath = path.join(THUMBNAIL_DIR, `${item.id}.jpg`);
                try {
                    imageBuffer = await fs.readFile(localPath);
                    logger.info({ id: item.id }, '[Reanalyze] Using cached thumbnail');
                } catch {
                    // Fall back to Google download
                    logger.info({ id: item.id }, '[Reanalyze] Downloading from Google Photos');
                    const token = currentGoogleAccessToken || db.getToken('google')?.access_token;
                    if (!token) throw new Error('No Google token available');
                    const url = item.google_base_url.includes('=w')
                        ? item.google_base_url
                        : `${item.google_base_url}=w1080`;
                    const { buffer, contentType } = await downloadForAnalysis(url, token);
                    imageBuffer = buffer;
                    mimeType = contentType;
                    // Cache it for future use
                    fs.writeFile(localPath, imageBuffer).catch(() => {});
                }

                // Re-analyze with Gemini
                const analysis = await analyzePhoto(imageBuffer, mimeType);

                if (analysis._apiError) {
                    // Daily quota exhausted — stop the entire batch immediately
                    if (isDailyQuota({ message: analysis.rejection_reason })) {
                        logger.warn('[Reanalyze] Daily Gemini quota exhausted — stopping batch');
                        reanalyzeProgress.quotaExhausted = true;
                        reanalyzeProgress.done++;
                        break;
                    }
                    throw new Error(analysis.rejection_reason || 'Gemini API error');
                }

                // Update DB — preserve APPROVED status, only update AI analysis fields
                db.updateQueueItemAnalysis(item.id, {
                    editing_suggestions: analysis.editing_suggestions || [],
                    suggested_caption: analysis.suggested_caption || item.suggested_caption,
                    hashtags: analysis.hashtags || [],
                    subject: analysis.subject || item.subject,
                    mood: analysis.mood || item.mood,
                    crop_recommendation: analysis.crop_recommendation || item.crop_recommendation,
                    ai_score: analysis.aesthetic_score || item.ai_score,
                    sharp_params: analysis.sharp_params || null,
                });

                logger.info({ id: item.id, subject: analysis.subject, score: analysis.aesthetic_score },
                    '[Reanalyze] ✅ Updated');

            } catch (err) {
                logger.error({ id: item.id, err: err.message }, '[Reanalyze] ❌ Failed');
                reanalyzeProgress.errors.push({ id: item.id, error: err.message });

                // Also stop the batch if a daily quota error surfaces in a thrown error
                if (isDailyQuota(err)) {
                    logger.warn('[Reanalyze] Daily Gemini quota exhausted — stopping batch');
                    reanalyzeProgress.quotaExhausted = true;
                    reanalyzeProgress.done++;
                    break;
                }
            }

            reanalyzeProgress.done++;

            // Rate limit: ~7s between calls to stay under 10 RPM
            if (reanalyzeProgress.done < items.length) await sleep(7000);
        }

        reanalyzeProgress.running = false;
        reanalyzeProgress.current = null;
        logger.info({ done: reanalyzeProgress.done, errors: reanalyzeProgress.errors.length, quotaExhausted: reanalyzeProgress.quotaExhausted },
            '[Reanalyze] Batch complete');
    })();
});

// Serve edited image (for before/after preview in frontend)
router.get('/queue/:id/edited-image', async (req, res) => {
    const editedPath = path.join(EDITED_DIR, `${req.params.id}.jpg`);
    try {
        const buffer = await fs.readFile(editedPath);
        res.set('Content-Type', 'image/jpeg');
        res.set('Cache-Control', 'no-store'); // always fresh
        return res.send(buffer);
    } catch {
        res.status(404).send('No edited version');
    }
});

// Check if edited version exists
router.get('/queue/:id/edited-status', async (req, res) => {
    const edited = await hasEditedVersion(req.params.id);
    const prog = editProgress.get(req.params.id);
    res.json({ edited, status: prog?.status || (edited ? 'done' : 'none'), error: prog?.error || null });
});

// Trigger editing for a single item (fire and forget)
router.post('/queue/:id/edit', async (req, res) => {
    const item = db.getQueueItemById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const suggestions = (() => { try { return JSON.parse(item.editing_suggestions); } catch { return []; } })();
    // Parse pre-computed Sharp params from Gemini vision (may be null for older items)
    const sharpParams = (() => { try { return item.sharp_params ? JSON.parse(item.sharp_params) : null; } catch { return null; } })();

    // Need either sharp_params or editing_suggestions to proceed
    if (!sharpParams && suggestions.length === 0) {
        return res.status(400).json({ error: 'No editing data available — run reanalysis first' });
    }

    if (editProgress.get(item.id)?.status === 'running') {
        return res.status(409).json({ error: 'Edit already in progress' });
    }

    editProgress.set(item.id, { status: 'running', error: null });
    const source = sharpParams ? 'Gemini vision params' : 'keyword parser';
    res.json({ success: true, message: `Editing started (${source})` });

    // Background editing
    (async () => {
        try {
            const localPath = path.join(THUMBNAIL_DIR, `${item.id}.jpg`);
            let imageBuffer;
            try {
                imageBuffer = await fs.readFile(localPath);
            } catch {
                const token = currentGoogleAccessToken || db.getToken('google')?.access_token;
                if (!token) throw new Error('No Google token and no local thumbnail');
                const url = item.google_base_url.includes('=w') ? item.google_base_url : `${item.google_base_url}=w1080`;
                const { buffer } = await downloadForAnalysis(url, token);
                imageBuffer = buffer;
                fs.writeFile(localPath, imageBuffer).catch(() => {});
            }

            // Pass pre-computed sharp_params so sharpEditingService skips re-parsing
            await sharpEditAndSave(item.id, imageBuffer, suggestions, sharpParams);
            editProgress.set(item.id, { status: 'done', error: null });
            logger.info({ id: item.id, source }, '[Edit] ✅ Sharp edit complete');
        } catch (err) {
            logger.error({ id: item.id, err: err.message }, '[Edit] ❌ Edit failed');
            editProgress.set(item.id, { status: 'error', error: err.message });
        }
    })();
});

// Revert to original (delete edited version)
router.delete('/queue/:id/edit', async (req, res) => {
    await deleteEditedVersion(req.params.id);
    editProgress.delete(req.params.id);
    res.json({ success: true });
});

// ─── Image Generation (Pollinations.ai) ───────────────────────────────────

// Generate a new image
router.post('/generate', async (req, res) => {
    const { prompt, model = 'flux', width = 1080, height = 1080, caption } = req.body;
    if (!prompt || prompt.trim().length === 0) {
        return res.status(400).json({ error: 'prompt is required' });
    }

    const id = crypto.randomUUID();
    try {
        const buffer = await generateImage(prompt.trim(), { model, width, height });
        const imagePath = await saveGeneratedImage(id, buffer);
        db.insertGeneratedImage({
            id,
            prompt: prompt.trim(),
            model,
            width,
            height,
            image_path: imagePath,
            status: 'DRAFT',
            caption: caption || null,
            hashtags: [],
        });

        logger.info({ id, model, width, height }, '[Generate] Image generated');
        res.json({ success: true, id, imageUrl: `/api/generate/${id}/image` });
    } catch (err) {
        logger.error({ err: err.message }, '[Generate] Failed');
        res.status(502).json({ error: err.message });
    }
});

// Get generation history
router.get('/generate/history', (req, res) => {
    res.json(db.getGeneratedImages());
});

// Serve generated image file
router.get('/generate/:id/image', async (req, res) => {
    const item = db.getGeneratedImageById(req.params.id);
    if (!item?.image_path) return res.status(404).send('Not found');
    try {
        const buffer = await fs.readFile(item.image_path);
        res.set('Content-Type', 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=3600');
        res.send(buffer);
    } catch {
        res.status(404).send('Image file not found');
    }
});

// Queue a generated image for Instagram posting
router.post('/generate/:id/queue', (req, res) => {
    const item = db.getGeneratedImageById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Generated image not found' });

    const caption = req.body.caption || item.caption || `AI generated image. ${item.prompt}`;
    const hashtags = req.body.hashtags || [];

    // Insert into media_queue so the posting pipeline picks it up
    db.insertQueueItem({
        id: item.id,
        google_base_url: 'generated', // placeholder — thumbnail is already cached locally
        original_width: item.width,
        original_height: item.height,
        ai_score: 8,
        mood: 'lifestyle',
        subject: item.prompt.slice(0, 100),
        suggested_caption: caption,
        hashtags,
        crop_recommendation: item.width === item.height ? 'square' : 'portrait',
        status: 'APPROVED',
        rejection_reason: null,
        platform: 'INSTAGRAM',
        editing_suggestions: [],
        sharp_params: null,
    });

    db.updateGeneratedImageStatus(item.id, 'QUEUED');
    logger.info({ id: item.id }, '[Generate] Queued for Instagram posting');
    res.json({ success: true, message: 'Added to posting queue' });
});

// Delete a generated image
router.delete('/generate/:id', async (req, res) => {
    const item = db.getGeneratedImageById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });

    if (item.image_path) {
        fs.unlink(item.image_path).catch(() => {});
        fs.unlink(path.join(THUMBNAIL_DIR, `${item.id}.jpg`)).catch(() => {});
    }
    db.deleteGeneratedImage(item.id);
    res.json({ success: true });
});

export default router;
