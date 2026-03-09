import { safeSetLocalStorage, saveUserLocal } from '../utils/safeStorage';

import React, { useState, useEffect } from 'react';
import { Chapter, User, Subject, SystemSettings, MCQResult, PerformanceTag } from '../types';
import { CheckCircle, Lock, ArrowLeft, Crown, PlayCircle, HelpCircle, Trophy, Clock, BrainCircuit, FileText } from 'lucide-react';
import { checkFeatureAccess } from '../utils/permissionUtils';
import { CustomAlert, CustomConfirm } from './CustomDialogs';
import { getChapterData, saveUserToLive, saveUserHistory, savePublicActivity } from '../firebase';
import { generateLocalAnalysis, generateAnalysisJson } from '../utils/analysisUtils';
import { LessonView } from './LessonView'; 
import { MarksheetCard } from './MarksheetCard';
import { AiInterstitial } from './AiInterstitial';

interface Props {
  chapter: Chapter;
  subject: Subject;
  user: User;
  board: string;
  classLevel: string;
  stream: string | null;
  onBack: () => void;
  onUpdateUser: (user: User) => void;
  settings?: SystemSettings; // New Prop
  topicFilter?: string; // NEW: Filter by Topic
}

export const McqView: React.FC<Props> = ({ 
  chapter, subject, user, board, classLevel, stream, onBack, onUpdateUser, settings, topicFilter
}) => {
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'SELECTION' | 'PRACTICE' | 'TEST'>('SELECTION');
  const [lessonContent, setLessonContent] = useState<any>(null); // To pass to LessonView
  const [resultData, setResultData] = useState<MCQResult | null>(null);
  const [completedMcqData, setCompletedMcqData] = useState<any[]>([]); // Store used data for analysis
  
  // Custom Dialog State
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, message: string, title?: string}>({isOpen: false, message: ''});
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({isOpen: false, title: '', message: '', onConfirm: () => {}});
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [showMoreHistory, setShowMoreHistory] = useState(false);

  // Interstitial State
  const [showInterstitial, setShowInterstitial] = useState(false);
  const [pendingStart, setPendingStart] = useState<{mode: 'PRACTICE' | 'TEST', data: any} | null>(null);

  // Topic Selector State
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);

  // NEW: MCQ Mode State (Free vs Premium Experience)
  const [mcqMode, setMcqMode] = useState<'FREE' | 'PREMIUM'>('FREE');

  // Load topics on mount if content exists locally or via minimal fetch
  // Screen Wake Lock for MCQ Test
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err: any) {
        console.warn(`Wake Lock error: ${err?.name}, ${err?.message}`);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock !== null) {
        wakeLock.release().catch(console.error);
      }
    };
  }, []);

  useEffect(() => {
      // Helper to extract unique topics from chapter data (optimistic)
      const streamKey = (classLevel === '11' || classLevel === '12') && stream ? `-${stream}` : '';
      const key = `nst_content_${board}_${classLevel}${streamKey}_${subject.name}_${chapter.id}`;
      const stored = localStorage.getItem(key);
      if (stored) {
          try {
              const data = JSON.parse(stored);
              if (data.manualMcqData) {
                  const topics = Array.from(new Set(data.manualMcqData.map((q: any) => q.topic).filter(Boolean))) as string[];
                  setAvailableTopics(topics);
              }
          } catch(e) {}
      }
  }, [board, classLevel, stream, subject, chapter]);

  const handleStart = async (mode: 'PRACTICE' | 'TEST') => {
      // DAILY LIMIT CHECK
      if (user.role !== 'ADMIN') {
          const todayStr = new Date().toDateString();
          const solvedToday = (user.mcqHistory || [])
              .filter(h => new Date(h.date).toDateString() === todayStr)
              .reduce((sum, h) => sum + h.totalQuestions, 0);

          const mcqFeature = settings?.featureConfig?.['MCQ_FREE'];
          let dailyLimit = mcqFeature?.limits?.free ?? settings?.mcqLimitFree ?? 30;
          if (user.subscriptionLevel === 'BASIC') dailyLimit = mcqFeature?.limits?.basic ?? settings?.mcqLimitBasic ?? 50;
          if (user.subscriptionLevel === 'ULTRA') dailyLimit = mcqFeature?.limits?.ultra ?? settings?.mcqLimitUltra ?? 100;

          if (solvedToday >= dailyLimit) {
              setAlertConfig({
                  isOpen: true,
                  title: "Daily Limit Reached",
                  message: `You have reached your daily limit of ${dailyLimit} questions.\n\n${user.subscriptionLevel === 'ULTRA' ? 'Come back tomorrow!' : 'Upgrade plan to increase limit!'}`
              });
              return;
          }
      }

      // 1. Fetch Data First (To avoid charging for empty chapters)
      setLoading(true);
      
      // STRICT KEY MATCHING WITH ADMIN
      const streamKey = (classLevel === '11' || classLevel === '12') && stream ? `-${stream}` : '';
      const key = `nst_content_${board}_${classLevel}${streamKey}_${subject.name}_${chapter.id}`;
      
      let data = null;
      try {
          // Race Firebase against a 2.5s timeout to prevent hanging on slow/offline networks
          const fetchWithTimeout = (promise: Promise<any>, ms: number) => 
              Promise.race([
                  promise, 
                  new Promise((_, reject) => setTimeout(() => reject("timeout"), ms))
              ]);
          
          data = await fetchWithTimeout(getChapterData(key), 2500);
      } catch (e) {
          console.warn("Firebase fetch timed out or failed, falling back to local storage.");
      }

      if (!data) {
          const stored = localStorage.getItem(key);
          if (stored) data = JSON.parse(stored);
      }

      // Handle Empty Content
      if (!data || !data.manualMcqData || data.manualMcqData.length === 0) {
          // Show "Coming Soon" screen instead of alert
          const content = {
              id: Date.now().toString(),
              title: chapter.title,
              subtitle: 'Coming Soon',
              content: '', 
              type: 'MCQ_SIMPLE',
              isComingSoon: true, // New Flag
              dateCreated: new Date().toISOString(),
              subjectName: subject.name,
              mcqData: null
          };
          setLessonContent(content);
          setViewMode(mode);
          setLoading(false);
          return;
      }

      // DETERMINING MCQ MODE & COST
      // Logic:
      // - If mode is TEST -> Premium Test (New Experience). Requires Premium Sub OR Cost.
      // - If mode is PRACTICE -> Free Practice (Old Experience). Free.
      // NOTE: "pahle wala primimum mcq ab upgrade hoga ... aur free wala mcq banane pe analysis jo free hai ushka cradit lagega 20"
      
      let finalMode: 'FREE' | 'PREMIUM' = 'FREE';
      let cost = 0;

      if (mode === 'TEST') {
          // Premium Test Mode
          finalMode = 'PREMIUM';

          // Use App Soul for Cost & Access
          const access = checkFeatureAccess('MCQ_PREMIUM', user, settings || {});

          if (!access.hasAccess) {
             // If locked (either by Tier or explicit Lock)
             // If cost > 0, it means pay-per-view
             if (access.cost > 0) {
                 cost = access.cost;
             } else {
                 setAlertConfig({isOpen: true, title: "Locked Feature", message: access.reason === 'FEED_LOCKED' ? "Disabled by Admin." : "Upgrade your plan to access Premium Tests."});
                 setLoading(false);
                 return;
             }
          } else {
             // Granted Access (Subscription or Free Tier)
             // Check if there is still a cost (rare, but possible if configured)
             cost = access.cost;
          }

          if (user.credits < cost) {
              setAlertConfig({isOpen: true, title: "Low Balance", message: `Insufficient Credits for Premium Test! You need ${cost} coins.`});
              setLoading(false);
              return;
          }

      } else {
          // Free Practice Mode
          finalMode = 'FREE';
          cost = 0;
      }

      // Confirmation for Cost (if any)
      if (cost > 0) {
          setConfirmConfig({
              isOpen: true,
              title: "Start Premium Test",
              message: `Start Premium Test for ${cost} Coins?\nIncludes Instant Explanations & TTS.`,
              onConfirm: () => {
                  const updatedUser = { ...user, credits: user.credits - cost };
                  saveUserLocal(updatedUser);
                  saveUserToLive(updatedUser);
                  onUpdateUser(updatedUser);
                  setConfirmConfig(prev => ({...prev, isOpen: false}));

                  // Set Mode and Start
                  setMcqMode('PREMIUM');
                  triggerMcqStart(mode, data);
              }
          });
          setLoading(false);
          return;
      }
      
      setMcqMode(finalMode);
      triggerMcqStart(mode, data);
  };

  const triggerMcqStart = (mode: 'PRACTICE' | 'TEST', data: any) => {
    // 1. Process Questions (Filter, Shuffle & Slice based on Tier)
    let processedQuestions = [...(data.manualMcqData || [])];

    // TOPIC FILTER (Priority: Prop Filter > Selected Dropdown)
    const activeFilter = topicFilter || selectedTopic;
    if (activeFilter) {
        processedQuestions = processedQuestions.filter((q: any) => q.topic === activeFilter);
        if (processedQuestions.length === 0) {
            setAlertConfig({isOpen: true, title: "No Questions", message: `No questions found for topic: ${activeFilter}`});
            setLoading(false);
            return;
        }
    }
    
    // Shuffle Questions (Fisher-Yates)
    for (let i = processedQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [processedQuestions[i], processedQuestions[j]] = [processedQuestions[j], processedQuestions[i]];
    }

    // Apply Tier Limits (Per Test Limit)
    // Free: 30, Basic: 50, Ultra: All
    const mcqFeature = settings?.featureConfig?.['MCQ_FREE'];
    let questionLimit = mcqFeature?.limits?.free ?? settings?.mcqLimitFree ?? 30;
    if (user.subscriptionLevel === 'BASIC') questionLimit = mcqFeature?.limits?.basic ?? settings?.mcqLimitBasic ?? 50;
    if (user.subscriptionLevel === 'ULTRA') questionLimit = mcqFeature?.limits?.ultra ?? settings?.mcqLimitUltra ?? 999999;

    // Admin Override
    if (user.role === 'ADMIN') questionLimit = 999999;

    processedQuestions = processedQuestions.slice(0, questionLimit);

    // Update data object with processed questions
    const processedData = {
        ...data,
        manualMcqData: processedQuestions
    };

    setPendingStart({mode, data: processedData});
    setShowInterstitial(true);
  };

  const handleInterstitialComplete = () => {
    setShowInterstitial(false);
    if (pendingStart) {
        proceedWithStart(pendingStart.mode, pendingStart.data);
        setPendingStart(null);
    }
  };

  const proceedWithStart = (mode: 'PRACTICE' | 'TEST', data: any) => {

      // SHUFFLE & LIMIT QUESTIONS
      const rawMcqData = data.manualMcqData || [];
      const rawMcqDataHi = data.manualMcqData_HI || [];
      const hasHindi = rawMcqDataHi.length === rawMcqData.length && rawMcqData.length > 0;

      // 1. Create Index Array
      const indices = Array.from({ length: rawMcqData.length }, (_, i) => i);

      // 2. Fisher-Yates Shuffle
      for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      // 3. Determine Limit based on Tier
      const mcqFeature = settings?.featureConfig?.['MCQ_FREE'];
      let limit = mcqFeature?.limits?.free ?? settings?.mcqLimitFree ?? 30; // Default Free

      if (user.role === 'ADMIN') {
          limit = 9999;
      } else if (user.subscriptionTier && user.subscriptionTier !== 'FREE') {
          if (user.subscriptionLevel === 'ULTRA') limit = mcqFeature?.limits?.ultra ?? settings?.mcqLimitUltra ?? 9999;
          else limit = mcqFeature?.limits?.basic ?? settings?.mcqLimitBasic ?? 50; // Basic Limit
      }

      // 4. Slice & Select
      const finalIndices = indices.slice(0, limit);
      const finalMcqData = finalIndices.map(i => rawMcqData[i]);
      const finalMcqDataHi = hasHindi ? finalIndices.map(i => rawMcqDataHi[i]) : undefined;

      // Prepare LessonContent object for the existing LessonView component
      const content = {
          id: Date.now().toString(),
          title: chapter.title,
          subtitle: mode === 'TEST' ? 'Premium Test Mode' : 'Free Practice Mode',
          content: '', // Not used for MCQ
          type: 'MCQ_ANALYSIS', // Always allow analysis flow
          dateCreated: new Date().toISOString(),
          subjectName: subject.name,
          mcqData: finalMcqData,
          manualMcqData_HI: finalMcqDataHi
      };
      
      setLessonContent(content);
      setViewMode(mode);
      setLoading(false);
  };

  const handleMCQComplete = (score: number, answers: Record<number, number>, usedData: any[], timeTaken: number, timePerQuestion?: Record<number, number>) => {
      // 1. FILTER & REMAP DATA (Strict Requirement: Only show attempted questions)
      const answeredIndices = Object.keys(answers).map(Number).sort((a,b) => a - b);
      
      // Create the subset of questions
      const submittedQuestions = answeredIndices.map(idx => usedData[idx]);
      
      // Remap answers to the new indices (0, 1, 2...) AND Time Data
      const remappedAnswers: Record<number, number> = {};
      const remappedTime: Record<number, number> = {};

      answeredIndices.forEach((oldIdx, newIdx) => {
          remappedAnswers[newIdx] = answers[oldIdx];
          if (timePerQuestion && timePerQuestion[oldIdx] !== undefined) {
              remappedTime[newIdx] = timePerQuestion[oldIdx];
          }
      });

      // 2. Calculate Analytics
      const attemptsCount = answeredIndices.length; // Should match Object.keys(answers).length
      const averageTime = attemptsCount > 0 ? timeTaken / attemptsCount : 0;
      let performanceTag: PerformanceTag = 'VERY_BAD';
      if (averageTime <= 15) performanceTag = 'EXCELLENT';
      else if (averageTime <= 30) performanceTag = 'GOOD';
      else if (averageTime <= 45) performanceTag = 'BAD';

      // Build OMR Data (Using remapped indices and submittedQuestions)
      const omrData = submittedQuestions.map((q, idx) => ({
          qIndex: idx,
          selected: remappedAnswers[idx] !== undefined ? remappedAnswers[idx] : -1,
          correct: q.correctAnswer,
          timeSpent: remappedTime[idx] || 0 // Store per-question time
      }));

      // Build Wrong Questions List (Strictly Incorrect Attempts)
      const wrongQuestions = submittedQuestions
        .map((q, idx) => {
            const selected = remappedAnswers[idx] !== undefined ? remappedAnswers[idx] : -1;
            // Filter: Must be attempted (not -1) AND wrong
            if (selected !== -1 && selected !== q.correctAnswer) {
                return {
                    question: q.question,
                    qIndex: idx,
                    correctAnswer: q.correctAnswer,
                    explanation: q.explanation,
                    concept: q.concept,
                    examTip: q.examTip,
                    commonMistake: q.commonMistake,
                    mnemonic: q.mnemonic
                };
            }
            return null;
        })
        .filter((item): item is { question: string; qIndex: number, correctAnswer: number, explanation?: string, concept?: string, examTip?: string, commonMistake?: string, mnemonic?: string } => item !== null);

      // Performance Label based on marks (Excllent, Good, Average, Bad)
      const scorePct = (score / attemptsCount) * 100;
      let perfLabel = "Bad";
      if (scorePct >= 90) perfLabel = "Excellent";
      else if (scorePct >= 75) perfLabel = "Good";
      else if (scorePct >= 50) perfLabel = "Average";

      // 3. Prepare Result Object
      const analysisJson = generateAnalysisJson(submittedQuestions, remappedAnswers, user.mcqHistory, chapter.id);

      // Generate Granular Topic Analysis for History Comparison
      const topicAnalysis: Record<string, { correct: number, total: number, percentage: number }> = {};
      submittedQuestions.forEach((q, idx) => {
          const t = (q.topic || 'General').trim();
          if (!topicAnalysis[t]) topicAnalysis[t] = { correct: 0, total: 0, percentage: 0 };

          topicAnalysis[t].total += 1;
          if (remappedAnswers[idx] === q.correctAnswer) {
              topicAnalysis[t].correct += 1;
          }
      });
      // Calculate Percentages
      Object.keys(topicAnalysis).forEach(t => {
          const s = topicAnalysis[t];
          s.percentage = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
      });

      const result: MCQResult = {
          id: `res-${Date.now()}`,
          userId: user.id,
          chapterId: chapter.id,
          subjectId: subject.id,
          subjectName: subject.name,
          chapterTitle: chapter.title,
          date: new Date().toISOString(),
          totalQuestions: submittedQuestions.length, // Only attempted count
          correctCount: score,
          wrongCount: attemptsCount - score,
          score: score,
          totalTimeSeconds: timeTaken,
          averageTimePerQuestion: averageTime,
          performanceTag: performanceTag, // Use calculated tag, or align types
          classLevel: classLevel,
          omrData: omrData,
          wrongQuestions: wrongQuestions,
          questionTimes: Object.values(remappedTime),
          topic: topicFilter, // Save topic if filtered
          ultraAnalysisReport: analysisJson,
          topicAnalysis: topicAnalysis // NEW: Enable Per-Topic Comparison
      };

      // 4. Update User Data
      let updatedUser = { ...user };

      // PRIZE LOGIC (SYLLABUS_MCQ)
      if (settings?.prizeRules) {
          const percentage = (score / attemptsCount) * 100;
          const eligibleRules = settings.prizeRules
              .filter(r => r.enabled && r.category === 'SYLLABUS_MCQ')
              .filter(r => attemptsCount >= r.minQuestions && percentage >= r.minPercentage)
              .sort((a, b) => b.minPercentage - a.minPercentage);

          const bestRule = eligibleRules[0];
          if (bestRule) {
              if (bestRule.rewardType === 'COINS') {
                  updatedUser.credits = (updatedUser.credits || 0) + (bestRule.rewardAmount || 0);
                  setAlertConfig({isOpen: true, title: "Reward Unlocked!", message: `🏆 ${bestRule.label}\n\nYou earned ${bestRule.rewardAmount} Coins!`});
              } else if (bestRule.rewardType === 'SUBSCRIPTION') {
                  const duration = bestRule.rewardDurationHours || 24;
                  const endDate = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString();
                  updatedUser = { 
                      ...updatedUser, 
                      subscriptionTier: bestRule.rewardSubTier || 'WEEKLY',
                      subscriptionLevel: bestRule.rewardSubLevel || 'BASIC',
                      subscriptionEndDate: endDate,
                      grantedByAdmin: true,
                      isPremium: true
                  };
                  setAlertConfig({isOpen: true, title: "Reward Unlocked!", message: `🏆 ${bestRule.label}\n\nYou earned free subscription!`});
              }
          }
      }
      
      // 4.1 Topic Strength Tracking
      if (!updatedUser.topicStrength) updatedUser.topicStrength = {};

      // A) Update overall Subject Strength
      const currentStrength = updatedUser.topicStrength[subject.name] || { correct: 0, total: 0 };
      updatedUser.topicStrength[subject.name] = {
          correct: currentStrength.correct + score,
          total: currentStrength.total + attemptsCount
      };

      // B) Update Granular Topic Strength (if topics exist in questions)
      submittedQuestions.forEach((q, idx) => {
          const topicKey = (q.topic || 'General').trim();
          const topicStats = updatedUser.topicStrength![topicKey] || { correct: 0, total: 0 };

          const isCorrect = remappedAnswers[idx] === q.correctAnswer;

          updatedUser.topicStrength![topicKey] = {
              correct: topicStats.correct + (isCorrect ? 1 : 0),
              total: topicStats.total + 1
          };
      });

      // 4.2 Add to History
      const newHistory = [result, ...(updatedUser.mcqHistory || [])];
      updatedUser.mcqHistory = newHistory;

      // 4.3 Progress Logic
      if (!updatedUser.progress) updatedUser.progress = {};
      const subjectId = subject.id;
      let progress = updatedUser.progress[subjectId] || { currentChapterIndex: 0, totalMCQsSolved: 0 };
      progress.totalMCQsSolved += attemptsCount;

      const threshold = settings?.mcqUnlockThreshold || 100;
      let leveledUp = false;

      if (progress.totalMCQsSolved >= threshold) {
          progress.currentChapterIndex += 1;
          progress.totalMCQsSolved = progress.totalMCQsSolved - threshold;
          leveledUp = true;
      }
      updatedUser.progress[subjectId] = progress;

      // 5. Save & Sync
      onUpdateUser(updatedUser); 
      saveUserLocal(updatedUser);
      saveUserToLive(updatedUser);
      
      // 6. Save detailed attempt to Legacy Local History & Firebase (Only attempted questions)
      const resultDataToSet = result; // Keep reference
      
      const newHistoryItem = {
          ...lessonContent,
          mcqData: submittedQuestions, // Save only subset
          id: `mcq-history-${Date.now()}`,
          dateCreated: new Date().toISOString(),
          score: score,
          totalQuestions: submittedQuestions.length,
          userAnswers: remappedAnswers, // Save remapped answers
          analytics: result 
      };
      
      const existingHistoryStr = localStorage.getItem('nst_user_history');
      let history = existingHistoryStr ? JSON.parse(existingHistoryStr) : [];
      history.push(newHistoryItem);
      safeSetLocalStorage('nst_user_history', JSON.stringify(history));

      // Sync to Firebase (with Offline Fallback)
      try {
          if (navigator.onLine) {
              saveUserHistory(user.id, newHistoryItem);
          } else {
              throw new Error("Offline");
          }
      } catch (e) {
          console.log("Offline or Error saving history. Queuing for sync.");
          const pending = JSON.parse(localStorage.getItem('nst_pending_sync_results') || '[]');
          pending.push({ userId: user.id, data: newHistoryItem, type: 'HISTORY' });
          safeSetLocalStorage('nst_pending_sync_results', JSON.stringify(pending));
      }

      if (leveledUp) {
          setAlertConfig({isOpen: true, title: "Level Up!", message: `🎉 Congratulations! You cleared ${threshold} MCQs.\n\n🔓 Next Chapter Unlocked!`});
      }
      
      // Store data for analysis view (Fallback to usedData if filtered set is empty to ensure AI Analysis has data)
      if (submittedQuestions.length > 0) {
          setCompletedMcqData(submittedQuestions);
      } else {
          setCompletedMcqData(usedData);
      }

      // Show Marksheet and exit MCQ view
      setResultData(resultDataToSet);
      setViewMode('SELECTION');
  };

  const handleViewAnalysis = () => {
      setShowAnalysisModal(true);
  };

  const handleFreeAnalysis = () => {
      // NEW COST LOGIC FOR FREE ANALYSIS controlled by App Soul (MCQ_FREE cost)
      if (mcqMode === 'FREE') {
          const access = checkFeatureAccess('MCQ_FREE', user, settings || {});
          // If a cost is configured in Soul for MCQ_FREE, use it for analysis unlock
          const cost = access.cost > 0 ? access.cost : 20; // Default to 20 if 0 (backward compat) OR assume 0 means free?
          // User request: "analysis jo free hai ushka cradit lagega 20".
          // If App Soul sets it to 0, maybe it should be free?
          // But strict reading implies manual control. Let's trust App Soul cost if > 0.

          if (cost > 0) {
              if (user.credits < cost) {
                  setAlertConfig({isOpen: true, title: "Low Balance", message: `Analysis costs ${cost} Coins!`});
                  return;
              }

              setConfirmConfig({
                  isOpen: true,
                  title: "Unlock Analysis",
                  message: `Unlock answers & mistakes for ${cost} Coins?`,
                  onConfirm: () => {
                      const updatedUser = { ...user, credits: user.credits - cost };
                      saveUserLocal(updatedUser);
                      saveUserToLive(updatedUser);
                      onUpdateUser(updatedUser);
                      setConfirmConfig(prev => ({...prev, isOpen: false}));
                      proceedToAnalysis('FREE');
                  }
              });
          } else {
             proceedToAnalysis('FREE');
          }
      } else {
          // Premium users (Premium Mode) already paid or have access
          proceedToAnalysis('FREE');
      }
  };

  const proceedToAnalysis = (type: 'FREE' | 'PREMIUM', aiText?: string) => {
      const userAnswers = resultData?.omrData?.reduce((acc: any, curr) => {
          acc[curr.qIndex] = curr.selected;
          return acc;
      }, {}) || {};

      const currentResult = resultData; // Capture current result

      setShowAnalysisModal(false);

      const analysisContent = {
          ...lessonContent,
          id: `analysis-${Date.now()}`,
          type: 'MCQ_ANALYSIS',
          mcqData: completedMcqData,
          userAnswers: userAnswers,
          analysisType: type,
          aiAnalysisText: aiText,
          topic: topicFilter || selectedTopic, // Pass Topic
          analytics: currentResult // PASS RESULT OBJECT
      };
      
      setResultData(null);
      setLessonContent(analysisContent);
      setViewMode('TEST');
  }

  const handlePremiumAnalysis = () => {
      const cost = settings?.mcqAnalysisCostUltra ?? 20;
      
      if (user.credits < cost) {
          setAlertConfig({isOpen: true, title: "Low Balance", message: `Insufficient Credits! You need ${cost} coins.`});
          return;
      }

      setConfirmConfig({
          isOpen: true,
          title: "Unlock Premium Analysis",
          message: `Pay ${cost} Coins to unlock detailed AI Analysis & Premium Notes?`,
          onConfirm: () => {
              // Deduct Credits
              const updatedUser = { ...user, credits: user.credits - cost };
              saveUserLocal(updatedUser);
              saveUserToLive(updatedUser);
              onUpdateUser(updatedUser);

              // Generate Analysis
              const userAnswers = resultData?.omrData?.reduce((acc: any, curr) => {
                  acc[curr.qIndex] = curr.selected;
                  return acc;
              }, {}) || {};

              const analysisText = generateLocalAnalysis(
                  completedMcqData,
                  userAnswers,
                  resultData?.score || 0,
                  resultData?.totalQuestions || 0,
                  chapter.title,
                  subject.name
              );

              setConfirmConfig(prev => ({...prev, isOpen: false}));
              proceedToAnalysis('PREMIUM', analysisText);
          }
      });
  };

  const handlePublishResult = () => {
      if (!resultData) return;
      const percentage = Math.round((resultData.score / resultData.totalQuestions) * 100);
      const activity = {
          id: resultData.id,
          userId: user.id,
          userName: user.name,
          testName: resultData.chapterTitle,
          score: resultData.score,
          total: resultData.totalQuestions,
          percentage: percentage,
          timestamp: new Date().toISOString()
      };
      savePublicActivity(activity);
      setAlertConfig({isOpen: true, title: "Success", message: "Result published!"});
  };

  return (
    <>
       {resultData && (
           <div className="fixed inset-0 z-[200]">
               <MarksheetCard
                   result={resultData}
                   user={user}
                   settings={settings}
                   onClose={() => {
                       setResultData(null);
                       setViewMode('SELECTION');
                   }}
                   onViewAnalysis={handleViewAnalysis}
                   onPublish={handlePublishResult}
                   questions={completedMcqData}
                   onUpdateUser={onUpdateUser}
                   mcqMode={mcqMode}
               />
           </div>
       )}

       <CustomAlert 
           isOpen={alertConfig.isOpen} 
           title={alertConfig.title} 
           message={alertConfig.message} 
           onClose={() => setAlertConfig({...alertConfig, isOpen: false})} 
       />
       <CustomConfirm
           isOpen={confirmConfig.isOpen}
           title={confirmConfig.title}
           message={confirmConfig.message}
           onConfirm={confirmConfig.onConfirm}
           onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})}
       />

       {viewMode !== 'SELECTION' && lessonContent ? (
          <LessonView
              content={lessonContent}
              subject={subject}
              classLevel={classLevel as any}
              chapter={chapter}
              loading={false}
              onBack={() => setViewMode('SELECTION')}
              onMCQComplete={handleMCQComplete}
              user={user}
              onUpdateUser={onUpdateUser}
              settings={settings}
              instantExplanation={mcqMode === 'PREMIUM'}
              onShowMarksheet={(result) => {
                  if (result) {
                      setResultData(result);
                      // Don't change viewMode, let MarksheetCard overlay handle it
                  }
              }}
          />
       ) : (
        <div className="bg-white min-h-screen pb-20 animate-in fade-in slide-in-from-right-8">
           {/* HEADER */}
           <div className="sticky top-0 z-20 bg-white border-b border-slate-100 shadow-sm p-4 flex items-center gap-3">
           <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
               <ArrowLeft size={20} />
           </button>
           <div className="flex-1">
               <h3 className="font-bold text-slate-800 leading-tight line-clamp-1">
                   {topicFilter ? `${topicFilter} (Topic)` : chapter.title}
               </h3>
               <p className="text-xs text-slate-500">{subject.name} • MCQ Center</p>
           </div>
           
           <div className="flex items-center gap-1 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
               <Crown size={14} className="text-blue-600" />
               <span className="font-black text-blue-800 text-xs">{user.credits} CR</span>
           </div>
       </div>

       <div className="p-6 space-y-4">
           {/* TOPIC SELECTOR (NEW) */}
           {availableTopics.length > 0 && !topicFilter && (
               <div className="mb-4">
                   <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Practice Specific Topic</label>
                   <select
                       value={selectedTopic}
                       onChange={(e) => setSelectedTopic(e.target.value)}
                       className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                   >
                       <option value="">All Topics (Mixed)</option>
                       {availableTopics.map(t => (
                           <option key={t} value={t}>{t}</option>
                       ))}
                   </select>
               </div>
           )}

           {/* FREE PRACTICE */}
           {(() => {
               const access = checkFeatureAccess('MCQ_FREE', user, settings || {});
               const isLocked = !access.hasAccess && access.reason === 'FEED_LOCKED';

               return (
                   <button
                       onClick={() => {
                           if (isLocked) {
                               setAlertConfig({isOpen: true, title: "Locked", message: "Free Practice is currently disabled by Admin."});
                               return;
                           }
                           handleStart('PRACTICE');
                       }}
                       disabled={loading}
                       className={`w-full p-6 rounded-3xl border-2 transition-all group text-left relative overflow-hidden ${
                           isLocked
                           ? 'bg-slate-100 border-slate-200 opacity-60 grayscale cursor-not-allowed'
                           : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                       }`}
                   >
                       <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                           <HelpCircle size={80} className="text-blue-600" />
                       </div>
                       <div className="relative z-10">
                           <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4 relative">
                               <CheckCircle size={24} />
                               {isLocked && <div className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full"><Lock size={12}/></div>}
                           </div>
                           <h4 className="text-xl font-black text-slate-800 mb-1">Free Practice</h4>
                           <p className="text-sm text-slate-500 mb-4">
                               {user.subscriptionTier !== 'FREE' ? 'Unlimited Standard Practice' : 'Basic practice mode. Analysis costs 20 Coins.'}
                           </p>
                           <span className={`px-4 py-2 rounded-lg text-xs font-bold shadow-lg ${isLocked ? 'bg-slate-400 text-white' : 'bg-blue-600 text-white shadow-blue-200'}`}>
                               {isLocked ? 'LOCKED' : 'START NOW'}
                           </span>
                       </div>
                   </button>
               );
           })()}

           {/* PREMIUM TEST */}
           {(() => {
               const access = checkFeatureAccess('MCQ_PREMIUM', user, settings || {});
               // If strict feed lock, hide or lock visually. If pay-per-view, show cost.
               const isLocked = !access.hasAccess && access.reason === 'FEED_LOCKED';
               const cost = access.cost > 0 ? access.cost : (settings?.mcqTestCost || 0);

               return (
                   <button
                       onClick={() => handleStart('TEST')}
                       disabled={loading}
                       className={`w-full p-6 rounded-3xl border-2 transition-all group text-left relative overflow-hidden ${
                           isLocked
                           ? 'bg-slate-100 border-slate-200 opacity-60 grayscale cursor-not-allowed'
                           : 'bg-white border-slate-200 hover:border-purple-300 hover:bg-purple-50'
                       }`}
                   >
                       <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                           <Trophy size={80} className="text-purple-600" />
                       </div>
                       <div className="relative z-10">
                           <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mb-4 relative">
                               <PlayCircle size={24} />
                               {isLocked && <div className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full"><Lock size={12}/></div>}
                           </div>
                           <h4 className="text-xl font-black text-slate-800 mb-1">Premium Test</h4>
                           <p className="text-sm text-slate-500 mb-4">
                               Instant Explanations + Auto-Read + Full Analysis.
                           </p>
                           <div className="flex items-center gap-2">
                               <span className={`px-4 py-2 rounded-lg text-xs font-bold shadow-lg ${isLocked ? 'bg-slate-400 text-white' : 'bg-purple-600 text-white shadow-purple-200'}`}>
                                   {isLocked ? 'LOCKED' : 'START TEST'}
                               </span>
                               {cost > 0 && user.subscriptionTier === 'FREE' && !isLocked && (
                                   <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-1 rounded-full">{cost} CR</span>
                               )}
                           </div>
                       </div>
                   </button>
               );
           })()}
           
           {loading && <div className="text-center py-4 text-slate-500 font-bold animate-pulse">Loading Questions...</div>}
       </div>

       {/* HISTORY & DASHBOARD */}
       <div className="px-6 pb-6 space-y-4">
           {user.mcqHistory && user.mcqHistory.filter(h => h.chapterId === chapter.id).length > 0 && (
               <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
                   <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                       <Clock size={16} /> History & Unlocked
                   </h4>
                   <div className="space-y-2">
                       {(showMoreHistory ? user.mcqHistory.filter(h => h.chapterId === chapter.id) : user.mcqHistory.filter(h => h.chapterId === chapter.id).slice(0, 5)).map((attempt, idx) => (
                           <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                               <div>
                                   <div className="flex items-center gap-2">
                                       <span className={`text-xs font-bold px-2 py-0.5 rounded ${attempt.score/attempt.totalQuestions >= 0.8 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                           {Math.round((attempt.score/attempt.totalQuestions)*100)}%
                                       </span>
                                       <span className="text-xs text-slate-500">{new Date(attempt.date).toLocaleDateString()}</span>
                                   </div>
                               </div>
                               <button
                                   onClick={() => {
                                       setResultData(attempt);
                                       setMcqMode('FREE'); // Default to restricted view for history
                                       // History logic...
                                   }}
                                   className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100"
                               >
                                   View
                               </button>
                           </div>
                       ))}
                   </div>
               </div>
           )}
       </div>
       
       {/* AI INTERSTITIAL */}
       {showInterstitial && (
           <AiInterstitial 
               user={user}
               onComplete={handleInterstitialComplete}
               customImage={pendingStart?.data?.chapterAiImage || settings?.aiLoadingImage}
               contentType="MCQ"
           />
       )}
    </div>
    )}
    </>
  );
};
