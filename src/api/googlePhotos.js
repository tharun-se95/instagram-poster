import axios from 'axios';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';

export const initGoogleAuth = () => {
    return new Promise((resolve, reject) => {
        if (typeof window.google === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Google Identity Services script failed to load'));
            document.head.appendChild(script);
        } else {
            resolve();
        }
    });
};

export const getGoogleAccessToken = () => {
    return new Promise((resolve, reject) => {
        if (!CLIENT_ID) {
            reject(new Error('VITE_GOOGLE_CLIENT_ID is missing in .env'));
            return;
        }

        if (typeof window.google === 'undefined' || !window.google.accounts) {
            reject(new Error('Google Identity Services script not loaded.'));
            return;
        }

        try {
            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                prompt: 'select_account',
                callback: (response) => {
                    console.log('[GIS] OAuth callback response:', response);
                    if (response.error) {
                        console.error('[GIS] OAuth error:', response.error, response.error_description);
                        reject(new Error(response.error_description || response.error));
                    } else {
                        console.log('[GIS] Token obtained, expires_in:', response.expires_in);
                        resolve(response.access_token);
                    }
                },
                error_callback: (err) => {
                    console.error('[GIS] Non-OAuth error:', err);
                    reject(new Error(err.type === 'popup_failed_to_open'
                        ? 'Popup was blocked. Please allow popups for this site.'
                        : err.type === 'popup_closed'
                        ? 'Sign-in popup was closed before completing.'
                        : `Google auth error: ${err.type}`
                    ));
                },
            });
            client.requestAccessToken();
        } catch (error) {
            reject(new Error('Failed to initialize Google auth: ' + error.message));
        }
    });
};

export const createPickerSession = async (accessToken) => {
    try {
        console.log('[Picker] Creating session...');
        const response = await axios.post('https://photospicker.googleapis.com/v1/sessions', {}, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            }
        });
        const data = response.data;
        console.log('[Picker] Raw session response keys:', Object.keys(data), '| name:', data.name, '| id field:', data.id);
        // API returns `name` like "sessions/SESSION_ID" — extract the ID
        const id = data.id || data.name?.split('/').pop();
        console.log('[Picker] Using session id:', id);
        return { ...data, id };
    } catch (error) {
        console.error('[Picker] Session creation failed:', error.response?.data || error.message);
        throw error;
    }
};

export const getSessionStatus = async (accessToken, sessionId) => {
    try {
        const response = await axios.get(`https://photospicker.googleapis.com/v1/sessions/${sessionId}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            }
        });
        return response.data; // { name, pickerUri, id, mediaItemsSet }
    } catch (error) {
        console.error('Error getting session status:', error.response?.data || error.message);
        throw error;
    }
};

export const fetchSelectedMediaItems = async (accessToken, sessionId) => {
    try {
        const response = await axios.get('https://photospicker.googleapis.com/v1/mediaItems', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            params: {
                sessionId: sessionId
            }
        });

        // Append size parameter and include metadata
        if (response.data.mediaItems) {
            response.data.mediaItems = response.data.mediaItems.map(item => {
                if (item.mediaFile && item.mediaFile.baseUrl) {
                    item.mediaFile.baseUrl = `${item.mediaFile.baseUrl}=w1024`;
                }
                return {
                    url: item.mediaFile?.baseUrl,
                    metadata: item.mediaMetadata
                };
            });
        }

        return response.data;
    } catch (error) {
        console.error('Error fetching selected items:', error.response?.data || error.message);
        throw error;
    }
};
