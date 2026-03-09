import React, { useState, useEffect } from 'react';
import { Board, ClassLevel, Stream, Subject, Chapter } from '../types';
import { getSubjectsList } from '../constants';
import { fetchChapters } from '../services/groq';
import { getChapterData } from '../firebase';
import { storage } from '../utils/storage';
import { RefreshCw, FileText, CheckCircle, XCircle, Video, Music, Layers, BookOpen, Loader2, Search } from 'lucide-react';

interface Props {
    board: Board;
}

interface ChapterStatus {
    id: string;
    title: string;
    hasNotes: boolean;
    hasMcq: boolean;
    hasVideo: boolean;
    hasAudio: boolean;
    lastUpdated?: string;
}

export const SyllabusManager: React.FC<Props> = ({ board }) => {
    const [selectedClass, setSelectedClass] = useState<ClassLevel>('10');
    const [selectedStream, setSelectedStream] = useState<Stream>('Science');
    const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

    const [chapters, setChapters] = useState<ChapterStatus[]>([]);
    const [loading, setLoading] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);

    const subjects = getSubjectsList(selectedClass, selectedStream, board);

    // Initial Load
    useEffect(() => {
        setChapters([]);
        setSelectedSubject(null);
    }, [selectedClass, selectedStream]);

    const handleSubjectSelect = async (subject: Subject) => {
        setSelectedSubject(subject);
        setLoading(true);
        try {
            // 1. Fetch Chapter List (Structure)
            const lang = board === 'BSEB' ? 'Hindi' : 'English';
            const rawChapters = await fetchChapters(board, selectedClass, selectedStream, subject, lang);

            // 2. Initial Map (Status Unknown)
            const statusList: ChapterStatus[] = rawChapters.map(c => ({
                id: c.id,
                title: c.title,
                hasNotes: false,
                hasMcq: false,
                hasVideo: false,
                hasAudio: false
            }));

            setChapters(statusList);

            // 3. Auto Scan immediately? Or wait for user?
            // Let's do a quick local check if possible, otherwise user clicks Scan.
            // Better to let user click Scan for deep check.
        } catch (e) {
            console.error("Error fetching chapters:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleScan = async () => {
        if (!selectedSubject || chapters.length === 0) return;
        setScanning(true);
        setScanProgress(0);

        const updatedChapters = [...chapters];
        const streamKey = (selectedClass === '11' || selectedClass === '12') && selectedStream ? `-${selectedStream}` : '';

        for (let i = 0; i < updatedChapters.length; i++) {
            const ch = updatedChapters[i];
            const key = `nst_content_${board}_${selectedClass}${streamKey}_${selectedSubject.name}_${ch.id}`;

            try {
                // 1. Try Local Storage
                let data: any = await storage.getItem(key);

                // 2. Try Cloud (If not local or force refresh logic needed)
                if (!data) {
                    try {
                        data = await getChapterData(key);
                    } catch (e) { console.warn("Cloud fetch failed for", key); }
                }

                if (data) {
                    // Check Content Existence
                    const hasNotes = !!(data.freeLink || data.premiumLink || data.premiumNotesHtml || (data.topicNotes && data.topicNotes.length > 0));
                    const hasMcq = !!(data.manualMcqData?.length > 0 || data.weeklyTestMcqData?.length > 0);
                    const hasVideo = !!(data.videoPlaylist?.length > 0 || data.premiumVideoLink || data.freeVideoLink);
                    const hasAudio = !!(data.audioPlaylist?.length > 0);

                    updatedChapters[i] = {
                        ...ch,
                        hasNotes,
                        hasMcq,
                        hasVideo,
                        hasAudio,
                        lastUpdated: new Date().toLocaleTimeString()
                    };
                }
            } catch (e) {
                console.error(`Scan error for ${ch.title}:`, e);
            }

            // Update Progress
            setScanProgress(Math.round(((i + 1) / updatedChapters.length) * 100));
            // Update State Incrementally (Visual Feedback)
            if (i % 5 === 0) setChapters([...updatedChapters]);
        }

        setChapters(updatedChapters);
        setScanning(false);
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* CONTROLS */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-wrap gap-4 items-center">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Class</label>
                        <select
                            value={selectedClass}
                            onChange={e => setSelectedClass(e.target.value as ClassLevel)}
                            className="p-2 border rounded-lg text-sm font-bold bg-slate-50"
                        >
                            {['6','7','8','9','10','11','12','COMPETITION'].map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    {['11','12'].includes(selectedClass) && (
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Stream</label>
                            <select
                                value={selectedStream}
                                onChange={e => setSelectedStream(e.target.value as Stream)}
                                className="p-2 border rounded-lg text-sm font-bold bg-slate-50"
                            >
                                {['Science','Commerce','Arts'].map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Subject</label>
                        <div className="flex flex-wrap gap-2">
                            {subjects.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => handleSubjectSelect(s)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                        selectedSubject?.id === s.id
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    {s.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* STATUS GRID */}
            {selectedSubject && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <BookOpen size={18} className="text-indigo-600" />
                            {selectedSubject.name} - Content Status
                        </h3>
                        <button
                            onClick={handleScan}
                            disabled={scanning}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all ${
                                scanning
                                    ? 'bg-slate-100 text-slate-400 cursor-wait'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}
                        >
                            {scanning ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            {scanning ? `Scanning... ${scanProgress}%` : 'Scan Content'}
                        </button>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-slate-400">
                            <Loader2 size={32} className="animate-spin mx-auto mb-2" />
                            <p className="text-xs font-bold">Fetching Chapters...</p>
                        </div>
                    ) : (
                        <div className="max-h-[60vh] overflow-y-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 font-bold text-slate-500 uppercase sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-3 pl-4">Chapter Name</th>
                                        <th className="p-3 text-center w-20">Notes</th>
                                        <th className="p-3 text-center w-20">MCQ</th>
                                        <th className="p-3 text-center w-20">Video</th>
                                        <th className="p-3 text-center w-20">Audio</th>
                                        <th className="p-3 text-right pr-4 w-24">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {chapters.map((ch, i) => (
                                        <tr key={ch.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="p-3 pl-4">
                                                <span className="font-bold text-slate-700 block truncate max-w-[200px] md:max-w-lg" title={ch.title}>
                                                    {i + 1}. {ch.title}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                {ch.hasNotes
                                                    ? <CheckCircle size={16} className="mx-auto text-green-500" />
                                                    : <XCircle size={16} className="mx-auto text-slate-200 group-hover:text-red-300 transition-colors" />
                                                }
                                            </td>
                                            <td className="p-3 text-center">
                                                {ch.hasMcq
                                                    ? <CheckCircle size={16} className="mx-auto text-green-500" />
                                                    : <XCircle size={16} className="mx-auto text-slate-200 group-hover:text-red-300 transition-colors" />
                                                }
                                            </td>
                                            <td className="p-3 text-center">
                                                {ch.hasVideo
                                                    ? <CheckCircle size={16} className="mx-auto text-green-500" />
                                                    : <XCircle size={16} className="mx-auto text-slate-200 group-hover:text-red-300 transition-colors" />
                                                }
                                            </td>
                                            <td className="p-3 text-center">
                                                {ch.hasAudio
                                                    ? <CheckCircle size={16} className="mx-auto text-green-500" />
                                                    : <XCircle size={16} className="mx-auto text-slate-200 group-hover:text-red-300 transition-colors" />
                                                }
                                            </td>
                                            <td className="p-3 text-right pr-4">
                                                {ch.lastUpdated ? (
                                                    <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                                        Synced
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] font-bold text-orange-400 bg-orange-50 px-1.5 py-0.5 rounded">
                                                        Pending
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {chapters.length === 0 && (
                                <div className="p-12 text-center text-slate-400 text-sm">
                                    No chapters found. Please select a subject.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
