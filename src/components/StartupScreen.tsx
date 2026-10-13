import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Blob } from './Blob';

interface StartupScreenProps {
  onComplete: () => void;
}

const STATUS_MESSAGES = [
  "Opening your archive",
  "Loading collections",
  "Syncing items",
  "Preparing the canvas",
  "Arranging thumbnails",
  "Almost ready"
];

export const StartupScreen: React.FC<StartupScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const nextIndex = Math.min(
      STATUS_MESSAGES.length - 1,
      Math.floor((progress / 100) * STATUS_MESSAGES.length)
    );
    if (nextIndex !== statusIndex) {
      setStatusIndex(nextIndex);
    }
  }, [progress, statusIndex]);

  useEffect(() => {
    let currentProgress = 0;
    let timer: any;

    const tick = () => {
      let increment = 1;
      if (currentProgress < 30) increment = Math.random() * 2 + 0.5;
      else if (currentProgress < 70) increment = Math.random() * 3 + 1;
      else if (currentProgress < 90) increment = Math.random() * 1 + 0.2;
      else increment = 0.5;

      currentProgress = Math.min(100, currentProgress + increment);
      setProgress(currentProgress);

      if (currentProgress < 100) {
        const nextDelay = currentProgress > 85 ? 150 : 40;
        timer = setTimeout(tick, nextDelay);
      } else {
        setTimeout(() => {
          setIsExiting(true);
          setTimeout(onComplete, 900);
        }, 700);
      }
    };

    timer = setTimeout(tick, 500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={isExiting ? { opacity: 0 } : { opacity: 1 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[10000] bg-[var(--app-bg)] text-[var(--text)] select-none overflow-hidden"
    >
      {/* Cover art: soft disc, halftone field, grain blob */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-[18vmin] top-[14vh] w-[78vmin] h-[78vmin] rounded-full bg-[var(--soft)]" />
        <div className="absolute left-[8vmin] top-[22vh] w-[44vmin] h-[44vmin] halftone" />
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          className="absolute -right-[14vmin] top-[28vh] w-[62vmin] h-[62vmin]"
        >
          <Blob variant={0} grain={0.3} className="w-full h-full" />
        </motion.div>
      </div>

      <div className="absolute top-[max(2rem,env(safe-area-inset-top))] inset-x-0 flex justify-center">
        <span className="font-display text-3xl tracking-[0.04em]">VIAS<span className="inline-block w-[0.22em] h-[0.22em] rounded-full bg-[var(--text)] ml-[0.12em]" /></span>
      </div>

      <div className="absolute left-8 right-8 md:left-16 bottom-[max(2.5rem,env(safe-area-inset-bottom))] max-w-xl">
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="font-display text-4xl md:text-6xl leading-[1.08] text-balance"
        >
          A quiet place for everything you keep.
        </motion.h1>

        <div className="mt-8 flex items-center gap-4">
          <div className="flex-1 h-px bg-[var(--border-bright)] relative overflow-hidden">
            <motion.div
              className="absolute left-0 top-0 bottom-0 bg-[var(--text)]"
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: "linear" }}
            />
          </div>
          <span className="text-xs font-mono tabular-nums text-[var(--text)] w-10 text-right">{Math.floor(progress)}%</span>
        </div>
        <div className="mt-3 h-4 text-[11px] text-[var(--text-muted)]">
          <AnimatePresence mode="wait">
            <motion.span
              key={statusIndex}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className="block"
            >
              {STATUS_MESSAGES[statusIndex]}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};
