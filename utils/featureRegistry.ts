
export type FeatureGroup = 'CORE' | 'ANALYSIS' | 'AI' | 'GAME' | 'ADMIN' | 'ADVANCED' | 'CONTENT' | 'TOOLS' | 'REVISION' | 'SOUL' | 'NSTA_CONTROL' | 'REQUESTS';

export interface Feature {
    id: string;
    label: string;
    group: FeatureGroup;
    surfaceLevel: 1 | 2 | 3; // 1 = Dashboard, 2 = Tools/Expandable, 3 = Drawer/Hidden
    requiredSubscription?: 'FREE' | 'BASIC' | 'ULTRA';
    adminVisible: boolean;
    isExperimental?: boolean;
    description?: string;
    icon?: string; // Lucide icon name
    adminTab?: string; // Corresponds to AdminTab in AdminDashboard.tsx
    color?: string; // Tailwind color name (e.g., 'blue', 'red')
    path?: string; // Navigation path for Student Dashboard
    requiredPermission?: string; // Admin Permission ID
    requiresSuperAdmin?: boolean; // Only for Role === 'ADMIN'
    isDummy?: boolean; // NEW: Explicitly mark as Dummy/Placeholder
}

export const ALL_FEATURES: Feature[] = [
    // --- CORE (Layer 1: Daily Core Actions - Max 6) ---
    {
        id: 'START_STUDY',
        label: 'Start Study',
        group: 'CORE',
        surfaceLevel: 1,
        adminVisible: false,
        path: 'COURSES',
        icon: 'Book',
        description: 'Access your main courses and subjects.'
    },
    {
        id: 'MCQ_PRACTICE',
        label: 'MCQ Practice',
        group: 'CORE',
        surfaceLevel: 1,
        adminVisible: false,
        path: 'MCQ',
        icon: 'CheckSquare',
        description: 'Practice unlimited questions.'
    },
    {
        id: 'REVISION_HUB',
        label: 'Revision Hub',
        group: 'CORE',
        surfaceLevel: 1,
        requiredSubscription: 'BASIC',
        adminVisible: false,
        path: 'REVISION',
        icon: 'BrainCircuit',
        description: 'Smart revision based on your weak topics.'
    },
    {
        id: 'MY_ANALYSIS',
        label: 'My Analysis',
        group: 'CORE',
        surfaceLevel: 1,
        adminVisible: false,
        path: 'ANALYTICS',
        icon: 'BarChart3',
        description: 'Track your progress and performance.'
    },
    {
        id: 'WEAK_TOPICS',
        label: 'Weak Topics',
        group: 'CORE',
        surfaceLevel: 1,
        requiredSubscription: 'BASIC',
        adminVisible: false,
        path: 'REVISION',
        icon: 'AlertCircle',
        description: 'Focus instantly on your weakest areas.',
        isDummy: true // Integrated in Revision Hub
    },
    {
        id: 'CONTINUE_LAST',
        label: 'Continue Last',
        group: 'CORE',
        surfaceLevel: 1,
        adminVisible: false,
        path: 'CONTINUE',
        icon: 'PlayCircle',
        description: 'Resume exactly where you left off.',
        isDummy: true // Not implemented
    },

    // --- SECONDARY (Layer 2: Tools & Exploration) ---
    {
        id: 'AI_CENTER',
        label: 'AI Center',
        group: 'AI',
        surfaceLevel: 2,
        requiredSubscription: 'BASIC',
        adminVisible: false,
        path: 'AI_HUB',
        icon: 'Sparkles',
        description: 'Central hub for all AI tools.'
    },
    {
        id: 'TOOLS',
        label: 'Tools',
        group: 'TOOLS',
        surfaceLevel: 2,
        adminVisible: false,
        path: 'TOOLS',
        icon: 'Wrench',
        description: 'Calculators, converters, and more.',
        isDummy: true // Placeholder
    },
    {
        id: 'GAMES',
        label: 'Game Zone',
        group: 'GAME',
        surfaceLevel: 2,
        adminVisible: false,
        path: 'GAME',
        icon: 'Gamepad2',
        description: 'Relax and earn rewards.'
    },
    {
        id: 'STORE_ACCESS',
        label: 'Store',
        group: 'CONTENT',
        surfaceLevel: 2,
        adminVisible: false,
        path: 'STORE',
        icon: 'ShoppingBag',
        description: 'Upgrade your plan and buy credits.'
    },
    {
        id: 'LEADERBOARD',
        label: 'Leaderboard',
        group: 'GAME',
        surfaceLevel: 2,
        adminVisible: false,
        path: 'LEADERBOARD',
        icon: 'Trophy',
        description: 'Compete with others globally.'
    },
    {
        id: 'PREMIUM_ACCESS',
        label: 'Premium',
        group: 'CONTENT',
        surfaceLevel: 2,
        adminVisible: false,
        path: 'SUB_HISTORY',
        icon: 'Crown',
        description: 'Manage your subscription.'
    },

    // --- DRAWER / HIDDEN (Layer 3) ---
    {
        id: 'ADMIN_PANEL',
        label: 'Admin Panel',
        group: 'ADMIN',
        surfaceLevel: 3,
        adminVisible: true,
        path: 'ADMIN_DASHBOARD',
        icon: 'Shield',
        requiresSuperAdmin: true
    },
    {
        id: 'REDEEM_CODE',
        label: 'Redeem Code',
        group: 'TOOLS',
        surfaceLevel: 3,
        adminVisible: false,
        path: 'REDEEM',
        icon: 'Gift'
    },
    {
        id: 'LOGS_DEBUG',
        label: 'Logs & Debug',
        group: 'ADVANCED',
        surfaceLevel: 3,
        adminVisible: false,
        path: 'LOGS',
        icon: 'Terminal',
        isDummy: true
    },

    // --- REVISION SUB-FEATURES (Internal to Revision Hub) ---
    {
        id: 'REVISION_AI_PLAN',
        label: 'AI Study Plan',
        group: 'REVISION',
        surfaceLevel: 2,
        requiredSubscription: 'ULTRA',
        adminVisible: false,
        description: 'Generate AI-based study plans.',
        isDummy: true // Integrated Logic (Non-Switchable)
    },
    {
        id: 'REVISION_MISTAKES',
        label: 'Mistakes Review',
        group: 'REVISION',
        surfaceLevel: 2,
        adminVisible: false,
        description: 'Review your past mistakes.',
        isDummy: true // Integrated Logic (Non-Switchable)
    },

    // --- AI SUB-FEATURES ---
    {
        id: 'AI_CHAT',
        label: 'AI Chat Tutor',
        group: 'AI',
        surfaceLevel: 2,
        requiredSubscription: 'ULTRA',
        adminVisible: false,
        icon: 'MessageSquare',
        description: 'Chat with AI for doubt solving.'
    },
    {
        id: 'AI_GENERATOR',
        label: 'AI Notes Gen',
        group: 'AI',
        surfaceLevel: 2,
        requiredSubscription: 'BASIC',
        adminVisible: false,
        icon: 'FileText',
        description: 'Generate custom notes.'
    },

    // --- CONTENT SUB-FEATURES ---
    {
        id: 'VIDEO_ACCESS',
        label: 'Video Lectures',
        group: 'CONTENT',
        surfaceLevel: 1,
        adminVisible: false,
        description: 'Access video content.'
    },
    {
        id: 'NOTES_ACCESS',
        label: 'Premium Notes',
        group: 'CONTENT',
        surfaceLevel: 1,
        adminVisible: false,
        description: 'Access PDF and HTML notes.'
    },
    {
        id: 'AUDIO_LIBRARY',
        label: 'Audio Library',
        group: 'CONTENT',
        surfaceLevel: 2,
        adminVisible: false,
        description: 'Listen to audio lessons.'
    },
    {
        id: 'COMPETITION_MODE',
        label: 'Competition Mode',
        group: 'CONTENT',
        surfaceLevel: 2,
        requiredSubscription: 'ULTRA',
        adminVisible: false,
        description: 'High-level content for exams.'
    },
    {
        id: 'DOWNLOAD_PDF',
        label: 'Download PDF',
        group: 'TOOLS',
        surfaceLevel: 2,
        requiredSubscription: 'BASIC',
        adminVisible: false,
        description: 'Save content offline.'
    },
    {
        id: 'DEEP_DIVE',
        label: 'Deep Dive',
        group: 'CONTENT',
        surfaceLevel: 2,
        requiredSubscription: 'BASIC',
        adminVisible: false,
        description: 'Detailed HTML notes with audio.'
    },
    {
        id: 'AUDIO_SLIDE',
        label: 'Audio Slides',
        group: 'CONTENT',
        surfaceLevel: 2,
        requiredSubscription: 'ULTRA',
        adminVisible: false,
        description: 'Synchronized audio and visual slides.'
    },
    {
        id: 'PREMIUM_NOTES',
        label: 'Premium Notes',
        group: 'CONTENT',
        surfaceLevel: 1,
        requiredSubscription: 'BASIC',
        adminVisible: false,
        description: 'Control access to Premium (PDF+TTS) notes.',
        adminTab: 'FEATURE_ACCESS'
    },
    {
        id: 'PREMIUM_VIDEO',
        label: 'Premium Video',
        group: 'CONTENT',
        surfaceLevel: 1,
        requiredSubscription: 'ULTRA',
        adminVisible: true,
        description: 'Control access to Premium Video Series (Google Drive).',
        adminTab: 'FEATURE_ACCESS', // Keep in Feature Access for visibility logic
        // This is ALSO controlled via NSTA Control in UI, but registration here is needed for permission check
    },
    {
        id: 'ADDITIONAL_NOTES',
        label: 'Additional Notes',
        group: 'CONTENT',
        surfaceLevel: 1,
        requiredSubscription: 'BASIC',
        adminVisible: false,
        description: 'Control access to Additional Resources tab.',
        adminTab: 'FEATURE_ACCESS'
    },

    // --- APP SOUL (RARE FEATURES) ---
    { id: 'QUICK_REVISION', label: 'Quick Revision', group: 'SOUL', surfaceLevel: 2, adminVisible: true, description: 'Rapid revision mode control.' },
    { id: 'MCQ_FREE', label: 'Free Practice', group: 'SOUL', surfaceLevel: 2, adminVisible: true, description: 'Control free MCQ access.' },
    { id: 'MCQ_PREMIUM', label: 'Premium Test', group: 'SOUL', surfaceLevel: 2, adminVisible: true, description: 'Control premium MCQ access.' },
    { id: 'REVISION_HUB_FREE', label: 'Revision Hub (Free)', group: 'SOUL', surfaceLevel: 2, adminVisible: true, description: 'Basic revision features.' },
    { id: 'REVISION_HUB_PREMIUM', label: 'Revision Hub (Premium)', group: 'SOUL', surfaceLevel: 2, adminVisible: true, description: 'Advanced revision features.' },
    { id: 'TOPIC_CONTENT', label: 'Topic Content', group: 'SOUL', surfaceLevel: 2, adminVisible: true, description: 'Control topic-specific content visibility.' },
    { id: 'REQUEST_CONTENT', label: 'Request Content', group: 'SOUL', surfaceLevel: 2, adminVisible: true, description: 'Enable/Disable content requests.' },
    { id: 'AI_STUDIO', label: 'AI Studio', group: 'SOUL', surfaceLevel: 2, adminVisible: true, description: 'Control AI Studio features.' },

    // --- MARKSHEET FEATURES (App Soul Controlled) ---
    { id: 'MS_RECOMMEND', label: 'Recommend Notes', group: 'ANALYSIS', surfaceLevel: 2, adminVisible: true, description: 'Control Recommend Notes tab in Marksheet.' },
    { id: 'MS_OMR', label: 'OMR', group: 'ANALYSIS', surfaceLevel: 2, adminVisible: true, description: 'Control OMR tab in Marksheet.' },
    { id: 'MS_AI_INSIGHTS', label: 'AI Insights', group: 'ANALYSIS', surfaceLevel: 2, adminVisible: true, description: 'Control AI Insights tab in Marksheet.' },
    { id: 'MS_MISTAKES', label: 'Mistakes', group: 'ANALYSIS', surfaceLevel: 2, adminVisible: true, description: 'Control Mistakes tab in Marksheet.' },
    { id: 'MS_ANALYSIS', label: 'Analysis', group: 'ANALYSIS', surfaceLevel: 2, adminVisible: true, description: 'Control Analysis tab in Marksheet.' },
    { id: 'MS_OFFICIAL', label: 'Official Marksheet', group: 'ANALYSIS', surfaceLevel: 2, adminVisible: true, description: 'Control Official Marksheet tab.' },


    // --- ADMIN DASHBOARD FEATURES (Mapped to Admin Tabs) ---
    // GROUP: CORE ADMIN
    {
        id: 'ADMIN_USERS',
        label: 'Users',
        group: 'CORE',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'USERS',
        requiredPermission: 'VIEW_USERS',
        icon: 'Users',
        color: 'blue'
    },
    {
        id: 'ADMIN_SUB_ADMINS',
        label: 'Sub-Admins',
        group: 'CORE',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'SUB_ADMINS',
        requiredPermission: 'MANAGE_SUB_ADMINS',
        icon: 'ShieldCheck',
        color: 'indigo'
    },
    {
        id: 'ADMIN_SUBSCRIPTIONS',
        label: 'Subscriptions',
        group: 'CORE',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'SUBSCRIPTION_MANAGER',
        requiredPermission: 'MANAGE_SUBS',
        icon: 'CreditCard',
        color: 'purple'
    },
    {
        id: 'ADMIN_SUBJECTS',
        label: 'Subjects',
        group: 'CORE',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'SUBJECTS_MGR',
        requiredPermission: 'MANAGE_SYLLABUS',
        icon: 'Book',
        color: 'emerald'
    },
    {
        id: 'ADMIN_STORE',
        label: 'Store Manager',
        group: 'CORE',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'STORE_MANAGER',
        requiredPermission: 'MANAGE_SETTINGS',
        icon: 'ShoppingBag',
        color: 'purple'
    },

    // --- NOTIFICATION & REQUESTS GROUP ---
    {
        id: 'ADMIN_ACTIVITY',
        label: 'Activity Log',
        group: 'ADVANCED',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'ACTIVITY_LOG',
        requiresSuperAdmin: true,
        icon: 'Activity',
        color: 'slate'
    },
    {
        id: 'ADMIN_NOTIFY',
        label: 'Notify Users',
        group: 'REQUESTS',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'NOTIFY_USERS',
        requiresSuperAdmin: true,
        icon: 'Megaphone',
        color: 'pink'
    },
    {
        id: 'ADMIN_DEMANDS',
        label: 'Demands',
        group: 'REQUESTS',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'DEMAND',
        requiredPermission: 'VIEW_DEMANDS',
        icon: 'Megaphone',
        color: 'orange'
    },
    {
        id: 'ADMIN_ACCESS',
        label: 'Login Requests',
        group: 'REQUESTS',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'ACCESS',
        requiredPermission: 'APPROVE_LOGIN_REQS',
        icon: 'Key',
        color: 'purple'
    },

    // GROUP: CONTENT / ANALYSIS
    {
        id: 'ADMIN_CONTENT_PDF',
        label: 'Main Notes',
        group: 'CONTENT',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'CONTENT_PDF',
        requiredPermission: 'MANAGE_CONTENT',
        icon: 'FileText',
        color: 'blue'
    },
    {
        id: 'ADMIN_CONTENT_VIDEO',
        label: 'Video Lectures',
        group: 'CONTENT',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'CONTENT_VIDEO',
        requiredPermission: 'MANAGE_CONTENT',
        icon: 'Video',
        color: 'red'
    },
    {
        id: 'ADMIN_CONTENT_AUDIO',
        label: 'Audio Series',
        group: 'CONTENT',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'CONTENT_AUDIO',
        requiredPermission: 'MANAGE_CONTENT',
        icon: 'Headphones',
        color: 'pink'
    },
    {
        id: 'ADMIN_CONTENT_MCQ',
        label: 'MCQ & Tests',
        group: 'CONTENT',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'CONTENT_MCQ',
        requiredPermission: 'MANAGE_CONTENT',
        icon: 'CheckCircle',
        color: 'purple'
    },
    // ADMIN_PREMIUM_VIDEO REMOVED from visible list as requested ("Content & Analysis me admin dashbord me ek button hai Premium Video ye hatao")
    {
        id: 'ADMIN_TOPIC_NOTES',
        label: 'Topic Notes',
        group: 'CONTENT',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'TOPIC_NOTES_MANAGER',
        requiredPermission: 'MANAGE_CONTENT',
        icon: 'BookOpen',
        color: 'cyan'
    },
    {
        id: 'ADMIN_BULK_UPLOAD',
        label: 'Bulk Import',
        group: 'CONTENT',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'BULK_UPLOAD',
        requiredPermission: 'MANAGE_CONTENT',
        icon: 'Layers',
        color: 'orange'
    },
    {
        id: 'ADMIN_SYLLABUS',
        label: 'Syllabus Manager',
        group: 'CONTENT',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'SYLLABUS_MANAGER',
        requiresSuperAdmin: true,
        icon: 'ListChecks',
        color: 'indigo'
    },
    {
        id: 'ADMIN_UNIVERSAL_PLAYLIST',
        label: 'Universal Playlist',
        group: 'CONTENT',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'UNIVERSAL_PLAYLIST',
        requiredPermission: 'MANAGE_SETTINGS',
        icon: 'Video',
        color: 'rose'
    },

    // GROUP: AI (Admin & Student)
    {
        id: 'ADMIN_CONFIG_AI',
        label: 'AI Configuration',
        group: 'AI',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'CONFIG_AI',
        requiredPermission: 'MANAGE_SETTINGS',
        icon: 'Bot',
        color: 'teal'
    },

    // GROUP: GAME
    {
        id: 'ADMIN_GAME_CONFIG',
        label: 'Game Config',
        group: 'GAME',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'CONFIG_GAME',
        requiredPermission: 'MANAGE_SETTINGS',
        icon: 'Gamepad2',
        color: 'orange'
    },
    {
        id: 'ADMIN_REWARDS',
        label: 'Engagement Rewards',
        group: 'GAME',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'CONFIG_REWARDS',
        requiredPermission: 'MANAGE_SETTINGS',
        icon: 'Gift',
        color: 'rose'
    },
    {
        id: 'ADMIN_PRIZES',
        label: 'Prize Settings',
        group: 'GAME',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'CONFIG_PRIZES',
        requiredPermission: 'MANAGE_SETTINGS',
        icon: 'Trophy',
        color: 'yellow'
    },
    {
        id: 'ADMIN_CHALLENGE',
        label: 'Challenge Config',
        group: 'GAME',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'CONFIG_CHALLENGE',
        requiredPermission: 'MANAGE_SETTINGS',
        icon: 'Trophy',
        color: 'red'
    },
    {
        id: 'ADMIN_CHALLENGE_20',
        label: 'Challenge 2.0',
        group: 'GAME',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'CHALLENGE_CREATOR_20',
        requiredPermission: 'MANAGE_SETTINGS',
        icon: 'Rocket',
        color: 'violet'
    },

    // GROUP: ADVANCED / CONFIG
    {
        id: 'ADMIN_EVENT',
        label: 'Event Manager',
        group: 'ADVANCED',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'EVENT_MANAGER',
        requiredPermission: 'MANAGE_SETTINGS',
        icon: 'Calendar',
        color: 'rose'
    },
    {
        id: 'ADMIN_GENERAL',
        label: 'General Settings',
        group: 'ADVANCED',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'CONFIG_GENERAL',
        requiredPermission: 'MANAGE_SETTINGS',
        icon: 'Monitor',
        color: 'blue'
    },
    {
        id: 'ADMIN_SECURITY',
        label: 'Security',
        group: 'ADVANCED',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'CONFIG_SECURITY',
        requiredPermission: 'MANAGE_SETTINGS',
        icon: 'ShieldCheck',
        color: 'red'
    },
    {
        id: 'ADMIN_VISIBILITY',
        label: 'Visibility & Watermark',
        group: 'ADVANCED',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'CONFIG_VISIBILITY',
        requiredPermission: 'MANAGE_SETTINGS',
        icon: 'Eye',
        color: 'amber'
    },
    {
        id: 'ADMIN_POWER',
        label: 'Advanced Settings',
        group: 'ADVANCED',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'POWER_MANAGER',
        requiredPermission: 'MANAGE_SETTINGS',
        icon: 'Settings',
        color: 'slate'
    },
    {
        id: 'ADMIN_BLOGGER',
        label: 'Blogger Hub',
        group: 'ADVANCED',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'BLOGGER_HUB',
        requiresSuperAdmin: true,
        icon: 'PenTool',
        color: 'orange'
    },
    {
        id: 'ADMIN_PAYMENT',
        label: 'Payment Config',
        group: 'ADVANCED',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'CONFIG_PAYMENT',
        requiredPermission: 'MANAGE_SETTINGS',
        icon: 'Banknote',
        color: 'emerald'
    },
    {
        id: 'ADMIN_EXTERNAL',
        label: 'External Apps',
        group: 'ADVANCED',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'CONFIG_EXTERNAL_APPS',
        requiredPermission: 'MANAGE_SETTINGS',
        icon: 'Globe',
        color: 'indigo'
    },
    {
        id: 'ADMIN_POPUPS',
        label: 'Popup Config',
        group: 'ADVANCED',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'CONFIG_POPUPS',
        requiredPermission: 'MANAGE_SETTINGS',
        icon: 'Bell',
        color: 'orange'
    },
    {
        id: 'ADMIN_REVISION',
        label: 'Revision Logic',
        group: 'ADVANCED',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'REVISION_LOGIC',
        requiredPermission: 'MANAGE_SETTINGS',
        icon: 'RotateCcw',
        color: 'indigo'
    },

    {
        id: 'ADMIN_CODES',
        label: 'Gift Codes',
        group: 'ADVANCED',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'CODES',
        requiredPermission: 'MANAGE_GIFT_CODES',
        icon: 'Gift',
        color: 'pink'
    },
    {
        id: 'ADMIN_DEPLOY',
        label: 'App Update',
        group: 'ADVANCED',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'DEPLOY',
        requiresSuperAdmin: true,
        icon: 'Cloud',
        color: 'sky'
    },
    {
        id: 'ADMIN_DATABASE',
        label: 'Database',
        group: 'ADVANCED',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'DATABASE',
        requiresSuperAdmin: true,
        icon: 'Database',
        color: 'gray'
    },
    {
        id: 'ADMIN_RECYCLE',
        label: 'Recycle Bin',
        group: 'ADVANCED',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'RECYCLE',
        requiresSuperAdmin: true,
        icon: 'Trash2',
        color: 'red'
    },
    {
        id: 'ADMIN_DOCS',
        label: 'Documentation',
        group: 'ADVANCED',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'DOCUMENTATION',
        requiredPermission: 'MANAGE_SETTINGS',
        icon: 'BookOpen',
        color: 'teal'
    },
    {
        id: 'ADMIN_NSTA_CONTROL',
        label: 'NSTA Control',
        group: 'NSTA_CONTROL',
        surfaceLevel: 3,
        adminVisible: true,
        adminTab: 'NSTA_CONTROL',
        requiredPermission: 'MANAGE_SETTINGS',
        icon: 'Sliders',
        color: 'violet'
    },

    // --- ANALYSIS DUMMIES (Not switchable individually) ---
    { id: 'ACCURACY_STAT', label: 'Accuracy Stat', group: 'ANALYSIS', surfaceLevel: 2, adminVisible: false, isDummy: true },
    { id: 'SPEED_STAT', label: 'Speed Stat', group: 'ANALYSIS', surfaceLevel: 2, adminVisible: false, isDummy: true },
    { id: 'PERF_TREND', label: 'Performance Trend', group: 'ANALYSIS', surfaceLevel: 2, adminVisible: false, isDummy: true },
    { id: 'STRONG_AREA', label: 'Strong Areas', group: 'ANALYSIS', surfaceLevel: 2, adminVisible: false, isDummy: true },
    { id: 'AREA_IMPROVING', label: 'Area Improving', group: 'ANALYSIS', surfaceLevel: 2, adminVisible: false, isDummy: true },
    { id: 'FOCUS_NEEDED', label: 'Focus Needed', group: 'ANALYSIS', surfaceLevel: 2, adminVisible: false, isDummy: true },
    { id: 'OFFICIAL_MARKSHEET', label: 'Official Marksheet', group: 'ANALYSIS', surfaceLevel: 2, adminVisible: false, isDummy: true },
    { id: 'OMR_SHEET', label: 'OMR Sheet', group: 'ANALYSIS', surfaceLevel: 2, adminVisible: false, isDummy: true },
    { id: 'PROGRESS_DELTA', label: 'Progress Delta', group: 'ANALYSIS', surfaceLevel: 2, adminVisible: false, isDummy: true },
    { id: 'MISTAKE_PATTERN', label: 'Mistake Pattern', group: 'ANALYSIS', surfaceLevel: 2, adminVisible: false, isDummy: true },
    { id: 'TOPIC_BREAKDOWN', label: 'Topic Breakdown', group: 'ANALYSIS', surfaceLevel: 2, adminVisible: false, isDummy: true },
    { id: 'TOPIC_DIST', label: 'Topic Distribution', group: 'ANALYSIS', surfaceLevel: 2, adminVisible: false, isDummy: true },
    { id: 'DOWNLOAD_ANALYSIS', label: 'Download Analysis', group: 'ANALYSIS', surfaceLevel: 2, adminVisible: false, isDummy: true },
    { id: 'AI_INSIGHT_MAP', label: 'AI Insight Map', group: 'AI', surfaceLevel: 2, adminVisible: false, isDummy: true },
    { id: 'PREMIUM_ANALYSIS', label: 'Premium Analysis', group: 'ANALYSIS', surfaceLevel: 2, adminVisible: false, isDummy: true },
];

export const getFeaturesByGroup = (group: FeatureGroup, onlyAdmin: boolean = false) => {
    return ALL_FEATURES.filter(f => f.group === group && (!onlyAdmin || f.adminVisible));
};
