
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Copy, Play, Pause, Loader2, Disc, Activity, Flame, 
  Wand2, X, Sparkles, Zap, Headphones, 
  AlignJustify, Edit2, Check, Power, Volume2, Music, Square, BrainCircuit
} from 'lucide-react';
import { generateRapAudio, regenerateRapLines, generateAIDrumPattern } from '../services/gemini';
import { telemetry } from '../services/telemetry';
import { RapStyle, RhymeMatch, FlowCoachAdvice } from '../types';

interface LyricCardProps {
  id?: string;
  title: string;
  content: string;
  variant?: 'Standard_Flow_v1' | 'Complex_Metric_v2';
  style?: RapStyle;
  topic?: string;
  suggestedStyle?: string;
  suggestedBpm?: number;
}

type Tab = 'lyrics' | 'studio' | 'analytics';

const INSTRUMENTS = [
  { id: 'kick', name: 'KICK', color: '#00ffff', glow: '0 0 15px #00ffff' },
  { id: 'snare', name: 'SNARE', color: '#ff00ff', glow: '0 0 15px #ff00ff' },
  { id: 'hihat', name: 'HI-HAT', color: '#39ff14', glow: '0 0 15px #39ff14' },
  { id: 'perc', name: 'PERC', color: '#ffff00', glow: '0 0 15px #ffff00' },
];

class DrumSynth {
  private ctx: AudioContext | null = null;

  async init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  async playKick() {
    const ctx = await this.init();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(); osc.stop(ctx.currentTime + 0.4);
  }

  async playSnare() {
    const ctx = await this.init();
    const noise = ctx.createBufferSource();
    const bufferSize = ctx.sampleRate * 0.1;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass'; filter.frequency.value = 1200;
    const gain = ctx.createGain();
    noise.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    noise.start(); noise.stop(ctx.currentTime + 0.12);
  }

  async playHiHat() {
    const ctx = await this.init();
    const noise = ctx.createBufferSource();
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass'; filter.frequency.value = 8500;
    const gain = ctx.createGain();
    noise.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    noise.start(); noise.stop(ctx.currentTime + 0.05);
  }

  async playPerc() {
    const ctx = await this.init();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle'; osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(700, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.start(); osc.stop(ctx.currentTime + 0.1);
  }
}

const drumSynth = new DrumSynth();

