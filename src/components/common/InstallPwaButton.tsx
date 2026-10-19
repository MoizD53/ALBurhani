import React, { useState, useEffect } from 'react';
import { Download, Check, Share, PlusSquare, X, Smartphone, Monitor } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Global deferred prompt store so any mounted button can consume it
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((listener) => listener());
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach((listener) => listener());
  });
}

interface InstallPwaButtonProps {
  variant?: 'header' | 'login' | 'sidebar';
  className?: string;
}

export const InstallPwaButton: React.FC<InstallPwaButtonProps> = ({
  variant = 'header',
  className = '',
}) => {
  const [canInstall, setCanInstall] = useState<boolean>(() => Boolean(deferredPrompt));
  const [isStandalone, setIsStandalone] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')
    );
  });
  const [installState, setInstallState] = useState<'idle' | 'prompting' | 'installed'>('idle');
  const [showIosModal, setShowIosModal] = useState(false);

  const isIos = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  useEffect(() => {
    const handleUpdate = () => {
      setCanInstall(Boolean(deferredPrompt));
    };

    listeners.add(handleUpdate);

    // Recheck standalone status
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(display-mode: standalone)');
      const checkMode = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
      mediaQuery.addEventListener('change', checkMode);

      return () => {
        listeners.delete(handleUpdate);
        mediaQuery.removeEventListener('change', checkMode);
      };
    }

    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  // If already installed or running in standalone window, don't show install button
  if (isStandalone || installState === 'installed') {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosModal(true);
      return;
    }

    if (!deferredPrompt) {
      // Browser does not support beforeinstallprompt (e.g. desktop Safari or Firefox)
      // Provide helpful guidance
      setShowIosModal(true);
      return;
    }

    setInstallState('prompting');
    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setInstallState('installed');
        deferredPrompt = null;
        setCanInstall(false);
      } else {
        setInstallState('idle');
      }
    } catch (err) {
      console.warn('Install prompt error:', err);
      setInstallState('idle');
    }
  };

  // Render variant styles
  let buttonContent = null;

  if (variant === 'login') {
    buttonContent = (
      <button
        type="button"
        onClick={handleInstallClick}
        disabled={installState === 'prompting'}
        className={`w-full py-3 px-4 rounded-xl sm:rounded-2xl bg-[#141417] hover:bg-[#1A1A1F] border border-white/[0.1] hover:border-[#D4AF37]/50 text-white font-medium text-xs sm:text-sm transition-all duration-200 flex items-center justify-center gap-2.5 shadow-md group cursor-pointer ${className}`}
        title="Install App"
      >
        {installState === 'prompting' ? (
          <>
            <span className="w-4 h-4 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="text-[#E7C75A] font-semibold">Opening installer…</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4 text-[#D4AF37] group-hover:scale-110 transition-transform shrink-0" />
            <span>Install App</span>
          </>
        )}
      </button>
    );
  } else if (variant === 'sidebar') {
    buttonContent = (
      <button
        type="button"
        onClick={handleInstallClick}
        disabled={installState === 'prompting'}
        className={`w-full py-2 px-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-[#D4AF37]/30 hover:border-[#D4AF37] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all group ${className}`}
        title="Install App"
      >
        <Download className="w-3.5 h-3.5 text-[#D4AF37] group-hover:scale-110 transition-transform shrink-0" />
        <span className="truncate">
          {installState === 'prompting' ? 'Opening installer…' : 'Install App'}
        </span>
      </button>
    );
  } else {
    // Header variant (compact pill)
    buttonContent = (
      <button
        type="button"
        onClick={handleInstallClick}
        disabled={installState === 'prompting'}
        className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-[#121214] hover:bg-[#18181C] border border-[#D4AF37]/40 hover:border-[#D4AF37] text-xs font-semibold text-white shadow-sm transition-all group shrink-0 ${className}`}
        title="Install App"
      >
        {installState === 'prompting' ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="text-[#E7C75A]">Opening installer…</span>
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5 text-[#D4AF37] group-hover:scale-110 transition-transform shrink-0" />
            <span>Install App</span>
          </>
        )}
      </button>
    );
  }

  return (
    <>
      {buttonContent}

      {/* iOS / Fallback Installation Guidance Modal */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
          <div className="relative w-full max-w-sm rounded-2xl bg-[#121214] border border-[#D4AF37]/30 shadow-[0_24px_64px_rgba(0,0,0,0.9)] overflow-hidden">
            
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/[0.08] bg-[#161619] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37]">
                  {isIos ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Install App</h3>
                  <p className="text-[11px] text-[#D4AF37]">Add to Home Screen</p>
                </div>
              </div>
              <button
                onClick={() => setShowIosModal(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step-by-Step Instructions */}
            <div className="p-5 space-y-4 text-xs">
              <p className="text-zinc-300 leading-relaxed">
                Install as a standalone fullscreen app on your device:
              </p>

              {isIos ? (
                <div className="space-y-3 bg-white/[0.02] border border-white/[0.06] rounded-xl p-3.5">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <p className="text-zinc-300">
                      Tap the <strong className="text-white">Share</strong> button <Share className="w-3.5 h-3.5 inline mx-1 text-[#D4AF37]" /> at the bottom of Safari.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <p className="text-zinc-300">
                      Scroll down and tap <strong className="text-white">Add to Home Screen</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-[#D4AF37]" />.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <p className="text-zinc-300">
                      Tap <strong className="text-white">Add</strong> in the top right to complete installation.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-white/[0.02] border border-white/[0.06] rounded-xl p-3.5">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <p className="text-zinc-300">
                      Click the <strong className="text-white">Install</strong> icon in your browser address bar (or browser menu ⋮).
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <p className="text-zinc-300">
                      Select <strong className="text-white">Install App</strong> to launch in dedicated standalone app mode.
                    </p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowIosModal(false)}
                className="w-full py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] text-black font-bold text-xs transition-colors"
              >
                Got It
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
