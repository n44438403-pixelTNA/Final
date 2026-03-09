import { safeSetLocalStorage, saveUserLocal } from '../utils/safeStorage';
import React, { useState, useEffect } from 'react';
// Sync check
import type { MCQResult, User, SystemSettings } from '../types';
import { X, Share2, ChevronLeft, ChevronRight, Download, FileSearch, Grid, CheckCircle, XCircle, Clock, Award, BrainCircuit, Play, StopCircle, BookOpen, Target, Zap, BarChart3, BarChart, ListChecks, FileText, LayoutTemplate, TrendingUp, TrendingDown, Lightbulb, ExternalLink, RefreshCw, Lock, Sparkles, Volume2, ChevronDown, ChevronUp, AlertCircle, ArrowRight, BookOpenCheck, ArrowUp, Minus, AlertTriangle, Brain } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { generateUltraAnalysis } from '../services/groq';
import { saveUniversalAnalysis, saveUserToLive, saveAiInteraction, getChapterData } from '../firebase';
import ReactMarkdown from 'react-markdown';
import { speakText, stopSpeech, getCategorizedVoices, stripHtml } from '../utils/textToSpeech';
import { checkFeatureAccess } from '../utils/permissionUtils';
import { CustomConfirm } from './CustomDialogs'; // Import CustomConfirm
import { SpeakButton } from './SpeakButton';
import { renderMathInHtml } from '../utils/mathUtils';
import { downloadAsMHTML } from '../utils/downloadUtils';

interface Props {
  result: MCQResult;
  user: User;
  settings?: SystemSettings;
  onClose: () => void;
  onViewAnalysis?: (cost: number) => void;
  onPublish?: () => void;
  questions?: any[]; 
  onUpdateUser?: (user: User) => void;
  initialView?: 'ANALYSIS' | 'RECOMMEND';
  onLaunchContent?: (content: any) => void;
  mcqMode?: 'FREE' | 'PREMIUM'; // NEW: Mode Check
}

