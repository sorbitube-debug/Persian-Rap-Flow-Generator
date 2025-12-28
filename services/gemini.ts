
import { GoogleGenAI, GenerateContentResponse, Modality, Type } from "@google/genai";
import { RapStyle, RapLength, RhymeScheme, LyricResponse, RapTone, RhymeComplexity } from "../types";

const TONE_MODULES = {
  [RapTone.Aggressive]: "واژگان تند، بیانی قاطع و حماسی، استفاده از کلمات کوبنده.",
  [RapTone.Philosophical]: "تصویرسازی‌های انتزاعی، تفکر در مورد جامعه و خود، واژگان ادبی و سنگین‌تر.",
  [RapTone.Humorous]: "کنایه، بازی با کلمات خنده‌دار، استفاده از اسلنگ‌های فان و روزمره.",
  [RapTone.Dark]: "فضاسازی سرد، ناامیدی، استفاده از ایهام‌های سیاه و گنگ.",
  [RapTone.Melodic]: "جملات کشیده‌تر، تمرکز روی واکه‌ها (Vowels)، حس آرامش و ریتمیک."
};

const RAP_CORE_SYSTEM_INSTRUCTION = `
شما "RapGen Pro Engine" هستید. یک مدل پیشرفته متخصص در مهندسی لیریک رپ فارسی.
تخصص شما شامل: وزن عروضی مدرن، قافیه‌های چندسیلابی و تکنیک‌های فلو (Flow).
`;

async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return retry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export const generateRapLyrics = async (
  topic: string,
  style: RapStyle,
  tone: RapTone,
  rhymeComplexity: RhymeComplexity,
  subStyle: string,
  length: RapLength,
  keywords: string,
  creativity: number,
  topK: number,
  topP: number,
  rhymeScheme: RhymeScheme,
  useThinking: boolean
): Promise<LyricResponse> => {
  
  return retry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    let prompt = `
        TASK: Generate a Professional Persian Rap Song.
        TOPIC: ${topic}
        STYLE: ${style} (${subStyle})
        TONE: ${tone}
        KEYWORDS: ${keywords}
        
        STRUCTURE: [Verse 1], [Chorus], [Verse 2], [Bridge], [Chorus]
        OUTPUT FORMAT:
        Title: [Title]
        Style: [Style]
        BPM: [Number between 80-140]
        Lyrics:
        [Full Lyrics]
    `;

    const response = await ai.models.generateContent({
      model: useThinking ? "gemini-3-pro-preview" : "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: RAP_CORE_SYSTEM_INSTRUCTION,
        temperature: creativity,
      },
    });

    const fullText = response.text || "";
    const titleMatch = fullText.match(/Title:\s*(.*)/i);
    const bpmMatch = fullText.match(/BPM:\s*(\d+)/i);
    let cleanText = fullText.split(/Lyrics:/i)[1] || fullText;
    cleanText = cleanText.replace(/\*\*/g, '').trim();

    return {
      title: titleMatch ? titleMatch[1].trim() : topic,
      content: cleanText,
      variant: 'Standard_Flow_v1',
      suggestedBpm: bpmMatch ? parseInt(bpmMatch[1]) : 90
    };
  });
};

export const regenerateRapLines = async (
  currentLyrics: string,
  selectedIndices: number[],
  style: string,
  topic: string,
  userInstruction: string = ""
): Promise<string> => {
  return retry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
      CONTEXT: Edit Persian Rap.
      CURRENT SONG:
      ${currentLyrics}
      
      TASK: Rewrite ONLY the line at index ${selectedIndices[0]}.
      INSTRUCTION: "${userInstruction}"
      
      Return the ENTIRE song with the updated line. No numbers, no chat.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { temperature: 0.8 }
    });

    let res = response.text?.trim() || currentLyrics;
    return res.replace(/^\d+:\s*/gm, '').replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
  });
};

export const generateAIDrumPattern = async (lyrics: string, bpm: number, style: string) => {
  return retry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
      Based on these lyrics: "${lyrics.substring(0, 200)}..." 
      Style: ${style}, BPM: ${bpm}.
      Generate a 16-step rhythmic drum sequence for Kick, Snare, Hihat, and Perc.
      The pattern should match the vibe of the lyrics.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            kick: { type: Type.ARRAY, items: { type: Type.BOOLEAN } },
            snare: { type: Type.ARRAY, items: { type: Type.BOOLEAN } },
            hihat: { type: Type.ARRAY, items: { type: Type.BOOLEAN } },
            perc: { type: Type.ARRAY, items: { type: Type.BOOLEAN } },
          },
          required: ["kick", "snare", "hihat", "perc"]
        }
      }
    });

    return JSON.parse(response.text);
  });
};

export const generateRapAudio = async (text: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: "با حس رپ فارسی بخوان: " + text.substring(0, 500) }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
};
