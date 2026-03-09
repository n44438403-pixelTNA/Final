import { safeSetLocalStorage, saveUserLocal } from '../utils/safeStorage';

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { LessonContent, Subject, ClassLevel, Chapter, MCQItem, ContentType, User, SystemSettings } from '../types';
import { ArrowLeft, Clock, AlertTriangle, ExternalLink, CheckCircle, XCircle, Trophy, BookOpen, Play, Lock, ChevronRight, ChevronLeft, Save, X, Maximize, Volume2, Square, Zap, StopCircle, Globe, Lightbulb, FileText, BrainCircuit, Grip, CheckSquare, List, Download, BarChart3, Target, Brain } from 'lucide-react';
import { CustomConfirm, CustomAlert } from './CustomDialogs';
import { CustomPlayer } from './CustomPlayer';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { decodeHtml } from '../utils/htmlDecoder';
import { storage } from '../utils/storage';
import { getChapterData, saveUserHistory, saveTestResult, saveUserToLive } from '../firebase';
import { SpeakButton } from './SpeakButton';
import { renderMathInHtml } from '../utils/mathUtils';
import { stopSpeaking } from '../utils/ttsHighlighter';
import { speakText, stripHtml } from '../utils/textToSpeech';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { DownloadOptionsModal } from './DownloadOptionsModal';
import { downloadAsMHTML } from '../utils/downloadUtils';

interface Props {
  content: LessonContent | null;
  subject: Subject;
  classLevel: ClassLevel;
  chapter: Chapter;
  loading: boolean;
  onBack: () => void;
  onMCQComplete?: (count: number, answers: Record<number, number>, usedData: MCQItem[], timeTaken: number, questionTimes?: Record<number, number>) => void;
  user?: User; // Optional for non-MCQ views
  onUpdateUser?: (user: User) => void;
  settings?: SystemSettings; // New Prop for Pricing
  isStreaming?: boolean; // Support for streaming content
  onLaunchContent?: (content: any) => void;
  onToggleAutoTts?: (enabled: boolean) => void;
  instantExplanation?: boolean; // NEW: Instant Feedback Mode
  onShowMarksheet?: (result?: any) => void; // NEW: Marksheet Trigger
}

