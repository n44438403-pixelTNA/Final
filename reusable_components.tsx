import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// ==========================================
// 1. EXTRACTED TYPES (From types.ts)
// ==========================================

export type ClassLevel = '6' | '7' | '8' | '9' | '10' | '11' | '12' | 'COMPETITION';
export type Board = 'CBSE' | 'BSEB' | 'COMPETITION';
export type Stream = 'Science' | 'Commerce' | 'Arts';
export type Role = 'STUDENT' | 'ADMIN' | 'SUB_ADMIN';
export type ContentType = 'NOTES_SIMPLE' | 'NOTES_PREMIUM' | 'MCQ_ANALYSIS' | 'MCQ_SIMPLE' | 'MCQ_RESULT' | 'PDF_FREE' | 'PDF_PREMIUM' | 'PDF_ULTRA' | 'PDF_VIEWER' | 'WEEKLY_TEST' | 'VIDEO_LECTURE' | 'NOTES_HTML_FREE' | 'NOTES_HTML_PREMIUM' | 'NOTES_IMAGE_AI';
export type PerformanceTag = 'EXCELLENT' | 'GOOD' | 'BAD' | 'VERY_BAD';

export interface User {
  id: string;
  name: string;
  mobile: string;
  email: string;
  role: Role;
  createdAt: string;
  credits: number;
  streak: number;
  board?: string;
  classLevel?: string;
  stream?: string;
  mcqHistory?: MCQResult[];
  subscriptionTier?: 'FREE' | 'WEEKLY' | 'MONTHLY' | '3_MONTHLY' | 'YEARLY' | 'LIFETIME' | 'CUSTOM';
}

export interface SystemSettings {
  appName: string;
  appLogo?: string;
  appShortName?: string;
  isAutoTtsEnabled?: boolean;
}

export interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Chapter {
  id: string;
  title: string;
  description?: string;
}

export interface MCQItem {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  mnemonic?: string;
  concept?: string;
  topic?: string;
  examTip?: string;
  commonMistake?: string;
  difficultyLevel?: string;
}

export interface MCQResult {
  id: string;
  userId: string;
  chapterId: string;
  subjectId: string;
  subjectName: string;
  chapterTitle: string;
  date: string;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  score: number;
  totalTimeSeconds: number;
  averageTimePerQuestion: number;
  performanceTag: PerformanceTag;
  classLevel?: string;
  topic?: string;
  omrData?: {
      qIndex: number;
      selected: number;
      correct: number;
      timeSpent?: number;
  }[];
  wrongQuestions?: any[];
  topicAnalysis?: Record<string, { correct: number, total: number, percentage: number }>;
  ultraAnalysisReport?: string;
}

export interface LessonContent {
  id: string;
  title: string;
  subtitle: string;
  content: string;
  type: ContentType;
  dateCreated: string;
  subjectName: string;
  mcqData?: MCQItem[];
  manualMcqData_HI?: MCQItem[];
  aiHtmlContent?: string;
  isComingSoon?: boolean;
  userAnswers?: Record<number, number>;
  analysisType?: 'FREE' | 'PREMIUM';
  aiAnalysisText?: string;
  topic?: string;
  analytics?: any;
  pdfUrl?: string;
  videoUrl?: string;
  schoolPremiumNotesHtml_HI?: string;
}

// ==========================================
// 2. EXTRACTED SYLLABUS DATA (From full_syllabus_data.ts)
// ==========================================

export const FULL_SYLLABUS: Record<string, string[]> = {
  // Truncated for brevity - normally would copy the entire object from full_syllabus_data.ts
  "BSEB-10-Mathematics": ["वास्तविक संख्याएँ", "बहुपद", "दो चर वाले रैखिक समीकरण युग्म", "द्विघात समीकरण"],
  "CBSE-10-Mathematics": ["Real Numbers", "Polynomials", "Pair of Linear Equations in Two Variables", "Quadratic Equations"]
};

// Placeholder utilities for the extracted components
const decodeHtml = (html: string) => html;
const renderMathInHtml = (html: string) => html;
const stripHtml = (html: string) => html.replace(/<[^>]*>?/gm, '');

// ==========================================
// 3. EXTRACTED NOTES UI COMPONENT
// ==========================================

import { ArrowLeft, Globe, X, Clock, ExternalLink } from 'lucide-react';

