import React, { useState, useEffect } from 'react';
import { 
  Database, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Key, 
  RefreshCw, 
  Terminal, 
  UploadCloud, 
  DownloadCloud, 
  ExternalLink,
  ShieldCheck,
  Copy,
  Check
} from 'lucide-react';
import { 
  checkTursoConfig, 
  saveTursoCustomCredentials, 
  initializeTursoSchema, 
  fetchProductsFromTurso 
} from '../../lib/turso';
import { Product } from '../../types';

interface TursoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductsSynced?: (products: Product[]) => void;
}

export const TursoModal: React.FC<TursoModalProps> = ({ isOpen, onClose, onProductsSynced }) => {
  const [dbUrl, setDbUrl] = useState('libsql://al-bhurani-duokarma53.aws-ap-south-1.turso.io');
  const [token, setToken] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'idle' | 'success' | 'error' | 'loading'; text: string }>({
    type: 'idle',
    text: '',
  });
  const [copiedCmd, setCopiedCmd] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = checkTursoConfig();
      setDbUrl(cfg.url);
      const savedToken = typeof window !== 'undefined' ? localStorage.getItem('albhurani_turso_token') || '' : '';
      setToken(savedToken || (import.meta.env.VITE_TURSO_AUTH_TOKEN ? '••••••••••••••••••••' : ''));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestAndConnect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setStatusMessage({ type: 'loading', text: 'Connecting to Turso libSQL cloud...' });

    // Save token if not masked
    if (!token.includes('•••')) {
      saveTursoCustomCredentials(dbUrl, token);
    }

    const res = await initializeTursoSchema();
    if (res.success) {
      setStatusMessage({ type: 'success', text: res.message });
      // Fetch latest products
      const prods = await fetchProductsFromTurso();
      if (prods && prods.length > 0 && onProductsSynced) {
        onProductsSynced(prods);
      }
    } else {
      setStatusMessage({ type: 'error', text: res.message });
    }
  };

  const handleCopyCliCommand = () => {
    navigator.clipboard.writeText('turso db tokens create al-bhurani');
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl rounded-2xl bg-[#0E0E0E] border border-[#D4AF37]/35 shadow-[0_20px_60px_rgba(0,0,0,0.9)] max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header (TENS11 Luxury Gold) */}
        <div className="px-5 sm:px-6 py-4 border-b border-[#D4AF37]/20 bg-gradient-to-r from-black via-[#161616] to-black flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#8B6914] flex items-center justify-center text-black font-bold shadow-[0_0_15px_rgba(212,175,55,0.3)]">
              <Database className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-bold text-white tracking-wide text-sm sm:text-base font-serif flex items-center gap-2">
                Turso Cloud Database
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#E5C158] border border-[#D4AF37]/30">
                  libSQL
                </span>
              </h3>
              <p className="text-[11px] text-gray-400">
                Persistent cloud sync for AL-BHURANI Franchise POS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar">
          
          {/* Status Message Pill */}
          {statusMessage.text && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2.5 animate-fade-in ${
                statusMessage.type === 'loading'
                  ? 'bg-blue-500/10 border border-blue-500/30 text-blue-300'
                  : statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/10 border border-red-500/30 text-red-300'
              }`}
            >
              {statusMessage.type === 'loading' && <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-blue-400" />}
              {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />}
              {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />}
              <span className="flex-1 font-medium">{statusMessage.text}</span>
            </div>
          )}

          {/* Connection Form */}
          <form onSubmit={handleTestAndConnect} className="space-y-4">
            <div>
              <label className="text-xs text-gray-300 font-semibold block mb-1.5">
                Turso Database URL
              </label>
              <div className="relative">
                <Database className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#D4AF37]" />
                <input
                  type="text"
                  value={dbUrl}
                  onChange={(e) => setDbUrl(e.target.value)}
                  className="pl-9 pr-3 py-2 text-xs font-mono bg-black/60 border border-[#D4AF37]/30 text-white rounded-xl focus:border-[#D4AF37]"
                  placeholder="libsql://al-bhurani-duokarma53.aws-ap-south-1.turso.io"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-gray-300 font-semibold flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-[#D4AF37]" />
                  Turso Auth Token
                </label>
                <span className="text-[10px] text-gray-400">
                  Required for read/write access
                </span>
              </div>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your Turso auth token here..."
                className="w-full px-3 py-2 text-xs font-mono bg-black/60 border border-[#D4AF37]/30 text-white rounded-xl focus:border-[#D4AF37]"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                You can save it here in browser memory, or put it in your project's <code className="text-[#D4AF37]">.env</code> as <code className="text-[#D4AF37]">VITE_TURSO_AUTH_TOKEN</code>.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={statusMessage.type === 'loading'}
                className="btn-gold text-xs flex-1 py-2.5 flex items-center justify-center gap-2"
              >
                {statusMessage.type === 'loading' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Connecting & Migrating...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 stroke-[2.2]" />
                    <span>Connect & Sync Turso Database</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  saveTursoCustomCredentials(dbUrl, '');
                  setToken('');
                  setStatusMessage({ type: 'idle', text: 'Switched back to local storage.' });
                }}
                className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 text-xs transition-colors shrink-0"
              >
                Use Offline / Local
              </button>
            </div>
          </form>

          {/* Quick Manual Instructions for User */}
          <div className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 text-[#D4AF37]">
              <Terminal className="w-4 h-4" />
              How to get your Turso Auth Token:
            </h4>

            <div className="space-y-2 text-xs text-gray-300">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div className="flex-1">
                  <p className="leading-snug">Run this command in your terminal / PowerShell:</p>
                  <div className="mt-1 flex items-center justify-between p-2 rounded-lg bg-black/80 border border-white/10 font-mono text-[11px] text-[#E5C158]">
                    <span>turso db tokens create al-bhurani</span>
                    <button
                      onClick={handleCopyCliCommand}
                      className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white"
                      title="Copy command"
                    >
                      {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div className="flex-1">
                  <p className="leading-snug">
                    Alternatively, open <a href="https://turso.tech/app" target="_blank" rel="noreferrer" className="text-[#D4AF37] underline inline-flex items-center gap-0.5">Turso Dashboard <ExternalLink className="w-3 h-3" /></a> → Select database <strong className="text-white">al-bhurani</strong> → Click <strong className="text-white">Create Token</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <p className="leading-snug">
                  Paste the generated token into the box above and click <strong className="text-[#D4AF37]">Connect & Sync</strong>! The app will automatically initialize the tables and sync all Mithai & Namkeen catalog items.
                </p>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
