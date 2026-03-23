import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger.js';
import { CURATION_PROMPT } from './curationPrompt.js';

const _modelCache = {};
function getModel(modelId = 'gemini-2.5-flash') {
    if (!_modelCache[modelId]) {
        const genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY);
        _modelCache[modelId] = genAI.getGenerativeModel({ model: modelId });
    }
    return _modelCache[modelId];
}


const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function analyzePhoto(imageBuffer, mimeType = 'image/jpeg', model = 'gemini-2.5-flash') {
    const base64Image = imageBuffer.toString('base64');

    for (let attempt = 1; attempt <= 2; attempt++) { // max 2 attempts: 1 try + 1 retry
        try {
            const result = await getModel(model).generateContent([
                CURATION_PROMPT,
                { inlineData: { mimeType, data: base64Image } },
            ]);

            const text = result.response.text().trim();
            const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
            return JSON.parse(clean);

        } catch (err) {
            const is429 = err.message?.includes('429');

            if (is429 && attempt === 1) {
                // One retry after a short wait — don't hammer the API
                logger.warn('[Gemini] Rate limited on attempt 1 — waiting 12s before retry');
                await sleep(12000);
                continue;
            }

            // Non-429 error, or 429 after retry — flag as API error so caller skips the photo
            const reason = is429 ? 'Gemini rate limit (429) — try again later' : err.message;
            logger.error({ err: err.message, attempt }, '[Gemini] Analysis failed — photo will be skipped');
            return { _apiError: true, rejection_reason: reason };
        }
    }
}

export async function regenerateCaption(subject, mood, niche = 'lifestyle', model = 'gemini-2.5-flash') {
    try {
        const prompt = `Write an engaging Instagram caption for a ${mood} photo featuring ${subject}.
Style: ${niche} account. Include 2-3 sentences with emojis and a call-to-action.
Return ONLY the caption text, no JSON.`;

        const result = await getModel(model).generateContent(prompt);
        return result.response.text().trim();
    } catch (err) {
        logger.error({ err: err.message }, '[Gemini] Caption regeneration failed');
        return null;
    }
}

// ── Image generation via Gemini Flash ─────────────────────────────────────────
let _imageModel = null;
function getImageModel() {
    if (!_imageModel) {
        const genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY);
        _imageModel = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash-image',
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        });
    }
    return _imageModel;
}

/**
 * Generate an image from a text prompt using Gemini.
 * Returns a Buffer containing the JPEG image data.
 */
export async function generateImage(prompt) {
    logger.info({ prompt: prompt.slice(0, 80) }, '[Gemini] Generating image...');

    const model = getImageModel();
    const result = await model.generateContent(prompt);
    const response = result.response;

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
            logger.info('[Gemini] ✅ Image generated');
            return Buffer.from(part.inlineData.data, 'base64');
        }
    }

    throw new Error('Gemini did not return an image in the response');
}
