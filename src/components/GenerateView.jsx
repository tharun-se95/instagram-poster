import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Sparkles, Loader2, Trash2, Send, RefreshCw, Image, CheckCircle2 } from 'lucide-react';

const MODELS = [
    { id: 'default',  label: 'High Quality',   desc: 'Best results'    },
    { id: 'turbo',    label: 'Fast',           desc: 'Quick preview'   },
    { id: 'zimage',   label: 'Artistic',       desc: 'Stylized look'   },
];

const RATIOS = [
    { label: 'Square',    ratio: '1:1',    width: 1080, height: 1080 },
    { label: 'Portrait',  ratio: '4:5',    width: 1080, height: 1350 },
    { label: 'Landscape', ratio: '1.91:1', width: 1080, height: 566  },
];

function StatusBadge({ status }) {
    if (status === 'QUEUED') {
        return (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-200">
                <CheckCircle2 size={10} /> Queued for Posting
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
            DRAFT
        </span>
    );
}

export default function GenerateView({ SERVER }) {
    const [prompt, setPrompt]         = useState('');
    const [model, setModel]           = useState('default');
    const [ratio, setRatio]           = useState(RATIOS[1]);
    const [caption, setCaption]       = useState('');
    const [generating, setGenerating] = useState(false);
    const [currentResult, setCurrentResult] = useState(null); // { id, imageUrl }
    const [history, setHistory]       = useState([]);

    const fetchHistory = useCallback(async () => {
        try {
            const res = await axios.get(`${SERVER}/api/generate/history`);
            setHistory(res.data || []);
        } catch {
            // silently ignore — history endpoint may not exist yet
        }
    }, [SERVER]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            toast.error('Please enter a prompt');
            return;
        }
        setGenerating(true);
        setCurrentResult(null);
        try {
            const res = await axios.post(`${SERVER}/api/generate`, {
                prompt: prompt.trim(),
                model,
                width:   ratio.width,
                height:  ratio.height,
                caption: caption.trim(),
            });
            setCurrentResult({ id: res.data.id, imageUrl: `${SERVER}${res.data.imageUrl}` });
            fetchHistory();
        } catch (err) {
            const msg = err.response?.data?.error || err.message || 'Generation failed';
            const isServiceDown = msg.toLowerCase().includes('pollinations') || msg.includes('500') || msg.includes('variants');
            toast.error(isServiceDown
                ? 'Pollinations.ai is unavailable right now — try again in a few minutes'
                : msg
            );
        } finally {
            setGenerating(false);
        }
    };

    const handleQueue = async (id, cap) => {
        try {
            await axios.post(`${SERVER}/api/generate/${id}/queue`, { caption: cap });
            toast.success('Queued for Instagram posting!');
            fetchHistory();
            if (currentResult?.id === id) {
                setCurrentResult(prev => ({ ...prev })); // trigger re-render for status
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to queue');
        }
    };

    const handleDelete = async (id) => {
        try {
            await axios.delete(`${SERVER}/api/generate/${id}`);
            toast('Deleted');
            if (currentResult?.id === id) setCurrentResult(null);
            fetchHistory();
        } catch {
            toast.error('Failed to delete');
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">

            {/* ── Generation Form ─────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
                <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={18} style={{ color: '#6c5ce7' }} />
                    <h2 className="text-slate-800 font-semibold text-base">AI Image Generation</h2>
                </div>

                {/* Prompt */}
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Prompt</label>
                    <textarea
                        rows={3}
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        placeholder="A golden sunset over misty mountains, cinematic, ultra-detailed…"
                        className="w-full text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]/30 placeholder:text-slate-300"
                    />
                </div>

                {/* Caption */}
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Caption <span className="text-slate-400 font-normal">(optional)</span></label>
                    <input
                        type="text"
                        value={caption}
                        onChange={e => setCaption(e.target.value)}
                        placeholder="Add a caption for Instagram…"
                        className="w-full text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]/30 placeholder:text-slate-300"
                    />
                </div>

                {/* Model selector */}
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-2">Model</label>
                    <div className="flex gap-2 flex-wrap">
                        {MODELS.map(m => (
                            <button
                                key={m.id}
                                onClick={() => setModel(m.id)}
                                className={`flex flex-col px-4 py-2.5 rounded-xl border text-left transition-colors ${
                                    model === m.id
                                        ? 'border-[#6c5ce7] bg-[#f0eeff] text-[#6c5ce7]'
                                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                }`}
                            >
                                <span className="text-sm font-semibold">{m.label}</span>
                                <span className="text-[11px] opacity-70">{m.desc}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Aspect ratio selector */}
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-2">Aspect Ratio</label>
                    <div className="flex gap-2 flex-wrap">
                        {RATIOS.map(r => (
                            <button
                                key={r.ratio}
                                onClick={() => setRatio(r)}
                                className={`flex flex-col px-4 py-2.5 rounded-xl border text-left transition-colors ${
                                    ratio.ratio === r.ratio
                                        ? 'border-[#6c5ce7] bg-[#f0eeff] text-[#6c5ce7]'
                                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                }`}
                            >
                                <span className="text-sm font-semibold">{r.label}</span>
                                <span className="text-[11px] opacity-70">{r.ratio} · {r.width}×{r.height}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Generate button */}
                <button
                    onClick={handleGenerate}
                    disabled={generating || !prompt.trim()}
                    className="flex items-center gap-2 text-sm font-semibold text-white px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: '#6c5ce7' }}
                >
                    {generating
                        ? <><Loader2 size={15} className="animate-spin" /> Generating…</>
                        : <><Sparkles size={15} /> Generate</>}
                </button>
            </div>

            {/* ── Generated Image Preview ─────────────────────────────── */}
            {(generating || currentResult) && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h3 className="text-sm font-semibold text-slate-800 mb-4">Result</h3>
                    {generating ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#f0eeff' }}>
                                <Loader2 size={26} className="animate-spin" style={{ color: '#6c5ce7' }} />
                            </div>
                            <p className="text-sm text-slate-500">Generating your image…</p>
                        </div>
                    ) : currentResult ? (
                        <div className="space-y-4">
                            <div className="rounded-xl overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center" style={{ maxHeight: 480 }}>
                                <img
                                    src={currentResult.imageUrl}
                                    alt="Generated"
                                    className="max-w-full max-h-[480px] object-contain rounded-xl"
                                />
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    onClick={() => handleQueue(currentResult.id, caption)}
                                    className="flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-xl hover:opacity-90 transition-opacity"
                                    style={{ background: '#6c5ce7' }}
                                >
                                    <Send size={13} /> Queue for Instagram
                                </button>
                                <button
                                    onClick={handleGenerate}
                                    className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                    <RefreshCw size={13} /> Regenerate
                                </button>
                                <button
                                    onClick={() => handleDelete(currentResult.id)}
                                    className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl border border-red-100 text-red-400 hover:bg-red-50 transition-colors"
                                >
                                    <Trash2 size={13} /> Delete
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>
            )}

            {/* ── History Grid ────────────────────────────────────────── */}
            {history.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Image size={15} className="text-slate-400" />
                        <h3 className="text-sm font-semibold text-slate-800">History</h3>
                        <span className="text-xs text-slate-400">({history.length})</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {history.map(item => (
                            <div
                                key={item.id}
                                className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden group"
                            >
                                <div className="aspect-square bg-slate-50 relative overflow-hidden">
                                    {item.id ? (
                                        <img
                                            src={`${SERVER}/api/generate/${item.id}/image`}
                                            alt={item.prompt}
                                            className="w-full h-full object-cover"
                                            onError={e => { e.target.style.display = 'none'; }}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Image size={24} className="text-slate-200" />
                                        </div>
                                    )}
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 bg-white/90 rounded-full flex items-center justify-center shadow-sm hover:bg-red-50"
                                    >
                                        <Trash2 size={11} className="text-red-400" />
                                    </button>
                                </div>
                                <div className="p-2.5 space-y-1.5">
                                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                        {item.prompt}
                                    </p>
                                    <div className="flex items-center justify-between gap-1">
                                        <StatusBadge status={item.status} />
                                        {item.status !== 'QUEUED' && (
                                            <button
                                                onClick={() => handleQueue(item.id, item.caption || '')}
                                                title="Queue for Instagram"
                                                className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:border-[#6c5ce7] hover:text-[#6c5ce7] transition-colors"
                                            >
                                                <Send size={9} /> Queue
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty history state */}
            {!generating && !currentResult && history.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
                    <Image size={36} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-sm font-medium text-slate-400">No generations yet</p>
                    <p className="text-xs text-slate-300 mt-1">Enter a prompt above and click Generate</p>
                </div>
            )}
        </div>
    );
}
