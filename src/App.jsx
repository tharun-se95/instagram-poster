import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Instagram, LayoutDashboard, Plus, Sparkles, Check,
    BarChart2, CheckCircle, XCircle, Clock, Zap,
    RefreshCw, Play, Pause, Send, Loader2, AlertCircle, ImagePlus, Wand2, CheckCircle2,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import axios from 'axios';
import { initGoogleAuth, getGoogleAccessToken } from '@/api/googlePhotos';
import PhotoPicker from '@/components/PhotoPicker';

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const STATUS_FILTERS = ['PENDING', 'APPROVED', 'POSTED', 'REJECTED', 'FAILED'];

const STATUS_STYLE = {
    PENDING:  'bg-amber-50 text-amber-600 border border-amber-200',
    APPROVED: 'bg-green-50 text-green-600 border border-green-200',
    POSTED:   'bg-purple-50 text-purple-600 border border-purple-200',
    REJECTED: 'bg-red-50 text-red-500 border border-red-200',
    FAILED:   'bg-red-50 text-red-500 border border-red-200',
    POSTING:  'bg-cyan-50 text-cyan-600 border border-cyan-200',
};

// ─── Thumbnail Image ─────────────────────────────────────────────────────────
function ThumbnailImage({ itemId, className = '', srcOverride = null }) {
    const [state, setState] = useState('loading'); // loading | loaded | error
    const src = srcOverride || `${SERVER}/api/queue/${itemId}/thumbnail`;

    // Reset loading state when src changes (e.g. switching between original and edited)
    useEffect(() => {
        setState('loading');
    }, [src]);

    return (
        <div className={`relative bg-slate-100 overflow-hidden ${className}`}>
            {state === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 size={18} className="animate-spin text-slate-300" />
                </div>
            )}
            {state === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                    <ImagePlus size={20} className="text-slate-300" />
                    <span className="text-[10px] text-slate-300">No preview</span>
                </div>
            )}
            <img
                src={src}
                alt="Post preview"
                className={`w-full h-full object-cover transition-opacity duration-200 ${state === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setState('loaded')}
                onError={() => setState('error')}
            />
        </div>
    );
}

// ─── Score Ring ──────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
    const r = 18, cx = 22, cy = 22;
    const circ = 2 * Math.PI * r;
    const fill = ((score ?? 0) / 10) * circ;
    const color = score >= 8 ? '#22c55e' : score >= 6 ? '#f59e0b' : '#ef4444';
    return (
        <svg width="44" height="44" className="shrink-0">
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="3.5"
                strokeDasharray={circ} strokeDashoffset={circ - fill}
                strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} />
            <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill={color}>
                {score ?? '–'}
            </text>
        </svg>
    );
}

// ─── Editing Suggestions ──────────────────────────────────────────────────
function EditingSuggestions({ suggestions }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="mt-2 rounded-lg border border-[#ede9fe] bg-[#f5f3ff] overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-left hover:bg-[#ede9fe]/50 transition-colors"
            >
                <div className="flex items-center gap-1.5">
                    <Wand2 size={11} className="text-[#6c5ce7] shrink-0" />
                    <span className="text-[11px] font-semibold text-[#6c5ce7]">Editing Suggestions</span>
                </div>
                <span className="text-[10px] text-[#a78bfa]">
                    {open ? 'hide' : `${suggestions.length} tips`}
                </span>
            </button>
            {open && (
                <div className="px-2.5 pb-2 space-y-1">
                    {suggestions.map((s, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                            <span className="text-[#a78bfa] text-[10px] mt-0.5 shrink-0">•</span>
                            <span className="text-[11px] text-slate-600 leading-relaxed">{s}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Edit Status Badge ────────────────────────────────────────────────────────
function EditStatusBadge({ status }) {
    if (status === 'running') return (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-400 bg-blue-500/15 border border-blue-500/25 px-2 py-0.5 rounded-full">
            <Loader2 size={9} className="animate-spin" /> Editing…
        </span>
    );
    if (status === 'done') return (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-full">
            <Sparkles size={9} /> AI Edited
        </span>
    );
    if (status === 'error') return (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-red-400 bg-red-500/15 border border-red-500/25 px-2 py-0.5 rounded-full">
            <AlertCircle size={9} /> Edit Failed
        </span>
    );
    return null;
}

// ─── Posting progress stages (in order) ──────────────────────────────────────
const PROGRESS_STAGES = [
    { key: 'preparing',          label: 'Preparing image'          },
    { key: 'bridging',           label: 'Uploading to bridge'       },
    { key: 'creating_container', label: 'Creating IG container'     },
    { key: 'publishing',         label: 'Publishing to Instagram'   },
    { key: 'archiving',          label: 'Archiving post'            },
];

// ─── Posting Progress Overlay ─────────────────────────────────────────────────
function PostingProgress({ itemId, onDone }) {
    const [progress, setProgress] = useState({ stage: 'preparing', label: 'Preparing image…', percent: 10 });
    const pollRef = useRef(null);

    useEffect(() => {
        pollRef.current = setInterval(async () => {
            try {
                const res = await axios.get(`${SERVER}/api/queue/${itemId}/post-progress`);
                if (res.data === null) {
                    // Progress entry removed → posting finished (success or fail)
                    clearInterval(pollRef.current);
                    onDone();
                } else {
                    setProgress(res.data);
                }
            } catch { /* ignore poll errors */ }
        }, 600);
        return () => clearInterval(pollRef.current);
    }, [itemId, onDone]);

    const currentIdx = PROGRESS_STAGES.findIndex(s => s.key === progress.stage);

    return (
        <div className="p-4 space-y-3">
            {/* Progress bar */}
            <div className="relative h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ background: 'linear-gradient(90deg, #6c5ce7, #a78bfa)' }}
                    animate={{ width: `${progress.percent}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                />
            </div>

            {/* Stage list */}
            <div className="space-y-1.5">
                {PROGRESS_STAGES.map((s, idx) => {
                    const done = idx < currentIdx;
                    const active = idx === currentIdx;
                    return (
                        <div key={s.key} className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors
                                ${done ? 'bg-green-100' : active ? 'bg-[#ede9fe]' : 'bg-slate-100'}`}>
                                {done
                                    ? <Check size={9} className="text-green-500" />
                                    : active
                                    ? <Loader2 size={9} className="text-[#6c5ce7] animate-spin" />
                                    : <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                }
                            </div>
                            <span className={`text-[11px] transition-colors
                                ${done ? 'text-slate-400 line-through' : active ? 'text-slate-700 font-medium' : 'text-slate-300'}`}>
                                {active ? progress.label : s.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Queue Card ──────────────────────────────────────────────────────────────
function QueueCard({ item, onApprove, onReject, onRegenCaption, onPost, onRefresh }) {
    const [editCaption, setEditCaption] = useState(false);
    const [caption, setCaption] = useState(item.suggested_caption || '');
    const [posting, setPosting] = useState(false);
    const [reanalyzing, setReanalyzing] = useState(false);

    // Auto-Edit state
    const [editStatus, setEditStatus] = useState('none'); // 'none' | 'running' | 'done' | 'error'
    const [showEdited, setShowEdited] = useState(false);
    const editPollRef = useRef(null);

    // On mount: check if this item already has an edited image
    useEffect(() => {
        axios.get(`${SERVER}/api/queue/${item.id}/edited-status`)
            .then(res => setEditStatus(res.data.status))
            .catch(() => {});
    }, [item.id]);

    // Poll edit status while editing is running
    useEffect(() => {
        if (editStatus !== 'running') return;
        editPollRef.current = setInterval(async () => {
            try {
                const res = await axios.get(`${SERVER}/api/queue/${item.id}/edited-status`);
                const { status } = res.data;
                if (status !== 'running') {
                    setEditStatus(status);
                    if (status === 'done') setShowEdited(true);
                    clearInterval(editPollRef.current);
                }
            } catch { /* ignore */ }
        }, 2000);
        return () => clearInterval(editPollRef.current);
    }, [editStatus, item.id]);

    const saveCaption = async () => {
        setEditCaption(false);
        if (caption !== item.suggested_caption) {
            try {
                await axios.patch(`${SERVER}/api/queue/${item.id}/caption`, { caption });
            } catch { /* silent */ }
        }
    };

    // Stable cache-bust timestamp for the edited image — only regenerated when showEdited toggles on
    const editedImgTs = useRef(null);
    if (showEdited && editStatus === 'done' && editedImgTs.current === null) {
        editedImgTs.current = Date.now();
    }
    if (!showEdited) {
        editedImgTs.current = null;
    }

    // Compute the thumbnail src — switch to edited image when showEdited is true
    const thumbnailSrc = (showEdited && editStatus === 'done')
        ? `${SERVER}/api/queue/${item.id}/edited-image?t=${editedImgTs.current}`
        : null; // null = ThumbnailImage uses its default src

    return (
        <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                {/* Thumbnail */}
                <div className="aspect-video relative overflow-hidden">
                    <ThumbnailImage itemId={item.id} className="w-full h-full" srcOverride={thumbnailSrc} />
                    <div className="absolute top-2 right-2">
                        {item.ai_score != null && <ScoreRing score={item.ai_score} />}
                    </div>
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[item.status] || ''}`}>
                            {item.status}
                        </span>
                        {editStatus !== 'none' && <EditStatusBadge status={editStatus} />}
                    </div>
                </div>

                {/* Body */}
                {item.status === 'POSTING' ? (
                    <PostingProgress itemId={item.id} onDone={onRefresh} />
                ) : (
                    <div className="p-3">
                        {(item.mood || item.subject) && (
                            <div className="flex gap-1 flex-wrap mb-2">
                                {item.mood && <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-500">#{item.mood}</span>}
                                {item.subject && <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-500">{item.subject}</span>}
                            </div>
                        )}

                        {editCaption ? (
                            <textarea
                                className="w-full text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]/30"
                                rows={3} value={caption}
                                onChange={e => setCaption(e.target.value)}
                                onBlur={saveCaption} autoFocus
                            />
                        ) : caption ? (
                            <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 cursor-text hover:text-slate-700 transition-colors"
                                onClick={() => setEditCaption(true)} title="Click to edit">
                                {caption}
                            </p>
                        ) : null}

                        {/* Editing Suggestions */}
                        {item.status === 'APPROVED' && Array.isArray(item.editing_suggestions) && item.editing_suggestions.length > 0 && (
                            <EditingSuggestions suggestions={item.editing_suggestions} />
                        )}

                        {(item.status === 'REJECTED' || item.status === 'FAILED') && item.rejection_reason && (
                            <p className="mt-1 text-[10px] text-red-400 line-clamp-1">{item.rejection_reason}</p>
                        )}

                        {(item.status === 'PENDING' || item.status === 'APPROVED') && (
                            <div className="flex gap-1.5 mt-3 pt-3 border-t border-slate-100 flex-wrap">
                                {item.status === 'PENDING' && (
                                    <>
                                        <button onClick={() => onApprove(item.id)}
                                            className="flex-1 text-[11px] font-medium py-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors">
                                            ✓ Approve
                                        </button>
                                        <button onClick={() => onReject(item.id)}
                                            className="flex-1 text-[11px] font-medium py-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors">
                                            ✕ Reject
                                        </button>
                                    </>
                                )}
                                {item.status === 'APPROVED' && (
                                    <button
                                        onClick={() => {
                                            setPosting(true);
                                            onPost(item.id);
                                            // Card will re-render with POSTING status after next fetchData (~400ms)
                                        }}
                                        disabled={posting}
                                        className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold py-1.5 rounded-lg transition-colors disabled:opacity-40"
                                        style={{ background: '#6c5ce7', color: '#fff' }}>
                                        {posting
                                            ? <><Loader2 size={11} className="animate-spin" /> Starting…</>
                                            : <><Send size={11} /> Post</>}
                                    </button>
                                )}
                                <button onClick={() => onRegenCaption(item.id)}
                                    className="flex-1 text-[11px] font-medium py-1.5 bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-100 transition-colors">
                                    ↺ Caption
                                </button>

                                {/* Re-analyze button — refreshes Gemini analysis for this item */}
                                <button
                                    onClick={async () => {
                                        if (reanalyzing) return;
                                        setReanalyzing(true);
                                        try {
                                            await axios.post(`${SERVER}/api/queue/${item.id}/reanalyze`);
                                            toast.success('Re-analyzed — refreshing…');
                                            onRefresh();
                                        } catch (err) {
                                            const msg = err.response?.data?.error || 'Re-analysis failed';
                                            toast.error(msg);
                                        } finally {
                                            setReanalyzing(false);
                                        }
                                    }}
                                    disabled={reanalyzing}
                                    title="Re-analyze with Gemini"
                                    className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-40 text-[11px] font-medium"
                                >
                                    {reanalyzing
                                        ? <Loader2 size={11} className="animate-spin" />
                                        : <RefreshCw size={11} />}
                                    {reanalyzing ? '' : 'AI'}
                                </button>

                                {/* Auto-Edit button — only for APPROVED items with editing suggestions */}
                                {item.status === 'APPROVED' && Array.isArray(item.editing_suggestions) && item.editing_suggestions.length > 0 && (
                                    <button
                                        onClick={async () => {
                                            if (editStatus === 'running') return;
                                            if (editStatus === 'done') {
                                                // Toggle between edited and original view
                                                setShowEdited(v => !v);
                                                return;
                                            }
                                            // Start the edit
                                            setEditStatus('running');
                                            try {
                                                await axios.post(`${SERVER}/api/queue/${item.id}/edit`);
                                            } catch {
                                                setEditStatus('error');
                                            }
                                        }}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                                            editStatus === 'done'
                                                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-600'
                                                : editStatus === 'running'
                                                ? 'bg-blue-500/10 border border-blue-500/20 text-blue-500 cursor-wait'
                                                : 'bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-600'
                                        }`}
                                    >
                                        {editStatus === 'running' ? (
                                            <><Loader2 size={11} className="animate-spin" /> Editing…</>
                                        ) : editStatus === 'done' ? (
                                            <><Sparkles size={11} /> {showEdited ? 'View Original' : 'View Edited'}</>
                                        ) : (
                                            <><Wand2 size={11} /> Smart Edit</>
                                        )}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </motion.div>
    );
}

// ─── Wizard Step Block ────────────────────────────────────────────────────────
function WizardStepBlock({ stepNum, title, isDone, isActive, summary, children }) {
    return (
        <div className={stepNum > 1 ? 'border-t border-slate-100' : ''}>
            <div className={`px-6 py-5 ${isDone ? 'bg-slate-50/60' : ''}`}>
                <div className="flex items-center gap-2.5 mb-1">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border
                        ${isDone
                            ? 'border-green-300 text-green-600 bg-green-50'
                            : isActive
                            ? 'border-[#6c5ce7] text-[#6c5ce7] bg-white'
                            : 'border-slate-200 text-slate-400 bg-white'}`}>
                        {isDone && <Check size={10} />}
                        {isDone ? 'Done' : `Step ${stepNum}`}
                    </span>
                    {isDone && summary && (
                        <span className="text-sm text-slate-400">{summary}</span>
                    )}
                </div>
                <h3 className={`font-semibold ${isDone ? 'text-slate-400' : 'text-slate-800'}`}>
                    {title}
                </h3>
                {isActive && (
                    <div className="mt-4">
                        {children}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Sidebar Nav Item ─────────────────────────────────────────────────────────
function NavItem({ icon: Icon, label, active, onClick, badge }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left
                ${active
                    ? 'bg-[#ede9fe] text-[#6c5ce7]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-[#6c5ce7]'}`}
        >
            <Icon size={17} />
            <span className="flex-1">{label}</span>
            {badge != null && badge > 0 && (
                <span className="bg-[#6c5ce7] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                    {badge}
                </span>
            )}
        </button>
    );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
    const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, posted: 0, rejected: 0, failed: 0 });
    const [queue, setQueue] = useState([]);
    const [statusFilter, setStatusFilter] = useState('APPROVED');
    const [googleToken, setGoogleToken] = useState(null);
    const [isPaused, setIsPaused] = useState(false);
    const [isTestMode, setIsTestMode] = useState(true);
    const [serverOnline, setServerOnline] = useState(false);
    const [postingNow, setPostingNow] = useState(false);

    const [view, setView] = useState('dashboard');
    const [wizardStep, setWizardStep] = useState(1);
    const [pickedPhotos, setPickedPhotos] = useState([]);
    const [batchItems, setBatchItems] = useState([]);
    const [reanalyzeState, setReanalyzeState] = useState(null); // null = idle

    const batchPollRef = useRef(null);

    const fetchData = useCallback(async () => {
        try {
            // When viewing APPROVED tab, also fetch any in-flight POSTING items
            // so the progress overlay stays visible while posting is in progress
            const fetchQueue = statusFilter === 'APPROVED'
                ? Promise.all([
                    axios.get(`${SERVER}/api/queue`, { params: { status: 'POSTING' } }),
                    axios.get(`${SERVER}/api/queue`, { params: { status: 'APPROVED' } }),
                  ]).then(([postingRes, approvedRes]) => ({
                    data: [...postingRes.data, ...approvedRes.data],
                  }))
                : axios.get(`${SERVER}/api/queue`, { params: { status: statusFilter } });

            const [statsRes, queueRes, settingsRes] = await Promise.all([
                axios.get(`${SERVER}/api/stats`),
                fetchQueue,
                axios.get(`${SERVER}/api/settings`),
            ]);
            setStats(statsRes.data);
            setQueue(queueRes.data);
            setIsPaused(settingsRes.data.posting_paused === 'true');
            setIsTestMode(settingsRes.data.test_mode === 'true');
            setServerOnline(true);
        } catch {
            setServerOnline(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 8000);
        return () => clearInterval(interval);
    }, [fetchData]);

    useEffect(() => { initGoogleAuth().catch(console.error); }, []);
    useEffect(() => { return () => { if (batchPollRef.current) clearInterval(batchPollRef.current); }; }, []);

    useEffect(() => {
        if (!reanalyzeState?.running) return;
        const interval = setInterval(async () => {
            try {
                const res = await axios.get(`${SERVER}/api/reanalyze-approved/progress`);
                const prog = res.data;
                setReanalyzeState(prog);
                if (!prog.running) {
                    fetchData(); // Refresh queue to show updated suggestions
                    clearInterval(interval);
                }
            } catch { /* ignore */ }
        }, 2000);
        return () => clearInterval(interval);
    }, [reanalyzeState?.running]);

    const handleConnectGoogle = async () => {
        try {
            const token = await getGoogleAccessToken();
            setGoogleToken(token);
            await axios.post(`${SERVER}/api/auth/google`, { accessToken: token });
            toast.success('Google Photos connected!');
        } catch (error) {
            toast.error(error?.message || 'Failed to connect Google Photos');
        }
    };

    const startCuration = async () => {
        if (pickedPhotos.length === 0) return;
        // SQLite stores datetime('now') as "YYYY-MM-DD HH:MM:SS" (space, no T/Z/ms).
        // Using ISO format here causes string comparison to always fail (space < T in ASCII).
        const ts = new Date().toISOString().replace('T', ' ').split('.')[0];
        setWizardStep(2);
        setBatchItems([]);
        try {
            await axios.post(`${SERVER}/api/curate`, { photos: pickedPhotos });
        } catch {
            toast.error('Failed to start curation');
            setWizardStep(1);
            return;
        }
        let elapsed = 0;
        const maxWait = Math.max(90, pickedPhotos.length * 25); // 25s per photo (7s delay + Gemini time), min 90s
        batchPollRef.current = setInterval(async () => {
            elapsed += 3;
            try {
                const res = await axios.get(`${SERVER}/api/queue`, { params: { created_after: ts } });
                const items = res.data;
                const processed = items.filter(i => i.status !== 'PENDING').length;
                if (processed >= pickedPhotos.length || elapsed >= maxWait) {
                    clearInterval(batchPollRef.current);
                    batchPollRef.current = null;
                    const approved = items.filter(i => i.status === 'APPROVED');
                    setBatchItems(approved);
                    setWizardStep(3);
                    if (approved.length === 0) toast('No photos met the quality bar', { icon: '🤔' });
                }
            } catch { /* ignore */ }
        }, 3000);
    };

    const handleApprove = async (id) => {
        await axios.post(`${SERVER}/api/queue/${id}/approve`);
        toast.success('Post approved!');
        fetchData();
    };

    const handleReject = async (id) => {
        await axios.post(`${SERVER}/api/queue/${id}/reject`);
        toast('Post skipped', { icon: '🚫' });
        fetchData();
    };

    const handleRegenCaption = async (id) => {
        const tid = toast.loading('Generating caption…');
        try {
            await axios.post(`${SERVER}/api/queue/${id}/regenerate-caption`);
            toast.success('New caption ready!', { id: tid });
            fetchData();
        } catch {
            toast.error('Caption generation failed', { id: tid });
        }
    };

    const handlePostItem = (id) => {
        if (!id) return; // called with null by onDone — handled via onRefresh
        // Fire-and-forget: don't await — let progress overlay handle the in-flight UX
        axios.post(`${SERVER}/api/queue/${id}/post`)
            .then(res => {
                fetchData();
                if (res.data.success) {
                    toast.success(res.data.archived ? 'Posted & archived (Test Mode) 🔒' : 'Posted to Instagram! 🎉');
                } else {
                    toast.error(res.data.error || 'Post failed');
                }
            })
            .catch(e => {
                fetchData();
                toast.error(e.response?.data?.error || 'Post failed');
            });
        // Refresh quickly so the card transitions to POSTING status and shows the progress overlay
        setTimeout(fetchData, 400);
    };

    const handleTogglePause = async () => {
        await axios.post(`${SERVER}/api/scheduler/${isPaused ? 'resume' : 'pause'}`);
        setIsPaused(!isPaused);
        toast(isPaused ? 'Posting resumed' : 'Posting paused');
    };

    const handleToggleTestMode = async () => {
        const next = !isTestMode;
        await axios.patch(`${SERVER}/api/settings`, { test_mode: String(next) });
        setIsTestMode(next);
        toast(next ? '🔒 Test mode ON — posts will be auto-archived' : '🌐 Test mode OFF — posts are public');
    };

    const handlePostNow = async () => {
        setPostingNow(true);
        const tid = toast.loading('Posting to Instagram…');
        try {
            const res = await axios.post(`${SERVER}/api/post/now`);
            if (res.data.success) toast.success('Posted to Instagram!', { id: tid });
            else toast.error(res.data.error || 'Post failed', { id: tid });
            fetchData();
        } catch (e) {
            toast.error(e.response?.data?.error || 'Post failed', { id: tid });
        } finally {
            setPostingNow(false);
        }
    };

    const startReanalyze = async () => {
        try {
            const res = await axios.post(`${SERVER}/api/reanalyze-approved`);
            setReanalyzeState({ running: true, total: res.data.total, done: 0, current: null, errors: [] });
        } catch (err) {
            console.error('Reanalyze failed to start:', err);
        }
    };

    const openWizard = () => {
        setView('wizard');
        setWizardStep(1);
        setPickedPhotos([]);
        setBatchItems([]);
    };

    const goToDashboard = (filter = 'APPROVED') => {
        setView('dashboard');
        setStatusFilter(filter);
        fetchData();
    };

    const STAT_CARDS = [
        { label: 'Total',    value: stats.total,    icon: BarChart2,   color: '#6366f1' },
        { label: 'Pending',  value: stats.pending,  icon: Clock,       color: '#f59e0b' },
        { label: 'Approved', value: stats.approved, icon: CheckCircle, color: '#22c55e' },
        { label: 'Posted',   value: stats.posted,   icon: Zap,         color: '#6c5ce7' },
        { label: 'Rejected', value: stats.rejected, icon: XCircle,     color: '#ef4444' },
    ];

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: '#f8f7ff' }}>

            {/* ── Sidebar ────────────────────────────────────────────────── */}
            <aside className="w-[230px] bg-white border-r border-slate-100 flex flex-col shrink-0 overflow-y-auto">
                <div className="px-5 py-5 border-b border-slate-100 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'linear-gradient(135deg, #6c5ce7, #a78bfa)' }}>
                        <Instagram size={18} className="text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-800 leading-tight">InstaPoster</p>
                        <p className="text-[10px] text-slate-400">AI Content Engine</p>
                    </div>
                </div>

                <nav className="p-3 flex-1 space-y-1">
                    <NavItem icon={LayoutDashboard} label="Dashboard" active={view === 'dashboard'}
                        badge={stats.approved} onClick={() => goToDashboard('APPROVED')} />
                    <NavItem icon={Plus} label="Add Content" active={view === 'wizard'} onClick={openWizard} />
                </nav>

                <div className="p-4 border-t border-slate-100 space-y-3">
                    <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${serverOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                        <span className="text-xs text-slate-500">{serverOnline ? 'Server online' : 'Server offline'}</span>
                    </div>

                    {/* Test Mode toggle */}
                    <button onClick={handleToggleTestMode}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg border transition-colors"
                        style={isTestMode
                            ? { background: '#fff7ed', borderColor: '#fdba74' }
                            : { background: '#f8fafc', borderColor: '#e2e8f0' }}>
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm">{isTestMode ? '🔒' : '🌐'}</span>
                            <span className="text-[11px] font-semibold" style={{ color: isTestMode ? '#c2410c' : '#64748b' }}>
                                {isTestMode ? 'Test Mode' : 'Live Mode'}
                            </span>
                        </div>
                        <div className={`w-7 h-4 rounded-full relative transition-colors ${isTestMode ? 'bg-orange-400' : 'bg-slate-200'}`}>
                            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${isTestMode ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                        </div>
                    </button>
                    {isTestMode && (
                        <p className="text-[10px] text-orange-500 leading-tight px-0.5">
                            Posts auto-archived after publish — only visible to you
                        </p>
                    )}

                    <div className="flex gap-3">
                        <button onClick={handleTogglePause}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-[#6c5ce7] transition-colors">
                            {isPaused ? <><Play size={11} /> Resume</> : <><Pause size={11} /> Pause</>}
                        </button>
                        <button onClick={handlePostNow} disabled={postingNow}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-[#6c5ce7] transition-colors disabled:opacity-40">
                            {postingNow ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                            Post Now
                        </button>
                    </div>
                </div>
            </aside>

            {/* ── Main ──────────────────────────────────────────────────── */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="shrink-0 px-8 py-4 flex items-center justify-between" style={{ background: '#0d1535' }}>
                    <div>
                        <h2 className="text-white font-semibold text-lg leading-tight">
                            {view === 'dashboard' ? 'Dashboard' : 'Add Content'}
                        </h2>
                        <p className="text-slate-400 text-xs mt-0.5">
                            {view === 'dashboard'
                                ? `${stats.total} total · ${stats.approved} ready to post`
                                : 'Select photos and analyze with Gemini AI'}
                        </p>
                    </div>
                    {view === 'dashboard' ? (
                        <button onClick={openWizard}
                            className="flex items-center gap-2 text-sm font-medium text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                            style={{ background: '#6c5ce7' }}>
                            <Plus size={15} /> Add Photos
                        </button>
                    ) : (
                        <button onClick={() => goToDashboard()}
                            className="text-sm text-slate-400 hover:text-white transition-colors">
                            ← Back
                        </button>
                    )}
                </header>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">

                    {/* ── Dashboard ───────────────────────── */}
                    {view === 'dashboard' && (
                        <div className="space-y-5">
                            <AnimatePresence>
                                {!serverOnline && (
                                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                        className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                                        <AlertCircle size={16} />
                                        Server offline — run <code className="bg-red-100 px-1.5 py-0.5 rounded text-xs font-mono">cd server && node index.js</code>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Stats */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                                {STAT_CARDS.map(s => (
                                    <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3"
                                        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                            style={{ background: s.color + '18' }}>
                                            <s.icon size={18} style={{ color: s.color }} />
                                        </div>
                                        <div>
                                            <p className="text-xl font-bold text-slate-800 leading-none tabular-nums">{s.value}</p>
                                            <p className="text-[11px] text-slate-400 mt-0.5">{s.label}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Queue */}
                            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden"
                                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                                    <h3 className="font-semibold text-slate-800">Content Queue</h3>
                                    <span className="text-[11px] text-slate-400">Auto-refreshes every 8s</span>
                                </div>

                                <div className="px-4 py-3 flex gap-1.5 border-b border-slate-100 overflow-x-auto">
                                    {STATUS_FILTERS.map(f => (
                                        <button key={f} onClick={() => setStatusFilter(f)}
                                            className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors
                                                ${statusFilter === f
                                                    ? 'bg-[#6c5ce7] text-white'
                                                    : 'bg-slate-100 text-slate-500 hover:bg-[#f0eeff] hover:text-[#6c5ce7]'}`}>
                                            {f}
                                            {f === 'APPROVED' && stats.approved > 0 && (
                                                <span className="ml-1 opacity-70">({stats.approved})</span>
                                            )}
                                        </button>
                                    ))}
                                </div>

                                <div className="p-4">
                                    {statusFilter === 'APPROVED' && (
                                        <div className="mb-4">
                                            {reanalyzeState?.running ? (
                                                <div className="glass-card rounded-xl p-3 flex flex-col gap-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Loader2 size={14} className="text-purple-400 animate-spin" />
                                                            <span className="text-sm text-slate-300 font-medium">
                                                                Re-analyzing photos with Gemini…
                                                            </span>
                                                        </div>
                                                        <span className="text-xs text-slate-400">
                                                            {reanalyzeState.done}/{reanalyzeState.total}
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-white/10 rounded-full h-1.5">
                                                        <div
                                                            className="bg-gradient-to-r from-purple-500 to-violet-400 h-1.5 rounded-full transition-all duration-500"
                                                            style={{ width: `${reanalyzeState.total > 0 ? (reanalyzeState.done / reanalyzeState.total) * 100 : 0}%` }}
                                                        />
                                                    </div>
                                                    {reanalyzeState.current && (
                                                        <p className="text-xs text-slate-500">
                                                            Analyzing: {reanalyzeState.current.subject || reanalyzeState.current.id}
                                                        </p>
                                                    )}
                                                </div>
                                            ) : reanalyzeState?.quotaExhausted ? (
                                                <div className="rounded-xl p-3 flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/25">
                                                    <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                                                    <div>
                                                        <p className="text-xs font-semibold text-amber-300">Gemini daily quota exhausted</p>
                                                        <p className="text-xs text-amber-400/80 mt-0.5">
                                                            Free tier: 20 requests/day. Quota resets at midnight.{' '}
                                                            {reanalyzeState.done > 0 && `${reanalyzeState.done} of ${reanalyzeState.total} photos were updated before the limit was hit.`}
                                                        </p>
                                                        <button
                                                            onClick={() => setReanalyzeState(null)}
                                                            className="mt-1.5 text-[11px] text-amber-400 hover:text-amber-300 underline"
                                                        >
                                                            Dismiss
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={startReanalyze}
                                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-sm font-medium transition-colors"
                                                >
                                                    <Wand2 size={13} />
                                                    Re-analyze All
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    {queue.length === 0 ? (
                                        <div className="py-16 text-center">
                                            <ImagePlus size={32} className="mx-auto text-slate-200 mb-3" />
                                            <p className="text-sm font-medium text-slate-400">No {statusFilter.toLowerCase()} items</p>
                                            {statusFilter === 'APPROVED' && (
                                                <button onClick={openWizard}
                                                    className="mt-4 text-sm text-[#6c5ce7] hover:underline font-medium">
                                                    + Add Photos to get started
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                            <AnimatePresence>
                                                {queue.map(item => (
                                                    <QueueCard key={item.id} item={item}
                                                        onApprove={handleApprove}
                                                        onReject={handleReject}
                                                        onRegenCaption={handleRegenCaption}
                                                        onPost={handlePostItem}
                                                        onRefresh={fetchData}
                                                    />
                                                ))}
                                            </AnimatePresence>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Wizard ───────────────────────────── */}
                    {view === 'wizard' && (
                        <div className="max-w-2xl mx-auto">
                            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
                                style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>

                                {/* Step 1 */}
                                <WizardStepBlock stepNum={1} title="Select Photos"
                                    isDone={wizardStep > 1} isActive={wizardStep === 1}
                                    summary={`${pickedPhotos.length} photo${pickedPhotos.length === 1 ? '' : 's'} selected`}>
                                    <PhotoPicker
                                        accessToken={googleToken}
                                        onNeedAuth={handleConnectGoogle}
                                        onSelectionChange={setPickedPhotos}
                                    />
                                    <div className="mt-5 flex justify-end">
                                        <button onClick={startCuration} disabled={pickedPhotos.length === 0}
                                            className="flex items-center gap-2 text-sm font-semibold text-white px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                                            style={{ background: '#6c5ce7' }}>
                                            <Sparkles size={15} />
                                            Analyze with AI ({pickedPhotos.length})
                                        </button>
                                    </div>
                                </WizardStepBlock>

                                {/* Step 2 */}
                                {wizardStep >= 2 && (
                                    <WizardStepBlock stepNum={2} title="AI Analysis"
                                        isDone={wizardStep > 2} isActive={wizardStep === 2}
                                        summary={`${batchItems.length} approved`}>
                                        <div className="flex flex-col items-center py-10 gap-4">
                                            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: '#f0eeff' }}>
                                                <Loader2 size={28} className="animate-spin text-[#6c5ce7]" />
                                            </div>
                                            <div className="text-center">
                                                <p className="font-semibold text-slate-700">Analyzing with Gemini AI…</p>
                                                <p className="text-sm text-slate-400 mt-1">
                                                    Scoring {pickedPhotos.length} photo{pickedPhotos.length === 1 ? '' : 's'} for aesthetic quality
                                                </p>
                                                <p className="text-xs text-slate-300 mt-2">This usually takes 10–30 seconds</p>
                                            </div>
                                        </div>
                                    </WizardStepBlock>
                                )}

                                {/* Step 3 */}
                                {wizardStep >= 3 && (
                                    <WizardStepBlock stepNum={3} title="Review & Approve"
                                        isDone={false} isActive={true}>
                                        {batchItems.length === 0 ? (
                                            <div className="py-10 text-center">
                                                <p className="text-slate-500 text-sm">No photos met the quality threshold</p>
                                                <p className="text-xs text-slate-400 mt-1">Try different photos or lower the score threshold in settings</p>
                                                <button onClick={openWizard}
                                                    className="mt-5 text-[#6c5ce7] text-sm hover:underline font-medium">
                                                    Try different photos →
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {batchItems.map(item => (
                                                    <div key={item.id} className="flex gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                        <ThumbnailImage itemId={item.id} className="w-[72px] h-[72px] shrink-0 rounded-lg" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1.5">
                                                                <ScoreRing score={item.ai_score} />
                                                                <div>
                                                                    {item.mood && <span className="text-[10px] text-slate-500">#{item.mood}</span>}
                                                                    {item.subject && <span className="ml-1.5 text-[10px] text-slate-500">{item.subject}</span>}
                                                                </div>
                                                            </div>
                                                            <p className="text-xs text-slate-600 line-clamp-2 mb-2">{item.suggested_caption}</p>
                                                            <button onClick={() => handleReject(item.id)}
                                                                className="text-xs font-medium px-3 py-1 bg-white border border-slate-200 text-slate-500 rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors">
                                                                Skip
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}

                                                <div className="flex gap-3 pt-4 mt-2 border-t border-slate-100">
                                                    <button onClick={handlePostNow} disabled={postingNow}
                                                        className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
                                                        style={{ background: '#6c5ce7' }}>
                                                        {postingNow ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                                                        Post Next Now
                                                    </button>
                                                    <button onClick={() => goToDashboard('APPROVED')}
                                                        className="flex-1 text-sm font-medium py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                                                        View in Queue
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </WizardStepBlock>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </main>

            <Toaster position="bottom-right" toastOptions={{
                style: { background: '#ffffff', border: '1px solid #e2e8f0', color: '#1e293b' },
            }} />
        </div>
    );
}
