

export enum RapStyle {
  Gangsta = "گنگ و خیابانی",
  Emotional = "احساسی و دپ",
  Social = "اجتماعی و اعتراضی",
  Party = "پارتی و فان",
  Motivational = "انگیزشی",
  OldSchool = "اولد اسکول"
}

export enum RapTone {
  Aggressive = "پرخاشگر (Aggressive)",
  Philosophical = "فلسفی و عمیق (Deep)",
  Humorous = "طنز و کنایه‌آمیز (Sarcastic)",
  Dark = "تاریک و سیاه (Dark)",
  Melodic = "ملودیک و نرم (Soft)"
}

export enum RhymeComplexity {
  Simple = "ساده (Monosyllabic)",
  Medium = "استاندارد",
  Complex = "پیچیده (Multisyllabic)"
}

export enum RapLength {
  Short = "کوتاه",
  Medium = "استاندارد",
  Long = "طولانی"
}

export enum RhymeScheme {
  Freestyle = "آزاد (Freestyle)",
  AABB = "جفت (AABB)",
  ABAB = "یک در میان (ABAB)",
  AAAA = "تک قافیه (AAAA)"
}

export interface RhymeMatch {
  word: string;
  lineIdx: number;
  wordIdx: number;
  color: string;
  isInternal: boolean;
}

export interface FlowCoachAdvice {
  type: 'rhythm' | 'rhyme' | 'delivery';
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface LyricResponse {
  title: string;
  content: string;
  variant: 'Standard_Flow_v1' | 'Complex_Metric_v2';
  suggestedStyle?: string;
  suggestedBpm?: number;
}

// Added missing plugin types to fix import errors in pluginRegistry.ts and PluginMarketplace.tsx
export type PluginCategory = 'beat' | 'flow' | 'effect';

export interface BasePlugin {
  id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  category: PluginCategory;
}

export interface BeatPlugin extends BasePlugin {
  category: 'beat';
}

export interface FlowPlugin extends BasePlugin {
  category: 'flow';
  transformLyrics: (lyrics: string) => string;
}

export interface EffectPlugin extends BasePlugin {
  category: 'effect';
  applyEffect: (ctx: AudioContext, source: AudioNode) => AudioNode;
}

export type Plugin = BeatPlugin | FlowPlugin | EffectPlugin;

// Added missing cloud storage types to fix import errors in cloudStorage.ts
export interface UserComment {
  id: string;
  author: string;
  text: string;
  timestamp: number;
}

export interface Collaborator {
  id: string;
  name: string;
  color: string;
  isOnline: boolean;
}

export interface CloudProject {
  id: string;
  title: string;
  content: string;
  style: RapStyle;
  lastModified: number;
  comments: UserComment[];
}
