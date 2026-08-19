import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { User, ArrowRight, Mail, Key } from 'lucide-react';

interface WelcomeScreenProps {
  onNameSubmit: (name: string) => void;
}

export default function WelcomeScreen({ onNameSubmit }: WelcomeScreenProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  
  // Custom Email Verification State
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName) {
      const normalizedName = trimmedName.toLowerCase();
      
      const savedNamesFile = localStorage.getItem('priya_saved_names_file');
      const savedNames: string[] = savedNamesFile ? JSON.parse(savedNamesFile) : [];
      
      if (savedNames.includes(normalizedName)) {
        setError('');
        onNameSubmit(trimmedName);
        return;
      }
      
      savedNames.push(normalizedName);
      localStorage.setItem('priya_saved_names_file', JSON.stringify(savedNames));
      
      setError('');
      onNameSubmit(trimmedName);
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setAuthError('Please enter your email address');
      return;
    }
    
    setIsLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send code');
      
      setStep('code');
    } catch (err: any) {
      setAuthError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) {
      setAuthError('Please enter the verification code');
      return;
    }

    setIsLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify code');
      
      // Success! Use the part of email before @ as default name if new
      const userName = email.split('@')[0];
      onNameSubmit(userName);
    } catch (err: any) {
      setAuthError(err.message || 'Invalid or expired code.');
    } finally {
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
          P
        </div>
        
        <h1 className="text-2xl font-serif font-medium tracking-wide mb-2 text-center">Hello there.</h1>
        <p className="text-white/50 text-sm text-center mb-8">Before we begin, how would you like to continue?</p>
        
        {/* Email OTP Auth Form */}
        {step === 'email' ? (
          <form onSubmit={handleSendCode} className="w-full mb-6 flex flex-col gap-3">
            <div className="relative w-full">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                <Mail size={18} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (authError) setAuthError('');
                }}
                placeholder="Email address"
                className={`w-full bg-white/5 border ${authError ? 'border-red-500/50' : 'border-white/10'} rounded-2xl py-3 pl-12 pr-4 text-white placeholder:text-white/30 outline-none focus:border-violet-500/50 transition-colors text-sm`}
              />
            </div>

            {authError && (
              <p className="w-full text-red-400 text-xs text-center bg-red-500/10 py-2 px-3 rounded-lg border border-red-500/20">{authError}</p>
            )}

            <button
              type="submit"
              disabled={!email || isLoading}
              className="w-full bg-white text-black font-medium py-3 rounded-2xl hover:bg-white/90 disabled:opacity-50 transition-all flex items-center justify-center gap-3 text-sm mt-1"
            >
              {isLoading ? 'Sending...' : 'Send Verification Code'}
            </button>
            
            <div className="w-full flex items-center gap-4 my-2">
              <div className="h-px bg-white/10 flex-1"></div>
              <span className="text-white/30 text-xs font-medium uppercase tracking-widest">OR</span>
              <div className="h-px bg-white/10 flex-1"></div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="w-full mb-6 flex flex-col gap-3">
            <p className="text-xs text-white/70 text-center mb-2">
              We've sent a 6-digit code to <br/><span className="font-medium text-white">{email}</span>
            </p>
            <div className="relative w-full">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                <Key size={18} />
              </div>
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (authError) setAuthError('');
                }}
                placeholder="Enter 6-digit code"
                className={`w-full bg-white/5 border ${authError ? 'border-red-500/50' : 'border-white/10'} rounded-2xl py-3 pl-12 pr-4 text-white placeholder:text-white/30 outline-none focus:border-violet-500/50 transition-colors text-sm tracking-[0.2em] font-mono`}
                maxLength={6}
              />
            </div>

            {authError && (
              <p className="w-full text-red-400 text-xs text-center bg-red-500/10 py-2 px-3 rounded-lg border border-red-500/20">{authError}</p>
            )}

            <button
              type="submit"
              disabled={!code || isLoading}
              className="w-full bg-white text-black font-medium py-3 rounded-2xl hover:bg-white/90 disabled:opacity-50 transition-all flex items-center justify-center gap-3 text-sm mt-1"
            >
              {isLoading ? 'Verifying...' : 'Verify Code'}
            </button>
            
            <button
              type="button"
              onClick={() => setStep('email')}
              className="text-xs text-white/50 hover:text-white/80 mt-2"
            >
              Change email address
            </button>
            
            <div className="w-full flex items-center gap-4 my-2">
              <div className="h-px bg-white/10 flex-1"></div>
              <span className="text-white/30 text-xs font-medium uppercase tracking-widest">OR</span>
              <div className="h-px bg-white/10 flex-1"></div>
            </div>
          </form>
        )}

        {/* Guest Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4 items-center">
          <div className="relative w-full">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
              <User size={18} />
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="Continue as Guest (Enter Name)"
              className={`w-full bg-white/5 border ${error ? 'border-red-500/50' : 'border-white/10'} rounded-2xl py-3 pl-12 pr-4 text-white placeholder:text-white/30 outline-none focus:border-violet-500/50 transition-colors text-sm`}
            />
          </div>
          
          {error && (
            <p className="w-full text-red-400 text-xs text-center bg-red-500/10 py-2 px-3 rounded-lg border border-red-500/20">{error}</p>
          )}

          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition-all rounded-2xl flex items-center justify-center gap-2 font-medium text-sm"
          >
            Start as Guest
            <ArrowRight size={16} />
          </button>
        </form>
      </motion.div>
    </div>
  );
}
