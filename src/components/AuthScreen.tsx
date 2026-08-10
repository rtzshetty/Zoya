import React, { useState } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../services/supabaseService';
import { Loader2 } from 'lucide-react';

export default function AuthScreen({ onGuest }: { onGuest?: () => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    if (!supabase) {
      setError("Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the Settings menu (Environment Variables).");
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to sign in with Google');
      setIsLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] w-screen bg-[#050505] text-white flex flex-col items-center justify-center font-sans relative overflow-hidden">
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-violet-900/20 blur-[80px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-pink-900/20 blur-[80px] rounded-full" />
      </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="z-10 bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-xl max-w-sm w-full mx-4 flex flex-col items-center shadow-2xl"
      >
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 flex items-center justify-center font-bold text-2xl mb-6 shadow-lg shadow-violet-500/20">
          Z
        </div>
        
        <h1 className="text-2xl font-serif font-medium tracking-wide mb-2 text-center">Welcome to Priya</h1>
        <p className="text-white/50 text-sm text-center mb-8">Your highly intelligent, sassy AI assistant</p>
        
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-white text-black rounded-full py-3 px-6 font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            Sign in with Google
          </button>
          
          {onGuest && (
            <button
              onClick={onGuest}
              className="w-full flex items-center justify-center gap-3 bg-white/5 text-white/80 rounded-full py-3 px-6 font-medium hover:bg-white/10 border border-white/10 transition-colors"
            >
              Continue as Guest
            </button>
          )}
        </div>
        
        {error && (
          <p className="mt-4 text-red-400 text-sm text-center bg-red-500/10 py-2 px-3 rounded-lg border border-red-500/20 w-full">{error}</p>
        )}
        
        {window !== window.top && (
          <p className="mt-4 text-amber-400/80 text-xs text-center">
            Note: Google Sign-in may be blocked inside this preview window. If it fails, please click the <strong>"Open in new tab"</strong> icon at the top right of this preview to sign in.
          </p>
        )}
      </motion.div>
    </div>
  );
}
