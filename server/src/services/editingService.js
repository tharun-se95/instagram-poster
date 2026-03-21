import { GoogleGenAI } from '@google/genai';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const EDITED_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'edited');

// Nano Banana 2 model — gemini's image editing/generation model
const NANO_BANANA_MODEL = 'gemini-3.1-flash-image-preview';

let _ai = null;
function getAI() {
    if (!_ai) {
        _ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY });
    }
    return _ai;
}

// Ensure the edited output directory exists
await fs.mkdir(EDITED_DIR, { recursive: true }).catch(() => {});

/**
 * Apply editing suggestions to an image using Nano Banana 2.
 * All suggestions are combined into a single API call for efficiency.
 *
 * @param {Buffer} imageBuffer - Original JPEG image buffer
 * @param {string[]} suggestions - Array of editing instructions from Gemini curation
 * @returns {Promise<Buffer>} - Edited image buffer (JPEG)
 */
export async function applyEditingSuggestions(imageBuffer, suggestions) {
    if (!suggestions || suggestions.length === 0) {
        throw new Error('No editing suggestions provided');
    }

    const ai = getAI();
    const base64Image = imageBuffer.toString('base64');

    // Build a focused editing prompt from all suggestions
    const suggestionList = suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n');
    const prompt = `You are a professional photo editor. Apply ONLY these specific edits to this photograph:

${suggestionList}

Important:
- Preserve the natural look and authenticity of the photo
- Do not add, remove or change the subject or composition
- Do not add filters or artificial effects beyond what is listed
- Keep people and faces looking natural and unaltered
- Return the edited image at the same resolution as input`;

    logger.info({ model: NANO_BANANA_MODEL, suggestionCount: suggestions.length }, '[EditingService] Sending to Nano Banana 2');

    let response;
    try {
        response = await ai.models.generateContent({
        model: NANO_BANANA_MODEL,
        contents: [
            { text: prompt },
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
        ],
            config: { responseModalities: ['TEXT', 'IMAGE'] },
        });
    } catch (err) {
        // Provide actionable error messages for quota issues
        const msg = err.message || '';
        if (msg.includes('limit: 0')) {
            throw new Error('Nano Banana 2 requires a paid Gemini API plan. Enable billing at aistudio.google.com → Settings → Billing.');
        }
        if (msg.includes('GenerateRequestsPerDay') || msg.includes('RESOURCE_EXHAUSTED')) {
            throw new Error('Gemini image quota exhausted for today. Resets at midnight.');
        }
        throw err;
    }

    // Extract the edited image from response parts
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
        if (part.inlineData?.data) {
            const editedBuffer = Buffer.from(part.inlineData.data, 'base64');
            logger.info({ bytes: editedBuffer.length }, '[EditingService] ✅ Received edited image');
            return editedBuffer;
        }
    }

    // Log text parts if no image returned (usually explains why it refused)
    const textParts = parts.filter((p) => p.text).map((p) => p.text).join(' ');
    throw new Error(`Nano Banana 2 returned no image. Response: ${textParts || 'empty'}`);
}

/**
 * Apply edits and save the result to uploads/edited/{id}.jpg
 * Returns the output path on success.
 */
export async function editAndSave(itemId, imageBuffer, suggestions) {
    const editedBuffer = await applyEditingSuggestions(imageBuffer, suggestions);
    const outputPath = path.join(EDITED_DIR, `${itemId}.jpg`);
    await fs.writeFile(outputPath, editedBuffer);
    logger.info({ id: itemId, path: outputPath }, '[EditingService] Saved edited image');
    return { buffer: editedBuffer, path: outputPath };
}

/**
 * Check if an edited version exists on disk for a given item.
 */
export async function hasEditedVersion(itemId) {
    try {
        await fs.access(path.join(EDITED_DIR, `${itemId}.jpg`));
        return true;
    } catch {
        return false;
    }
}

/**
 * Load the edited image buffer for an item, or null if it doesn't exist.
 */
export async function loadEditedImage(itemId) {
    try {
        return await fs.readFile(path.join(EDITED_DIR, `${itemId}.jpg`));
    } catch {
        return null;
    }
}

/**
 * Delete the edited version (revert to original).
 */
export async function deleteEditedVersion(itemId) {
    try {
        await fs.unlink(path.join(EDITED_DIR, `${itemId}.jpg`));
        return true;
    } catch {
        return false;
    }
}