export const MarksheetCard: React.FC<Props> = ({ result, user, settings, onClose, onViewAnalysis, onPublish, questions, onUpdateUser, initialView, onLaunchContent, mcqMode = 'FREE' }) => {
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'OFFICIAL_MARKSHEET' | 'SOLUTION' | 'OMR' | 'RECOMMEND' | 'MISTAKES' | 'AI_ANALYSIS'>(
      mcqMode === 'PREMIUM' ? 'SOLUTION' : 'OFFICIAL_MARKSHEET'
  );
  
  // FREE MODE ANALYSIS LOCK
  const [isAnalysisUnlocked, setIsAnalysisUnlocked] = useState(mcqMode === 'PREMIUM');

  // ULTRA ANALYSIS STATE
  const [ultraAnalysisResult, setUltraAnalysisResult] = useState('');
  const [isLoadingUltra, setIsLoadingUltra] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [viewingNote, setViewingNote] = useState<any>(null); // New state for HTML Note Modal
  const [comparisonMessage, setComparisonMessage] = useState<string | null>(null);

  // DOWNLOAD MODAL STATE

  // Comparison Logic (User Req)
  useEffect(() => {
      if (user.mcqHistory && result.chapterId) {
          // Sort by date desc
          const attempts = user.mcqHistory
              .filter(h => h.chapterId === result.chapterId)
              .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          // Current result is usually index 0 if updatedUser passed, but let's be safe
          const currentIdx = attempts.findIndex(h => h.id === result.id);

          // Next one is previous chronologically
          const previousAttempt = (currentIdx !== -1 && attempts.length > currentIdx + 1) ? attempts[currentIdx + 1] : null;

          if (previousAttempt) {
              const prevPct = Math.round((previousAttempt.score / previousAttempt.totalQuestions) * 100);
              const currPct = Math.round((result.score / result.totalQuestions) * 100);

              let msg = '';
              // Improvement or Same
              if (currPct >= prevPct) {
                  const improvement = currPct - prevPct;
                  msg = `Welcome ${user.name}, aapne achhi mehnat ki! Pichhli test me ${prevPct}% aapka marks tha, ish baar aapne ${currPct}% kiya. ${improvement > 0 ? `Improvement: ${improvement}%!` : 'Consistent performance!'}`;
              }
              // Decline (Strong -> Weak/Avg)
              else if (currPct < prevPct) {
                  msg = `Pahle se kharab hai... Pichhli baar ${prevPct}% tha, abhi ${currPct}% hai. Aapka score kam ho gaya hai. Aap revision kijiye.`;
              } else if (currPct > prevPct) {
                  msg = `Appka result pahle se achha hai! ${currPct - prevPct}% aapne achha kiya. Keep it up ${user.name}!`;
              } else {
                  msg = `Result same hai (${currPct}%). Thoda aur push karein!`;
              }

              if (msg) setComparisonMessage(msg);
          }
      }
  }, [result.id, user.mcqHistory]);

  const generateLocalAnalysis = () => {
      // Calculate weak/strong based on topicStats

      let analysisSource: any = {};
      if (result.topicAnalysis && Object.keys(result.topicAnalysis).length > 0) {
          Object.keys(result.topicAnalysis).forEach(t => {
              analysisSource[t] = { correct: result.topicAnalysis![t].correct, total: result.topicAnalysis![t].total, percent: result.topicAnalysis![t].percentage };
          });
      } else if (Object.keys(topicStats).length > 0) {
          analysisSource = { ...topicStats };
      }
      const topics = Object.keys(analysisSource).map(t => {
          const s = analysisSource[t];
          let status = 'AVERAGE';
          if (s.percent >= 80) status = 'STRONG';
          else if (s.percent < 50) status = 'WEAK';

          let actionPlan = status === 'WEAK' ? 'Focus on basic concepts and practice more questions from this topic.' : 'Good job! Keep revising to maintain speed.';

          // Historical Topic Comparison
          if (user.mcqHistory && user.mcqHistory.length > 0) {
              const sortedHistory = [...user.mcqHistory]
                  .filter(h => h.id !== result.id) // Exclude current result
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

              let previousTopicPercent: number | null = null;
              for (const pastResult of sortedHistory) {
                  if (pastResult.topicAnalysis && pastResult.topicAnalysis[t]) {
                      previousTopicPercent = pastResult.topicAnalysis[t].percentage;
                      break;
                  }
              }

              if (previousTopicPercent !== null) {
                  const diff = s.percent - previousTopicPercent;
                  if (diff > 0) {
                      actionPlan += ` Pichhli test me aapka score ${previousTopicPercent}% tha, abhi ${s.percent}% aaya hai. Achhi improvement hai, keep it up!`;
                  } else if (diff < 0) {
                      actionPlan += ` Dhyan dein: Pichhli test me aapka score ${previousTopicPercent}% tha, abhi gir kar ${s.percent}% ho gaya hai. Aapko aur revision ki zaroorat hai.`;
                  } else {
                      actionPlan += ` Pichhli test me bhi aapka score ${previousTopicPercent}% tha. Score consistent hai, par aage badhne ki koshish karein.`;
                  }
              }
          }

          return {
              name: t,
              status,
              total: s.total,
              correct: s.correct,
              percent: s.percent,
              actionPlan: actionPlan,
              studyMode: status === 'WEAK' ? 'DEEP_STUDY' : 'QUICK_REVISION'
          };
      });

      return JSON.stringify({
          motivation: percentage > 80 ? "Excellent Performance! You are on track." : "Keep working hard. You can improve!",
          topics: topics,
      });
  };
  
  // TTS State
  const [voices, setVoices] = useState<{hindi: SpeechSynthesisVoice[], indianEnglish: SpeechSynthesisVoice[], others: SpeechSynthesisVoice[]}>({hindi: [], indianEnglish: [], others: []});
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speechRate, setSpeechRate] = useState(1.0);
  
  // TTS Playlist State
  const [playlist, setPlaylist] = useState<string[]>([]);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlayingAll, setIsPlayingAll] = useState(false);

  const stopPlaylist = () => {
      setIsPlayingAll(false);
      setCurrentTrack(0);
      stopSpeech();
  };

  useEffect(() => {
    if (isPlayingAll && currentTrack < playlist.length) {
        speakText(
            playlist[currentTrack],
            selectedVoice,
            speechRate,
            'hi-IN',
            undefined, // onStart
            () => { // onEnd
                if (isPlayingAll) {
                    setCurrentTrack(prev => prev + 1);
                }
            }
        ).catch(() => setIsPlayingAll(false));
    } else if (currentTrack >= playlist.length && isPlayingAll) {
        setIsPlayingAll(false);
        setCurrentTrack(0);
    }
  }, [currentTrack, isPlayingAll, playlist, selectedVoice, speechRate]);

  // Stop Playlist on Tab Change
  useEffect(() => {
      stopPlaylist();
  }, [activeTab]);

  // Dialog State
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({isOpen: false, title: '', message: '', onConfirm: () => {}});

  // RECOMMENDATION STATE
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [topicStats, setTopicStats] = useState<Record<string, {total: number, correct: number, percent: number}>>({});

  useEffect(() => {
      if (questions) {
          const stats: Record<string, {total: number, correct: number, percent: number}> = {};
          questions.forEach((q, idx) => {
              const topic = q.topic || 'General';
              if (!stats[topic]) stats[topic] = { total: 0, correct: 0, percent: 0 };
              stats[topic].total++;

              const omr = result.omrData?.find(d => d.qIndex === idx);
              if (omr && omr.selected === q.correctAnswer) {
                  stats[topic].correct++;
              }
          });

          Object.keys(stats).forEach(t => {
              stats[t].percent = Math.round((stats[t].correct / stats[t].total) * 100);
          });
          setTopicStats(stats);
      }
  }, [questions]);

  // Handle Initial View Logic
  useEffect(() => {
      if (initialView === 'RECOMMEND' && questions && questions.length > 0 && isAnalysisUnlocked) {
          // Allow state to settle, then open
          setTimeout(() => {
              handleRecommend();
          }, 500);
      }
  }, [initialView, questions, isAnalysisUnlocked]);

  // Auto-Load Recommendations on Tab Change
  useEffect(() => {
      // Only fetch if data is missing. Do NOT open modal automatically.
      if ((activeTab === 'RECOMMEND' || activeTab === 'PREMIUM_ANALYSIS' || activeTab === 'SOLUTION') && questions && questions.length > 0 && recommendations.length === 0 && isAnalysisUnlocked) {
          handleRecommend(false); // Pass false to suppress modal
      }
  }, [activeTab, questions, isAnalysisUnlocked]);

  const handleRecommend = async (openModal: boolean = false) => {
      if (!isAnalysisUnlocked) return;
      setRecLoading(true);

      const allTopics = Object.keys(topicStats);
      const streamKey = (result.classLevel === '11' || result.classLevel === '12') && user.stream ? `-${user.stream}` : '';
      const key = `nst_content_${user.board || 'CBSE'}_${result.classLevel || '10'}${streamKey}_${result.subjectName}_${result.chapterId}`;

      let chapterData: any = {};
      try { chapterData = await getChapterData(key); } catch (e) { console.error(e); }

      let universalData: any = {};
      try { universalData = await getChapterData('nst_universal_notes'); } catch (e) { console.error(e); }

      const recs: any[] = [];
      const freeHtml = chapterData?.freeNotesHtml || chapterData?.schoolFreeNotesHtml;
      const extractedTopics: string[] = [];
      if (freeHtml) {
           try {
               const doc = new DOMParser().parseFromString(freeHtml, 'text/html');
               const headers = doc.querySelectorAll('h1, h2, h3, h4');
               headers.forEach(h => {
                   if(h.textContent && h.textContent.length > 3) extractedTopics.push(h.textContent.trim());
               });
           } catch(e) {}
      }

      allTopics.forEach(wt => {
          const wtLower = wt.trim().toLowerCase();
          if (extractedTopics.length > 0) {
              const matchedHeader = extractedTopics.find(et => et.toLowerCase().includes(wtLower) || wtLower.includes(et.toLowerCase()));
              if (matchedHeader) {
                  recs.push({
                       title: matchedHeader,
                       topic: wt,
                       type: 'FREE_NOTES_LINK',
                       isPremium: false,
                       url: 'FREE_CHAPTER_NOTES',
                       access: 'FREE'
                  });
              }
          }
          if (universalData && universalData.notesPlaylist) {
              const matches = universalData.notesPlaylist.filter((n: any) =>
                  n.title.toLowerCase().includes(wtLower) ||
                  (n.topic && n.topic.toLowerCase().includes(wtLower)) ||
                  wtLower.includes(n.topic?.toLowerCase() || '')
              );
              recs.push(...matches.map((n: any) => ({
                  ...n,
                  topic: wt,
                  type: 'UNIVERSAL_NOTE',
                  isPremium: n.access === 'PREMIUM' || n.type === 'PDF'
              })));
          }
          if (chapterData && chapterData.topicNotes) {
              const matches = chapterData.topicNotes.filter((n: any) =>
                  (n.topic && n.topic.toLowerCase().trim() === wtLower) ||
                  (n.topic && n.topic.toLowerCase().includes(wtLower)) ||
                  (n.topic && wtLower.includes(n.topic.toLowerCase()))
              );
              recs.push(...matches.map((n: any) => ({
                  ...n,
                  topic: wt,
                  type: 'TOPIC_NOTE',
                  access: n.isPremium ? 'PREMIUM' : 'FREE',
                  isPremium: n.isPremium
              })));
          }
      });

      const uniqueRecs = recs.filter((v,i,a)=>a.findIndex(v2=>(v2.title===v.title && v2.topic === v.topic))===i);
      setRecommendations(uniqueRecs);
      setRecLoading(false);
  };

  const ITEMS_PER_PAGE = 50;
  const percentage = Math.round((result.score / result.totalQuestions) * 100);
  const omrData = result.omrData || [];
  const hasOMR = omrData.length > 0;
  const totalPages = Math.ceil(omrData.length / ITEMS_PER_PAGE);
  const currentData = omrData.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const devName = settings?.footerText || 'Nadim Anwar';

  useEffect(() => {
    if (initialView === 'ANALYSIS' || result.ultraAnalysisReport) {
        if (result.ultraAnalysisReport) {
             setUltraAnalysisResult(result.ultraAnalysisReport);
        }
    }
  }, [initialView, result.ultraAnalysisReport]);

  useEffect(() => {
      getCategorizedVoices().then(v => {
          setVoices(v);
          const preferred = v.hindi[0] || v.indianEnglish[0] || v.others[0];
          if (preferred) setSelectedVoice(preferred);
      });
  }, []);



  const handleShare = async () => {
      const appLink = settings?.officialAppUrl || "https://play.google.com/store/apps/details?id=com.nsta.app"; 
      const text = `*${settings?.appName || 'IDEAL INSPIRATION CLASSES'} RESULT*\n\nName: ${user.name}\nScore: ${result.score}/${result.totalQuestions}\nAccuracy: ${percentage}%\nCheck attached PDF for details.\n\nDownload App: ${appLink}`;

      if (navigator.share) {
          try {
              const element = document.getElementById('marksheet-style-1');
              if (element) {
                  const canvas = await html2canvas(element, { scale: 1.5, backgroundColor: '#ffffff', useCORS: true });
                  const imgData = canvas.toDataURL('image/png');
                  const pdf = new jsPDF('p', 'mm', 'a4');
                  const pdfWidth = pdf.internal.pageSize.getWidth();
                  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

                  const blob = pdf.output('blob');
                  const file = new File([blob], "Result_Analysis.pdf", { type: "application/pdf" });

                  if (navigator.canShare && navigator.canShare({ files: [file] })) {
                      await navigator.share({
                          title: 'My Result Analysis',
                          text: text,
                          files: [file]
                      });
                      return;
                  }
              }
          } catch(e) { console.error("Share File Failed", e); }
          try { await navigator.share({ title: 'Result', text }); } catch(e) {}
      } else {
          handleDownloadMarksheet();
          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      }
  };

  const unlockFreeAnalysis = () => {
      const COST = 20;
      if (user.credits < COST) {
          alert(`Insufficient Credits! Unlock costs ${COST} coins.`);
          return;
      }
      setConfirmConfig({
          isOpen: true,
          title: "Unlock Analysis",
          message: `View answers and explanations for ${COST} Coins?`,
          onConfirm: () => {
              if (onUpdateUser) onUpdateUser({ ...user, credits: user.credits - COST });
              setIsAnalysisUnlocked(true);
              setConfirmConfig(prev => ({...prev, isOpen: false}));
          }
      });
  };

  const handleUltraAnalysis = async (skipCost: boolean = false) => {
      if (result.ultraAnalysisReport) {
          setUltraAnalysisResult(result.ultraAnalysisReport);
          return;
      }
      if (!questions || questions.length === 0) return;

      const cost = settings?.mcqAnalysisCostUltra ?? 20;
      if (!skipCost) {
          if (user.credits < cost) {
              alert(`Insufficient Credits! You need ${cost} coins for Analysis Ultra.`);
              return;
          }
          if (!confirm(`Unlock AI Analysis Ultra for ${cost} Coins?`)) return;
      }

      setIsLoadingUltra(true);
      try {
          await new Promise(resolve => setTimeout(resolve, 1500));
          const analysisText = generateLocalAnalysis();
          setUltraAnalysisResult(analysisText);

          const updatedResult = { ...result, ultraAnalysisReport: analysisText };
          const updatedHistory = (user.mcqHistory || []).map(r => r.id === result.id ? updatedResult : r);
          
          const updatedUser = { 
              ...user, 
              credits: skipCost ? user.credits : user.credits - cost,
              mcqHistory: updatedHistory
          };
          saveUserLocal(updatedUser);
          await saveUserToLive(updatedUser);
          if (onUpdateUser) onUpdateUser(updatedUser);

          await saveUniversalAnalysis({
              id: `analysis-${Date.now()}`,
              userId: user.id,
              userName: user.name,
              date: new Date().toISOString(),
              subject: result.subjectName,
              chapter: result.chapterTitle,
              score: result.score,
              totalQuestions: result.totalQuestions,
              userPrompt: `Analysis`,
              aiResponse: analysisText,
              cost: skipCost ? 0 : cost
          });
      } catch (error: any) {
          console.error("Ultra Analysis Error:", error);
      } finally {
          setIsLoadingUltra(false);
      }
  };

  const handleRetryMistakes = () => {
      let wrongQs = result.wrongQuestions || [];
      if (wrongQs.length === 0 && questions) {
          wrongQs = questions.filter((q, i) => {
              const omr = result.omrData?.find(d => d.qIndex === i);
              return omr && omr.selected !== -1 && omr.selected !== q.correctAnswer;
          });
      }
      if (!wrongQs || wrongQs.length === 0) {
          alert("No mistakes to retry! Great job.");
          return;
      }
      if (onLaunchContent) {
          onLaunchContent({
              id: `RETRY_${result.id}`,
              title: `Retry Mistakes: ${result.chapterTitle}`,
              type: 'MCQ_SIMPLE',
              mcqData: wrongQs,
              subtitle: 'Mistake Review Session'
          });
      }
  };

  const renderOMRRow = (qIndex: number, selected: number, correct: number) => {
      const options = [0, 1, 2, 3];
      return (
          <div key={qIndex} className="flex items-center gap-2 mb-3 bg-slate-50 p-2 rounded-xl border border-slate-100 w-full">
              <span className="w-8 text-[11px] font-black text-slate-600 text-center border-r border-slate-200 pr-2">{qIndex + 1}</span>
              <div className="flex gap-2 w-full justify-around">
                  {options.map((opt) => {
                      let bgClass = "bg-white border-2 border-slate-300 text-slate-400";
                      if (selected === opt) {
                          if (correct === opt) bgClass = "bg-green-500 border-green-600 text-white shadow-md shadow-green-200";
                          else bgClass = "bg-red-500 border-red-600 text-white shadow-md shadow-red-200";
                      } else if (correct === opt && selected !== -1) {
                          bgClass = "bg-green-100 border-green-400 text-green-700 opacity-90";
                      } else if (correct === opt && selected === -1) {
                          bgClass = "bg-green-50 border-green-400 text-green-600";
                      }
                      return (
                          <div key={opt} className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${bgClass}`}>
                              {String.fromCharCode(65 + opt)}
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };

  const startSpeaking = (text: string) => {
      speakText(text, selectedVoice, speechRate);
      setIsSpeaking(true);
  };

  // --- SECTION RENDERERS ---

  const generateTeacherRemarks = (percent: number, topic: string, historyArr: number[]) => {
      // historyArr contains up to 3 scores: [oldest, ..., newest(current)]
      // Example: [40, 60, 70] (Current is 70)

      const isHindi = user.board === 'BSEB';
      const c = historyArr.length;

      // New 3-Case Intelligent Feedback Engine (Fallback to old if < 2 items)
      if (c >= 2) {
          const current = historyArr[c - 1];
          const prev1 = historyArr[c - 2];
          const prev2 = c >= 3 ? historyArr[c - 3] : null;

          // CASE 1: Strong Upward Trend (e.g. 40 -> 60 -> 70, or 60 -> 70)
          if ((prev2 === null && current > prev1) || (prev2 !== null && current > prev1 && prev1 > prev2)) {
              let msg = isHindi
                ? `📈 Aapka performance lagataar improve ho raha hai. ${prev2 !== null ? `${prev2}% -> ` : ''}${prev1}% -> ${current}% strong growth dikhata hai.<br/><br/>📌 Concepts ab clear ho rahe hain.<br/>🎯 Ab target rakhein: 75%+ stable score.`
                : `📈 Your performance is steadily improving. ${prev2 !== null ? `${prev2}% -> ` : ''}${prev1}% -> ${current}% shows strong growth.<br/><br/>📌 Concepts are getting clearer.<br/>🎯 Target: 75%+ stable score.`;

              return `${msg}<br/><br/><b>🔥 Engine Tag</b><br/>Trend: <span class="text-green-600 font-bold">📈 Strong Growth</span><br/>Confidence Level: <span class="text-green-600 font-bold">Increasing</span><br/>Risk: <span class="text-yellow-600 font-bold">Overconfidence</span>`;
          }

          // CASE 2: Sharp Drop (e.g. 60 -> 40)
          if (current < prev1 && (prev1 - current >= 15)) {
               let msg = isHindi
                ? `⚠ Aapka score ${prev1}% se ${current}% hua hai. Ye sudden drop hai.<br/><br/>📌 Possible reasons: Revision gap, Time pressure, Naye type ke questions.<br/>🎯 Next step: Last test ke galat questions analyse karein.`
                : `⚠ Your score dropped from ${prev1}% to ${current}%. This is a sudden drop.<br/><br/>📌 Possible reasons: Revision gap, Time pressure, New question types.<br/>🎯 Next step: Analyze incorrect questions from the last test.`;

               return `${msg}<br/><br/><b>🔥 Engine Tag</b><br/>Trend: <span class="text-red-600 font-bold">🔴 Alert</span><br/>Stability: <span class="text-red-600 font-bold">Low</span><br/>Immediate Action Needed`;
          }

          // CASE 3: Improved, then Slight Drop (e.g. 40 -> 60 -> 50)
          if (prev2 !== null && prev1 > prev2 && current < prev1) {
              let msg = isHindi
                ? `📈 Aapne ${prev2}% se ${prev1}% tak strong improvement kiya.<br/>📉 Latest test me ${current}% hai — thoda drop hai.<br/><br/>📌 Overall progress positive hai, lekin consistency improve karni hogi.<br/>🎯 Target: 65% stable score before moving ahead.`
                : `📈 You showed strong improvement from ${prev2}% to ${prev1}%.<br/>📉 Latest test is ${current}% — a slight drop.<br/><br/>📌 Overall progress is positive, but consistency needs improvement.<br/>🎯 Target: 65% stable score before moving ahead.`;

              return `${msg}<br/><br/><b>🔥 Engine Tag</b><br/>Trend: <span class="text-yellow-600 font-bold">🟡 Growing but Unstable</span><br/>Stability: <span class="text-yellow-600 font-bold">Medium</span><br/>Revision Cycle Required`;
          }

          // General Drop (Not Sharp)
          if (current < prev1) {
              return isHindi
                  ? `📉 Dhyan dein! Pichhli baar aapka score ${prev1}% tha, jo gir kar ${current}% ho gaya hai. ${topic} me revision ki zarurat hai.<br/><br/><b>🔥 Engine Tag</b><br/>Trend: <span class="text-red-600 font-bold">🔴 Drop</span>`
                  : `📉 Performance dropped. You scored ${current}% compared to ${prev1}% last time. Focus more on ${topic} revision.<br/><br/><b>🔥 Engine Tag</b><br/>Trend: <span class="text-red-600 font-bold">🔴 Drop</span>`;
          }

          // Consistent
          if (current === prev1) {
              return isHindi
                  ? `🔵 Performance consistent hai (${current}%). Thoda aur push karein taaki score badhe.<br/><br/><b>🔥 Engine Tag</b><br/>Trend: <span class="text-blue-600 font-bold">🔵 Plateau</span>`
                  : `🔵 Performance is consistent at ${current}%. Push a little harder to improve next time.<br/><br/><b>🔥 Engine Tag</b><br/>Trend: <span class="text-blue-600 font-bold">🔵 Plateau</span>`;
          }
      }

      // Fallback for single attempt
      if (percent >= 80) return isHindi
          ? `📈 Shabash! ${topic} me aapne bahut achha kiya hai. Is pakad ko banaye rakhein.<br/><br/><b>🔥 Engine Tag</b><br/>Trend: <span class="text-green-600 font-bold">📈 Strong</span>`
          : `📈 Excellent work in ${topic}! Your grasp on this topic is strong. Keep practicing to maintain this level.<br/><br/><b>🔥 Engine Tag</b><br/>Trend: <span class="text-green-600 font-bold">📈 Strong</span>`;

      if (percent >= 50) return isHindi
          ? `🟡 ${topic} me thik hai, par thoda aur sudhar ho sakta hai. Revision karein.<br/><br/><b>🔥 Engine Tag</b><br/>Trend: <span class="text-yellow-600 font-bold">🟡 Average</span>`
          : `🟡 Good effort in ${topic}. You are doing okay, but a little more revision will help you reach the top level.<br/><br/><b>🔥 Engine Tag</b><br/>Trend: <span class="text-yellow-600 font-bold">🟡 Average</span>`;

      return isHindi
          ? `🔴 ${topic} me aapka performance kamzor hai. Kripya notes padhein aur dubara koshish karein.<br/><br/><b>🔥 Engine Tag</b><br/>Trend: <span class="text-red-600 font-bold">🔴 Weak</span>`
          : `🔴 You need to focus on ${topic}. Your score is low here. Please read the recommended notes and try again.<br/><br/><b>🔥 Engine Tag</b><br/>Trend: <span class="text-red-600 font-bold">🔴 Weak</span>`;
  };

  const renderWeakAreasSummary = () => {
      // Prioritize result.topicAnalysis if it exists, otherwise fall back to locally calculated topicStats
      const analysisSource = result.topicAnalysis && Object.keys(result.topicAnalysis).length > 0
          ? Object.keys(result.topicAnalysis).map(t => ({ name: t, percent: result.topicAnalysis![t].percentage }))
          : Object.keys(topicStats).map(t => ({ name: t, percent: topicStats[t].percent }));

      const weakTopics = analysisSource.filter(t => t.percent < 50);

      if (weakTopics.length === 0) return null;

      return (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-6 animate-in slide-in-from-top-4">
              <h3 className="text-sm font-black text-red-800 mb-2 flex items-center gap-2">
                  <AlertCircle size={16} /> Weak Areas (Needs Focus)
              </h3>
              <div className="flex flex-wrap gap-2">
                  {weakTopics.map(t => (
                      <span key={t.name} className="px-3 py-1 bg-white border border-red-200 rounded-full text-xs font-bold text-red-600 shadow-sm">
                          {t.name} ({t.percent}%)
                      </span>
                  ))}
              </div>
              <p className="text-[10px] text-red-500 font-bold mt-3">
                  Please review these topics carefully before the next test.
              </p>
          </div>
      );
  };

  const renderGranularAnalysis = () => {

      let topics = Object.keys(topicStats);
      if (topics.length === 0 && result.topicAnalysis) {
          topics = Object.keys(result.topicAnalysis);
      }


      // Find all previous results for comparison (sorted newest to oldest)
      const previousResults = (user.mcqHistory || [])
          .filter(h => h.chapterId === result.chapterId && h.id !== result.id)
          .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Extract the most recent previous result for the top-level stats display
      const previousResult = previousResults[0];

      return (
          <div className="space-y-6">
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
                  <div className="relative z-10">
                      <h3 className="text-xl font-black mb-2 flex items-center gap-2"><BrainCircuit className="text-yellow-400" /> Analysis Dashboard</h3>
                      <p className="text-slate-300 text-xs font-medium mb-4">Detailed breakdown of your performance by topic.</p>
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-32 bg-white/5 skew-x-12 -mr-8"></div>
              </div>

              {renderWeakAreasSummary()}

              {topics.map((topic, i) => {
                  const stats = topicStats[topic] || (result.topicAnalysis && result.topicAnalysis[topic] ? {
                      correct: result.topicAnalysis[topic].correct,
                      total: result.topicAnalysis[topic].total,
                      percent: result.topicAnalysis[topic].percentage
                  } : { correct: 0, total: 0, percent: 0 });

                  // For standalone revision hub without questions loaded, use topicAnalysis natively from result
                  let finalTopicPercent = stats.percent;
                  let finalCorrect = stats.correct;
                  let finalTotal = stats.total;

                  if (result.topicAnalysis && result.topicAnalysis[topic]) {
                      finalTopicPercent = result.topicAnalysis[topic].percentage;
                      finalCorrect = result.topicAnalysis[topic].correct;
                      finalTotal = result.topicAnalysis[topic].total;
                  }

                  const status = finalTopicPercent >= 80 ? 'STRONG' : finalTopicPercent >= 50 ? 'AVERAGE' : 'WEAK';

                  // Generate History Array for the Intelligent Feedback Engine (oldest -> newest)
                  const historyArr: number[] = [];

                  // Add previous 2 attempts if available (reverse from sorted newer->older so it is older->newer)
                  let addedPrev = 0;
                  for (let j = 0; j < previousResults.length; j++) {
                      if (addedPrev >= 2) break;
                      const res = previousResults[j];
                      if (res.topicAnalysis && res.topicAnalysis[topic]) {
                          // Unshift to put oldest of the 2 at the front
                          historyArr.unshift(res.topicAnalysis[topic].percentage);
                          addedPrev++;
                      }
                  }

                  // Push current percent
                  historyArr.push(finalTopicPercent);

                  // Extract just the immediate last previous percent for UI diff logic
                  const prevPercent = historyArr.length > 1 ? historyArr[historyArr.length - 2] : 0;
                  const hasPrev = historyArr.length > 1;
                  const diff = finalTopicPercent - prevPercent;

                  // Filter questions for this topic (if available)
                  const topicQuestions = questions?.filter((q, idx) => {
                      const t = q.topic || 'General';
                      return t === topic;
                  }) || [];

                  // Generate smart remarks using the new 3-Case Feedback Engine
                  const remarks = generateTeacherRemarks(finalTopicPercent, topic, historyArr);

                  return (
                      <div key={i} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md">
                          {/* 1. Topic Header & Status */}
                          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                              <div>
                                  <h4 className="font-black text-slate-800 text-sm uppercase flex items-center gap-2">
                                      {topic}
                                      {status === 'WEAK' && <AlertCircle size={14} className="text-red-500" />}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-1">
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${status === 'STRONG' ? 'bg-green-100 text-green-700' : status === 'AVERAGE' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                          {status}
                                      </span>
                                      {/* 2. Historical Comparison */}
                                      {hasPrev && (
                                          <span className={`text-[10px] font-bold flex items-center gap-1 ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                              {diff > 0 ? <ArrowUp size={10} /> : diff < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
                                              {diff > 0 ? '+' : ''}{diff}% vs Last
                                          </span>
                                      )}
                                  </div>
                              </div>
                              {/* 3. Stats */}
                              <div className="text-right">
                                  <div className={`text-2xl font-black ${finalTopicPercent >= 80 ? 'text-green-600' : finalTopicPercent < 50 ? 'text-red-600' : 'text-slate-800'}`}>{finalTopicPercent}%</div>
                                  <div className="text-[10px] text-slate-500 font-bold">{finalCorrect}/{finalTotal} Correct</div>
                              </div>
                          </div>

                          {/* EXPLICIT SUB-TOPIC HISTORY COMPARISON */}
                          {historyArr.length > 1 && (
                              <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex justify-between items-center text-[10px] font-bold text-slate-600">
                                  <div className="flex items-center gap-1"><BrainCircuit size={12} className="text-purple-500"/> Sub-Topic History:</div>
                                  <div className="flex gap-3">
                                      {historyArr.slice(0, -1).map((pastScore, pIdx) => (
                                          <span key={pIdx} className="bg-white px-2 py-0.5 rounded border border-slate-200">
                                              Past {pIdx + 1}: <span className={`${pastScore >= 80 ? 'text-green-600' : pastScore < 50 ? 'text-red-600' : 'text-yellow-600'}`}>{pastScore}%</span>
                                          </span>
                                      ))}
                                      <span className="bg-white px-2 py-0.5 rounded border border-purple-200 shadow-sm">
                                          Current: <span className={`${finalTopicPercent >= 80 ? 'text-green-600' : finalTopicPercent < 50 ? 'text-red-600' : 'text-yellow-600'}`}>{finalTopicPercent}%</span>
                                      </span>
                                  </div>
                              </div>
                          )}

                          <div className="p-4 bg-white">

                              {/* 5. Questions Accordion List */}
                              <div className="space-y-2">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Questions in this Topic</p>
                                  {topicQuestions.map((q, localIdx) => {
                                      const globalIdx = questions?.indexOf(q) ?? -1;
                                      const omrEntry = result.omrData?.find(d => d.qIndex === globalIdx);
                                      const userSelected = omrEntry ? omrEntry.selected : -1;
                                      const isCorrect = userSelected === q.correctAnswer;
                                      const isSkipped = userSelected === -1;

                                      return (
                                          <div key={localIdx} className={`text-xs border rounded-lg overflow-hidden transition-all ${isCorrect ? 'border-green-200 bg-green-50/30' : isSkipped ? 'border-slate-200 bg-slate-50' : 'border-red-200 bg-red-50/30'}`}>
                                              <details className="group">
                                                  <summary className="flex items-center justify-between p-3 cursor-pointer list-none select-none">
                                                      <div className="flex items-center gap-2 overflow-hidden">
                                                          <span className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center font-bold text-[10px] ${isCorrect ? 'bg-green-100 text-green-700' : isSkipped ? 'bg-slate-200 text-slate-600' : 'bg-red-100 text-red-600'}`}>
                                                              {globalIdx + 1}
                                                          </span>
                                                          <div className="font-medium text-slate-700 truncate pr-2" dangerouslySetInnerHTML={{__html: stripHtml(q.question)}} />
                                                      </div>
                                                      <div className="shrink-0">
                                                          <ChevronDown size={14} className="text-slate-400 group-open:rotate-180 transition-transform" />
                                                      </div>
                                                  </summary>
                                                  <div className="px-3 pb-3 pt-0 border-t border-dashed border-slate-200 mt-2 bg-white">
                                                      <div className="mt-2 text-slate-800 font-bold mb-2" dangerouslySetInnerHTML={{__html: renderMathInHtml(q.question)}} />
                                                      <div className="space-y-1 mb-2">
                                                          {q.options?.map((opt, optIdx) => {
                                                              const isAns = optIdx === q.correctAnswer;
                                                              const isSel = optIdx === userSelected;
                                                              let cls = "text-slate-500";
                                                              if (isAns) cls = "text-green-700 font-bold";
                                                              if (isSel && !isAns) cls = "text-red-700 font-bold line-through decoration-red-500";

                                                              return (
                                                                  <div key={optIdx} className={`flex gap-2 ${cls}`}>
                                                                      <span className="w-4 shrink-0">{String.fromCharCode(65+optIdx)}.</span>
                                                                      <span dangerouslySetInnerHTML={{__html: renderMathInHtml(opt)}} />
                                                                      {isAns && <CheckCircle size={12} className="ml-1 text-green-600 inline" />}
                                                                      {isSel && !isAns && <XCircle size={12} className="ml-1 text-red-600 inline" />}
                                                                  </div>
                                                              );
                                                          })}
                                                      </div>
                                                      <div className="flex flex-col gap-2 mt-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-[11px]">
                                                          {q.concept && <div><span className="font-bold text-indigo-700">💡 Concept:</span> <span dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.concept) }}></span></div>}
                                                          {q.explanation && <div><span className="font-bold text-blue-700">🔎 Explanation:</span> <span dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.explanation) }}></span></div>}
                                                          {q.examTip && <div><span className="font-bold text-amber-700">🎯 Exam Tip:</span> <span dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.examTip) }}></span></div>}
                                                          {q.commonMistake && <div><span className="font-bold text-red-700">⚠ Common Mistake:</span> <span dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.commonMistake) }}></span></div>}
                                                          {q.mnemonic && <div><span className="font-bold text-purple-700">🧠 Memory Trick:</span> <span dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.mnemonic) }}></span></div>}
                                                          {q.difficultyLevel && <div><span className="font-bold text-slate-700">📊 Difficulty:</span> <span>{q.difficultyLevel}</span></div>}
                                                      </div>
                                                      <div className="mt-2 text-right">
                                                          <SpeakButton
                                                              text={`Question ${globalIdx + 1}. ${stripHtml(q.question)}. The correct answer is option ${String.fromCharCode(65 + q.correctAnswer)}. Explanation: ${stripHtml(q.explanation || '')}`}
                                                              className="text-slate-400 hover:text-indigo-600 inline-flex"
                                                              iconSize={14}
                                                          />
                                                      </div>
                                                  </div>
                                              </details>
                                          </div>
                                      );
                                  })}
                              </div>
                          </div>
                      </div>
                  );
              })}
          </div>
      );
  };


  const renderMarksheetStyle1 = () => {
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

      // Prepare Topic Lists for Top 5
      let analysisSource: any = {};
      if (result.topicAnalysis && Object.keys(result.topicAnalysis).length > 0) {
          Object.keys(result.topicAnalysis).forEach(t => {
              analysisSource[t] = { correct: result.topicAnalysis![t].correct, total: result.topicAnalysis![t].total, percent: result.topicAnalysis![t].percentage };
          });
      } else if (Object.keys(topicStats).length > 0) {
          analysisSource = { ...topicStats };
      }
      const topicsList = Object.keys(analysisSource).map(t => ({
          name: t,
          percent: analysisSource[t].percent,
          correct: analysisSource[t].correct,
          total: analysisSource[t].total
      }));

      const top5High = [...topicsList].sort((a, b) => b.percent - a.percent).slice(0, 5);
      const top5Low = [...topicsList].sort((a, b) => a.percent - b.percent).slice(0, 5);

      return (
      <div id="marksheet-style-1" className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 relative overflow-hidden break-inside-avoid">
          {/* App Logo & Name Header */}
          <div className="flex flex-col items-center mb-6 pb-6 border-b border-slate-100">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-md mb-2 overflow-hidden border border-slate-100 p-1">
                  {settings?.appLogo ? (
                      <img src={settings.appLogo} alt="App Logo" className="w-full h-full object-contain" />
                  ) : (
                      <h1 className="text-xl font-black text-blue-600">{settings?.appShortName || 'IIC'}</h1>
                  )}
              </div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight text-center">
                  {settings?.appName || 'IDEAL INSPIRATION CLASSES'}
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
                      <p className="text-[10px] text-slate-500 font-mono">ID: {user.displayId || user.id.slice(0, 8)}</p>
                  </div>
              </div>
              <div className="text-right">
                  <p className="text-xs font-bold text-slate-500">{new Date(result.date).toLocaleDateString()}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{new Date(result.date).toLocaleTimeString()}</p>
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
              <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Speed</p>
                  <p className="text-xl font-black text-slate-800">{result.averageTimePerQuestion.toFixed(1)}s</p>
                  <p className="text-[8px] text-slate-400 uppercase">per question</p>
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
                  <div style={{ width: `${(correct / totalQ) * 100}%` }} className="bg-green-500 hover:opacity-90 transition-opacity" title={`Correct: ${correct}`}></div>
                  <div style={{ width: `${(incorrect / totalQ) * 100}%` }} className="bg-red-500 hover:opacity-90 transition-opacity" title={`Incorrect: ${incorrect}`}></div>
                  <div style={{ width: `${(skipped / totalQ) * 100}%` }} className="bg-slate-300 hover:opacity-90 transition-opacity" title={`Skipped: ${skipped}`}></div>
              </div>
              <div className="flex justify-between text-xs font-bold px-2">
                  <span className="text-green-700 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> {correct} Correct</span>
                  <span className="text-red-700 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> {incorrect} Incorrect</span>
                  <span className="text-slate-600 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-300"></div> {skipped} Skipped</span>
              </div>
          </div>

          {/* Top 5 Topics Performance */}
          {topicsList.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 break-inside-avoid">
                  {/* Top 5 Strong Topics */}
                  <div className="bg-green-50/50 rounded-2xl p-5 border border-green-100 shadow-sm">
                      <h4 className="text-sm font-black text-green-800 mb-4 flex items-center gap-2">
                          <TrendingUp size={16} className="text-green-600" /> Top 5 High Score
                      </h4>
                      <div className="space-y-3">
                          {top5High.map((t, i) => (
                              <div key={i} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-green-100 shadow-sm">
                                  <span className="text-xs font-bold text-slate-700 truncate pr-2 flex-1">{t.name}</span>
                                  <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-slate-500 font-bold">{t.correct}/{t.total}</span>
                                      <span className="text-xs font-black text-green-600 bg-green-100 px-2 py-0.5 rounded">{t.percent}%</span>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>

                  {/* Top 5 Weak Topics */}
                  <div className="bg-red-50/50 rounded-2xl p-5 border border-red-100 shadow-sm">
                      <h4 className="text-sm font-black text-red-800 mb-4 flex items-center gap-2">
                          <TrendingDown size={16} className="text-red-600" /> Top 5 Low Score
                      </h4>
                      <div className="space-y-3">
                          {top5Low.map((t, i) => (
                              <div key={i} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-red-100 shadow-sm">
                                  <span className="text-xs font-bold text-slate-700 truncate pr-2 flex-1">{t.name}</span>
                                  <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-slate-500 font-bold">{t.correct}/{t.total}</span>
                                      <span className="text-xs font-black text-red-600 bg-red-100 px-2 py-0.5 rounded">{t.percent}%</span>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          )}
      </div>
  );
  };

  const renderAnalysisContent = () => {
      // AI Performance Analysis removed
      return null;
  };

  const renderRecommendationsSection = () => {
      // Recommendations removed
      return null;
  };

  const renderProgressDelta = () => {
      // Progress Trend removed
      return null;
  };

  const renderTopicBreakdown = () => {
        if (!result.topicAnalysis) return null;

        const topics = Object.keys(result.topicAnalysis);
        if (topics.length === 0) return null;

        return (
            <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200 mt-6 break-inside-avoid">
                <h3 className="font-black text-slate-800 text-lg mb-4 flex items-center gap-2 border-b pb-3">
                    <BrainCircuit size={20} className="text-purple-600" /> Topic & Sub-Topic Analysis
                </h3>
                <p className="text-xs text-slate-500 mb-6">Review your performance by topic. Read the attached notes to improve weak areas.</p>
                <div className="space-y-4">
                    {topics.map((topic, i) => {
                        const analysis = result.topicAnalysis![topic];
                        const percent = analysis.total > 0 ? Math.round((analysis.correct / analysis.total) * 100) : 0;
                        let status = 'AVERAGE';
                        let colorClass = 'bg-yellow-100 text-yellow-700 border-yellow-200';
                        if (percent >= 80) { status = 'STRONG'; colorClass = 'bg-green-100 text-green-700 border-green-200'; }
                        else if (percent < 50) { status = 'WEAK'; colorClass = 'bg-red-100 text-red-700 border-red-200'; }

                        // Extract notes safely from questions related to this topic if available
                        // In the previous version, notes are sometimes bundled in q.note
                        const topicQs = questions?.filter(q => q.topic === topic) || [];
                        const topicNotes = topicQs.map(q => q.note).filter(Boolean);
                        // Deduplicate notes by simple set or string match
                        const uniqueNotes = Array.from(new Set(topicNotes));

                        return (
                            <div key={i} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <h4 className="font-black text-slate-800 uppercase flex items-center gap-2">
                                            {topic}
                                        </h4>
                                        <div className="flex gap-2 mt-2">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${colorClass}`}>
                                                {status} ({percent}%)
                                            </span>
                                            <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold">
                                                {analysis.correct}/{analysis.total} Correct
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {uniqueNotes.length > 0 && (
                                    <div className="p-4 bg-blue-50/30">
                                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-1">
                                            <BookOpen size={12} /> Topic Notes
                                        </p>
                                        <div className="space-y-3">
                                            {uniqueNotes.map((note, nIdx) => (
                                                <div key={nIdx} className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-xl border border-blue-100 shadow-sm" dangerouslySetInnerHTML={{ __html: renderMathInHtml(note) }} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {uniqueNotes.length === 0 && status !== 'STRONG' && (
                                    <div className="p-4 bg-slate-50 text-xs text-slate-500 italic text-center">
                                        No specific notes available for this sub-topic. Review your textbook.
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

  const renderFullOMR = () => (
      <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200 mt-6 relative overflow-hidden break-inside-avoid">
          <h3 className="font-black text-slate-800 text-lg mb-4 border-b pb-3 flex items-center gap-2">
              <Grid size={20} className="text-blue-600" /> Complete OMR Sheet
          </h3>
          <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"><div className="w-3 h-3 rounded-full bg-green-500 border border-green-600"></div> Correct</div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"><div className="w-3 h-3 rounded-full bg-red-500 border border-red-600"></div> Incorrect</div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"><div className="w-3 h-3 rounded-full bg-white border-2 border-slate-300"></div> Skipped</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {result.omrData?.map((data) => renderOMRRow(data.qIndex, data.selected, data.correct))}
          </div>
      </div>
  );

  const renderDetailedSolutions = () => {
      // Build TTS Playlist
      const handlePlayAll = () => {
          if (!questions) return;
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
      <div className="mt-8">
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

          <div className="space-y-6">
              {questions?.map((q, idx) => {
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

                                      if (isThisCorrect) {
                                          optClass = "bg-green-50 border-green-500 text-green-800 shadow-sm";
                                      } else if (isThisSelected && !isThisCorrect) {
                                          optClass = "bg-red-50 border-red-300 text-red-800";
                                      }

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
                                      <p className="text-[12px] font-bold text-indigo-700 mb-2 flex items-center gap-1">
                                          <Lightbulb size={14} /> Concept
                                      </p>
                                      <div className="text-sm text-slate-700 leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.concept) }} />
                                  </div>
                              )}
                              {q.explanation && (
                                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-[20px] shadow-sm">
                                      <p className="text-[12px] font-bold text-blue-700 mb-2 flex items-center gap-1">
                                          <BookOpen size={14} /> Explanation
                                      </p>
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
                                          <AlertTriangle size={14} /> Common Mistake
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
                                          <BarChart3 size={14} /> Difficulty:
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
      </div>
  )};

  const renderFullReport = () => (
      <div className="p-8 bg-white max-w-4xl mx-auto space-y-8">
          {renderMarksheetStyle1()}
          <div className="border-t-2 border-dashed border-slate-300 my-8"></div>
          {renderAnalysisContent()}
          {renderTopicBreakdown()}
          {renderFullOMR()}
          {renderDetailedSolutions()}
      </div>
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
        <CustomConfirm
            isOpen={confirmConfig.isOpen}
            title={confirmConfig.title}
            message={confirmConfig.message}
            onConfirm={confirmConfig.onConfirm}
            onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})}
        />

        {/* HIDDEN PRINT CONTAINER */}
        <div id="full-report-print-container" style={{ position: 'absolute', top: 0, left: 0, opacity: 0, pointerEvents: 'none', zIndex: -1000, width: '800px' }}>
            {renderFullReport()}
        </div>

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

            {/* Comparison Alert */}
            {comparisonMessage && (
                <div className="px-4 pt-2">
                    <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex gap-3 animate-in slide-in-from-top-2">
                        <div className="bg-white p-2 rounded-full h-fit shadow-sm text-blue-600"><TrendingUp size={16} /></div>
                        <p className="text-xs text-blue-800 font-medium leading-relaxed">{comparisonMessage}</p>
                    </div>
                </div>
            )}

            {/* Tab Header */}
            <div className="px-4 pt-2 pb-0 bg-white border-b border-slate-100 flex gap-2 overflow-x-auto shrink-0 scrollbar-hide items-center">
                {/* Official Marksheet Tab */}
                {(() => {
                    const access = checkFeatureAccess('MS_OFFICIAL', user, settings || {});
                    if (!access.hasAccess && access.cost === 0) return null; // Hidden if locked/denied

                    return (
                        <button
                            onClick={() => setActiveTab('OFFICIAL_MARKSHEET')}
                            className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${activeTab === 'OFFICIAL_MARKSHEET' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
                        >
                            <FileText size={14} className="inline mr-1 mb-0.5" /> Official Marksheet
                        </button>
                    );
                })()}

                {!isAnalysisUnlocked ? (
                    <button onClick={unlockFreeAnalysis} className="px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 border-transparent text-slate-400 hover:text-slate-600 flex items-center gap-1 bg-slate-50/50">
                        <Lock size={12} /> Analysis (Locked)
                    </button>
                ) : (
                    <>
                        {/* Analysis (Solution) Tab */}
                        {(() => {
                            const access = checkFeatureAccess('MS_ANALYSIS', user, settings || {});
                            if (!access.hasAccess) return null;
                            return (
                                <button onClick={() => setActiveTab('SOLUTION')} className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${activeTab === 'SOLUTION' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
                                    <FileSearch size={14} className="inline mr-1 mb-0.5" /> Topic Analysis
                                </button>
                            );
                        })()}

                        {/* Detailed Solutions Tab */}
                        {(() => {
                            const access = checkFeatureAccess('MS_ANALYSIS', user, settings || {});
                            if (!access.hasAccess) return null;
                            return (
                                <button onClick={() => setActiveTab('DETAILED_SOLUTIONS')} className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${activeTab === 'DETAILED_SOLUTIONS' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
                                    <BrainCircuit size={14} className="inline mr-1 mb-0.5" /> Detailed Solutions
                                </button>
                            );
                        })()}


                        {/* OMR Tab */}
                        {(() => {
                            const access = checkFeatureAccess('MS_OMR', user, settings || {});
                            if (!access.hasAccess) return null;
                            return (
                                <button onClick={() => setActiveTab('OMR')} className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${activeTab === 'OMR' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
                                    <Grid size={14} className="inline mr-1 mb-0.5" /> OMR
                                </button>
                            );
                        })()}

                    </>
                )}
            </div>

            {/* Scrollable Content */}
            <div id="marksheet-content" className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50">
                {activeTab === 'OFFICIAL_MARKSHEET' && (
                    <>
                        {renderMarksheetStyle1()}
                        {!isAnalysisUnlocked && (
                            <div className="mt-6 bg-white p-6 rounded-2xl border-2 border-indigo-100 text-center shadow-lg">
                                <Lock className="mx-auto text-indigo-400 mb-3" size={48} />
                                <h3 className="text-xl font-black text-slate-800 mb-2">Analysis Locked</h3>
                                <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">Unlock detailed answers, OMR sheet, and weak concept analysis.</p>
                                <button onClick={unlockFreeAnalysis} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold shadow-xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2 mx-auto">
                                    <BrainCircuit size={20} /> Unlock Now (20 Coins)
                                </button>
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'SOLUTION' && isAnalysisUnlocked && (
                    <div className="animate-in slide-in-from-bottom-4">
                        {/* Topic-wise Granular Analysis View */}
                        <div className="mb-8">
                            {renderGranularAnalysis()}
                        </div>
                    </div>
                )}

                {activeTab === 'DETAILED_SOLUTIONS' && isAnalysisUnlocked && (
                    <div className="animate-in slide-in-from-bottom-4">
                        {questions && questions.length > 0 ? (
                            <div className="space-y-6">
                                {questions.map((q, idx) => {
                                    const omrEntry = result.omrData?.find(d => d.qIndex === idx);
                                    const userSelected = omrEntry ? omrEntry.selected : -1;
                                    const isCorrect = userSelected === q.correctAnswer;
                                    const isSkipped = userSelected === -1;
                                    return (
                                        <div key={idx} className={`bg-white rounded-2xl border ${isCorrect ? 'border-green-200' : isSkipped ? 'border-slate-200' : 'border-red-200'} shadow-sm overflow-hidden`}>
                                            <div className={`p-4 ${isCorrect ? 'bg-green-50' : isSkipped ? 'bg-slate-50' : 'bg-red-50'} border-b ${isCorrect ? 'border-green-100' : isSkipped ? 'border-slate-100' : 'border-red-100'} flex gap-3`}>
                                                <span className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${isCorrect ? 'bg-green-100 text-green-700' : isSkipped ? 'bg-slate-200 text-slate-600' : 'bg-red-100 text-red-600'}`}>{idx + 1}</span>
                                                <div className="flex-1"><div className="text-sm font-bold text-slate-800 leading-snug" dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.question) }} /></div>
                                            </div>
                                            {q.options && (
                                                <div className="p-4 space-y-2">
                                                    {q.options.map((opt: string, optIdx: number) => {
                                                        const isSelected = userSelected === optIdx;
                                                        const isAnswer = q.correctAnswer === optIdx;
                                                        let cls = "border-slate-100 bg-white text-slate-600";
                                                        if (isAnswer) cls = "border-green-300 bg-green-50 text-green-800 font-bold";
                                                        else if (isSelected) cls = "border-red-300 bg-red-50 text-red-800 font-bold";
                                                        return (
                                                            <div key={optIdx} className={`p-3 rounded-xl border flex items-center gap-3 text-xs transition-colors ${cls}`}>
                                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] border ${isAnswer ? 'border-green-400 bg-green-100 text-green-700' : isSelected ? 'border-red-400 bg-red-100 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>{String.fromCharCode(65 + optIdx)}</div>
                                                                <div className="flex-1" dangerouslySetInnerHTML={{ __html: renderMathInHtml(opt) }} />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            <div className="p-4 bg-blue-50 border-t border-blue-100 flex flex-col gap-2 text-sm">
                                                {q.explanation && <div><span className="font-bold text-blue-700">Explanation:</span> <span dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.explanation) }}></span></div>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : <p>No questions data.</p>}
                    </div>
                )}


                {activeTab === 'OMR' && isAnalysisUnlocked && (
                    <div className="animate-in slide-in-from-bottom-4">
                         {renderTopicBreakdown()}
                         <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200 mt-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-10 opacity-50"></div>
                            <h3 className="font-black text-slate-800 text-lg mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                                <Grid size={20} className="text-blue-600" /> OMR Response Sheet
                            </h3>

                            <div className="flex flex-wrap gap-4 mb-6">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"><div className="w-3 h-3 rounded-full bg-green-500 border border-green-600"></div> Correct</div>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"><div className="w-3 h-3 rounded-full bg-red-500 border border-red-600"></div> Incorrect</div>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"><div className="w-3 h-3 rounded-full bg-white border-2 border-slate-300"></div> Skipped</div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 relative z-10">
                                {currentData.map((data) => renderOMRRow(data.qIndex, data.selected, data.correct))}
                            </div>
                            {/* RESTORED: Pagination */}
                            {hasOMR && (
                                <div className="flex justify-between items-center mt-4">
                                    <button
                                        disabled={page === 1}
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        className="p-2 rounded-lg bg-slate-100 disabled:opacity-50 hover:bg-slate-200"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <span className="text-xs font-bold text-slate-500">Page {page} of {totalPages}</span>
                                    <button
                                        disabled={page === totalPages}
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        className="p-2 rounded-lg bg-slate-100 disabled:opacity-50 hover:bg-slate-200"
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>

            {/* Footer Actions */}
            <div className="bg-white p-4 border-t border-slate-100 flex flex-wrap items-center justify-center gap-4 z-10 shrink-0">
                <button onClick={handleShare} className="p-3 bg-green-50 text-green-600 rounded-full hover:bg-green-600 hover:text-white transition-all shadow-sm active:scale-95" title="Share Result">
                    <Share2 size={20} />
                </button>
                {activeTab === 'OFFICIAL_MARKSHEET' && (
                <button
                    onClick={() => downloadAsMHTML('marksheet-style-1', `Marksheet_${user.name}`)}
                    className="flex items-center justify-center p-3 bg-slate-100 text-slate-700 rounded-full font-bold hover:bg-slate-200 transition-colors shadow-sm active:scale-95"
                    title="Download Marksheet"
                >
                    <Download size={20} />
                </button>
            )}
                {activeTab !== 'OFFICIAL_MARKSHEET' && (
                <button
                    onClick={() => downloadAsMHTML('full-report-print-container', `Full_Analysis_${user.name}`)}
                    className="flex items-center justify-center p-3 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 active:scale-95"
                    title="Download Full Analysis"
                >
                    {isDownloadingAll ? <span className="animate-spin">⏳</span> : <Download size={20} />}
                </button>
            )}
            </div>
             
             <div className="text-center py-2 bg-slate-50 border-t border-slate-100">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Developed by Nadim Anwar</p>
             </div>
        </div>



        {viewingNote && (
            <div className="fixed inset-0 z-[250] bg-slate-900/90 flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <div className="flex items-center gap-2">
                            <BookOpen size={18} className="text-indigo-600"/>
                            <h3 className="font-bold text-slate-800 text-sm line-clamp-1 max-w-[200px] sm:max-w-sm">{viewingNote.title}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <SpeakButton
                                text={stripHtml(viewingNote.content || viewingNote.html || 'No content available.')}
                                className="hover:bg-slate-200 text-slate-600 p-1.5"
                                iconSize={18}
                            />
                            <button onClick={() => setViewingNote(null)} className="p-1 hover:bg-slate-200 rounded-full text-slate-500"><X size={20} /></button>
                        </div>
                    </div>
                    <div className="p-6 overflow-y-auto prose prose-sm max-w-none">
                         <div dangerouslySetInnerHTML={{ __html: viewingNote.content || viewingNote.html || '<p>No content available.</p>' }} />
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

const UnlockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
);
