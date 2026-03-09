
import React, { useState, useEffect } from 'react';
import { safeSetLocalStorage, saveUserLocal } from '../utils/safeStorage';
import { User, Subject, StudentTab, SystemSettings, CreditPackage, WeeklyTest, Chapter, MCQItem, Challenge20 } from '../types';
import { updateUserStatus, db, saveUserToLive, getChapterData, rtdb, saveAiInteraction, saveDemandRequest, uploadProfilePicture } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { ref, query, limitToLast, onValue } from 'firebase/database';
import { getSubjectsList, DEFAULT_APP_FEATURES, ALL_APP_FEATURES, LEVEL_UNLOCKABLE_FEATURES, LEVEL_UP_CONFIG } from '../constants';
import { ALL_FEATURES } from '../utils/featureRegistry';
import { checkFeatureAccess } from '../utils/permissionUtils';
import { SubscriptionEngine } from '../utils/engines/subscriptionEngine';
import { RewardEngine } from '../utils/engines/rewardEngine';
import { Button } from './ui/Button'; // Design System
import { getActiveChallenges } from '../services/questionBank';
import { generateDailyChallengeQuestions } from '../utils/challengeGenerator';
import { generateMorningInsight } from '../services/morningInsight';
import { LessonActionModal } from './LessonActionModal';
import { RedeemSection } from './RedeemSection';
import { PrizeList } from './PrizeList';
import { Store } from './Store';
import { Globe, Layout, Gift, Sparkles, Megaphone, Lock, BookOpen, AlertCircle, Edit, Settings, Play, Pause, RotateCcw, MessageCircle, Gamepad2, Timer, CreditCard, Send, CheckCircle, Mail, X, Ban, Smartphone, Trophy, ShoppingBag, ArrowRight, Video, Youtube, Home, User as UserIcon, Book, BookOpenText, List, BarChart3, Award, Bell, Headphones, LifeBuoy, WifiOff, Zap, Star, Crown, History, ListChecks, Rocket, Ticket, TrendingUp, BrainCircuit, FileText, CheckSquare, Menu, LayoutGrid, Compass, User as UserIconOutline, MessageSquare, Bot, HelpCircle, Database, Activity, Download, Calendar, LogOut } from 'lucide-react';
import { SubjectSelection } from './SubjectSelection';
import { BannerCarousel } from './BannerCarousel';
import { ChapterSelection } from './ChapterSelection'; // Imported for Video Flow
import { VideoPlaylistView } from './VideoPlaylistView'; // Imported for Video Flow
import { AudioPlaylistView } from './AudioPlaylistView'; // Imported for Audio Flow
import { PdfView } from './PdfView'; // Imported for PDF Flow
import { McqView } from './McqView'; // Imported for MCQ Flow
import { MiniPlayer } from './MiniPlayer'; // Imported for Audio Flow
import { HistoryPage } from './HistoryPage';
import { Leaderboard } from './Leaderboard';
import { SpinWheel } from './SpinWheel';
import { fetchChapters, generateCustomNotes } from '../services/groq'; // Needed for Video Flow
import { LoadingOverlay } from './LoadingOverlay';
import { CreditConfirmationModal } from './CreditConfirmationModal';
import { UserGuide } from './UserGuide';
import { StudentGuide } from './student/StudentGuide'; // NEW
import { CustomAlert } from './CustomDialogs';
import { AnalyticsPage } from './AnalyticsPage';
import { LiveResultsFeed } from './LiveResultsFeed';
// import { ChatHub } from './ChatHub';
import { UniversalInfoPage } from './UniversalInfoPage';
import { UniversalChat } from './UniversalChat';
import { ExpiryPopup } from './ExpiryPopup';
import { SubscriptionHistory } from './SubscriptionHistory';
import { MonthlyMarksheet } from './MonthlyMarksheet';
import { SearchResult } from '../utils/syllabusSearch';
import { AiDeepAnalysis } from './AiDeepAnalysis';
import { RevisionHub } from './RevisionHub'; // NEW
import { AiHub } from './AiHub'; // NEW: AI Hub
import { McqReviewHub } from './McqReviewHub'; // NEW
import { UniversalVideoView } from './UniversalVideoView'; // NEW
import { CustomBloggerPage } from './CustomBloggerPage';
import { ReferralPopup } from './ReferralPopup';
import { StudentAiAssistant } from './StudentAiAssistant';
import { SpeakButton } from './SpeakButton';
import { PerformanceGraph } from './PerformanceGraph';
import { StudentSidebar } from './StudentSidebar';
import { StudyGoalTimer } from './StudyGoalTimer';
import { ExplorePage } from './ExplorePage';
import { StudentHistoryModal } from './StudentHistoryModal';
import { generateDailyRoutine } from '../utils/routineGenerator';
import { FloatingActionMenu } from './FloatingActionMenu';
// @ts-ignore
import jsPDF from 'jspdf';
// @ts-ignore
import html2canvas from 'html2canvas';

interface Props {
  user: User;
  dailyStudySeconds: number; // Received from Global App
  onSubjectSelect: (subject: Subject) => void;
  onRedeemSuccess: (user: User) => void;
  settings?: SystemSettings; // New prop
  onStartWeeklyTest?: (test: WeeklyTest) => void;
  activeTab: StudentTab;
  onTabChange: (tab: StudentTab) => void;
  setFullScreen: (full: boolean) => void; // Passed from App
  onNavigate?: (view: 'ADMIN_DASHBOARD') => void; // Added for Admin Switch
  isImpersonating?: boolean;
  onNavigateToChapter?: (chapterId: string, chapterTitle: string, subjectName: string, classLevel?: string) => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: (v: boolean) => void;
}

