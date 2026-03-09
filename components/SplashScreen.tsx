import React, { useEffect, useState } from 'react';

interface Props {
  onComplete: () => void;
  appName?: string;
  appLogo?: string;
}

import { useRef } from 'react';

export const SplashScreen: React.FC<Props> = ({ onComplete, appName = "NSTA", appLogo }) => {
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (progressRef.current >= 100) return; // Prevent restart if already complete

    // Always show splash on first load
    const duration = 2500; // 2.5 seconds total
    const intervalTime = 25; // Update every 25ms
    const steps = duration / intervalTime;

    const interval = setInterval(() => {
        // We use the same speed but track the step linearly
        // to avoid restarting if the component re-renders
        progressRef.current += (100 / steps);
        const newProgress = Math.min(100, Math.round(progressRef.current));
        setProgress(newProgress);

        if (newProgress >= 100) {
            clearInterval(interval);
            setTimeout(() => onCompleteRef.current(), 200); // small delay after reaching 100%
        }
    }, intervalTime);

    return () => clearInterval(interval);
  }, []); // Empty dependency array ensures interval only starts once

  return (
    <div className="fixed top-0 left-0 w-screen h-[100dvh] z-[99999] bg-[#0f172a] flex flex-col items-center justify-center p-6 m-0" style={{ backgroundImage: 'linear-gradient(to bottom, #0f172a, #1e293b)' }}>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
           <div className="absolute top-[20%] left-[50%] -translate-x-1/2 w-[80%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="flex flex-col items-center justify-center space-y-6 relative z-10 w-full">
        <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-3xl shadow-2xl flex items-center justify-center p-4 relative border border-white/20">
            {appLogo ? (
                <img src={appLogo} alt="Logo" className="w-full h-full object-contain rounded-2xl" />
            ) : (
                <div className="w-full h-full rounded-2xl flex items-center justify-center bg-blue-600">
                    <span className="text-4xl font-black text-white">{appName?.[0] || 'N'}</span>
                </div>
            )}
        </div>

        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black text-white tracking-tight uppercase">
            {appName}
          </h1>
          <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">
            Ideal Inspiration Classes
          </p>
        </div>
      </div>

      <div className="absolute bottom-16 left-0 right-0 px-12 flex flex-col items-center gap-3">
        <div className="w-full max-w-[200px] h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
           <div
             className="h-full bg-gradient-to-r from-blue-600 to-indigo-400 rounded-full transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(59,130,246,0.5)]"
             style={{ width: `${progress}%` }}
           />
        </div>
        <div className="text-slate-400 text-xs font-mono font-bold tracking-wider">
            {progress}%
        </div>
      </div>

    </div>
  );
};
