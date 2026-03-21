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

export async function generateImage(prompt, { model = 'flux', width = 1080, height = 1080, seed } = {}) {
    const encoded = encodeURIComponent(prompt);
    const randomSeed = seed || Math.floor(Math.random() * 999999);
    const url = `https://image.pollinations.ai/prompt/${encoded}?model=${model}&width=${width}&height=${height}&nologo=true&seed=${randomSeed}`;

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    let lastErr;
    for (let attempt = 1; attempt <= 4; attempt++) {
        try {
            logger.info({ url, attempt }, '[Pollinations] Generating image...');
            const res = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 90000,
                headers: { 'User-Agent': 'InstaPosterPro/1.0' },
            });
            return Buffer.from(res.data);
        } catch (err) {
            lastErr = err;
            const status = err.response?.status;
            if (status === 429) {
                const wait = attempt * 15000;
                logger.warn({ attempt, wait }, '[Pollinations] Rate limited, waiting...');
                await sleep(wait);
            } else {
                throw new Error(`Pollinations API error: ${err.message}`);
            }
        }
    }
    throw new Error(`Pollinations rate limit exceeded after retries: ${lastErr?.message}`);
}

export async function saveGeneratedImage(id, buffer) {
    const genPath = path.join(GENERATED_DIR, `${id}.jpg`);
    const thumbPath = path.join(THUMBNAIL_DIR, `${id}.jpg`);
    await fs.writeFile(genPath, buffer);
    await fs.writeFile(thumbPath, buffer); // so existing /thumbnail endpoint works
    return genPath;
}
