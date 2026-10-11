import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Mic,
  MicOff,
  Sliders,
  DollarSign,
  Clock,
  Award,
  Layers,
  CheckCircle,
  XCircle,
  AlertOctagon,
  Volume2,
  VolumeX,
  FileText,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Zap
} from 'lucide-react';
import { RouteRequest, RouteResponse, PreferenceType } from '../types';
import { routeRequest } from '../services/api';

interface AskPageProps {
  initialPrompt?: string;
  initialParams?: Partial<RouteRequest>;
  onRoutingCompleted?: (response: RouteResponse) => void;
  lastResponse: RouteResponse | null;
  setLastResponse: (res: RouteResponse | null) => void;
}

export const AskPage: React.FC<AskPageProps> = ({
  initialPrompt = '',
  initialParams,
  onRoutingCompleted,
  lastResponse,
  setLastResponse
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [maxLatency, setMaxLatency] = useState<number | ''>(initialParams?.max_latency_ms ?? 2500);
  const [maxCost, setMaxCost] = useState<number | ''>(initialParams?.max_cost ?? 0.05);
  const [minCapability, setMinCapability] = useState<number | 'auto'>(initialParams?.min_capability ?? 'auto');
  const [contextOverride, setContextOverride] = useState<number | ''>(initialParams?.context_override ?? '');
  const [expectedOutputTokens, setExpectedOutputTokens] = useState(500);
  const [preference, setPreference] = useState<PreferenceType>(initialParams?.preference ?? 'lowest_cost');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'response' | 'evaluations' | 'failover' | 'audio' | 'json'>('response');

  // Speech Recognition
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Audio Speech Synthesis
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  useEffect(() => {
    if (initialPrompt) setPrompt(initialPrompt);
    if (initialParams) {
      if (initialParams.max_latency_ms !== undefined) setMaxLatency(initialParams.max_latency_ms ?? '');
      if (initialParams.max_cost !== undefined) setMaxCost(initialParams.max_cost ?? '');
      if (initialParams.min_capability !== undefined) setMinCapability(initialParams.min_capability ?? 'auto');
      if (initialParams.context_override !== undefined) setContextOverride(initialParams.context_override ?? '');
      if (initialParams.preference) setPreference(initialParams.preference);
    }
  }, [initialPrompt, initialParams]);

  // Speech to Text handler
  const toggleSpeechRecognition = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

  // Text to Speech playback
  const playAudioExplanation = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    
    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    setIsPlayingAudio(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError(null);

    const payload: RouteRequest = {
      prompt: prompt.trim(),
      max_latency_ms: maxLatency === '' ? null : Number(maxLatency),
      max_cost: maxCost === '' ? null : Number(maxCost),
      min_capability: minCapability === 'auto' ? null : Number(minCapability),
      context_override: contextOverride === '' ? null : Number(contextOverride),
      expected_output_tokens: expectedOutputTokens,
      preference: preference
    };

    try {
      const res = await routeRequest(payload);
      setLastResponse(res);
      if (onRoutingCompleted) onRoutingCompleted(res);
      setActiveTab('response');
    } catch (err: any) {
      setError(err.message || 'Routing failed');
    } finally {
      setLoading(false);
    }
  };

  const copyJson = () => {
    if (!lastResponse) return;
    navigator.clipboard.writeText(JSON.stringify(lastResponse, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const samplePresets = [
    { label: 'C++ Pointers (L3)', prompt: 'Explain pointers in C++ with examples and memory layout.' },
    { label: 'Palindrome Check (L1)', prompt: 'Write a python function to find a palindrome string.' },
    { label: 'Debug Race Condition (L4)', prompt: 'Debug this multithreaded queue implementation and fix the deadlock.' },
    { label: 'Contract Liability (L5)', prompt: 'Analyze indemnification liability clauses in this 30-page commercial vendor agreement.' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Send className="w-6 h-6 text-cyan-400" />
            <span>Interactive Routing Playground</span>
          </h1>
          <p className="text-xs text-slate-400">
            Send queries through the deterministic filter-rank-try pipeline with real-time complexity estimation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-space-900 border border-slate-700 text-xs text-slate-300 font-mono">
            Mode: {minCapability === 'auto' ? 'AI Auto-Detect' : `Manual Cap ${minCapability}`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Form & Constraints Controls */}
        <div className="lg:col-span-6 space-y-5">
          <form onSubmit={handleSubmit} className="p-6 rounded-3xl glass-panel space-y-5">
            {/* Prompt input area with voice button */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                  Prompt Text
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleSpeechRecognition}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      isListening
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                        : 'bg-space-850 hover:bg-space-800 text-slate-400 hover:text-cyan-300 border border-slate-700/60'
                    }`}
                  >
                    {isListening ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5 text-cyan-400" />}
                    <span>{isListening ? 'Listening...' : 'Voice Dictation'}</span>
                  </button>
                </div>
              </div>

              <div className="relative">
                <textarea
                  rows={5}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter your query or click a preset below..."
                  className="w-full bg-space-950/80 rounded-2xl border border-slate-800 focus:border-cyan-400 p-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-all resize-none shadow-inner"
                />
                {prompt && (
                  <div className="absolute bottom-3 right-3 text-[10px] font-mono text-slate-500 bg-space-900/80 px-2 py-0.5 rounded">
                    ~{Math.max(1, Math.ceil(prompt.length / 4))} tokens
                  </div>
                )}
              </div>

              {/* Preset prompt pills */}
              <div className="flex flex-wrap gap-2 pt-1">
                {samplePresets.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(p.prompt)}
                    className="px-2.5 py-1 rounded-lg bg-space-900 hover:bg-space-850 border border-slate-800 hover:border-cyan-500/30 text-[11px] text-slate-400 hover:text-cyan-300 transition-all"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hard Constraints Controls */}
            <div className="space-y-4 pt-2 border-t border-slate-800/80">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span>Hard Constraints (Pass / Fail)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Max Latency */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" /> Max Latency
                    </span>
                    <span className="text-cyan-400 font-mono text-[11px]">
                      {maxLatency === '' ? 'Unlimited' : `${maxLatency} ms`}
                    </span>
                  </div>
                  <input
                    type="number"
                    step="50"
                    placeholder="e.g. 1000 (ms)"
                    value={maxLatency}
                    onChange={(e) => setMaxLatency(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-space-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>

                {/* Max Cost */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Max Cost Cap
                    </span>
                    <span className="text-emerald-400 font-mono text-[11px]">
                      {maxCost === '' ? 'Unlimited' : `$${Number(maxCost).toFixed(4)}`}
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.0005"
                    placeholder="e.g. 0.01 ($)"
                    value={maxCost}
                    onChange={(e) => setMaxCost(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-space-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>

                {/* Min Capability Override */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-purple-400" /> Required Quality
                    </span>
                    <span className="text-purple-300 font-mono text-[11px]">
                      {minCapability === 'auto' ? 'Auto Complexity' : `Cap ${minCapability}`}
                    </span>
                  </div>
                  <select
                    value={minCapability}
                    onChange={(e) => setMinCapability(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}
                    className="w-full bg-space-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
                  >
                    <option value="auto">Auto AI Estimator (1-5)</option>
                    <option value="1">Level 1 (Mini / Lookup)</option>
                    <option value="2">Level 2 (Small / Explanations)</option>
                    <option value="3">Level 3 (Medium / Coding & SQL)</option>
                    <option value="4">Level 4 (Advanced / Debugging)</option>
                    <option value="5">Level 5 (Large / Frontier Reasoning)</option>
                  </select>
                </div>

                {/* Context Override */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-blue-400" /> Context Override
                    </span>
                    <span className="text-blue-300 font-mono text-[11px]">
                      {contextOverride === '' ? 'Prompt tokens' : `${contextOverride} tokens`}
                    </span>
                  </div>
                  <input
                    type="number"
                    step="1000"
                    placeholder="e.g. 10000 (tokens)"
                    value={contextOverride}
                    onChange={(e) => setContextOverride(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-space-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Optimization Preference (Deterministic Ranking) */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
                Optimization Preference (Ranks Valid Models)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'lowest_cost' as PreferenceType, label: 'Lowest Cost', icon: DollarSign, color: 'text-emerald-400' },
                  { id: 'lowest_latency' as PreferenceType, label: 'Lowest Latency', icon: Clock, color: 'text-cyan-400' },
                  { id: 'highest_capability' as PreferenceType, label: 'Highest Quality', icon: Award, color: 'text-purple-400' },
                ].map((pref) => {
                  const Icon = pref.icon;
                  const isSelected = preference === pref.id;
                  return (
                    <button
                      key={pref.id}
                      type="button"
                      onClick={() => setPreference(pref.id)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-space-800 border-2 border-cyan-400 text-white shadow-glow-cyan'
                          : 'bg-space-950/70 border border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Icon className={`w-4 h-4 mb-1 ${isSelected ? pref.color : 'text-slate-500'}`} />
                      <span>{pref.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-space-950 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-glow-cyan disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-space-950 border-t-transparent rounded-full animate-spin" />
                  <span>Filtering, Ranking & Calling Endpoints...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-space-950" />
                  <span>Route Request (Filter → Rank → Try)</span>
                </>
              )}
            </button>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </form>
        </div>

        {/* Right Column: Routing Outcome, Decision Trace & Audio Explanation */}
        <div className="lg:col-span-6 space-y-4">
          {lastResponse ? (
            <div className="rounded-3xl glass-panel p-6 space-y-5 border border-cyan-500/30 shadow-glass">
              {/* Status Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  {lastResponse.success ? (
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                      <CheckCircle className="w-6 h-6 text-emerald-400" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                      <XCircle className="w-6 h-6 text-rose-400" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg text-white">
                        {lastResponse.selected_model_name || 'No Model Selected'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        lastResponse.success
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                      }`}>
                        {lastResponse.status_code}
                      </span>
                      {lastResponse.failover_occurred && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 animate-pulse">
                          Failover Triggered
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {lastResponse.message}
                    </div>
                  </div>
                </div>

                {/* Audio Narrator Play Button */}
                <button
                  type="button"
                  onClick={() => playAudioExplanation(lastResponse.audio_script)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isPlayingAudio
                      ? 'bg-purple-500 text-white shadow-glow-purple animate-pulse'
                      : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40'
                  }`}
                >
                  {isPlayingAudio ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  <span>{isPlayingAudio ? 'Stop Voice' : 'Hear Decision'}</span>
                </button>
              </div>

              {/* Key Metrics Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-xl bg-space-950/70 border border-slate-800/80">
                  <div className="text-[10px] uppercase font-mono text-slate-500">Observed Latency</div>
                  <div className="text-sm font-bold text-cyan-300 font-mono mt-0.5">
                    {lastResponse.total_observed_latency_ms} ms
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-space-950/70 border border-slate-800/80">
                  <div className="text-[10px] uppercase font-mono text-slate-500">Estimated Cost</div>
                  <div className="text-sm font-bold text-emerald-300 font-mono mt-0.5">
                    ${lastResponse.total_estimated_cost.toFixed(6)}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-space-950/70 border border-slate-800/80">
                  <div className="text-[10px] uppercase font-mono text-slate-500">Savings vs Large</div>
                  <div className="text-sm font-bold text-purple-300 font-mono mt-0.5">
                    {lastResponse.cost_savings_percent}%
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-space-950/70 border border-slate-800/80">
                  <div className="text-[10px] uppercase font-mono text-slate-500">Task Complexity</div>
                  <div className="text-sm font-bold text-amber-300 font-mono mt-0.5">
                    Level {lastResponse.effective_min_capability}/5
                  </div>
                </div>
              </div>

              {/* Tabs Switcher */}
              <div className="flex border-b border-slate-800 text-xs">
                {[
                  { id: 'response', label: 'Response Text' },
                  { id: 'evaluations', label: 'Filter Rejections' },
                  { id: 'failover', label: `Attempts (${lastResponse.execution_trace.length})` },
                  { id: 'audio', label: 'Voice Transcript' },
                  { id: 'json', label: 'JSON Trace' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={`py-2 px-3 border-b-2 font-medium transition-all ${
                      activeTab === t.id
                        ? 'border-cyan-400 text-cyan-300'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab Content 1: Response Text */}
              {activeTab === 'response' && (
                <div className="space-y-4">
                  {lastResponse.response_text ? (
                    <div className="p-4 rounded-2xl bg-space-950/80 border border-slate-800 font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {lastResponse.response_text}
                    </div>
                  ) : (
                    <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-2">
                      <AlertOctagon className="w-8 h-8 text-rose-400 mx-auto" />
                      <div className="text-sm font-bold text-rose-300">{lastResponse.message}</div>
                      <div className="text-xs text-slate-400 max-w-md mx-auto">
                        No model was executed to produce an answer because either all were filtered out by your constraints or candidate endpoints failed during call time.
                      </div>
                    </div>
                  )}

                  {/* Complexity rationale highlight */}
                  <div className="p-3.5 rounded-2xl bg-space-900/60 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        AI Complexity Engine ({lastResponse.complexity_analysis.estimator_type})
                      </span>
                      <span className="text-cyan-400 font-mono">
                        Confidence: {Math.round(lastResponse.complexity_analysis.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {lastResponse.complexity_analysis.explanation}
                    </p>
                    {lastResponse.complexity_analysis.rounded_up && (
                      <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span>Conservative Uncertainty Rule: Rounded required capability UP for safety.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab Content 2: Hard Constraint Filter Rejections */}
              {activeTab === 'evaluations' && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-400">
                    Section 4 Step C: Evaluated every candidate model. Shows all rejection reasons.
                  </div>
                  <div className="space-y-2">
                    {lastResponse.all_evaluations.map((ev) => (
                      <div
                        key={ev.model_id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          ev.model_id === lastResponse.selected_model_id
                            ? 'bg-cyan-500/10 border-cyan-500/40 shadow-glow-cyan'
                            : ev.is_valid
                            ? 'bg-space-900/60 border-slate-800'
                            : 'bg-rose-500/5 border-rose-500/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white">{ev.model_name}</span>
                            <span className="text-[10px] font-mono text-slate-400">Cap {ev.capability}</span>
                            <span className="text-[10px] font-mono text-slate-400">{ev.expected_latency_ms}ms</span>
                            <span className="text-[10px] font-mono text-emerald-400">${ev.estimated_cost.toFixed(5)}</span>
                          </div>
                          <div>
                            {ev.model_id === lastResponse.selected_model_id ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                                Selected Winner
                              </span>
                            ) : ev.is_valid ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                                Valid Candidate (Rank #{ev.rank})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                                Rejected ({ev.rejection_reasons.length} violations)
                              </span>
                            )}
                          </div>
                        </div>

                        {ev.ranking_rationale && (
                          <div className="text-[11px] text-cyan-300/80 mt-1.5 font-mono">
                            {ev.ranking_rationale}
                          </div>
                        )}

                        {ev.rejection_reasons.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {ev.rejection_reasons.map((r, i) => (
                              <div key={i} className="text-[11px] text-rose-300/90 font-mono flex items-start gap-1.5">
                                <span className="text-rose-400 font-bold">•</span>
                                <span>{r}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab Content 3: Failover Execution Trace */}
              {activeTab === 'failover' && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-400">
                    Sequential attempts across valid ranked models. Safe failover without relaxing constraints.
                  </div>
                  {lastResponse.execution_trace.length === 0 ? (
                    <div className="p-4 rounded-xl bg-space-950/70 border border-slate-800 text-xs text-slate-400 text-center">
                      No attempts were executed because no models passed the hard constraint filters.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {lastResponse.execution_trace.map((att) => (
                        <div
                          key={att.attempt_number}
                          className={`p-3 rounded-2xl border text-xs font-mono ${
                            att.success
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold">Attempt #{att.attempt_number}: {att.model_name}</span>
                            <span>{att.observed_latency_ms} ms</span>
                          </div>
                          <div className="mt-1 text-[11px]">
                            {att.success ? (
                              <span className="text-emerald-400">✓ Succeeded within latency limit</span>
                            ) : (
                              <span className="text-rose-400">✗ Failed: {att.error_reason}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content 4: Audio Transcript */}
              {activeTab === 'audio' && (
                <div className="p-4 rounded-2xl bg-space-950/70 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-300 flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-purple-400" />
                      ElevenLabs-Style Natural Speech Script
                    </span>
                    <button
                      type="button"
                      onClick={() => playAudioExplanation(lastResponse.audio_script)}
                      className="text-xs text-cyan-400 hover:underline"
                    >
                      {isPlayingAudio ? 'Stop Playing' : 'Play Aloud'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans italic bg-space-900/60 p-3 rounded-xl border border-slate-800/80">
                    "{lastResponse.audio_script}"
                  </p>
                </div>
              )}

              {/* Tab Content 5: JSON Trace */}
              {activeTab === 'json' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400 font-mono">Full Audit JSON Payload</span>
                    <button
                      type="button"
                      onClick={copyJson}
                      className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                    >
                      {copiedJson ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedJson ? 'Copied' : 'Copy JSON'}</span>
                    </button>
                  </div>
                  <pre className="p-4 rounded-2xl bg-space-950 border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-x-auto max-h-80">
                    {JSON.stringify(lastResponse, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            /* Empty State */
            <div className="rounded-3xl glass-panel p-10 text-center space-y-4 border border-dashed border-slate-800 h-full flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-16 h-16 rounded-2xl bg-space-900 border border-cyan-500/20 flex items-center justify-center">
                <Send className="w-8 h-8 text-cyan-400/60" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-200">Awaiting Query Execution</h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  Configure constraints on the left and submit a request to see the deterministic Filter → Rank → Try pipeline execute in real time.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
