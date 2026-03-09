export const APP_DOCUMENTATION = {
    overview: {
        title: "Application Overview",
        content: "This is a comprehensive EdTech platform designed for BSEB and CBSE students (Class 6-12 & Competition). It features a dual-interface system (Student & Admin) with advanced AI integration, gamification, and offline-first capabilities."
    },
    pages: [
        {
            name: "Student Dashboard",
            description: "The central hub for students. Provides access to all study materials, revision tools, and profile settings.",
            features: [
                "Course Navigation (Subject -> Chapter -> Content)",
                "Performance Graph & Study Goal Timer",
                "Quick Access to AI Hub, Revision, and History",
                "Notifications & Daily Rewards"
            ]
        },
        {
            name: "Admin Dashboard",
            description: "The control center for administrators to manage users, content, and system settings.",
            features: [
                "User Management (Edit, Ban, Gift Credits)",
                "Content Manager (Upload Videos, PDFs, MCQs)",
                "System Settings (Customize App Name, Banners, Features)",
                "Syllabus Manager & Bulk Uploads"
            ]
        },
        {
            name: "AI Hub",
            description: "A dedicated section for AI-powered learning tools.",
            features: [
                "AI Study Planner: Generates daily routines based on weak topics.",
                "AI Chat Tutor: Instant doubt clearance.",
                "Deep Analysis: AI-driven performance insights."
            ]
        },
        {
            name: "Revision Hub",
            description: "A smart revision system that tracks what you forget.",
            features: [
                "Spaced Repetition Logic (Weak/Avg/Strong topics)",
                "Pending Tasks (Daily revision goals)",
                "Mistake Review Session"
            ]
        },
        {
            name: "Analytics Page",
            description: "Detailed report card for students.",
            features: [
                "Topic-wise Performance Breakdown",
                "Progress Trends (Last 10 tests)",
                "Downloadable PDF Reports (Optimized)",
                "Teacher Remarks (Auto-generated)"
            ]
        },
        {
            name: "Store",
            description: "In-app marketplace for purchasing credits and premium plans.",
            features: [
                "Credit Packages",
                "Subscription Plans (Weekly, Monthly, Lifetime)",
                "Redeem Gift Codes"
            ]
        },
        {
            name: "Universal Chat",
            description: "Real-time communication platform.",
            features: [
                "Global Community Chat",
                "Admin Announcements",
                "Private Support Channel"
            ]
        }
    ],
    features: [
        {
            title: "Smart Study Planner",
            details: "Uses algorithmic logic to analyze a student's test history. Identifies topics with <60% score and schedules them into Morning/Afternoon/Evening slots for 'Today Only' focus."
        },
        {
            title: "Deep Dive Notes",
            details: "Premium notes feature that includes Text-to-Speech (TTS) and HTML-based rich content. Accessible via the PDF viewer or AI Hub."
        },
        {
            title: "Gamification",
            details: "Includes a 'Spin Wheel' for daily rewards, a 'Leaderboard' for competition, and a 'Streak' system to encourage daily login."
        },
        {
            title: "Offline Capabilities",
            details: "Key data (Syllabus, Chapters, Settings) is cached locally to ensure the app works smoothly even with poor internet connection."
        }
    ],
    adminGuide: [
        {
            step: "Admin Dashboard Sections",
            instruction: "Overview of Admin Dashboard and how it works: \n- **Dashboard**: High-level overview of users, analytics, requests, and logs. \n- **Manage Users**: Search, edit, ban, or delete users. Add credits or change subscription tiers. \n- **Content Manager**: Add/Edit Subjects, Chapters, Notes (PDF), Videos, Audio, and MCQs. Includes an AI generator for quick content creation. \n- **Live Tests**: Create and manage scheduled Live Tests. \n- **Global Events**: Create Global Events like Free Premium Access, Discount Sales, and Credit-Free events. \n- **Watermark & Security**: Configure the global watermark and security settings to prevent piracy. \n- **Feature Access**: Manage feature limits, pricing (credits), and subscription access for all components across the app. \n- **App Soul**: Advanced control over core features and the Matrix Plan visibility. \n- **General Settings**: Update App Name, Theme Color, Banners, and Social Links. \n- **Subscription Editor**: (Located in Power Manager) Edit subscription plan pricing and features. \n- **Prize Rules**: Configure rules for student prizes. \n- **Demands**: View and fulfill content requests submitted by users. \n- **System Logs**: View detailed system activity and API usage."
        },
        {
            step: "Managing Users",
            instruction: "Go to 'Users' tab. Use search to find a student. Click 'Edit' to change details, 'Gift' to add credits, or 'Ban' to restrict access."
        },
        {
            step: "Uploading Content",
            instruction: "Go to 'Content' tab. Select Board/Class/Subject/Chapter. Choose type (Video/PDF/MCQ). For MCQs, you can use the 'AI Generator' to create questions instantly."
        },
        {
            step: "Feature Control",
            instruction: "Go to 'Power Manager' or 'Feature Access'. You can lock specific features (like Games or Chat) for specific user tiers (Free/Basic/Ultra)."
        },
        {
            step: "System Config",
            instruction: "Go to 'Settings'. Here you can change the App Name, Logo, Theme Color, and configure Banners (Explore/Events)."
        }
    ]
};
