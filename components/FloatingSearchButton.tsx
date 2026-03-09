import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';

interface Props {
  onClick: () => void;
  isDarkMode: boolean;
}

export const FloatingSearchButton: React.FC<Props> = ({ onClick, isDarkMode }) => {
  const constraintsRef = useRef(null);

  // We constrain it to the viewport
  return (
    <>
      <div
        ref={constraintsRef}
        className="fixed inset-0 pointer-events-none z-[9998]"
        aria-hidden="true"
      />
      <motion.button
        drag
        dragConstraints={constraintsRef}
        dragElastic={0.1}
        dragMomentum={false}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className={`fixed bottom-24 right-6 sm:bottom-12 sm:right-12 z-[9999] w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-2xl transition-colors pointer-events-auto backdrop-blur-md border-2 ${
          isDarkMode
            ? 'bg-blue-600/90 hover:bg-blue-500 border-blue-400/50 text-white shadow-blue-900/50'
            : 'bg-white/90 hover:bg-slate-50 border-white text-blue-600 shadow-slate-300/50'
        }`}
        style={{ touchAction: 'none' }} // Prevents scrolling while dragging on touch devices
      >
        <Search size={24} className="sm:w-7 sm:h-7" />

        {/* Radar ping animation */}
        <span className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-20 pointer-events-none"></span>
      </motion.button>
    </>
  );
};
