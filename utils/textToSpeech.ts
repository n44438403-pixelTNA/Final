import { safeSetLocalStorage } from '../utils/safeStorage';

export const getAvailableVoices = (): Promise<SpeechSynthesisVoice[]> => {
    if (!('speechSynthesis' in window)) {
        return Promise.resolve([]);
    }
    
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
        return Promise.resolve(voices);
    }

    return new Promise((resolve) => {
        // Voices might load asynchronously
        const handler = () => {
            const v = window.speechSynthesis.getVoices();
            if (v.length > 0) {
                window.speechSynthesis.removeEventListener('voiceschanged', handler);
                resolve(v);
            }
        };
        
        window.speechSynthesis.addEventListener('voiceschanged', handler);

        // Fallback timeout: If no voices after 1s, return empty (don't block too long)
        // Android WebView often has issues here, so we shouldn't wait forever.
        setTimeout(() => {
             window.speechSynthesis.removeEventListener('voiceschanged', handler);
             resolve(window.speechSynthesis.getVoices());
        }, 1000);
    });
};

export const getCategorizedVoices = async () => {
    const voices = await getAvailableVoices();
    return {
        hindi: voices.filter(v => v.lang.includes('hi') || v.name.toLowerCase().includes('hindi')),
        indianEnglish: voices.filter(v => v.lang === 'en-IN' || (v.lang.includes('en') && v.name.toLowerCase().includes('india'))),
        others: voices.filter(v => !v.lang.includes('hi') && !v.name.toLowerCase().includes('hindi') && v.lang !== 'en-IN' && !v.name.toLowerCase().includes('india'))
    };
};

export const setPreferredVoice = (voiceURI: string) => {
    safeSetLocalStorage('nst_preferred_voice_uri', voiceURI);
};

export const getPreferredVoice = async (): Promise<SpeechSynthesisVoice | undefined> => {
    const uri = localStorage.getItem('nst_preferred_voice_uri');
    const voices = await getAvailableVoices();
    if (!uri) return undefined;
    return voices.find(v => v.voiceURI === uri);
};

export const stripHtml = (html: string): string => {
    const tempDiv = document.createElement("div");
    // Replace closing tags with themselves plus a space to avoid word mashing during textContent extraction
    // e.g. <li>A</li><li>B</li> -> A B instead of AB
    const spacedHtml = html.replace(/(<\/[a-z0-9]+>)/gi, '$1 ');
    tempDiv.innerHTML = spacedHtml;
    let text = tempDiv.textContent || tempDiv.innerText || "";

    // Remove emojis and common non-alphanumeric symbols that often break speech synthesis engines
    text = text.replace(/[\u{1F600}-\u{1F64F}]/gu, ''); // Emoticons
    text = text.replace(/[\u{1F300}-\u{1F5FF}]/gu, ''); // Misc Symbols and Pictographs
    text = text.replace(/[\u{1F680}-\u{1F6FF}]/gu, ''); // Transport and Map
    text = text.replace(/[\u{2600}-\u{26FF}]/gu, ''); // Misc symbols
    text = text.replace(/[\u{2700}-\u{27BF}]/gu, ''); // Dingbats
    text = text.replace(/[\u{1F900}-\u{1F9FF}]/gu, ''); // Supplemental Symbols and Pictographs
    text = text.replace(/[\u{1FA70}-\u{1FAFF}]/gu, ''); // Symbols and Pictographs Extended-A

    return text;
};

