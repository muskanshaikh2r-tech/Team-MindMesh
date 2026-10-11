import React from 'react';
import {
  Home,
  MessageSquare,
  GitFork,
  SlidersHorizontal,
  Mic,
  Activity,
  History,
  Scale,
  Settings,
  Sparkles,
  Volume2
} from 'lucide-react';

export type NavTab = 
  | 'home' 
  | 'ask' 
  | 'flow' 
  | 'comparison' 
  | 'voice' 
  | 'simulation' 
  | 'monitoring' 
  | 'history';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  unseenHistoryCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  unseenHistoryCount = 0
}) => {
  const navItems = [
    { id: 'home' as NavTab, label: 'Home', icon: Home, desc: 'Overview & Scenarios' },
    { id: 'ask' as NavTab, label: 'Ask / Playground', icon: MessageSquare, desc: 'Voice & Text Routing' },
    { id: 'flow' as NavTab, label: 'Routing Flow', icon: GitFork, desc: '4-Stage Pipeline' },
    { id: 'comparison' as NavTab, label: 'Model Comparison', icon: Scale, desc: 'Specs & Decisions' },
    { id: 'voice' as NavTab, label: 'Voice Playground', icon: Mic, desc: 'Spoken Explanations' },
    { id: 'simulation' as NavTab, label: 'Simulation Lab', icon: SlidersHorizontal, desc: 'Judge Failure Toggles' },
    { id: 'monitoring' as NavTab, label: 'Monitoring', icon: Activity, desc: 'Metrics & Savings' },
    { id: 'history' as NavTab, label: 'Request History', icon: History, desc: 'Full Audit Trail', badge: unseenHistoryCount },
  ];

  return (
    <aside className="w-64 border-r border-cyan-500/15 bg-space-950/90 flex flex-col justify-between p-4 shrink-0 select-none">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase font-mono">
          Gateway Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/20 via-blue-500/15 to-transparent text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(0,242,254,0.12)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-space-900/80 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && item.badge > 0 ? (
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Footer info & ElevenLabs branding */}
      <div className="pt-4 border-t border-slate-800/80 space-y-3">
        <div className="p-3 rounded-xl bg-space-900/60 border border-slate-800 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
            <Volume2 className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="overflow-hidden">
            <div className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
              <span>Powered by</span>
              <span className="text-purple-300 font-semibold">ElevenLabs</span>
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              Voice makes AI more human.
            </div>
          </div>
        </div>

        <div className="px-2 text-[10px] font-mono text-slate-500 flex justify-between items-center">
          <span>v1.0.0-hackathon</span>
          <span className="text-cyan-400">Filter→Rank→Try</span>
        </div>
      </div>
    </aside>
  );
};