export const LessonView: React.FC<Props> = ({ 
  content, 
  subject, 
  classLevel, 
  chapter,
  loading, 
  onBack,
  onMCQComplete,
  user,
  onUpdateUser,
  settings,
  isStreaming = false,
  onLaunchContent,
  onToggleAutoTts,
  instantExplanation = false, // Default to standard mode
  onShowMarksheet
}) => {
  const [mcqState, setMcqState] = useState<Record<number, number | null>>({});
  const [timeSpentPerQuestion, setTimeSpentPerQuestion] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false); // Used to trigger Analysis Mode
  const [localMcqData, setLocalMcqData] = useState<MCQItem[]>([]);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [analysisUnlocked, setAnalysisUnlocked] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [language, setLanguage] = useState<'English' | 'Hindi'>('English');
  const [universalNotes, setUniversalNotes] = useState<any[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [viewingNote, setViewingNote] = useState<any>(null); // New state for HTML Note Modal

  const [showQuestionDrawer, setShowQuestionDrawer] = useState(false);
  const [showTopicSidebar, setShowTopicSidebar] = useState(false);
  const [batchIndex, setBatchIndex] = useState(0);
  const [comparisonMsg, setComparisonMsg] = useState('');
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'CHAPTER_ANALYSIS' | 'OVERVIEW' | 'QUESTIONS' | 'MISTAKES'>('CHAPTER_ANALYSIS');
  // Auto-enable TTS for Premium Instant Explanation Mode
  const [autoReadEnabled, setAutoReadEnabled] = useState(settings?.isAutoTtsEnabled || instantExplanation || false);
  const BATCH_SIZE = 1;

  const submitRef = useRef<() => void>();

  useEffect(() => {
      if (settings?.isAutoTtsEnabled !== undefined) {
          setAutoReadEnabled(settings.isAutoTtsEnabled);
      } else if (instantExplanation) {
          setAutoReadEnabled(true);
      }
  }, [settings?.isAutoTtsEnabled, instantExplanation]);

  // LANGUAGE AUTO-SELECT
  useEffect(() => {
    if (user?.board === 'BSEB') {
        setLanguage('Hindi');
    } else if (user?.board === 'CBSE') {
        setLanguage('English');
    }
  }, [user?.board]);

  // LOAD UNIVERSAL NOTES FOR ANALYSIS
  useEffect(() => {
      if (content?.type === 'MCQ_ANALYSIS' && universalNotes.length === 0) {
          setRecLoading(true);
          getChapterData('nst_universal_notes').then(data => {
              if (data && data.notesPlaylist) {
                  setUniversalNotes(data.notesPlaylist);
              }
              setRecLoading(false);
          });
      }
  }, [content?.type]);

  // Full Screen Ref
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleFullScreen = () => {
      if (!document.fullscreenElement) {
          containerRef.current?.requestFullscreen().catch(e => console.error(e));
      } else {
          document.exitFullscreen();
      }
  };

  // TIMER STATE
  const [sessionTime, setSessionTime] = useState(0); // Total seconds
  
      // TIMER EFFECT (UPDATED: Track Per Question)
  useEffect(() => {
      let interval: any;
          if (!showResults && !showSubmitModal && !showResumePrompt && content?.mcqData) {
          interval = setInterval(() => {
              setSessionTime(prev => prev + 1);

                  // Track time for current question (only if viewing 1 question at a time or first in batch)
                  // Assuming batchIndex corresponds to question index if BATCH_SIZE is 1
                  if (true) { // BATCH_SIZE is confirmed 1 in render logic
                      setTimeSpentPerQuestion(prev => ({
                          ...prev,
                          [batchIndex]: (prev[batchIndex] || 0) + 1
                      }));
                  }
          }, 1000);
      }
      return () => clearInterval(interval);
      }, [showResults, showSubmitModal, showResumePrompt, batchIndex, content]);

  // ANTI-CHEAT (Exam Mode)
  useEffect(() => {
      if (content?.subtitle?.includes('Premium Test') && !showResults && !showSubmitModal) {
          const handleVisibilityChange = () => {
              if (document.hidden) {
                  setAlertConfig({isOpen: true, message: "⚠️ Exam Mode Violation! Test Submitted Automatically."});
                  // Defer the submit call to avoid circular dependency before definition
                  // Since handleConfirmSubmit is defined below, we might need a ref or define it earlier.
                  // However, useEffect runs after render, so `handleConfirmSubmit` const should be available if defined in scope.
                  // The issue is likely `handleConfirmSubmit` is used before definition in this closure?
                  // No, hoisting applies to function declarations, not const arrow functions.
                  if (submitRef.current) {
                      submitRef.current();
                  }
              }
          };
          document.addEventListener("visibilitychange", handleVisibilityChange);
          return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
  }, [content, showResults, showSubmitModal, mcqState]);

  // Custom Dialog State
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, message: string, type?: 'ERROR' | 'SUCCESS' | 'INFO'}>({isOpen: false, message: ''});
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({isOpen: false, title: '', message: '', onConfirm: () => {}});

  // TTS STATE
  const contentRef = useRef<HTMLDivElement>(null);
  const plainTextContent = content ? decodeHtml(content.aiHtmlContent || content.content || "") : "";

  if (loading) {
      return (
          <div className="h-[70vh] flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
              <h3 className="text-xl font-bold text-slate-800 animate-pulse">Loading Content...</h3>
              <p className="text-slate-500 text-sm">Please wait while we fetch the data.</p>
          </div>
      );
  }

  if (!content) return null;

  // 1. AI IMAGE/HTML NOTES
  const activeContentValue = (language === 'Hindi' && content.schoolPremiumNotesHtml_HI) 
      ? content.schoolPremiumNotesHtml_HI 
      : (content.content || content.pdfUrl || content.videoUrl || '');

  const contentValue = activeContentValue;
  const isImage = contentValue && (contentValue.startsWith('data:image') || contentValue.match(/\.(jpeg|jpg|gif|png|webp|bmp)$/i));
  const isHtml = content.aiHtmlContent || (contentValue && !contentValue.startsWith('http') && contentValue.includes('<'));

  // SCHOOL MODE FREE NOTES FIX
  const isFree = content.type === 'PDF_FREE' || content.type === 'NOTES_HTML_FREE' || (content.type === 'VIDEO_LECTURE' && content.videoPlaylist?.some(v => v.access === 'FREE'));
  
  // FREE HTML NOTE MODAL
  if (viewingNote) {
      return (
          <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-in fade-in">
              {/* Header */}
              <header className="bg-white border-b border-slate-200 p-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                      {settings?.appLogo && <img src={settings.appLogo} className="w-8 h-8 object-contain" />}
                      <div>
                          <h2 className="font-black text-slate-800 uppercase text-sm">{settings?.appName || 'Free Notes'}</h2>
                          <p className="text-[10px] text-orange-600 font-bold uppercase tracking-widest">Recommended Reading</p>
                      </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <SpeakButton text={viewingNote.content} className="p-2 bg-orange-50 text-orange-600 hover:bg-orange-100" />
                    <button onClick={() => setViewingNote(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X size={20}/></button>
                  </div>
              </header>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50">
                  <div className="max-w-3xl mx-auto bg-white p-6 rounded-3xl shadow-sm border border-slate-100 min-h-[50vh]">
                      <h1 className="text-2xl font-black text-slate-900 mb-6 border-b pb-4">{viewingNote.title}</h1>
                      <div
                          className="prose prose-slate max-w-none prose-p:text-slate-700 prose-headings:font-black"
                          dangerouslySetInnerHTML={{ __html: decodeHtml(viewingNote.content) }}
                      />
                  </div>
              </div>

              {/* Footer */}
              <div className="bg-white border-t border-slate-200 p-4 text-center">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Developed by Nadim Anwar</p>
              </div>
          </div>
      );
  }

  if (content.type === 'NOTES_IMAGE_AI' || isImage || isHtml) {
      const preventMenu = (e: React.MouseEvent | React.TouchEvent) => e.preventDefault();
      
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
                              className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 border border-slate-200 mr-1 flex items-center gap-1 transition-all"
                          >
                              <Globe size={14} /> {language === 'English' ? 'Hindi (हिंदी)' : 'English'}
                          </button>

                          <SpeakButton
                              text={plainTextContent}
                              className="bg-slate-100 text-slate-600 hover:bg-slate-200"
                              settings={settings}
                          />

                          <button onClick={onBack} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X size={20} /></button>
                      </div>
                  </header>
                  <div className="flex-1 overflow-y-auto w-full pt-16 pb-20 px-4 md:px-8 bg-white">
                      <div 
                          ref={contentRef}
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
                      <img src={content.content} alt="Notes" className="w-full h-auto object-contain" draggable={false} />
                  </div>
              </div>
          );
      }
  }

  // 2. URL LINK / PDF NOTES (Strict HTTP check)
  const isUrl = contentValue && (contentValue.startsWith('http://') || contentValue.startsWith('https://'));
  if (['PDF_FREE', 'PDF_PREMIUM', 'PDF_ULTRA', 'PDF_VIEWER'].includes(content.type) || isUrl) {
      const isGoogleDriveAudio = contentValue.includes('drive.google.com') && (content.title.toLowerCase().includes('audio') || content.title.toLowerCase().includes('podcast') || content.type.includes('AUDIO'));

      if (isGoogleDriveAudio) {
          return (
              <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col animate-in fade-in">
                  <header className="bg-slate-900/90 backdrop-blur-md text-white p-4 flex items-center justify-between border-b border-white/10 z-20">
                      <div className="flex items-center gap-3">
                          <button onClick={onBack} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"><ArrowLeft size={20} /></button>
                          <div>
                            <h2 className="font-bold text-white leading-tight">{content.title}</h2>
                            <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest">Premium Audio Experience</p>
                          </div>
                      </div>
                      <button onClick={onBack} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"><X size={20} /></button>
                  </header>
                  <div className="flex-1 flex items-center justify-center p-4 bg-slate-950 relative overflow-hidden">
                      {/* Animated Background Gradients */}
                      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px] animate-pulse"></div>
                      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-600/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }}></div>
                      
                      <div className="w-full max-w-2xl aspect-video relative z-10 rounded-2xl overflow-hidden shadow-2xl border border-white/5">
                          <CustomPlayer videoUrl={contentValue} />
                      </div>
                  </div>
              </div>
          );
      }

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
                  <iframe 
                      src={contentValue} 
                      className="absolute inset-0 w-full h-full border-none"
                      title={content.title}
                      allowFullScreen
                  />
              </div>
          </div>
      );
  }

  // 3. MANUAL TEXT / MARKDOWN NOTES (Fallback)
  if (content.content || isStreaming) {
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
                          className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 border border-slate-200 mr-1 flex items-center gap-1 transition-all"
                      >
                          <Globe size={14} /> {language === 'English' ? 'Hindi (हिंदी)' : 'English'}
                      </button>

                      <SpeakButton
                          text={plainTextContent}
                          className="bg-slate-100 text-slate-600 hover:bg-slate-200"
                          settings={settings}
                      />

                      <button onClick={onBack} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X size={20} /></button>
                  </div>
              </header>
              <div className="flex-1 overflow-y-auto p-6 bg-white">
                  <div ref={contentRef} className="prose prose-slate max-w-none prose-p:leading-relaxed prose-p:text-slate-700 prose-headings:font-black font-sans">
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
  }

  if (content.isComingSoon) {
      return (
          <div className="h-[70vh] flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-2xl m-4 border-2 border-dashed border-slate-200">
              <Clock size={64} className="text-orange-400 mb-4 opacity-80" />
              <h2 className="text-2xl font-black text-slate-800 mb-2">Coming Soon</h2>
              <p className="text-slate-600 max-w-sm mx-auto mb-6">
                  This content is currently being prepared by the Admin.
              </p>
              <button onClick={onBack} className="mt-8 text-slate-400 font-bold hover:text-slate-600">
                  Go Back
              </button>
          </div>
      );
  }

  // --- MCQ RENDERER ---
  if ((content.type === 'MCQ_ANALYSIS' || content.type === 'MCQ_SIMPLE' || content.type === 'MCQ_RESULT') && content.mcqData) {
      // --- INITIALIZATION & RESUME LOGIC ---
      useEffect(() => {
          if (!content.mcqData) return;
          
          const sourceData = (language === 'Hindi' && content.manualMcqData_HI && content.manualMcqData_HI.length > 0)
              ? content.manualMcqData_HI
              : content.mcqData;

          if (content.userAnswers) {
              setMcqState(content.userAnswers);
              setShowResults(true);
              setAnalysisUnlocked(true);
              setLocalMcqData(sourceData);
              return;
          }

          const key = `nst_mcq_progress_${chapter.id}`;
          storage.getItem(key).then(saved => {
              if (saved) {
                  setShowResumePrompt(true);
                  setLocalMcqData(sourceData);
              } else {
                  setLocalMcqData(sourceData);
              }
          });
      }, [content.mcqData, content.manualMcqData_HI, chapter.id, content.userAnswers, language]);

      // --- SAVE PROGRESS LOGIC ---
      useEffect(() => {
          if (!showResults && Object.keys(mcqState).length > 0) {
              const key = `nst_mcq_progress_${chapter.id}`;
              storage.setItem(key, {
                  mcqState,
                  batchIndex,
                  localMcqData
              });
          }
      }, [mcqState, batchIndex, chapter.id, localMcqData, showResults]);

      const handleResume = () => {
          const key = `nst_mcq_progress_${chapter.id}`;
          storage.getItem(key).then(saved => {
              if (saved) {
                  const parsed = saved;
                  setMcqState(parsed.mcqState || {});
                  setBatchIndex(parsed.batchIndex || 0);
                  if (parsed.localMcqData) setLocalMcqData(parsed.localMcqData);
              }
              setShowResumePrompt(false);
          });
      };

      const handleRestart = () => {
          const key = `nst_mcq_progress_${chapter.id}`;
          storage.removeItem(key);
          setMcqState({});
          setBatchIndex(0);
          setLocalMcqData([...(content.mcqData || [])].sort(() => Math.random() - 0.5));
          setShowResumePrompt(false);
          setAnalysisUnlocked(false);
          setShowResults(false);
      };

      const handleRecreate = () => {
          setConfirmConfig({
              isOpen: true,
              title: "Restart Quiz?",
              message: "This will shuffle questions and reset your current progress.",
              onConfirm: () => {
                  const shuffled = [...(content.mcqData || [])].sort(() => Math.random() - 0.5);
                  setLocalMcqData(shuffled);
                  setMcqState({});
                  setBatchIndex(0);
                  setShowResults(false);
                  setAnalysisUnlocked(false);
                  const key = `nst_mcq_progress_${chapter.id}`;
                  storage.removeItem(key);
                  setConfirmConfig(prev => ({...prev, isOpen: false}));
              }
          });
      };

      const displayData = localMcqData.length > 0 ? localMcqData : (content.mcqData || []);
      const currentBatchData = displayData.slice(batchIndex * BATCH_SIZE, (batchIndex + 1) * BATCH_SIZE);
      const hasMore = (batchIndex + 1) * BATCH_SIZE < displayData.length;

      const score = Object.keys(mcqState).reduce((acc, key) => {
          const qIdx = parseInt(key);
          return acc + (mcqState[qIdx] === displayData[qIdx].correctAnswer ? 1 : 0);
      }, 0);

      const currentCorrect = score;
      const currentWrong = Object.keys(mcqState).length - currentCorrect;
      const attemptedCount = Object.keys(mcqState).length;
      const minRequired = Math.min(30, displayData.length);
      const canSubmit = attemptedCount >= minRequired;

      const currentBatchAttemptedCount = currentBatchData.reduce((acc, _, localIdx) => {
          const idx = (batchIndex * BATCH_SIZE) + localIdx;
          return acc + (mcqState[idx] !== undefined && mcqState[idx] !== null ? 1 : 0);
      }, 0);
      const canGoNext = currentBatchAttemptedCount >= Math.min(BATCH_SIZE, currentBatchData.length);

      const nextQuestion = () => {
          setBatchIndex(prev => prev + 1);
          const container = document.querySelector('.mcq-container');
          if (container) container.scrollTop = 0;
      };

      const handleOptionSelect = (qIdx: number, oIdx: number) => {
          setMcqState(prev => ({ ...prev, [qIdx]: oIdx }));
          const isCorrect = oIdx === displayData[qIdx].correctAnswer;

          // Auto-Next Logic
          if (!showResults && (batchIndex + 1) * BATCH_SIZE < displayData.length) {
              if (instantExplanation) {
                  // PREMIUM FLOW
                  if (isCorrect) {
                      // Correct: Short delay then next
                      setTimeout(nextQuestion, 1000);
                  } else {
                      // Wrong: Speak feedback then next
                      const correctOpt = displayData[qIdx].options[displayData[qIdx].correctAnswer];
                      const explanation = displayData[qIdx].explanation || "";

                      // Construct Feedback Text
                      // "Wrong Answer. The correct answer is [Option]. [Explanation]"
                      const feedback = `Wrong Answer. The correct answer is ${stripHtml(correctOpt)}. ${stripHtml(explanation)}`;

                      speakText(
                          feedback,
                          null,
                          1.0,
                          language === 'Hindi' ? 'hi-IN' : 'en-US',
                          undefined,
                          () => {
                              // On finish speaking, move next
                              nextQuestion();
                          }
                      );
                  }
              } else {
                  // STANDARD FLOW
                  setTimeout(nextQuestion, 400);
              }
          }
      };

      const handleSubmitRequest = () => {
          setShowSubmitModal(true);
      };

    // COMPARISON LOGIC
    useEffect(() => {
        if (showResults && user?.mcqHistory) {
            // Find previous attempts for THIS chapter
            const attempts = user.mcqHistory
                .filter(h => h.chapterId === chapter.id)
                .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            // Current result is effectively the "latest" one we just submitted or viewing?
            // If we are viewing results in LessonView, we might not have saved it to history YET if McqView handles it.
            // But LessonView is also used for "Review".
            // Let's compare with the *latest* in history (which is the previous one if we consider the current session as new).
            // Actually, if showResults is true, the user has just finished.
            // The history might update via parent.

            if (attempts.length > 0) {
                const last = attempts[0]; // Most recent in history
                // If the current session score is available
                const currentScore = Object.keys(mcqState).reduce((acc, key) => {
                    const qIdx = parseInt(key);
                    return acc + (mcqState[qIdx] === displayData[qIdx].correctAnswer ? 1 : 0);
                }, 0);

                const currPct = Math.round((currentScore / displayData.length) * 100);
                const prevPct = Math.round((last.score / last.totalQuestions) * 100);

                const getStatus = (p: number) => p >= 80 ? 'STRONG' : p >= 50 ? 'AVERAGE' : 'WEAK';
                const prevStatus = getStatus(prevPct);
                const currStatus = getStatus(currPct);

                let msg = '';
                if (currPct >= prevPct) {
                    const improvement = currPct - prevPct;
                    msg = `Welcome ${user.name}, aapne achhi mehnat ki! Pichhli test me ${prevPct}% aapka marks tha, ish baar aapne ${currPct}% kiya. ${improvement > 0 ? `Improvement: ${improvement}%!` : 'Consistent performance!'}`;
                } else if (prevStatus === 'STRONG' && (currStatus === 'AVERAGE' || currStatus === 'WEAK')) {
                    msg = `Pichhli baar aapka ${prevPct}% aaya tha, ish baar ${currPct}%. Thoda aur mehnat kijiye aur revision kijiye. Next attempt me achha result aayega. Do hard work ${user.name}!`;
                }
                setComparisonMsg(msg);
            }
        }
    }, [showResults, user]);

    const handleConfirmSubmit = () => {
        setShowSubmitModal(false);
        const key = `nst_mcq_progress_${chapter.id}`;
        storage.removeItem(key);
        
        // Don't show results or unlock analysis immediately
        // This allows the MarksheetCard in McqView to handle the flow
        setShowResults(false);
        setAnalysisUnlocked(false);
        
        // CHECK WARNING (Rushed Questions)
        const rushedCount = Object.keys(timeSpentPerQuestion).filter(k => timeSpentPerQuestion[parseInt(k)] < 5).length;
        if (rushedCount > 5) {
            setAlertConfig({
                isOpen: true,
                type: 'ERROR',
                message: "Warning: It seems you finished too fast. Try to read questions carefully next time!"
            });
        }

        if (onMCQComplete) {
            onMCQComplete(score, mcqState as Record<number, number>, displayData, sessionTime, timeSpentPerQuestion);
        }

        // EXTRA SYNC FOR HISTORY (Ensuring it saves even if parent is busy)
        const historyItem = {
            id: `mcq_${chapter.id}_${Date.now()}`,
            type: 'MCQ_RESULT',
            title: `${chapter.title} - Test`,
            date: new Date().toISOString(),
            score,
            totalQuestions: displayData.length,
            timeTaken: sessionTime,
            chapterId: chapter.id,
            subjectId: subject.id,
            classLevel,
            userAnswers: mcqState
        };

        if (user?.id) {
            saveUserHistory(user.id, historyItem);
            saveTestResult(user.id, historyItem);
        }
    };

    // Keep submitRef updated for Anti-Cheat
    useEffect(() => {
        submitRef.current = handleConfirmSubmit;
    }, [handleConfirmSubmit]);

    const [downloadModalOpen, setDownloadModalOpen] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownloadRequest = () => {
        if (!user) return;
        setDownloadModalOpen(true);
    };

    const handleConfirmDownload = async (type: 'PDF' | 'MHTML') => {
        if (!user || !onUpdateUser) return;

        let cost = 10;
        if (settings?.isCreditFreeEvent || settings?.isGlobalFreeMode) {
            cost = 0;
        }

        if (user.credits < cost) {
            setAlertConfig({isOpen: true, message: `Insufficient Credits! Download costs ${cost} coins.`});
            return;
        }

        // Deduct
        if (cost > 0) {
            const updatedUser = { ...user, credits: user.credits - cost };
            onUpdateUser(updatedUser);
            saveUserLocal(updatedUser);
            saveUserToLive(updatedUser);
        }

        setIsDownloading(true);
        setDownloadModalOpen(false);

        // Allow UI to update (show hidden container if needed, though it's always there but maybe hidden via CSS)
        // We use a timeout to let the UI thread breathe
        setTimeout(async () => {
            if (type === 'MHTML') {
                downloadAsMHTML('printable-analysis-report', `${chapter.title}_Analysis`);
            } else {
                const element = document.getElementById('printable-analysis-report');
                if (element) {
                    try {
                        const canvas = await html2canvas(element, { scale: 1.5, backgroundColor: '#ffffff', useCORS: true });
                        const imgData = canvas.toDataURL('image/png');

                        const pdf = new jsPDF('p', 'mm', 'a4');
                        const pdfWidth = pdf.internal.pageSize.getWidth();
                        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                        let heightLeft = pdfHeight;
                        let position = 0;
                        const pageHeight = pdf.internal.pageSize.getHeight();

                        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
                        heightLeft -= pageHeight;

                        while (heightLeft >= 0) {
                            position = heightLeft - pdfHeight;
                            pdf.addPage();
                            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
                            heightLeft -= pageHeight;
                        }

                        pdf.save(`${chapter.title}_Analysis.pdf`);
                    } catch (e) {
                        console.error("PDF Gen Error", e);
                        setAlertConfig({isOpen: true, message: "PDF Generation Failed."});
                    }
                }
            }
            setIsDownloading(false);
            setAlertConfig({isOpen: true, message: `Download Complete! (${cost} Coins Deducted)`});
        }, 500);
    };

    const renderAnalysisDashboard = () => {
        const isPremium = content?.analysisType === 'PREMIUM';

        // Allow download even if not premium analysis? User asked for download button "analysis, revision hub dono ke pass".
        // We render it here.

        return (
            <div className="space-y-6 mb-8 animate-in slide-in-from-top-4">
                {comparisonMsg && (
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl mb-4 animate-in slide-in-from-top-2">
                        <p className="text-sm text-blue-800 font-bold leading-relaxed">
                            {comparisonMsg}
                        </p>
                    </div>
                )}

                {/* TABS HEADER */}
                <div className="flex p-1 bg-slate-100 rounded-xl mb-4">
                    <button onClick={() => setActiveAnalysisTab('OVERVIEW')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeAnalysisTab === 'OVERVIEW' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Overview</button>
                    <button onClick={() => setActiveAnalysisTab('QUESTIONS')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeAnalysisTab === 'QUESTIONS' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>All Questions</button>
                    <button onClick={() => setActiveAnalysisTab('MISTAKES')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeAnalysisTab === 'MISTAKES' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Mistakes</button>
                </div>

                <div className="flex justify-end mb-4">
                    <button
                        onClick={handleDownloadRequest}
                        className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:bg-green-700 flex items-center gap-2"
                    >
                        <Download size={16} /> Download Report (10 CR)
                    </button>
                </div>

                {/* AI REPORT (PREMIUM ONLY) */}
                {isPremium && content?.aiAnalysisText && (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-purple-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-100 rounded-full blur-3xl opacity-50 -mr-10 -mt-10"></div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-200">
                                <BrainCircuit size={20} />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 text-lg">AI Performance Report</h3>
                                <p className="text-xs text-purple-600 font-bold">Deep Insights & Strategy</p>
                            </div>
                        </div>
                        <SpeakButton text={content.aiAnalysisText} className="p-2 bg-purple-50 text-purple-600 hover:bg-purple-100" />
                    </div>
                    <div className="prose prose-sm prose-slate max-w-none prose-p:text-slate-600 prose-headings:font-black prose-headings:text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <ReactMarkdown>{content.aiAnalysisText}</ReactMarkdown>
                    </div>
                </div>
                )}
            </div>
        );
    };

    const renderRecommendedNotes = () => {
        const isPremium = content?.analysisType === 'PREMIUM';

        // Filter Notes by Chapter AND Topic (if available)
        const notes = universalNotes.filter(n => {
            const isChapterMatch = n.chapterId === chapter.id;
            // Also show if subtopic name matches
            return isChapterMatch;
        });

        // Group Notes by Topic
        const groupedNotes: Record<string, any[]> = {};
        notes.forEach(n => {
            const t = n.topic || 'General';
            if (!groupedNotes[t]) groupedNotes[t] = [];
            groupedNotes[t].push(n);
        });

        return (
            <div className={`p-6 rounded-3xl shadow-sm border relative overflow-hidden mt-8 animate-in slide-in-from-bottom-4 ${isPremium ? 'bg-white border-red-100' : 'bg-white border-orange-100'}`}>
                <div className="flex items-center gap-3 mb-4 relative z-10">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${isPremium ? 'bg-red-600 text-white shadow-red-200' : 'bg-orange-500 text-white shadow-orange-200'}`}>
                        {isPremium ? <FileText size={20} /> : <Lightbulb size={20} />}
                    </div>
                    <div>
                        <h3 className="font-black text-slate-800 text-lg">{isPremium ? 'Premium Study Notes' : 'Recommended Reading'}</h3>
                        <p className={`text-xs font-bold ${isPremium ? 'text-red-600' : 'text-orange-600'}`}>
                            {isPremium ? 'High-Yield PDFs for Weak Topics' : 'Topic-wise Revision Notes'}
                        </p>
                    </div>
                </div>

                {recLoading ? (
                    <div className="text-center py-8 text-slate-400 font-bold animate-pulse">Finding best notes...</div>
                ) : notes.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <p className="text-slate-400 font-bold text-sm">No specific notes found for this chapter.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {Object.keys(groupedNotes).map((topic, i) => (
                            <div key={i} className="space-y-2">
                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">{topic}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {groupedNotes[topic].map((note, idx) => (
                                        <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors group flex justify-between items-center">
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-sm mb-1 group-hover:text-blue-700">{note.title}</h4>
                                            </div>
                                            {isPremium ? (
                                                <a href={note.url} target="_blank" rel="noopener noreferrer" className="py-1 px-3 bg-red-600 text-white rounded-lg text-[10px] font-bold hover:bg-red-700 shadow transition-all">
                                                    PDF
                                                </a>
                                            ) : (
                                                <button onClick={() => setViewingNote(note)} className="py-1 px-3 bg-orange-500 text-white rounded-lg text-[10px] font-bold hover:bg-orange-600 shadow transition-all">
                                                    Read
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

      const handleNextPage = () => {
          setBatchIndex(prev => prev + 1);
          const container = document.querySelector('.mcq-container');
          if(container) container.scrollTop = 0;
      };

      const handlePrevPage = () => {
          if (batchIndex > 0) {
              setBatchIndex(prev => prev - 1);
              const container = document.querySelector('.mcq-container');
              if(container) container.scrollTop = 0;
          }
      };

      return (
          <div className="flex flex-col h-full bg-slate-50 animate-in fade-in relative mcq-container overflow-y-auto">
               <CustomAlert 
                   isOpen={alertConfig.isOpen} 
                   message={alertConfig.message} 
                   type="ERROR"
                   onClose={() => setAlertConfig({...alertConfig, isOpen: false})} 
               />
               <CustomConfirm
                   isOpen={confirmConfig.isOpen}
                   title={confirmConfig.title}
                   message={confirmConfig.message}
                   onConfirm={confirmConfig.onConfirm}
                   onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})}
               />

               {showResumePrompt && !showResults && (
                   <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                       <div className="bg-white rounded-2xl p-6 w-full max-w-lg text-center shadow-2xl">
                           <h3 className="text-xl font-black text-slate-800 mb-2">Resume Session?</h3>
                           <p className="text-slate-500 text-sm mb-6">You have a saved session for this chapter.</p>
                           <div className="flex gap-3">
                               <button onClick={handleRestart} className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl">Restart</button>
                               <button onClick={handleResume} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg">Resume</button>
                           </div>
                       </div>
                   </div>
               )}

               {showSubmitModal && (
                   <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                       <div className="bg-white rounded-2xl p-6 w-full max-w-lg text-center shadow-2xl animate-in zoom-in duration-200">
                           <Trophy size={48} className="mx-auto text-yellow-400 mb-4" />
                           <h3 className="text-xl font-black text-slate-800 mb-2">Submit Test?</h3>
                           <p className="text-slate-500 text-sm mb-6">
                               You have answered {Object.keys(mcqState).length} out of {displayData.length} questions.
                           </p>
                           <div className="flex gap-3">
                               <button onClick={() => setShowSubmitModal(false)} className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl active:scale-95 transition-all">Cancel</button>
                               <button onClick={handleConfirmSubmit} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 active:scale-95 transition-all">Yes, Submit</button>
                           </div>
                       </div>
                   </div>
               )}

               {/* Topic Sidebar Overlay */}
               {showTopicSidebar && (
                   <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex justify-end" onClick={() => setShowTopicSidebar(false)}>
                        <div className="w-80 bg-white h-full shadow-2xl animate-in slide-in-from-right duration-200 flex flex-col" onClick={e => e.stopPropagation()}>
                            <div className="p-4 border-b flex items-center justify-between bg-slate-50">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2"><List size={18}/> Topic Breakdown</h3>
                                <button onClick={() => setShowTopicSidebar(false)} className="p-2 hover:bg-slate-200 rounded-full"><X size={18}/></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4">
                                {(() => {
                                    // Calculate Topic Counts
                                    const topicCounts: Record<string, {total: number, answered: number}> = {};
                                    displayData.forEach((q, idx) => {
                                        const t = q.topic || 'General';
                                        if (!topicCounts[t]) topicCounts[t] = {total: 0, answered: 0};
                                        topicCounts[t].total++;
                                        if (mcqState[idx] !== undefined) topicCounts[t].answered++;
                                    });

                                    // Identify Current Topic
                                    const currentQ = displayData[batchIndex];
                                    const currentTopic = currentQ?.topic || 'General';

                                    return (
                                        <div className="space-y-3">
                                            {Object.keys(topicCounts).map((t, i) => {
                                                const stats = topicCounts[t];
                                                const isCurrent = t === currentTopic;
                                                return (
                                                    <div key={i} className={`p-3 rounded-xl border ${isCurrent ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100'}`}>
                                                        <div className="flex justify-between items-center mb-1">
                                                            <p className={`text-xs font-bold ${isCurrent ? 'text-blue-700' : 'text-slate-700'}`}>{t}</p>
                                                            {isCurrent && <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold">Active</span>}
                                                        </div>
                                                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                            <div className="h-full bg-green-500 transition-all" style={{width: `${(stats.answered/stats.total)*100}%`}}></div>
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 mt-1 text-right">{stats.answered} / {stats.total}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                   </div>
               )}

               {/* Question Drawer Overlay */}
               {showQuestionDrawer && (
                   <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex justify-end" onClick={() => setShowQuestionDrawer(false)}>
                        <div className="w-80 bg-white h-full shadow-2xl animate-in slide-in-from-right duration-200 flex flex-col" onClick={e => e.stopPropagation()}>
                            <div className="p-4 border-b flex items-center justify-between bg-slate-50">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2"><Grip size={18}/> Question Palette</h3>
                                <button onClick={() => setShowQuestionDrawer(false)} className="p-2 hover:bg-slate-200 rounded-full"><X size={18}/></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4">
                                <div className="grid grid-cols-5 gap-3">
                                    {displayData.map((_, idx) => {
                                        const isAnswered = mcqState[idx] !== undefined && mcqState[idx] !== null;
                                        const isCurrent = idx === batchIndex;
                                        // "Skipped" logic: Not answered and we have moved past it OR viewed it (simplification: if idx < batchIndex and not answered)
                                        // For now, simpler color coding: Green (Answered), Blue (Current), Gray (Unattempted)

                                        let btnClass = "aspect-square rounded-lg text-xs font-bold flex items-center justify-center transition-all border ";
                                        if (isCurrent) {
                                            btnClass += "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200 scale-110 ring-2 ring-blue-100";
                                        } else if (isAnswered) {
                                            btnClass += "bg-green-100 text-green-700 border-green-200 hover:bg-green-200";
                                        } else {
                                            btnClass += "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100";
                                        }

                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    setBatchIndex(idx);
                                                    setShowQuestionDrawer(false);
                                                }}
                                                className={btnClass}
                                            >
                                                {idx + 1}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="p-4 border-t bg-slate-50 text-xs text-slate-500 space-y-2">
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-100 border border-green-200"></div> Answered</div>
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-blue-600"></div> Current</div>
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-slate-50 border border-slate-200"></div> Not Attempted</div>
                            </div>
                        </div>
                   </div>
               )}

               <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                   <div className="flex gap-2">
                       <button onClick={onBack} className="flex items-center gap-2 text-slate-600 font-bold text-sm bg-slate-100 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors">
                           <ArrowLeft size={16} /> Exit
                       </button>
                       {(content.manualMcqData_HI && content.manualMcqData_HI.length > 0) && (
                           <button 
                               onClick={() => setLanguage(l => l === 'English' ? 'Hindi' : 'English')}
                               className="flex items-center gap-2 text-slate-600 font-bold text-xs bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors"
                           >
                               <Globe size={14} /> {language === 'English' ? 'English' : 'हिंदी'}
                           </button>
                       )}

                   </div>
                   <div className="flex items-center gap-3">
                       <button onClick={() => setShowTopicSidebar(true)} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200" title="View Topic Progress">
                           <List size={20} />
                       </button>

                       {/* Auto Read Toggle (Global) */}
                       <button
                           onClick={() => {
                               const newState = !autoReadEnabled;
                               setAutoReadEnabled(newState);
                               if (onToggleAutoTts) onToggleAutoTts(newState);
                               if (!newState) window.speechSynthesis.cancel();
                           }}
                           className={`p-2 rounded-lg transition-all ${autoReadEnabled ? 'bg-indigo-100 text-indigo-600 ring-2 ring-indigo-200' : 'bg-slate-100 text-slate-400'}`}
                           title="Toggle Auto-Read"
                       >
                           {autoReadEnabled ? <Volume2 size={18} /> : <Volume2 size={18} className="opacity-50" />}
                       </button>

                       {/* Timer Display - Prominent */}
                       <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                           <div className="flex flex-col items-end">
                               <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">Total</span>
                               <span className="text-xs font-mono font-bold text-slate-700 leading-none">
                                   {Math.floor(sessionTime / 60)}:{String(sessionTime % 60).padStart(2, '0')}
                               </span>
                           </div>
                           <div className="h-6 w-px bg-slate-200"></div>
                           <div className="flex flex-col items-end">
                               <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">Q-Time</span>
                               <span className={`text-xs font-mono font-bold leading-none ${(timeSpentPerQuestion[batchIndex] || 0) > 60 ? 'text-red-500' : 'text-slate-700'}`}>
                                   {Math.floor((timeSpentPerQuestion[batchIndex] || 0) / 60)}:{String((timeSpentPerQuestion[batchIndex] || 0) % 60).padStart(2, '0')}
                               </span>
                           </div>
                       </div>

                       <button
                           onClick={() => setShowQuestionDrawer(true)}
                           className="flex items-center gap-2 text-slate-600 font-bold text-xs bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors"
                       >
                           <Grip size={16} /> <span className="hidden sm:inline">All Questions</span>
                           <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px] ml-1">
                               {attemptedCount}/{displayData.length}
                           </span>
                       </button>
                   </div>
               </div>
               
               <div className="flex-1 overflow-y-auto p-4 space-y-6 max-w-3xl mx-auto w-full pb-32 mcq-container">
                   {/* 1. TOPIC HEADER (ANALYSIS ONLY) */}
                   {showResults && content.type === 'MCQ_ANALYSIS' && (
                       <div className="mb-4">
                           <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                               <Zap size={24} className="text-orange-500" />
                               {content.topic ? `${content.topic} Analysis` : 'Chapter Analysis'}
                           </h2>
                           <p className="text-sm text-slate-500 font-medium ml-8">Review your performance and study recommended notes.</p>
                       </div>
                   )}

                   {/* 2. AI REPORT (Top) */}
                   {showResults && (content.type === 'MCQ_ANALYSIS' || content.type === 'MCQ_RESULT') && renderAnalysisDashboard()}

                   {/* 3. QUESTIONS LIST (Grouped by Topic if Analysis Mode) */}
                   {(() => {
                       // Premium Analysis Mode with Topic Grouping
                       if (showResults && (content.type === 'MCQ_ANALYSIS' || content.type === 'MCQ_RESULT')) {

                           // CHAPTER ANALYSIS TAB (FULL PAGE VIEW)
                           if (activeAnalysisTab === 'CHAPTER_ANALYSIS') {
                               const attempted = Object.keys(mcqState).length;
                               const correct = displayData.reduce((acc, q, i) => acc + (mcqState[i] === q.correctAnswer ? 1 : 0), 0);
                               const wrong = attempted - correct;
                               const percent = displayData.length > 0 ? Math.round((correct / displayData.length) * 100) : 0;

                               // Topic Stats
                               const topicStats: Record<string, {total: number, correct: number}> = {};
                               displayData.forEach((q, idx) => {
                                   const t = q.topic || 'General';
                                   if (!topicStats[t]) topicStats[t] = {total: 0, correct: 0};
                                   topicStats[t].total++;
                                   if (mcqState[idx] === q.correctAnswer) topicStats[t].correct++;
                               });

                               // Recent Progress (Last 3 Attempts)
                               const pastAttempts = user?.mcqHistory
                                  ?.filter(h => h.chapterId === chapter.id)
                                  .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                  .slice(-3) || [];

                               // Mistake Patterns (Weak Topics < 50%)
                               const weakTopics = Object.keys(topicStats)
                                  .filter(t => (topicStats[t].correct / topicStats[t].total) < 0.5)
                                  .map(t => ({ topic: t, score: topicStats[t].correct, total: topicStats[t].total }));

                               // TEACHER INSIGHT (Human Language - Expanded for All Topics)
                               const getTeacherFeedback = () => {
                                   let msg = "";
                                   let overallComparison = "";

                                   // 1. Overall Trend (Comparing with previous attempt if exists)
                                   if (pastAttempts.length > 0) {
                                       const last = pastAttempts[pastAttempts.length - 1]; // Previous attempt
                                       const prevScore = Math.round((last.score / last.totalQuestions) * 100);
                                       const currScore = percent;
                                       const diff = currScore - prevScore;

                                       if (diff > 10) overallComparison = `### 🌟 Outstanding Progress!\nBohot badhiya improvement hai! Pichhli baar **${prevScore}%** tha, ish baar **${currScore}%** aaya hai.`;
                                       else if (diff > 0) overallComparison = `### 👍 Good Improvement\nSahi ja rahe ho! Score ${prevScore}% se badh kar ${currScore}% ho gaya hai.`;
                                       else if (diff < -10) overallComparison = `### 📉 Needs Attention\nBeta, score kaafi gir gaya (${prevScore}% -> ${currScore}%). Kya samajh nahi aaya?`;
                                       else if (diff < 0) overallComparison = `### ⚠️ Slight Drop\nThoda dhyan do. Pichhli baar ${prevScore}% tha, ish baar ${currScore}% ho gaya. Consistency zaroori hai.`;
                                       else overallComparison = `### ⚖️ Consistent Performance\nConsistency achhi hai (**${currScore}%**), par hume ab next level pe jana hai.`;
                                   } else {
                                       overallComparison = `### 👋 Welcome!\nFirst attempt hai! Chalo dekhte hain kahan improvement ki zarurat hai.`;
                                   }

                                   msg += overallComparison + "\n\n";

                                   // 2. Comprehensive Topic Analysis
                                   const allTopics = Object.keys(topicStats);
                                   if (allTopics.length > 0) {
                                       msg += `#### 🧠 Topic-wise Feedback:\n`;

                                       allTopics.forEach(topic => {
                                           const stats = topicStats[topic];
                                           const accuracy = (stats.correct / stats.total) * 100;

                                           if (accuracy >= 80) {
                                               msg += `- ✅ **${topic}**: Shabash! Yahan pakad mazboot hai (${Math.round(accuracy)}%).\n`;
                                           } else if (accuracy >= 50) {
                                               msg += `- ⚖️ **${topic}**: Thik hai (${Math.round(accuracy)}%), par thoda aur revision chahiye.\n`;
                                           } else {
                                               msg += `- ❌ **${topic}**: Yahan dikkat hai (${Math.round(accuracy)}%). Is topic ko dubara padhna padega.\n`;
                                           }
                                       });
                                   }

                                   return msg;
                               };

                               const teacherMsg = getTeacherFeedback();

                               return (
                                   <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">

                                       {/* TEACHER INSIGHT CARD */}
                                       {teacherMsg && (
                                           <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 p-5 rounded-2xl flex gap-4 items-start relative overflow-hidden shadow-sm">
                                               {/* Decorative Elements */}
                                               <div className="absolute -right-4 -top-4 w-20 h-20 bg-indigo-100 rounded-full blur-2xl opacity-50"></div>

                                               <div className="w-12 h-12 rounded-full bg-white border-2 border-indigo-200 flex items-center justify-center shrink-0 shadow-sm z-10">
                                                   {/* Use an emoji or icon for the teacher avatar */}
                                                   <span className="text-2xl">👨‍🏫</span>
                                               </div>
                                               <div className="z-10 flex-1">
                                                   <h4 className="font-black text-indigo-900 text-sm mb-1 uppercase tracking-wide">Teacher's Remarks</h4>
                                                   <p className="text-indigo-800 text-sm font-medium leading-relaxed">
                                                       <ReactMarkdown>{teacherMsg}</ReactMarkdown>
                                                   </p>
                                               </div>
                                           </div>
                                       )}

                                       {/* HEADER & MARKSHEET BUTTON */}
                                       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                           <div>
                                               <h2 className="text-2xl font-black text-slate-800">Analysis Dashboard</h2>
                                               <p className="text-slate-500 font-medium">Deep dive into your performance.</p>
                                           </div>
                                           {onShowMarksheet && (
                                                <button
                                                    onClick={() => onShowMarksheet(content.analytics)}
                                                    className="bg-slate-800 text-white px-5 py-3 rounded-xl text-sm font-bold shadow-lg hover:bg-slate-900 flex items-center justify-center gap-2 transition-all active:scale-95"
                                                >
                                                    <FileText size={18} /> View Official Marksheet
                                                </button>
                                           )}
                                       </div>

                                       {/* Performance Summary */}
                                       <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                                           <h3 className="font-black text-slate-800 text-lg mb-4">Performance Summary</h3>
                                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                               <div className="p-3 bg-slate-50 rounded-xl border border-slate-100"><div className="text-xs text-slate-500 uppercase font-bold">Score</div><div className="text-2xl font-black text-slate-800">{correct}/{displayData.length}</div></div>
                                               <div className="p-3 bg-slate-50 rounded-xl border border-slate-100"><div className="text-xs text-slate-500 uppercase font-bold">Accuracy</div><div className="text-2xl font-black text-blue-600">{percent}%</div></div>
                                               <div className="p-3 bg-green-50 rounded-xl border border-green-100"><div className="text-xs text-green-600 uppercase font-bold">Correct</div><div className="text-2xl font-black text-green-700">{correct}</div></div>
                                               <div className="p-3 bg-red-50 rounded-xl border border-red-100"><div className="text-xs text-red-600 uppercase font-bold">Wrong</div><div className="text-2xl font-black text-red-700">{wrong}</div></div>
                                           </div>
                                       </div>

                                       {/* RECENT PROGRESS (Last 3 Attempts) */}
                                       {pastAttempts.length > 0 && (
                                           <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                                               <h3 className="font-black text-slate-800 text-lg mb-4 flex items-center gap-2"><BarChart3 size={18}/> Recent Progress</h3>
                                               <div className="flex items-end gap-2 h-32 pb-2">
                                                   {pastAttempts.map((att, idx) => {
                                                       const p = Math.round((att.score / att.totalQuestions) * 100);
                                                       return (
                                                           <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full gap-2 group">
                                                               <span className="text-xs font-bold text-slate-600 group-hover:text-blue-600 transition-colors">{p}%</span>
                                                               <div className="w-full max-w-[40px] bg-slate-100 rounded-t-lg relative overflow-hidden group-hover:bg-blue-50 transition-colors" style={{height: `${p}%`, minHeight: '10%'}}>
                                                                   <div className="absolute bottom-0 left-0 right-0 top-0 bg-blue-500 opacity-20"></div>
                                                                   <div className="absolute bottom-0 left-0 right-0 bg-blue-600 transition-all group-hover:bg-blue-500" style={{height: '4px'}}></div>
                                                               </div>
                                                               <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(att.date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
                                                           </div>
                                                       );
                                                   })}
                                               </div>
                                           </div>
                                       )}

                                       {/* MISTAKE PATTERNS (Weak Areas) */}
                                       {weakTopics.length > 0 && (
                                           <div className="bg-red-50 p-6 rounded-3xl border border-red-100">
                                                <h3 className="font-black text-red-900 text-lg mb-4 flex items-center gap-2"><AlertTriangle size={18}/> Weak Areas (Needs Focus)</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {weakTopics.map((item, idx) => (
                                                        <div key={idx} className="bg-white p-3 rounded-xl border border-red-100 flex items-center justify-between">
                                                            <span className="font-bold text-slate-700 text-sm">{item.topic}</span>
                                                            <span className="text-xs font-black text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                                                                {Math.round((item.score/item.total)*100)}% Accuracy
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                           </div>
                                       )}

                                       {/* AI Analysis (If Available) */}
                                       {content?.aiAnalysisText && (
                                           <div className="bg-white p-6 rounded-3xl shadow-sm border border-purple-100 relative overflow-hidden">
                                               <div className="flex items-center justify-between mb-4 relative z-10">
                                                   <h3 className="font-black text-slate-800 text-lg flex items-center gap-2"><BrainCircuit size={18}/> AI Performance Report</h3>
                                                   <SpeakButton text={content.aiAnalysisText} className="p-2 bg-purple-50 text-purple-600 hover:bg-purple-100" />
                                               </div>
                                               <div className="prose prose-sm prose-slate max-w-none prose-p:text-slate-600 prose-headings:font-black prose-headings:text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                   <ReactMarkdown>{content.aiAnalysisText}</ReactMarkdown>
                                               </div>
                                           </div>
                                       )}

                                       {/* Topic Breakdown */}
                                       <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                                           <h3 className="font-black text-slate-800 text-lg mb-4 flex items-center gap-2"><List size={18}/> Topic Breakdown</h3>
                                           <div className="space-y-4">
                                               {Object.keys(topicStats).map((t, i) => {
                                                   const s = topicStats[t];
                                                   const p = Math.round((s.correct/s.total)*100);
                                                   return (
                                                       <div key={i}>
                                                           <div className="flex justify-between mb-1 text-xs font-bold">
                                                               <span className="uppercase text-slate-600">{t}</span>
                                                               <span>{s.correct}/{s.total} ({p}%)</span>
                                                           </div>
                                                           <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                               <div className={`h-full ${p>=80?'bg-green-500':'bg-red-500'}`} style={{width: `${p}%`}}></div>
                                                           </div>
                                                       </div>
                                                   );
                                               })}
                                           </div>
                                       </div>

                                       {/* Detailed Solutions Hidden by default, redirecting to marksheet instead */}
                                       <div className="mt-8">
                                           <button
                                               onClick={() => {
                                                   if (onShowMarksheet) {
                                                       // Construct temporary result object to pass to marksheet
                                                       const result = {
                                                           id: 'temp',
                                                           userId: user?.id,
                                                           chapterId: chapter.id,
                                                           chapterTitle: chapter.title,
                                                           subjectId: subject.id,
                                                           subjectName: subject.name,
                                                           score: Object.keys(mcqState).reduce((acc, k) => acc + (mcqState[parseInt(k)] === displayData[parseInt(k)].correctAnswer ? 1 : 0), 0),
                                                           totalQuestions: displayData.length,
                                                           totalTimeSeconds: 0,
                                                           omrData: displayData.map((q, i) => ({
                                                               qIndex: i,
                                                               selected: mcqState[i] !== undefined && mcqState[i] !== null ? mcqState[i]! : -1,
                                                               correct: q.correctAnswer
                                                           })),
                                                           date: new Date().toISOString()
                                                       };
                                                       onShowMarksheet(result);
                                                   } else {
                                                       setAlertConfig({isOpen: true, title: "Unavailable", message: "Explanation page is not available here."});
                                                   }
                                               }}
                                               className="w-full bg-blue-100 text-blue-700 font-bold py-4 rounded-2xl flex justify-center items-center gap-2 hover:bg-blue-200 transition-colors"
                                           >
                                               <BookOpen size={20} /> View Full Explanations Page
                                           </button>
                                       </div>
                                   </div>
                               );
                           }

                           // TAB LOGIC
                           if (activeAnalysisTab === 'OVERVIEW') {
                               return (
                                   <div className="grid grid-cols-2 gap-4">
                                       <div className="bg-white p-4 rounded-2xl border shadow-sm">
                                           <div className="text-sm text-slate-500 font-bold uppercase mb-1">Total Questions</div>
                                           <div className="text-3xl font-black text-slate-800">{displayData.length}</div>
                                       </div>
                                       <div className="bg-white p-4 rounded-2xl border shadow-sm">
                                           <div className="text-sm text-slate-500 font-bold uppercase mb-1">Attempted</div>
                                           <div className="text-3xl font-black text-blue-600">{Object.keys(mcqState).length}</div>
                                       </div>
                                       <div className="bg-white p-4 rounded-2xl border shadow-sm border-green-100 bg-green-50">
                                           <div className="text-sm text-green-600 font-bold uppercase mb-1">Correct</div>
                                           <div className="text-3xl font-black text-green-700">
                                               {displayData.reduce((acc, q, i) => acc + (mcqState[i] === q.correctAnswer ? 1 : 0), 0)}
                                           </div>
                                       </div>
                                       <div className="bg-white p-4 rounded-2xl border shadow-sm border-red-100 bg-red-50">
                                           <div className="text-sm text-red-600 font-bold uppercase mb-1">Wrong</div>
                                           <div className="text-3xl font-black text-red-700">
                                               {displayData.reduce((acc, q, i) => acc + (mcqState[i] !== undefined && mcqState[i] !== q.correctAnswer ? 1 : 0), 0)}
                                           </div>
                                       </div>
                                   </div>
                               );
                           }

                           // 1. Group Data
                           const grouped: Record<string, {questions: MCQItem[], indices: number[], correct: number}> = {};
                           displayData.forEach((q, idx) => {
                               // Filter for MISTAKES tab
                               if (activeAnalysisTab === 'MISTAKES') {
                                   if (mcqState[idx] === undefined || mcqState[idx] === q.correctAnswer) return;
                               }

                               const topic = q.topic || 'General';
                               if (!grouped[topic]) grouped[topic] = {questions: [], indices: [], correct: 0};
                               grouped[topic].questions.push(q);
                               grouped[topic].indices.push(idx);
                               if (mcqState[idx] === q.correctAnswer) grouped[topic].correct++;
                           });

                           if (Object.keys(grouped).length === 0) {
                               return (
                                   <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
                                       <p className="text-slate-400 font-bold">No questions found for this filter.</p>
                                   </div>
                               );
                           }

                           return Object.keys(grouped).map((topic, groupIdx) => {
                               const group = grouped[topic];
                               const score = group.correct;
                               const total = group.questions.length;
                               const percentage = Math.round((score / total) * 100);

                               // Find Topic Note (if any)
                               const topicNote = universalNotes.find(n => n.topic === topic && (n.chapterId === chapter.id || n.type === 'HTML')); // Loose match for demo

                               return (
                                   <div key={groupIdx} className="mb-8 border-t-4 border-slate-200 pt-6">
                                       <div className="flex items-center justify-between mb-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                           <div>
                                               <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                                                   <span className="bg-slate-200 text-slate-600 w-6 h-6 rounded flex items-center justify-center text-xs">{groupIdx + 1}</span>
                                                   {topic}
                                               </h3>
                                           </div>
                                           <div className="text-right">
                                               {activeAnalysisTab === 'QUESTIONS' && (
                                                   <>
                                                       <div className="text-2xl font-black text-blue-600">{percentage}%</div>
                                                       <div className="text-xs font-bold text-slate-400">{score}/{total} Correct</div>
                                                   </>
                                               )}
                                               {activeAnalysisTab === 'MISTAKES' && (
                                                   <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded">Needs Improvement</span>
                                               )}
                                           </div>
                                       </div>

                                       <div className="space-y-6">
                                           {group.questions.map((q, localI) => {
                                               const idx = group.indices[localI];
                                               const userAnswer = mcqState[idx];
                                               const isAnswered = userAnswer !== undefined && userAnswer !== null;
                                               const isCorrect = isAnswered && userAnswer === q.correctAnswer;
                                               const isWrong = isAnswered && !isCorrect;
                                               const fullQuestionText = `${q.question}. Options are: ${q.options.map((opt, i) => `Option ${i+1}: ${opt}`).join('. ')}`;

                                               return (
                                                   <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                                       <div className="flex justify-between items-start mb-4 gap-3">
                                                           <div className="font-bold text-slate-800 flex gap-3 leading-relaxed flex-1">
                                                               <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 font-bold mt-0.5 ${isCorrect ? 'bg-green-100 text-green-700' : isWrong ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                                                                   {idx + 1}
                                                               </span>
                                                               <div dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.question) }} className="prose prose-sm max-w-none" />
                                                           </div>
                                                           <SpeakButton text={fullQuestionText} className="shrink-0" settings={settings} />
                                                       </div>
                                                       <div className="space-y-2">
                                                           {q.options.map((opt, oIdx) => {
                                                               let btnClass = "w-full text-left p-3 rounded-xl border transition-all text-sm font-medium relative overflow-hidden ";
                                                               if (oIdx === q.correctAnswer) {
                                                                   btnClass += "bg-green-100 border-green-300 text-green-800";
                                                               } else if (userAnswer === oIdx) {
                                                                   btnClass += "bg-red-100 border-red-300 text-red-800";
                                                               } else {
                                                                   btnClass += "bg-slate-50 border-slate-100 opacity-60";
                                                               }

                                                               return (
                                                                   <div key={oIdx} className={btnClass}>
                                                                       <span className="relative z-10 flex justify-between items-center w-full gap-2">
                                                                           <div dangerouslySetInnerHTML={{ __html: renderMathInHtml(opt) }} className="flex-1" />
                                                                           <div className="flex items-center gap-2 shrink-0">
                                                                               {oIdx === q.correctAnswer && <CheckCircle size={16} className="text-green-600" />}
                                                                               {userAnswer === oIdx && userAnswer !== q.correctAnswer && <XCircle size={16} className="text-red-500" />}
                                                                           </div>
                                                                       </span>
                                                                   </div>
                                                               );
                                                           })}
                                                       </div>
                                                       {q.explanation && (
                                                           <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                                                               <div className="flex items-center justify-between mb-1">
                                                                   <div className="flex items-center gap-2 text-blue-700 font-bold text-xs">
                                                                       <BookOpen size={14} /> Explanation
                                                                   </div>
                                                                   <SpeakButton text={q.explanation} className="p-1 text-blue-400 hover:bg-blue-100" iconSize={14} />
                                                               </div>
                                                               <div className="text-slate-600 text-sm leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.explanation) }} />
                                                           </div>
                                                       )}
                                                   </div>
                                               );
                                           })}
                                       </div>

                                       {/* TOPIC NOTE INJECTION */}
                                       {topicNote && (
                                           <div className="mt-6 bg-amber-50 p-4 rounded-xl border border-amber-200">
                                               <h4 className="font-bold text-amber-900 flex items-center gap-2 mb-2">
                                                   <Lightbulb size={18} /> {topic} Revision Note
                                               </h4>
                                               <div className="prose prose-sm max-w-none text-amber-800" dangerouslySetInnerHTML={{ __html: decodeHtml(topicNote.content || topicNote.html || '') }} />
                                           </div>
                                       )}
                                   </div>
                               );
                           });
                       } else {
                           // Standard Batch Rendering (Test Mode)
                           return currentBatchData.map((q, localIdx) => {
                               const idx = (batchIndex * BATCH_SIZE) + localIdx;
                               const userAnswer = mcqState[idx];
                               const isAnswered = userAnswer !== undefined && userAnswer !== null;
                               const isCorrect = isAnswered && userAnswer === q.correctAnswer;
                               const isWrong = isAnswered && !isCorrect;
                               
                               const showExplanation = (instantExplanation && isAnswered && isWrong);
                               const fullQuestionText = `${q.question}. Options are: ${q.options.map((opt, i) => `Option ${i+1}: ${opt}`).join('. ')}`;

                               return (
                                   <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                                       <div className="flex justify-between items-start mb-4 gap-3">
                                           <div className="font-bold text-slate-800 flex gap-3 leading-relaxed flex-1">
                                               <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 font-bold mt-0.5">{idx + 1}</span>
                                               <div dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.question) }} className="prose prose-sm max-w-none" />
                                           </div>
                                           <SpeakButton
                                               text={fullQuestionText}
                                               className="shrink-0"
                                               settings={settings}
                                               autoPlay={autoReadEnabled && !showResults && !showSubmitModal}
                                               onToggleAutoTts={onToggleAutoTts}
                                           />
                                       </div>
                                       <div className="space-y-2">
                                           {q.options.map((opt, oIdx) => {
                                               let btnClass = "w-full text-left p-3 rounded-xl border transition-all text-sm font-medium relative overflow-hidden ";

                                               const showColors = (instantExplanation && isAnswered);

                                               if (showColors) {
                                                   if (oIdx === q.correctAnswer) {
                                                       btnClass += "bg-green-100 border-green-300 text-green-800";
                                                   } else if (userAnswer === oIdx) {
                                                       btnClass += "bg-red-100 border-red-300 text-red-800";
                                                   } else {
                                                       btnClass += "bg-slate-50 border-slate-100 opacity-60";
                                                   }
                                               }
                                               else if (isAnswered) {
                                                    if (userAnswer === oIdx) {
                                                         btnClass += "bg-blue-100 border-blue-300 text-blue-800";
                                                    } else {
                                                         btnClass += "bg-slate-50 border-slate-100 opacity-60";
                                                    }
                                               } else {
                                                   btnClass += "bg-white border-slate-200 hover:bg-slate-50 hover:border-blue-200";
                                               }

                                               return (
                                                   <button
                                                       key={oIdx}
                                                       disabled={isAnswered || showResults}
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
                                               {q.concept && (
                                                   <div className="p-5 bg-white border border-slate-200 rounded-[20px] shadow-sm">
                                                       <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm mb-2">
                                                           <Lightbulb size={16} /> Concept
                                                       </div>
                                                       <div className="text-slate-700 text-sm leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.concept) }} />
                                                   </div>
                                               )}

                                               {q.explanation && (
                                                   <div className="p-5 bg-white border border-slate-200 rounded-[20px] shadow-sm">
                                                       <div className="flex items-center justify-between mb-2">
                                                           <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
                                                               <BookOpen size={16} /> Explanation
                                                           </div>
                                                           <SpeakButton text={q.explanation} className="p-1 text-blue-400 hover:bg-blue-100" iconSize={16} />
                                                       </div>
                                                       <div className="text-slate-700 text-sm leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.explanation) }} />
                                                   </div>
                                               )}

                                               {q.examTip && (
                                                   <div className="p-5 bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 rounded-[20px] shadow-sm">
                                                       <div className="flex items-center gap-2 text-amber-700 font-bold text-sm mb-2">
                                                           <Target size={16} /> Exam Tip
                                                       </div>
                                                       <div className="text-amber-900 text-sm leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.examTip) }} />
                                                   </div>
                                               )}

                                               {q.commonMistake && (
                                                   <div className="p-5 bg-red-50 border border-red-100 rounded-[20px] shadow-sm">
                                                       <div className="flex items-center gap-2 text-red-700 font-bold text-sm mb-2">
                                                           <AlertTriangle size={16} /> Common Mistake
                                                       </div>
                                                       <div className="text-red-900 text-sm leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.commonMistake) }} />
                                                   </div>
                                               )}

                                               {q.mnemonic && (
                                                   <div className="p-5 bg-purple-50 border border-purple-100 rounded-[20px] shadow-sm">
                                                       <div className="flex items-center gap-2 text-purple-700 font-bold text-sm mb-2">
                                                           <Brain size={16} /> Memory Trick
                                                       </div>
                                                       <div className="text-purple-900 text-sm leading-relaxed whitespace-pre-line" dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.mnemonic) }} />
                                                   </div>
                                               )}
                                           </div>
                                       )}
                                   </div>
                               );
                           });
                       }
                   })()}

                   {/* 4. RECOMMENDED NOTES (Bottom) */}
                   {showResults && (content.type === 'MCQ_ANALYSIS' || content.type === 'MCQ_RESULT') && renderRecommendedNotes()}
               </div>

                {/* HIDDEN PRINT CONTAINER */}
                <div id="printable-analysis-report" style={{ position: 'absolute', left: '-10000px', width: '800px', backgroundColor: 'white', padding: '40px' }}>
                    <div className="text-center mb-8 border-b-2 border-slate-900 pb-6">
                        <h1 className="text-3xl font-black text-slate-900 uppercase">{settings?.appName || 'Analysis Report'}</h1>
                        <p className="text-lg font-bold text-slate-500">{chapter.title}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8 text-center">
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                            <p className="text-xs font-bold text-slate-400 uppercase">Score</p>
                            <p className="text-4xl font-black text-slate-900">{Object.keys(mcqState).reduce((acc, k) => acc + (mcqState[parseInt(k)] === (displayData[parseInt(k)]?.correctAnswer) ? 1 : 0), 0)} / {displayData.length}</p>
                        </div>
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                            <p className="text-xs font-bold text-slate-400 uppercase">Accuracy</p>
                            <p className="text-4xl font-black text-blue-600">
                                {displayData.length > 0 ? Math.round((Object.keys(mcqState).reduce((acc, k) => acc + (mcqState[parseInt(k)] === (displayData[parseInt(k)]?.correctAnswer) ? 1 : 0), 0) / displayData.length) * 100) : 0}%
                            </p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {displayData.map((q, idx) => {
                            const userAnswer = mcqState[idx];
                            const isCorrect = userAnswer === q.correctAnswer;
                            const isAnswered = userAnswer !== undefined && userAnswer !== null;

                            return (
                                <div key={idx} className="border border-slate-200 rounded-xl p-4">
                                    <div className="flex gap-3 mb-2">
                                        <span className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${isCorrect ? 'bg-green-100 text-green-700' : isAnswered ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {idx + 1}
                                        </span>
                                        <div className="font-bold text-slate-800 text-sm" dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.question) }}></div>
                                    </div>
                                    <div className="ml-9 space-y-1 mb-2">
                                        {q.options.map((opt, oIdx) => {
                                            const isSelected = userAnswer === oIdx;
                                            const isAns = q.correctAnswer === oIdx;
                                            let cls = "text-slate-500";
                                            if (isAns) cls = "text-green-700 font-bold";
                                            else if (isSelected) cls = "text-red-700 font-bold line-through";
                                            return (
                                                <div key={oIdx} className={`text-xs ${cls}`}>
                                                    {String.fromCharCode(65 + oIdx)}. <span dangerouslySetInnerHTML={{ __html: renderMathInHtml(opt) }}></span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="ml-9 p-2 bg-slate-50 text-[10px] text-slate-600 italic rounded flex flex-col gap-1">
                                        {q.concept && <div><span className="font-bold">Concept:</span> <span dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.concept) }}></span></div>}
                                        <div><span className="font-bold">Explanation:</span> <span dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.explanation || 'N/A') }}></span></div>
                                        {q.examTip && <div><span className="font-bold text-amber-700">Exam Tip:</span> <span dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.examTip) }}></span></div>}
                                        {q.commonMistake && <div><span className="font-bold text-red-700">Common Mistake:</span> <span dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.commonMistake) }}></span></div>}
                                        {q.mnemonic && <div><span className="font-bold text-purple-700">Memory Trick:</span> <span dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.mnemonic) }}></span></div>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

               <DownloadOptionsModal
                   isOpen={downloadModalOpen}
                   onClose={() => setDownloadModalOpen(false)}
                   title="Download Analysis Report"
                   onDownloadPdf={() => handleConfirmDownload('PDF')}
                   onDownloadMhtml={() => handleConfirmDownload('MHTML')}
               />

               <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 flex gap-3 z-[9999] shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                   {batchIndex > 0 && (
                       <button onClick={handlePrevPage} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl flex items-center justify-center gap-2">
                           <ChevronLeft size={20} /> Back
                       </button>
                   )}

                   {/* Logic for Single Question Navigation */}
                   {!showResults && (
                       <>
                           {hasMore ? (
                                <button
                                   onClick={handleNextPage}
                                   className="flex-[2] py-3 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
                               >
                                   Next <ChevronRight size={20} />
                               </button>
                           ) : (
                               <div className="flex-[2]"></div> // Spacer if no next button on last page
                           )}

                           {/* Submit Button - Always visible if condition met, or on last page */}
                           {(canSubmit || !hasMore) && (
                               <button
                                   onClick={handleSubmitRequest}
                                   disabled={!canSubmit}
                                   className={`flex-[2] py-3 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg ${canSubmit ? 'bg-green-600 text-white shadow-green-100' : 'bg-slate-200 text-slate-400'}`}
                               >
                                   Submit <Trophy size={20} />
                               </button>
                           )}
                       </>
                   )}

                   {showResults && !hasMore && (
                       <button 
                           onClick={onBack}
                           className="flex-[2] py-3 bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg"
                       >
                           Finish Review <ArrowLeft size={20} />
                       </button>
                   )}
               </div>
          </div>
      );
  }

  return (
      <div className="h-[70vh] flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-2xl m-4 border-2 border-dashed border-slate-200">
          <BookOpen size={64} className="text-slate-300 mb-4" />
          <h2 className="text-2xl font-black text-slate-800 mb-2">No Content</h2>
          <p className="text-slate-600 max-w-sm mx-auto mb-6">
              There is no content available for this lesson.
          </p>
          <button onClick={onBack} className="mt-8 text-slate-400 font-bold hover:text-slate-600">
              Go Back
          </button>
      </div>
  );
};