export const speakText = async (
    text: string,
    voice?: SpeechSynthesisVoice | null,
    rate: number = 1.0,
    lang: string = 'en-US',
    onStart?: () => void,
    onEnd?: () => void
): Promise<SpeechSynthesisUtterance | null> => {
    if (!('speechSynthesis' in window)) {
        console.warn('Text-to-speech not supported.');
        return null;
    }

    // ROBUSTNESS: Cancel any existing speech immediately
    try {
        window.speechSynthesis.cancel();
    } catch (e) {
        console.error("Error canceling speech:", e);
    }

    // Strip HTML if present
    const cleanText = stripHtml(text);
    if (!cleanText.trim()) return null;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Priority: Explicit Voice -> User Preferred Voice -> Auto-Detect Premium Indian -> Default
    let selectedVoice = voice;
    let voices: SpeechSynthesisVoice[] = [];
    
    if (!selectedVoice) {
        try {
             voices = window.speechSynthesis.getVoices();
             if (voices.length > 0) {
                 // 1. Try to get User Preferred Voice first
                 const uri = localStorage.getItem('nst_preferred_voice_uri');
                 if (uri) {
                     selectedVoice = voices.find(v => v.voiceURI === uri);
                 }

                 // 2. If no user preference, and language is Hindi, proactively search for high-quality Indian voices
                 if (!selectedVoice && lang.includes('hi')) {
                     // Rank premium/online voices higher than standard local robotic ones
                     const premiumHindi = voices.filter(v => v.lang === 'hi-IN' || v.lang === 'hi_IN').sort((a, b) => {
                         const aName = a.name.toLowerCase();
                         const bName = b.name.toLowerCase();
                         // Google's online voices and Microsoft's Natural voices sound much better
                         const aScore = (aName.includes('google') || aName.includes('natural') || aName.includes('online')) ? 1 : 0;
                         const bScore = (bName.includes('google') || bName.includes('natural') || bName.includes('online')) ? 1 : 0;
                         return bScore - aScore;
                     });

                     if (premiumHindi.length > 0) {
                         selectedVoice = premiumHindi[0];
                     }
                 }
             }
        } catch (e) {
            console.warn("Failed to retrieve voices synchronously:", e);
        }
    }

    // --- APK / WEBVIEW FALLBACK LOGIC ---
    // If we have 0 voices loaded (common in AppGeyser/Median WebViews), native TTS will silently fail.
    // We intercept this and route through a Google Translate Audio stream.
    if (voices.length === 0 && !selectedVoice && navigator.userAgent.toLowerCase().includes('android')) {
        console.warn("Native TTS missing voices. Falling back to Google TTS API.");
        try {
            if (onStart) onStart();

            // Limit text length for free API (max 200 chars roughly per chunk, but modern browsers can handle long URLs)
            // For robust chunking we just take the first ~200 chars in fallback to avoid URL length limits
            const safeText = encodeURIComponent(cleanText.substring(0, 200));
            const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${safeText}&tl=${lang.split('-')[0]}&client=tw-ob`;

            const audio = new Audio(audioUrl);
            audio.playbackRate = rate;

            audio.onended = () => { if (onEnd) onEnd(); };
            audio.onerror = () => { if (onEnd) onEnd(); };

            // Save global reference to allow stopping
            (window as any).fallbackAudioTTS = audio;
            audio.play().catch(e => {
                console.error("Fallback Audio Play Failed:", e);
                if (onEnd) onEnd();
            });

            return null; // Not returning an utterance because we used Audio
        } catch (err) {
            console.error("Fallback TTS also failed", err);
            if (onEnd) onEnd();
            return null;
        }
    }

    if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
    } else {
        utterance.lang = lang;
    }
    
    utterance.rate = rate;
    utterance.pitch = 1.0;

    if (onStart) utterance.onstart = onStart;

    // Robust onEnd handling
    utterance.onend = () => {
        if (onEnd) onEnd();
    };

    // Error handling
    utterance.onerror = (e) => {
        console.error("Speech Error (TTS):", e);
        // Ensure onEnd is called even on error so UI doesn't get stuck
        if(onEnd) onEnd();
    };

    // Android WebView Workaround:
    // Sometimes speaking immediately after creation fails.
    // We wrap in a small timeout to ensure the engine is ready.
    setTimeout(() => {
        try {
            window.speechSynthesis.speak(utterance);

            // Resume if paused (sometimes helps in Android)
            if (window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
            }
        } catch (e) {
            console.error("Speech Synthesis Failed:", e);
            if (onEnd) onEnd();
        }
    }, 10);

    return utterance;
};

export const stopSpeech = () => {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    // Stop fallback audio if playing
    if ((window as any).fallbackAudioTTS) {
        try {
            (window as any).fallbackAudioTTS.pause();
            (window as any).fallbackAudioTTS.currentTime = 0;
        } catch(e) {}
    }
};
