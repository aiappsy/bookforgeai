export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  labels?: Record<string, string>;
  preview_url?: string;
}

export function getVoiceGender(v: ElevenLabsVoice): 'male' | 'female' | 'neutral' {
  const g = (v.labels?.gender || '').toLowerCase().trim();
  if (g === 'male' || g === 'm') return 'male';
  if (g === 'female' || g === 'f') return 'female';

  const desc = (v.description || '').toLowerCase();
  const name = (v.name || '').toLowerCase();

  // Test female first because the substring "female" contains "male"
  if (/\bfemale\b/i.test(desc) ||
      /\b(woman|girl|lady|actress|she|her|queen|princess)\b/i.test(desc) ||
      /\b(rachel|lily|bella|domi|elli|charlotte|dorothy|matilda|alice|serena|freya)\b/i.test(name)) {
    return 'female';
  }

  if ((/\bmale\b/i.test(desc) && !/\bfemale\b/i.test(desc)) ||
      /\b(man|boy|guy|actor|he|him|his|king|prince)\b/i.test(desc) ||
      /\b(adam|george|antoni|josh|arnold|clyde|dave|fin|charlie|liam|callum|patrick|harry|james|joseph|bill|daniel)\b/i.test(name)) {
    return 'male';
  }

  return 'neutral';
}

