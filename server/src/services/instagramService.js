import axios from 'axios';
import { logger } from '../utils/logger.js';

const getConfig = () => ({
    accessToken: process.env.VITE_INSTAGRAM_ACCESS_TOKEN,
    businessId: process.env.VITE_INSTAGRAM_BUSINESS_ID,
    baseUrl: `https://graph.instagram.com/${process.env.VITE_IG_API_VERSION || 'v25.0'}`,
});

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// onProgress(stage, label, percent) — optional callback for live UI updates
export async function postImage(imageUrl, caption, onProgress) {
    const { accessToken, businessId, baseUrl } = getConfig();
    logger.info({ imageUrl }, '[Instagram] Creating media container...');
    onProgress?.('creating_container', 'Creating media container…', 50);

    let containerRes;
    try {
        containerRes = await axios.post(`${baseUrl}/${businessId}/media`, null, {
            params: { image_url: imageUrl, caption, access_token: accessToken },
        });
    } catch (err) {
        const igError = err.response?.data?.error;
        logger.error({ igError, imageUrl }, '[Instagram] Container creation failed');
        throw new Error(igError?.error_user_msg || igError?.message || err.message);
    }

    const creationId = containerRes.data.id;
    logger.info({ creationId }, '[Instagram] Container ID');
    onProgress?.('publishing', 'Publishing to Instagram…', 75);

    for (let attempt = 1; attempt <= 10; attempt++) {
        try {
            logger.info({ attempt }, '[Instagram] Publish attempt');
            const publishRes = await axios.post(`${baseUrl}/${businessId}/media_publish`, null, {
                params: { creation_id: creationId, access_token: accessToken },
            });
            logger.info({ postId: publishRes.data.id }, '[Instagram] Published!');
            return publishRes.data.id;
        } catch (err) {
            const igError = err.response?.data?.error;
            const subcode = igError?.error_subcode;
            if (subcode === 2207027 && attempt < 10) {
                logger.info('[Instagram] Media not ready, waiting 6s...');
                onProgress?.('publishing', `Media processing… (attempt ${attempt + 1})`, 75);
                await delay(6000);
            } else {
                logger.error({ igError, attempt }, '[Instagram] Publish failed');
                throw new Error(igError?.error_user_msg || igError?.message || err.message);
            }
        }
    }
}

export async function archivePost(postId) {
    const { accessToken, baseUrl } = getConfig();
    logger.info({ postId }, '[Instagram] Archiving post (test mode)...');
    try {
        await axios.post(`${baseUrl}/${postId}`, null, {
            params: { archive: 'true', comment_enabled: 'true', access_token: accessToken },
        });
        logger.info({ postId }, '[Instagram] Post archived — hidden from public grid');
    } catch (err) {
        const igError = err.response?.data?.error;
        logger.warn({ igError, postId }, '[Instagram] Archive failed — post remains public');
    }
}

export async function postReel(videoUrl, caption) {
    const { accessToken, businessId, baseUrl } = getConfig();
    logger.info('[Instagram] Creating Reel container...');
    const containerRes = await axios.post(`${baseUrl}/${businessId}/media`, null, {
        params: {
            media_type: 'REELS',
            video_url: videoUrl,
            caption,
            share_to_feed: true,
            access_token: accessToken,
        },
    });

    const creationId = containerRes.data.id;
    logger.info({ creationId }, '[Instagram] Reel container ID');

    for (let attempt = 1; attempt <= 15; attempt++) {
        await delay(8000);
        const statusRes = await axios.get(`${baseUrl}/${creationId}`, {
            params: { fields: 'status_code', access_token: accessToken },
        });

        const status = statusRes.data.status_code;
        logger.info({ attempt, status }, '[Instagram] Reel status');

        if (status === 'FINISHED') {
            const publishRes = await axios.post(`${baseUrl}/${businessId}/media_publish`, null, {
                params: { creation_id: creationId, access_token: accessToken },
            });
            logger.info({ postId: publishRes.data.id }, '[Instagram] Reel published!');
            return publishRes.data.id;
        } else if (status === 'ERROR') {
            throw new Error('Instagram rejected the Reel during processing.');
        }
    }
    throw new Error('Reel timed out during Instagram processing.');
}
