import axios from 'axios';

const ACCESS_TOKEN = import.meta.env.VITE_INSTAGRAM_ACCESS_TOKEN;
const BUSINESS_ID = import.meta.env.VITE_INSTAGRAM_BUSINESS_ID;
const API_VERSION = import.meta.env.VITE_IG_API_VERSION || 'v25.0';
const API_HOST = import.meta.env.VITE_IG_API_HOST || 'https://graph.instagram.com';
const BASE_URL = `${API_HOST}/${API_VERSION}`;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const postToInstagram = async (imageUrl, caption) => {
    try {
        console.log('Initiating Media Creation on:', BASE_URL);

        // 1. Create a media container
        const containerResponse = await axios.post(`${BASE_URL}/${BUSINESS_ID}/media`, null, {
            params: {
                image_url: imageUrl,
                caption: caption,
                access_token: ACCESS_TOKEN,
            },
        });

        const creationId = containerResponse.data.id;
        console.log('Container Created:', creationId);

        // 2. Publish logic with retry (Instagram needs time to process the image)
        let attempts = 0;
        const maxAttempts = 10; // Total wait time up to 60 seconds

        while (attempts < maxAttempts) {
            try {
                console.log(`Publishing attempt ${attempts + 1} of ${maxAttempts}...`);
                const publishResponse = await axios.post(`${BASE_URL}/${BUSINESS_ID}/media_publish`, null, {
                    params: {
                        creation_id: creationId,
                        access_token: ACCESS_TOKEN,
                    },
                });
                console.log('Published Successfully:', publishResponse.data.id);
                return publishResponse.data;
            } catch (error) {
                const errorData = error.response?.data?.error || {};
                const subcode = errorData.error_subcode;

                console.log(`Attempt ${attempts + 1} failed with subcode: ${subcode}`);

                // Subcode 2207027 means "Media is not ready to publish"
                if (subcode === 2207027 && attempts < maxAttempts - 1) {
                    const waitTime = 6000;
                    console.log(`Media not ready yet, waiting ${waitTime / 1000} seconds...`);
                    await delay(waitTime);
                    attempts++;
                } else {
                    // If it's the last attempt or a different error, throw it
                    throw error;
                }
            }
        }
    } catch (error) {
        const errorData = error.response?.data?.error || {};
        console.error('Instagram API Error:', errorData.message || error.message);
        throw error;
    }
};