interface NotesViewerProps {
    content: LessonContent;
    language: 'English' | 'Hindi';
    setLanguage: React.Dispatch<React.SetStateAction<'English' | 'Hindi'>>;
    onBack: () => void;
    settings?: SystemSettings;
    isStreaming?: boolean;
}

export const NotesViewer: React.FC<NotesViewerProps> = ({ content, language, setLanguage, onBack, settings, isStreaming }) => {
    const activeContentValue = (language === 'Hindi' && content.schoolPremiumNotesHtml_HI)
        ? content.schoolPremiumNotesHtml_HI
        : (content.content || content.pdfUrl || content.videoUrl || '');

    const contentValue = activeContentValue;
    const isImage = contentValue && (contentValue.startsWith('data:image') || contentValue.match(/\.(jpeg|jpg|gif|png|webp|bmp)$/i));
    const isHtml = content.aiHtmlContent || (contentValue && !contentValue.startsWith('http') && contentValue.includes('<'));
    const isUrl = contentValue && (contentValue.startsWith('http://') || contentValue.startsWith('https://'));

    const preventMenu = (e: React.MouseEvent | React.TouchEvent) => e.preventDefault();

    if (content.isComingSoon) {
        return (
            <div className="h-[70vh] flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-2xl m-4 border-2 border-dashed border-slate-200">
                <Clock size={64} className="text-orange-400 mb-4 opacity-80" />
                <h2 className="text-2xl font-black text-slate-800 mb-2">Coming Soon</h2>
                <p className="text-slate-600 max-w-sm mx-auto mb-6">This content is currently being prepared.</p>
                <button onClick={onBack} className="mt-8 text-slate-400 font-bold hover:text-slate-600">Go Back</button>
            </div>
        );
    }

    if (isHtml) {
        const htmlToRender = content.aiHtmlContent || content.content;
        const decodedContent = decodeHtml(htmlToRender);
        return (
            <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in fade-in">
                <header className="bg-white/95 backdrop-blur-md text-slate-800 p-4 absolute top-0 left-0 right-0 z-10 flex items-center justify-between border-b border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="p-2 bg-slate-100 rounded-full"><ArrowLeft size={20} /></button>
                        <div>
                            <h2 className="text-sm font-bold">{content.title}</h2>
                            <p className="text-[10px] text-teal-600 font-bold uppercase tracking-widest">Digital Notes</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setLanguage(l => l === 'English' ? 'Hindi' : 'English')}
                            className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 border border-slate-200 flex items-center gap-1 transition-all"
                        >
                            <Globe size={14} /> {language === 'English' ? 'Hindi (हिंदी)' : 'English'}
                        </button>
                        <button onClick={onBack} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X size={20} /></button>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto w-full pt-16 pb-20 px-4 md:px-8 bg-white">
                    <div
                        className="prose prose-slate max-w-none prose-p:leading-relaxed prose-p:text-slate-700 prose-headings:font-black font-sans"
                        dangerouslySetInnerHTML={{ __html: decodedContent }}
                    />
                    {isStreaming && (
                    <div className="flex items-center gap-2 text-slate-500 mt-4 px-4 md:px-8 animate-pulse pb-4">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        <span className="text-xs font-bold">AI writing...</span>
                    </div>
                    )}
                </div>
            </div>
        );
    }

    if (isImage) {
        return (
            <div className="fixed inset-0 z-50 bg-[#111] flex flex-col animate-in fade-in">
                <header className="bg-black/90 backdrop-blur-md text-white p-4 absolute top-0 left-0 right-0 z-10 flex items-center justify-between border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="p-2 bg-white/10 rounded-full"><ArrowLeft size={20} /></button>
                        <div>
                            <h2 className="text-sm font-bold text-white/90">{content.title}</h2>
                            <p className="text-[10px] text-teal-400 font-bold uppercase tracking-widest">Image Notes</p>
                        </div>
                    </div>
                    <button onClick={onBack} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors backdrop-blur-md"><X size={20} /></button>
                </header>
                <div className="flex-1 overflow-y-auto pt-16 flex items-start justify-center" onContextMenu={preventMenu}>
                    <img src={contentValue} alt="Notes" className="w-full h-auto object-contain" draggable={false} />
                </div>
            </div>
        );
    }

    if (isUrl || content.type.startsWith('PDF_')) {
        return (
            <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in fade-in">
                <header className="bg-white border-b p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="p-2 bg-slate-100 rounded-full"><ArrowLeft size={20} /></button>
                        <h2 className="font-bold truncate">{content.title}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <a href={contentValue} target="_blank" rel="noopener noreferrer" className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors">
                            <ExternalLink size={20} />
                        </a>
                        <button onClick={onBack} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X size={20} /></button>
                    </div>
                </header>
                <div className="flex-1 bg-slate-100 relative">
                    <iframe src={contentValue} className="absolute inset-0 w-full h-full border-none" title={content.title} allowFullScreen />
                </div>
            </div>
        );
    }

    // Markdown fallback
    return (
        <div className="flex flex-col h-full bg-white animate-in fade-in">
            <header className="bg-white border-b p-4 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 bg-slate-100 rounded-full"><ArrowLeft size={20} /></button>
                    <h2 className="font-bold">{content.title}</h2>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setLanguage(l => l === 'English' ? 'Hindi' : 'English')}
                        className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 border border-slate-200 flex items-center gap-1 transition-all"
                    >
                        <Globe size={14} /> {language === 'English' ? 'Hindi (हिंदी)' : 'English'}
                    </button>
                    <button onClick={onBack} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X size={20} /></button>
                </div>
            </header>
            <div className="flex-1 overflow-y-auto p-6 bg-white">
                <div className="prose prose-slate max-w-none prose-p:leading-relaxed prose-p:text-slate-700 prose-headings:font-black font-sans">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {content.content}
                    </ReactMarkdown>
                    {isStreaming && (
                    <div className="flex items-center gap-2 text-slate-500 mt-4 animate-pulse">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        <span className="text-xs font-bold">AI writing...</span>
                    </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ==========================================
// 5. EXTRACTED MARKSHEET ANALYSIS COMPONENT
// ==========================================

import { Grid, BookOpen, Lightbulb, AlertCircle, BarChart, TrendingUp, TrendingDown, Target, Brain, Share2, Download, FileText, BrainCircuit, FileSearch, StopCircle, Play, Volume2 } from 'lucide-react';
import { SpeakButton } from './components/SpeakButton';

interface MarksheetAnalyzerProps {
    result: MCQResult;
    user: User;
    settings?: SystemSettings;
    onClose: () => void;
    questions?: MCQItem[];
    initialView?: 'ANALYSIS' | 'RECOMMEND';
}

export const MarksheetAnalyzer: React.FC<MarksheetAnalyzerProps> = ({ result, user, settings, onClose, questions }) => {
    const [activeTab, setActiveTab] = useState<'OFFICIAL_MARKSHEET' | 'SOLUTION' | 'OMR' | 'DETAILED_SOLUTIONS'>('OFFICIAL_MARKSHEET');

    // TTS Playlist State
    const [playlist, setPlaylist] = useState<string[]>([]);
    const [currentTrack, setCurrentTrack] = useState(0);
    const [isPlayingAll, setIsPlayingAll] = useState(false);

    const stopPlaylist = () => {
        setIsPlayingAll(false);
        setCurrentTrack(0);
        // Note: stopSpeech() from textToSpeech utility should be used here if fully integrating
    };

    const totalQ = result.totalQuestions || 1;
    const scorePercent = Math.round((result.score / totalQ) * 100);
    const correct = result.correctCount || 0;
    const skipped = result.omrData?.filter(d => d.selected === -1).length || 0;
    const incorrect = totalQ - correct - skipped;

    let tagColor = "bg-slate-100 text-slate-600";
    switch(result.performanceTag) {
        case 'EXCELLENT': tagColor = "bg-green-100 text-green-700"; break;
        case 'GOOD': tagColor = "bg-blue-100 text-blue-700"; break;
        case 'BAD': tagColor = "bg-orange-100 text-orange-700"; break;
        case 'VERY_BAD': tagColor = "bg-red-100 text-red-700"; break;
    }

    const renderMarksheet = () => (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 relative overflow-hidden break-inside-avoid">
            {/* App Logo & Name Header */}
            <div className="flex flex-col items-center mb-6 pb-6 border-b border-slate-100">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-md mb-2 overflow-hidden border border-slate-100 p-1">
                    {settings?.appLogo ? (
                        <img src={settings.appLogo} alt="App Logo" className="w-full h-full object-contain" />
                    ) : (
                        <h1 className="text-xl font-black text-blue-600">{settings?.appShortName || 'App'}</h1>
                    )}
                </div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight text-center">
                    {settings?.appName || 'App Name'}
                </h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Official Result Marksheet</p>
            </div>

            {/* Test Info Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-6 mb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">{result.chapterTitle}</h2>
                    <p className="text-slate-500 font-medium mt-1">{result.subjectName}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-2 flex items-center gap-1">
                        <Clock size={12} /> {new Date(result.date).toLocaleDateString()} {new Date(result.date).toLocaleTimeString()}
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Score</div>
                    <div className={`text-4xl font-black ${scorePercent >= 80 ? 'text-green-600' : scorePercent >= 50 ? 'text-blue-600' : 'text-red-600'}`}>
                        {result.score}/{totalQ}
                    </div>
                </div>
            </div>

            {/* User Info */}
            <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between mb-8 border border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-xl font-black text-blue-600 shadow-sm border border-slate-200">
                        {user.name.charAt(0)}
                    </div>
                    <div>
                        <p className="font-bold text-slate-800">{user.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">ID: {user.id.slice(0, 8)}</p>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Accuracy</p>
                    <p className="text-2xl font-black text-slate-800">{scorePercent}%</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Time Taken</p>
                    <p className="text-xl font-black text-slate-800">{Math.floor(result.totalTimeSeconds / 60)}m {result.totalTimeSeconds % 60}s</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm flex flex-col items-center justify-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Grade</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-black ${tagColor}`}>
                        {result.performanceTag.replace('_', ' ')}
                    </span>
                </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <h4 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                    <BarChart size={16} className="text-blue-500" /> Question Breakdown
                </h4>
                <div className="flex h-4 rounded-full overflow-hidden mb-4 bg-white border border-slate-200 shadow-inner">
                    <div style={{ width: `${(correct / totalQ) * 100}%` }} className="bg-green-500"></div>
                    <div style={{ width: `${(incorrect / totalQ) * 100}%` }} className="bg-red-500"></div>
                    <div style={{ width: `${(skipped / totalQ) * 100}%` }} className="bg-slate-300"></div>
                </div>
                <div className="flex justify-between text-xs font-bold px-2">
                    <span className="text-green-700 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> {correct} Correct</span>
                    <span className="text-red-700 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> {incorrect} Incorrect</span>
                    <span className="text-slate-600 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-300"></div> {skipped} Skipped</span>
                </div>
            </div>
        </div>
    );

    const renderTopicAnalysis = () => {
        if (!result.topicAnalysis) return <p className="p-4 text-center text-slate-500">No topic data available.</p>;
        const topics = Object.keys(result.topicAnalysis);

        return (
            <div className="space-y-4 animate-in slide-in-from-bottom-4">
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-lg">
                    <h3 className="text-xl font-black mb-2 flex items-center gap-2"><BrainCircuit className="text-yellow-400" /> Topic Analysis</h3>
                    <p className="text-slate-300 text-xs font-medium">Detailed breakdown of your performance by topic.</p>
                </div>
                {topics.map((topic, i) => {
                    const stats = result.topicAnalysis![topic];
                    const percent = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                    const status = percent >= 80 ? 'STRONG' : percent >= 50 ? 'AVERAGE' : 'WEAK';

                    return (
                        <div key={i} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                <div>
                                    <h4 className="font-black text-slate-800 text-sm uppercase flex items-center gap-2">
                                        {topic}
                                        {status === 'WEAK' && <AlertCircle size={14} className="text-red-500" />}
                                    </h4>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded mt-1 inline-block ${status === 'STRONG' ? 'bg-green-100 text-green-700' : status === 'AVERAGE' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                        {status}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <div className={`text-2xl font-black ${percent >= 80 ? 'text-green-600' : percent < 50 ? 'text-red-600' : 'text-slate-800'}`}>{percent}%</div>
                                    <div className="text-[10px] text-slate-500 font-bold">{stats.correct}/{stats.total} Correct</div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderDetailedSolutions = () => {
        if (!questions) return <p className="p-4 text-center text-slate-500">No question data available.</p>;

        const handlePlayAll = () => {
            const newPlaylist = questions.map((q, idx) => {
                const cleanQuestion = stripHtml(q.question);
                const cleanExplanation = q.explanation ? stripHtml(q.explanation) : '';
                const cleanConcept = q.concept ? stripHtml(q.concept) : '';
                const cleanExamTip = q.examTip ? stripHtml(q.examTip) : '';
                const cleanCommonMistake = q.commonMistake ? stripHtml(q.commonMistake) : '';
                const cleanMemoryTrick = q.mnemonic ? stripHtml(q.mnemonic) : '';
                const correctAnswerText = q.options ? stripHtml(q.options[q.correctAnswer]) : '';

                let text = `Question ${idx + 1}. ${cleanQuestion}. The correct answer is option ${String.fromCharCode(65 + q.correctAnswer)}, which is ${correctAnswerText}. `;
                if (cleanConcept) text += `Concept: ${cleanConcept}. `;
                if (cleanExplanation) text += `Explanation: ${cleanExplanation}. `;
                if (cleanExamTip) text += `Exam Tip: ${cleanExamTip}. `;
                if (cleanCommonMistake) text += `Common Mistake: ${cleanCommonMistake}. `;
                if (cleanMemoryTrick) text += `Memory Trick: ${cleanMemoryTrick}. `;
                return text;
            });
            setPlaylist(newPlaylist);
            setCurrentTrack(0);
            setIsPlayingAll(true);
        };

        return (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 mt-6">
                <div className="flex justify-between items-center border-b-2 border-slate-100 pb-3 mb-6">
                    <h3 className="font-black text-slate-800 text-xl flex items-center gap-2">
                        <BookOpen size={24} className="text-blue-600" /> Full Solution & Analysis
                    </h3>
                    <div className="flex gap-2">
                        {isPlayingAll ? (
                            <button onClick={stopPlaylist} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-200 flex items-center gap-1 shadow-sm transition-all active:scale-95">
                                <StopCircle size={14} /> Stop
                            </button>
                        ) : (
                            <button onClick={handlePlayAll} className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-200 flex items-center gap-1 shadow-sm transition-all active:scale-95">
                                <Play size={14} /> Play All
                            </button>
                        )}
                    </div>
                </div>

                {isPlayingAll && (
                    <div className="mb-6 p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-3 animate-pulse shadow-inner">
                        <Volume2 size={16} className="text-indigo-600 animate-bounce" />
                        <span className="text-xs font-bold text-indigo-800">
                            Playing Question {currentTrack + 1} of {playlist.length}
                        </span>
                        <button onClick={stopPlaylist} className="ml-auto p-1 bg-indigo-200 text-indigo-800 rounded-full hover:bg-indigo-300">
                            <X size={14} />
                        </button>
                    </div>
                )}
                {questions.map((q, idx) => {
                    const omrEntry = result.omrData?.find(d => d.qIndex === idx);
                    const userSelected = omrEntry ? omrEntry.selected : -1;
                    const isCorrect = userSelected === q.correctAnswer;
                    const isSkipped = userSelected === -1;

                    // Prepare TTS Text
                    const cleanQuestion = stripHtml(q.question);
                    const cleanExplanation = q.explanation ? stripHtml(q.explanation) : '';
                    const cleanConcept = q.concept ? stripHtml(q.concept) : '';
                    const cleanExamTip = q.examTip ? stripHtml(q.examTip) : '';
                    const cleanCommonMistake = q.commonMistake ? stripHtml(q.commonMistake) : '';
                    const cleanMemoryTrick = q.mnemonic ? stripHtml(q.mnemonic) : '';
                    const correctAnswerText = q.options ? stripHtml(q.options[q.correctAnswer]) : '';

                    let ttsText = `Question ${idx + 1}. ${cleanQuestion}. The correct answer is option ${String.fromCharCode(65 + q.correctAnswer)}, which is ${correctAnswerText}. `;
                    if (cleanConcept) ttsText += `Concept: ${cleanConcept}. `;
                    if (cleanExplanation) ttsText += `Explanation: ${cleanExplanation}. `;
                    if (cleanExamTip) ttsText += `Exam Tip: ${cleanExamTip}. `;
                    if (cleanCommonMistake) ttsText += `Common Mistake: ${cleanCommonMistake}. `;
                    if (cleanMemoryTrick) ttsText += `Memory Trick: ${cleanMemoryTrick}. `;

                    return (
                        <div key={idx} className={`bg-white rounded-2xl border-2 p-5 shadow-sm break-inside-avoid relative group transition-all ${isCorrect ? 'border-green-100 hover:border-green-200' : isSkipped ? 'border-slate-200 hover:border-slate-300' : 'border-red-100 hover:border-red-200'}`}>
                            <div className="absolute top-4 right-4 flex gap-2">
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <SpeakButton text={ttsText} className="bg-slate-100 hover:bg-slate-200 text-slate-600" iconSize={14} />
                                </div>
                                <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${isCorrect ? 'bg-green-100 text-green-700' : isSkipped ? 'bg-slate-100 text-slate-600' : 'bg-red-100 text-red-700'}`}>
                                    {isCorrect ? 'Correct' : isSkipped ? 'Skipped' : 'Incorrect'}
                                </span>
                            </div>

                            <div className="flex gap-3 mb-4 pr-24">
                                <span className={`w-8 h-8 flex-shrink-0 rounded-xl flex items-center justify-center text-sm font-black shadow-sm ${isCorrect ? 'bg-green-500 text-white' : isSkipped ? 'bg-slate-200 text-slate-600' : 'bg-red-500 text-white'}`}>
                                    Q{idx + 1}
                                </span>
                                <div className="text-sm font-bold text-slate-800 leading-relaxed pt-1" dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.question) }} />
                            </div>

                            {q.options && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4 pl-11">
                                    {q.options.map((opt, oIdx) => {
                                        const isThisCorrect = oIdx === q.correctAnswer;
                                        const isThisSelected = oIdx === userSelected;
                                        let optClass = "bg-slate-50 border-slate-200 text-slate-600";

                                        if (isThisCorrect) optClass = "bg-green-50 border-green-500 text-green-800 shadow-sm";
                                        else if (isThisSelected && !isThisCorrect) optClass = "bg-red-50 border-red-300 text-red-800";

                                        return (
                                            <div key={oIdx} className={`p-3 rounded-xl border ${optClass} flex items-start gap-3`}>
                                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isThisCorrect ? 'bg-green-500 text-white' : isThisSelected ? 'bg-red-500 text-white' : 'bg-white border border-slate-300'}`}>
                                                    {String.fromCharCode(65 + oIdx)}
                                                </span>
                                                <div className="text-xs font-medium" dangerouslySetInnerHTML={{ __html: renderMathInHtml(opt) }} />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="mt-4 ml-11 flex flex-col gap-3">
                                {q.concept && (
                                    <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-[20px] shadow-sm">
                                        <p className="text-[12px] font-bold text-indigo-700 mb-2 flex items-center gap-1"><Lightbulb size={14} /> Concept</p>
                                        <div className="text-sm text-slate-700 leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.concept) }} />
                                    </div>
                                )}
                                {q.explanation && (
                                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-[20px] shadow-sm">
                                        <p className="text-[12px] font-bold text-blue-700 mb-2 flex items-center gap-1"><BookOpen size={14} /> Explanation</p>
                                        <div className="text-sm text-slate-700 leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.explanation) }} />
                                    </div>
                                )}
                                {q.examTip && (
                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-[20px] shadow-sm">
                                        <p className="text-[12px] font-bold text-amber-700 mb-2 flex items-center gap-1">
                                            <Target size={14} /> Exam Tip
                                        </p>
                                        <div className="text-sm text-amber-900 leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.examTip) }} />
                                    </div>
                                )}
                                {q.commonMistake && (
                                    <div className="p-4 bg-red-50 border border-red-100 rounded-[20px] shadow-sm">
                                        <p className="text-[12px] font-bold text-red-700 mb-2 flex items-center gap-1">
                                            <AlertCircle size={14} /> Common Mistake
                                        </p>
                                        <div className="text-sm text-red-900 leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.commonMistake) }} />
                                    </div>
                                )}
                                {q.mnemonic && (
                                    <div className="p-4 bg-purple-50 border border-purple-100 rounded-[20px] shadow-sm">
                                        <p className="text-[12px] font-bold text-purple-700 mb-2 flex items-center gap-1">
                                            <Brain size={14} /> Memory Trick
                                        </p>
                                        <div className="text-sm text-purple-900 leading-relaxed font-medium whitespace-pre-line" dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.mnemonic) }} />
                                    </div>
                                )}
                                {q.difficultyLevel && (
                                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-[20px] shadow-sm flex items-center gap-3">
                                        <div className="flex items-center gap-1 text-[12px] font-bold text-slate-700">
                                            <BarChart size={14} /> Difficulty:
                                        </div>
                                        <div className="text-sm text-slate-900 font-black">
                                            {q.difficultyLevel}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-2xl h-full sm:h-auto sm:max-h-[90vh] bg-white sm:rounded-3xl shadow-2xl flex flex-col relative overflow-hidden">
                {/* Header */}
                <div className="bg-white text-slate-800 px-4 py-3 border-b border-slate-100 flex justify-between items-center z-10 sticky top-0 shrink-0">
                    <div className="flex items-center gap-3">
                        {settings?.appLogo && <img src={settings.appLogo} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-slate-50 border" />}
                        <div>
                            <h1 className="text-sm font-black uppercase text-slate-900 tracking-wide">{settings?.appName || 'RESULT'}</h1>
                            <p className="text-[10px] font-bold text-slate-400">Official Marksheet</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X size={20} /></button>
                </div>

                {/* Tabs */}
                <div className="px-4 pt-2 pb-0 bg-white border-b border-slate-100 flex gap-2 overflow-x-auto shrink-0 scrollbar-hide items-center">
                    <button onClick={() => setActiveTab('OFFICIAL_MARKSHEET')} className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${activeTab === 'OFFICIAL_MARKSHEET' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
                        <FileText size={14} className="inline mr-1 mb-0.5" /> Marksheet
                    </button>
                    <button onClick={() => setActiveTab('SOLUTION')} className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${activeTab === 'SOLUTION' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
                        <FileSearch size={14} className="inline mr-1 mb-0.5" /> Topic Analysis
                    </button>
                    <button onClick={() => setActiveTab('DETAILED_SOLUTIONS')} className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${activeTab === 'DETAILED_SOLUTIONS' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
                        <BrainCircuit size={14} className="inline mr-1 mb-0.5" /> Detailed Solutions
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50">
                    {activeTab === 'OFFICIAL_MARKSHEET' && renderMarksheet()}
                    {activeTab === 'SOLUTION' && renderTopicAnalysis()}
                    {activeTab === 'DETAILED_SOLUTIONS' && renderDetailedSolutions()}
                </div>
            </div>
        </div>
    );
};

// ==========================================
// 4. EXTRACTED MCQ COMPONENT
// ==========================================

import { Trophy, ChevronLeft, ChevronRight, Grip, List, XCircle, CheckCircle } from 'lucide-react';

interface MCQViewerProps {
    data: MCQItem[];
    onComplete: (score: number, answers: Record<number, number>, timeTaken: number) => void;
    onBack: () => void;
    instantExplanation?: boolean;
    language?: 'English' | 'Hindi';
}

export const MCQViewer: React.FC<MCQViewerProps> = ({ data, onComplete, onBack, instantExplanation = false, language = 'English' }) => {
    const [mcqState, setMcqState] = useState<Record<number, number | null>>({});
    const [batchIndex, setBatchIndex] = useState(0);
    const [sessionTime, setSessionTime] = useState(0);
    const [showSubmitModal, setShowSubmitModal] = useState(false);

    const BATCH_SIZE = 1;
    const currentBatchData = data.slice(batchIndex * BATCH_SIZE, (batchIndex + 1) * BATCH_SIZE);
    const hasMore = (batchIndex + 1) * BATCH_SIZE < data.length;
    const attemptedCount = Object.keys(mcqState).length;

    // Timer
    useEffect(() => {
        const interval = setInterval(() => {
            setSessionTime(prev => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleOptionSelect = (qIdx: number, oIdx: number) => {
        setMcqState(prev => ({ ...prev, [qIdx]: oIdx }));

        // Auto next logic
        if (hasMore) {
            if (instantExplanation) {
                const isCorrect = oIdx === data[qIdx].correctAnswer;
                if (isCorrect) setTimeout(() => setBatchIndex(prev => prev + 1), 1000);
            } else {
                setTimeout(() => setBatchIndex(prev => prev + 1), 400);
            }
        }
    };

    const handleConfirmSubmit = () => {
        setShowSubmitModal(false);
        const score = Object.keys(mcqState).reduce((acc, key) => {
            const qIdx = parseInt(key);
            return acc + (mcqState[qIdx] === data[qIdx].correctAnswer ? 1 : 0);
        }, 0);
        onComplete(score, mcqState as Record<number, number>, sessionTime);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 relative overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-600 font-bold text-sm bg-slate-100 px-3 py-2 rounded-lg hover:bg-slate-200">
                    <ArrowLeft size={16} /> Exit
                </button>
                <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end px-3 py-1.5 bg-white rounded-lg border border-slate-200">
                        <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">Total Time</span>
                        <span className="text-xs font-mono font-bold text-slate-700 leading-none">
                            {Math.floor(sessionTime / 60)}:{String(sessionTime % 60).padStart(2, '0')}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 font-bold text-xs bg-slate-100 px-3 py-2 rounded-lg border border-slate-200">
                        <Grip size={16} />
                        <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">
                            {attemptedCount}/{data.length}
                        </span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 max-w-3xl mx-auto w-full pb-32">
                {currentBatchData.map((q, localIdx) => {
                    const idx = (batchIndex * BATCH_SIZE) + localIdx;
                    const userAnswer = mcqState[idx];
                    const isAnswered = userAnswer !== undefined && userAnswer !== null;
                    const showExplanation = (instantExplanation && isAnswered && userAnswer !== q.correctAnswer);

                    return (
                        <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all">
                            <div className="flex justify-between items-start mb-4 gap-3">
                                <div className="font-bold text-slate-800 flex gap-3 leading-relaxed flex-1">
                                    <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 font-bold mt-0.5">{idx + 1}</span>
                                    <div dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.question) }} className="prose prose-sm max-w-none" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                {q.options.map((opt, oIdx) => {
                                    let btnClass = "w-full text-left p-3 rounded-xl border transition-all text-sm font-medium relative overflow-hidden ";
                                    const showColors = (instantExplanation && isAnswered);

                                    if (showColors) {
                                        if (oIdx === q.correctAnswer) btnClass += "bg-green-100 border-green-300 text-green-800";
                                        else if (userAnswer === oIdx) btnClass += "bg-red-100 border-red-300 text-red-800";
                                        else btnClass += "bg-slate-50 border-slate-100 opacity-60";
                                    } else if (isAnswered) {
                                        if (userAnswer === oIdx) btnClass += "bg-blue-100 border-blue-300 text-blue-800";
                                        else btnClass += "bg-slate-50 border-slate-100 opacity-60";
                                    } else {
                                        btnClass += "bg-white border-slate-200 hover:bg-slate-50 hover:border-blue-200";
                                    }

                                    return (
                                        <button
                                            key={oIdx}
                                            disabled={isAnswered}
                                            onClick={() => handleOptionSelect(idx, oIdx)}
                                            className={btnClass}
                                        >
                                            <span className="relative z-10 flex justify-between items-center w-full gap-2">
                                                <div dangerouslySetInnerHTML={{ __html: renderMathInHtml(opt) }} className="flex-1" />
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {showColors && oIdx === q.correctAnswer && <CheckCircle size={16} className="text-green-600" />}
                                                    {showColors && userAnswer === oIdx && userAnswer !== q.correctAnswer && <XCircle size={16} className="text-red-500" />}
                                                </div>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {showExplanation && (
                                <div className="mt-6 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
                                    {q.explanation && (
                                        <div className="p-5 bg-blue-50 border border-blue-100 rounded-[20px] shadow-sm">
                                            <div className="text-blue-700 font-bold text-sm mb-2">Explanation</div>
                                            <div className="text-slate-700 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.explanation) }} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer Navigation */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 flex gap-3 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-20">
                {batchIndex > 0 && (
                    <button onClick={() => setBatchIndex(p => p - 1)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl flex items-center justify-center gap-2">
                        <ChevronLeft size={20} /> Back
                    </button>
                )}

                {hasMore ? (
                    <button onClick={() => setBatchIndex(p => p + 1)} className="flex-[2] py-3 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-100">
                        Next <ChevronRight size={20} />
                    </button>
                ) : (
                    <button onClick={() => setShowSubmitModal(true)} className="flex-[2] py-3 bg-green-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-100">
                        Submit <Trophy size={20} />
                    </button>
                )}
            </div>

            {/* Submit Modal */}
            {showSubmitModal && (
                <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-lg text-center shadow-2xl">
                        <Trophy size={48} className="mx-auto text-yellow-400 mb-4" />
                        <h3 className="text-xl font-black text-slate-800 mb-2">Submit Test?</h3>
                        <p className="text-slate-500 text-sm mb-6">
                            You have answered {attemptedCount} out of {data.length} questions.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowSubmitModal(false)} className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl">Cancel</button>
                            <button onClick={handleConfirmSubmit} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg">Yes, Submit</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
