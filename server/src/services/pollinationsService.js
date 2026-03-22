import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'generated');
const THUMBNAIL_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'thumbnails');

await fs.mkdir(GENERATED_DIR, { recursive: true }).catch(() => {});

export { GENERATED_DIR };

export async function generateImage(prompt, { model = 'default', width = 1080, height = 1080, seed } = {}) {
    const encoded = encodeURIComponent(prompt);
    const randomSeed = seed || Math.floor(Math.random() * 999999);

    // Build URL — omit model param when 'default' to let Pollinations choose
    const modelParam = (model && model !== 'default') ? `&model=${model}` : '';
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // Try with full requested dimensions first, then scale down, then no dims
    const dimVariants = [
        { w: width, h: height },
        { w: Math.round(width * 0.67), h: Math.round(height * 0.67) }, // ~720p
        { w: null, h: null }, // let Pollinations decide
    ];

    let lastErr;
    for (const dims of dimVariants) {
        const dimParam = dims.w ? `&width=${dims.w}&height=${dims.h}` : '';
        const url = `https://image.pollinations.ai/prompt/${encoded}?nologo=true&seed=${randomSeed}${dimParam}${modelParam}`;

        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                logger.info({ url, attempt, dims }, '[Pollinations] Generating image...');
                const res = await axios.get(url, {
                    responseType: 'arraybuffer',
                    timeout: 120000,
                    headers: { 'User-Agent': 'InstaPosterPro/1.0' },
                });
                if (!res.data || res.data.byteLength < 5000) {
                    throw new Error('Response too small — likely an error page, not an image');
                }
                logger.info({ bytes: res.data.byteLength, dims }, '[Pollinations] ✅ Image received');
                return Buffer.from(res.data);
            } catch (err) {
                lastErr = err;
                const status = err.response?.status;
                if (status === 429) {
                    logger.warn({ attempt, dims }, '[Pollinations] Rate limited, waiting 20s...');
                    await sleep(20000);
                } else if (status === 500) {
                    logger.warn({ attempt, dims, status }, '[Pollinations] 500 — trying next dimension variant...');
                    break; // move to next dim variant immediately
                } else {
                    throw new Error(`Pollinations API error: ${err.message}`);
                }
            }
        }
    }
    throw new Error(`Pollinations failed all dimension variants: ${lastErr?.message}`);
}

export async function saveGeneratedImage(id, buffer) {
    const genPath = path.join(GENERATED_DIR, `${id}.jpg`);
    const thumbPath = path.join(THUMBNAIL_DIR, `${id}.jpg`);
    await fs.writeFile(genPath, buffer);
    await fs.writeFile(thumbPath, buffer); // so existing /thumbnail endpoint works
    return genPath;
}
