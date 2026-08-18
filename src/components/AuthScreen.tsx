import React, { useState } from 'react';
import { motion } from 'motion/react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

export default function AuthScreen({ onAuthSuccess, onGuest }: { onAuthSuccess: (user: any) => void, onGuest?: () => void }) {
  const [error, setError] = useState('');

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
        
        <div className="w-full flex flex-col gap-4 items-center">
          <GoogleLogin
            onSuccess={credentialResponse => {
              if (credentialResponse.credential) {
                const decoded = jwtDecode(credentialResponse.credential);
                onAuthSuccess(decoded);
              }
            }}
            onError={() => {
              setError('Failed to sign in with Google');
            }}
            theme="filled_black"
            shape="pill"
            text="signin_with"
          />
          
          {onGuest && (
            <button
              onClick={onGuest}
              className="w-full flex items-center justify-center gap-3 bg-white/5 text-white/80 rounded-full py-2.5 px-6 font-medium hover:bg-white/10 border border-white/10 transition-colors text-sm"
            >
              Continue as Guest
            </button>
          )}
        </div>
        
        {error && (
          <p className="mt-4 text-red-400 text-sm text-center bg-red-500/10 py-2 px-3 rounded-lg border border-red-500/20 w-full">{error}</p>
        )}
      </motion.div>
    </div>
  );
}
