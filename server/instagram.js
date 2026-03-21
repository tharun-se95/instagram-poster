const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const ACCESS_TOKEN = process.env.VITE_INSTAGRAM_ACCESS_TOKEN;
const BUSINESS_ID = process.env.VITE_INSTAGRAM_BUSINESS_ID;
const API_VERSION = process.env.VITE_IG_API_VERSION || 'v25.0';
const BASE_URL = `https://graph.instagram.com/${API_VERSION}`;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Posts a single image to Instagram Business account.
 * Uses two-phase commit: container creation → publish (with retry).
 */
async function postImage(imageUrl, caption) {
    console.log('[Instagram] Creating media container...');
    const containerRes = await axios.post(`${BASE_URL}/${BUSINESS_ID}/media`, null, {
        params: { image_url: imageUrl, caption, access_token: ACCESS_TOKEN },
    });

    const creationId = containerRes.data.id;
    console.log('[Instagram] Container ID:', creationId);

    // Retry publish up to 10 times (Instagram needs time to process)
    for (let attempt = 1; attempt <= 10; attempt++) {
        try {
            console.log(`[Instagram] Publish attempt ${attempt}/10...`);
            const publishRes = await axios.post(`${BASE_URL}/${BUSINESS_ID}/media_publish`, null, {
                params: { creation_id: creationId, access_token: ACCESS_TOKEN },
            });
            console.log('[Instagram] Published! Post ID:', publishRes.data.id);
            return publishRes.data.id;
        } catch (err) {
            const subcode = err.response?.data?.error?.error_subcode;
            if (subcode === 2207027 && attempt < 10) {
                console.log('[Instagram] Media not ready, waiting 6s...');
                await delay(6000);
            } else {
                throw err;
            }
        }
    }
}

/**
 * Publishes a Reel to Instagram.
 * Video must be at a publicly accessible URL.
 */
async function postReel(videoUrl, caption) {
    console.log('[Instagram] Creating Reel container...');
    const containerRes = await axios.post(`${BASE_URL}/${BUSINESS_ID}/media`, null, {
        params: {
            media_type: 'REELS',
            video_url: videoUrl,
            caption,
            share_to_feed: true,
            access_token: ACCESS_TOKEN,
        },
    });

    const creationId = containerRes.data.id;
    console.log('[Instagram] Reel container ID:', creationId);

    // Reels take longer to process — poll status
    for (let attempt = 1; attempt <= 15; attempt++) {
        await delay(8000);
        const statusRes = await axios.get(`${BASE_URL}/${creationId}`, {
            params: { fields: 'status_code', access_token: ACCESS_TOKEN },
        });

        const status = statusRes.data.status_code;
        console.log(`[Instagram] Reel status (attempt ${attempt}): ${status}`);

        if (status === 'FINISHED') {
            const publishRes = await axios.post(`${BASE_URL}/${BUSINESS_ID}/media_publish`, null, {
                params: { creation_id: creationId, access_token: ACCESS_TOKEN },
            });
            console.log('[Instagram] Reel published! ID:', publishRes.data.id);
            return publishRes.data.id;
        } else if (status === 'ERROR') {
            throw new Error('Instagram rejected the Reel during processing.');
        }
    }
    throw new Error('Reel timed out during Instagram processing.');
}

module.exports = { postImage, postReel };
