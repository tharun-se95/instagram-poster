const cron = require('node-cron');
const { v4: uuidv4 } = require('crypto').randomUUID ? { v4: () => require('crypto').randomUUID() } : require('crypto');
const db = require('./db');
const { analyzePhoto } = require('./gemini');
const { bridgeToPublic, downloadForAnalysis } = require('./mediaBridge');
const { postImage } = require('./instagram');

// Simple UUID fallback using crypto
function generateId() {
    return require('crypto').randomUUID();
}

let cronJobs = [];
let isPostingNow = false;

// ─── Main Curation Run ─────────────────────────────────────────────────────
/**
 * Processes a batch of Google Photos URLs through the AI curation pipeline.
 * @param {Array<{url: string, metadata: Object}>} photos
 * @param {string} googleAccessToken
 */
async function runCurationBatch(photos, googleAccessToken) {
    console.log(`\n[Automation] Starting curation batch: ${photos.length} photos`);
    const minScore = parseInt(db.getSetting('min_ai_score_threshold')) || 7;
    let approved = 0, rejected = 0;

    for (const photo of photos) {
        try {
            console.log(`[Automation] Analyzing: ${photo.url.substring(0, 60)}...`);

            // Download for analysis (not bridged yet — saves bridge calls)
            const { buffer, contentType } = await downloadForAnalysis(photo.url, googleAccessToken);

            // Ask Gemini to analyze
            const analysis = await analyzePhoto(buffer, contentType);
            console.log(`[Automation] Score: ${analysis.aesthetic_score}/10 | Ready: ${analysis.instagram_ready} | ${analysis.subject}`);

            const status = (analysis.instagram_ready && analysis.aesthetic_score >= minScore)
                ? 'APPROVED'
                : 'REJECTED';

            if (status === 'APPROVED') approved++;
            else rejected++;

            db.insertQueueItem({
                id: generateId(),
                google_base_url: photo.url,
                original_width: photo.metadata?.width,
                original_height: photo.metadata?.height,
                ai_score: analysis.aesthetic_score,
                mood: analysis.mood,
                subject: analysis.subject,
                suggested_caption: buildCaption(analysis),
                hashtags: analysis.hashtags,
                crop_recommendation: analysis.crop_recommendation,
                status,
                rejection_reason: analysis.rejection_reason || null,
                platform: 'INSTAGRAM',
            });

        } catch (err) {
            console.error('[Automation] Error processing photo:', err.message);
        }

        // Small delay to respect Gemini rate limits
        await new Promise((r) => setTimeout(r, 500));
    }

    console.log(`[Automation] Batch complete: ${approved} approved, ${rejected} rejected`);
    return { approved, rejected };
}

// ─── Auto Posting Loop ─────────────────────────────────────────────────────
/**
 * Called by cron — posts the next approved item in the queue.
 */
async function runPostingCycle(googleAccessToken) {
    if (isPostingNow) {
        console.log('[Automation] Post cycle skipped — already posting.');
        return;
    }

    const paused = db.getSetting('posting_paused') === 'true';
    if (paused) {
        console.log('[Automation] Posting is paused. Skipping cycle.');
        return;
    }

    const next = db.getNextPendingPost();
    if (!next) {
        console.log('[Automation] Queue empty — nothing to post.');
        return;
    }

    isPostingNow = true;
    console.log(`\n[Automation] Posting: "${next.subject}" (Score: ${next.ai_score})`);
    db.updateStatus(next.id, 'POSTING');

    try {
        // Bridge the Google URL to a public URL for Instagram
        const googleToken = googleAccessToken || db.getToken('google')?.access_token;
        if (!googleToken) throw new Error('No Google access token available for bridging');

        const publicUrl = await bridgeToPublic(next.google_base_url, googleToken);

        // Build final caption with hashtags
        const caption = buildCaption({ suggested_caption: next.suggested_caption, hashtags: JSON.parse(next.hashtags || '[]') });

        // Post to Instagram
        const postId = await postImage(publicUrl, caption);

        db.updateStatus(next.id, 'POSTED', {
            platform_post_id: postId,
            posted_at: new Date().toISOString(),
        });

        console.log(`[Automation] ✅ Posted successfully! Instagram ID: ${postId}`);
        return { success: true, postId };

    } catch (err) {
        console.error('[Automation] ❌ Posting failed:', err.response?.data?.error || err.message);
        db.updateStatus(next.id, 'FAILED', { rejection_reason: err.message });
        return { success: false, error: err.message };
    } finally {
        isPostingNow = false;
    }
}

// ─── Caption Builder ───────────────────────────────────────────────────────
function buildCaption(analysis) {
    const caption = analysis.suggested_caption || '';
    const tags = Array.isArray(analysis.hashtags) ? analysis.hashtags : [];
    if (tags.length === 0) return caption;
    return `${caption}\n\n${tags.slice(0, 20).join(' ')}`;
}

// ─── Scheduler ─────────────────────────────────────────────────────────────
function startScheduler(getGoogleToken) {
    // Stop any existing jobs first
    cronJobs.forEach((job) => job.stop());
    cronJobs = [];

    // Post at 9:07 AM and 6:05 PM daily
    const schedules = ['7 9 * * *', '5 18 * * *'];

    for (const schedule of schedules) {
        const job = cron.schedule(schedule, async () => {
            console.log(`\n[Scheduler] Triggered at ${new Date().toLocaleTimeString()}`);
            await runPostingCycle(getGoogleToken());
        });
        cronJobs.push(job);
    }

    console.log('[Scheduler] ✅ Posting scheduler started (9:07 AM & 6:05 PM)');
}

function stopScheduler() {
    cronJobs.forEach((job) => job.stop());
    cronJobs = [];
    console.log('[Scheduler] Stopped.');
}

module.exports = { runCurationBatch, runPostingCycle, startScheduler, stopScheduler };
