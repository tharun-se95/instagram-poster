import axios from 'axios';
import FormData from 'form-data';
import sharp from 'sharp';
import { logger } from '../utils/logger.js';

// Instagram requires aspect ratios between 4:5 (0.8) portrait and 1.91:1 landscape.
// If the image is outside this range, crop to the nearest valid edge (center-crop).
export async function cropToInstagramRatio(imageBuffer) {
    const IG_MIN = 4 / 5;   // 0.8  — tallest portrait allowed
    const IG_MAX = 1.91;    // 1.91 — widest landscape allowed

    const meta = await sharp(imageBuffer).metadata();
    const { width, height } = meta;
    const ratio = width / height;

    if (ratio >= IG_MIN && ratio <= IG_MAX) {
        // Already valid — pass through (re-encode to JPEG to normalise)
        logger.info({ width, height, ratio: ratio.toFixed(3) }, '[Bridge] Aspect ratio OK — no crop needed');
        return sharp(imageBuffer).jpeg({ quality: 92 }).toBuffer();
    }

    let cropW = width;
    let cropH = height;

    if (ratio > IG_MAX) {
        // Too wide — crop width down to max landscape 1.91:1
        cropW = Math.round(height * IG_MAX);
        logger.info({ width, height, ratio: ratio.toFixed(3), cropW, cropH },
            '[Bridge] Image too wide — cropping to 1.91:1');
    } else {
        // Too tall — crop height down to max portrait 4:5
        cropH = Math.round(width / IG_MIN);
        logger.info({ width, height, ratio: ratio.toFixed(3), cropW, cropH },
            '[Bridge] Image too tall — cropping to 4:5');
    }

    // Center-crop
    const left = Math.round((width  - cropW) / 2);
    const top  = Math.round((height - cropH) / 2);

    return sharp(imageBuffer)
        .extract({ left, top, width: cropW, height: cropH })
        .jpeg({ quality: 92 })
        .toBuffer();
}

export async function bridgeFromBuffer(imageBuffer) {
    logger.info('[Bridge] Uploading local image buffer to public bridge...');
    const form = new FormData();
    form.append('file', imageBuffer, {
        filename: `instaposter_${Date.now()}.jpg`,
        contentType: 'image/jpeg',
    });

    const uploadResponse = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
        headers: form.getHeaders(),
        timeout: 30000, // 30s — tmpfiles.org can be slow but shouldn't take longer than this
    });

    if (uploadResponse.data.status === 'success') {
        const rawUrl = uploadResponse.data.data.url;
        const directUrl = rawUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        logger.info({ directUrl }, '[Bridge] Public URL ready (from local cache)');
        return directUrl;
    }

    throw new Error('[Bridge] Upload failed: ' + JSON.stringify(uploadResponse.data));
}

export async function bridgeToPublic(googleUrl, accessToken) {
    logger.info('[Bridge] Downloading from Google Photos...');
    const response = await axios.get(googleUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: 'arraybuffer',
    });

    const imageBuffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || 'image/jpeg';

    logger.info('[Bridge] Uploading to public bridge...');
    const form = new FormData();
    form.append('file', imageBuffer, {
        filename: `instaposter_${Date.now()}.jpg`,
        contentType,
    });

    const uploadResponse = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
        headers: form.getHeaders(),
        timeout: 30000,
    });

    if (uploadResponse.data.status === 'success') {
        const rawUrl = uploadResponse.data.data.url;
        const directUrl = rawUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        logger.info({ directUrl }, '[Bridge] Public URL ready');
        return directUrl;
    }

    throw new Error('[Bridge] Upload failed: ' + JSON.stringify(uploadResponse.data));
}

export async function downloadForAnalysis(googleUrl, accessToken) {
    const response = await axios.get(googleUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: 'arraybuffer',
    });
    return {
        buffer: Buffer.from(response.data),
        contentType: response.headers['content-type'] || 'image/jpeg',
    };
}