export const DEFAULT_ELEVENLABS_VOICES: ElevenLabsVoice[] = [
  {
    voice_id: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel',
    category: 'premade',
    description: 'Calm, warm, conversational female narrator. Ideal for fiction & memoirs.',
    labels: { gender: 'female', age: 'young adult', accent: 'american', use_case: 'narration' }
  },
  {
    voice_id: 'pNInz6obpgDQGcFmaJgB',
    name: 'Adam',
    category: 'premade',
    description: 'Deep, rich, authoritative male voice. Excellent for non-fiction & epic narration.',
    labels: { gender: 'male', age: 'adult', accent: 'american', use_case: 'narration' }
  },
  {
    voice_id: 'JBFqnCBsd6RMkjVDRZzb',
    name: 'George',
    category: 'premade',
    description: 'Warm, captivating British male narrator with classic storytelling resonance.',
    labels: { gender: 'male', age: 'adult', accent: 'british', use_case: 'narration' }
  },
  {
    voice_id: 'pFZP5JQG7iQjIQuC4Bku',
    name: 'Lily',
    category: 'premade',
    description: 'Warm, velvety female narrator with emotional depth and smooth clarity.',
    labels: { gender: 'female', age: 'adult', accent: 'british', use_case: 'narration' }
  },
  {
    voice_id: 'ErXwobaYiN019PkySvjV',
    name: 'Antoni',
    category: 'premade',
    description: 'Smooth, articulate, confident male. Great for dialogue & podcasts.',
    labels: { gender: 'male', age: 'young adult', accent: 'american', use_case: 'dialogue' }
  },
  {
    voice_id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Bella',
    category: 'premade',
    description: 'Soft, expressive, emotional female voice for character roles.',
    labels: { gender: 'female', age: 'young adult', accent: 'american', use_case: 'dialogue' }
  },
  {
    voice_id: 'AZnzlk1XvdvUeBnXmlld',
    name: 'Domi',
    category: 'premade',
    description: 'Strong, energetic, assertive female voice.',
    labels: { gender: 'female', age: 'adult', accent: 'american', use_case: 'drama' }
  },
  {
    voice_id: 'MF3mGyEYCl7XYWbV9V6O',
    name: 'Elli',
    category: 'premade',
    description: 'Gentle, storybook female voice. Perfect for children & fantasy literature.',
    labels: { gender: 'female', age: 'young adult', accent: 'american', use_case: 'narration' }
  },
  {
    voice_id: 'TxGEqnHWrfWFTfGW9XjX',
    name: 'Josh',
    category: 'premade',
    description: 'Youthful, friendly, natural male voice.',
    labels: { gender: 'male', age: 'young adult', accent: 'american', use_case: 'conversational' }
  },
  {
    voice_id: 'VR6AewLTigWG4xTspXx2',
    name: 'Arnold',
    category: 'premade',
    description: 'Crisp, gravelly, distinguished male voice.',
    labels: { gender: 'male', age: 'elderly', accent: 'american', use_case: 'character' }
  },
  {
    voice_id: 'XB0fDUnXU5powuDhC63c',
    name: 'Charlotte',
    category: 'premade',
    description: 'Sophisticated, elegant British female voice.',
    labels: { gender: 'female', age: 'adult', accent: 'british', use_case: 'classic' }
  },
  {
    voice_id: '2EiwWnXFnvU5JabPnv8n',
    name: 'Clyde',
    category: 'premade',
    description: 'War-worn, husky, intense male character voice.',
    labels: { gender: 'male', age: 'adult', accent: 'american', use_case: 'action' }
  },
  {
    voice_id: 'CYw3kZ02Hs0563khs1Fj',
    name: 'Dave',
    category: 'premade',
    description: 'Relaxed, conversational British male voice.',
    labels: { gender: 'male', age: 'young adult', accent: 'british', use_case: 'narration' }
  },
  {
    voice_id: 'D38z5RcWu1voky8WS1ja',
    name: 'Fin',
    category: 'premade',
    description: 'Charming, lyrical Irish male voice.',
    labels: { gender: 'male', age: 'adult', accent: 'irish', use_case: 'character' }
  },
  {
    voice_id: 'IKne3meq5aSn9XLyUdCD',
    name: 'Charlie',
    category: 'premade',
    description: 'Natural, friendly Australian male with a casual, engaging tone.',
    labels: { gender: 'male', age: 'young adult', accent: 'australian', use_case: 'conversational' }
  },
  {
    voice_id: 'ThT5KcBeYPX3keUQqHPh',
    name: 'Dorothy',
    category: 'premade',
    description: 'Pleasant, vintage, storytelling British female narrator.',
    labels: { gender: 'female', age: 'adult', accent: 'british', use_case: 'narration' }
  },
  {
    voice_id: 'XrExE9yKIg1WjnnlVkGX',
    name: 'Matilda',
    category: 'premade',
    description: 'Warm, reassuring, articulate female voice for rich prose.',
    labels: { gender: 'female', age: 'adult', accent: 'american', use_case: 'narration' }
  },
  {
    voice_id: 'TX3LPaxmHKxFdv7VOQHJ',
    name: 'Liam',
    category: 'premade',
    description: 'Vibrant, energetic young male voice for modern fiction.',
    labels: { gender: 'male', age: 'young adult', accent: 'american', use_case: 'dialogue' }
  },
  {
    voice_id: 'N2lAn3fdC13ceA1A7Jne',
    name: 'Callum',
    category: 'premade',
    description: 'Intense, brooding male character voice with rich resonance.',
    labels: { gender: 'male', age: 'adult', accent: 'transatlantic', use_case: 'character' }
  },
  {
    voice_id: 'ODq5zmih8GrVes37Dizd',
    name: 'Patrick',
    category: 'premade',
    description: 'Clear, authoritative male news/documentary presenter.',
    labels: { gender: 'male', age: 'adult', accent: 'american', use_case: 'narration' }
  },
  {
    voice_id: 'SOY14m4Ab2A07L4L350s',
    name: 'Harry',
    category: 'premade',
    description: 'Expressive, dramatic male voice for suspense & thriller literature.',
    labels: { gender: 'male', age: 'young adult', accent: 'american', use_case: 'drama' }
  },
  {
    voice_id: 'Xb7hH8MSUJpSbBCYk0E2',
    name: 'Alice',
    category: 'premade',
    description: 'Confident, articulate female announcer with pristine diction.',
    labels: { gender: 'female', age: 'adult', accent: 'british', use_case: 'narration' }
  },
  {
    voice_id: 'ZQe5CZR23nHVc38841QD',
    name: 'James',
    category: 'premade',
    description: 'Deep, cinematic male trailer voice for epic audiobooks.',
    labels: { gender: 'male', age: 'adult', accent: 'american', use_case: 'dramatic' }
  },
  {
    voice_id: 'Zlb1dXrM653N07WRdFW3',
    name: 'Joseph',
    category: 'premade',
    description: 'Classic British theatrical male actor with refined cadence.',
    labels: { gender: 'male', age: 'elderly', accent: 'british', use_case: 'classic' }
  },
  {
    voice_id: 'pMsR343MvA1yU0Wch573',
    name: 'Serena',
    category: 'premade',
    description: 'Expressive, theatrical female voice with rich dynamic range.',
    labels: { gender: 'female', age: 'adult', accent: 'american', use_case: 'drama' }
  },
  {
    voice_id: 'pqHfZKP75CvOlQylNhV4',
    name: 'Bill',
    category: 'premade',
    description: 'Trustworthy, mature American male voice for non-fiction & memoirs.',
    labels: { gender: 'male', age: 'adult', accent: 'american', use_case: 'narration' }
  },
  {
    voice_id: 'onwK4e9ZLuTAKqWW03F9',
    name: 'Daniel',
    category: 'premade',
    description: 'Deep, smooth, authoritative British male narrator.',
    labels: { gender: 'male', age: 'adult', accent: 'british', use_case: 'narration' }
  },
  {
    voice_id: 'jsC1Iat957D1D75pY51e',
    name: 'Freya',
    category: 'premade',
    description: 'Fresh, engaging young female voice for young adult fiction.',
    labels: { gender: 'female', age: 'young adult', accent: 'american', use_case: 'narration' }
  }
];

