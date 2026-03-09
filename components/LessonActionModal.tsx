import React from 'react';
import { Chapter, ContentType } from '../types';
import { FileText, CheckSquare, Video, Headphones, X } from 'lucide-react';

interface Props {
    chapter: Chapter;
    onClose: () => void;
    onSelect: (type: ContentType) => void;
    logoUrl?: string; // NEW
    appName?: string; // NEW
}

export const LessonActionModal: React.FC<Props> = ({ chapter, onClose, onSelect, logoUrl, appName }) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200">
            <div
                className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 duration-300 relative border border-white/20"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Branding */}
                <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-6 pb-8 text-center relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors backdrop-blur-sm"
                    >
                        <X size={16} />
                    </button>

                    <div className="w-16 h-16 bg-white rounded-2xl mx-auto shadow-lg flex items-center justify-center mb-3 transform rotate-3 overflow-hidden">
                        <img
                            src={logoUrl || "/icon-192.png"}
                            alt="App"
                            className="w-full h-full object-cover"
                            onError={(e) => (e.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/3426/3426653.png')}
                        />
                    </div>
                    <h2 className="text-white font-black text-lg tracking-tight leading-tight">{appName || 'Ideal Inspiration Classes'}</h2>
                    <p className="text-indigo-100 text-[10px] uppercase font-bold tracking-widest mt-1">Premium Learning</p>
                </div>

                {/* Content Body */}
                <div className="p-6 -mt-4 bg-white rounded-t-[32px] relative z-10">
                    <div className="text-center mb-6">
                        <h3 className="font-black text-slate-800 text-lg leading-tight mb-1 line-clamp-2">{chapter.title}</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Select Resource</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => onSelect('PDF')}
                            className="group relative flex flex-col items-center justify-center gap-2 p-3 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all active:scale-95"
                        >
                            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <FileText size={18} />
                            </div>
                            <div className="text-center">
                                <span className="font-bold text-slate-600 text-xs group-hover:text-blue-600 block">Notes</span>
                                <span className="text-[9px] text-slate-400 font-medium leading-tight block mt-0.5">Complete Chapter Explanation</span>
                            </div>
                        </button>

                        <button
                            onClick={() => onSelect('MCQ')}
                            className="group relative flex flex-col items-center justify-center gap-2 p-3 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md hover:border-purple-200 transition-all active:scale-95"
                        >
                            <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                <CheckSquare size={18} />
                            </div>
                            <div className="text-center">
                                <span className="font-bold text-slate-600 text-xs group-hover:text-purple-600 block">Test</span>
                                <span className="text-[9px] text-slate-400 font-medium leading-tight block mt-0.5">Practice & Test Yourself</span>
                            </div>
                        </button>

                        <button
                            onClick={() => onSelect('VIDEO')}
                            className="group relative flex flex-col items-center justify-center gap-2 p-3 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md hover:border-rose-200 transition-all active:scale-95"
                        >
                            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-colors">
                                <Video size={18} />
                            </div>
                            <div className="text-center">
                                <span className="font-bold text-slate-600 text-xs group-hover:text-rose-600 block">Video</span>
                                <span className="text-[9px] text-slate-400 font-medium leading-tight block mt-0.5">Concept Clarity</span>
                            </div>
                        </button>

                        <button
                            onClick={() => onSelect('AUDIO')}
                            className="group relative flex flex-col items-center justify-center gap-2 p-3 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md hover:border-amber-200 transition-all active:scale-95"
                        >
                            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
                                <Headphones size={18} />
                            </div>
                            <div className="text-center">
                                <span className="font-bold text-slate-600 text-xs group-hover:text-amber-600 block">Audio</span>
                                <span className="text-[9px] text-slate-400 font-medium leading-tight block mt-0.5">Quick Revision Mode</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
