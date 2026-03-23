import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger.js';

let _model = null;
function getModel() {
    if (!_model) {
        const genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY);
        _model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    }
    return _model;
}

const CURATION_PROMPT = `You are an expert Instagram content curator and professional photo editor.
Carefully examine this specific photograph and return ONLY a valid JSON object with no markdown wrapping:
{
  "aesthetic_score": <integer 1-10>,
  "composition": "<one concise sentence>",
  "subject": "<primary subject keyword, e.g. sunset, street, portrait>",
  "mood": "<one of: travel|lifestyle|nature|urban|food|portrait|abstract>",
  "instagram_ready": <true|false>,
  "rejection_reason": "<empty string if ready, brief reason if not>",
  "suggested_caption": "<2-3 sentences with relevant emojis and 2-3 natural keywords woven into the text for SEO. End with a save or share CTA like 'Save this for later ✨', 'Send this to a friend who needs to see this 💫', or 'Share with someone who would love this 🌟'>",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5 — 3 to 5 niche-specific hashtags only, NO generic tags like #photo or #instagood"],
  "crop_recommendation": "<one of: '3:4 portrait'|'4:5 portrait'|'1:1 square'|'use as-is'>",
  "editing_suggestions": [
    "<3-5 editing instructions SPECIFIC to what you observe in THIS image — each under 12 words>",
    "<Base each suggestion on an actual visual issue or opportunity you see: e.g. if the sky is blown out say 'Recover highlights in overexposed sky area'; if a portrait has harsh shadows say 'Fill in under-eye shadows with +15 fill light'; if colors look flat say 'Boost vibrance to make greens and blues pop'; if the subject is backlit say 'Add +0.7 EV exposure compensation for backlit subject'>",
    "<Do NOT copy generic suggestions — look at the actual image lighting, colors, sharpness, and subject before suggesting anything>"
  ],
  "sharp_params": {
    "brightness": <float -0.4 to 0.4; DELTA applied as: Sharp_multiplier = 1 + this_value; 0 = NO CHANGE; 0.15 = 15% brighter; -0.12 = 12% darker>,
    "contrast":   <float -0.4 to 0.4; 0 = NO CHANGE; 0.15 = more contrast/punch; -0.12 = softer/flatter>,
    "saturation": <float -0.25 to 0.5; DELTA applied as: Sharp_multiplier = 1 + this_value; 0 = NO CHANGE — KEEP COLORS AS-IS; 0.15 = mild vibrance boost (slightly dull image); 0.3 = strong boost (very flat/grey image); -0.1 = gently muted/film look; -0.25 = significantly muted. CRITICAL: NEVER return values below -0.25. A value of -1 means PURE BLACK AND WHITE. Almost every photo should use 0 (no change) or a positive value here.>,
    "warmth":     <int -30 to 30; 0 = neutral; 12 = warm golden tones; 20 = strong sunset warmth; -12 = cool/blue tones>,
    "sharpen":    <float 0 to 2.5; unsharp mask sigma; 0 = skip (already sharp); 0.8 = mild; 1.5 = strong>,
    "denoise":    <boolean — true only if image has visible noise or grain>,
    "clahe":      <boolean — true if shadows or highlights need adaptive detail recovery>
  }
}

IMPORTANT for sharp_params:
- Examine the actual image carefully before assigning values.
- All fields are optional — only include those where a non-zero adjustment is needed.
- "brightness": analyse the histogram; typical underexposed indoor shot → 0.15; blown sky → -0.12
- "saturation": 0 means leave colors EXACTLY as they are. Flat/dull colours → 0.15–0.3. Already vibrant → 0 (do NOT go negative). NEVER below -0.25.
- "warmth": candlelit/golden hour → 12–20; cool/overcast → -8 to -15; neutral daylight → 0
- "sharpen": use 0 for already-sharp images; 0.8 for slightly soft; 1.2+ for clearly unsharp
- Return {} (empty object) if the image already looks perfect and needs no adjustment

Scoring guide:
- 9-10: Stunning composition, great lighting, highly shareable
- 7-8: Good quality, Instagram-appropriate
- 5-6: Average, might work with the right caption
- 1-4: Poor lighting, blurry, cluttered, or not visually appealing

Reject if: blurry, severely underexposed/overexposed, cluttered composition,
NSFW, personally identifiable (close-up of strangers' faces without context),
or screenshots/document photos.`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function analyzePhoto(imageBuffer, mimeType = 'image/jpeg') {
    const base64Image = imageBuffer.toString('base64');

    for (let attempt = 1; attempt <= 2; attempt++) { // max 2 attempts: 1 try + 1 retry
        try {
            const result = await getModel().generateContent([
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

export async function regenerateCaption(subject, mood, niche = 'lifestyle') {
    try {
        const prompt = `Write an engaging Instagram caption for a ${mood} photo featuring ${subject}.
Style: ${niche} account. Include 2-3 sentences with emojis and a call-to-action.
Return ONLY the caption text, no JSON.`;

        const result = await getModel().generateContent(prompt);
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
