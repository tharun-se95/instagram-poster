import axios from 'axios';

/**
 * Bridges a private/protected Google Photos URL to a temporary public URL for Instagram.
 * @param {string} googleUrl - The protected Google Photos baseUrl.
 * @param {string} accessToken - Google OAuth access token.
 * @returns {Promise<string>} - A temporary public direct link to the image.
 */
export const bridgeGooglePhotoToPublic = async (googleUrl, accessToken) => {
    try {
        // 1. Fetch the photo as a blob using the Google token
        const response = await fetch(googleUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to download from Google: ${response.statusText}`);
        }

        const blob = await response.blob();

        // 2. Prepare for upload to tmpfiles.org
        const formData = new FormData();
        // Extract filename from URL or use default
        const filename = googleUrl.split('/').pop().split('?')[0] || 'photo.jpg';
        formData.append('file', blob, filename.endsWith('.jpg') ? filename : `${filename}.jpg`);

        // 3. Upload to tmpfiles.org (Free anonymous hosting)
        const uploadResponse = await axios.post('https://tmpfiles.org/api/v1/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });

        if (uploadResponse.data.status === 'success') {
            const rawUrl = uploadResponse.data.data.url;
            // Convert https://tmpfiles.org/12345/file.jpg to https://tmpfiles.org/dl/12345/file.jpg
            const directUrl = rawUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
            console.log('Media Bridge Success:', directUrl);
            return directUrl;
        } else {
            throw new Error('Anonymous upload failed.');
        }

    } catch (error) {
        console.error('Media Bridge Error:', error);
        throw new Error(`Media Bridge Failed: ${error.message}`);
    }
};
