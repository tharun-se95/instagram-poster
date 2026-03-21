const axios = require('axios');
const FormData = require('form-data');

/**
 * Downloads a Google Photos URL using OAuth token, then uploads to a temp
 * public host so Instagram can ingest it directly.
 * @param {string} googleUrl - baseUrl from Google Photos Picker API
 * @param {string} accessToken - Valid Google OAuth2 access token
 * @returns {Promise<string>} - A direct public URL ending in .jpg
 */
async function bridgeToPublic(googleUrl, accessToken) {
    // 1. Download from Google (requires auth header)
    console.log('[Bridge] Downloading from Google Photos...');
    const response = await axios.get(googleUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: 'arraybuffer',
    });

    const imageBuffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || 'image/jpeg';

    // 2. Upload to tmpfiles.org (free anonymous temp hosting)
    console.log('[Bridge] Uploading to public bridge...');
    const form = new FormData();
    form.append('file', imageBuffer, {
        filename: `instaposter_${Date.now()}.jpg`,
        contentType,
    });

    const uploadResponse = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
        headers: form.getHeaders(),
    });

    if (uploadResponse.data.status === 'success') {
        // Convert view URL to direct download URL
        const rawUrl = uploadResponse.data.data.url;
        const directUrl = rawUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        console.log('[Bridge] Public URL ready:', directUrl);
        return directUrl;
    }

    throw new Error('[Bridge] Upload failed: ' + JSON.stringify(uploadResponse.data));
}

/**
 * Downloads an image from a Google Photos URL and returns a Buffer.
 * Used for Gemini analysis without public bridging.
 * @param {string} googleUrl
 * @param {string} accessToken
 * @returns {Promise<{buffer: Buffer, contentType: string}>}
 */
async function downloadForAnalysis(googleUrl, accessToken) {
    const response = await axios.get(googleUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: 'arraybuffer',
    });
    return {
        buffer: Buffer.from(response.data),
        contentType: response.headers['content-type'] || 'image/jpeg',
    };
}

module.exports = { bridgeToPublic, downloadForAnalysis };
