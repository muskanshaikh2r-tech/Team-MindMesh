import React from 'react';
import { Cpu, Zap, RotateCcw, ShieldCheck, Sparkles, Volume2 } from 'lucide-react';

interface NavbarProps {
  onResetModels?: () => void;
  activeModelCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ onResetModels, activeModelCount = 4 }) => {
  return (
    <header className="h-16 border-b border-cyan-500/15 bg-space-950/80 backdrop-blur-md sticky top-0 z-50 px-6 flex items-center justify-between">
      {/* Brand & Theme */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-glow-cyan">
            <Cpu className="w-6 h-6 text-space-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-cyan-200 to-blue-400 bg-clip-text text-transparent">
                ModelRouter
              </span>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                A-01
              </span>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30">
                VORTEXA 3.0
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono tracking-wide">
              Smart AI Model Selection & Gateway
            </p>
          </div>
        </div>

        {/* Sponsor/Theme pill matching user screenshot */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-space-900 border border-slate-700/60 text-xs text-slate-300">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>VORTEXA 3.0</span>
          <span className="text-slate-600">|</span>
          <Volume2 className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-purple-300 font-medium">Voice Synthesizer</span>
          <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 rounded text-[9px] font-semibold">Ready</span>
        </div>
      </div>

      {/* Action badges & tools */}
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Offline Gateways Active</span>
          <span className="text-slate-500">({activeModelCount} models)</span>
        </div>

        {onResetModels && (
          <button
            onClick={onResetModels}
            title="Reset model catalogue to factory defaults"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-cyan-300 bg-space-850 hover:bg-space-800 border border-slate-700/60 hover:border-cyan-500/40 rounded-lg transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Defaults</span>
          </button>
        )}

        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-space-900 border border-slate-800 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span className="font-mono text-slate-300">Team VORTEXA</span>
        </div>
      </div>
    </header>
  );
};
