import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { authenticate } from '../../lib/auth';
import { playBeep } from '../../lib/utils';
import { InstallPwaButton } from '../common/InstallPwaButton';

interface LoginViewProps {
  onLoginSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [userId, setUserId] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!userId.trim()) {
      setErrorMessage('Please enter your User ID.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await authenticate(userId, password);
      if (res.success) {
        playBeep('success');
        onLoginSuccess();
      } else {
        playBeep('error');
        setErrorMessage(res.error || 'Authentication failed. Please verify credentials.');
      }
    } catch {
      playBeep('error');
      setErrorMessage('An unexpected error occurred while logging in.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen h-[100dvh] w-screen flex flex-col justify-between items-center bg-[#050505] text-[#F5F5F5] px-4 py-2 sm:px-6 sm:py-3.5 select-none relative overflow-hidden">
      
      {/* 1. Subtle brushed-metal / luxury dark marble texture overlay */}
      <div 
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.035]"
        style={{
          backgroundImage: `
            linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 40%),
            linear-gradient(225deg, rgba(212,175,55,0.09) 0%, transparent 50%),
            repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 8px)
          `,
        }}
        aria-hidden="true" 
      />

      {/* 2. Layered Ambient Gold Lighting behind login card */}
      <div 
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] sm:w-[920px] h-[720px] sm:h-[920px] rounded-full z-0" 
        style={{
          background: 'radial-gradient(circle at center, rgba(212, 175, 55, 0.13) 0%, rgba(198, 155, 34, 0.05) 35%, rgba(5, 5, 5, 0) 70%)',
          filter: 'blur(55px)',
        }}
        aria-hidden="true" 
      />
      <div 
        className="pointer-events-none absolute -top-36 -right-36 w-[560px] h-[560px] rounded-full z-0 opacity-40" 
        style={{
          background: 'radial-gradient(circle, rgba(231, 199, 90, 0.13) 0%, rgba(212, 175, 55, 0.04) 45%, transparent 70%)',
          filter: 'blur(75px)',
        }}
        aria-hidden="true" 
      />
      <div 
        className="pointer-events-none absolute -bottom-36 -left-36 w-[560px] h-[560px] rounded-full z-0 opacity-35" 
        style={{
          background: 'radial-gradient(circle, rgba(184, 134, 11, 0.14) 0%, rgba(139, 105, 20, 0.03) 50%, transparent 70%)',
          filter: 'blur(75px)',
        }}
        aria-hidden="true" 
      />

      {/* 3. Abstract Flowing Metallic Gold Ribbons around outer edges */}
      <svg
        className="pointer-events-none absolute inset-0 w-full h-full z-0 overflow-hidden"
        viewBox="0 0 1440 900"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="goldRibbon1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7A5C16" stopOpacity="0" />
            <stop offset="20%" stopColor="#C69B22" stopOpacity="0.35" />
            <stop offset="45%" stopColor="#F0D16A" stopOpacity="0.75" />
            <stop offset="65%" stopColor="#D4AF37" stopOpacity="0.5" />
            <stop offset="85%" stopColor="#8A6A1A" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#C69B22" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="goldRibbon2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#8A6A1A" stopOpacity="0" />
            <stop offset="25%" stopColor="#D4AF37" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#FFF0AA" stopOpacity="0.7" />
            <stop offset="75%" stopColor="#C69B22" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#5A430F" stopOpacity="0" />
          </linearGradient>

          <filter id="ribbonGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
          <filter id="subtleGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Left flowing ribbon */}
        <path
          d="M -100 -50 C 220 180, 260 520, -80 820"
          stroke="url(#goldRibbon1)"
          strokeWidth="32"
          strokeLinecap="round"
          opacity="0.2"
          filter="url(#ribbonGlow)"
        />
        <path
          d="M -100 -50 C 220 180, 260 520, -80 820"
          stroke="url(#goldRibbon1)"
          strokeWidth="10"
          strokeLinecap="round"
          opacity="0.45"
          filter="url(#subtleGlow)"
        />
        <path
          d="M -100 -50 C 220 180, 260 520, -80 820"
          stroke="url(#goldRibbon1)"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* Right flowing ribbon */}
        <path
          d="M 1540 80 C 1220 280, 1180 620, 1500 950"
          stroke="url(#goldRibbon2)"
          strokeWidth="36"
          strokeLinecap="round"
          opacity="0.18"
          filter="url(#ribbonGlow)"
        />
        <path
          d="M 1540 80 C 1220 280, 1180 620, 1500 950"
          stroke="url(#goldRibbon2)"
          strokeWidth="12"
          strokeLinecap="round"
          opacity="0.45"
          filter="url(#subtleGlow)"
        />
        <path
          d="M 1540 80 C 1220 280, 1180 620, 1500 950"
          stroke="url(#goldRibbon2)"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* Bottom decorative wave */}
        <path
          d="M 120 940 C 440 830, 980 910, 1340 810"
          stroke="url(#goldRibbon1)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.3"
        />
      </svg>

      {/* 4. Subtle static luxury gold micro-highlights */}
      <div className="pointer-events-none absolute top-[16%] left-[10%] w-1 h-1 rounded-full bg-[#FFF0AA] opacity-40 shadow-[0_0_8px_#D4AF37]" aria-hidden="true" />
      <div className="pointer-events-none absolute top-[26%] right-[11%] w-1.5 h-1.5 rounded-full bg-[#F0D16A] opacity-30 shadow-[0_0_6px_#D4AF37]" aria-hidden="true" />
      <div className="pointer-events-none absolute bottom-[24%] left-[14%] w-1.5 h-1.5 rounded-full bg-[#F0D16A] opacity-35 shadow-[0_0_6px_#D4AF37]" aria-hidden="true" />
      <div className="pointer-events-none absolute bottom-[14%] right-[8%] w-1 h-1 rounded-full bg-[#FFF0AA] opacity-40 shadow-[0_0_8px_#D4AF37]" aria-hidden="true" />

      {/* Centered Login Card */}
      <div className="w-full max-w-[460px] sm:max-w-[490px] my-auto relative z-10 animate-fade-in max-h-[96dvh] overflow-y-auto custom-scrollbar">
        <div 
          className="rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 relative overflow-hidden border border-[#D4AF37]/25 shadow-[0_22px_75px_-15px_rgba(0,0,0,0.95),0_0_45px_-10px_rgba(212,175,55,0.14)] backdrop-blur-2xl"
          style={{
            background: 'linear-gradient(165deg, rgba(24, 24, 30, 0.98) 0%, rgba(15, 15, 19, 0.98) 50%, rgba(10, 10, 13, 0.99) 100%)',
          }}
        >
          
          {/* Subtle top edge champagne highlight line */}
          <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#E7C75A]/70 to-transparent" />

          {/* Official AL-BHURANI Round Logo */}
          <div className="mx-auto mb-3 sm:mb-3.5 w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-gradient-to-b from-[#E7C75A]/60 via-[#D4AF37]/30 to-transparent shadow-[0_0_24px_rgba(212,175,55,0.38)] flex items-center justify-center">
            <div className="w-full h-full rounded-full overflow-hidden bg-white/95 border border-[#D4AF37]/60 shadow-inner flex items-center justify-center">
              <img
                src="/logo.png"
                alt="Al Burhani Sweet Mart Logo"
                className="w-full h-full object-contain rounded-full drop-shadow-sm select-none"
              />
            </div>
          </div>

          {/* Brand Name */}
          <div className="text-center">
            <h1 className="font-serif text-3xl sm:text-4xl font-black tracking-[0.22em] uppercase leading-none text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-100 to-zinc-300 drop-shadow-[0_2px_12px_rgba(255,255,255,0.1)]">
              AL-BHURANI
            </h1>
            {/* Brighter champagne gold decorative divider */}
            <div className="w-16 h-[1.5px] mx-auto bg-gradient-to-r from-transparent via-[#E7C75A] to-transparent mt-2.5 mb-3.5 sm:mb-4 shadow-[0_0_8px_rgba(231,199,90,0.4)]" />
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/35 text-red-400 text-xs flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium leading-snug">{errorMessage}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5">
            
            {/* User ID Field */}
            <div>
              <label className="text-[11px] font-bold text-[#E7C75A] tracking-wider uppercase block mb-1">
                USER ID
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#E7C75A] pointer-events-none z-10">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  data-login-input="true"
                  style={{ 
                    paddingLeft: '42px', 
                    paddingRight: '16px', 
                    backgroundColor: '#181D26', 
                    color: '#FFFFFF',
                    WebkitTextFillColor: '#FFFFFF',
                    caretColor: '#E7C75A'
                  }}
                  className="login-input w-full py-3 rounded-xl sm:rounded-2xl border !border-white/[0.12] !text-white !bg-[#181D26] text-xs sm:text-sm font-medium placeholder:!text-zinc-400 placeholder:!opacity-90 focus:outline-none focus:!border-[#E7C75A] focus:ring-2 focus:ring-[#D4AF37]/25 transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="text-[11px] font-bold text-[#E7C75A] tracking-wider uppercase block mb-1">
                PASSWORD
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#E7C75A] pointer-events-none z-10">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="admin123"
                  autoComplete="current-password"
                  data-login-input="true"
                  style={{ 
                    paddingLeft: '42px', 
                    paddingRight: '42px', 
                    backgroundColor: '#181D26', 
                    color: '#FFFFFF',
                    WebkitTextFillColor: '#FFFFFF',
                    caretColor: '#E7C75A'
                  }}
                  className="login-input w-full py-3 rounded-xl sm:rounded-2xl border !border-white/[0.12] !text-white !bg-[#181D26] text-xs sm:text-sm font-medium placeholder:!text-zinc-400 placeholder:!opacity-90 focus:outline-none focus:!border-[#E7C75A] focus:ring-2 focus:ring-[#D4AF37]/25 transition-all shadow-inner font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1 rounded-lg transition-colors z-10 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Sign In Button with Rich Champagne Gold Gradient */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  background: 'linear-gradient(135deg, #F0D16A 0%, #D4AF37 50%, #C69B22 100%)',
                }}
                className="w-full py-3 sm:py-3.5 px-6 rounded-xl sm:rounded-2xl text-[#080808] font-black text-xs sm:text-sm tracking-[0.2em] uppercase transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(212,175,55,0.38)] hover:brightness-110 hover:shadow-[0_6px_30px_rgba(212,175,55,0.5)] hover:scale-[1.008] active:scale-[0.99] cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#080808]" />
                    <span>AUTHENTICATING...</span>
                  </>
                ) : (
                  <>
                    <span>SIGN IN</span>
                    <ArrowRight className="w-4 h-4 text-[#080808] stroke-[3]" />
                  </>
                )}
              </button>
            </div>

            {/* Micro subtitle beneath button */}
            <p className="text-[10px] tracking-[0.26em] text-zinc-400 uppercase text-center pt-1.5 font-bold">
              SECURE STORE ACCESS
            </p>

            {/* Install App Button */}
            <div className="pt-1">
              <InstallPwaButton variant="login" className="!py-2.5 sm:!py-3 !text-xs sm:!text-sm !rounded-xl sm:!rounded-2xl" />
            </div>

          </form>

        </div>
      </div>

      {/* Slim Bottom Footer matching reference style */}
      <footer className="w-full max-w-xl py-2 px-4 rounded-full bg-[#121215]/90 border border-white/[0.1] hover:border-[#D4AF37]/30 flex items-center justify-center gap-2.5 text-[11px] sm:text-xs text-zinc-400 text-center relative z-10 shadow-lg backdrop-blur-md transition-all shrink-0">
        <Lock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        <span className="truncate">© 2026 AL-BHURANI. All rights reserved.</span>
        <span className="text-zinc-600">|</span>
        <span className="text-[#E7C75A] font-semibold tracking-wide shrink-0">Powered by Duokarma</span>
      </footer>

    </div>
  );
};
