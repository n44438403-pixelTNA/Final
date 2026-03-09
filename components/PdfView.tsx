import { safeSetLocalStorage, saveUserLocal } from '../utils/safeStorage';
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Chapter, User, Subject, SystemSettings, HtmlModule, PremiumNoteSlot, DeepDiveEntry, AdditionalNoteEntry } from '../types';
import { FileText, Lock, ArrowLeft, Crown, Star, CheckCircle, AlertCircle, Globe, Maximize, Minimize, Layers, HelpCircle, Minus, Plus, Volume2, Square, Zap, Headphones, BookOpen, Music, Play, Pause, SkipForward, SkipBack, Book, List, Layout, ExternalLink, ChevronUp, ChevronDown, StopCircle } from 'lucide-react';
import { CustomAlert } from './CustomDialogs';
import { getChapterData, saveUserToLive } from '../firebase';
import { CreditConfirmationModal } from './CreditConfirmationModal';
import { AiInterstitial } from './AiInterstitial';
import { InfoPopup } from './InfoPopup';
import { ErrorBoundary } from './ErrorBoundary';
import { DEFAULT_CONTENT_INFO_CONFIG } from '../constants';
import { checkFeatureAccess } from '../utils/permissionUtils';
import { speakText, stopSpeech } from '../utils/textToSpeech';

interface Props {
  chapter: Chapter;
  subject: Subject;
  user: User;
  board: string;
  classLevel: string;
  stream: string | null;
  onBack: () => void;
  onUpdateUser: (user: User) => void;
  settings?: SystemSettings;
  initialSyllabusMode?: 'SCHOOL' | 'COMPETITION';
  directResource?: { url: string, access: string };
}

// Helper to format Google Drive links for embedding
const formatDriveLink = (link: string) => {
    if (!link) return '';
    // If it's a view link, convert to preview
    let formatted = link;
    if (link.includes('drive.google.com') && (link.includes('/view') || link.endsWith('/view'))) {
        formatted = link.replace(/\/view.*/, '/preview');
    }

    // Add parameters to suppress UI (Minimal Mode)
    if (formatted.includes('drive.google.com')) {
        // Remove existing parameters if any to avoid duplicates
        // Append rm=minimal to hide header/toolbar
        if (!formatted.includes('rm=minimal')) {
            formatted += formatted.includes('?') ? '&rm=minimal' : '?rm=minimal';
        }
    }
    return formatted;
};

// Helper to split HTML content into topics (SAFE)
const extractTopicsFromHtml = (html: string): { title: string, content: string }[] => {
    if (!html) return [];

    try {
        // Create a temporary element to parse HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        const topics: { title: string, content: string }[] = [];
        let currentTitle = "Introduction";
        let currentContent: string[] = [];

        const children = Array.from(tempDiv.children);

        // Fallback if no children (raw text)
        if (children.length === 0 && html.trim().length > 0) {
            return [{ title: "Notes", content: html }];
        }

        children.forEach((child) => {
            const tagName = child.tagName.toLowerCase();
            if (tagName === 'h1' || tagName === 'h2') {
                // Push previous topic if exists
                if (currentContent.length > 0) {
                    topics.push({
                        title: currentTitle || "Untitled Topic",
                        content: currentContent.join(""),
                    });
                    currentContent = [];
                }
                currentTitle = child.textContent || "Untitled Topic";
            } else {
                currentContent.push(child.outerHTML);
            }
        });

        // Push the last topic
        if (currentContent.length > 0 || topics.length === 0) {
            topics.push({
                title: currentTitle || "Untitled Topic",
                content: currentContent.join(""),
            });
        }

        return topics;
    } catch (e) {
        console.error("HTML Parsing Error (Safe Fallback):", e);
        // Fallback to single safe block
        return [{ title: "Content Error", content: "Error displaying formatted notes. Please contact admin." }];
    }
};

