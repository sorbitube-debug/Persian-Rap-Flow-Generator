
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Mic2, Sparkles, Zap, Sliders, Hash, Loader2,
  Brain, Dna, Target, ThermometerSun, Coins, Wallet
} from 'lucide-react';
import { generateRapLyrics } from './services/gemini';
import { telemetry } from './services/telemetry';
import { RapStyle, RapLength, LyricResponse, RhymeScheme, RapTone, RhymeComplexity } from './types';
import { LyricCard } from './components/LyricCard';

const STYLE_VARIATIONS: Record<RapStyle, string[]> = {
  [RapStyle.Gangsta]: [
    "دریل (Drill)", 
    "ترپ (Trap)", 
    "گنگستا اولد اسکول", 
    "دارک و خشن (Dark)", 
    "خیابانی خالص (Gritty)", 
    "دیس (Diss)", 
    "بَتِل (Battle Rap)", 
    "هیپ هاپ نسل ۴", 
    "گنگ مدرن",
    "فلو تند (Fast Flow)"
  ],
  [RapStyle.Emotional]: [
    "دیس لاو (Diss Love)", 
    "آر اند بی (R&B)", 
    "دل‌نوشته و غمگین", 
    "عاشقانه (Romantic)", 
    "تنهایی (Loneliness)", 
    "نوستالژیک (Nostalgic)", 
    "امو رپ (Emo Rap)", 
    "ملودیک رپ",
    "آرام و ریتمیک (Chill)"
  ],
  [RapStyle.Social]: [
    "اجتماعی سیاسی", 
    "اعتراضی (Protest)", 
    "داستان‌گویی (Storytelling)", 
    "فلسفی (Philosophical)", 
    "انتقادی", 
    "خودشناسی", 
    "حقایق تلخ", 
    "صدای مردم",
    "آموزنده و عمیق"
  ],
  [RapStyle.Party]: [
    "کلاب و پارتی", 
    "شیش و هشت (6/8)", 
    "فان و طنز", 
    "تکنو رپ (Techno)", 
    "دنس (Dance)", 
    "شاد و ریتمیک", 
    "تیک‌تاکی (Viral)", 
    "تابستونی (Summer Vibes)",
    "هیپ پاپ"
  ],
  [RapStyle.Motivational]: [
    "ورزشی و باشگاه", 
    "مسیر موفقیت", 
    "امیدبخش", 
    "خودباوری", 
    "نبرد تن به تن", 
    "اراده فولادی", 
    "تلاش و کوشش",
    "جنگجو (Warrior Mode)",
    "انرژی بالا"
  ],
  [RapStyle.OldSchool]: [
    "بوم بپ (Boom Bap)", 
    "کلاسیک دهه 80", 
    "جی فانک (G-Funk)", 
    "جز رپ (Jazz Rap)", 
    "فانک (Funk)", 
    "ایست کوست (East Coast)", 
    "وست کوست (West Coast)",
    "رپ کلاسیک فارسی",
    "فلو سنتی"
  ]
};

const CREDIT_COST = 10;

