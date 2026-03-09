import React, { useState, useEffect } from 'react';
import { User, SystemSettings, StudentTab } from '../types';
import { Bot, Sparkles, BrainCircuit, FileText, Zap, Calendar, X, AlertCircle } from 'lucide-react';
import { CustomAlert } from './CustomDialogs';
import { BannerCarousel } from './BannerCarousel';
import { Button } from './ui/Button';
import { generateSmartStudyPlan } from '../utils/studyPlanner';

interface Props {
    user: User;
    onTabChange: (tab: StudentTab) => void;
    settings?: SystemSettings;
}

export const AiHub: React.FC<Props> = ({ user, onTabChange, settings }) => {
    const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, type: 'SUCCESS'|'ERROR'|'INFO', title?: string, message: string}>({isOpen: false, type: 'INFO', message: ''});
    const [discountStatus, setDiscountStatus] = useState<'WAITING' | 'ACTIVE' | 'NONE'>('NONE');
    const [showDiscountBanner, setShowDiscountBanner] = useState(false);
    const [discountTimer, setDiscountTimer] = useState<string | null>(null);

    // NEW STATE FOR STUDY PLANNER
    const [showPlannerModal, setShowPlannerModal] = useState(false);
    const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
    const [generatedPlan, setGeneratedPlan] = useState<any>(null);

    useEffect(() => {
        const evt = settings?.specialDiscountEvent;
        const formatDiff = (diff: number) => {
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            return `${d > 0 ? d + 'd ' : ''}${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
        };
        const checkStatus = () => {
             if (!evt?.enabled) { setShowDiscountBanner(false); setDiscountStatus('NONE'); setDiscountTimer(null); return; }
             const now = Date.now();
             const startsAt = evt.startsAt ? new Date(evt.startsAt).getTime() : now;
             const endsAt = evt.endsAt ? new Date(evt.endsAt).getTime() : now;
             if (now < startsAt) {
                 setDiscountStatus('WAITING'); setShowDiscountBanner(true); setDiscountTimer(formatDiff(startsAt - now));
             } else if (now < endsAt) {
                 setDiscountStatus('ACTIVE'); setShowDiscountBanner(true); setDiscountTimer(formatDiff(endsAt - now));
             } else {
                 setDiscountStatus('NONE'); setShowDiscountBanner(false); setDiscountTimer(null);
             }
        };
        checkStatus();
        if (evt?.enabled) { const interval = setInterval(checkStatus, 1000); return () => clearInterval(interval); }
        else { setShowDiscountBanner(false); setDiscountStatus('NONE'); }
    }, [settings?.specialDiscountEvent]);

    const handleGeneratePlan = async () => {
        setIsGeneratingPlan(true);
        // Simulate API delay for UX
        setTimeout(() => {
            try {
                const plan = generateSmartStudyPlan(user);
                setGeneratedPlan(plan);
            } catch (e) {
                console.error("Plan Gen Error", e);
                setAlertConfig({ isOpen: true, type: 'ERROR', message: 'Failed to generate plan. Please try again.' });
            } finally {
                setIsGeneratingPlan(false);
            }
        }, 1500);
    };

    const getEventSlides = () => {
        const slides: any[] = [];

        // Requested Feature Banners
        const featureBanners = [
            {
                id: 'feat-sub',
                title: 'Unlock Premium Subscription',
                subtitle: 'Access everything with Ultra Plan.',
                image: 'https://images.unsplash.com/photo-1555421689-491a97ff2040?auto=format&fit=crop&q=80&w=800',
                link: 'STORE'
            },
            {
                id: 'feat-notes-deep',
                title: 'Ultra Notes Deep Dive',
                subtitle: 'Detailed notes with audio explanations.',
                image: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&q=80&w=800',
                link: 'PDF'
            },
            {
                id: 'feat-slide',
                title: 'Ultra Slide',
                subtitle: 'Visual learning with audio sync.',
                image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=800',
                link: 'PDF'
            },
            {
                id: 'feat-video',
                title: 'Ultra Video Lectures',
                subtitle: 'High-quality video content.',
                image: 'https://images.unsplash.com/photo-1492619879851-f42b0416955d?auto=format&fit=crop&q=80&w=800',
                link: 'VIDEO'
            },
            {
                id: 'feat-mcq',
                title: 'Premium MCQ Practice',
                subtitle: 'Unlimited tests and analysis.',
                image: 'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?auto=format&fit=crop&q=80&w=800',
                link: 'MCQ'
            },
            {
                id: 'feat-audio',
                title: 'Premium Audio Library',
                subtitle: 'Learn on the go with podcasts.',
                image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=800',
                link: 'AUDIO'
            },
            {
                id: 'feat-rev',
                title: 'Premium Revision Hub',
                subtitle: 'Smart revision based on your weak topics.',
                image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=80&w=800',
                link: 'REVISION'
            },
            {
                id: 'feat-ai',
                title: 'AI Hub Ultra Analysis',
                subtitle: 'Deep insights powered by AI.',
                image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=800',
                link: 'AI_HUB'
            }
        ];

        slides.push(...featureBanners);

        if (settings?.activeEvents) {
            settings.activeEvents.forEach(evt => {
                if (evt.enabled) {
                    slides.push({
                        id: `evt-${evt.title}`,
                        image: evt.imageUrl || 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=800',
                        title: evt.title,
                        subtitle: evt.subtitle,
                        link: evt.actionUrl
                    });
                }
            });
        }

        if (settings?.exploreBanners) {
             settings.exploreBanners.forEach(b => {
                 if (b.enabled && b.priority > 5) {
                     slides.push({
                         id: b.id,
                         image: b.imageUrl || 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=800',
                         title: b.title,
                         subtitle: b.subtitle,
                         link: b.actionUrl
                     });
                 }
             });
        }

        if (slides.length === 0) {
            slides.push({
                id: 'default-welcome',
                image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=800',
                title: `Welcome, ${user.name}!`,
                subtitle: 'Start your learning journey today.',
                link: 'COURSES'
            });
        }

        return slides;
    };

    const eventSlides = getEventSlides();

    return (
        <div className="space-y-6 pb-24 pt-4 animate-in fade-in w-full">
             {/* EVENT BANNERS */}
             {eventSlides.length > 0 && (
                <div className="h-48 shadow-lg rounded-[20px] overflow-hidden w-[96%] mx-auto">
                    <BannerCarousel
                        slides={eventSlides}
                        autoPlay={true}
                        interval={4000}
                        onBannerClick={(link) => {
                            if (link === 'STORE') onTabChange('STORE');
                            else if (link) window.open(link, '_blank');
                        }}
                    />
                </div>
            )}

            {/* DISCOUNT BANNER */}
            {showDiscountBanner && discountTimer && (
                <button
                    onClick={() => onTabChange('STORE')}
                    className={`w-[96%] mx-auto bg-gradient-to-r ${discountStatus === 'ACTIVE' ? 'from-red-600 to-pink-600' : 'from-blue-600 to-indigo-600'} p-5 rounded-[20px] text-white shadow-[0_10px_25px_rgba(0,0,0,0.08)] flex items-center justify-between animate-pulse`}
                >
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{discountStatus === 'ACTIVE' ? '🎉' : '⏳'}</span>
                        <div className="text-left">
                            <p className="font-black text-sm uppercase">
                                {discountStatus === 'ACTIVE'
                                    ? `${settings?.specialDiscountEvent?.eventName || 'Special Offer'} Ends In:`
                                    : `${settings?.specialDiscountEvent?.eventName || 'Special Offer'} Starts In:`
                                }
                            </p>
                            <p className="text-lg font-mono font-bold">{discountTimer}</p>
                        </div>
                    </div>
                    <div className="bg-white text-red-600 px-3 py-1 rounded-lg text-xs font-bold shadow-sm">
                        {discountStatus === 'ACTIVE' ? 'CLAIM NOW' : 'WAIT FOR IT'}
                    </div>
                </button>
            )}

            {/* HEADER */}
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-5 rounded-[20px] text-white shadow-[0_10px_25px_rgba(0,0,0,0.08)] relative overflow-hidden w-[96%] mx-auto">
                <div className="relative z-10">
                    <h2 className="text-2xl font-black mb-1 flex items-center gap-2">
                        <Sparkles className="text-yellow-400" /> AI Center
                    </h2>
                    <p className="text-indigo-200 text-sm">Your personal learning assistant powered by advanced AI.</p>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl"></div>
            </div>

            {/* AI TOOLS COMPRESSED VIEW */}
            <div className="grid grid-cols-1 gap-4 w-[96%] mx-auto">
                {/* 1. CHAT TUTOR */}
                <button
                    onClick={() => onTabChange('AI_CHAT')}
                    className="bg-white p-5 rounded-[20px] shadow-[0_10px_25px_rgba(0,0,0,0.08)] border border-slate-100 flex items-center gap-4 hover:shadow-lg transition-all active:scale-[0.98]"
                >
                    <div className="bg-indigo-100 text-indigo-600 p-3 rounded-xl">
                        <Bot size={24} />
                    </div>
                    <div className="flex-1 text-left">
                        <h3 className="font-bold text-slate-800">Chat with AI Tutor</h3>
                        <p className="text-xs text-slate-500">Instant answers to any question.</p>
                    </div>
                    <div className="text-slate-300">
                        <Zap size={16} />
                    </div>
                </button>

                {/* 2. REPLACED: NOTES GENERATOR -> AI STUDY PLANNER */}
                <button
                    onClick={() => setShowPlannerModal(true)}
                    className="bg-white p-5 rounded-[20px] shadow-[0_10px_25px_rgba(0,0,0,0.08)] border border-slate-100 flex items-center gap-4 hover:shadow-lg transition-all active:scale-[0.98]"
                >
                    <div className="bg-pink-100 text-pink-600 p-3 rounded-xl">
                        <Calendar size={24} />
                    </div>
                    <div className="flex-1 text-left">
                        <h3 className="font-bold text-slate-800">AI Personalized Plans</h3>
                        <p className="text-xs text-slate-500">Get a study routine based on your history.</p>
                    </div>
                    <div className="text-slate-300">
                        <Zap size={16} />
                    </div>
                </button>

            </div>

            {/* AI PLANNER MODAL */}
            {showPlannerModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
                    <div className="bg-white rounded-[20px] p-6 w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center text-pink-600">
                                    <Calendar size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-800">AI Study Planner</h3>
                                    <p className="text-xs text-slate-500">Personalized for {user.name}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowPlannerModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {!generatedPlan ? (
                                <div className="text-center py-10">
                                    <div className="bg-pink-50 p-6 rounded-full inline-block mb-4 animate-pulse">
                                        <Sparkles size={40} className="text-pink-600" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 mb-2">Create Your Success Plan</h3>
                                    <p className="text-slate-500 mb-6 text-sm max-w-sm mx-auto">
                                        Our AI will analyze your past test performance and create a custom 3-day schedule to fix your weak areas.
                                    </p>
                                    <Button
                                        onClick={handleGeneratePlan}
                                        isLoading={isGeneratingPlan}
                                        variant="primary"
                                        size="lg"
                                        icon={<Zap size={18} />}
                                    >
                                        {isGeneratingPlan ? "Analyzing History..." : "Generate My Plan"}
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="bg-gradient-to-r from-pink-500 to-rose-500 p-4 rounded-xl text-white">
                                        <h3 className="font-black text-lg">{generatedPlan.title}</h3>
                                        <p className="text-sm opacity-90">{generatedPlan.summary}</p>
                                    </div>

                                    {generatedPlan.weakAreas && (
                                        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                            <h4 className="font-bold text-red-800 text-sm mb-2 flex items-center gap-2"><AlertCircle size={14}/> Weak Areas Identified (&lt;50%)</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {generatedPlan.weakAreas.map((area: string, i: number) => (
                                                    <span key={i} className="bg-white text-red-600 px-2 py-1 rounded text-xs font-bold border border-red-200 shadow-sm">{area}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <div className="bg-slate-50 p-3 font-bold text-slate-700 border-b border-slate-100 flex justify-between">
                                            <span>TODAY'S SCHEDULE</span>
                                            <span className="text-xs font-normal bg-white px-2 py-0.5 rounded border border-slate-200">High Impact</span>
                                        </div>
                                        <div className="divide-y divide-slate-100">
                                            {generatedPlan.routine?.map((slot: any, sIdx: number) => (
                                                <div key={sIdx} className="p-4 flex gap-4 items-start">
                                                    <div className="text-xs font-bold text-slate-400 w-20 pt-1">{slot.time}</div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-[10px] font-black bg-slate-100 px-1.5 rounded uppercase text-slate-500">{slot.subject}</span>
                                                            <h4 className="font-bold text-slate-800 text-sm">{slot.topic}</h4>
                                                        </div>
                                                        <p className="text-xs text-slate-600">{slot.activity} • <span className="text-pink-600 font-bold">{slot.duration}</span></p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                        <h4 className="font-bold text-blue-800 text-sm mb-1 flex items-center gap-2"><Zap size={14}/> AI Motivation</h4>
                                        <p className="text-xs text-blue-700 italic">"{generatedPlan.motivation}"</p>
                                    </div>

                                    <Button onClick={() => setGeneratedPlan(null)} variant="outline" fullWidth>Generate New Plan</Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <CustomAlert
                isOpen={alertConfig.isOpen}
                type={alertConfig.type}
                title={alertConfig.title}
                message={alertConfig.message}
                onClose={() => setAlertConfig(prev => ({...prev, isOpen: false}))}
            />
        </div>
    );
};
