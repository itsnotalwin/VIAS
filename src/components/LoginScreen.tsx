import React, { useState } from 'react';
import { motion } from 'motion/react';
import { googleSignIn } from '../lib/auth';
import { Loader } from 'lucide-react';
import logoUrl from '../assets/logo.svg';

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
    <div className="fixed inset-0 z-[10000] bg-[var(--app-bg)] flex flex-col items-center justify-center p-6 bg-dot-pattern">
      <div className="absolute inset-0 bg-noise pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm flex flex-col items-center relative z-10"
      >
        <div className="w-24 h-24 mb-6 bg-[var(--text)] p-5 rounded-3xl flex items-center justify-center shadow-lg">
          <img 
            src={logoUrl} 
            alt="VIAS Logo" 
            className="w-full h-full object-contain [filter:invert(1)] dark:[filter:invert(0)]"
          />
        </div>
        
        <h1 className="text-3xl font-black mb-1 text-[var(--text)] tracking-tighter text-center font-display">VIAS</h1>
        <p className="text-[var(--text-muted)] text-center text-sm mb-8">
          Secure Visual Internet Archive System.<br/>
          Authentication Required to sync and view archive resources.
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
          className="w-full bg-[var(--text)] text-[var(--app-bg)] font-bold py-4 rounded-xl flex items-center justify-center gap-2.5 transition-all outline-none border border-transparent active:scale-[0.98] disabled:scale-100 disabled:opacity-50 cursor-pointer shadow-md select-none"
        >
          {loading ? (
            <Loader className="w-5 h-5 animate-spin text-[var(--app-bg)]" />
          ) : (
            <svg viewBox="0 0 24 24" className="w-5 h-5 bg-transparent fill-current">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          )}
          <span>{loading ? 'Entering Archive...' : 'Sign In with Google'}</span>
        </button>
      </motion.div>
    </div>
  );
};


