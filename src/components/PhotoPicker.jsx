import React, { useState, useRef, useEffect } from 'react';
import { Loader2, X, Plus, RefreshCw } from 'lucide-react';
import { createPickerSession, fetchSelectedMediaItems, getSessionStatus } from '../api/googlePhotos';

/**
 * Inline (non-modal) photo picker.
 * Props:
 *   accessToken  — Google OAuth token, or null if not yet authed
 *   onNeedAuth   — called when user clicks to pick but has no token
 *   onSelectionChange(photos[]) — called whenever the photos array changes
 */
const PhotoPicker = ({ accessToken, onNeedAuth, onSelectionChange }) => {
    const [status, setStatus] = useState('idle'); // idle | opening | polling | processing | error
    const [error, setError] = useState('');
    const [photos, setPhotos] = useState([]); // [{ url, previewUrl, metadata }]
    const [session, setSession] = useState(null);
    const pollRef = useRef(null);
    const pickerWindowRef = useRef(null); // ref so Cancel button can close the popup
    const photosRef = useRef([]); // stable ref to avoid stale closures in interval
    const blobUrlsRef = useRef([]); // track blob URLs for cleanup

    // Cleanup blob URLs on unmount
    useEffect(() => {
        return () => {
            blobUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    const cleanup = () => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        pickerWindowRef.current = null;
    };

    const updatePhotos = (next) => {
        photosRef.current = next;
        setPhotos(next);
        onSelectionChange?.(next);
    };

    // Picker API baseUrls require an Authorization header — fetch as blob for display
    const fetchAsBlob = async (url) => {
        try {
            const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
            if (!res.ok) return url;
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            blobUrlsRef.current.push(objectUrl);
            return objectUrl;
        } catch {
            return url; // fallback to original URL
        }
    };

    const handleComplete = async (sessionId) => {
        setStatus('processing');
        try {
            const data = await fetchSelectedMediaItems(accessToken, sessionId);
            if (data.mediaItems?.length > 0) {
                // Fetch all thumbnails as blob URLs so they display without auth headers
                const withPreviews = await Promise.all(
                    data.mediaItems.map(async (photo) => ({
                        ...photo,
                        previewUrl: await fetchAsBlob(photo.url),
                    }))
                );
                updatePhotos([...photosRef.current, ...withPreviews]);
                setStatus('idle');
            } else {
                setError('No photos returned. Make sure you clicked "Done" in the picker.');
                setStatus('error');
            }
        } catch {
            setError('Failed to fetch photos. Please try again.');
            setStatus('error');
        }
    };

    const startPicking = async () => {
        if (!accessToken) { onNeedAuth?.(); return; }
        setStatus('opening');
        setError('');
        try {
            const sessionData = await createPickerSession(accessToken);
            setSession(sessionData);
            const pickerWindow = window.open(sessionData.pickerUri, 'GooglePhotosPicker', 'width=800,height=600');
            if (!pickerWindow) {
                setError('Popup blocked! Please allow popups for this site.');
                setStatus('error');
                return;
            }
            pickerWindowRef.current = pickerWindow;
            setStatus('polling');

            // NOTE: We do NOT check pickerWindow.closed here.
            // Google's picker sets COOP: same-origin which severs the window reference
            // immediately on load, making pickerWindow.closed always return true.
            // Instead we rely purely on mediaItemsSet polling + a global timeout.
            const startedAt = Date.now();
            const MAX_POLL_MS = 5 * 60 * 1000; // 5-min hard cap

            pollRef.current = setInterval(async () => {
                if (Date.now() - startedAt > MAX_POLL_MS) {
                    cleanup();
                    try { pickerWindow.close(); } catch {}
                    setError('Selection timed out. Please try again.');
                    setStatus('error');
                    return;
                }

                try {
                    const latest = await getSessionStatus(accessToken, sessionData.id);
                    if (latest.mediaItemsSet) {
                        cleanup();
                        try { pickerWindow.close(); } catch {}
                        await handleComplete(sessionData.id);
                    }
                } catch (e) { console.warn('[Picker] Poll error:', e?.response?.data || e?.message); }
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Failed to open picker.');
            setStatus('error');
        }
    };

    const removePhoto = (index) => {
        const updated = photos.filter((_, i) => i !== index);
        updatePhotos(updated);
    };

    const isLoading = status === 'opening' || status === 'polling' || status === 'processing';

    return (
        <div>
            {/* Selected photos grid */}
            {photos.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
                    {photos.map((photo, i) => (
                        <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 group">
                            <img
                                src={photo.previewUrl || photo.url}
                                alt={`Selected ${i + 1}`}
                                className="w-full h-full object-cover"
                            />
                            <button
                                onClick={() => removePhoto(i)}
                                className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X size={10} className="text-white" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Error message */}
            {error && (
                <div className="mb-3 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex items-center justify-between gap-2">
                    <span>{error}</span>
                    {status === 'error' && session && (
                        <button
                            onClick={() => handleComplete(session.id)}
                            className="shrink-0 flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                            <RefreshCw size={11} /> Retry
                        </button>
                    )}
                </div>
            )}

            {/* Action area */}
            {!accessToken ? (
                <button
                    onClick={onNeedAuth}
                    className="w-full flex flex-col items-center justify-center gap-2 py-10 rounded-xl border-2 border-dashed border-[#6c5ce7]/30 text-[#6c5ce7] hover:bg-[#f0eeff] transition-colors"
                >
                    <div className="w-10 h-10 rounded-full bg-[#f0eeff] flex items-center justify-center">
                        <Plus size={20} />
                    </div>
                    <span className="text-sm font-medium">Connect Google Photos</span>
                </button>
            ) : isLoading ? (
                <div className="flex flex-col items-center gap-2 py-10 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                        <Loader2 size={20} className="animate-spin text-[#6c5ce7]" />
                        <span className="text-sm text-slate-500">
                            {status === 'opening' ? 'Opening picker…' :
                             status === 'polling' ? 'Select photos in the picker window, then click Done…' :
                             'Fetching your photos…'}
                        </span>
                    </div>
                    {status === 'polling' && (
                        <button
                            onClick={() => {
                                cleanup();
                                try { pickerWindowRef.current?.close(); } catch {}
                                setStatus('idle');
                                setError('');
                            }}
                            className="text-xs text-slate-400 hover:text-slate-600 underline mt-1"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            ) : (
                <button
                    onClick={startPicking}
                    className="w-full flex items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-[#6c5ce7]/30 text-[#6c5ce7] hover:bg-[#f0eeff] transition-colors text-sm font-medium"
                >
                    <Plus size={16} />
                    {photos.length > 0 ? 'Add More Photos' : 'Open Google Picker'}
                </button>
            )}
        </div>
    );
};

export default PhotoPicker;
