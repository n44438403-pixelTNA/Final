# Overview

This is an AI-powered educational platform called "IDEAL INSPIRATION CLASSES (IIC)" / "NST AI Assistant" — a comprehensive student learning app built as a single-page React application. It supports multiple Indian education boards (CBSE, BSEB) and competitive exam preparation, offering AI-generated notes, video lectures, MCQ practice, weekly tests, daily challenges, audio content, leaderboards, a credit/subscription system, and a full admin dashboard for content and user management.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend (Client-Side SPA)
- **Framework:** React 19 with TypeScript
- **Build Tool:** Vite (dev server runs on port 5000, host 0.0.0.0)
- **Styling:** Tailwind CSS (loaded via CDN in index.html), custom CSS in `index.css` with dark mode support (AMOLED black), custom scrollbars, and animations
- **UI Components:** Custom component library in `components/` — no external UI framework. Uses `lucide-react` for icons, `framer-motion` for animations
- **Math Rendering:** KaTeX via `remark-math` and `rehype-katex` for LaTeX formulas
- **Markdown:** `react-markdown` for rendering AI-generated content
- **PDF Handling:** `react-pdf` with `pdfjs-dist` for PDF viewing
- **Video:** Custom YouTube/Google Drive embed player (`CustomPlayer.tsx`), `react-player`
- **Image Cropping:** `react-easy-crop` for profile photo cropping
- **State Management:** React useState/useEffect with localStorage for persistence. No Redux or external state library. The `storage` utility (`utils/storage.ts`) abstracts localStorage operations
- **Path Aliases:** `@/*` maps to project root via tsconfig paths

## Backend / API Layer
- **Serverless Edge Functions:** Located in `api/` directory (designed for Vercel Edge Runtime)
  - `api/gemini.ts` — Proxy for Google Gemini AI API calls (handles key rotation, model selection)
  - `api/groq.ts` — Proxy for Groq AI API calls (LLaMA models, with model allowlist validation)
- **No traditional backend server** — all data operations happen client-side through Firebase SDKs

## Data Storage (Firebase)
- **Firebase Firestore** — Primary document database for structured data (user profiles, chapter data, settings, test results)
- **Firebase Realtime Database (RTDB)** — Used for real-time features (live activity feeds, settings sync, custom page content)
- **Firebase Auth** — Authentication (supports email/password and anonymous sign-in)
- **LocalStorage** — Extensive client-side caching layer for offline support and performance. Nearly all Firebase data is cached locally with `nst_` prefixed keys
- **Data Sanitization:** `sanitizeForFirestore()` helper removes undefined values before Firestore writes (Firestore rejects undefined)

## AI Integrations
- **Google Gemini** — Primary AI for content generation (notes, lesson content, dev assistant). Keys managed via admin dashboard or `GEMINI_API_KEYS` env var
- **Groq (LLaMA/Mixtral)** — Secondary AI for chapter generation, lesson content fetching (`services/groq.ts`). Keys via admin dashboard or `GROQ_API_KEYS` env var
- **Text-to-Speech** — Browser's Web Speech API (`utils/textToSpeech.ts`) for reading content aloud
- **Smart Analysis** — Non-AI topic strength tracking: MCQ results are analyzed locally by tagging questions with topics and tracking per-topic accuracy over time

## Key Architectural Patterns

### Multi-Board Education System
The app supports multiple education boards (CBSE, BSEB) and competitive exam prep. Content is keyed by board, class level, stream (for 11th/12th), subject, and chapter. Key format: `nst_content_{board}_{class}{-stream}_{subject}_{chapterId}`

### Role-Based Access Control
Three roles: STUDENT, ADMIN, SUB_ADMIN. Admin has full control via `AdminDashboard.tsx`. Students see `StudentDashboard.tsx`. Premium/subscription tiers (Basic, Ultra) gate content access.

### Credit & Subscription System
Students earn credits through daily logins, challenges, spin wheel, and activity. Credits can be spent on premium content. Subscription tiers unlock content categories. All tracked in user object and synced to Firebase.

### Content Pipeline
1. Admin configures chapters via the dashboard (manual or AI-generated via Groq/Gemini)
2. Content types include: free/premium notes, MCQs, PDFs, video lectures, audio playlists
3. Content is stored in Firebase with local caching
4. Students access content through a hierarchical navigation: Board → Class → Stream → Subject → Chapter → Content Type

### Offline-First Design
Heavy use of localStorage caching. Firebase data is synced when online but the app functions with cached data when offline. The `WifiOff` icon import suggests offline state handling.

## Project Structure
```
/                    — Root config files, types, constants, syllabus data
/api/                — Vercel Edge serverless functions (Gemini, Groq proxies)
/components/         — React UI components (30+ components)
/components/admin/   — Admin-specific components
/services/           — AI service integrations (groq.ts, adminAi.ts, autoPilot.ts, etc.)
/utils/              — Utility functions (storage, TTS, math rendering, etc.)
```

## Testing
- **Playwright** — Multiple Python verification scripts (`verify_*.py`) for UI testing
- **No unit test framework** currently configured

# External Dependencies

### Firebase (Core Backend)
- **Firestore** — Document database for users, content, settings
- **Realtime Database** — Live data sync (activity feeds, settings)
- **Authentication** — User auth (email/password, anonymous)
- Project ID: `iic-adf79`

### AI APIs (via Edge Proxies)
- **Google Gemini API** — Content generation, dev assistant (keys via env `GEMINI_API_KEYS` or admin config)
- **Groq API** — Chapter/lesson generation using LLaMA/Mixtral models (keys via env `GROQ_API_KEYS` or admin config)

### CDN Dependencies
- **Tailwind CSS** — Loaded via CDN (`cdn.tailwindcss.com`)
- **KaTeX** — Math formula rendering CSS from CDN
- **Google Fonts** — Inter and Crimson Text fonts
- **PDF.js Worker** — Loaded from unpkg CDN

### NPM Packages (Key ones)
- `firebase` — Firebase SDK
- `react-markdown`, `remark-math`, `rehype-katex` — Markdown + math rendering
- `react-pdf`, `pdfjs-dist` — PDF viewing
- `react-easy-crop` — Image cropping
- `framer-motion` — Animations
- `lucide-react` — Icon library
- `html2canvas` — Screenshot/export functionality
- `jszip` — ZIP file handling
- `react-qr-code` — QR code generation
- `zod`, `drizzle-zod` — Schema validation (present in deps but Drizzle ORM not actively used with a database)
- `localforage` — Enhanced local storage