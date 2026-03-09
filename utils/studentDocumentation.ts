
import { SystemSettings } from '../types';

export const getStudentGuideData = (settings?: SystemSettings) => {
    // Default Costs if not set
    const costs = {
        video: settings?.defaultVideoCost ?? 5,
        pdf: settings?.defaultPdfCost ?? 2,
        mcqTest: settings?.mcqTestCost ?? 10,
        mcqPractice: settings?.mcqLimitFree ? 'Free Limit' : 'Free',
        aiChat: settings?.chatCost ?? 1,
        aiAnalysis: settings?.mcqAnalysisCost ?? 5,
        aiPlan: 0, // Usually free or part of subscription
        game: settings?.gameCost ?? 0,
        deepDive: settings?.deepDiveCost ?? 15,
        audioSlide: settings?.audioSlideCost ?? 10
    };

    return {
        overview: {
            title: `Welcome to ${settings?.appName || 'Student App'}`,
            subtitle: "Your complete guide to mastering studies with AI & Smart Tools.",
            content: "This app combines traditional learning (Notes, Videos) with advanced AI tools (Personal Tutor, Deep Analysis) and Gamification (Leaderboards, Rewards) to make studying effective and fun."
        },
        features: [
            {
                title: "📚 Content Library",
                description: "Access high-quality study materials for your class.",
                items: [
                    { name: "Video Lectures", cost: `${costs.video} Coins`, details: "Watch concept videos. Premium videos require coins." },
                    { name: "Premium Notes", cost: `${costs.pdf} Coins`, details: "High-quality PDF notes for revision." },
                    { name: "Deep Dive Notes", cost: `${costs.deepDive} Coins`, details: "Interactive HTML notes with audio explanations." },
                    { name: "Audio Slides", cost: `${costs.audioSlide} Coins`, details: "Listen to chapters on the go." }
                ]
            },
            {
                title: "🤖 AI Power Tools",
                description: "Use Artificial Intelligence to boost your learning.",
                items: [
                    { name: "AI Chat Tutor", cost: `${costs.aiChat} Coin/Msg`, details: "Ask any doubt instantly. The AI explains like a teacher." },
                    { name: "Performance Analysis", cost: `${costs.aiAnalysis} Coins`, details: "Get a detailed report card of your weak and strong areas." },
                    { name: "AI Study Planner", cost: "Free / Premium", details: "Get a personalized daily routine based on your weak topics." }
                ]
            },
            {
                title: "📝 Practice & Revision",
                description: "Test your knowledge and retain it longer.",
                items: [
                    { name: "MCQ Practice", cost: "Free (Daily Limit)", details: "Practice questions chapter-wise." },
                    { name: "Weekly Tests", cost: `${costs.mcqTest} Coins`, details: "Compete with others in scheduled live tests." },
                    { name: "Revision Hub", cost: "Free / Basic", details: "Tracks what you forget and reminds you to revise." }
                ]
            },
            {
                title: "🎮 Fun & Rewards",
                description: "Earn while you learn.",
                items: [
                    { name: "Spin Wheel", cost: `${costs.game} Coins`, details: "Win daily bonus credits." },
                    { name: "Leaderboard", cost: "Free", details: "See your rank among all students." },
                    { name: "Refer & Earn", cost: "Free", details: "Invite friends to earn massive coin bonuses." }
                ]
            }
        ],
        faq: [
            { q: "How do I get Coins?", a: "You get daily login bonuses, rewards for studying (Study Timer), and by referring friends. You can also buy coin packs in the Store." },
            { q: "What is a Streak?", a: "Login every day to build a Streak. High streaks give you badges and special rewards." },
            { q: "Can I use the app offline?", a: "Yes! Notes and some features work offline. Videos require internet." }
        ]
    };
};
