import React, { useState, useEffect } from 'react';
import { Volume2, StopCircle, Square, Zap, Settings2 } from 'lucide-react';
import { speakText, stopSpeech } from '../utils/textToSpeech';
import type { SystemSettings } from '../types';

interface Props {
    text: string;
    className?: string;
    iconSize?: number;
    color?: string;
    settings?: SystemSettings;
    onToggleAutoTts?: (enabled: boolean) => void;
    autoPlay?: boolean; // If strictly forced by parent context
    onEnd?: () => void; // Call when finished
}

export const SpeakButton: React.FC<Props> = ({ text, className, iconSize = 18, color = 'text-slate-400', settings, onToggleAutoTts, autoPlay, onEnd }) => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    // Speed is now fixed or derived from a global context/prop in future if needed
    const speed = 1.0;

    // Effect: Handle Auto-Play if enabled globally or locally
    useEffect(() => {
        if (settings?.isAutoTtsEnabled || autoPlay) {
            const timer = setTimeout(() => {
                if (!isSpeaking) triggerSpeech();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [text, settings?.isAutoTtsEnabled, autoPlay]);

    useEffect(() => {
        return () => {
            // Only stop if this specific component triggered it?
            // speakText handles global cancel, so checking isSpeaking is good UI sync
            if (isSpeaking) stopSpeech();
        };
    }, [isSpeaking]);

    const triggerSpeech = () => {
        if (!text) return;
        setIsSpeaking(true);
        speakText(
            text,
            null,
            speed,
            'hi-IN',
            () => setIsSpeaking(true),
            () => {
                setIsSpeaking(false);
                if (onEnd) onEnd();
            }
        ).catch(() => setIsSpeaking(false));
    };

    const handleSpeak = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isSpeaking) {
            stopSpeech();
            setIsSpeaking(false);
        } else {
            triggerSpeech();
        }
    };

    return (
        <button
            onClick={handleSpeak}
            className={`p-2 rounded-full hover:bg-slate-100 transition-colors ${className} ${isSpeaking ? 'text-blue-600 animate-pulse' : color}`}
            title={isSpeaking ? "Stop Speaking" : "Read Aloud"}
        >
            {isSpeaking ? <Square size={iconSize} fill="currentColor" className="opacity-80"/> : <Volume2 size={iconSize} />}
        </button>
    );
};
