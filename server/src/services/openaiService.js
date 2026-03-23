/**
 * openaiService.js — OpenAI GPT-4o vision provider
 *
 * Implements the same analyzePhoto / regenerateCaption interface as geminiService,
 * using the OpenAI Chat Completions API with vision support (no SDK required).
 */

import axios from 'axios';
import { logger } from '../utils/logger.js';
import { CURATION_PROMPT } from './curationPrompt.js';

const BASE_URL = 'https://api.openai.com/v1/chat/completions';

function getHeaders() {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is not set');
    return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function analyzePhoto(imageBuffer, mimeType = 'image/jpeg', model = 'gpt-4o') {
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const { data } = await axios.post(BASE_URL, {
                model,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text',      text: CURATION_PROMPT },
                            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
                        ],
                    },
                ],
                max_tokens: 1500,
                temperature: 0.2,
            }, { headers: getHeaders() });

            const text  = data.choices[0].message.content.trim();
            const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
            return JSON.parse(clean);

        } catch (err) {
            const status = err.response?.status;
            const is429  = status === 429 || err.message?.includes('429');

            if (is429 && attempt === 1) {
                logger.warn('[OpenAI] Rate limited on attempt 1 — waiting 12s before retry');
                await sleep(12000);
                continue;
            }

            const reason = is429 ? 'OpenAI rate limit (429) — try again later' : (err.response?.data?.error?.message || err.message);
            logger.error({ err: err.message, attempt, model }, '[OpenAI] Analysis failed — photo will be skipped');
            return { _apiError: true, rejection_reason: reason };
        }
    }
}

export async function regenerateCaption(subject, mood, niche = 'lifestyle', model = 'gpt-4o') {
    try {
        const prompt = `Write an engaging Instagram caption for a ${mood} photo featuring ${subject}.
Style: ${niche} account. Include 2-3 sentences with emojis and a call-to-action.
Return ONLY the caption text, no JSON.`;

        const { data } = await axios.post(BASE_URL, {
            model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 300,
            temperature: 0.7,
        }, { headers: getHeaders() });

        return data.choices[0].message.content.trim();
    } catch (err) {
        logger.error({ err: err.message, model }, '[OpenAI] Caption regeneration failed');
        return null;
    }
}