const DashboardSectionWrapper = ({
    id,
    children,
    label,
    settings,
    isLayoutEditing,
    onToggleVisibility
}: {
    id: string,
    children: React.ReactNode,
    label: string,
    settings?: SystemSettings,
    isLayoutEditing: boolean,
    onToggleVisibility: (id: string) => void
}) => {
    const isVisible = settings?.dashboardLayout?.[id]?.visible !== false;

    if (!isVisible && !isLayoutEditing) return null;

  return (
        <div className={`relative ${isLayoutEditing ? 'border-2 border-dashed border-yellow-400 p-2 rounded-xl mb-4 bg-yellow-50/10' : ''}`}>
            {isLayoutEditing && (
                <div className="absolute -top-3 left-2 bg-yellow-400 text-black text-[10px] font-bold px-2 py-0.5 rounded shadow z-50 flex items-center gap-2">
                    <span>{label}</span>
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleVisibility(id); }}
                        className={`px-2 py-0.5 rounded text-xs ${isVisible ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}
                    >
                        {isVisible ? 'ON' : 'OFF'}
                    </button>
                </div>
            )}
            <div className={!isVisible ? 'opacity-50 grayscale pointer-events-none' : ''}>
                {children}
            </div>
        </div>
    );
};

// Logout Cleanup Function - Clears all user-specific data from localStorage
const clearUserSpecificData = (userId: string) => {
  const systemKeys = ['nst_dark_mode', 'nst_system_settings', 'nst_global_message'];
  const keysToRemove: string[] = [];
  
  // Scan all localStorage keys and remove user-specific ones
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && !systemKeys.includes(key)) {
      // Remove user-specific keys (those containing user ID)
      if (key.includes(userId)) {
        keysToRemove.push(key);
      }
    }
  }
  
  // Additional keys to always clear on logout
  const alwaysClear = [
    'nst_current_user',
    'nst_users',
    'nst_test_attempts',
    'nst_universal_analysis_logs',
    'nst_universal_notes',
    'nst_demand_requests',
    'nst_recycle_bin',
    'nst_admin_codes',
    'app_session_splash'
  ];
  
  alwaysClear.forEach(key => keysToRemove.push(key));
  
  // Remove all identified keys
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  // Also clear sessionStorage
  sessionStorage.clear();
};

export const StudentDashboard: React.FC<Props> = ({ user, dailyStudySeconds, onSubjectSelect, onRedeemSuccess, settings, onStartWeeklyTest, activeTab, onTabChange, setFullScreen, onNavigate, isImpersonating, onNavigateToChapter, isDarkMode, onToggleDarkMode }) => {
  
  const analysisLogs = JSON.parse(localStorage.getItem('nst_universal_analysis_logs') || '[]');
  const isGameEnabled = settings?.isGameEnabled !== false;

  const hasPermission = (featureId: string) => {
      // Use the new centralized helper which handles Feed vs Matrix control
      if (!settings) return true; // Default allow if settings missing (fallback to static)
      const { hasAccess } = checkFeatureAccess(featureId, user, settings);
      return hasAccess;
  };

  const handleProfilePictureUpload = async (file: File) => {
      try {
          // Simple validation (e.g., < 5MB)
          if (file.size > 5 * 1024 * 1024) {
              alert("File is too large. Please select an image under 5MB.");
              return;
          }

          const newUrl = await uploadProfilePicture(user.id, file);

          // Optimistically update local UI
          const updatedUser = { ...user, photoURL: newUrl };
          saveUserLocal(updatedUser);

          // Tell parent or state to re-render
          // Since user is a prop and the sync can take a second, force reload to immediately show the picture
          window.location.reload();
      } catch (e) {
          console.error("Failed to upload profile picture:", e);
          alert("Failed to upload profile picture. Try again.");
      }
  };

  // --- EXPIRY CHECK & AUTO DOWNGRADE ---
  useEffect(() => {
      if (user.isPremium && !SubscriptionEngine.isPremium(user)) {
          const updatedUser: User = {
              ...user,
              isPremium: false,
              subscriptionTier: 'FREE',
              subscriptionLevel: undefined,
              subscriptionEndDate: undefined
          };
          handleUserUpdate(updatedUser);
          showAlert("Your subscription has expired. You are now on the Free Plan.", "ERROR", "Plan Expired");
      }
  }, [user.isPremium, user.subscriptionEndDate]);

  // --- POPUP LOGIC (EXPIRY WARNING, UPSELL, AND EVENT) ---
  useEffect(() => {
      const checkPopups = () => {
          const now = Date.now();

          // 1. Expiry Warning
          if (settings?.popupConfigs?.isExpiryWarningEnabled && user.isPremium && user.subscriptionEndDate) {
             const end = new Date(user.subscriptionEndDate).getTime();
             const diffHours = (end - now) / (1000 * 60 * 60);
             const threshold = settings.popupConfigs.expiryWarningHours || 24;
             if (diffHours > 0 && diffHours <= threshold) {
                 const lastShown = parseInt(localStorage.getItem(`last_expiry_warn_${user.id}`) || '0');
                 const interval = (settings.popupConfigs.expiryWarningIntervalMinutes || 60) * 60 * 1000;
                 if (now - lastShown > interval) {
                     showAlert(`⚠️ Your subscription expires in ${Math.ceil(diffHours)} hours! Renew now to keep uninterrupted access.`, "INFO", "Expiry Warning");
                     safeSetLocalStorage(`last_expiry_warn_${user.id}`, now.toString());
                     return; // Show one at a time
                 }
             }
          }

          // 2. Upsell Promotion
          if (settings?.popupConfigs?.isUpsellEnabled && user.subscriptionLevel !== 'ULTRA') {
             const lastShown = parseInt(localStorage.getItem(`last_upsell_${user.id}`) || '0');
             const interval = (settings.popupConfigs.upsellPopupIntervalMinutes || 120) * 60 * 1000;
             if (now - lastShown > interval) {
                 const isFree = !user.isPremium;
                 const msg = isFree
                     ? "🚀 Upgrade to Premium to unlock Full Subject Notes, Ad-Free Videos, and AI tools!"
                     : "💎 Go Ultra! Get unlimited access to Competition Mode, Deep Dive Notes, and AI Chat.";
                 showAlert(msg, "INFO", "Upgrade Available");
                 safeSetLocalStorage(`last_upsell_${user.id}`, now.toString());
                 return; // Show one at a time
             }
          }

          // 3. Discount Event Notification
          if (settings?.specialDiscountEvent?.enabled) {
              const event = settings.specialDiscountEvent;
              let isEventActive = false;
              if (event.startsAt && event.endsAt) {
                  isEventActive = now >= new Date(event.startsAt).getTime() && now < new Date(event.endsAt).getTime();
              }

              if (isEventActive) {
                  const isSubscribed = user.isPremium && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date(now);
                  const shouldShow = (isSubscribed && event.showToPremiumUsers) || (!isSubscribed && event.showToFreeUsers);

                  if (shouldShow) {
                      const lastShown = parseInt(localStorage.getItem(`last_event_promo_${user.id}_${event.eventName}`) || '0');
                      // Show every 2 hours if not specified differently, just to ensure they know about the sale
                      const interval = 2 * 60 * 60 * 1000;
                      if (now - lastShown > interval) {
                          showAlert(`🎉 ${event.eventName} is LIVE! Get ${event.discountPercent}% OFF on subscriptions right now!`, "SUCCESS", "Special Event");
                          safeSetLocalStorage(`last_event_promo_${user.id}_${event.eventName}`, now.toString());
                          return;
                      }
                  }
              }
          }

          // 4. Global Free Access & Credit Free Event Popups
          if (settings?.isGlobalFreeMode) {
              const lastShown = parseInt(localStorage.getItem(`last_global_free_${user.id}`) || '0');
              const interval = 4 * 60 * 60 * 1000; // Every 4 hours
              if (now - lastShown > interval) {
                  showAlert("🌟 GLOBAL FREE ACCESS IS LIVE! Enjoy everything for free!", "SUCCESS", "Special Event");
                  safeSetLocalStorage(`last_global_free_${user.id}`, now.toString());
                  return;
              }
          }

          if (settings?.creditFreeEvent?.enabled) {
              const lastShown = parseInt(localStorage.getItem(`last_credit_free_${user.id}`) || '0');
              const interval = 4 * 60 * 60 * 1000; // Every 4 hours
              if (now - lastShown > interval) {
                  showAlert("⚡ CREDIT FREE EVENT IS LIVE! Unlock content without using your coins!", "SUCCESS", "Special Event");
                  safeSetLocalStorage(`last_credit_free_${user.id}`, now.toString());
                  return;
              }
          }

          // 5. Admin Custom Popups
          if (settings?.adminCustomPopups) {
              for (const popup of settings.adminCustomPopups) {
                  if (popup.enabled) {
                      // Check audience
                      if (popup.showTo === 'FREE' && user.isPremium) continue;
                      if (popup.showTo === 'PREMIUM' && !user.isPremium) continue;

                      const popupId = `custom_popup_${popup.title.replace(/\s+/g, '_')}`;
                      const lastShown = parseInt(localStorage.getItem(`${popupId}_${user.id}`) || '0');
                      const interval = 4 * 60 * 60 * 1000; // 4 hours by default for custom popups

                      if (now - lastShown > interval) {
                          let popupMsg = popup.message;
                          if (popup.copyableText) {
                              popupMsg += `\n\nCode: ${popup.copyableText}`;
                          }
                          showAlert(popupMsg, "INFO", popup.title);
                          safeSetLocalStorage(`${popupId}_${user.id}`, now.toString());
                          return; // Show one at a time
                      }
                  }
              }
          }

      };

      checkPopups(); // Check immediately on mount/update
      const timer = setInterval(checkPopups, 60000); // And every minute
      return () => clearInterval(timer);
  }, [user.isPremium, user.subscriptionEndDate, settings?.popupConfigs, settings?.specialDiscountEvent]);

  // CUSTOM ALERT STATE
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, type: 'SUCCESS'|'ERROR'|'INFO', title?: string, message: string}>({isOpen: false, type: 'INFO', message: ''});
  const showAlert = (msg: string, type: 'SUCCESS'|'ERROR'|'INFO' = 'INFO', title?: string) => {
      setAlertConfig({ isOpen: true, type, title, message: msg });
  };

  // NEW NOTIFICATION LOGIC
  const [hasNewUpdate, setHasNewUpdate] = useState(false);
  useEffect(() => {
      const q = query(ref(rtdb, 'universal_updates'), limitToLast(1));
      const unsub = onValue(q, snap => {
          const data = snap.val();
          if (data) {
              const latest = Object.values(data)[0] as any;
              const lastRead = localStorage.getItem('nst_last_read_update') || '0';
              if (new Date(latest.timestamp).getTime() > Number(lastRead)) {
                  setHasNewUpdate(true);
                      const alertKey = `nst_update_alert_shown_${latest.id}`;
                      if (!localStorage.getItem(alertKey)) {
                          showAlert(`New Content Available: ${latest.text}`, 'INFO', 'New Update');
                          safeSetLocalStorage(alertKey, 'true');
                      }
              } else {
                  setHasNewUpdate(false);
              }
          }
      });
      return () => unsub();
  }, []);

  const [testAttempts, setTestAttempts] = useState<Record<string, any>>(JSON.parse(localStorage.getItem(`nst_test_attempts_${user.id}`) || '{}'));
  const globalMessage = localStorage.getItem('nst_global_message');
  const [activeExternalApp, setActiveExternalApp] = useState<string | null>(null);
  const [pendingApp, setPendingApp] = useState<{app: any, cost: number} | null>(null);
  const [contentViewStep, setContentViewStep] = useState<'SUBJECTS' | 'CHAPTERS' | 'PLAYER'>('SUBJECTS');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [selectedLessonForModal, setSelectedLessonForModal] = useState<Chapter | null>(null);
  const [syllabusMode, setSyllabusMode] = useState<'SCHOOL' | 'COMPETITION'>('SCHOOL');
  const [currentAudioTrack, setCurrentAudioTrack] = useState<{url: string, title: string} | null>(null);
  const [universalNotes, setUniversalNotes] = useState<any[]>([]);
  const [topicFilter, setTopicFilter] = useState<string | undefined>(undefined);

  useEffect(() => {
      getChapterData('nst_universal_notes').then(data => {
          if (data && data.notesPlaylist) setUniversalNotes(data.notesPlaylist);
      });
  }, []);
  
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isDataReady, setIsDataReady] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [profileData, setProfileData] = useState({
      classLevel: user.classLevel || '10',
      board: user.board || 'CBSE',
      stream: user.stream || 'Science',
      newPassword: '',
      mobile: user.mobile || '',
      dailyGoalHours: 3
  });
  const [canClaimReward, setCanClaimReward] = useState(false);
  const [selectedPhoneId, setSelectedPhoneId] = useState<string>('');
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [showStudentGuide, setShowStudentGuide] = useState(false); // NEW
  const [showNameChangeModal, setShowNameChangeModal] = useState(false);
  const [newNameInput, setNewNameInput] = useState('');
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isLayoutEditing, setIsLayoutEditing] = useState(false);
  const [showExpiryPopup, setShowExpiryPopup] = useState(false);
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [marksheetType, setMarksheetType] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [showReferralPopup, setShowReferralPopup] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showFeatureMatrix, setShowFeatureMatrix] = useState(false);

  useEffect(() => {
    // Only set full screen for immersive content views
    if (activeTab === 'VIDEO' || activeTab === 'PDF' || activeTab === 'MCQ' || (activeTab as any) === 'AUDIO') {
        setFullScreen(true);
    } else {
        setFullScreen(false);
    }
  }, [activeTab]);

  useEffect(() => {
      const isNew = (Date.now() - new Date(user.createdAt).getTime()) < 10 * 60 * 1000;
      if (isNew && !user.redeemedReferralCode && !localStorage.getItem(`referral_shown_${user.id}`)) {
          setShowReferralPopup(true);
          safeSetLocalStorage(`referral_shown_${user.id}`, 'true');
      }
  }, [user.id, user.createdAt, user.redeemedReferralCode]);

  const handleSupportEmail = () => {
    const email = settings?.supportEmail || "nadiman0636indo@gmail.com";
    const subject = encodeURIComponent(`Support Request: ${user.name} (ID: ${user.id})`);
    const body = encodeURIComponent(`Student Details:\nName: ${user.name}\nUID: ${user.id}\nEmail: ${user.email}\n\nIssue Description:\n`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };
  
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestData, setRequestData] = useState({ subject: '', topic: '', type: 'PDF' });
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [dailyTargetSeconds, setDailyTargetSeconds] = useState(3 * 3600);
  const REWARD_AMOUNT = settings?.dailyReward || 3;
  const adminPhones = settings?.adminPhones || [{id: 'default', number: '8227070298', name: 'Admin'}];
  const defaultPhoneId = adminPhones.find(p => p.isDefault)?.id || adminPhones[0]?.id || 'default';
  
  if (!selectedPhoneId && adminPhones.length > 0) {
    setSelectedPhoneId(defaultPhoneId);
  }

  const [viewingUserHistory, setViewingUserHistory] = useState<User | null>(null);

  useEffect(() => {
      const today = new Date().toDateString();
      if (user.dailyRoutine?.date !== today) {
          const newRoutine = generateDailyRoutine(user);
          const updatedUser = { ...user, dailyRoutine: newRoutine };
          if (!isImpersonating) {
              saveUserLocal(updatedUser);
              saveUserToLive(updatedUser);
          }
          onRedeemSuccess(updatedUser);
      }
  }, [user.dailyRoutine?.date, user.mcqHistory?.length]);

  const [currentSlide, setCurrentSlide] = useState(0);

  const handleAiNotesGeneration = async () => {
      // 1. Feature Lock Check
      const access = checkFeatureAccess('AI_GENERATOR', user, settings || {});
      if (!access.hasAccess) {
          showAlert(access.reason === 'FEED_LOCKED' ? '🔒 Locked by Admin' : '🔒 Upgrade to access AI Notes!', 'ERROR', 'Access Denied');
          return;
      }

      if (!aiTopic.trim()) { showAlert("Please enter a topic!", "ERROR"); return; }

      // 2. Limit Check (Use Feed Limit if available)
      const today = new Date().toDateString();
      const usageKey = `nst_ai_usage_${user.id}_${today}`;
      const currentUsage = parseInt(localStorage.getItem(usageKey) || '0');
      
      const limit = access.limit !== undefined ? access.limit : 5; // Default fallback

      if (currentUsage >= limit) {
          showAlert(`Daily Limit Reached! You have used ${currentUsage}/${limit} AI generations today.`, "ERROR", "Limit Exceeded");
          return;
      }

      setAiGenerating(true);
      try {
          const notes = await generateCustomNotes(aiTopic, settings?.aiNotesPrompt || '', settings?.aiModel);
          setAiResult(notes);
          safeSetLocalStorage(usageKey, (currentUsage + 1).toString());
          saveAiInteraction({
              id: `ai-note-${Date.now()}`,
              userId: user.id,
              userName: user.name,
              type: 'AI_NOTES',
              query: aiTopic,
              response: notes,
              timestamp: new Date().toISOString()
          });
          showAlert("Notes Generated Successfully!", "SUCCESS");
      } catch (e) {
          console.error(e);
          showAlert("Failed to generate notes. Please try again.", "ERROR");
      } finally {
          setAiGenerating(false);
      }
  };

  const handleSwitchToAdmin = () => { if (onNavigate) onNavigate('ADMIN_DASHBOARD'); };

  const toggleLayoutVisibility = (sectionId: string) => {
      if (!settings) return;
      const currentLayout = settings.dashboardLayout || {};
      const currentConfig = currentLayout[sectionId] || { id: sectionId, visible: true };
      const newLayout = { ...currentLayout, [sectionId]: { ...currentConfig, visible: !currentConfig.visible } };
      const newSettings = { ...settings, dashboardLayout: newLayout };
      safeSetLocalStorage('nst_system_settings', JSON.stringify(newSettings));
      saveUserToLive(user);
      window.location.reload(); 
  };
  
  const getPhoneNumber = (phoneId?: string) => {
    const phone = adminPhones.find(p => p.id === (phoneId || selectedPhoneId));
    return phone ? phone.number : '8227070298';
  };

  useEffect(() => {
      const checkCompetitionAccess = () => {
          if (syllabusMode === 'COMPETITION') {
              const access = checkFeatureAccess('COMPETITION_MODE', user, settings || {});
              if (!access.hasAccess) {
                  setSyllabusMode('SCHOOL');
                  document.documentElement.style.setProperty('--primary', settings?.themeColor || '#3b82f6');
                  showAlert("⚠️ Competition Mode is locked! Please upgrade to an Ultra subscription to access competition content.", 'ERROR', 'Locked Feature');
              }
          }
      };
      checkCompetitionAccess();
      const interval = setInterval(checkCompetitionAccess, 60000);
      return () => clearInterval(interval);
  }, [syllabusMode, user.isPremium, user.subscriptionEndDate, user.subscriptionTier, user.subscriptionLevel, settings?.themeColor]);

  useEffect(() => {
      const storedGoal = localStorage.getItem(`nst_goal_${user.id}`);
      if (storedGoal) {
          const hours = parseInt(storedGoal);
          setDailyTargetSeconds(hours * 3600);
          setProfileData(prev => ({...prev, dailyGoalHours: hours}));
      }
  }, [user.id]);

  useEffect(() => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yDateStr = yesterday.toDateString();
      const yActivity = parseInt(localStorage.getItem(`activity_${user.id}_${yDateStr}`) || '0');
      const yClaimed = localStorage.getItem(`reward_claimed_${user.id}_${yDateStr}`);
      if (!yClaimed && (!user.subscriptionTier || user.subscriptionTier === 'FREE')) {
          let reward = null;
          if (yActivity >= 10800) reward = { tier: 'MONTHLY', level: 'ULTRA', hours: 4 };
          else if (yActivity >= 3600) reward = { tier: 'WEEKLY', level: 'BASIC', hours: 4 };
          if (reward) {
              const expiresAt = new Date(new Date().setHours(new Date().getHours() + 24)).toISOString();
              const newMsg: any = {
                  id: `reward-${Date.now()}`,
                  text: `🎁 Daily Reward! You studied enough yesterday. Claim your ${reward.hours} hours of ${reward.level} access now!`,
                  date: new Date().toISOString(),
                  read: false,
                  type: 'REWARD',
                  reward: { tier: reward.tier as any, level: reward.level as any, durationHours: reward.hours },
                  expiresAt: expiresAt,
                  isClaimed: false
              };
              const updatedUser = { ...user, inbox: [newMsg, ...(user.inbox || [])] };
              handleUserUpdate(updatedUser);
              safeSetLocalStorage(`reward_claimed_${user.id}_${yDateStr}`, 'true');
          }
      }
  }, [user.id]);

  const claimRewardMessage = (msgId: string, reward: any, gift?: any) => {
      const updatedInbox = user.inbox?.map(m => m.id === msgId ? { ...m, isClaimed: true, read: true } : m);
      let updatedUser: User = { ...user, inbox: updatedInbox };
      let successMsg = '';

      const applySubscription = (tier: string, level: string, duration: number) => {
          const now = new Date();
          const currentEnd = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : now;
          const isActive = user.isPremium && (currentEnd > now || user.subscriptionTier === 'LIFETIME');

          // Prevent downgrading a higher tier plan
          const tierPriority: Record<string, number> = { 'LIFETIME': 5, 'YEARLY': 4, '3_MONTHLY': 3, 'MONTHLY': 2, 'WEEKLY': 1, 'FREE': 0, 'CUSTOM': 0 };
          const currentPriority = tierPriority[user.subscriptionTier || 'FREE'] || 0;
          const newPriority = tierPriority[tier] || 0;

          if (isActive && currentPriority > newPriority) {
               // User already has a BETTER active plan, do NOT override tier, just extend date if not lifetime
               if (user.subscriptionTier !== 'LIFETIME') {
                   let newEndDate = new Date(currentEnd.getTime() + duration * 60 * 60 * 1000);
                   updatedUser.subscriptionEndDate = newEndDate.toISOString();
                   successMsg = `🎁 Gift Claimed! Added ${duration} hours to your existing ${user.subscriptionTier} plan.`;
               } else {
                   successMsg = `🎁 Gift Claimed! But you already have a Lifetime plan!`;
               }
          } else {
              // Upgrade or Apply New Plan
              let newEndDate = new Date(now.getTime() + duration * 60 * 60 * 1000);
              if (isActive && currentPriority === newPriority) {
                  newEndDate = new Date(currentEnd.getTime() + duration * 60 * 60 * 1000);
                  successMsg = `🎁 Gift Claimed! Extended your ${tier} plan by ${duration} hours.`;
              } else {
                  successMsg = `🎁 Gift Claimed! ${tier} ${level} unlocked for ${duration} hours.`;
              }
              updatedUser.subscriptionTier = tier as any;
              updatedUser.subscriptionLevel = level as any;
              updatedUser.subscriptionEndDate = newEndDate.toISOString();
              updatedUser.isPremium = true;
          }
      };

      if (gift) {
          if (gift.type === 'CREDITS') {
              updatedUser.credits = (user.credits || 0) + Number(gift.value);
              successMsg = `🎁 Gift Claimed! Added ${gift.value} Credits.`;
          }
          else if (gift.type === 'SUBSCRIPTION') {
              const [tier, level] = (gift.value as string).split('_');
              const duration = gift.durationHours || 24;
              applySubscription(tier, level, duration);
          }
      } else if (reward) {
          const duration = reward.durationHours || 4;
          applySubscription(reward.tier, reward.level, duration);
      }
      handleUserUpdate(updatedUser);
      showAlert(successMsg, 'SUCCESS', 'Rewards Claimed');
  };

  const userRef = React.useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    if (!user.id) return;
    const unsub = onSnapshot(doc(db, "users", user.id), (docSnap) => {
        if (docSnap.exists()) {
            const cloudData = docSnap.data() as User;
            const currentUser = userRef.current;

            // Only update if Admin/Cloud has truly pushed a newer state for credits, subs, or game bans
            // Do NOT use cloudData's mcqHistory length as a trigger here because saveUserToLive explicitly strips it!
            const needsUpdate =
                cloudData.credits !== currentUser.credits ||
                cloudData.subscriptionTier !== currentUser.subscriptionTier ||
                cloudData.isPremium !== currentUser.isPremium ||
                cloudData.isGameBanned !== currentUser.isGameBanned;

            if (needsUpdate) {
                  // Handle expired subscriptions dynamically
                  if (cloudData.isPremium && cloudData.subscriptionEndDate && cloudData.subscriptionTier !== 'LIFETIME') {
                      if (new Date(cloudData.subscriptionEndDate) < new Date()) {
                          cloudData.isPremium = false;
                          cloudData.subscriptionTier = 'FREE';
                          cloudData.subscriptionLevel = undefined;
                      }
                  }

                let protectedSub = { tier: cloudData.subscriptionTier, level: cloudData.subscriptionLevel, endDate: cloudData.subscriptionEndDate, isPremium: cloudData.isPremium };
                const localTier = currentUser.subscriptionTier || 'FREE';
                const cloudTier = cloudData.subscriptionTier || 'FREE';
                const tierPriority: Record<string, number> = { 'LIFETIME': 5, 'YEARLY': 4, '3_MONTHLY': 3, 'MONTHLY': 2, 'WEEKLY': 1, 'FREE': 0, 'CUSTOM': 0 };
                if (tierPriority[localTier] > tierPriority[cloudTier]) {
                     const localEnd = currentUser.subscriptionEndDate ? new Date(currentUser.subscriptionEndDate) : new Date();
                     if (localTier === 'LIFETIME' || localEnd > new Date()) {
                         console.warn("⚠️ Prevented Cloud Downgrade! Keeping Local Subscription.", localTier);
                         protectedSub = { tier: currentUser.subscriptionTier, level: currentUser.subscriptionLevel, endDate: currentUser.subscriptionEndDate, isPremium: true };
                         saveUserToLive({ ...cloudData, ...protectedSub });
                     }
                }

                // CRITICAL MERGE: Ensure we never overwrite local bulky data (mcqHistory, testResults)
                // because `docSnap` from "users" collection lacks them by design.
                const updated: User = {
                    ...currentUser,
                    ...cloudData,
                    ...protectedSub,
                    mcqHistory: currentUser.mcqHistory || [],
                    testResults: currentUser.testResults || []
                };

                // Do not update local storage if it's identical to prevent cyclic loop
                if (JSON.stringify(currentUser) !== JSON.stringify(updated)) {
                    onRedeemSuccess(updated);
                }
            }
        }
    });
    return () => unsub();
  }, [user.id]); 

  useEffect(() => {
      const interval = setInterval(() => {
          if (dailyStudySeconds % 60 === 0) {
              updateUserStatus(user.id, dailyStudySeconds);
          }
          const todayStr = new Date().toDateString();
          safeSetLocalStorage(`activity_${user.id}_${todayStr}`, dailyStudySeconds.toString());
          const accountAgeHours = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60);
          const firstDayBonusClaimed = localStorage.getItem(`first_day_ultra_${user.id}`);
          if (accountAgeHours < 24 && dailyStudySeconds >= 3600 && !firstDayBonusClaimed) {

              // Only apply if user is NOT already on a better plan
              const tierPriority: Record<string, number> = { 'LIFETIME': 5, 'YEARLY': 4, '3_MONTHLY': 3, 'MONTHLY': 2, 'WEEKLY': 1, 'FREE': 0, 'CUSTOM': 0 };
              const currentPriority = tierPriority[user.subscriptionTier || 'FREE'] || 0;

              if (currentPriority < 2) { // Less than MONTHLY
                  const endDate = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
                  const updatedUser: User = { ...user, subscriptionTier: 'MONTHLY', subscriptionLevel: 'ULTRA', subscriptionEndDate: endDate, isPremium: true };
                  const storedUsers = JSON.parse(localStorage.getItem('nst_users') || '[]');
                  const idx = storedUsers.findIndex((u:User) => u.id === user.id);
                  if (idx !== -1) storedUsers[idx] = updatedUser;
                  safeSetLocalStorage('nst_users', JSON.stringify(storedUsers));
                  saveUserLocal(updatedUser);
                  safeSetLocalStorage(`first_day_ultra_${user.id}`, 'true');
                  onRedeemSuccess(updatedUser);
                  showAlert("🎉 FIRST DAY BONUS: You unlocked 1 Hour Free ULTRA Subscription!", 'SUCCESS');
              } else {
                  // Mark claimed anyway so it doesn't trigger again
                  safeSetLocalStorage(`first_day_ultra_${user.id}`, 'true');
              }
          }
      }, 60000); 
      return () => clearInterval(interval);
  }, [dailyStudySeconds, user.id, user.createdAt, user.subscriptionTier]);

  const [showInbox, setShowInbox] = useState(false);
  const unreadCount = user.inbox?.filter(m => !m.read).length || 0;

  useEffect(() => { setCanClaimReward(RewardEngine.canClaimDaily(user, dailyStudySeconds, dailyTargetSeconds)); }, [user.lastRewardClaimDate, dailyStudySeconds, dailyTargetSeconds]);

  const claimDailyReward = () => {
      if (!canClaimReward) return;
      const finalReward = RewardEngine.calculateDailyBonus(user, settings);
      const updatedUser = RewardEngine.processClaim(user, finalReward);
      handleUserUpdate(updatedUser);
      setCanClaimReward(false);
      showAlert(`Received: ${finalReward} Free Credits!`, 'SUCCESS', 'Daily Goal Met');
  };

  const handleUserUpdate = async (updatedUser: User) => {
      const storedUsers = JSON.parse(localStorage.getItem('nst_users') || '[]');
      const userIdx = storedUsers.findIndex((u:User) => u.id === updatedUser.id);
      if (userIdx !== -1) {
          storedUsers[userIdx] = updatedUser;
      } else {
          storedUsers.push(updatedUser);
      }
      safeSetLocalStorage('nst_users', JSON.stringify(storedUsers));

      if (!isImpersonating) {
          saveUserLocal(updatedUser);
          // Ensure Firebase sync completes - this is critical for data persistence
          await saveUserToLive(updatedUser).catch(err => {
              console.error("Warning: Firebase sync failed during user update:", err);
              // Even if Firebase fails, we continue (data is still in local storage)
          });
      }
      onRedeemSuccess(updatedUser);
  };

  const markInboxRead = () => {
      if (!user.inbox) return;
      const updatedInbox = user.inbox.map(m => ({ ...m, read: true }));
      handleUserUpdate({ ...user, inbox: updatedInbox });
  };

  const handleContentSubjectSelect = (subject: Subject) => {
      setSelectedSubject(subject);
      setContentViewStep('CHAPTERS');
      setSelectedChapter(null);
      setLoadingChapters(true);
      const lang = user.board === 'BSEB' ? 'Hindi' : 'English';
      fetchChapters(user.board || 'CBSE', user.classLevel || '10', user.stream || 'Science', subject, lang).then(data => {
          setChapters(data);
          setLoadingChapters(false);
      });
  };

  const handleLessonOption = (type: 'VIDEO' | 'PDF' | 'MCQ' | 'AUDIO' | any) => {
      if (!selectedLessonForModal) return;
      setShowLessonModal(false);

      // Update Tab and State for Player
      onTabChange(type as any);
      setSelectedChapter(selectedLessonForModal);
      setContentViewStep('PLAYER');
      setFullScreen(true);
  };

  const handleExternalAppClick = (app: any) => {
      if (app.isLocked) {
           showAlert("🔒 This app is currently locked.", "ERROR");
           return;
      }

      if (app.creditCost > 0) {
           if (user.credits < app.creditCost) {
               showAlert(`Insufficient Credits! Need ${app.creditCost}.`, "ERROR");
               return;
           }
           const u = { ...user, credits: user.credits - app.creditCost };
           handleUserUpdate(u);
           window.open(app.url, '_blank');
      } else {
          window.open(app.url, '_blank');
      }
  };

  const renderContentSection = (type: 'VIDEO' | 'PDF' | 'MCQ' | 'AUDIO' | 'GENERIC') => {
      const goBack = () => {
          if (contentViewStep === 'PLAYER') {
              setContentViewStep('CHAPTERS');
              setFullScreen(false);
          } else {
              setContentViewStep('SUBJECTS');
              onTabChange('HOME'); // Go back to Home from Subject List
          }
      };

      if (contentViewStep === 'CHAPTERS') {
          return (
              <ChapterSelection
                  chapters={chapters}
                  subject={selectedSubject || {id: 'all', name: 'All Subjects', icon: 'Book', color: 'bg-slate-100'}}
                  classLevel={user.classLevel || '10'}
                  loading={loadingChapters}
                  user={user}
                  settings={settings}
                  onSelect={(chapter) => {
                      // OPEN MODAL INSTEAD OF PLAYER
                      setSelectedLessonForModal(chapter);
                      setShowLessonModal(true);
                  }}
                  onBack={goBack}
              />
          );
      }

      if (contentViewStep === 'PLAYER' && selectedChapter) {
          const contentProps = {
              subject: selectedSubject || {id: 'all', name: 'All Subjects', icon: 'Book', color: 'bg-slate-100'},
              board: user.board || 'CBSE',
              classLevel: user.classLevel || '10',
              stream: user.stream || 'Science',
              onUpdateUser: handleUserUpdate
          };

          if (type === 'VIDEO') return <VideoPlaylistView chapter={selectedChapter} onBack={goBack} user={user} settings={settings} {...contentProps} />;
          if (type === 'PDF') return <PdfView chapter={selectedChapter} onBack={goBack} user={user} settings={settings} {...contentProps} />;
          if (type === 'MCQ') return <McqView chapter={selectedChapter} onBack={goBack} user={user} settings={settings} {...contentProps} />;
          if (type === 'AUDIO') return <AudioPlaylistView chapter={selectedChapter} onBack={goBack} user={user} settings={settings} onPlayAudio={setCurrentAudioTrack} {...contentProps} />;
      }

      return null;
  };

  // --- MENU ITEM GENERATOR WITH LOCKS ---
  const renderSidebarMenuItems = () => {
      const groupedItems = [
          {
              category: 'Essential',
              items: [
                  { id: 'INBOX', label: 'Inbox', icon: Mail, color: 'indigo', action: () => { setShowInbox(true); setShowSidebar(false); } },
                  { id: 'UPDATES', label: 'Notifications', icon: Bell, color: 'red', action: () => { onTabChange('UPDATES'); setHasNewUpdate(false); safeSetLocalStorage('nst_last_read_update', Date.now().toString()); setShowSidebar(false); } },
              ]
          },
          {
              category: 'Learning & Progress',
              items: [
                  { id: 'ANALYTICS', label: 'Analytics', icon: BarChart3, color: 'blue', action: () => { onTabChange('ANALYTICS'); setShowSidebar(false); } },
                  { id: 'MARKSHEET', label: 'Marksheet', icon: FileText, color: 'green', action: () => { setShowMonthlyReport(true); setShowSidebar(false); } },
                  { id: 'HISTORY', label: 'History', icon: History, color: 'slate', action: () => { onTabChange('HISTORY'); setShowSidebar(false); } },
              ]
          },
          {
              category: 'Premium & Rewards',
              items: [
                  { id: 'PLAN', label: 'My Plan', icon: CreditCard, color: 'purple', action: () => { onTabChange('SUB_HISTORY' as any); setShowSidebar(false); } },
                  { id: 'REDEEM', label: 'Redeem', icon: Gift, color: 'pink', action: () => { onTabChange('REDEEM'); setShowSidebar(false); } },
                  { id: 'PRIZES', label: 'Prizes', icon: Trophy, color: 'yellow', action: () => { onTabChange('PRIZES'); setShowSidebar(false); } },
              ]
          },
          {
              category: 'Fun & Utilities',
              items: [
                  ...(isGameEnabled ? [{ id: 'GAME', label: 'Play Game', icon: Gamepad2, color: 'orange', action: () => { onTabChange('GAME'); setShowSidebar(false); }, featureId: 'GAMES' }] : []),
                  { id: 'REQUEST', label: 'Request Content', icon: Megaphone, color: 'purple', action: () => { setShowRequestModal(true); setShowSidebar(false); }, featureId: 'REQUEST_CONTENT' },
              ]
          },
          {
              category: 'Help & Support',
              items: [
                  { id: 'GUIDE', label: 'App Guide', icon: HelpCircle, color: 'cyan', action: () => { setShowStudentGuide(true); setShowSidebar(false); } },
                  { id: 'SUPPORT', label: 'Admin Support', icon: MessageSquare, color: 'rose', action: handleSupportEmail },
              ]
          }
      ];

      return groupedItems.map((group, gIdx) => (
          <div key={gIdx} className="mb-4">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 mb-2">{group.category}</h4>
              <div className="space-y-1">
                  {group.items.map(item => {
                      let isLocked = false;
                      if (item.featureId) {
                          const access = checkFeatureAccess(item.featureId, user, settings || {});
                          if (!access.hasAccess) isLocked = true;
                      }

                      return (
                          <Button
                              key={item.id}
                              onClick={() => {
                                  if (isLocked) {
                                      showAlert("🔒 Locked by Admin. Upgrade your plan to access.", 'ERROR');
                                      return;
                                  }
                                  item.action();
                              }}
                              variant="ghost"
                              fullWidth
                              className={`justify-start gap-4 p-3 mx-2 hover:bg-slate-50 rounded-xl ${isLocked ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                          >
                              <div className={`bg-${item.color}-100 text-${item.color}-600 p-2 rounded-lg relative`}>
                                  <item.icon size={18} />
                                  {isLocked && <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 border border-white"><Lock size={8} className="text-white"/></div>}
                              </div>
                              <span className="text-sm font-bold text-slate-700">{item.label}</span>
                          </Button>
                      );
                  })}
              </div>
          </div>
      ));
  };

  // --- RENDER BASED ON ACTIVE TAB ---
  const renderMainContent = () => {
      // 1. HOME TAB
      if (activeTab === 'HOME') {
          return (
              <div className="space-y-3">
                {/* PERFORMANCE GRAPH */}
                <DashboardSectionWrapper id="section_performance" label="Performance" settings={settings} isLayoutEditing={isLayoutEditing} onToggleVisibility={toggleLayoutVisibility}>
                    <PerformanceGraph
                        history={user.mcqHistory || []}
                        user={user}
                        onViewNotes={(topic) => {
                            onTabChange('PDF');
                        }}
                    />
                </DashboardSectionWrapper>

                {/* STUDY TIMER & MYSTERY BUTTON */}
                <DashboardSectionWrapper id="section_timer" label="Study Goal" settings={settings} isLayoutEditing={isLayoutEditing} onToggleVisibility={toggleLayoutVisibility}>
                    <div className="relative">
                        <StudyGoalTimer
                            dailyStudySeconds={dailyStudySeconds}
                            targetSeconds={dailyTargetSeconds}
                            onSetTarget={(s) => {
                                setDailyTargetSeconds(s);
                                safeSetLocalStorage(`nst_goal_${user.id}`, (s / 3600).toString());
                            }}
                        />

                    </div>
                </DashboardSectionWrapper>

                {/* MAIN ACTION BUTTONS (RESTORED OLD LAYOUT) */}
                <DashboardSectionWrapper id="section_main_actions" label="Main Actions" settings={settings} isLayoutEditing={isLayoutEditing} onToggleVisibility={toggleLayoutVisibility}>
                    <div className="grid grid-cols-2 gap-3 w-[96%] mx-auto">
                        {/* STUDY SECTION (REPLACED MY COURSES) */}
                        <div className="col-span-2 bg-white rounded-[20px] p-5 border border-slate-100 shadow-[0_10px_25px_rgba(0,0,0,0.08)] mb-3">
                            <h3 className="font-black text-slate-800 text-lg mb-3 flex items-center gap-2">
                                <BookOpen className="text-blue-600" size={24} /> Study
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                {getSubjectsList(user.classLevel || '10', user.stream || 'Science', user.board).map((subject) => {
                                    if ((settings?.hiddenSubjects || []).includes(subject.id)) return null;
                                    return (
                                        <button
                                            key={subject.id}
                                            onClick={() => {
                                                onTabChange('COURSES');
                                                handleContentSubjectSelect(subject);
                                            }}
                                            className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl transition-all active:scale-95 border-2 ${
                                                subject.id.includes('science') ? 'bg-purple-50 border-purple-100 text-purple-700' :
                                                subject.id.includes('math') ? 'bg-blue-50 border-blue-100 text-blue-700' :
                                                subject.id.includes('social') ? 'bg-orange-50 border-orange-100 text-orange-700' :
                                                'bg-slate-50 border-slate-100 text-slate-700'
                                            }`}
                                        >
                                            <div className={`p-2 rounded-full bg-white shadow-sm`}>
                                                {/* Simple Icon Mapping or default */}
                                                <BookOpen size={20} className={
                                                    subject.id.includes('science') ? 'text-purple-600' :
                                                    subject.id.includes('math') ? 'text-blue-600' :
                                                    subject.id.includes('social') ? 'text-orange-600' :
                                                    'text-slate-600'
                                                } />
                                            </div>
                                            <span className="text-[10px] font-bold uppercase text-center leading-tight">
                                                {subject.name}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {(() => {
                            // UNLOCKED AS PER REQUEST
                            const isLocked = false;
                            return (
                                <button
                                    onClick={() => {
                                        onTabChange('ANALYTICS');
                                    }}
                                    className={`bg-white border-2 border-slate-100 p-4 rounded-3xl shadow-sm flex flex-col items-center justify-center gap-2 group active:scale-95 transition-all hover:border-blue-200 h-32 relative overflow-hidden ${isLocked ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                                >
                                    <BarChart3 size={28} className="text-blue-600 mb-1" />
                                    <span className="font-black text-slate-700 text-sm tracking-wide uppercase text-center">My Analysis</span>
                                    {isLocked && <div className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full"><Lock size={12} /></div>}
                                </button>
                            );
                        })()}

                        {(() => {
                            // Using VIDEO_ACCESS as proxy for Universal Video as it's the closest content type
                            const access = checkFeatureAccess('VIDEO_ACCESS', user, settings || {});
                            const isLocked = !access.hasAccess;
                            return (
                                <button
                                    onClick={() => {
                                        if (isLocked) { showAlert("🔒 Video content is locked by Admin.", "ERROR"); return; }
                                        onTabChange('UNIVERSAL_VIDEO');
                                    }}
                                    className={`bg-white border-2 border-slate-100 p-4 rounded-3xl shadow-sm flex flex-col items-center justify-center gap-2 group active:scale-95 transition-all hover:border-rose-200 h-32 relative overflow-hidden ${isLocked ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                                >
                                    <div className="relative">
                                        <Video size={28} className="text-rose-600 mb-1" />
                                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse border border-white"></div>
                                    </div>
                                    <span className="font-black text-slate-700 text-sm tracking-wide uppercase text-center">Universal Video</span>
                                    {isLocked && <div className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full"><Lock size={12} /></div>}
                                </button>
                            );
                        })()}
                    </div>
                </DashboardSectionWrapper>
              </div>
          );
      }

      // 2. AI FUTURE HUB (NEW)
      if (activeTab === 'AI_HUB' || activeTab === 'AI_STUDIO') {
          if (!hasPermission('AI_CHAT')) return <div className="p-8 text-center text-slate-500">🔒 AI Features are locked for your plan. Upgrade to access.</div>;

          return <AiHub user={user} onTabChange={onTabChange} settings={settings} />;
      }


      // 5. UNIVERSAL VIDEO
      if (activeTab === 'UNIVERSAL_VIDEO') {
          return <UniversalVideoView user={user} onBack={() => onTabChange('HOME')} settings={settings} />;
      }

      // 4. MCQ REVIEW HUB
      if (activeTab === 'MCQ_REVIEW') {
          return (
              <McqReviewHub
                  user={user}
                  onTabChange={onTabChange}
                  settings={settings}
                  onNavigateContent={(type, chapterId, topicName, subjectName) => {
                      // Navigate to MCQ Player
                      setLoadingChapters(true);
                      const lang = user.board === 'BSEB' ? 'Hindi' : 'English';

                      // Fix Subject Context FIRST
                      const subjects = getSubjectsList(user.classLevel || '10', user.stream || 'Science', user.board);
                      let targetSubject = selectedSubject;

                      if (subjectName) {
                          targetSubject = subjects.find(s => s.name === subjectName) || subjects[0];
                      } else if (!targetSubject) {
                          targetSubject = subjects[0];
                      }

                      fetchChapters(user.board || 'CBSE', user.classLevel || '10', user.stream || 'Science', targetSubject, lang).then(allChapters => {
                          const ch = allChapters.find(c => c.id === chapterId);
                          if (ch) {
                              onTabChange('MCQ');
                              setSelectedSubject(targetSubject);
                              setSelectedChapter(ch);
                              setContentViewStep('PLAYER');
                              setFullScreen(true);
                          } else {
                              showAlert("Test not found.", "ERROR");
                          }
                          setLoadingChapters(false);
                      });
                  }}
              />
          );
      }

      // 3. COURSES TAB (Generic Chapter List for Study Mode)
      if (activeTab === 'COURSES') {
          return renderContentSection('GENERIC');
      }

      // 4. LEGACY TABS (Mapped to new structure or kept as sub-views)
      if (activeTab === 'CUSTOM_PAGE') return <CustomBloggerPage onBack={() => onTabChange('HOME')} />;
      if ((activeTab as string) === 'DEEP_ANALYSIS') return <AiDeepAnalysis user={user} settings={settings} onUpdateUser={handleUserUpdate} onBack={() => onTabChange('HOME')} />;
      if (activeTab === 'UPDATES') return <UniversalInfoPage onBack={() => onTabChange('HOME')} />;
      if ((activeTab as string) === 'ANALYTICS') return <AnalyticsPage user={user} onBack={() => onTabChange('HOME')} settings={settings} onNavigateToChapter={onNavigateToChapter} />;
      if ((activeTab as string) === 'SUB_HISTORY') return <SubscriptionHistory user={user} onBack={() => onTabChange('HOME')} />;
      if (activeTab === 'HISTORY') return <HistoryPage user={user} onUpdateUser={handleUserUpdate} settings={settings} />;
      if (activeTab === 'LEADERBOARD') return <Leaderboard user={user} settings={settings} />;
      if (activeTab === 'GAME') return isGameEnabled ? (user.isGameBanned ? <div className="text-center py-20 bg-red-50 rounded-2xl border border-red-100"><Ban size={48} className="mx-auto text-red-500 mb-4" /><h3 className="text-lg font-bold text-red-700">Access Denied</h3><p className="text-sm text-red-600">Admin has disabled the game for your account.</p></div> : <SpinWheel user={user} onUpdateUser={handleUserUpdate} settings={settings} />) : null;
      if (activeTab === 'REDEEM') return <div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><RedeemSection user={user} onSuccess={onRedeemSuccess} /></div>;
      {activeTab === 'PRIZES' && settings?.universalPrizeEnabled !== 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <PrizeList />
          </div>
      )}
      {activeTab === 'PRIZES' && settings?.universalPrizeEnabled === 0 && (
          <div className="text-center py-20 bg-slate-50 rounded-2xl border border-slate-200">
              <Trophy size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-bold text-slate-400">Prize List Disabled</h3>
              <p className="text-sm text-slate-500">Admin has temporarily disabled the universal prize list.</p>
          </div>
      )}
      // if (activeTab === 'REWARDS') return (...); // REMOVED TO PREVENT CRASH
      if (activeTab === 'STORE') return <Store user={user} settings={settings} onUserUpdate={handleUserUpdate} />;
      if (activeTab === 'PROFILE') return (
                <div className="animate-in fade-in zoom-in duration-300 pb-12">
                    <div className={`rounded-3xl p-8 text-center text-slate-800 mb-6 shadow-sm border border-slate-200 relative overflow-hidden transition-all duration-500 ${
                        user.subscriptionLevel === 'ULTRA' && user.isPremium
                        ? 'bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300 shadow-amber-500/10 ring-2 ring-amber-200/50'
                        : user.subscriptionLevel === 'BASIC' && user.isPremium
                        ? 'bg-gradient-to-br from-blue-50 via-cyan-50 to-sky-50 shadow-blue-500/10'
                        : 'bg-gradient-to-br from-white to-slate-50'
                    }`}>
                        {/* ANIMATED BACKGROUND FOR ULTRA */}
                        {user.subscriptionLevel === 'ULTRA' && user.isPremium && (
                            <>
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 animate-spin-slow"></div>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                                <div className="absolute -top-20 -right-20 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl animate-pulse"></div>
                            </>
                        )}

                        {/* ANIMATED BACKGROUND FOR BASIC */}
                        {user.subscriptionLevel === 'BASIC' && user.isPremium && (
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-30 animate-pulse"></div>
                        )}

                        {/* SPECIAL BANNER ANIMATION (7/30/365) */}
                        {(user.subscriptionTier === 'WEEKLY' || user.subscriptionTier === 'MONTHLY' || user.subscriptionTier === 'YEARLY' || user.subscriptionTier === 'LIFETIME') && user.isPremium && (
                            <div className="absolute top-2 right-2 animate-bounce">
                                <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold border border-white/30">
                                    {user.subscriptionTier === 'WEEKLY' ? '7 DAYS' : user.subscriptionTier === 'MONTHLY' ? '30 DAYS' : user.subscriptionTier === 'LIFETIME' ? '∞' : '365 DAYS'}
                                </span>
                            </div>
                        )}

                        <div className={`w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-4xl font-black shadow-2xl relative z-10 group overflow-hidden ${
                            user.subscriptionLevel === 'ULTRA' && user.isPremium ? 'text-blue-700 ring-4 ring-blue-400 animate-bounce-slow' :
                            user.subscriptionLevel === 'BASIC' && user.isPremium ? 'text-blue-600 ring-4 ring-cyan-300' :
                            'text-black ring-4 ring-slate-800 bg-slate-900 text-white'
                        }`}>
                            {user.photoURL ? (
                                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                user.name.charAt(0)
                            )}
                            {user.subscriptionLevel === 'ULTRA' && user.isPremium && <div className="absolute -top-2 -right-2 text-2xl drop-shadow-lg">👑</div>}

                            {/* Hidden File Input & Overlay */}
                            <label className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center cursor-pointer transition-opacity text-white text-xs text-center font-bold">
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleProfilePictureUpload(file);
                                }} />
                                Change<br/>Photo
                            </label>
                        </div>

                        <div className="flex items-center justify-center gap-2 relative z-10">
                            <h2 className="text-3xl font-black">{user.name}</h2>
                            <button
                                onClick={() => { setNewNameInput(user.name); setShowNameChangeModal(true); }}
                                className="bg-white/20 p-1.5 rounded-full hover:bg-white/40 transition-colors"
                            >
                                <Edit size={14} />
                            </button>
                        </div>
                        <p className="text-white/80 text-sm font-mono relative z-10 flex justify-center items-center gap-2">
                            ID: {user.displayId || user.id}
                        </p>
                        {user.createdAt && (
                            <p className="text-white/60 text-[10px] mt-1 font-medium relative z-10">
                                Joined: {new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                        )}

                        <div className="mt-4 relative z-10">
                            <span className={`px-6 py-2 rounded-full text-sm font-black uppercase tracking-widest shadow-lg shadow-black/10 border-2 ${
                                user.subscriptionLevel === 'ULTRA' && user.isPremium ? 'bg-gradient-to-r from-amber-200 to-yellow-400 text-yellow-900 border-amber-300' :
                                user.subscriptionLevel === 'BASIC' && user.isPremium ? 'bg-cyan-500 text-white border-cyan-300' : 'bg-slate-700 text-white border-slate-600'
                            }`}>
                                {user.isPremium
                                    ? (() => {
                                        const tier = user.subscriptionTier;
                                        let displayTier = 'PREMIUM';

                                        if (tier === 'WEEKLY') displayTier = 'Weekly';
                                        else if (tier === 'MONTHLY') displayTier = 'Monthly';
                                        else if (tier === 'YEARLY') displayTier = 'Yearly';
                                        else if (tier === 'LIFETIME') displayTier = 'Yearly Plus'; // Mapped as per user request
                                        else if (tier === '3_MONTHLY') displayTier = 'Quarterly';
                                        else if (tier === 'CUSTOM') displayTier = 'Custom Plan';

                                        return (
                                            <span className="drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">
                                                {displayTier} {user.subscriptionLevel}
                                            </span>
                                        );
                                    })()
                                    : 'Free User'
                                }
                            </span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-white rounded-xl p-4 border border-slate-200">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-1">Class</p>
                            <p className="text-lg font-black text-slate-800">{user.classLevel} • {user.board} • {user.stream}</p>
                        </div>

                        <div className="bg-white rounded-xl p-4 border border-slate-200">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-1">Subscription</p>
                            <p className="text-lg font-black text-slate-800">
                                {user.subscriptionTier === 'CUSTOM' ? (user.customSubscriptionName || 'Basic Ultra') : (user.subscriptionTier || 'FREE')}
                            </p>
                            {user.subscriptionEndDate && user.subscriptionTier !== 'LIFETIME' && (
                                <div className="mt-1">
                                    <p className="text-xs text-slate-500 font-medium">Expires on:</p>
                                    <p className="text-xs font-bold text-slate-700">
                                        {new Date(user.subscriptionEndDate).toLocaleString('en-IN', {
                                            year: 'numeric', month: 'long', day: 'numeric',
                                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                                        })}
                                    </p>
                                    <p className="text-[10px] text-red-500 mt-1 font-mono">
                                        (Time left: {
                                            (() => {
                                                const diff = new Date(user.subscriptionEndDate).getTime() - Date.now();
                                                if (diff <= 0) return 'Expired';
                                                const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                                                const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
                                                const m = Math.floor((diff / 1000 / 60) % 60);
                                                return `${d}d ${h}h ${m}m`;
                                            })()
                                        })
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                                <p className="text-xs font-bold text-blue-600 uppercase">Credits</p>
                                <p className="text-2xl font-black text-blue-600">{user.credits}</p>
                            </div>
                            <div className="bg-orange-50 rounded-xl p-3 border border-orange-200">
                                <p className="text-xs font-bold text-orange-600 uppercase">Streak</p>
                                <p className="text-2xl font-black text-orange-600">{user.streak} Days</p>
                            </div>
                        </div>

                        {/* MY DATA SECTION */}
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                            <h4 className="font-black text-slate-800 flex items-center gap-2">
                                <Database size={18} className="text-slate-600"/> My Data
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setViewingUserHistory(user)}
                                    className="bg-white p-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center justify-center gap-2"
                                >
                                    <Activity size={14} className="text-blue-500"/> View Full Activity
                                </button>
                                <button
                                    onClick={async () => {
                                        try {
                                            showAlert("Generating Report...", "INFO");

                                            // Create container
                                            const element = document.createElement('div');
                                            element.style.width = '210mm';
                                            element.style.minHeight = '297mm';
                                            element.style.padding = '40px';
                                            element.style.background = '#ffffff';
                                            element.style.fontFamily = 'Helvetica, Arial, sans-serif';
                                            element.style.position = 'fixed';
                                            element.style.top = '-9999px';
                                            element.style.left = '-9999px';

                                            // Calculate Stats
                                            const totalTests = user.mcqHistory?.length || 0;
                                            const avgScore = totalTests > 0
                                                ? Math.round((user.mcqHistory?.reduce((a, b) => a + (b.score/b.totalQuestions), 0) || 0) / totalTests * 100)
                                                : 0;
                                            const bestSubject = "General"; // simplified logic for now

                                            element.innerHTML = `
                                                <div style="border: 4px solid #1e293b; padding: 40px; height: 100%; box-sizing: border-box; position: relative;">

                                                    <!-- Header -->
                                                    <div style="text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px;">
                                                        <h1 style="color: #1e293b; font-size: 32px; margin: 0; font-weight: 900; letter-spacing: -1px;">STUDENT PROGRESS REPORT</h1>
                                                        <p style="color: #64748b; margin: 10px 0 0 0; font-size: 14px;">${settings?.appName || 'NST AI'} Official Record</p>
                                                    </div>

                                                    <!-- Student Info Grid -->
                                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px;">
                                                        <div style="background: #f8fafc; padding: 20px; border-radius: 12px;">
                                                            <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold;">Student Name</p>
                                                            <p style="margin: 5px 0 0 0; color: #0f172a; font-size: 18px; font-weight: bold;">${user.name}</p>
                                                        </div>
                                                        <div style="background: #f8fafc; padding: 20px; border-radius: 12px;">
                                                            <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold;">Student ID</p>
                                                            <p style="margin: 5px 0 0 0; color: #0f172a; font-size: 18px; font-weight: bold;">${user.displayId || user.id.slice(0,8)}</p>
                                                        </div>
                                                        <div style="background: #f8fafc; padding: 20px; border-radius: 12px;">
                                                            <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold;">Class & Stream</p>
                                                            <p style="margin: 5px 0 0 0; color: #0f172a; font-size: 18px; font-weight: bold;">${user.classLevel} - ${user.stream || 'General'}</p>
                                                        </div>
                                                        <div style="background: #f8fafc; padding: 20px; border-radius: 12px;">
                                                            <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold;">Date Generated</p>
                                                            <p style="margin: 5px 0 0 0; color: #0f172a; font-size: 18px; font-weight: bold;">${new Date().toLocaleDateString()}</p>
                                                        </div>
                                                    </div>

                                                    <!-- Performance Snapshot -->
                                                    <h3 style="color: #334155; font-size: 16px; border-left: 4px solid #3b82f6; padding-left: 10px; margin-bottom: 20px;">PERFORMANCE SNAPSHOT</h3>
                                                    <div style="display: flex; gap: 20px; margin-bottom: 40px;">
                                                        <div style="flex: 1; text-align: center; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px;">
                                                            <div style="font-size: 32px; font-weight: 900; color: #3b82f6;">${avgScore}%</div>
                                                            <div style="font-size: 12px; color: #64748b; font-weight: bold;">AVERAGE SCORE</div>
                                                        </div>
                                                        <div style="flex: 1; text-align: center; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px;">
                                                            <div style="font-size: 32px; font-weight: 900; color: #10b981;">${totalTests}</div>
                                                            <div style="font-size: 12px; color: #64748b; font-weight: bold;">TESTS TAKEN</div>
                                                        </div>
                                                        <div style="flex: 1; text-align: center; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px;">
                                                            <div style="font-size: 32px; font-weight: 900; color: #f59e0b;">${user.credits}</div>
                                                            <div style="font-size: 12px; color: #64748b; font-weight: bold;">CREDITS EARNED</div>
                                                        </div>
                                                    </div>

                                                    <!-- Recent Activity Table -->
                                                    <h3 style="color: #334155; font-size: 16px; border-left: 4px solid #ec4899; padding-left: 10px; margin-bottom: 20px;">RECENT TEST ACTIVITY</h3>
                                                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                                                        <thead>
                                                            <tr style="background: #f1f5f9; color: #475569;">
                                                                <th style="padding: 12px; text-align: left; border-radius: 8px 0 0 8px;">DATE</th>
                                                                <th style="padding: 12px; text-align: left;">TOPIC</th>
                                                                <th style="padding: 12px; text-align: right; border-radius: 0 8px 8px 0;">SCORE</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            ${(user.mcqHistory || []).slice(0, 15).map((h, i) => `
                                                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                                                    <td style="padding: 12px; color: #64748b;">${new Date(h.date).toLocaleDateString()}</td>
                                                                    <td style="padding: 12px; font-weight: 600; color: #334155;">${h.chapterTitle.substring(0, 40)}</td>
                                                                    <td style="padding: 12px; text-align: right;">
                                                                        <span style="background: ${h.score/h.totalQuestions >= 0.8 ? '#dcfce7' : '#fee2e2'}; color: ${h.score/h.totalQuestions >= 0.8 ? '#166534' : '#991b1b'}; padding: 4px 8px; border-radius: 4px; font-weight: bold;">
                                                                            ${h.score}/${h.totalQuestions}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            `).join('')}
                                                        </tbody>
                                                    </table>

                                                    <!-- Footer -->
                                                    <div style="position: absolute; bottom: 40px; left: 40px; right: 40px; text-align: center; color: #94a3b8; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                                                        This report is system generated by ${settings?.appName || 'NST AI'}. Verified & Valid.
                                                    </div>
                                                </div>
                                            `;

                                            document.body.appendChild(element);

                                            // Render
                                            const canvas = await html2canvas(element, { scale: 2, useCORS: true });
                                            const imgData = canvas.toDataURL('image/jpeg', 0.9);

                                            const pdf = new jsPDF('p', 'mm', 'a4');
                                            const pdfWidth = pdf.internal.pageSize.getWidth();
                                            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                                            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                                            pdf.save(`Report_${user.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`);

                                            document.body.removeChild(element);
                                            showAlert("✅ Report Downloaded!", "SUCCESS");

                                        } catch (e) {
                                            console.error("PDF Error", e);
                                            showAlert("Failed to generate PDF. Please try again.", "ERROR");
                                        }
                                    }}
                                    className="bg-white p-3 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center justify-center gap-2"
                                >
                                    <Download size={14} className="text-red-500"/> Download Optimized Report
                                </button>
                            </div>
                        </div>


                        <div className="grid grid-cols-2 gap-3 mt-6">
                            <button
                                onClick={() => { setShowSidebar(false); setEditMode(true); }}
                                className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
                            >
                                <Edit size={20} className="text-slate-600" />
                                <span className="text-[10px] font-bold text-slate-700">Edit Profile</span>
                            </button>

                            <button
                                onClick={() => { setMarksheetType('MONTHLY'); setShowMonthlyReport(true); }}
                                className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
                            >
                                <BarChart3 size={20} className="text-blue-500" />
                                <span className="text-[10px] font-bold text-slate-700">Marksheet</span>
                            </button>

                            <button
                                onClick={() => onTabChange('SUB_HISTORY' as any)}
                                className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
                            >
                                <History size={20} className="text-purple-500" />
                                <span className="text-[10px] font-bold text-slate-700">Sub History</span>
                            </button>

                            <button
                                onClick={() => onToggleDarkMode && onToggleDarkMode(!isDarkMode)}
                                className={`p-3 rounded-xl border shadow-sm flex flex-col items-center justify-center gap-2 transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                            >
                                {isDarkMode ? <Sparkles size={20} className="text-yellow-400" /> : <Zap size={20} className="text-slate-600" />}
                                <span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
                            </button>

                            <button
                                onClick={async () => {
                                    // 1. Ensure user data is saved to Firebase BEFORE clearing local storage
                                    const updatedUserData = { ...user };
                                    await saveUserToLive(updatedUserData); // Wait for Firebase sync to complete
                                    
                                    // 2. After Firebase save completes, clear local storage
                                    clearUserSpecificData(user.id); // Clear all user-specific cache
                                    
                                    // 3. Reload page to reset authentication
                                    window.location.reload();
                                }}
                                className="col-span-2 bg-red-50 p-3 rounded-xl border border-red-100 flex items-center justify-center gap-2 hover:bg-red-100 transition-colors text-red-600 font-bold text-sm"
                            >
                                <LogOut size={16} /> Logout
                            </button>
                        </div>
                    </div>
                </div>
      );


      // Handle Drill-Down Views (Video, PDF, MCQ, AUDIO)
      if (activeTab === 'VIDEO' || activeTab === 'PDF' || activeTab === 'MCQ' || (activeTab as any) === 'AUDIO') {
          const content = renderContentSection(activeTab as any);
          if (content) return content;
      }

      // 🚨 CATCH-ALL FALLBACK (Prevents Blank Screen of Death)
      // NOTE: We do not return the fallback here because other tabs like REVISION, HISTORY, etc.
      // are rendered OUTSIDE of renderMainContent().
      // If we return the fallback here, it will block rendering of those tabs.

      // 🚨 CATCH-ALL FALLBACK (Prevents Blank Screen of Death)
      // Any tab rendered in renderMainContent MUST return a component. If it doesn't, this fallback catches it.
      // However, tabs that are intentionally rendered OUTSIDE renderMainContent (like REVISION, PROFILE, etc)
      // must be explicitly listed here to bypass the fallback, otherwise they overlap or get blocked.
      const externallyHandledTabs = [
          'REVISION', 'AI_CHAT', 'HISTORY', 'PROFILE', 'STORE', 'PRIZES',
          'REDEEM', 'GAME', 'LEADERBOARD', 'SUB_HISTORY', 'ANALYTICS',
          'UPDATES', 'DEEP_ANALYSIS', 'CUSTOM_PAGE', 'MCQ_REVIEW', 'AI_HUB',
          'AI_STUDIO', 'UNIVERSAL_VIDEO'
      ];
      if (!externallyHandledTabs.includes(activeTab as any)) {
          return (
              <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6 animate-in fade-in">
                  <div className="bg-blue-50 p-6 rounded-full mb-4">
                      <LayoutGrid size={48} className="text-blue-500" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">Content Not Found</h3>
                  <p className="text-slate-500 mb-6 max-w-sm">We couldn't find the page you're looking for. It might have been moved or you might need to select a different option.</p>
                  <button onClick={() => onTabChange('HOME')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg active:scale-95 transition-all">
                      Go to Home
                  </button>
              </div>
          );
      }

      return null;
  };

  const isStudyMode = activeTab === 'VIDEO' || activeTab === 'PDF' || activeTab === 'MCQ' || activeTab === 'AUDIO' || (contentViewStep === 'PLAYER' && activeTab !== 'HOME') || activeTab === 'WEEKLY_TEST' || activeTab === 'CHALLENGE_20';

  return (

    <div className={`min-h-screen bg-slate-50 pb-[80px] px-0`}>

        {/* GLOBAL HEADER DESIGN (Visible on all dashboard tabs) */}
        {!isStudyMode && (
            <div className="bg-white p-4 shadow-[0_10px_20px_rgba(0,0,0,0.05)] flex items-center justify-between fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[1080px] z-50">
                <div className="flex items-center gap-3">
                    {/* Menu Button Restored */}
                    <button
                        onClick={() => setShowSidebar(true)}
                        className="bg-white border border-slate-200 shadow-sm px-3 py-2 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2 group active:scale-95"
                    >
                        <div className="space-y-1">
                            <span className="block w-5 h-0.5 bg-slate-600 group-hover:bg-blue-600 transition-colors rounded-full"></span>
                            <span className="block w-3 h-0.5 bg-slate-600 group-hover:bg-blue-600 transition-colors rounded-full"></span>
                            <span className="block w-5 h-0.5 bg-slate-600 group-hover:bg-blue-600 transition-colors rounded-full"></span>
                        </div>
                    </button>
                    <div>
                        <div className="flex flex-col justify-center">
                            <h2 className="text-lg font-black text-slate-800 leading-none">
                                {settings?.appName || 'Student App'}
                            </h2>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="text-[10px] font-black text-blue-600 truncate max-w-[80px]">{user.name}</span>
                                {user.role === 'ADMIN' && <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[8px] font-bold">ADMIN</span>}

                                {/* SUBSCRIPTION DETAILS TEXT */}
                                {user.subscriptionTier && user.subscriptionTier !== 'FREE' && user.subscriptionEndDate && (
                                    (() => {
                                        const daysLeft = Math.max(0, Math.ceil((new Date(user.subscriptionEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                                        return (
                                            <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full text-[8px] font-bold tracking-wider whitespace-nowrap">
                                                {user.subscriptionLevel === 'ULTRA' ? 'ULTRA' : user.subscriptionTier} - {daysLeft}d
                                            </span>
                                        );
                                    })()
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    {/* Language Toggle moved to corner */}
                    <button
                        onClick={() => {
                            const newBoard = user.board === 'CBSE' ? 'BSEB' : 'CBSE';
                            handleUserUpdate({ ...user, board: newBoard });
                            showAlert(`Language switched to ${newBoard === 'CBSE' ? 'English' : 'Hindi'}`, 'SUCCESS');
                        }}
                        className="flex items-center gap-0.5 bg-indigo-50 text-indigo-600 px-1.5 py-1 rounded-lg text-[9px] font-black border border-indigo-100 hover:bg-indigo-100 transition-colors"
                    >
                        <Globe size={10} /> {user.board === 'CBSE' ? 'EN' : 'HI'}
                    </button>

                    {settings?.specialDiscountEvent?.enabled && (
                        <button
                            onClick={() => onTabChange('STORE')}
                            className="bg-gradient-to-r from-red-600 to-rose-500 border border-red-400 text-white px-1.5 py-1 rounded-lg flex items-center gap-0.5 text-[9px] font-black shadow-sm animate-pulse shadow-red-500/30 whitespace-nowrap"
                        >
                            <Zap size={10} className="fill-yellow-400 text-yellow-400"/>
                            {settings.specialDiscountEvent.discountPercent ? `${settings.specialDiscountEvent.discountPercent}% OFF` : 'SALE'}
                        </button>
                    )}
                    <div className="bg-orange-50 border border-orange-200 text-orange-600 px-2 py-1 rounded-xl flex items-center gap-1 font-black text-[10px] whitespace-nowrap">
                        <span className="text-sm">🔥</span> {user.streak || 0}
                    </div>
                    <button
                        onClick={() => onTabChange('STORE')}
                        className="bg-blue-50 border border-blue-200 text-blue-600 px-2 py-1 rounded-xl flex items-center gap-1 font-black text-[10px] hover:bg-blue-100 transition-colors whitespace-nowrap"
                    >
                        <Crown size={12} className="fill-blue-600"/> {user.credits}
                    </button>
                </div>
            </div>
        )}




        {/* ADMIN SWITCH BUTTON */}
        {(user.role === 'ADMIN' || isImpersonating) && (
             <div className="fixed bottom-48 right-4 z-50 flex flex-col gap-3 items-end">
                 <button
                    onClick={() => setIsLayoutEditing(!isLayoutEditing)}
                    className={`p-4 rounded-full shadow-2xl border-2 hover:scale-110 transition-transform flex items-center gap-2 ${isLayoutEditing ? 'bg-yellow-400 text-black border-yellow-500' : 'bg-white text-slate-800 border-slate-200'}`}
                 >
                     <Edit size={20} />
                     {isLayoutEditing && <span className="font-bold text-xs">Editing Layout</span>}
                 </button>
                 <button
                    onClick={handleSwitchToAdmin}
                    className="bg-slate-900 text-white p-4 rounded-full shadow-2xl border-2 border-slate-700 hover:scale-110 transition-transform flex items-center gap-2 animate-bounce-slow"
                 >
                     <Layout size={20} className="text-yellow-400" />
                     <span className="font-bold text-xs">Admin Panel</span>
                 </button>
             </div>
        )}

        {/* NOTIFICATION BAR (Only on Home) (COMPACT VERSION) */}
        {activeTab === 'HOME' && settings?.noticeText && (
            <div className="bg-slate-900 text-white p-3 mb-4 rounded-xl shadow-md border border-slate-700 animate-in slide-in-from-top-4 relative mx-2 mt-2">
                <div className="flex items-center gap-3">
                    <Megaphone size={16} className="text-yellow-400 shrink-0" />
                    <div className="overflow-hidden flex-1">
                        <p className="text-xs font-medium truncate">{settings.noticeText}</p>
                    </div>
                    <SpeakButton text={settings.noticeText} className="text-white hover:bg-white/10" iconSize={14} />
                </div>
            </div>
        )}

        {/* AI NOTES MODAL */}
        {showAiModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
                <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                                <BrainCircuit size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-800">{settings?.aiName || 'AI Notes'}</h3>
                                <p className="text-xs text-slate-500">Instant Note Generator</p>
                            </div>
                        </div>
                        <button onClick={() => {setShowAiModal(false); setAiResult(null);}} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
                    </div>

                    {!aiResult ? (
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-2">What topic do you want notes for?</label>
                                <textarea
                                    value={aiTopic}
                                    onChange={(e) => setAiTopic(e.target.value)}
                                    placeholder="e.g. Newton's Laws of Motion, Photosynthesis process..."
                                    className="w-full p-4 bg-slate-50 border-none rounded-2xl text-slate-800 focus:ring-2 focus:ring-indigo-100 h-32 resize-none"
                                />
                            </div>

                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                                <AlertCircle size={16} className="text-blue-600 mt-0.5 shrink-0" />
                                <div className="text-xs text-blue-800">
                                    <span className="font-bold block mb-1">Usage Limit</span>
                                    You can generate notes within your daily limit.
                                    {user.isPremium ? (user.subscriptionLevel === 'ULTRA' ? ' (Ultra Plan: High Limit)' : ' (Basic Plan: Medium Limit)') : ' (Free Plan: Low Limit)'}
                                </div>
                            </div>

                            <Button
                                onClick={handleAiNotesGeneration}
                                isLoading={aiGenerating}
                                variant="primary"
                                fullWidth
                                size="lg"
                                icon={<Sparkles />}
                            >
                                {aiGenerating ? "Generating Magic..." : "Generate Notes"}
                            </Button>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-hidden flex flex-col">
                            <div className="flex-1 overflow-y-auto bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4 prose prose-sm max-w-none">
                                <div className="whitespace-pre-wrap">{aiResult}</div>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => setAiResult(null)}
                                    variant="ghost"
                                    className="flex-1"
                                >
                                    New Topic
                                </Button>
                                <Button
                                    onClick={() => {
                                        navigator.clipboard.writeText(aiResult);
                                        showAlert("Notes Copied!", "SUCCESS");
                                    }}
                                    variant="primary"
                                    className="flex-1"
                                >
                                    Copy Text
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

      {/* EDIT PROFILE MODAL (Moved to root level of StudentDashboard to fix z-index and conditional rendering issues) */}
      {editMode && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Edit className="text-blue-600"/> Edit Profile</h3>
                      <button onClick={() => setEditMode(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
                  </div>

                  <div className="space-y-4">
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Class Level</label>
                          <select
                              value={profileData.classLevel}
                              onChange={(e) => setProfileData({...profileData, classLevel: e.target.value as any})}
                              className="w-full p-3 rounded-xl border border-slate-200 font-bold bg-slate-50"
                          >
                              {(settings?.allowedClasses || ['6','7','8','9','10','11','12','COMPETITION']).map(c => <option key={c} value={c}>{c === 'COMPETITION' ? 'Competition' : `Class ${c}`}</option>)}
                          </select>
                          <div className="flex items-center justify-between mt-1">
                              <p className="text-[10px] text-slate-500">
                                  Daily Limit: {
                                      user.subscriptionLevel === 'ULTRA' ? '3' :
                                      user.subscriptionLevel === 'BASIC' ? '2' : '1'
                                  } changes
                              </p>
                              <p className="text-[10px] text-blue-600 font-bold">
                                  Remaining: {
                                      (() => {
                                          const limit = user.subscriptionLevel === 'ULTRA' ? 3 : user.subscriptionLevel === 'BASIC' ? 2 : 1;
                                          const used = parseInt(localStorage.getItem(`nst_class_changes_${user.id}_${new Date().toDateString()}`) || '0');
                                          return Math.max(0, limit - used);
                                      })()
                                  }
                              </p>
                          </div>
                      </div>

                      {(['11','12'].includes(profileData.classLevel) || profileData.classLevel === 'COMPETITION') && (
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Stream</label>
                              <select
                                  value={profileData.stream}
                                  onChange={(e) => setProfileData({...profileData, stream: e.target.value as any})}
                                  className="w-full p-3 rounded-xl border border-slate-200 font-bold bg-slate-50"
                              >
                                  <option value="Science">Science</option>
                                  <option value="Commerce">Commerce</option>
                                  <option value="Arts">Arts</option>
                              </select>
                          </div>
                      )}

                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Board</label>
                          <select
                              value={profileData.board}
                              onChange={(e) => setProfileData({...profileData, board: e.target.value as any})}
                              className="w-full p-3 rounded-xl border border-slate-200 font-bold bg-slate-50"
                          >
                              {(settings?.allowedBoards || ['CBSE', 'BSEB']).map(b => (
                                  <option key={b} value={b}>{b} {b === 'CBSE' ? '(English)' : b === 'BSEB' ? '(Hindi)' : ''}</option>
                              ))}
                          </select>
                      </div>

                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Mobile Number</label>
                          <input
                              type="tel"
                              value={profileData.mobile || user.mobile}
                              onChange={(e) => setProfileData({...profileData, mobile: e.target.value.replace(/\D/g, '').slice(0,10)} as any)}
                              className="w-full p-3 rounded-xl border border-slate-200 font-bold"
                              placeholder="10-digit number"
                          />
                      </div>

                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">New Password (Optional)</label>
                          <input
                              type="text"
                              placeholder="Leave blank to keep current"
                              value={profileData.newPassword}
                              onChange={(e) => setProfileData({...profileData, newPassword: e.target.value})}
                              className="w-full p-3 rounded-xl border border-slate-200"
                          />
                      </div>
                  </div>

                  <div className="flex gap-3 mt-8">
                      <button onClick={() => setEditMode(false)} className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 rounded-xl hover:bg-slate-200">Cancel</button>
                      <button
                          onClick={() => {
                              // Check Class Change Limit
                              if (profileData.classLevel !== user.classLevel) {
                                  const limit = user.subscriptionLevel === 'ULTRA' ? 3 : user.subscriptionLevel === 'BASIC' ? 2 : 1;
                                  const todayKey = `nst_class_changes_${user.id}_${new Date().toDateString()}`;
                                  const used = parseInt(localStorage.getItem(todayKey) || '0');

                                  if (used >= limit) {
                                      showAlert(`Daily class change limit reached (${limit})! Upgrade to increase.`, "ERROR");
                                      return;
                                  }

                                  // Increment Usage
                                  safeSetLocalStorage(todayKey, (used + 1).toString());
                              }

                              // Update User
                              const updates: Partial<User> = {
                                  classLevel: profileData.classLevel as any,
                                  board: profileData.board as any,
                                  stream: profileData.stream as any
                              };
                              if (profileData.newPassword) updates.password = profileData.newPassword;
                              if (profileData.mobile) updates.mobile = profileData.mobile;

                              handleUserUpdate({...user, ...updates});
                              setEditMode(false);
                              showAlert("Profile Updated Successfully!", "SUCCESS");
                          }}
                          className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700"
                      >
                          Save Changes
                      </button>
                  </div>
              </div>
          </div>
      )}

        {/* REQUEST CONTENT MODAL */}
        {showRequestModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
                    <div className="flex items-center gap-2 mb-4 text-pink-600">
                        <Megaphone size={24} />
                        <h3 className="text-lg font-black text-slate-800">Request Content</h3>
                    </div>

                    <div className="space-y-3 mb-6">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Subject</label>
                            <input
                                type="text"
                                value={requestData.subject}
                                onChange={e => setRequestData({...requestData, subject: e.target.value})}
                                className="w-full p-2 border rounded-lg"
                                placeholder="e.g. Mathematics"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Topic / Chapter</label>
                            <input
                                type="text"
                                value={requestData.topic}
                                onChange={e => setRequestData({...requestData, topic: e.target.value})}
                                className="w-full p-2 border rounded-lg"
                                placeholder="e.g. Trigonometry"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Type</label>
                            <select
                                value={requestData.type}
                                onChange={e => setRequestData({...requestData, type: e.target.value})}
                                className="w-full p-2 border rounded-lg"
                            >
                                <option value="PDF">PDF Notes</option>
                                <option value="VIDEO">Video Lecture</option>
                                <option value="MCQ">MCQ Test</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button onClick={() => setShowRequestModal(false)} variant="ghost" className="flex-1">Cancel</Button>
                        <Button
                            onClick={() => {
                                if (!requestData.subject || !requestData.topic) {
                                    showAlert("Please fill all fields", 'ERROR');
                                    return;
                                }
                                const request = {
                                    id: `req-${Date.now()}`,
                                    userId: user.id,
                                    userName: user.name,
                                    details: `${user.classLevel || '10'} ${user.board || 'CBSE'} - ${requestData.subject} - ${requestData.topic} - ${requestData.type}`,
                                    timestamp: new Date().toISOString()
                                };
                                // Save to Firebase for Admin Visibility
                                saveDemandRequest(request)
                                    .then(() => {
                                        setShowRequestModal(false);
                                        showAlert("✅ Request Sent! Admin will check it.", 'SUCCESS');
                                        // Also save locally just in case
                                        const existing = JSON.parse(localStorage.getItem('nst_demand_requests') || '[]');
                                        existing.push(request);
                                        safeSetLocalStorage('nst_demand_requests', JSON.stringify(existing));
                                    })
                                    .catch(() => showAlert("Failed to send request.", 'ERROR'));
                            }}
                            className="flex-1 bg-pink-600 hover:bg-pink-700 shadow-lg"
                        >
                            Send Request
                        </Button>
                    </div>
                </div>
            </div>
        )}

        {/* NAME CHANGE MODAL */}
        {showNameChangeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
                    <h3 className="text-lg font-bold mb-4 text-slate-800">Change Display Name</h3>
                    <input
                        type="text"
                        value={newNameInput}
                        onChange={e => setNewNameInput(e.target.value)}
                        className="w-full p-3 border rounded-xl mb-2"
                        placeholder="Enter new name"
                    />
                    <p className="text-xs text-slate-500 mb-4">Cost: <span className="font-bold text-orange-600">{settings?.nameChangeCost || 10} Coins</span></p>
                    <div className="flex gap-2">
                        <Button onClick={() => setShowNameChangeModal(false)} variant="ghost" className="flex-1">Cancel</Button>
                        <Button
                            onClick={() => {
                                const cost = settings?.nameChangeCost || 10;
                                if (newNameInput && newNameInput !== user.name) {
                                    if (user.credits < cost) { showAlert(`Insufficient Coins! Need ${cost}.`, 'ERROR'); return; }
                                    const u = { ...user, name: newNameInput, credits: user.credits - cost };
                                    handleUserUpdate(u);
                                    setShowNameChangeModal(false);
                                    showAlert("Name Updated Successfully!", 'SUCCESS');
                                }
                            }}
                            className="flex-1"
                        >
                            Pay & Update
                        </Button>
                    </div>
                </div>
            </div>
        )}

        {/* MAIN CONTENT AREA */}
        <div className="p-4 relative pb-20">
            {renderMainContent()}

            {settings?.showFooter !== false && activeTab !== 'REVISION' && (
                <div className="mt-8 mb-4 text-center">
                    <p
                        className="text-[10px] font-black uppercase tracking-widest"
                        style={{ color: settings?.footerColor || '#cbd5e1' }}
                    >
                        Developed by Nadim Anwar
                    </p>
                </div>
            )}
        </div>

        {/* MINI PLAYER */}
        <MiniPlayer track={currentAudioTrack} onClose={() => setCurrentAudioTrack(null)} />

        {/* FLOATING ACTION MENU */}
        {(activeTab === 'HOME' || activeTab === 'REVISION' || activeTab === 'AI_HUB' || activeTab === 'PROFILE' || activeTab === 'HISTORY' || (activeTab as string) === 'ANALYTICS') && (
            <FloatingActionMenu
                activeTab={activeTab}
                user={user}
                settings={settings || {}}
                isFlashSaleActive={settings?.specialDiscountEvent?.enabled}
                onOpenProfile={() => onTabChange('PROFILE')}
                onOpenStore={() => onTabChange('STORE')}
                onNavigate={(tab) => onTabChange(tab as any)}
            />
        )}

        {/* FIXED BOTTOM NAVIGATION */}

        {!(activeTab === 'VIDEO' || activeTab === 'PDF' || activeTab === 'MCQ' || activeTab === 'AUDIO' || (contentViewStep === 'PLAYER' && (activeTab as any) !== 'HOME') || activeTab === 'WEEKLY_TEST' || activeTab === 'CHALLENGE_20') && (
        <div className="fixed bottom-0 left-0 right-0 max-w-[1080px] mx-auto bg-white border-t border-slate-200 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-[9999] pb-[env(safe-area-inset-bottom,0px)]">
            <div className="flex justify-around items-center h-[65px] py-[6px]">
                <button onClick={() => { onTabChange('HOME'); setContentViewStep('SUBJECTS'); }} className={`flex flex-col items-center justify-center w-full h-full gap-1.5 ${activeTab === 'HOME' ? 'text-blue-600' : 'text-slate-400'}`}>
                    <Home size={24} fill={activeTab === 'HOME' ? "currentColor" : "none"} />
                    <span className="text-[12px] font-bold">Home</span>
                </button>

                <button
                    onClick={() => {
                        onTabChange('REVISION' as any);
                    }}
                    className={`flex flex-col items-center justify-center w-full h-full gap-1.5 ${activeTab === 'REVISION' ? 'text-blue-600' : 'text-slate-400'}`}
                >
                    <div className="relative">
                        <BrainCircuit size={24} fill={activeTab === 'REVISION' ? "currentColor" : "none"} />
                    </div>
                    <span className="text-[12px] font-bold">Revision</span>
                </button>

                <button
                    onClick={() => {
                        onTabChange('AI_HUB');
                    }}
                    className={`flex flex-col items-center justify-center w-full h-full gap-1.5 ${activeTab === 'AI_HUB' ? 'text-blue-600' : 'text-slate-400'}`}
                >
                    <div className="relative">
                        <Sparkles size={24} fill={activeTab === 'AI_HUB' ? "currentColor" : "none"} />
                    </div>
                    <span className="text-[12px] font-bold">AI Hub</span>
                </button>

                <button onClick={() => onTabChange('HISTORY')} className={`flex flex-col items-center justify-center w-full h-full gap-1.5 ${activeTab === 'HISTORY' ? 'text-blue-600' : 'text-slate-400'}`}>
                    <History size={24} />
                    <span className="text-[12px] font-bold">History</span>
                </button>

                <button onClick={() => onTabChange('PROFILE')} className={`flex flex-col items-center justify-center w-full h-full gap-1.5 ${activeTab === 'PROFILE' ? 'text-blue-600' : 'text-slate-400'}`}>
                    <UserIconOutline size={24} fill={activeTab === 'PROFILE' ? "currentColor" : "none"} />
                    <span className="text-[12px] font-bold">Profile</span>
                </button>
            </div>
        </div>
        )}

        {/* SIDEBAR OVERLAY (INLINE) */}
        {showSidebar && (
            <div className="fixed inset-0 z-[100] flex animate-in fade-in duration-200">
                <div
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    onClick={() => setShowSidebar(false)}
                ></div>

                <div className="w-64 bg-white h-full shadow-2xl relative z-10 flex flex-col slide-in-from-left duration-300">
                    <div className="p-6 bg-slate-900 text-white rounded-br-3xl relative overflow-hidden">
                        <h2 className="text-2xl font-black italic mb-1 relative z-10">{settings?.appName || 'App'}</h2>
                        <button onClick={() => setShowSidebar(false)} className="absolute top-4 right-4 text-white/50 hover:text-white z-20">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {renderSidebarMenuItems()}

                        {/* EXTERNAL APPS */}
                        {settings?.externalApps?.map(app => (
                            <Button
                                key={app.id}
                                onClick={() => { handleExternalAppClick(app); setShowSidebar(false); }}
                                variant="ghost"
                                fullWidth
                                className="justify-start gap-4 p-4 hover:bg-slate-50"
                            >
                                <div className="bg-cyan-100 text-cyan-600 p-2 rounded-lg">
                                    {app.icon ? <img src={app.icon} alt="" className="w-5 h-5"/> : <Smartphone size={20} />}
                                </div>
                                <span className="flex-1 text-left">{app.name}</span>
                                {app.isLocked && <Lock size={14} className="text-red-500" />}
                            </Button>
                        ))}

                        <Button
                            onClick={() => { onTabChange('CUSTOM_PAGE'); setShowSidebar(false); }}
                            variant="ghost"
                            fullWidth
                            className="justify-start gap-4 p-4 hover:bg-slate-50 relative"
                        >
                            <div className="bg-teal-100 text-teal-600 p-2 rounded-lg"><Zap size={20} /></div>
                            What's New
                            {hasNewUpdate && (
                                <span className="absolute top-4 right-4 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-white"></span>
                            )}
                        </Button>
                    </div>

                    <div className="p-4 border-t border-slate-100">
                        <div className="bg-slate-50 p-4 rounded-xl flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold overflow-hidden">
                                {user.subscriptionLevel === 'ULTRA' ? (
                                    <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white">👑</div>
                                ) : user.name.charAt(0)}
                            </div>
                            <div className="overflow-hidden">
                                <p className="font-bold text-sm truncate text-slate-800">{user.name}</p>
                                <p className="text-xs text-slate-500 truncate">{user.id}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* STUDENT AI ASSISTANT (Chat Check) */}
        <StudentAiAssistant
            user={user}
            settings={settings}
            isOpen={activeTab === 'AI_CHAT'}
            onClose={() => onTabChange('HOME')}
        />

        {/* STUDENT HISTORY MODAL (FULL ACTIVITY) */}
        {viewingUserHistory && (
            <StudentHistoryModal
                user={viewingUserHistory}
                onClose={() => setViewingUserHistory(null)}
            />
        )}

        {/* STUDENT GUIDE MODAL (NEW) */}
        {showStudentGuide && (
            <StudentGuide
                settings={settings}
                onClose={() => setShowStudentGuide(false)}
            />
        )}

        {/* LESSON ACTION MODAL */}
        {showLessonModal && selectedLessonForModal && (
            <LessonActionModal
                chapter={selectedLessonForModal}
                onClose={() => setShowLessonModal(false)}
                onSelect={handleLessonOption}
                logoUrl={settings?.appLogo} // Pass logo from settings
                appName={settings?.appName}
            />
        )}

        {/* REVISION HUB CHECK */}
        {activeTab === 'REVISION' && (
          (() => {
              const access = checkFeatureAccess('REVISION_HUB', user, settings || {});
              if (!access.hasAccess) {
                  return (
                      <div className="flex flex-col items-center justify-center h-[70vh] p-6 text-center animate-in fade-in">
                          <div className="bg-slate-100 p-6 rounded-full mb-6 relative">
                              <BrainCircuit size={64} className="text-slate-400" />
                              <div className="absolute -bottom-2 -right-2 bg-red-500 text-white p-2 rounded-full border-4 border-white">
                                  <Lock size={20} />
                              </div>
                          </div>
                          <h2 className="text-2xl font-black text-slate-800 mb-2">Revision Hub Locked</h2>
                          <p className="text-slate-500 mb-6 max-w-sm">
                              {access.reason === 'FEED_LOCKED' ? 'This feature is currently disabled by Admin.' : 'Upgrade your plan to unlock smart revision tools.'}
                          </p>
                          <Button onClick={() => onTabChange('STORE')} variant="primary">View Plans</Button>
                      </div>
                  );
              }
              return (
                  <RevisionHub
                      user={user}
                      onTabChange={onTabChange}
                      settings={settings}
                      onUpdateUser={handleUserUpdate}
                      onNavigateContent={(type, chapterId, topicName, subjectName) => {
                          setTopicFilter(topicName);
                          // Handle Navigation based on Type
                          if (type === 'PDF' || type === 'VIDEO' || type === 'MCQ') {
                              setLoadingChapters(true);
                              const lang = user.board === 'BSEB' ? 'Hindi' : 'English';
                                  fetchChapters(user.board as any || 'CBSE', user.classLevel as any || '10', user.stream as any || 'Science', null as any, lang).then(allChapters => {
                                  const ch = allChapters.find(c => c.id === chapterId);
                                  if (ch) {
                                      // Switch Tab
                                      onTabChange(type as any); // Type cast as StudentTab

                                      // Resolve Subject
                                      const subjects = getSubjectsList(user.classLevel || '10', user.stream || 'Science', user.board);
                                      let targetSubject = selectedSubject;
                                      if (subjectName) { targetSubject = subjects.find(s => s.name === subjectName) || subjects[0]; }
                                      else if (!targetSubject) { targetSubject = subjects[0]; }

                                      // Set Context
                                      setSelectedSubject(targetSubject);
                                      setSelectedChapter(ch);
                                      setContentViewStep('PLAYER');
                                      setFullScreen(true);
                                  } else {
                                      showAlert("Content not found or not loaded.", "ERROR");
                                  }
                                  setLoadingChapters(false);
                              });
                          }
                      }}
                  />
              );
          })()
        )}
    </div>
  );
};
