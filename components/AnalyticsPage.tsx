
import React, { useState } from 'react';
import type { User, MCQResult, PerformanceTag, SystemSettings } from '../types';
import { BarChart, Clock, Calendar, BookOpen, TrendingUp, AlertTriangle, CheckCircle, XCircle, FileText, BrainCircuit } from 'lucide-react';
import { MarksheetCard } from './MarksheetCard';

interface Props {
  user: User;
  onBack: () => void;
  settings?: SystemSettings;
  onNavigateToChapter?: (chapterId: string, chapterTitle: string, subjectName: string, classLevel?: string) => void;
}

export const AnalyticsPage: React.FC<Props> = ({ user, onBack, settings, onNavigateToChapter }) => {
  const [selectedResult, setSelectedResult] = useState<MCQResult | null>(null);
  const [selectedQuestions, setSelectedQuestions] = useState<any[]>([]);
  const [initialView, setInitialView] = useState<'ANALYSIS' | 'RECOMMEND' | undefined>(undefined);
  const [showMoreTests, setShowMoreTests] = useState(false);

  const historyRaw = user.mcqHistory || [];
  
  // Annual Report Requirement: Show only last 30 days data
  const history = historyRaw.filter(h => {
      const d = new Date(h.date);
      const limit = new Date();
      limit.setDate(limit.getDate() - 7);
      return d >= limit;
  });

  const getQuestionsForAttempt = (attemptId: string) => {
      try {
          const historyStr = localStorage.getItem('nst_user_history');
          if (historyStr) {
              const history = JSON.parse(historyStr);
              // Match by analytics ID (which is result ID)
              const match = history.find((h: any) => h.analytics && h.analytics.id === attemptId);
              if (match && match.mcqData) {
                  return match.mcqData;
              }
          }
      } catch (e) {}
      return [];
  };

  const handleOpenMarksheet = (result: MCQResult, view?: 'ANALYSIS' | 'RECOMMEND') => {
      const questions = getQuestionsForAttempt(result.id);
      setSelectedQuestions(questions);
      setInitialView(view);
      setSelectedResult(result);
  };
  
  // Calculate Totals
  const totalTests = history.length;
  const totalQuestions = history.reduce((acc, curr) => acc + curr.totalQuestions, 0);
  const totalCorrect = history.reduce((acc, curr) => acc + curr.correctCount, 0);
  const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  
  const totalTime = history.reduce((acc, curr) => acc + curr.totalTimeSeconds, 0);
  const avgTimePerQ = totalQuestions > 0 ? (totalTime / totalQuestions).toFixed(1) : '0';

  // Topic Analysis (Premium)
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  // Group History by Topic -> SubTopic
  const topicTree: Record<string, Record<string, MCQResult[]>> = {};
  history.forEach(h => {
      const topic = h.subjectName || 'General';
      // Subtopic is chapterTitle in this context
      const subtopic = h.chapterTitle || 'Miscellaneous';

      if (!topicTree[topic]) topicTree[topic] = {};
      if (!topicTree[topic][subtopic]) topicTree[topic][subtopic] = [];

      topicTree[topic][subtopic].push(h);
  });

  // --- REVISION LOGIC CONFIG (DYNAMIC THRESHOLDS) ---
  const revisionConfig = settings?.revisionConfig;
  const thresholds = revisionConfig?.thresholds || { strong: 80, average: 50 }; // Default as per previous logic

  // Trend Analysis (Last 10 tests)
    const trendData = history
        .slice(0, 10)
        .reverse() // Oldest to newest
        .map(h => ({
            date: new Date(h.date).toLocaleDateString(undefined, {day: 'numeric', month: 'short'}),
            score: h.totalQuestions > 0 ? Math.round((h.correctCount / h.totalQuestions) * 100) : 0,
            fullDate: new Date(h.date).toLocaleDateString(),
            topic: h.chapterTitle || 'General Test'
        }));

  // Categorized Analysis
  const categorizedHistory = {
      strong: history.filter(h => h.totalQuestions > 0 && ((h.correctCount / h.totalQuestions) * 100) >= thresholds.strong),
      average: history.filter(h => h.totalQuestions > 0 && ((h.correctCount / h.totalQuestions) * 100) >= thresholds.average && ((h.correctCount / h.totalQuestions) * 100) < thresholds.strong),
      weak: history.filter(h => h.totalQuestions > 0 && ((h.correctCount / h.totalQuestions) * 100) < thresholds.average)
  };

  const getTagColor = (tag: PerformanceTag) => {
      switch(tag) {
          case 'EXCELLENT': return 'bg-green-100 text-green-700 border-green-200';
          case 'GOOD': return 'bg-blue-100 text-blue-700 border-blue-200';
          case 'BAD': return 'bg-orange-100 text-orange-700 border-orange-200';
          case 'VERY_BAD': return 'bg-red-100 text-red-700 border-red-200';
          default: return 'bg-slate-100 text-slate-600';
      }
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-24 animate-in fade-in slide-in-from-right">
        {selectedResult && (
            <MarksheetCard 
                result={selectedResult} 
                user={user} 
                settings={settings}
                onClose={() => setSelectedResult(null)} 
                questions={selectedQuestions}
                initialView={initialView}
            />
        )}
        
        {/* HEADER */}
        <div className="bg-white p-4 shadow-sm border-b border-slate-200 sticky top-0 z-10 flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full"><TrendingUp size={20} className="text-slate-600" /></button>
            <div>
                <h2 className="text-xl font-black text-slate-800">Annual Report</h2>
                <p className="text-xs text-slate-500 font-bold uppercase">Performance Analytics (Last 30 Days)</p>
            </div>
        </div>

        <div className="p-4 space-y-6">
            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><CheckCircle size={18} /></div>
                        <span className="text-xs font-bold text-slate-400 uppercase">Accuracy</span>
                    </div>
                    <p className="text-2xl font-black text-slate-800">{accuracy}%</p>
                    <p className="text-[10px] text-slate-400">{totalCorrect}/{totalQuestions} Correct</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-purple-100 rounded-lg text-purple-600"><Clock size={18} /></div>
                        <span className="text-xs font-bold text-slate-400 uppercase">Speed</span>
                    </div>
                    <p className="text-2xl font-black text-slate-800">{avgTimePerQ}s</p>
                    <p className="text-[10px] text-slate-400">Avg per Question</p>
                </div>
            </div>

            {/* PERFORMANCE TREND (Professional Progress Bars) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <TrendingUp size={18} className="text-blue-500" /> Performance Trend
                </h3>
                {trendData.length === 0 ? (
                    <p className="text-slate-400 text-sm text-center py-4">Take tests to see your progress.</p>
                ) : (
                    <div className="space-y-4">
                        {trendData.map((d, i) => (
                            <div key={i} className="group">
                                <div className="flex justify-between items-center mb-1.5">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${d.score >= 80 ? 'bg-green-500' : d.score >= 50 ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-bold text-slate-700 truncate line-clamp-1">{d.topic}</span>
                                            <span className="text-[9px] text-slate-400 font-medium">{d.date}</span>
                                        </div>
                                    </div>
                                    <span className={`text-xs font-black shrink-0 ${d.score >= 80 ? 'text-green-600' : d.score >= 50 ? 'text-blue-600' : 'text-red-600'}`}>
                                        {d.score}%
                                    </span>
                                </div>
                                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex items-center relative">
                                    {/* 100% Marker Line */}
                                    <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-slate-300 z-10"></div>
                                    
                                    <div 
                                        className={`h-full transition-all duration-1000 rounded-full relative ${
                                            d.score >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 
                                            d.score >= 50 ? 'bg-gradient-to-r from-blue-500 to-cyan-400' : 
                                            'bg-gradient-to-r from-red-500 to-orange-400'
                                        }`} 
                                        style={{ width: `${d.score}%` }}
                                    >
                                        {/* Glow effect for professional look */}
                                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div className="pt-2 border-t border-slate-50 flex justify-between items-center text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                            <span>Last 10 Tests</span>
                            <span>Target: 100%</span>
                        </div>
                    </div>
                )}
            </div>

            {/* RECENT TESTS */}
            <div>
                <h3 className="font-bold text-slate-800 mb-3 px-1 flex items-center gap-2">
                    <Calendar size={18} className="text-slate-400" /> Recent Tests
                </h3>
                <div className="space-y-3">
                    {history.length === 0 && <p className="text-slate-400 text-sm text-center py-8 bg-white rounded-xl border border-dashed">No tests taken yet.</p>}
                    {(showMoreTests ? history : history.slice(0, 10)).map((item) => (
                        <div 
                            key={item.id} 
                            className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3 group"
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">{item.chapterTitle}</h4>
                                    <p className="text-xs text-slate-500">{item.subjectName} • {new Date(item.date).toLocaleDateString()}</p>
                                </div>
                                <div className={`px-2 py-1 rounded text-[10px] font-black border ${getTagColor(item.performanceTag)}`}>
                                    {item.performanceTag.replace('_', ' ')}
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded-lg">
                                <div className="text-center flex-1 border-r border-slate-200">
                                    <p className="text-slate-400 font-bold uppercase text-[9px]">Score</p>
                                    <p className="font-black text-slate-700">{item.score}/{item.totalQuestions}</p>
                                </div>
                                <div className="text-center flex-1 border-r border-slate-200">
                                    <p className="text-slate-400 font-bold uppercase text-[9px]">Avg Time</p>
                                    <p className="font-black text-slate-700">{item.averageTimePerQuestion.toFixed(1)}s</p>
                                </div>
                                <div className="text-center flex-1">
                                    <p className="text-slate-400 font-bold uppercase text-[9px]">Total Time</p>
                                    <p className="font-black text-slate-700">{Math.floor(item.totalTimeSeconds/60)}m {item.totalTimeSeconds%60}s</p>
                                </div>
                            </div>
                            
                            <div className="flex justify-end mt-2">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenMarksheet(item, 'ANALYSIS');
                                    }}
                                    className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                                >
                                    <FileText size={14} /> Details
                                </button>
                            </div>
                        </div>
                    ))}


                    {!showMoreTests && history.length > 10 && (
                        <button
                            onClick={() => setShowMoreTests(true)}
                            className="w-full py-3 bg-slate-50 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-100 transition-colors mt-4 border border-dashed border-slate-300"
                        >
                            More
                        </button>
                    )}

                </div>
            </div>
        </div>
    </div>
  );
};