export async function fetchElevenLabsVoices(apiKey?: string): Promise<ElevenLabsVoice[]> {
  if (!apiKey || apiKey.trim() === '') {
    return DEFAULT_ELEVENLABS_VOICES;
  }

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': apiKey.trim(),
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      console.warn("ElevenLabs API call returned non-200 status, falling back to premade voices.");
      return DEFAULT_ELEVENLABS_VOICES;
    }

    const data = await res.json();
    if (data.voices && Array.isArray(data.voices)) {
      const fetched: ElevenLabsVoice[] = data.voices.map((v: any) => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category || 'custom',
        description: v.description || (v.labels ? Object.values(v.labels).join(', ') : 'Custom ElevenLabs Voice'),
        labels: v.labels || {},
        preview_url: v.preview_url
      }));

      // Merge fetched voices with default premade ones so user has full list
      const existingIds = new Set(fetched.map(v => v.voice_id));
      const merged = [...fetched];
      DEFAULT_ELEVENLABS_VOICES.forEach(def => {
        if (!existingIds.has(def.voice_id)) {
          merged.push(def);
        }
      });
      return merged;
    }
    return DEFAULT_ELEVENLABS_VOICES;
  } catch (e) {
    console.warn("Failed to fetch custom ElevenLabs voices:", e);
    return DEFAULT_ELEVENLABS_VOICES;
  }
}

export interface ElevenLabsTTSOptions {
  modelId?: string;
  languageCode?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export function sanitizeTextForTTS(text: string): string {
  if (!text) return '';
  return text
    // Convert SSML break tags into human prosodic punctuation
    .replace(/<break\s+time=["']?(\d+)(ms|s)["']?\s*\/?>/gi, (_, val, unit) => {
      const ms = unit === 's' ? parseInt(val, 10) * 1000 : parseInt(val, 10);
      if (ms > 400) return ' ... ';
      if (ms > 150) return ' -- ';
      return ', ';
    })
    // Strip all other XML/HTML tags (like <phoneme>, <emphasis>) keeping inner text
    .replace(/<[^>]+>/g, '')
    // Normalize whitespace and clean up double punctuation
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?;:])/, '$1')
    .trim();
}

export async function synthesizeElevenLabsTTS(
  text: string,
  voiceId: string,
  apiKey?: string,
  options?: ElevenLabsTTSOptions
): Promise<string | null> {
  if (!apiKey || apiKey.trim() === '') {
    return null; // Signals to caller to use fallback Web Speech API
  }

  const cleanText = sanitizeTextForTTS(text);
  if (!cleanText) return null;

  try {
    const payload: Record<string, any> = {
      text: cleanText,
      model_id: options?.modelId || 'eleven_multilingual_v2',
      voice_settings: {
        stability: options?.stability ?? 0.42, // Golden audiobook standard: 0.42 provides rich human pitch inflection without monotony or distortion
        similarity_boost: options?.similarityBoost ?? 0.80, // High actor timbre fidelity
        style: options?.style ?? 0.20, // Subtle emotional nuance without sounding fake
        use_speaker_boost: options?.useSpeakerBoost ?? true
      }
    };

    if (options?.languageCode && options.languageCode !== 'auto') {
      payload.language_code = options.languageCode;
    }

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey.trim(),
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      let detail = errText;
      try {
        const parsed = JSON.parse(errText);
        detail = parsed.detail?.message || parsed.message || errText;
      } catch {}
      throw new Error(`ElevenLabs API (${res.status}): ${detail}`);
    }

    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch (e: any) {
    console.error("ElevenLabs TTS synthesize error:", e);
    throw e;
  }
}