const App: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState<RapStyle>(RapStyle.Gangsta);
  const [tone, setTone] = useState<RapTone>(RapTone.Aggressive);
  const [complexity, setComplexity] = useState<RhymeComplexity>(RhymeComplexity.Medium);
  const [subStyle, setSubStyle] = useState<string>(STYLE_VARIATIONS[RapStyle.Gangsta][0]);
  const [length, setLength] = useState<RapLength>(RapLength.Medium);
  const [rhymeScheme, setRhymeScheme] = useState<RhymeScheme>(RapLength.Medium as any || RhymeScheme.Freestyle);
  const [keywords, setKeywords] = useState('');
  const [useThinking, setUseThinking] = useState(false);
  
  const [creativity, setCreativity] = useState(0.8);
  const [topK, setTopK] = useState(40);
  const [topP, setTopP] = useState(0.95);
  
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<LyricResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeInputTab, setActiveInputTab] = useState<'style' | 'keywords' | 'advanced'>('style');

  // Credit System State
  const [credits, setCredits] = useState<number>(() => {
    const saved = localStorage.getItem('rapgen_credits');
    return saved !== null ? parseInt(saved) : 100;
  });

  useEffect(() => {
    localStorage.setItem('rapgen_credits', credits.toString());
  }, [credits]);

  useEffect(() => {
    setSubStyle(STYLE_VARIATIONS[style][0]);
  }, [style]);

  const currentVariant = useMemo(() => telemetry.getVariant(), []);

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) {
      setError('لطفا ابتدا یک موضوع وارد کنید!');
      return;
    }

    if (credits < CREDIT_COST) {
      setError(`اعتبار کافی ندارید! برای تولید به ${CREDIT_COST} اعتبار نیاز است.`);
      telemetry.log('error_boundary', { reason: 'insufficient_credits', current: credits });
      return;
    }

    telemetry.log('generation_start', { topic, style, variant: currentVariant });
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await generateRapLyrics(topic, style, tone, complexity, subStyle, length, keywords, creativity, topK, topP, rhymeScheme as any, useThinking);
      setResult(data);
      setCredits(prev => prev - CREDIT_COST);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطایی در برقراری ارتباط با هوش مصنوعی رخ داد.');
    } finally {
      setIsLoading(false);
    }
  }, [topic, style, tone, complexity, subStyle, length, keywords, creativity, topK, topP, rhymeScheme, useThinking, currentVariant, credits]);

  return (
    <div className="min-h-screen bg-rap-dark text-white pb-20 selection:bg-rap-accent font-sans">
      <nav className="w-full border-b border-white/5 bg-rap-dark/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-rap-accent to-purple-600 p-2 rounded-lg"><Mic2 size={24} className="text-white" /></div>
            <span className="font-black text-xl tracking-tighter">RAP<span className="text-rap-accent">GEN</span>.AI</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-2xl shadow-inner group transition-all hover:border-rap-accent/50">
                <div className="bg-rap-accent/20 p-1.5 rounded-lg group-hover:bg-rap-accent/30 transition-colors">
                  <Coins size={16} className="text-rap-accent animate-pulse" />
                </div>
                <div className="flex flex-col items-start leading-none">
                  <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">اعتبار شما</span>
                  <span className="text-sm font-black text-white">{credits} <span className="text-[10px] text-rap-accent">Unit</span></span>
                </div>
            </div>
            <div className="hidden md:block text-[10px] font-black text-gray-500 uppercase tracking-widest border border-white/10 px-3 py-1.5 rounded-full bg-black/20">
              AI Studio Edition
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 pt-12">
        <div className="text-center mb-12 animate-fadeIn">
          <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tight leading-[1.1]">
            تکنیک و <span className="text-transparent bg-clip-text bg-gradient-to-r from-rap-accent to-purple-500">فلو</span> در دستان تو
          </h1>
          <p className="text-rap-muted text-lg max-w-xl mx-auto font-medium">موتور هوشمند تولید لیریک رپ با رعایت استانداردهای فنی مارکت رپ فارسی.</p>
        </div>

        <div className="bg-rap-card border border-white/5 rounded-3xl shadow-2xl mb-10 overflow-hidden animate-fadeIn">
          <div className="flex border-b border-white/5 bg-black/20">
              {[
                  { id: 'style', icon: Sparkles, label: 'موضوع و سبک' },
                  { id: 'keywords', icon: Hash, label: 'کلمات و فنی' },
                  { id: 'advanced', icon: Sliders, label: 'تنظیمات پیشرفته' }
              ].map((tab) => (
                <button key={tab.id} onClick={() => setActiveInputTab(tab.id as any)} className={`flex-1 py-5 text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeInputTab === tab.id ? 'bg-white/5 text-rap-accent border-b-2 border-rap-accent' : 'text-gray-500 hover:text-gray-300'}`}>
                    <tab.icon size={18} />
                    <span>{tab.label}</span>
                </button>
              ))}
          </div>

          <div className="p-8">
            <div className="space-y-8">
                {activeInputTab === 'style' && (
                  <div className="space-y-8 animate-fadeIn">
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-400"><Sparkles size={16} className="text-rap-accent" /> موضوع آهنگ</label>
                      <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="مثلا: تهران 1403، رفاقت، نبرد تا پیروزی..." className="w-full bg-rap-dark border border-white/10 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-rap-accent outline-none text-xl placeholder-gray-700 text-right" dir="rtl" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {Object.values(RapStyle).map((s) => (
                          <button key={s} onClick={() => setStyle(s)} className={`p-4 rounded-2xl border text-sm font-bold transition-all ${style === s ? 'bg-rap-accent text-white border-rap-accent shadow-lg shadow-rap-accent/30' : 'bg-rap-dark border-white/5 text-gray-500 hover:border-white/20'}`}>{s}</button>
                        ))}
                    </div>
                    <div className="space-y-3">
                       <label className="flex items-center gap-2 text-sm font-bold text-gray-400">زیرشاخه (Sub-Style)</label>
                       <div className="flex flex-wrap gap-2">
                         {STYLE_VARIATIONS[style].map(sub => (
                           <button key={sub} onClick={() => setSubStyle(sub)} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${subStyle === sub ? 'bg-white text-black border-white' : 'border-white/10 text-gray-500 hover:text-gray-300'}`}>{sub}</button>
                         ))}
                       </div>
                    </div>
                  </div>
                )}
                
                {activeInputTab === 'keywords' && (
                  <div className="space-y-8 animate-fadeIn text-right" dir="rtl">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                           <label className="flex items-center gap-2 text-sm font-bold text-gray-400"><Target size={16} /> کلمات کلیدی پیشنهادی</label>
                           <textarea value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="کلماتی که حتما باید در متن باشند را با کاما جدا کنید..." className="w-full bg-rap-dark border border-white/10 rounded-2xl px-5 py-4 min-h-[100px] outline-none text-sm placeholder-gray-700" />
                        </div>
                        <div className="space-y-6">
                           <div className="space-y-3">
                              <label className="text-sm font-bold text-gray-400">لحن اجرا (Tone)</label>
                              <select value={tone} onChange={(e) => setTone(e.target.value as RapTone)} className="w-full bg-rap-dark border border-white/10 rounded-xl px-4 py-3 text-sm outline-none">
                                 {Object.values(RapTone).map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                           </div>
                           <div className="space-y-3">
                              <label className="text-sm font-bold text-gray-400">پیچیدگی قافیه</label>
                              <div className="flex gap-2">
                                 {Object.values(RhymeComplexity).map(c => (
                                   <button key={c} onClick={() => setComplexity(c)} className={`flex-1 py-3 rounded-xl text-[10px] font-bold border transition-all ${complexity === c ? 'bg-white text-black border-white' : 'border-white/5 text-gray-500'}`}>{c}</button>
                                 ))}
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
                )}

                {activeInputTab === 'advanced' && (
                   <div className="space-y-8 animate-fadeIn text-right" dir="rtl">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                         <div className="space-y-6">
                            <div className="space-y-4">
                               <div className="flex justify-between items-center">
                                  <label className="text-sm font-bold text-gray-400 flex items-center gap-2"><ThermometerSun size={14} /> خلاقیت (Creativity)</label>
                                  <span className="text-rap-accent font-black">{creativity}</span>
                               </div>
                               <input type="range" min="0" max="2" step="0.1" value={creativity} onChange={(e) => setCreativity(parseFloat(e.target.value))} className="w-full accent-rap-accent" />
                            </div>
                            <div className="space-y-4">
                               <div className="flex justify-between items-center">
                                  <label className="text-sm font-bold text-gray-400 flex items-center gap-2"><Dna size={14} /> غلظت واژگان (Top-P)</label>
                                  <span className="text-indigo-400 font-black">{topP}</span>
                               </div>
                               <input type="range" min="0" max="1" step="0.01" value={topP} onChange={(e) => setTopP(parseFloat(e.target.value))} className="w-full accent-indigo-400" />
                            </div>
                         </div>
                         <div className="bg-black/20 p-6 rounded-3xl border border-white/5 space-y-6">
                            <div className="flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${useThinking ? 'bg-rap-accent/10 text-rap-accent' : 'bg-white/5 text-gray-600'}`}>
                                     <Brain size={20} />
                                  </div>
                                  <div>
                                     <div className="text-sm font-black">حالت تفکر عمیق (Thinking)</div>
                                     <div className="text-[10px] text-gray-500">استفاده از مدل Pro برای وزن دقیق‌تر</div>
                                  </div>
                               </div>
                               <button onClick={() => setUseThinking(!useThinking)} className={`w-12 h-6 rounded-full transition-all relative ${useThinking ? 'bg-rap-accent' : 'bg-gray-800'}`}>
                                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${useThinking ? 'left-7' : 'left-1'}`} />
                                </button>
                            </div>
                            <div className="space-y-3">
                               <label className="text-sm font-bold text-gray-400">ساختار قافیه (Scheme)</label>
                               <div className="grid grid-cols-2 gap-2">
                                  {Object.values(RhymeScheme).map(s => (
                                    <button key={s} onClick={() => setRhymeScheme(s as any)} className={`py-2 rounded-lg text-[10px] font-bold border ${rhymeScheme === s ? 'border-rap-accent text-rap-accent bg-rap-accent/5' : 'border-white/5 text-gray-600'}`}>{s}</button>
                                  ))}
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>
                )}
            </div>

            {error && (
               <div className="mt-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-sm flex items-center gap-3 animate-fadeIn shadow-lg" dir="rtl">
                  <Zap size={18} className="shrink-0" /> {error}
               </div>
            )}

            <div className="mt-10 relative">
              <button 
                onClick={handleGenerate} 
                disabled={isLoading || credits < CREDIT_COST} 
                className={`w-full py-5 rounded-2xl font-black text-xl flex flex-col items-center justify-center gap-1 transition-all ${isLoading ? 'bg-gray-800 cursor-wait' : credits < CREDIT_COST ? 'bg-gray-800 text-gray-600 cursor-not-allowed grayscale' : 'bg-gradient-to-r from-rap-accent to-purple-600 hover:scale-[1.01] active:scale-95 shadow-2xl shadow-rap-accent/20'}`}
              >
                <div className="flex items-center gap-3">
                  {isLoading ? <Loader2 className="animate-spin" /> : <Zap fill="currentColor" />} 
                  <span>{isLoading ? 'در حال آهنگ‌سازی...' : 'متن آهنگ رو بساز'}</span>
                </div>
                {!isLoading && (
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest opacity-80">
                    <Coins size={10} /> کسر {CREDIT_COST} واحد اعتبار
                  </div>
                )}
              </button>
              
              {credits < CREDIT_COST && !isLoading && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] font-bold px-4 py-1.5 rounded-full shadow-xl animate-bounce">
                  اعتبار شما تمام شده است!
                </div>
              )}
            </div>
          </div>
        </div>
        {result && <LyricCard title={result.title} content={result.content} style={style} topic={topic} suggestedBpm={result.suggestedBpm} />}
      </main>
      
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default App;
