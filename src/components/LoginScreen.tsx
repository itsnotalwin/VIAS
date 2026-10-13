import React, { useState } from 'react';
import { motion } from 'motion/react';
import { googleSignIn } from '../lib/auth';
import { Loader } from 'lucide-react';
import { Blob } from './Blob';

export const LoginScreen: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      await googleSignIn();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-[var(--app-bg)] text-[var(--text)] overflow-hidden flex flex-col items-center justify-center p-6">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-[20vmin] -top-[10vmin] w-[70vmin] h-[70vmin] rounded-full bg-[var(--soft)]" />
        <div className="absolute right-[6vmin] top-[10vmin] w-[34vmin] h-[34vmin] halftone" />
        <Blob variant={1} grain={0.3} className="absolute -left-[12vmin] -top-[4vmin] w-[56vmin] h-[56vmin]" />
        <Blob variant={2} grain={0.3} className="absolute -right-[16vmin] -bottom-[16vmin] w-[52vmin] h-[52vmin] opacity-90" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm flex flex-col relative z-10 bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-8 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)]"
      >
        <span className="font-display text-3xl tracking-[0.04em] mb-6">VIAS<span className="inline-block w-[0.22em] h-[0.22em] rounded-full bg-[var(--text)] ml-[0.12em]" /></span>

        <h1 className="text-3xl leading-[1.12] mb-3 text-[var(--text)] font-display">Sign in to open your archive.</h1>
        <p className="text-[var(--text-muted)] text-sm mb-8 font-light leading-relaxed">
          Your links, images, PDFs and notes sync to your account and stay on this device too.
        </p>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full bg-red-500/10 border border-red-500/20 text-red-500 text-xs px-4 py-3 rounded-xl text-center mb-4"
          >
            {error}
          </motion.div>
        )}

        <button
          type="button"
          disabled={loading}
          onClick={handleGoogleLogin}
          className="w-full bg-[var(--text)] text-[var(--on)] font-semibold py-4 rounded-full flex items-center justify-center gap-2.5 transition-all outline-none border border-transparent active:scale-[0.98] disabled:scale-100 disabled:opacity-50 cursor-pointer select-none"
        >
          {loading ? (
            <Loader className="w-5 h-5 animate-spin text-[var(--on)]" />
          ) : (
            <svg viewBox="0 0 24 24" className="w-5 h-5 bg-transparent fill-current">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          <span>{loading ? 'Entering Archive...' : 'Sign In with Google'}</span>
        </button>
      </motion.div>
    </div>
  );
};


