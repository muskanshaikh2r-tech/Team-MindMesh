import React, { useState, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  Bot,
  Play,
  Square,
  ArrowRight,
  Headphones
} from 'lucide-react';
import { RouteResponse } from '../types';
import { routeRequest } from '../services/api';

interface VoicePlaygroundPageProps {
  lastResponse: RouteResponse | null;
  onRoutingCompleted: (res: RouteResponse) => void;
}

export const VoicePlaygroundPage: React.FC<VoicePlaygroundPageProps> = ({
  lastResponse,
  onRoutingCompleted
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Fallback default explanation if no request has run yet
  const audioScript = lastResponse?.audio_script || (
    "Welcome to ModelRouter. Speak or type any query to hear our AI evaluate task complexity, " +
    "filter through hard constraints, and explain model selection in natural voice."
  );

  const toggleListen = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = async () => {
        setIsListening(false);
        // Automatically route the voice query!
        if (transcript.trim()) {
          executeVoiceQuery(transcript.trim());
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

  const executeVoiceQuery = async (queryText: string) => {
    setLoading(true);
    try {
      const res = await routeRequest({
        prompt: queryText,
        preference: 'lowest_cost'
      });
      onRoutingCompleted(res);
      // Auto-speak explanation
      playSpeech(res.audio_script);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const playSpeech = (text: string) => {
    if (!('speechSynthesis' in window)) return;

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    setIsPlaying(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Headphones className="w-6 h-6 text-purple-400" />
            <span>Voice Playground & Speech Synthesizer</span>
          </h1>
          <p className="text-xs text-slate-400">
            Powered by Web Speech & ElevenLabs-style conversational narrator. Speak your query and listen to the decision rationale.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Interactive Voice Agent</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Talk to ModelRouter with Pulsating Mic (Matching Screen 2) */}
        <div className="lg:col-span-6 p-8 rounded-3xl glass-panel space-y-6 flex flex-col items-center justify-center text-center border border-cyan-500/25 shadow-glass">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white">Talk to ModelRouter</h2>
            <p className="text-xs text-slate-400 max-w-sm">
              Speak your question or type below. Our AI will analyze complexity, filter constraints, and respond with voice!
            </p>
          </div>

          {/* Central Pulsating Microphone Sphere */}
          <div className="relative my-4">
            {/* Pulsating rings when listening */}
            {isListening && (
              <>
                <div className="absolute -inset-4 rounded-full bg-cyan-500/20 animate-ping" />
                <div className="absolute -inset-8 rounded-full bg-purple-500/10 animate-pulse" />
              </>
            )}

            <button
              onClick={toggleListen}
              className={`relative z-10 w-28 h-28 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl ${
                isListening
                  ? 'bg-gradient-to-tr from-rose-500 to-purple-600 scale-105 shadow-[0_0_40px_rgba(244,63,94,0.5)]'
                  : 'bg-gradient-to-tr from-cyan-500 via-blue-600 to-purple-600 hover:scale-105 shadow-glow-cyan'
              }`}
            >
              {isListening ? (
                <MicOff className="w-10 h-10 text-white animate-bounce" />
              ) : (
                <Mic className="w-10 h-10 text-space-950 font-bold" />
              )}
            </button>
          </div>

          {/* Status and Waveform indicator */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider font-mono text-cyan-400">
              {isListening ? 'Listening to your microphone...' : 'Tap Mic to Start Speaking'}
            </div>

            {/* Simulated Animated Waveform Bars */}
            <div className="flex items-center justify-center gap-1.5 h-8">
              <span className={`w-1 rounded-full bg-cyan-400 ${isListening ? 'wave-bar-1' : 'h-1.5 opacity-30'}`} />
              <span className={`w-1 rounded-full bg-blue-400 ${isListening ? 'wave-bar-2' : 'h-2 opacity-30'}`} />
              <span className={`w-1 rounded-full bg-purple-400 ${isListening ? 'wave-bar-3' : 'h-3 opacity-30'}`} />
              <span className={`w-1 rounded-full bg-cyan-400 ${isListening ? 'wave-bar-4' : 'h-2 opacity-30'}`} />
              <span className={`w-1 rounded-full bg-purple-400 ${isListening ? 'wave-bar-5' : 'h-1.5 opacity-30'}`} />
              <span className={`w-1 rounded-full bg-blue-400 ${isListening ? 'wave-bar-6' : 'h-2.5 opacity-30'}`} />
            </div>
          </div>

          {/* Voice Input Text Box */}
          <div className="w-full space-y-2 text-left">
            <input
              type="text"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Or type here and press Enter..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && transcript.trim()) {
                  executeVoiceQuery(transcript.trim());
                }
              }}
              className="w-full bg-space-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400"
            />
            {transcript && (
              <button
                onClick={() => executeVoiceQuery(transcript)}
                disabled={loading}
                className="w-full py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-xs font-semibold text-cyan-300 flex items-center justify-center gap-2"
              >
                <span>{loading ? 'Evaluating...' : 'Route This Voice Query'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Voice Explanation Narrator Box (Matching Screen 5) */}
        <div className="lg:col-span-6 p-8 rounded-3xl glass-panel space-y-6 border border-purple-500/25 shadow-glass flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-400" />
                <span>Voice Decision Narrator</span>
              </h2>
              {lastResponse?.selected_model_name && (
                <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold">
                  Target: {lastResponse.selected_model_name}
                </span>
              )}
            </div>

            {/* Glowing Robot Visual Avatar */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-space-950/80 border border-slate-800">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center shadow-glow-purple shrink-0">
                <Bot className="w-9 h-9 text-white" />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-bold text-purple-300">ElevenLabs AI Narrator</div>
                <div className="text-[11px] text-slate-400">
                  Explains complexity assessment, hard constraint passes, and why the model was chosen over alternatives.
                </div>
              </div>
            </div>

            {/* Transcript Card */}
            <div className="p-4 rounded-2xl bg-space-950/90 border border-slate-800/80 text-xs text-slate-200 leading-relaxed font-sans italic space-y-2">
              <div className="text-[10px] font-mono font-semibold uppercase text-slate-500 not-italic">
                Spoken Script Transcript:
              </div>
              <p>"{audioScript}"</p>
            </div>
          </div>

          {/* Audio Controls */}
          <div className="pt-4 border-t border-slate-800 flex items-center gap-3">
            <button
              onClick={() => playSpeech(audioScript)}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                isPlaying
                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-[0_0_20px_rgba(244,63,94,0.4)]'
                  : 'bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-400 hover:to-cyan-400 text-space-950 shadow-glow-cyan'
              }`}
            >
              {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isPlaying ? 'Stop Playback' : 'Play Explanation'}</span>
            </button>

            <button
              onClick={() => playSpeech(audioScript)}
              className="p-3 rounded-xl bg-space-850 hover:bg-space-800 border border-slate-700/60 text-slate-300 transition-all"
              title="Replay from start"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