export const PdfView: React.FC<Props> = ({ 
  chapter, subject, user, board, classLevel, stream, onBack, onUpdateUser, settings, initialSyllabusMode, directResource
}) => {
  const [contentData, setContentData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [syllabusMode, setSyllabusMode] = useState<'SCHOOL' | 'COMPETITION'>(initialSyllabusMode || 'SCHOOL');
  const [activePdf, setActivePdf] = useState<string | null>(null);
  const [activeNoteContent, setActiveNoteContent] = useState<{title: string, content: string, pdfUrl?: string} | null>(null); // NEW: HTML Note Content + Optional PDF
  const [activeLang, setActiveLang] = useState<'ENGLISH' | 'HINDI'>('ENGLISH');
  const [pendingPdf, setPendingPdf] = useState<{type: string, price: number, link: string, tts?: string} | null>(null);
  
  // NEW: TAB STATE
  const [activeTab, setActiveTab] = useState<'QUICK' | 'DEEP_DIVE' | 'PREMIUM' | 'RESOURCES'>('QUICK');
  const [sessionUnlockedTabs, setSessionUnlockedTabs] = useState<string[]>([]);
  const [quickRevisionPoints, setQuickRevisionPoints] = useState<{title: string, points: string[]}[]>([]);
  const [currentPremiumEntryIdx, setCurrentPremiumEntryIdx] = useState(0);

  // PREMIUM TTS STATE
  const [premiumChunks, setPremiumChunks] = useState<string[]>([]);
  const [premiumChunkIndex, setPremiumChunkIndex] = useState(0);

  // DEEP DIVE STATE
  const [isDeepDiveMode, setIsDeepDiveMode] = useState(false);
  const [deepDiveTopics, setDeepDiveTopics] = useState<{ title: string, content: string }[]>([]);
  const [expandedTopics, setExpandedTopics] = useState<Record<number, boolean>>({});
  const [activeTopicIndex, setActiveTopicIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [topicSpeakingState, setTopicSpeakingState] = useState<number | null>(null); // Index of topic currently speaking

  // ZOOM STATE
  const [zoom, setZoom] = useState(1);
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  
  // INFO POPUP STATE
  const [infoPopup, setInfoPopup] = useState<{isOpen: boolean, config: any, type: 'FREE' | 'PREMIUM'}>({isOpen: false, config: {}, type: 'FREE'});

  // TTS STATE (Global)
  const [speechRate, setSpeechRate] = useState(1.0);

  const getFeatureIdForTab = (tab: string) => {
      switch(tab) {
          case 'QUICK': return 'QUICK_REVISION';
          case 'DEEP_DIVE': return 'DEEP_DIVE';
          case 'PREMIUM': return 'PREMIUM_NOTES';
          case 'RESOURCES': return 'ADDITIONAL_NOTES';
          default: return 'QUICK_REVISION';
      }
  };

  const getTabAccess = (tabId: string) => {
      // 1. Admin / Bypass
      if (user.role === 'ADMIN') return { hasAccess: true, cost: 0, reason: 'ADMIN' };
      if (user.unlockedContent && user.unlockedContent.includes(chapter.id)) return { hasAccess: true, cost: 0, reason: 'CHAPTER_UNLOCKED' };

      // 2. Session Unlock
      if (sessionUnlockedTabs.includes(tabId)) return { hasAccess: true, cost: 0, reason: 'SESSION_UNLOCKED' };

      // 3. Strict Premium & Credit Rules (Requested)
      if (tabId === 'QUICK') {
          return { hasAccess: true, cost: 0, reason: 'FREE_FOR_ALL' };
      }

      // It's Concept (DEEP_DIVE), Retention (PREMIUM), or Extended (RESOURCES)
      const isSubscribed = user.subscriptionTier && user.subscriptionTier !== 'FREE';
      const isPremium = user.isPremium || isSubscribed;

      if (!isPremium) {
          // Free users are completely blocked from premium tabs
          return { hasAccess: false, cost: 0, reason: 'TIER_RESTRICTED' };
      }

      // For Premium users, they still need to spend credits. We fetch the cost from config.
      const featureId = getFeatureIdForTab(tabId);
      const accessObj = checkFeatureAccess(featureId, user, settings || {});

      // Force it to require credits, even if checkFeatureAccess says hasAccess=true and cost=0.
      // We will fallback to a default cost if none is configured.
      const actualCost = accessObj.cost > 0 ? accessObj.cost : 10; // Default 10 if not configured

      // If they haven't unlocked it in this session (checked in step 2), it's "locked" pending payment.
      return { hasAccess: false, cost: actualCost, reason: 'CREDITS_REQUIRED' };
  };
  
  const stopAllSpeech = () => {
      stopSpeech();
      setIsAutoPlaying(false);
      setTopicSpeakingState(null);
      setPremiumChunks([]);
      setPremiumChunkIndex(0);
  };

  useEffect(() => {
    return () => stopAllSpeech();
  }, [activePdf, isDeepDiveMode, activeTab]);

  // PREMIUM AUTO-PLAY LOGIC (Chunked)
  useEffect(() => {
      if (isAutoPlaying && activeTab === 'PREMIUM' && premiumChunks.length > 0) {
          if (premiumChunkIndex < premiumChunks.length) {
              speakText(
                  premiumChunks[premiumChunkIndex],
                  null,
                  speechRate,
                  'hi-IN',
                  undefined,
                  () => {
                      // On Chunk End
                      if (isAutoPlaying) { // Ensure user hasn't stopped it
                          if (premiumChunkIndex + 1 < premiumChunks.length) {
                              setPremiumChunkIndex(prev => prev + 1);
                          } else {
                              setIsAutoPlaying(false);
                              setPremiumChunkIndex(0);
                          }
                      }
                  }
              );
          }
      }
  }, [isAutoPlaying, premiumChunkIndex, activeTab, premiumChunks]);

  // DEEP DIVE AUTO-PLAY LOGIC
  useEffect(() => {
      if (isAutoPlaying && activeTab === 'DEEP_DIVE' && deepDiveTopics.length > 0) {
          const currentIndex = activeTopicIndex; // Start from current viewed

          if (currentIndex < deepDiveTopics.length) {
              const topic = deepDiveTopics[currentIndex];
              setTopicSpeakingState(currentIndex);

              // Scroll to topic
              document.getElementById(`topic-card-${currentIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

              speakText(
                  topic.content, // speakText strips HTML automatically
                  null,
                  speechRate,
                  'hi-IN',
                  undefined,
                  () => {
                      // On End
                      if (isAutoPlaying) {
                          if (currentIndex + 1 < deepDiveTopics.length) {
                              setActiveTopicIndex(currentIndex + 1);
                          } else {
                              setIsAutoPlaying(false);
                              setTopicSpeakingState(null);
                          }
                      }
                  }
              );
          }
      }
  }, [isAutoPlaying, activeTopicIndex, activeTab]); // Trigger when index updates in auto mode

  const handleTopicPlay = (index: number) => {
      if (topicSpeakingState === index) {
          // Pause/Stop
          stopSpeech();
          setTopicSpeakingState(null);
          setIsAutoPlaying(false);
      } else {
          // Play specific topic
          stopSpeech();
          setIsAutoPlaying(false); // Disable auto-sequence
          setTopicSpeakingState(index);
          const topic = deepDiveTopics[index];
          speakText(
              topic.content,
              null,
              speechRate,
              'hi-IN',
              undefined,
              () => setTopicSpeakingState(null)
          );
      }
  };

  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullScreen = () => {
      setIsFullscreen(prev => !prev);
  };

  // Interstitial State
  const [showInterstitial, setShowInterstitial] = useState(false);
  const [pendingLink, setPendingLink] = useState<string | null>(null);
  const [pendingTts, setPendingTts] = useState<string | null>(null);

  // Alert
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});

  // DEEP DIVE AUTO-OPEN ZEN MODE LOGIC
  // Moved to top level to avoid React Hook Error #310
  const deepDiveAccess = getTabAccess('DEEP_DIVE');
  useEffect(() => {
      if (activeTab === 'DEEP_DIVE' && deepDiveAccess.hasAccess) {
          // Auto open first premium content
          handlePdfClick('PREMIUM');
      }
  }, [activeTab, deepDiveAccess.hasAccess]);

  // Data Fetching & Processing
  useEffect(() => {
    if (directResource) {
        setLoading(false);
        setActivePdf(directResource.url);
        return;
    }
    const fetchData = async () => {
      try {
        setLoading(true);
        const streamKey = (classLevel === '11' || classLevel === '12') && stream ? `-${stream}` : '';
        const key = `nst_content_${board}_${classLevel}${streamKey}_${subject.name}_${chapter.id}`;
        let data = await getChapterData(key);
        if (!data) {
            const stored = localStorage.getItem(key);
            if (stored) data = JSON.parse(stored);
        }
        setContentData(data || {});

        // PROCESS NEW CONTENT STRUCTURE (SAFE)
        if (data) {
            // Determine Entries based on Mode
            let entries: DeepDiveEntry[] = [];
            if (syllabusMode === 'SCHOOL') {
                entries = data.schoolDeepDiveEntries || data.deepDiveEntries || [];
            } else {
                entries = data.competitionDeepDiveEntries || [];
            }

            // 1. QUICK REVISION EXTRACTION
            const quickGroups: {title: string, points: string[]}[] = [];

            try {
                entries.forEach((entry, index) => {
                    if (entry.htmlContent) {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = entry.htmlContent;

                        // Look for a fallback title if entry.title is undefined.
                        // Many NCERT-style HTML files start with an <h2> or <h3>
                        let topicTitle = entry.title?.trim();
                        if (!topicTitle) {
                            const firstHeading = tempDiv.querySelector('h1, h2, h3, h4');
                            if (firstHeading && firstHeading.textContent) {
                                topicTitle = firstHeading.textContent.trim();
                            } else {
                                topicTitle = `Topic ${index + 1}`;
                            }
                        }

                        const currentTopicPoints: string[] = [];

                        // 1. Explicit CSS Class Extraction (For newly styled notes)
                        const topicCards = tempDiv.querySelectorAll('.topic-card');

                        if (topicCards.length > 0) {
                            // If structured topic cards exist, group by each card
                            topicCards.forEach((card, cardIndex) => {
                                // Find title specific to this card
                                let cardTitle = `Topic ${cardIndex + 1}`;
                                const heading = card.querySelector('h1, h2, h3, h4');
                                if (heading && heading.textContent) {
                                    cardTitle = heading.textContent.trim();
                                } else {
                                    // If no heading inside card, try to find one right before it
                                    const prevElement = card.previousElementSibling;
                                    if (prevElement && /^h[1-6]$/i.test(prevElement.tagName) && prevElement.textContent) {
                                        cardTitle = prevElement.textContent.trim();
                                    }
                                }

                                const cardPoints: string[] = [];
                                const specificBlocks = card.querySelectorAll('.recap, .quick-revision');
                                specificBlocks.forEach(block => {
                                    if (block.outerHTML) {
                                        cardPoints.push(block.outerHTML);
                                    }
                                });

                                if (cardPoints.length > 0) {
                                    quickGroups.push({ title: cardTitle, points: cardPoints });
                                }
                            });
                        } else {
                            // 2. Fallback regex approach to grab specific blocks if no explicit classes
                            const regex = /(?:<b>|<strong>)?\s*Quick Revision:?\s*(?:<\/b>|<\/strong>)?\s*(.*?)(?:<hr\/?>|<\/p>|<br\/?>|$)/gi;
                            let match;
                            while ((match = regex.exec(entry.htmlContent)) !== null) {
                                if (match[1] && match[1].trim().length > 0) {
                                    currentTopicPoints.push(`<b>Quick Revision:</b> ${match[1].trim()}`);
                                }
                            }

                            // 3. Fallback DOM based extraction using TreeWalker
                            const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_ELEMENT, {
                                acceptNode: (node: Element) => {
                                    const tag = node.tagName.toLowerCase();
                                    if (['p', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
                                        return NodeFilter.FILTER_ACCEPT;
                                    }
                                    return NodeFilter.FILTER_SKIP;
                                }
                            });

                            let currentNode = walker.nextNode() as Element | null;
                            while (currentNode) {
                                const text = currentNode.textContent || '';
                                const lowerText = text.toLowerCase();

                                // Check if the current node contains a trigger word
                                if (lowerText.includes('quick revision') || lowerText.includes('mini revision') || lowerText.includes('recap')) {

                                    // Avoid re-extracting the overall topic title if it contains the word "revision" by accident
                                    if (currentNode.textContent?.trim() === topicTitle) {
                                        currentNode = walker.nextNode() as Element | null;
                                        continue;
                                    }

                                    if (/^h[1-6]$/.test(currentNode.tagName.toLowerCase())) {
                                        let nextSibling = currentNode.nextElementSibling;

                                        while (nextSibling && !['p', 'ul', 'ol', 'div', 'blockquote'].includes(nextSibling.tagName.toLowerCase())) {
                                            nextSibling = nextSibling.nextElementSibling;
                                        }

                                        if (nextSibling) {
                                            if (['ul', 'ol'].includes(nextSibling.tagName.toLowerCase())) {
                                                const listItems = Array.from(nextSibling.querySelectorAll('li'));
                                                listItems.forEach(li => {
                                                    const cleanLiHtml = li.innerHTML.trim();
                                                    if (cleanLiHtml && !currentTopicPoints.some(qp => qp.includes(cleanLiHtml) || cleanLiHtml.includes(qp))) {
                                                        currentTopicPoints.push(`<li>${cleanLiHtml}</li>`);
                                                    }
                                                });
                                            } else {
                                                const cleanBlockHtml = nextSibling.innerHTML.trim();
                                                if (cleanBlockHtml && !currentTopicPoints.some(qp => qp.includes(cleanBlockHtml) || cleanBlockHtml.includes(qp))) {
                                                    currentTopicPoints.push(cleanBlockHtml);
                                                }
                                            }
                                        }
                                    } else {
                                        const cleanHtml = currentNode.innerHTML.trim();

                                        if (cleanHtml && !currentTopicPoints.some(qp => qp.includes(cleanHtml) || cleanHtml.includes(qp.replace(/<(?:b|strong)>.*?(?:<\/b>|<\/strong>)/gi, '').trim()))) {
                                             currentTopicPoints.push(cleanHtml);
                                        }
                                    }
                                }
                                currentNode = walker.nextNode() as Element | null;
                            }

                            if (currentTopicPoints.length > 0) {
                                quickGroups.push({ title: topicTitle, points: currentTopicPoints });
                            }
                        }
                    }
                });
            } catch(e) {
                console.error("Quick Revision Extraction Error:", e);
            }
            setQuickRevisionPoints(quickGroups);

            // 2. DEEP DIVE TOPICS AGGREGATION
            // Combine all entries
            let allTopics: { title: string, content: string }[] = [];

            try {
                // If legacy Deep Dive HTML exists, include it first
                const legacyHtml = syllabusMode === 'SCHOOL' ? data.deepDiveNotesHtml : data.competitionDeepDiveNotesHtml;
                if (legacyHtml) {
                    allTopics = [...allTopics, ...extractTopicsFromHtml(legacyHtml)];
                }

                entries.forEach(entry => {
                    if (entry.htmlContent) {
                        allTopics = [...allTopics, ...extractTopicsFromHtml(entry.htmlContent)];
                    }
                });
            } catch(e) {
                console.error("Deep Dive Aggregation Error:", e);
            }
            setDeepDiveTopics(allTopics);
        }

      } catch (error) {
        console.error("Error loading PDF data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [chapter.id, board, classLevel, stream, subject.name, directResource, syllabusMode]);

  const handlePdfClick = (type: 'FREE' | 'PREMIUM' | 'ULTRA' | 'DEEP_DIVE' | 'AUDIO_SLIDE') => {
      // Reset Deep Dive State
      setIsDeepDiveMode(false);

      let link = '';
      let htmlContent = '';
      let price = 0;
      let ttsContent: string | undefined = undefined;

      if (type === 'FREE') {
          // ... (Existing Logic) ...
          const htmlKey = syllabusMode === 'SCHOOL' ? 'schoolFreeNotesHtml' : 'competitionFreeNotesHtml';
          if (syllabusMode === 'SCHOOL') {
              link = contentData?.schoolPdfLink || contentData?.freeLink;
              htmlContent = contentData?.[htmlKey] || contentData?.freeNotesHtml;
          } else {
              link = contentData?.competitionPdfLink;
              htmlContent = contentData?.[htmlKey];
          }
          price = 0;
      } else if (type === 'PREMIUM') { // Renamed visually to Auto TTS
          // ... (Existing Logic) ...
          const htmlKey = syllabusMode === 'SCHOOL' ? 'schoolPremiumNotesHtml' : 'competitionPremiumNotesHtml';
          if (syllabusMode === 'SCHOOL') {
             link = contentData?.schoolPdfPremiumLink || contentData?.premiumLink; 
             htmlContent = contentData?.[htmlKey] || contentData?.premiumNotesHtml; 
             price = contentData?.schoolPdfPrice || contentData?.price;
          } else {
             link = contentData?.competitionPdfPremiumLink;
             htmlContent = contentData?.[htmlKey];
             price = contentData?.competitionPdfPrice;
          }
          if (price === undefined) price = (settings?.defaultPdfCost ?? 5);
      } else if (type === 'ULTRA') {
          link = contentData?.ultraPdfLink;
          price = contentData?.ultraPdfPrice !== undefined ? contentData.ultraPdfPrice : 10;
      } else if (type === 'DEEP_DIVE') {
          htmlContent = syllabusMode === 'SCHOOL' ? (contentData?.deepDiveNotesHtml || '') : (contentData?.competitionDeepDiveNotesHtml || '');
          // Prepare Topics immediately
          const extracted = extractTopicsFromHtml(htmlContent);
          setDeepDiveTopics(extracted);

          // Access Check Handled Below
      } else if (type === 'AUDIO_SLIDE') {
          link = syllabusMode === 'SCHOOL' ? (contentData?.schoolPdfPremiumLink || contentData?.premiumLink) : contentData?.competitionPdfPremiumLink;
          const rawTts = syllabusMode === 'SCHOOL' ? (contentData?.deepDiveNotesHtml || '') : (contentData?.competitionDeepDiveNotesHtml || '');
          ttsContent = rawTts.replace(/<[^>]*>?/gm, ' ');
      }

      // Prioritize Link, but allow HTML if link is missing
      // For Deep Dive, we handle specially
      const targetContent = type === 'DEEP_DIVE' ? 'DEEP_DIVE_MODE' : (link || htmlContent);

      if (!targetContent && type !== 'DEEP_DIVE') {
          // Coming Soon removed
          return;
      }

      if (type === 'DEEP_DIVE' && (!htmlContent || htmlContent.length < 10)) {
           // Coming Soon removed
           return;
      }

      // ... (Access Check Logic - mostly same) ...
      // Only change: If type === 'DEEP_DIVE', we activate the mode instead of setActivePdf link

      const proceed = () => {
          if (type === 'DEEP_DIVE') {
              triggerInterstitial('DEEP_DIVE_MODE');
          } else {
              triggerInterstitial(targetContent, ttsContent);
          }
      };

      // Check permissions... (Simplified for brevity, assuming same logic as before)
      // Access Check
      if (user.role === 'ADMIN') { proceed(); return; }
      if (user.unlockedContent && user.unlockedContent.includes(chapter.id)) { proceed(); return; }

      // Granular Feature Control
      if (type === 'DEEP_DIVE') {
          const access = checkFeatureAccess('DEEP_DIVE', user, settings || {});
          if (!access.hasAccess) {
              if (access.reason === 'FEED_LOCKED') {
                  setAlertConfig({isOpen: true, message: `🔒 Locked! This content is currently disabled by Admin.`});
                  return;
              }
              // If user is FREE, let them pay instead of blocking completely
              if (access.reason === 'TIER_RESTRICTED' && access.cost > 0) {
                   if (user.isAutoDeductEnabled) processPaymentAndOpen(targetContent, access.cost, false, ttsContent, true);
                   else setPendingPdf({ type, price: access.cost, link: targetContent, tts: ttsContent });
                   return;
              }
              // Otherwise (e.g., zero cost or other reason), default block
              if (access.cost > 0) {
                  if (user.isAutoDeductEnabled) processPaymentAndOpen(targetContent, access.cost, false, ttsContent, true);
                  else setPendingPdf({ type, price: access.cost, link: targetContent, tts: ttsContent });
              } else {
                  setAlertConfig({isOpen: true, message: `🔒 Locked! Upgrade your plan to access Deep Dive.`});
              }
              return;
          }
      }

      // Premium Notes (Audio Slide) - Now uses PREMIUM_NOTES feature
      if (type === 'AUDIO_SLIDE' || type === 'PREMIUM') {
          const access = checkFeatureAccess('PREMIUM_NOTES', user, settings || {});
          if (!access.hasAccess) {
              if (access.reason === 'FEED_LOCKED') {
                  setAlertConfig({isOpen: true, message: `🔒 Locked! This content is currently disabled by Admin.`});
                  return;
              }
              // If user is FREE, let them pay instead of blocking completely
              if (access.reason === 'TIER_RESTRICTED' && access.cost > 0) {
                   if (user.isAutoDeductEnabled) processPaymentAndOpen(targetContent, access.cost, false, ttsContent, false);
                   else setPendingPdf({ type, price: access.cost, link: targetContent, tts: ttsContent });
                   return;
              }
              // Otherwise block
              if (access.cost > 0) {
                  if (user.isAutoDeductEnabled) processPaymentAndOpen(targetContent, access.cost, false, ttsContent, false);
                  else setPendingPdf({ type, price: access.cost, link: targetContent, tts: ttsContent });
              } else {
                  setAlertConfig({isOpen: true, message: `🔒 Locked! Upgrade your plan to access Premium Notes.`});
              }
              return;
          }
      }

      if (price === 0) { proceed(); return; }

      const isSubscribed = user.isPremium && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date();
      if (isSubscribed) {
          // Tier Checks...
          if (user.subscriptionTier === 'YEARLY' || user.subscriptionTier === 'LIFETIME' || user.subscriptionLevel === 'ULTRA' || user.subscriptionLevel === 'BASIC') {
              proceed(); return;
          }
      }

      if (user.isAutoDeductEnabled) processPaymentAndOpen(targetContent, price, false, ttsContent, type === 'DEEP_DIVE');
      else setPendingPdf({ type, price, link: targetContent, tts: ttsContent });
  };

  const processPaymentAndOpen = (targetContent: string, price: number, enableAuto: boolean = false, ttsContent?: string, isDeepDive: boolean = false) => {
      if (user.credits < price) {
          setAlertConfig({isOpen: true, message: `Insufficient Credits! You need ${price} coins.`});
          return;
      }

      // Handle Tab Unlock
      if (targetContent.startsWith('UNLOCK_TAB_')) {
          const tabId = targetContent.replace('UNLOCK_TAB_', '');
          setSessionUnlockedTabs(prev => [...prev, tabId]);

          let updatedUser = { ...user, credits: user.credits - price };
          if (enableAuto) updatedUser.isAutoDeductEnabled = true;
          saveUserLocal(updatedUser);
          saveUserToLive(updatedUser);
          onUpdateUser(updatedUser);

          setActiveTab(tabId as any); // Actually switch the tab now that it's paid
          setPendingPdf(null);
          return;
      }

      let updatedUser = { ...user, credits: user.credits - price };
      if (enableAuto) updatedUser.isAutoDeductEnabled = true;
      
      saveUserLocal(updatedUser);
      saveUserToLive(updatedUser);
      onUpdateUser(updatedUser);
      
      if (isDeepDive) triggerInterstitial('DEEP_DIVE_MODE');
      else triggerInterstitial(targetContent, ttsContent);
      setPendingPdf(null);
  };

  const triggerInterstitial = (link: string, tts?: string) => {
      setPendingLink(link);
      setPendingTts(tts || null);
      setShowInterstitial(true);
  };

  const onInterstitialComplete = () => {
      setShowInterstitial(false);
      if (pendingLink) {
          if (pendingLink === 'DEEP_DIVE_MODE') {
              setIsDeepDiveMode(true);
              setActivePdf(null);
          } else {
              setActivePdf(pendingLink);
              // Auto-start TTS for Audio Slide is handled in useEffect or button
          }
          setPendingLink(null);
          setPendingTts(null);
      }
  };

  // ... (Render Helpers) ...

  // RENDER
  if (showInterstitial) {
      const isPremiumUser = user.isPremium && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date();
      const aiImage = contentData?.chapterAiImage || settings?.aiLoadingImage;
      return <AiInterstitial onComplete={onInterstitialComplete} userType={isPremiumUser ? 'PREMIUM' : 'FREE'} imageUrl={aiImage} contentType="PDF" />;
  }

  // PDF OVERLAY (Zen Mode for Premium/Additional)
  if (activePdf) {
      const formattedLink = formatDriveLink(activePdf);
      return (
          <div className="fixed inset-0 z-[9999] bg-black flex flex-col animate-in fade-in zoom-in-95 h-screen w-screen overflow-hidden">
              {/* Minimal Floating Controls */}
              <div className="absolute top-4 left-4 z-50">
                  <button onClick={() => { setActivePdf(null); stopAllSpeech(); }} className="bg-black/50 backdrop-blur-md text-white p-3 rounded-full hover:bg-black/70 border border-white/20 shadow-lg">
                      <ArrowLeft size={24} />
                  </button>
              </div>

              <div className="flex-1 relative w-full h-full">
                  <iframe
                      src={formattedLink}
                      className="w-full h-full border-none"
                      title="PDF Viewer"
                      allow="autoplay"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups-to-escape-sandbox"
                  />
                  {/* Invisible Overlay to block top bar clicks if iframe sandbox isn't enough */}
                  <div className="absolute top-0 left-0 w-full h-16 bg-transparent pointer-events-auto" onClick={(e) => e.stopPropagation()} />
              </div>
          </div>
      );
  }

  // RESOURCE OVERLAY (Handles Text-Only AND PDF+Text) - ZEN MODE
  if (activeNoteContent) {
      const hasPdf = !!activeNoteContent.pdfUrl;
      const formattedLink = hasPdf ? formatDriveLink(activeNoteContent.pdfUrl!) : '';

      return (
          <div className="fixed inset-0 z-[9999] bg-slate-50 flex flex-col animate-in fade-in zoom-in-95 h-screen w-screen overflow-hidden">
              {/* Minimal Floating Controls */}
              <div className="absolute top-4 left-4 z-50 flex gap-4">
                  <button onClick={() => { setActiveNoteContent(null); stopAllSpeech(); }} className="bg-white/80 backdrop-blur-md text-slate-800 p-3 rounded-full hover:bg-white shadow-lg border border-slate-200">
                      <ArrowLeft size={24} />
                  </button>

                  {/* TTS Toggle */}
                  <button
                      onClick={() => {
                          if (isAutoPlaying) {
                              stopAllSpeech();
                          } else {
                              setIsAutoPlaying(true);
                              const plainText = activeNoteContent.content.replace(/<[^>]*>?/gm, ' ');
                              speakText(plainText, null, speechRate, 'hi-IN', undefined, () => setIsAutoPlaying(false));
                          }
                      }}
                      className={`bg-white/80 backdrop-blur-md p-3 rounded-full hover:bg-white border border-slate-200 shadow-lg ${isAutoPlaying ? 'text-blue-600 border-blue-400 animate-pulse bg-blue-50' : 'text-slate-800'}`}
                  >
                      {isAutoPlaying ? <Pause size={24} /> : <Headphones size={24} />}
                  </button>
              </div>

              <div className="flex-1 relative flex flex-col w-full h-full">
                  {hasPdf ? (
                      // PDF VIEW (Full Screen)
                      <div className="flex-1 relative w-full h-full bg-black">
                          <iframe
                              src={formattedLink}
                              className="w-full h-full border-none"
                              title="PDF Viewer"
                              allow="autoplay"
                              sandbox="allow-scripts allow-same-origin allow-forms allow-popups-to-escape-sandbox"
                          />
                          <div className="absolute top-0 left-0 w-full h-16 bg-transparent pointer-events-auto" onClick={(e) => e.stopPropagation()} />
                      </div>
                  ) : (
                      // TEXT ONLY VIEW (Light Mode Reader)
                      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50">
                          <div className="max-w-full w-full mx-auto pt-16 pb-20 reading-mode">
                              <div className="bg-white rounded-2xl md:rounded-[14px] p-6 md:p-[18px] shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-slate-200/60 mb-4 note-card">
                                  <h1 className="font-semibold text-slate-900 mb-4 pb-4 border-b border-slate-100 leading-tight text-[22px]">{activeNoteContent.title}</h1>
                                  <div className="prose prose-slate max-w-none note-text text-slate-800 marker:text-blue-500 prose-headings:text-slate-900 prose-headings:font-semibold prose-a:text-blue-600 prose-p:mb-4 prose-ul:mb-4 prose-li:my-2" dangerouslySetInnerHTML={{ __html: activeNoteContent.content }} />
                              </div>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      );
  }

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Notes: ${chapter.title}`,
          text: `Check out the revision notes for ${chapter.title} on IIC App!`,
          url: window.location.href,
        });
      } else {
        setAlertConfig({ isOpen: true, message: "Share is not supported on this device." });
      }
    } catch (err) {
      console.warn("Error sharing:", err);
    }
  };

  // --- NEW TABBED VIEW ---
  return (
    <div
        ref={pdfContainerRef}
        className={`bg-slate-50 min-h-screen pb-20 animate-in fade-in slide-in-from-right-8 ${
            isFullscreen
                ? 'fixed inset-0 z-[9999] overflow-y-auto w-full h-full overscroll-none'
                : 'relative'
        }`}
    >
       <CustomAlert
           isOpen={alertConfig.isOpen}
           message={alertConfig.message}
           onClose={() => setAlertConfig({...alertConfig, isOpen: false})}
       />

       {/* HEADER */}
       <div className="sticky top-0 z-30 bg-white border-b border-slate-100 shadow-sm flex flex-col">
           <div className="p-4 flex items-center gap-3">
               <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
                   <ArrowLeft size={20} />
               </button>
               <div className="flex-1">
                   <div className="flex justify-between items-start">
                     <div>
                       <h3 className="font-bold text-slate-800 leading-tight line-clamp-1">{chapter.title}</h3>
                       <div className="flex gap-2 mt-1">
                         <button onClick={() => setSyllabusMode('SCHOOL')} className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-all ${syllabusMode === 'SCHOOL' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500'}`}>School</button>
                         <button onClick={() => setSyllabusMode('COMPETITION')} className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-all ${syllabusMode === 'COMPETITION' ? 'bg-purple-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500'}`}>Competition</button>
                       </div>
                     </div>
                     <div className="flex items-center gap-2">
                         <button onClick={toggleFullScreen} className="p-2 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors shrink-0 border border-slate-200" title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                             {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                         </button>
                         <button onClick={handleShare} className="p-2 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors shrink-0 border border-slate-200">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                         </button>
                     </div>
                   </div>
               </div>
           </div>

           {/* TABS */}
           <div className="flex overflow-x-auto border-t border-slate-100 scrollbar-hide">
               {[
                   { id: 'QUICK', label: 'Quick Notes', icon: Zap },
                   { id: 'DEEP_DIVE', label: 'Detailed Concept', icon: BookOpen },
                   { id: 'PREMIUM', label: 'Memory Mode', icon: Crown },
                   { id: 'RESOURCES', label: 'Extra', icon: Layers }
                       ].map(tab => {
                           const { hasAccess, cost } = getTabAccess(tab.id);
                           const isLocked = !hasAccess;

                           return (
                               <button
                                   key={tab.id}
                                   onClick={() => {
                                       if (isLocked) {
                                           if (cost > 0) {
                                               setPendingPdf({ type: tab.id as any, price: cost, link: `UNLOCK_TAB_${tab.id}` });
                                           } else {
                                               setAlertConfig({isOpen: true, message: `🔒 Locked! Upgrade your plan or wait for Admin access.`});
                                           }
                                           return;
                                       }
                                       setActiveTab(tab.id as any);
                                       stopAllSpeech();
                                   }}
                                   className={`flex-1 min-w-[100px] py-3 text-xs font-bold flex flex-col items-center gap-1 border-b-2 transition-all ${activeTab === tab.id ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-slate-500 hover:bg-slate-50'} ${isLocked && cost === 0 ? 'grayscale' : ''}`}
                               >
                                   <div className="relative">
                                       <tab.icon size={16} />
                                       {isLocked && <div className="absolute -top-1 -right-2 bg-red-500 rounded-full p-0.5 border border-white"><Lock size={8} className="text-white"/></div>}
                                   </div>
                                   {tab.label}
                               </button>
                           );
                       })}
           </div>
       </div>

       {/* CONTENT BODY (WRAPPED IN ERROR BOUNDARY) */}
       <ErrorBoundary>
       <div className="flex-1 overflow-y-auto">

           {/* 1. QUICK REVISION */}
           {activeTab === 'QUICK' && (
               <div className={`p-4 md:p-6 space-y-6 mx-auto transition-all duration-300 ${isFullscreen ? 'max-w-full px-4 md:max-w-[95%] w-full' : 'max-w-4xl'}`}>
                   <div className="flex justify-end mb-2">
                       {quickRevisionPoints.length > 0 && (
                           <button
                               onClick={() => {
                                   if (isAutoPlaying) {
                                       stopAllSpeech();
                                   } else {
                                       setIsAutoPlaying(true);
                                       // speakText will handle HTML stripping and Emoji removal natively via stripHtml
                                       const fullText = quickRevisionPoints.flatMap(g => g.points).join('. ');
                                       speakText(fullText, null, speechRate, 'hi-IN', undefined, () => setIsAutoPlaying(false));
                                   }
                               }}
                               className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-bold text-xs transition-all ${isAutoPlaying ? 'bg-red-500 text-white animate-pulse' : 'bg-yellow-500 text-white shadow'}`}
                           >
                               {isAutoPlaying ? <Pause size={12} /> : <Play size={12} />}
                               {isAutoPlaying ? 'Stop Reading' : 'Read All'}
                           </button>
                       )}
                   </div>

                   {quickRevisionPoints.length === 0 ? (
                       <div className="text-center py-12 text-slate-400">
                           <Zap size={48} className="mx-auto mb-4 opacity-20" />
                           <p className="text-sm font-bold">No quick revision points found.</p>
                           <p className="text-xs">Points marked "Quick Revision" in notes appear here.</p>
                       </div>
                   ) : (
                       <div className="space-y-6">
                           {quickRevisionPoints.map((group, groupIdx) => (
                               <div key={groupIdx} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative group overflow-hidden">
                                   <div className="absolute top-0 left-0 w-1 h-full bg-yellow-400"></div>

                                   <div className="flex justify-between items-start mb-4">
                                       <h3 className="font-black text-slate-800 text-lg pr-8">{group.title}</h3>
                                       <button
                                           onClick={() => {
                                               stopAllSpeech();
                                               // stripHtml handles tags and emojis natively inside speakText
                                               const rawHtmlPoints = group.points.join('. ');
                                               speakText(rawHtmlPoints, null, speechRate, 'hi-IN');
                                           }}
                                           className="p-2 bg-yellow-50 text-yellow-600 rounded-full hover:bg-yellow-100 transition-colors"
                                           title="Read Topic Revision"
                                       >
                                           <Volume2 size={16} />
                                       </button>
                                   </div>

                                   <div className="space-y-[12px] pl-2">
                                       {group.points.map((point, idx) => (
                                            <div key={idx} className={`prose prose-base text-slate-700 bg-slate-50/50 p-[14px] rounded-[10px] border border-slate-200/50 max-w-none note-section note-text ${isFullscreen ? 'text-[16px]' : 'text-[16px]'}`} dangerouslySetInnerHTML={{ __html: point }} />
                                       ))}
                                   </div>
                               </div>
                           ))}
                       </div>
                   )}
               </div>
           )}

           {/* 2. DEEP DIVE (HTML + SCROLL) */}
           {activeTab === 'DEEP_DIVE' && (
               <div className={`p-[16px] space-y-[16px] mx-auto transition-all duration-300 ${isFullscreen ? 'max-w-full w-full reading-mode' : 'max-w-[600px] reading-mode'}`}>
                   {(() => {
                        const access = getTabAccess('DEEP_DIVE');

                        if (!access.hasAccess) {
                            return (
                                <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in-95">
                                    <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mb-6 shadow-sm border border-teal-100">
                                        <Lock size={32} className="text-teal-600" />
                                    </div>
                                    <h2 className="text-xl font-black text-slate-800 mb-2">Deep Dive Mode Locked</h2>
                                    <p className="text-sm text-slate-500 max-w-sm mb-8 leading-relaxed">
                                        {access.reason === 'FEED_LOCKED' ? 'This content is currently locked by admin.' : 'Unlock in-depth conceptual notes to master this chapter.'}
                                    </p>

                                    {access.reason !== 'FEED_LOCKED' && access.cost > 0 ? (
                                        <button
                                            onClick={() => setPendingPdf({ type: 'DEEP_DIVE', price: access.cost, link: 'UNLOCK_TAB_DEEP_DIVE' })}
                                            className="px-8 py-3 bg-teal-600 text-white font-bold rounded-xl shadow-lg hover:bg-teal-700 hover:scale-105 transition-all flex items-center gap-2"
                                        >
                                            <Zap size={18} /> Unlock for {access.cost} Credits
                                        </button>
                                    ) : access.reason !== 'FEED_LOCKED' ? (
                                        <div className="px-6 py-2 bg-slate-100 text-slate-500 font-bold rounded-lg text-xs uppercase tracking-wider">
                                            Upgrade Plan to Access
                                        </div>
                                    ) : null}
                                </div>
                            );
                        }

                        return (
                           <>
                               <div className="flex justify-between items-center mb-4">
                                   <p className="text-xs font-bold text-slate-500 uppercase">{deepDiveTopics.length} Sections</p>
                                   <button
                                      onClick={() => {
                                          if (isAutoPlaying) {
                                              setIsAutoPlaying(false);
                                              stopSpeech();
                                          } else {
                                              setIsAutoPlaying(true);
                                              setActiveTopicIndex(0);
                                          }
                                      }}
                                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-bold text-xs transition-all ${isAutoPlaying ? 'bg-red-500 text-white animate-pulse' : 'bg-teal-600 text-white shadow'}`}
                                  >
                                      {isAutoPlaying ? <Pause size={12} /> : <Play size={12} />}
                                      {isAutoPlaying ? 'Stop' : 'Auto Play'}
                                  </button>
                               </div>

                               {deepDiveTopics.length === 0 && (
                                   <div className="text-center py-12 text-slate-400">
                                       <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
                                       <p className="text-sm font-bold">No Deep Dive content available.</p>
                                   </div>
                               )}

                               {deepDiveTopics.map((topic, idx) => {
                                  const isActive = topicSpeakingState === idx;
                                  const isExpanded = expandedTopics[idx] ?? true; // Default open for now, or true for first, false for others

                                  return (
                                      <div
                                          id={`topic-card-${idx}`}
                                          key={idx}
                                          className={`bg-white rounded-xl shadow-sm border border-slate-200 transition-all overflow-hidden ${isActive ? 'border-teal-400 ring-2 ring-teal-100' : ''}`}
                                      >
                                          {/* STICKY HEADER WITH ACCORDION */}
                                          <div
                                            className="sticky top-0 z-10 bg-white border-b border-slate-100 p-4 md:p-5 flex justify-between items-start cursor-pointer hover:bg-slate-50 transition-colors"
                                            onClick={() => setExpandedTopics(prev => ({...prev, [idx]: !isExpanded}))}
                                          >
                                              <div className="flex-1 pr-4">
                                                  {idx === 0 && topic.title !== "Introduction" && (
                                                      <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded mb-1 inline-block uppercase">
                                                          Deep Dive Concept
                                                      </span>
                                                  )}
                                                  {idx > 0 && (
                                                      <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded mb-1 inline-block uppercase">
                                                          Topic {idx}
                                                      </span>
                                                  )}
                                                  <div className="flex items-center gap-2 mt-1">
                                                      <h4 className="text-[16px] md:text-lg font-black text-slate-800 leading-tight">{topic.title}</h4>
                                                      <button
                                                          className="text-slate-400 hover:text-slate-700 bg-slate-50 rounded-md p-0.5"
                                                          title="Toggle Content"
                                                      >
                                                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                      </button>
                                                  </div>
                                              </div>
                                              <button
                                                  onClick={(e) => {
                                                      e.stopPropagation(); // Don't trigger accordion when clicking play
                                                      handleTopicPlay(idx);
                                                      // Auto-expand when playing if it's not already active
                                                      if (!isActive) {
                                                          setExpandedTopics(prev => ({...prev, [idx]: true}));
                                                      }
                                                  }}
                                                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 ${isActive ? 'bg-teal-500 text-white shadow-md animate-pulse' : 'bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-700'}`}
                                                  title={isActive ? "Stop Reading" : "Listen"}
                                              >
                                                  {isActive ? <Pause size={14} /> : <Play size={14} />}
                                                  <span className="hidden sm:inline">{isActive ? 'Stop' : 'Listen'}</span>
                                              </button>
                                          </div>

                                          {/* ACCORDION CONTENT */}
                                          {isExpanded && (
                                              <div className="p-[18px] bg-slate-50/50 rounded-b-[14px]">
                                                  <div
                                                      className={`prose prose-sm md:prose-base max-w-none note-text text-slate-700 marker:text-teal-500 prose-headings:text-slate-800 prose-headings:font-semibold prose-a:text-teal-600 prose-img:rounded-[12px] prose-img:shadow-sm ${isFullscreen ? 'text-[16px]' : 'text-[16px]'}`}
                                                      dangerouslySetInnerHTML={{ __html: topic.content }}
                                                  />
                                              </div>
                                          )}
                                      </div>
                                  );
                              })}
                           </>
                        );
                   })()}
               </div>
           )}

           {/* 3. PREMIUM NOTES (PDF + TTS) */}
           {activeTab === 'PREMIUM' && (
               <div className="h-[calc(100vh-140px)] flex flex-col">
                   {(() => {
                        const access = getTabAccess('PREMIUM');

                        if (!access.hasAccess) {
                            return (
                                <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in-95 bg-slate-50 h-full">
                                    <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mb-6 shadow-sm border border-purple-100">
                                        <Lock size={32} className="text-purple-600" />
                                    </div>
                                    <h2 className="text-xl font-black text-slate-800 mb-2">Premium Audio Slides Locked</h2>
                                    <p className="text-sm text-slate-500 max-w-sm mb-8 leading-relaxed">
                                        {access.reason === 'FEED_LOCKED' ? 'Content locked by admin.' : 'Visual slides with synchronized audio narration.'}
                                    </p>

                                    {access.reason !== 'FEED_LOCKED' && access.cost > 0 ? (
                                        <button
                                            onClick={() => setPendingPdf({ type: 'PREMIUM', price: access.cost, link: 'UNLOCK_TAB_PREMIUM' })}
                                            className="px-8 py-3 bg-purple-600 text-white font-bold rounded-xl shadow-lg hover:bg-purple-700 hover:scale-105 transition-all flex items-center gap-2"
                                        >
                                            <Zap size={18} /> Unlock for {access.cost} Credits
                                        </button>
                                    ) : access.reason !== 'FEED_LOCKED' ? (
                                        <div className="px-6 py-2 bg-slate-100 text-slate-500 font-bold rounded-lg text-xs uppercase tracking-wider">
                                            Upgrade Plan to Access
                                        </div>
                                    ) : null}
                                </div>
                            );
                        }

                        return (
                           <>
                               {/* ENTRY SELECTOR IF MULTIPLE */}
                               {(() => {
                                   let entries: DeepDiveEntry[] = [];
                                   if (syllabusMode === 'SCHOOL') entries = contentData?.schoolDeepDiveEntries || contentData?.deepDiveEntries || [];
                                   else entries = contentData?.competitionDeepDiveEntries || [];

                                   if (entries.length <= 1) return null;

                                   return (
                                       <div className="bg-slate-100 p-2 flex gap-2 overflow-x-auto border-b border-slate-200">
                                           {entries.map((_: any, i: number) => (
                                               <button
                                                   key={i}
                                                   onClick={() => {
                                                       setCurrentPremiumEntryIdx(i);
                                                       stopAllSpeech();
                                                   }}
                                                   className={`px-3 py-1 text-xs font-bold rounded-full whitespace-nowrap ${currentPremiumEntryIdx === i ? 'bg-purple-600 text-white shadow' : 'bg-white text-slate-500'}`}
                                               >
                                                   Part {i + 1}
                                               </button>
                                           ))}
                                       </div>
                                   );
                               })()}

                               <div className="flex-1 relative bg-slate-200">
                                   {(() => {
                                       // Determine Content
                                       let pdfLink = '';
                                       let ttsHtml = '';
                                       let entryTitle = '';

                                       let entries: DeepDiveEntry[] = [];
                                       if (syllabusMode === 'SCHOOL') entries = contentData?.schoolDeepDiveEntries || contentData?.deepDiveEntries || [];
                                       else entries = contentData?.competitionDeepDiveEntries || [];

                                       // Check if showing "Chapter Premium" (Legacy) or "Topic Premium" (Entry)
                                       const legacyLink = syllabusMode === 'SCHOOL' ? contentData?.premiumLink : contentData?.competitionPdfPremiumLink;
                                       const legacyHtml = syllabusMode === 'SCHOOL' ? contentData?.deepDiveNotesHtml : contentData?.competitionDeepDiveNotesHtml;
                                       const hasLegacy = legacyLink || (legacyHtml && legacyHtml.length > 10);

                                       // Construct a virtual list for selection logic: [Legacy (if exists), ...Entries]
                                       let virtualList: {title: string, pdf: string, html: string}[] = [];

                                       if (hasLegacy) {
                                           virtualList.push({
                                               title: 'Chapter Premium Note',
                                               pdf: legacyLink,
                                               html: legacyHtml
                                           });
                                       }

                                       entries.forEach((e, i) => {
                                           virtualList.push({
                                               title: e.title || `Topic Note ${i + 1}`,
                                               pdf: e.pdfLink,
                                               html: e.htmlContent
                                           });
                                       });

                                       // Safety check
                                       if (currentPremiumEntryIdx >= virtualList.length && virtualList.length > 0) {
                                           const item = virtualList[0];
                                           pdfLink = item.pdf;
                                           ttsHtml = item.html;
                                           entryTitle = item.title;
                                       } else if (virtualList.length > 0) {
                                           const item = virtualList[currentPremiumEntryIdx];
                                           pdfLink = item.pdf;
                                           ttsHtml = item.html;
                                           entryTitle = item.title;
                                       }

                                       const formattedLink = formatDriveLink(pdfLink);

                                       return (
                                           <>
                                               {/* Selection Header (Only if multiple items) */}
                                               {virtualList.length > 1 && (
                                                   <div className="absolute top-0 left-0 w-full z-20 bg-white/90 backdrop-blur-sm border-b border-slate-200 p-2 overflow-x-auto flex gap-2">
                                                       {virtualList.map((item, i) => (
                                                           <button
                                                               key={i}
                                                               onClick={() => {
                                                                   setCurrentPremiumEntryIdx(i);
                                                                   stopAllSpeech();
                                                               }}
                                                               className={`px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all flex flex-col items-center border ${currentPremiumEntryIdx === i ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                                                           >
                                                               <span>{i === 0 && hasLegacy ? 'MAIN' : `TOPIC ${hasLegacy ? i : i + 1}`}</span>
                                                               <span className="opacity-80 text-[9px] truncate max-w-[80px]">{item.title}</span>
                                                           </button>
                                                       ))}
                                                   </div>
                                               )}

                                               {/* Content Container (Adjust top padding if header exists) */}
                                               <div className={`relative w-full h-full ${virtualList.length > 1 ? 'pt-14' : ''}`}>
                                                   {pdfLink ? (
                                                       <div className="relative w-full h-full">
                                                            <iframe
                                                                src={formattedLink}
                                                                className="w-full h-full border-none"
                                                                title="PDF Viewer"
                                                                allow="autoplay"
                                                                sandbox="allow-scripts allow-same-origin allow-forms allow-popups-to-escape-sandbox"
                                                            />
                                                            {/* Invisible Header Blocker */}
                                                            <div className="absolute top-0 left-0 w-full h-12 bg-transparent pointer-events-auto" onClick={(e) => e.stopPropagation()} />
                                                       </div>
                                                   ) : (
                                                       <div className="flex items-center justify-center h-full text-slate-400 font-bold bg-slate-50">
                                                           <div className="text-center">
                                                               <FileText size={48} className="mx-auto mb-2 opacity-20" />
                                                               <p>No PDF attached for this section.</p>
                                                               <p className="text-xs font-normal mt-1 text-slate-400">{entryTitle}</p>
                                                           </div>
                                                       </div>
                                                   )}

                                                   {/* FLOATING AUDIO PLAYER */}
                                                   {(ttsHtml && ttsHtml.length > 10) && (
                                                       <div className="absolute bottom-4 right-4 bg-white p-2 rounded-full shadow-xl border border-slate-200 flex items-center gap-2 z-10 animate-in fade-in slide-in-from-bottom-4">
                                                           <button
                                                              onClick={() => {
                                                                  if (isAutoPlaying) {
                                                                      stopAllSpeech();
                                                                  } else {
                                                                      // START PLAYBACK
                                                                      const topics = extractTopicsFromHtml(ttsHtml);
                                                                      let chunks: string[] = [];

                                                                      if (topics.length > 0 && topics[0].title !== "Notes") {
                                                                          chunks = topics.map(t => `${t.title}. ${t.content}`);
                                                                      } else {
                                                                          const rawText = topics[0].content;
                                                                          if (rawText.length > 4000) {
                                                                              chunks = rawText.match(/[^.!?]+[.!?]+/g) || [rawText];
                                                                          } else {
                                                                              chunks = [rawText];
                                                                          }
                                                                      }

                                                                      setPremiumChunks(chunks);
                                                                      setPremiumChunkIndex(0);
                                                                      setIsAutoPlaying(true);
                                                                  }
                                                              }}
                                                              className={`flex items-center gap-2 px-4 py-3 rounded-full text-white shadow-lg transition-all ${isAutoPlaying ? 'bg-red-500 animate-pulse' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                                          >
                                                              {isAutoPlaying ? <Pause size={20} /> : <Headphones size={20} />}
                                                              {isAutoPlaying && <span className="text-xs font-bold">Playing...</span>}
                                                          </button>
                                                       </div>
                                                   )}
                                               </div>
                                           </>
                                       );
                                   })()}
                               </div>
                           </>
                        );
                   })()}
               </div>
           )}

           {/* 4. RESOURCES (ADDITIONAL NOTES) */}
           {activeTab === 'RESOURCES' && (
               <div className="p-4 space-y-4">
                   {(() => {
                        const access = getTabAccess('RESOURCES');

                        if (!access.hasAccess) {
                            return (
                                <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in-95">
                                    <div className="w-20 h-20 bg-cyan-50 rounded-full flex items-center justify-center mb-6 shadow-sm border border-cyan-100">
                                        <Lock size={32} className="text-cyan-600" />
                                    </div>
                                    <h2 className="text-xl font-black text-slate-800 mb-2">Additional Resources Locked</h2>
                                    <p className="text-sm text-slate-500 max-w-sm mb-8 leading-relaxed">
                                        {access.reason === 'FEED_LOCKED' ? 'This section is disabled by admin.' : 'Extra reading material and reference documents.'}
                                    </p>

                                    {access.reason !== 'FEED_LOCKED' && access.cost > 0 ? (
                                        <button
                                            onClick={() => setPendingPdf({ type: 'RESOURCES', price: access.cost, link: 'UNLOCK_TAB_RESOURCES' })}
                                            className="px-8 py-3 bg-cyan-600 text-white font-bold rounded-xl shadow-lg hover:bg-cyan-700 hover:scale-105 transition-all flex items-center gap-2"
                                        >
                                            <Zap size={18} /> Unlock for {access.cost} Credits
                                        </button>
                                    ) : access.reason !== 'FEED_LOCKED' ? (
                                        <div className="px-6 py-2 bg-slate-100 text-slate-500 font-bold rounded-lg text-xs uppercase tracking-wider">
                                            Upgrade Plan to Access
                                        </div>
                                    ) : null}
                                </div>
                            );
                        }

                        return (
                           <>
                               <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-2">
                                   <Layers size={16} className="text-cyan-600" /> Additional Resources
                               </h4>

                               {/* FREE NOTES (LEGACY SUPPORT) - Conditional Render */}
                               {(() => {
                                   const freeLink = syllabusMode === 'SCHOOL' ? (contentData?.schoolPdfLink || contentData?.freeLink) : contentData?.competitionPdfLink;
                                   const freeHtml = syllabusMode === 'SCHOOL' ? (contentData?.schoolFreeNotesHtml || contentData?.freeNotesHtml) : contentData?.competitionFreeNotesHtml;

                                   if (!freeLink && (!freeHtml || freeHtml.length < 10)) return null;

                                   return (
                                       <button onClick={() => handlePdfClick('FREE')} className="w-full p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center gap-3 transition-all">
                                           <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center"><FileText size={20} /></div>
                                           <div className="flex-1 text-left"><h4 className="font-bold text-slate-700 text-sm">Standard Notes</h4><p className="text-[10px] text-slate-400">Basic Reading Material</p></div>
                                       </button>
                                   );
                               })()}

                               {(() => {
                                   let addNotes: AdditionalNoteEntry[] = [];
                                   // STRICT MODE: Only use new fields to avoid ghost data
                                   if (syllabusMode === 'SCHOOL') addNotes = contentData?.schoolAdditionalNotes || [];
                                   else addNotes = contentData?.competitionAdditionalNotes || [];

                                   if (addNotes.length === 0) return <p className="text-center text-xs text-slate-400 py-4">No additional resources added.</p>;

                                   return addNotes.map((note: AdditionalNoteEntry, idx: number) => (
                                       <button
                                           key={idx}
                                           onClick={() => {
                                               // Smart Open Logic
                                               if (note.pdfLink && note.noteContent) {
                                                   // Hybrid Mode: Show PDF with Persistent Audio Overlay
                                                   setActiveNoteContent({
                                                       title: note.title || `Resource ${idx + 1}`,
                                                       content: note.noteContent,
                                                       pdfUrl: note.pdfLink
                                                   });
                                               } else if (note.pdfLink) {
                                                   // PDF Only
                                                   setActivePdf(note.pdfLink);
                                               } else if (note.noteContent) {
                                                   // Text Only
                                                   setActiveNoteContent({
                                                       title: note.title || `Note ${idx + 1}`,
                                                       content: note.noteContent
                                                   });
                                               }
                                           }}
                                           className="w-full p-4 rounded-xl border border-cyan-100 bg-white hover:bg-cyan-50 flex items-center gap-3 transition-all"
                                       >
                                           <div className="w-10 h-10 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center"><Book size={20} /></div>
                                           <div className="flex-1 text-left">
                                               <h4 className="font-bold text-slate-700 text-sm">{note.title || `Resource ${idx + 1}`}</h4>
                                               <p className="text-[10px] text-slate-400">
                                                   {note.pdfLink && note.noteContent ? 'PDF + Audio' : note.pdfLink ? 'PDF Document' : 'Reading Material'}
                                               </p>
                                           </div>
                                       </button>
                                   ));
                               })()}
                           </>
                        );
                   })()}
               </div>
           )}

       </div>
       </ErrorBoundary>

       {/* CONFIRMATION & INFO MODALS ... */}
       {pendingPdf && <CreditConfirmationModal title="Unlock Content" cost={pendingPdf.price} userCredits={user.credits} isAutoEnabledInitial={!!user.isAutoDeductEnabled} onCancel={() => setPendingPdf(null)} onConfirm={(auto) => processPaymentAndOpen(pendingPdf.link, pendingPdf.price, auto, pendingPdf.tts, pendingPdf.type === 'DEEP_DIVE')} />}
    </div>
  );
};