const analyzePhonetics = (text: string) => {
  const lines = text.split('\n').filter(l => l.trim().length > 0 && !l.startsWith('['));
  const rhymeMatches: RhymeMatch[] = [];
  const stemMap: Record<string, string> = {}; 
  const colors = ['#00ffff', '#ff00ff', '#39ff14', '#ffff00', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  let colorIdx = 0;
  const getStem = (word: string) => {
    const clean = word.replace(/[،.؟!;:«»()\[\]]/g, '').trim();
    if (clean.length < 2) return null;
    return clean.slice(-2);
  };
  lines.forEach((line, lIdx) => {
    const words = line.trim().split(/\s+/);
    words.forEach((word, wIdx) => {
      const stem = getStem(word);
      if (!stem) return;
      let matched = false;
      lines.forEach((otherLine, olIdx) => {
        const otherWords = otherLine.trim().split(/\s+/);
        otherWords.forEach((otherWord, owIdx) => {
          if (lIdx === olIdx && wIdx === owIdx) return;
          if (getStem(otherWord) === stem) matched = true;
        });
      });
      if (matched) {
        if (!stemMap[stem]) { stemMap[stem] = colors[colorIdx % colors.length]; colorIdx++; }
        rhymeMatches.push({ word, lineIdx: lIdx, wordIdx: wIdx, color: stemMap[stem], isInternal: false });
      }
    });
  });
  return rhymeMatches;
};

const LyricCardComponent: React.FC<LyricCardProps> = ({ title, content, style, topic, suggestedBpm }) => {
  const [localContent, setLocalContent] = useState(content);
  const [activeTab, setActiveTab] = useState<Tab>('lyrics');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [bpm, setBpm] = useState(suggestedBpm || 90);
  const [showRhymes, setShowRhymes] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  
  const [activeLineEdit, setActiveLineEdit] = useState<number | null>(null);
  const [editInstruction, setEditInstruction] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [manualEditIndex, setManualEditIndex] = useState<number | null>(null);
  const [manualEditText, setManualEditText] = useState('');

  const [sequencerData, setSequencerData] = useState<Record<string, boolean[]>>(
    INSTRUMENTS.reduce((acc, inst) => ({ ...acc, [inst.id]: Array(16).fill(false) }), {})
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [isSequencerPlaying, setIsSequencerPlaying] = useState(false);
  const [isAIArranging, setIsAIArranging] = useState(false);
  const sequencerInterval = useRef<number | null>(null);

  useEffect(() => {
    if (isSequencerPlaying) {
      if (sequencerData.kick[currentStep]) drumSynth.playKick();
      if (sequencerData.snare[currentStep]) drumSynth.playSnare();
      if (sequencerData.hihat[currentStep]) drumSynth.playHiHat();
      if (sequencerData.perc[currentStep]) drumSynth.playPerc();
    }
  }, [currentStep, isSequencerPlaying, sequencerData]);

  useEffect(() => {
    if (isSequencerPlaying) {
      const stepTime = (60 / bpm / 4) * 1000;
      sequencerInterval.current = window.setInterval(() => {
        setCurrentStep((prev) => (prev + 1) % 16);
      }, stepTime);
    } else {
      if (sequencerInterval.current) clearInterval(sequencerInterval.current);
    }
    return () => { if (sequencerInterval.current) clearInterval(sequencerInterval.current); };
  }, [isSequencerPlaying, bpm]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(localContent);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (e) { console.error("Copy error", e); }
  };

  const handleAIDrumArrangement = async () => {
    setIsAIArranging(true);
    try {
      const pattern = await generateAIDrumPattern(localContent, bpm, style || 'Rap');
      setSequencerData(pattern);
      drumSynth.init(); // Warm up context
      telemetry.log('generation_success', { type: 'drum_pattern' });
    } catch (e) { console.error(e); } finally { setIsAIArranging(false); }
  };

  const handleMagicEdit = async (lIdx: number) => {
    if (!editInstruction.trim()) return;
    setIsRegenerating(true);
    try {
      const updatedFullLyrics = await regenerateRapLines(localContent, [lIdx], style || 'Rap', topic || 'Freestyle', editInstruction);
      if (updatedFullLyrics && updatedFullLyrics.length > 20) {
        setLocalContent(updatedFullLyrics);
        setActiveLineEdit(null);
        setEditInstruction('');
      }
    } catch (err) { console.error(err); } finally { setIsRegenerating(false); }
  };

  const rawLines = useMemo(() => localContent.split('\n'), [localContent]);
  const analytics = useMemo(() => {
    const textLines = rawLines.filter(l => l.trim().length > 0 && !l.startsWith('['));
    const syllables = textLines.map(l => l.split(/\s+/).length * 1.5);
    const avg = syllables.length > 0 ? syllables.reduce((a, b) => a + b, 0) / textLines.length : 0;
    return { rhymes: analyzePhonetics(localContent), intensity: Math.min(100, Math.floor((avg * bpm) / 1000 * 5)) };
  }, [localContent, rawLines, bpm]);

  return (
    <div className="w-full bg-rap-card border border-white/5 rounded-3xl shadow-2xl overflow-hidden relative mt-8 font-sans transition-all duration-500">
      <div className="border-b border-white/10 bg-black/40 p-6 backdrop-blur-md">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <button onClick={async () => {
                drumSynth.init();
                if (isPlaying) setIsPlaying(false);
                else {
                  if (!audioBase64) { 
                    setIsLoadingAudio(true); 
                    try { const b64 = await generateRapAudio(localContent); setAudioBase64(b64); setIsPlaying(true); } catch(e) {} 
                    setIsLoadingAudio(false); 
                  } else { setIsPlaying(true); }
                }
              }} className="w-16 h-16 rounded-full bg-rap-accent text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-rap-accent/20">
              {isLoadingAudio ? <Loader2 className="animate-spin" /> : isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" />}
            </button>
            <div className="text-right">
              <h2 className="text-2xl font-black text-white">{title}</h2>
              <div className="flex items-center gap-3 mt-1 justify-end">
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-bold uppercase tracking-widest flex items-center gap-1"><Flame size={10} /> شدت فلو: {analytics.intensity}%</span>
                <span className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded font-bold uppercase tracking-widest">{bpm} BPM</span>
              </div>
            </div>
          </div>
          <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5 overflow-x-auto">
            {[{ id: 'lyrics', icon: AlignJustify, label: 'لیریک' }, { id: 'studio', icon: Disc, label: 'استودیو' }, { id: 'analytics', icon: Activity, label: 'آنالیز' }].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as Tab)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white/10 text-white shadow-inner' : 'text-gray-500 hover:text-gray-300'}`}>
                <tab.icon size={16} /> {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-8 min-h-[400px]">
        {activeTab === 'lyrics' && (
          <div className="space-y-4 animate-fadeIn max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 text-right" dir="rtl">
            <div className="flex justify-between items-center mb-6">
               <div className="flex items-center gap-4">
                  <button onClick={() => setShowRhymes(!showRhymes)} className={`text-[10px] font-bold px-3 py-1.5 rounded-full border transition-all ${showRhymes ? 'bg-rap-accent/10 border-rap-accent text-rap-accent shadow-lg shadow-rap-accent/10' : 'border-white/10 text-gray-500'}`}>نمایش قافیه</button>
                  <button onClick={handleCopy} className={`text-[10px] font-bold px-4 py-2 rounded-full border transition-all flex items-center gap-2 ${isCopied ? 'bg-green-500/10 border-green-500 text-green-500' : 'border-white/10 text-gray-500 hover:text-white'}`}>
                    {isCopied ? <Check size={14} /> : <Copy size={14} />} {isCopied ? 'کپی شد' : 'کپی متن'}
                  </button>
               </div>
            </div>
            {rawLines.map((line, lIdx) => {
              const isSection = line.startsWith('[');
              const textLineIdx = rawLines.slice(0, lIdx).filter(l => l.trim().length > 0 && !l.startsWith('[')).length;
              return (
                <div key={lIdx} className="relative py-2 group/line flex items-start gap-4 border-l-2 border-transparent hover:border-rap-accent/20 transition-all pl-2">
                  {!isSection && (
                    <div className="flex flex-col gap-2 items-center opacity-0 group-hover/line:opacity-100 transition-all duration-300 min-w-[40px]">
                       <button onClick={() => { setActiveLineEdit(activeLineEdit === lIdx ? null : lIdx); setManualEditIndex(null); }} className={`p-2.5 rounded-xl transition-all ${activeLineEdit === lIdx ? 'bg-indigo-600 text-white' : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/30'}`}><Wand2 size={16} /></button>
                       <button onClick={() => { setManualEditIndex(lIdx); setManualEditText(line); setActiveLineEdit(null); }} className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/30 transition-all"><Edit2 size={16} /></button>
                    </div>
                  )}
                  <div className="flex-1">
                    {manualEditIndex === lIdx ? (
                      <div className="flex items-center gap-2 bg-black/60 p-3 rounded-2xl border border-amber-500/40">
                         <input autoFocus className="flex-1 bg-transparent outline-none text-white text-lg" value={manualEditText} onChange={(e) => setManualEditText(e.target.value)} />
                         <button onClick={() => { 
                            const linesArr = [...rawLines]; linesArr[lIdx] = manualEditText; 
                            setLocalContent(linesArr.join('\n')); setManualEditIndex(null); 
                          }} className="p-2 text-green-400"><Check size={20} /></button>
                         <button onClick={() => setManualEditIndex(null)} className="p-2 text-red-400"><X size={20} /></button>
                      </div>
                    ) : (
                      <div className={`transition-all ${isSection ? 'mt-8 mb-3 font-black text-[11px] uppercase tracking-[0.2em] border-b border-white/5 pb-1 text-rap-accent' : 'text-lg text-gray-300 group-hover/line:text-white'}`}>
                        {isSection ? line : line.split(/\s+/).map((word, wIdx) => {
                          const rhyme = analytics.rhymes.find(r => r.lineIdx === textLineIdx && r.word === word);
                          return <span key={wIdx} className="inline-block px-0.5 rounded transition-colors" style={{ backgroundColor: (showRhymes && rhyme) ? `${rhyme.color}25` : 'transparent', color: (showRhymes && rhyme) ? rhyme.color : 'inherit' }}>{word}{' '}</span>
                        })}
                      </div>
                    )}
                    {activeLineEdit === lIdx && (
                      <div className="mt-4 bg-[#0a0a15] border border-indigo-500/30 rounded-2xl p-5 animate-fadeIn shadow-2xl">
                        <div className="flex gap-3">
                          <input autoFocus className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500" placeholder="دستور بازنویسی خط..." value={editInstruction} onChange={(e) => setEditInstruction(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleMagicEdit(lIdx)} />
                          <button disabled={isRegenerating} onClick={() => handleMagicEdit(lIdx)} className="bg-indigo-600 hover:bg-indigo-500 px-5 py-3 rounded-xl font-bold flex items-center gap-2 text-white disabled:opacity-50">
                            {isRegenerating ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} fill="currentColor" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {activeTab === 'studio' && (
          <div className="animate-fadeIn space-y-6 text-right" dir="rtl">
            <div className="bg-[#020205] border-2 border-white/10 rounded-[40px] p-8 shadow-[0_0_100px_rgba(255,0,85,0.1)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 via-magenta-500 to-lime-400 opacity-60" />
              
              <div className="flex flex-col md:flex-row items-center justify-between mb-12 border-b border-white/5 pb-8 gap-6">
                <div className="flex items-center gap-5">
                  <button onClick={() => { drumSynth.init(); setIsSequencerPlaying(!isSequencerPlaying); }} className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isSequencerPlaying ? 'bg-rap-accent text-white shadow-[0_0_30px_#ff0055]' : 'bg-white/5 text-gray-500 border border-white/10'}`}>
                    {isSequencerPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                  </button>
                  <button onClick={() => { setCurrentStep(0); setIsSequencerPlaying(false); }} className="w-16 h-16 rounded-full bg-white/5 border border-white/10 text-gray-500 flex items-center justify-center"><Square size={22} fill="currentColor" /></button>
                </div>
                
                <button 
                   onClick={handleAIDrumArrangement}
                   disabled={isAIArranging}
                   className="bg-indigo-600/10 border border-indigo-500/50 hover:bg-indigo-600/20 text-indigo-400 px-6 py-3 rounded-2xl flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50 group"
                >
                  {isAIArranging ? <Loader2 size={18} className="animate-spin" /> : <BrainCircuit size={18} className="group-hover:rotate-12 transition-transform" />}
                  <span className="text-sm font-black uppercase tracking-tighter">هوشمندی ضرب (AI Auto-Fill)</span>
                </button>

                <div className="flex gap-4">
                  <div className="bg-black border border-cyan-500/30 px-8 py-4 rounded-2xl">
                    <div className="text-[9px] text-cyan-400 font-black uppercase text-center mb-1">TEMPO</div>
                    <div className="text-3xl font-mono font-black text-white text-center">{bpm}</div>
                  </div>
                  <div className="bg-black border border-magenta-500/30 px-8 py-4 rounded-2xl hidden md:block">
                    <div className="text-[9px] text-magenta-400 font-black uppercase text-center mb-1">STEP</div>
                    <div className="text-3xl font-mono font-black text-white text-center">{currentStep + 1}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {INSTRUMENTS.map((inst) => (
                  <div key={inst.id} className="flex items-center gap-6">
                    <div className="w-40 flex flex-col justify-center bg-black/60 p-4 rounded-3xl border border-white/5 shadow-inner">
                       <span className="text-[12px] font-black text-center tracking-widest" style={{ color: inst.color, textShadow: inst.glow }}>{inst.name}</span>
                       <div className="flex justify-center gap-2 mt-2">
                          <div className="w-2 h-2 rounded-full bg-white/5 border border-white/10" />
                          <div className="w-2 h-2 rounded-full bg-white/5 border border-white/10" />
                       </div>
                    </div>

                    <div className="flex-1 grid grid-cols-16 gap-2">
                      {sequencerData[inst.id].map((isActive, sIdx) => {
                        const isPlayhead = currentStep === sIdx;
                        return (
                          <button 
                            key={sIdx}
                            onClick={() => {
                              drumSynth.init();
                              const newData = {...sequencerData};
                              newData[inst.id][sIdx] = !isActive;
                              setSequencerData(newData);
                              if (!isActive) {
                                if (inst.id === 'kick') drumSynth.playKick();
                                if (inst.id === 'snare') drumSynth.playSnare();
                                if (inst.id === 'hihat') drumSynth.playHiHat();
                                if (inst.id === 'perc') drumSynth.playPerc();
                              }
                            }}
                            className={`h-12 rounded-lg relative transition-all border-b-4
                              ${isActive ? 'border-none' : 'bg-white/[0.03] border-black/80'}
                              ${isPlayhead ? 'brightness-150 scale-105 z-10 border-white/40' : 'scale-100'}
                            `}
                            style={{ 
                              backgroundColor: isActive ? inst.color : undefined,
                              boxShadow: isActive ? inst.glow : (isPlayhead ? 'inset 0 0 10px rgba(255,255,255,0.1)' : 'none'),
                              border: isPlayhead && !isActive ? '2px solid rgba(255,255,255,0.2)' : undefined
                            }}
                          >
                            {isActive && <div className="absolute inset-0 bg-white/10 animate-pulse" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-6 mt-10">
                 <div className="w-40" />
                 <div className="flex-1 grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map(bar => (
                      <div key={bar} className="text-[9px] font-black text-gray-700 uppercase tracking-[0.3em] text-center border-t border-white/5 pt-4">BAR 0{bar}</div>
                    ))}
                 </div>
              </div>
            </div>

            <div className="bg-[#020205] p-8 rounded-[40px] border border-white/10 flex flex-col md:flex-row items-center gap-8 shadow-2xl">
               <div className="p-6 bg-cyan-500/10 rounded-full text-cyan-400 border border-cyan-500/20"><Headphones size={32} /></div>
               <div className="flex-1 text-center md:text-right">
                  <h4 className="text-xl font-black text-white">اتوماسیون استودیو</h4>
                  <p className="text-sm text-gray-500 mt-1">هوش مصنوعی بر اساس ریتم لیریک شما، ضربات درام را تنظیم کرده است.</p>
               </div>
               <div className="flex gap-3">
                  <button onClick={() => drumSynth.playKick()} className="px-8 py-4 bg-white/5 rounded-2xl text-[10px] font-black border border-white/10 hover:text-cyan-400 transition-all">CHECK AUDIO</button>
                  <button className="px-8 py-4 bg-gradient-to-r from-magenta-600 to-rap-accent text-white rounded-2xl text-[10px] font-black shadow-lg shadow-magenta-600/20">BAKE AUDIO</button>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="animate-fadeIn space-y-8 text-right" dir="rtl">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-black/20 p-8 rounded-[32px] border border-white/5 group hover:border-rap-accent/30 transition-all">
                   <div className="text-rap-muted text-[10px] font-black uppercase mb-2">تراکم قافیه</div>
                   <div className="text-5xl font-black text-white group-hover:scale-110 transition-transform origin-right">{analytics.rhymes.length}</div>
                </div>
                <div className="bg-black/20 p-8 rounded-[32px] border border-white/5 group hover:border-rap-accent/30 transition-all">
                   <div className="text-rap-muted text-[10px] font-black uppercase mb-2">شدت فلو</div>
                   <div className="text-5xl font-black text-rap-accent group-hover:scale-110 transition-transform origin-right">{analytics.intensity}%</div>
                </div>
                <div className="bg-black/20 p-8 rounded-[32px] border border-white/5 group hover:border-rap-accent/30 transition-all">
                   <div className="text-rap-muted text-[10px] font-black uppercase mb-2">تعداد کلمات</div>
                   <div className="text-5xl font-black text-indigo-400 group-hover:scale-110 transition-transform origin-right">{rawLines.join(' ').split(/\s+/).length}</div>
                </div>
             </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        .grid-cols-16 { grid-template-columns: repeat(16, minmax(0, 1fr)); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export const LyricCard = React.memo(LyricCardComponent);
