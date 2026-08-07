import React, { useState, useEffect, useRef } from 'react';
import {
  Headphones,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Download,
  Clock,
  Volume2,
  FileText,
  UserCheck,
  BookOpen,
  Sliders,
  Play,
  Pause,
  Square,
  SkipForward,
  SkipBack,
  Radio,
  Zap,
  Key,
  RefreshCw,
  Eye,
  EyeOff,
  RotateCcw,
  Plus,
  Trash2,
  Layers,
  Music,
  HelpCircle,
  Activity,
  SlidersHorizontal,
  Search,
  X,
  Mic,
  Filter,
  CheckCircle2
} from 'lucide-react';
import {
  AudiobookConversionJSON,
  convertManuscriptToAudiobookScriptJSON,
  rewriteManuscriptForAudio,
  CharacterRosterItem,
  AudiobookScriptSegment,
  PronunciationLexiconItem,
  BackgroundSoundscapeItem
} from '../services/geminiService';
import {
  fetchElevenLabsVoices,
  synthesizeElevenLabsTTS,
  DEFAULT_ELEVENLABS_VOICES,
  ElevenLabsVoice,
  getVoiceGender,
  sanitizeTextForTTS
} from '../services/elevenlabsService';

interface AudiobookStudioProps {
  bookDetails: any;
  chapters: { id: string; title: string; content: string }[];
  activeChapterId?: string | null;
  onSelectChapter?: (chapterId: string) => void;
  onUpdateChapterContent?: (chapterId: string, newContent: string) => void;
  customApiKey?: string;
}

const DEFAULT_ELEVENLABS_KEY = 'sk_716bc2b43a089a12f75c4a3be97c723e0aad0cbcd33cd90a';

const AudioWaveformEqualizer: React.FC<{ isPlaying: boolean; color?: string }> = ({ isPlaying, color = "bg-indigo-600" }) => {
  if (!isPlaying) return null;
  return (
    <div className="inline-flex items-end gap-0.5 h-3.5 px-1.5 py-0.5 bg-indigo-100/80 rounded-full border border-indigo-200 shrink-0 shadow-2xs">
      <div className={`w-0.5 ${color} rounded-full animate-bounce h-full`} />
      <div className={`w-0.5 ${color} rounded-full animate-bounce [animation-delay:0.15s] h-2/3`} />
      <div className={`w-0.5 ${color} rounded-full animate-bounce [animation-delay:0.3s] h-4/5`} />
      <div className={`w-0.5 ${color} rounded-full animate-bounce [animation-delay:0.45s] h-1/2`} />
    </div>
  );
};

export const AudiobookStudio: React.FC<AudiobookStudioProps> = ({
  bookDetails,
  chapters,
  activeChapterId,
  onSelectChapter,
  onUpdateChapterContent,
  customApiKey
}) => {
  // Sync selected chapter with global state
  const [selectedChapterId, setSelectedChapterId] = useState<string>(
    activeChapterId && chapters.some(c => c.id === activeChapterId)
      ? activeChapterId
      : (chapters[0]?.id || '')
  );

  useEffect(() => {
    if (activeChapterId && chapters.some(c => c.id === activeChapterId)) {
      setSelectedChapterId(activeChapterId);
    }
  }, [activeChapterId, chapters]);

  const activeChapter = chapters.find(c => c.id === selectedChapterId) || chapters[0];

  // Studio State
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState<string>(() => {
    return localStorage.getItem('elevenlabs_api_key') || DEFAULT_ELEVENLABS_KEY;
  });
  const [showKeyText, setShowKeyText] = useState<boolean>(false);
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>(DEFAULT_ELEVENLABS_VOICES);
  const [isLoadingVoices, setIsLoadingVoices] = useState<boolean>(false);

  // Audio Engine & Fine-Tuning Settings
  const [speechEnginePreference, setSpeechEnginePreference] = useState<'elevenlabs' | 'browser'>('elevenlabs');
  const [ttsLanguage, setTtsLanguage] = useState<string>('en-US');
  const [elevenLabsModel, setElevenLabsModel] = useState<string>('eleven_multilingual_v2');
  const [stability, setStability] = useState<number>(0.5);
  const [similarityBoost, setSimilarityBoost] = useState<number>(0.75);
  const [style, setStyle] = useState<number>(0.3);
  const [useSpeakerBoost, setUseSpeakerBoost] = useState<boolean>(true);

  const [selectedBrowserVoiceURI, setSelectedBrowserVoiceURI] = useState<string>('');
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ttsNotice, setTtsNotice] = useState<{ type: 'error' | 'info' | 'success'; message: string } | null>(null);

  // Voice Casting Studio & Gallery Modal
  const [selectedCharacterForCasting, setSelectedCharacterForCasting] = useState<CharacterRosterItem | null>(null);
  const [voiceGenderFilter, setVoiceGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [voiceAccentFilter, setVoiceAccentFilter] = useState<string>('all');
  const [voiceSearchQuery, setVoiceSearchQuery] = useState<string>('');
  const [customVoiceInput, setCustomVoiceInput] = useState<string>('');
  const [customAuditionText, setCustomAuditionText] = useState<string>('');

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [conversionData, setConversionData] = useState<AudiobookConversionJSON | null>(null);

  const [studioSubTab, setStudioSubTab] = useState<'script' | 'roster' | 'lexicon' | 'soundscapes' | 'settings' | 'export'>('script');

  // Load Browser Speech Synthesis Voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setBrowserVoices(voices);
      };
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, []);

  // Audio Playback & Master Full Chapter Narration State
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);
  const [audioObject, setAudioObject] = useState<HTMLAudioElement | null>(null);
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);

  // Master Full Chapter Continuous Narration State & Pause Pacing
  const [isMasterPlaying, setIsMasterPlaying] = useState<boolean>(false);
  const [masterSegmentIndex, setMasterSegmentIndex] = useState<number>(0);
  const [pausePacingMode, setPausePacingMode] = useState<'seamless' | 'natural' | 'dramatic'>('seamless');
  const [paAnnouncerChimeEnabled, setPaAnnouncerChimeEnabled] = useState<boolean>(true);

  // Web Audio Context for Airport Tannoy Chimes
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = () => {
    if (!audioContextRef.current && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioContextRef.current = new AudioCtx();
      }
    }
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  // Play Signature 2-Tone Airport PA System Chime (Bing-Bong)
  const playAirportTannoyChime = (): Promise<void> => {
    return new Promise((resolve) => {
      try {
        const ctx = getAudioContext();
        if (!ctx) {
          resolve();
          return;
        }
        const now = ctx.currentTime;
        // High tone (880 Hz - A5)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, now);
        gain1.gain.setValueAtTime(0.25, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.38);

        // Lower tone (659.25 Hz - E5)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(659.25, now + 0.22);
        gain2.gain.setValueAtTime(0.3, now + 0.22);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.22);
        osc2.stop(now + 0.78);

        setTimeout(() => {
          resolve();
        }, 750);
      } catch (e) {
        console.warn("Airport Tannoy chime playback error:", e);
        resolve();
      }
    });
  };

  const isAirportAnnouncerSpeaker = (speakerId: string, speakerName: string, emotion?: string) => {
    const s = `${speakerId} ${speakerName} ${emotion || ''}`.toLowerCase();
    return (
      s.includes('announcer') ||
      s.includes('airport') ||
      s.includes('pa_system') ||
      s.includes('pa system') ||
      s.includes('tannoy') ||
      s.includes('intercom') ||
      s.includes('flight') ||
      s.includes('public address') ||
      s.includes('megaphone')
    );
  };

  // Manuscript Audio Adaptation (Rewrite for Spoken Audio) State
  const [isAdaptingForAudio, setIsAdaptingForAudio] = useState<boolean>(false);
  const [audioRewriteResult, setAudioRewriteResult] = useState<{ adapted_content: string; summary_of_changes: string[] } | null>(null);
  const [showRewriteModal, setShowRewriteModal] = useState<boolean>(false);
  const [activeRewriteTab, setActiveRewriteTab] = useState<'comparison' | 'summary'>('comparison');

  const isMasterPlayingRef = useRef<boolean>(false);
  const masterSegmentIndexRef = useRef<number>(0);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const pausePacingModeRef = useRef<'seamless' | 'natural' | 'dramatic'>('seamless');
  pausePacingModeRef.current = pausePacingMode;

  // Audio Pre-Buffering Cache & State
  const audioCacheRef = useRef<Record<number, string>>({});

  const stopMasterPlayback = () => {
    isMasterPlayingRef.current = false;
    setIsMasterPlaying(false);
    audioCacheRef.current = {};
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    if (audioObject) {
      audioObject.pause();
      setAudioObject(null);
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingSegmentId(null);
  };

  // Pre-fetch and synthesize next audio segment in background for zero-lag playback
  const prebufferNextSegment = async (nextIndex: number, scriptData: AudiobookConversionJSON) => {
    if (nextIndex >= scriptData.audiobook_script.length) return;
    if (audioCacheRef.current[nextIndex]) return;

    const seg = scriptData.audiobook_script[nextIndex];
    if (!seg) return;

    const targetSpeakerId = (seg.speaker_id || '').toLowerCase().trim();
    const targetSpeakerName = (seg.speaker_name || '').toLowerCase().trim();

    const charMeta = scriptData.character_roster.find(c => {
      const cId = (c.character_id || '').toLowerCase().trim();
      const cName = (c.name || '').toLowerCase().trim();
      return (
        cId === targetSpeakerId ||
        cName === targetSpeakerId ||
        cId === targetSpeakerName ||
        cName === targetSpeakerName ||
        (cId && targetSpeakerId.includes(cId)) ||
        (cName && targetSpeakerId.includes(cName))
      );
    });

    const charIndex = scriptData.character_roster.findIndex(c => c.character_id === charMeta?.character_id) ?? 0;
    const voicesList = elevenLabsVoices.length > 0 ? elevenLabsVoices : DEFAULT_ELEVENLABS_VOICES;
    const fallbackIdx = Math.max(0, charIndex) % voicesList.length;
    const assignedVoiceId = charMeta?.assigned_voice_id || voicesList[fallbackIdx]?.voice_id || DEFAULT_ELEVENLABS_VOICES[0].voice_id;

    if (speechEnginePreference === 'elevenlabs' && elevenLabsApiKey && elevenLabsApiKey.trim()) {
      try {
        const url = await synthesizeElevenLabsTTS(
          seg.clean_spoken_text || seg.raw_text,
          assignedVoiceId,
          elevenLabsApiKey,
          {
            modelId: elevenLabsModel,
            languageCode: ttsLanguage.split('-')[0],
            stability: stability ?? 0.42,
            similarityBoost: similarityBoost ?? 0.80,
            style: style ?? 0.20,
            useSpeakerBoost
          }
        );
        if (url) {
          audioCacheRef.current[nextIndex] = url;
        }
      } catch (e) {
        console.warn("Background audio prebuffer error for index", nextIndex, e);
      }
    }
  };

  useEffect(() => {
    return () => {
      stopMasterPlayback();
    };
  }, []);

  useEffect(() => {
    stopMasterPlayback();
    setConversionData(null);
    setMasterSegmentIndex(0);
  }, [selectedChapterId]);

  // Handle Manuscript Adaptation for Spoken Audio
  const handleAdaptManuscriptForAudio = async () => {
    if (!activeChapter || !activeChapter.content || !activeChapter.content.trim()) {
      alert("Please select or write a chapter first!");
      return;
    }
    setIsAdaptingForAudio(true);
    setTtsNotice(null);
    try {
      const res = await rewriteManuscriptForAudio(
        bookDetails,
        activeChapter.title,
        activeChapter.content,
        customApiKey
      );
      setAudioRewriteResult(res);
      setShowRewriteModal(true);
    } catch (e: any) {
      alert("Could not adapt manuscript for audio: " + (e.message || "Unknown error"));
    } finally {
      setIsAdaptingForAudio(false);
    }
  };

  const handleApplyAdaptedText = () => {
    if (!audioRewriteResult || !audioRewriteResult.adapted_content) return;
    if (onUpdateChapterContent) {
      onUpdateChapterContent(selectedChapterId, audioRewriteResult.adapted_content);
    }
    setShowRewriteModal(false);
    setTtsNotice({
      type: 'success',
      message: '✨ Chapter text successfully updated with Audiobook Spoken Edition! Generating voice script now...'
    });
    setConversionData(null);
    setTimeout(() => {
      handleStartOrPauseMasterPlaybackWithText(audioRewriteResult.adapted_content);
    }, 200);
  };

  // Play full chapter segment continuously
  const playMasterSegmentAtIndex = async (index: number, currentData?: AudiobookConversionJSON) => {
    const data = currentData || conversionData;
    if (!data || !data.audiobook_script || data.audiobook_script.length === 0) {
      stopMasterPlayback();
      return;
    }

    if (index >= data.audiobook_script.length) {
      // Completed full chapter continuous narration!
      stopMasterPlayback();
      setMasterSegmentIndex(0);
      masterSegmentIndexRef.current = 0;
      setTtsNotice({
        type: 'success',
        message: '🎉 Full Chapter Audio Narration Complete!'
      });
      return;
    }

    if (!isMasterPlayingRef.current) return;

    setMasterSegmentIndex(index);
    masterSegmentIndexRef.current = index;

    const seg = data.audiobook_script[index];
    setPlayingSegmentId(seg.segment_id);

    // Speaker Voice Lookup
    const targetSpeakerId = (seg.speaker_id || '').toLowerCase().trim();
    const targetSpeakerName = (seg.speaker_name || '').toLowerCase().trim();

    const charMeta = data.character_roster.find(c => {
      const cId = (c.character_id || '').toLowerCase().trim();
      const cName = (c.name || '').toLowerCase().trim();
      return (
        cId === targetSpeakerId ||
        cName === targetSpeakerId ||
        cId === targetSpeakerName ||
        cName === targetSpeakerName ||
        (cId && targetSpeakerId.includes(cId)) ||
        (cName && targetSpeakerId.includes(cName)) ||
        (targetSpeakerName && cName.includes(targetSpeakerName))
      );
    });

    const charIndex = data.character_roster.findIndex(c => c.character_id === charMeta?.character_id) ?? 0;
    const voicesList = elevenLabsVoices.length > 0 ? elevenLabsVoices : DEFAULT_ELEVENLABS_VOICES;
    const fallbackIdx = Math.max(0, charIndex) % voicesList.length;
    const assignedVoiceId = charMeta?.assigned_voice_id || voicesList[fallbackIdx]?.voice_id || DEFAULT_ELEVENLABS_VOICES[0].voice_id;

    const tryEleven = speechEnginePreference === 'elevenlabs' && elevenLabsApiKey && elevenLabsApiKey.trim();

    // Check if current speaker is an Airport Announcer / PA System / Intercom role
    const isAnnouncerRole = isAirportAnnouncerSpeaker(seg.speaker_id, seg.speaker_name, seg.delivery_emotion);
    if (paAnnouncerChimeEnabled && isAnnouncerRole && isMasterPlayingRef.current) {
      await playAirportTannoyChime();
    }

    const handleNextWithPause = () => {
      if (!isMasterPlayingRef.current) return;
      const mode = pausePacingModeRef.current;
      let pauseMs = 0;
      if (mode === 'natural') {
        pauseMs = 50;
      } else if (mode === 'dramatic') {
        pauseMs = 150;
      } else {
        // 'seamless'
        pauseMs = 0;
      }

      if (pauseMs <= 0) {
        if (isMasterPlayingRef.current) {
          playMasterSegmentAtIndex(index + 1, data);
        }
      } else {
        setTimeout(() => {
          if (isMasterPlayingRef.current) {
            playMasterSegmentAtIndex(index + 1, data);
          }
        }, pauseMs);
      }
    };

    if (tryEleven) {
      try {
        let audioUrl = audioCacheRef.current[index];
        if (!audioUrl) {
          audioUrl = await synthesizeElevenLabsTTS(
            seg.clean_spoken_text || seg.raw_text,
            assignedVoiceId,
            elevenLabsApiKey,
            {
              modelId: elevenLabsModel,
              languageCode: ttsLanguage.split('-')[0],
              stability: stability ?? 0.42,
              similarityBoost: similarityBoost ?? 0.80,
              style: style ?? 0.20,
              useSpeakerBoost
            }
          );
          if (audioUrl) {
            audioCacheRef.current[index] = audioUrl;
          }
        }

        if (audioUrl && isMasterPlayingRef.current) {
          const newAudio = new Audio(audioUrl);
          activeAudioRef.current = newAudio;
          setAudioObject(newAudio);

          newAudio.play();

          // Immediately pre-buffer next segment in background for continuous playback
          if (isMasterPlayingRef.current && index + 1 < data.audiobook_script.length) {
            prebufferNextSegment(index + 1, data);
          }

          newAudio.onended = () => {
            activeAudioRef.current = null;
            handleNextWithPause();
          };
          newAudio.onerror = () => {
            activeAudioRef.current = null;
            handleNextWithPause();
          };
          return;
        }
      } catch (err: any) {
        console.warn("ElevenLabs full chapter segment error, using web speech fallback:", err);
      }
    }

    // Fallback: Web Speech API
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && isMasterPlayingRef.current) {
      window.speechSynthesis.cancel();
      const cleanText = sanitizeTextForTTS(seg.clean_spoken_text || seg.raw_text);
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = (seg.speaking_rate || 1.0) * 0.92;
      utterance.lang = ttsLanguage || 'en-US';

      const pitchOffset = (Math.max(0, charIndex) % 3) * 0.12;
      if (charMeta?.gender === 'female') {
        utterance.pitch = 1.15 + pitchOffset;
        utterance.rate = (seg.speaking_rate || 1.0) * 1.02;
      } else if (charMeta?.gender === 'male') {
        utterance.pitch = Math.max(0.65, 0.85 - pitchOffset);
        utterance.rate = (seg.speaking_rate || 1.0) * 0.95;
      } else {
        utterance.pitch = 1.0 + pitchOffset;
      }

      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const targetLangCode = (ttsLanguage || 'en-US').toLowerCase();
        const targetShort = targetLangCode.split('-')[0];
        const langVoices = voices.filter(v =>
          v.lang.toLowerCase() === targetLangCode ||
          v.lang.toLowerCase().startsWith(targetShort) ||
          v.lang.toLowerCase().startsWith('en')
        );
        const pool = langVoices.length > 0 ? langVoices : voices;

        const charGender = charMeta?.gender || 'neutral';
        const maleBrowserVoices = pool.filter(v => {
          const n = v.name.toLowerCase();
          if (/\b(female|samantha|victoria|zira|karen|fiona|veena|moira|kyoko|tessa|yuri|luciana|helena|laura|anna|clara)\b/i.test(n)) return false;
          return /\b(male|david|james|george|mark|richard|alex|fred|daniel|tom|brian|oliver|steffan|harold|oscar|matt|michael|paul)\b/i.test(n);
        });
        const femaleBrowserVoices = pool.filter(v => {
          const n = v.name.toLowerCase();
          if (/\b(male|david|james|george|mark|richard|fred|daniel|tom|brian|oliver)\b/i.test(n) && !/\bfemale\b/i.test(n)) return false;
          return /\b(female|samantha|victoria|zira|karen|fiona|veena|moira|kyoko|tessa|yuri|luciana|helena|laura|anna|clara)\b/i.test(n);
        });

        let targetVoice: SpeechSynthesisVoice | undefined;
        if (charGender === 'male' && maleBrowserVoices.length > 0) {
          targetVoice = maleBrowserVoices[Math.max(0, charIndex) % maleBrowserVoices.length];
        } else if (charGender === 'female' && femaleBrowserVoices.length > 0) {
          targetVoice = femaleBrowserVoices[Math.max(0, charIndex) % femaleBrowserVoices.length];
        } else {
          targetVoice = pool[Math.max(0, charIndex) % pool.length];
        }
        utterance.voice = targetVoice || pool[0];
      }

      utterance.onend = () => {
        handleNextWithPause();
      };
      utterance.onerror = () => {
        handleNextWithPause();
      };

      window.speechSynthesis.speak(utterance);
    } else {
      handleNextWithPause();
    }
  };

  // Merge consecutive narrator micro-segments into fluid continuous paragraphs for natural human breath & cadence
  const mergeMicroSegmentsForFluency = (data: AudiobookConversionJSON): AudiobookConversionJSON => {
    if (!data || !data.audiobook_script || data.audiobook_script.length <= 1) return data;

    const mergedScript: AudiobookScriptSegment[] = [];
    let currentGroup: AudiobookScriptSegment | null = null;

    for (const seg of data.audiobook_script) {
      if (!currentGroup) {
        currentGroup = { ...seg };
        continue;
      }

      const sameSpeaker =
        (currentGroup.speaker_id || '').toLowerCase().trim() === (seg.speaker_id || '').toLowerCase().trim();

      const groupWordCount = (currentGroup.clean_spoken_text || currentGroup.raw_text || '').split(/\s+/).filter(Boolean).length;

      // Combine if same speaker and word count is under 180 words
      if (sameSpeaker && groupWordCount < 180) {
        const clean1 = currentGroup.clean_spoken_text || currentGroup.raw_text;
        const clean2 = seg.clean_spoken_text || seg.raw_text;
        const combinedClean = `${clean1} ${clean2}`.trim();
        const combinedRaw = `${currentGroup.raw_text} ${seg.raw_text}`.trim();

        currentGroup = {
          ...currentGroup,
          raw_text: combinedRaw,
          clean_spoken_text: combinedClean,
          ssml_text: currentGroup.ssml_text && seg.ssml_text ? `${currentGroup.ssml_text} ${seg.ssml_text}` : currentGroup.ssml_text || seg.ssml_text,
          pause_after_ms: seg.pause_after_ms
        };
      } else {
        mergedScript.push(currentGroup);
        currentGroup = { ...seg };
      }
    }

    if (currentGroup) {
      mergedScript.push(currentGroup);
    }

    return {
      ...data,
      audiobook_script: mergedScript
    };
  };

  const handleMergeMicroSegmentsUI = () => {
    if (!conversionData) return;
    const merged = mergeMicroSegmentsForFluency(conversionData);
    setConversionData(merged);
    setTtsNotice({
      type: 'success',
      message: `✨ Human Fluency Optimization Complete! Combined script into ${merged.audiobook_script.length} fluid, continuous paragraphs for natural breath intake & unbroken audio cadence.`
    });
  };

  const handleStartOrPauseMasterPlayback = async (startIndex?: number, overrideContent?: string) => {
    if (isMasterPlaying) {
      stopMasterPlayback();
      return;
    }

    stopMasterPlayback();

    let data = conversionData;
    if (!data) {
      const textToUse = overrideContent || activeChapter?.content;
      if (!activeChapter || !textToUse || !textToUse.trim()) {
        alert("Please write or select a chapter with content first!");
        return;
      }
      setIsGenerating(true);
      try {
        const result = await convertManuscriptToAudiobookScriptJSON(
          bookDetails,
          activeChapter.title,
          textToUse,
          customApiKey
        );
        const processedRoster = ensureAllScriptSpeakersInRoster(result.audiobook_script, result.character_roster, elevenLabsVoices);
        const mergedResult = mergeMicroSegmentsForFluency({
          ...result,
          character_roster: processedRoster
        });
        data = mergedResult;
        setConversionData(data);
      } catch (e: any) {
        alert("Could not generate audiobook voice script: " + (e.message || "Unknown error"));
        setIsGenerating(false);
        return;
      } finally {
        setIsGenerating(false);
      }
    }

    isMasterPlayingRef.current = true;
    setIsMasterPlaying(true);
    const targetIdx = typeof startIndex === 'number' ? startIndex : masterSegmentIndex;
    playMasterSegmentAtIndex(targetIdx, data);
  };

  const handleStartOrPauseMasterPlaybackWithText = (text: string) => {
    handleStartOrPauseMasterPlayback(0, text);
  };

  const handleSkipMasterSegment = (direction: 'prev' | 'next') => {
    if (!conversionData || !conversionData.audiobook_script.length) return;
    const newIndex = direction === 'next'
      ? Math.min(conversionData.audiobook_script.length - 1, masterSegmentIndex + 1)
      : Math.max(0, masterSegmentIndex - 1);

    if (isMasterPlaying) {
      stopMasterPlayback();
      isMasterPlayingRef.current = true;
      setIsMasterPlaying(true);
      playMasterSegmentAtIndex(newIndex, conversionData);
    } else {
      setMasterSegmentIndex(newIndex);
    }
  };

  // New lexicon term form state
  const [newLexTerm, setNewLexTerm] = useState('');
  const [newLexPhonetic, setNewLexPhonetic] = useState('');
  const [newLexNotes, setNewLexNotes] = useState('');

  // Fetch ElevenLabs voices on mount or when API key changes
  useEffect(() => {
    handleRefreshVoices();
  }, [elevenLabsApiKey]);

  const handleRefreshVoices = async () => {
    setIsLoadingVoices(true);
    try {
      const voices = await fetchElevenLabsVoices(elevenLabsApiKey);
      setElevenLabsVoices(voices);
    } catch (e) {
      console.warn("Could not fetch ElevenLabs voices:", e);
    } finally {
      setIsLoadingVoices(false);
    }
  };

  const handleSaveElevenKey = (val: string) => {
    setElevenLabsApiKey(val);
    localStorage.setItem('elevenlabs_api_key', val);
  };

  // Convert Manuscript to Structured Audiobook JSON
  const handleConvertChapter = async () => {
    if (!activeChapter || !activeChapter.content || !activeChapter.content.trim()) {
      alert("Please write or select a chapter with content first!");
      return;
    }

    setIsGenerating(true);
    try {
      const result = await convertManuscriptToAudiobookScriptJSON(
        bookDetails,
        activeChapter.title,
        activeChapter.content,
        customApiKey
      );
      // Auto-detect any extra script speakers and assign distinct male/female voices for every character
      const processedRoster = ensureAllScriptSpeakersInRoster(result.audiobook_script, result.character_roster, elevenLabsVoices);
      setConversionData({
        ...result,
        character_roster: processedRoster
      });
      setStudioSubTab('script');
    } catch (e: any) {
      alert("Audiobook conversion failed: " + (e.message || "Unknown error"));
    } finally {
      setIsGenerating(false);
    }
  };

  // Gender Inference Helper for unknown character names & dialogue speakers
  const inferGenderFromName = (name: string, speakerId: string): 'male' | 'female' | 'neutral' => {
    const combined = `${name} ${speakerId}`.toLowerCase();
    
    // Female keywords & prefixes
    if (/\b(she|her|hers|female|woman|girl|lady|queen|mrs|ms|miss|madam|aunt|sister|mother|daughter|princess|duchess|empress|dame|nurse|lady|madame)\b/i.test(combined)) {
      return 'female';
    }
    // Female common names
    if (/\b(alice|sarah|emma|elizabeth|charlotte|sophia|olivia|isabella|mia|harper|evelyn|abigail|emily|ella|elena|clara|grace|victoria|rose|mary|lucy|jane|lily|sophie|hannah|rachel|julia|ann|anna|maria|eva|laura|nicole|freya|domi|bella)\b/i.test(combined)) {
      return 'female';
    }
    
    // Male keywords & prefixes
    if (/\b(he|him|his|male|man|boy|lord|king|mr|sir|uncle|brother|father|son|prince|duke|emperor|baron|captain|doctor|dr|general|officer)\b/i.test(combined)) {
      return 'male';
    }
    // Male common names
    if (/\b(john|david|james|robert|michael|william|richard|joseph|thomas|charles|christopher|daniel|matthew|anthony|george|edward|brian|kevin|jack|adam|antoni|arnold|callum|charlie|liam|joseph|roger)\b/i.test(combined)) {
      return 'male';
    }
    
    return 'neutral';
  };

  // Helper: Assign Unique & Distinct Voices to Character Roster (Male voices -> Male characters, Female voices -> Female characters)
  const assignUniqueVoicesToRoster = (
    roster: CharacterRosterItem[],
    availableVoices: ElevenLabsVoice[]
  ): CharacterRosterItem[] => {
    const voicesList = availableVoices.length > 0 ? availableVoices : DEFAULT_ELEVENLABS_VOICES;

    const femaleVoices = voicesList.filter(v => getVoiceGender(v) === 'female');
    const maleVoices = voicesList.filter(v => getVoiceGender(v) === 'male');

    const usedVoiceIds = new Set<string>();

    return roster.map((char, index) => {
      const isNarrator = char.character_id === 'narrator' || char.name.toLowerCase().includes('narrator');
      let g = (char.gender || '').toLowerCase().trim();

      if (!g || g === 'neutral' || g === 'unknown') {
        g = isNarrator ? 'neutral' : inferGenderFromName(char.name, char.character_id);
      }

      const validGender: 'female' | 'male' | 'neutral' = (g === 'female' ? 'female' : g === 'male' ? 'male' : 'neutral');

      // 1. Keep existing assigned voice ONLY IF valid, matches gender, and isn't taken yet by another character
      if (char.assigned_voice_id && voicesList.some(v => v.voice_id === char.assigned_voice_id) && !usedVoiceIds.has(char.assigned_voice_id)) {
        const existingVoice = voicesList.find(v => v.voice_id === char.assigned_voice_id)!;
        const voiceGender = getVoiceGender(existingVoice);

        if (isNarrator || (validGender === 'female' && voiceGender === 'female') || (validGender === 'male' && voiceGender === 'male') || validGender === 'neutral') {
          usedVoiceIds.add(char.assigned_voice_id);
          return { ...char, gender: validGender };
        }
      }

      // 2. Target pool by gender
      let targetPool: ElevenLabsVoice[] = [];
      if (validGender === 'female') {
        targetPool = femaleVoices.length > 0 ? femaleVoices : voicesList;
      } else if (validGender === 'male') {
        targetPool = maleVoices.length > 0 ? maleVoices : voicesList;
      } else {
        targetPool = voicesList;
      }

      // 3. Try suggested voice first if available in target pool and unused
      const suggested = (char.suggested_elevenlabs_voice || '').toLowerCase().trim();
      let match = targetPool.find(v =>
        !usedVoiceIds.has(v.voice_id) &&
        suggested.length > 0 &&
        (v.name.toLowerCase() === suggested ||
         v.name.toLowerCase().includes(suggested) ||
         suggested.includes(v.name.toLowerCase()))
      );

      // 3b. Special Airport Announcer voice preference
      const isAnnouncerRole = isAirportAnnouncerSpeaker(char.character_id, char.name, char.description);
      if (isAnnouncerRole && !match) {
        const announcerVoice = targetPool.find(v =>
          !usedVoiceIds.has(v.voice_id) &&
          (v.name.toLowerCase() === 'alice' || v.name.toLowerCase() === 'patrick' || v.description?.toLowerCase().includes('announcer'))
        );
        if (announcerVoice) match = announcerVoice;
      }

      // 4. Try any unused voice from targetPool
      if (!match) {
        match = targetPool.find(v => !usedVoiceIds.has(v.voice_id));
      }

      // 5. Try any unused voice overall
      if (!match) {
        match = voicesList.find(v => !usedVoiceIds.has(v.voice_id));
      }

      // 6. Fallback: index modulo targetPool
      if (!match) {
        match = targetPool[index % targetPool.length] || voicesList[index % voicesList.length];
      }

      const assignedId = match ? match.voice_id : (femaleVoices[0]?.voice_id || voicesList[0]?.voice_id);
      usedVoiceIds.add(assignedId);

      return {
        ...char,
        gender: validGender,
        assigned_voice_id: assignedId
      };
    });
  };

  // Ensure all speakers present in script segments are included in character roster
  const ensureAllScriptSpeakersInRoster = (
    script: AudiobookScriptSegment[],
    roster: CharacterRosterItem[],
    availableVoices: ElevenLabsVoice[]
  ): CharacterRosterItem[] => {
    const updatedRoster = [...roster];
    const existingIds = new Set(updatedRoster.map(c => (c.character_id || '').toLowerCase().trim()));
    const existingNames = new Set(updatedRoster.map(c => (c.name || '').toLowerCase().trim()));

    script.forEach((segment) => {
      const spkId = (segment.speaker_id || '').trim();
      const spkName = (segment.speaker_name || spkId || '').trim();

      if (!spkId && !spkName) return;

      const normId = spkId.toLowerCase();
      const normName = spkName.toLowerCase();

      const exists = existingIds.has(normId) || existingNames.has(normName) ||
        updatedRoster.some(c => 
          c.character_id.toLowerCase() === normId ||
          c.name.toLowerCase() === normName ||
          c.name.toLowerCase() === normId
        );

      if (!exists) {
        const inferredGender = inferGenderFromName(spkName, spkId);
        const newChar: CharacterRosterItem = {
          character_id: spkId || `char_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: spkName || 'Dialogue Speaker',
          gender: inferredGender,
          age_group: 'adult',
          vocal_tone: 'Distinct character dialogue',
          recommended_accent: 'American',
          suggested_elevenlabs_voice: inferredGender === 'female' ? 'Rachel' : 'Antoni',
          assigned_voice_id: ''
        };
        updatedRoster.push(newChar);
        existingIds.add(newChar.character_id.toLowerCase());
        existingNames.add(newChar.name.toLowerCase());
      }
    });

    return assignUniqueVoicesToRoster(updatedRoster, availableVoices);
  };

  // Change character gender manually and auto-reassign matching voice
  const handleChangeCharacterGender = (characterId: string, newGender: 'male' | 'female' | 'neutral') => {
    if (!conversionData) return;

    setConversionData(prev => {
      if (!prev) return prev;
      const voicesList = elevenLabsVoices.length > 0 ? elevenLabsVoices : DEFAULT_ELEVENLABS_VOICES;
      
      const targetPool = voicesList.filter(v =>
        newGender === 'female'
          ? getVoiceGender(v) === 'female'
          : newGender === 'male'
          ? getVoiceGender(v) === 'male'
          : true
      );

      const usedVoices = new Set(prev.character_roster.filter(c => c.character_id !== characterId).map(c => c.assigned_voice_id));
      const nextVoice = targetPool.find(v => !usedVoices.has(v.voice_id)) || targetPool[0] || voicesList[0];

      return {
        ...prev,
        character_roster: prev.character_roster.map(c =>
          c.character_id === characterId
            ? { ...c, gender: newGender, assigned_voice_id: nextVoice ? nextVoice.voice_id : c.assigned_voice_id }
            : c
        )
      };
    });

    setTtsNotice({
      type: 'info',
      message: `Updated gender to ${newGender.toUpperCase()} and auto-assigned matching voice talent.`
    });
  };

  // Map Speaker Voice
  const handleAssignVoice = (characterId: string, voiceId: string) => {
    if (!conversionData) return;
    setConversionData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        character_roster: prev.character_roster.map(c =>
          c.character_id === characterId ? { ...c, assigned_voice_id: voiceId } : c
        )
      };
    });
  };

  // Audio Line Preview (ElevenLabs or Web Speech API)
  const handlePlaySegment = async (segment: AudiobookScriptSegment) => {
    setTtsNotice(null);

    if (playingSegmentId === segment.segment_id) {
      // Stop playback
      if (audioObject) {
        audioObject.pause();
        setAudioObject(null);
      }
      window.speechSynthesis?.cancel();
      setPlayingSegmentId(null);
      return;
    }

    // Stop existing audio
    if (audioObject) audioObject.pause();
    window.speechSynthesis?.cancel();
    setPlayingSegmentId(segment.segment_id);

    // Find assigned voice ID for this speaker using flexible matching
    const targetSpeakerId = (segment.speaker_id || '').toLowerCase().trim();
    const targetSpeakerName = (segment.speaker_name || '').toLowerCase().trim();

    const charMeta = conversionData?.character_roster.find(c => {
      const cId = (c.character_id || '').toLowerCase().trim();
      const cName = (c.name || '').toLowerCase().trim();
      return (
        cId === targetSpeakerId ||
        cName === targetSpeakerId ||
        cId === targetSpeakerName ||
        cName === targetSpeakerName ||
        (cId && targetSpeakerId.includes(cId)) ||
        (cName && targetSpeakerId.includes(cName)) ||
        (targetSpeakerName && cName.includes(targetSpeakerName))
      );
    });

    const charIndex = conversionData?.character_roster.findIndex(c => c.character_id === charMeta?.character_id) ?? 0;
    const voicesList = elevenLabsVoices.length > 0 ? elevenLabsVoices : DEFAULT_ELEVENLABS_VOICES;
    const fallbackIdx = Math.max(0, charIndex) % voicesList.length;
    const assignedVoiceId = charMeta?.assigned_voice_id || voicesList[fallbackIdx]?.voice_id || DEFAULT_ELEVENLABS_VOICES[0].voice_id;

    const tryEleven = speechEnginePreference === 'elevenlabs' && elevenLabsApiKey && elevenLabsApiKey.trim();

    // Check if current speaker is an Airport Announcer / PA System / Intercom role
    const isAnnouncerRole = isAirportAnnouncerSpeaker(segment.speaker_id, segment.speaker_name, segment.delivery_emotion);
    if (paAnnouncerChimeEnabled && isAnnouncerRole) {
      await playAirportTannoyChime();
    }

    if (tryEleven) {
      try {
        const audioUrl = await synthesizeElevenLabsTTS(
          segment.clean_spoken_text,
          assignedVoiceId,
          elevenLabsApiKey,
          {
            modelId: elevenLabsModel,
            languageCode: ttsLanguage.split('-')[0],
            stability,
            similarityBoost,
            style,
            useSpeakerBoost
          }
        );
        if (audioUrl) {
          const newAudio = new Audio(audioUrl);
          setAudioObject(newAudio);
          newAudio.play();
          newAudio.onended = () => {
            setPlayingSegmentId(null);
            setAudioObject(null);
          };
          return;
        }
      } catch (err: any) {
        console.warn("ElevenLabs TTS error, falling back to Web Speech API:", err);
        setTtsNotice({
          type: 'error',
          message: `ElevenLabs API call failed (${err.message || 'Error'}). Fallback played via Browser Speech Engine.`
        });
      }
    }

    // Fallback: Web Speech API (Browser Native Speech)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(segment.clean_spoken_text);
      utterance.rate = segment.speaking_rate || 1.0;
      utterance.lang = ttsLanguage || 'en-US';

      // Pitch & speed variation per character
      const pitchOffset = (Math.max(0, charIndex) % 3) * 0.12;
      if (charMeta?.gender === 'female') {
        utterance.pitch = 1.15 + pitchOffset;
        utterance.rate = (segment.speaking_rate || 1.0) * 1.02;
      } else if (charMeta?.gender === 'male') {
        utterance.pitch = Math.max(0.65, 0.85 - pitchOffset);
        utterance.rate = (segment.speaking_rate || 1.0) * 0.95;
      } else {
        utterance.pitch = 1.0 + pitchOffset;
      }

      // Voice match from system voices
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const targetLangCode = (ttsLanguage || 'en-US').toLowerCase();
        const targetShort = targetLangCode.split('-')[0];
        const langVoices = voices.filter(v =>
          v.lang.toLowerCase() === targetLangCode ||
          v.lang.toLowerCase().startsWith(targetShort) ||
          v.lang.toLowerCase().startsWith('en')
        );
        const pool = langVoices.length > 0 ? langVoices : voices;

        const charGender = charMeta?.gender || 'neutral';
        const maleBrowserVoices = pool.filter(v => {
          const n = v.name.toLowerCase();
          if (/\b(female|samantha|victoria|zira|karen|fiona|veena|moira|kyoko|tessa|yuri|luciana|helena|laura|anna|clara)\b/i.test(n)) return false;
          return /\b(male|david|james|george|mark|richard|alex|fred|daniel|tom|brian|oliver|steffan|harold|oscar|matt|michael|paul)\b/i.test(n);
        });
        const femaleBrowserVoices = pool.filter(v => {
          const n = v.name.toLowerCase();
          if (/\b(male|david|james|george|mark|richard|fred|daniel|tom|brian|oliver)\b/i.test(n) && !/\bfemale\b/i.test(n)) return false;
          return /\b(female|samantha|victoria|zira|karen|fiona|veena|moira|kyoko|tessa|yuri|luciana|helena|laura|anna|clara)\b/i.test(n);
        });

        let targetVoice: SpeechSynthesisVoice | undefined;
        if (charGender === 'male' && maleBrowserVoices.length > 0) {
          targetVoice = maleBrowserVoices[Math.max(0, charIndex) % maleBrowserVoices.length];
        } else if (charGender === 'female' && femaleBrowserVoices.length > 0) {
          targetVoice = femaleBrowserVoices[Math.max(0, charIndex) % femaleBrowserVoices.length];
        } else {
          targetVoice = pool[Math.max(0, charIndex) % pool.length];
        }

        utterance.voice = targetVoice || pool[0];
      }

      utterance.onend = () => {
        setPlayingSegmentId(null);
      };
      utterance.onerror = (e) => {
        console.error("Browser speech error:", e);
        setPlayingSegmentId(null);
      };

      window.speechSynthesis.speak(utterance);
    } else {
      alert("Browser speech synthesis is not supported in this browser.");
      setPlayingSegmentId(null);
    }
  };

  // Auto-Match Suggested Voices
  const handleAutoMatchVoices = () => {
    if (!conversionData) return;
    
    const updatedRoster = assignUniqueVoicesToRoster(conversionData.character_roster, elevenLabsVoices);
    setConversionData(prev => prev ? { ...prev, character_roster: updatedRoster } : prev);
    
    setTtsNotice({
      type: 'success',
      message: `Successfully auto-matched distinct voice talent for all ${updatedRoster.length} characters.`
    });
  };

  // Audition Individual Voice Talent
  const handleAuditionCharacterVoice = async (characterId: string, charName: string, voiceId: string, overrideText?: string) => {
    setTtsNotice(null);
    const sampleText = overrideText && overrideText.trim().length > 0
      ? overrideText.trim()
      : `Hello, I'm ${charName}. I'll be voicing my dialogue for this audiobook narration.`;
    const tempSegId = `audition-${characterId}`;

    if (playingSegmentId === tempSegId) {
      if (audioObject) {
        audioObject.pause();
        setAudioObject(null);
      }
      window.speechSynthesis?.cancel();
      setPlayingSegmentId(null);
      return;
    }

    if (audioObject) audioObject.pause();
    window.speechSynthesis?.cancel();
    setPlayingSegmentId(tempSegId);

    const tryEleven = speechEnginePreference === 'elevenlabs' && elevenLabsApiKey && elevenLabsApiKey.trim();

    if (tryEleven) {
      try {
        const audioUrl = await synthesizeElevenLabsTTS(
          sampleText,
          voiceId,
          elevenLabsApiKey,
          {
            modelId: elevenLabsModel,
            languageCode: ttsLanguage.split('-')[0],
            stability,
            similarityBoost,
            style,
            useSpeakerBoost
          }
        );
        if (audioUrl) {
          const newAudio = new Audio(audioUrl);
          setAudioObject(newAudio);
          newAudio.play();
          newAudio.onended = () => {
            setPlayingSegmentId(null);
            setAudioObject(null);
          };
          return;
        }
      } catch (err: any) {
        console.warn("ElevenLabs audition error:", err);
        setTtsNotice({
          type: 'error',
          message: `ElevenLabs audition error (${err.message || 'Error'}). Fallback played via Browser Speech.`
        });
      }
    }

    // Fallback Web Speech
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(sampleText);
      utterance.lang = ttsLanguage || 'en-US';

      const charMeta = conversionData?.character_roster.find(c => c.character_id === characterId);
      const charIndex = conversionData?.character_roster.findIndex(c => c.character_id === characterId) ?? 0;

      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const targetLangCode = (ttsLanguage || 'en-US').toLowerCase();
        const targetShort = targetLangCode.split('-')[0];
        const langVoices = voices.filter(v =>
          v.lang.toLowerCase() === targetLangCode ||
          v.lang.toLowerCase().startsWith(targetShort) ||
          v.lang.toLowerCase().startsWith('en')
        );
        const systemVoices = langVoices.length > 0 ? langVoices : voices;

        if (selectedBrowserVoiceURI) {
          utterance.voice = voices.find(v => v.voiceURI === selectedBrowserVoiceURI) || systemVoices[Math.max(0, charIndex) % systemVoices.length];
        } else {
          utterance.voice = systemVoices[Math.max(0, charIndex) % systemVoices.length];
        }
      }

      // Pitch & rate
      const pitchOffset = (Math.max(0, charIndex) % 3) * 0.12;
      if (charMeta?.gender === 'female') {
        utterance.pitch = 1.15 + pitchOffset;
        utterance.rate = 1.02;
      } else if (charMeta?.gender === 'male') {
        utterance.pitch = Math.max(0.65, 0.85 - pitchOffset);
        utterance.rate = 0.95;
      } else {
        utterance.pitch = 1.0 + pitchOffset;
      }

      utterance.onend = () => setPlayingSegmentId(null);
      utterance.onerror = () => setPlayingSegmentId(null);
      window.speechSynthesis.speak(utterance);
    } else {
      setPlayingSegmentId(null);
    }
  };

  // Audition Duo Conversation (Plays Narrator line then Character line back-to-back)
  const handleAuditionDuoConversation = async (charA: CharacterRosterItem, charB: CharacterRosterItem) => {
    setTtsNotice(null);
    const duoId = `duo-${charA.character_id}-${charB.character_id}`;

    if (playingSegmentId === duoId) {
      if (audioObject) {
        audioObject.pause();
        setAudioObject(null);
      }
      window.speechSynthesis?.cancel();
      setPlayingSegmentId(null);
      return;
    }

    if (audioObject) audioObject.pause();
    window.speechSynthesis?.cancel();
    setPlayingSegmentId(duoId);

    const lineA = `Chapter One. ${charA.name} spoke calmly as the room grew quiet.`;
    const lineB = `And ${charB.name} replied immediately with a distinct voice tone and personality.`;

    const voiceA = charA.assigned_voice_id || elevenLabsVoices[0]?.voice_id || '21m00Tcm4TlvDq8ikWAM';
    const voiceB = charB.assigned_voice_id || elevenLabsVoices[1]?.voice_id || 'AZnzlk1XvdvUeBnXmlld';

    const tryEleven = speechEnginePreference === 'elevenlabs' && elevenLabsApiKey && elevenLabsApiKey.trim();

    if (tryEleven) {
      try {
        const urlA = await synthesizeElevenLabsTTS(lineA, voiceA, elevenLabsApiKey, { modelId: elevenLabsModel, languageCode: ttsLanguage.split('-')[0] });
        if (urlA) {
          const audioA = new Audio(urlA);
          setAudioObject(audioA);
          audioA.play();
          audioA.onended = async () => {
            const urlB = await synthesizeElevenLabsTTS(lineB, voiceB, elevenLabsApiKey, { modelId: elevenLabsModel, languageCode: ttsLanguage.split('-')[0] });
            if (urlB) {
              const audioB = new Audio(urlB);
              setAudioObject(audioB);
              audioB.play();
              audioB.onended = () => {
                setPlayingSegmentId(null);
                setAudioObject(null);
              };
            } else {
              setPlayingSegmentId(null);
            }
          };
          return;
        }
      } catch (err) {
        console.warn("Duo audition error:", err);
      }
    }

    // Fallback Web Speech for Duo
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const uA = new SpeechSynthesisUtterance(lineA);
      uA.lang = ttsLanguage || 'en-US';
      uA.pitch = charA.gender === 'female' ? 1.2 : 0.85;

      const uB = new SpeechSynthesisUtterance(lineB);
      uB.lang = ttsLanguage || 'en-US';
      uB.pitch = charB.gender === 'female' ? 1.25 : 0.7;

      uA.onend = () => window.speechSynthesis.speak(uB);
      uB.onend = () => setPlayingSegmentId(null);
      uA.onerror = () => setPlayingSegmentId(null);
      uB.onerror = () => setPlayingSegmentId(null);

      window.speechSynthesis.speak(uA);
    }
  };

  // Add Custom Voice ID to Library
  const handleAddCustomVoiceId = (voiceId: string, voiceName?: string) => {
    if (!voiceId || !voiceId.trim()) return;
    const id = voiceId.trim();
    const exists = elevenLabsVoices.some(v => v.voice_id === id);
    if (!exists) {
      const newVoice: ElevenLabsVoice = {
        voice_id: id,
        name: voiceName?.trim() || `Custom Voice (${id.substring(0, 6)}...)`,
        category: 'custom',
        description: 'User-added custom ElevenLabs Voice ID',
        labels: { gender: 'custom', accent: 'custom' }
      };
      setElevenLabsVoices(prev => [newVoice, ...prev]);
      setTtsNotice({
        type: 'success',
        message: `Added custom voice "${newVoice.name}" to your voice library!`
      });
    }
  };

  // Add New Character to Roster
  const handleAddCharacterToRoster = () => {
    if (!conversionData) return;
    const charName = prompt("Enter new character name (e.g. 'Sarah', 'Captain Drake'):");
    if (!charName || !charName.trim()) return;
    
    const newCharId = `char_${Date.now()}`;
    const newChar: CharacterRosterItem = {
      character_id: newCharId,
      name: charName.trim(),
      gender: 'male',
      age_group: 'adult',
      vocal_tone: 'Expressive and clear dialogue tone',
      recommended_accent: 'American',
      suggested_elevenlabs_voice: 'Antoni',
      assigned_voice_id: elevenLabsVoices[0]?.voice_id || '21m00Tcm4TlvDq8ikWAM'
    };
    
    setConversionData({
      ...conversionData,
      character_roster: [...conversionData.character_roster, newChar]
    });
    setTtsNotice({
      type: 'success',
      message: `Added character "${charName}" to cast roster!`
    });
  };

  // Copy helper
  const triggerCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNotice(label);
    setTimeout(() => setCopiedNotice(null), 2000);
  };

  // Add term to lexicon
  const handleAddLexiconTerm = () => {
    if (!newLexTerm.trim()) return;
    const newEntry: PronunciationLexiconItem = {
      term: newLexTerm.trim(),
      category: 'complex_word',
      phonetic_spelling: newLexPhonetic.trim() || newLexTerm.trim(),
      ssml_phoneme: `<phoneme alphabet="ipa" ph="${newLexPhonetic.trim() || newLexTerm.trim()}">${newLexTerm.trim()}</phoneme>`,
      notes: newLexNotes.trim() || 'Custom author addition'
    };

    setConversionData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        pronunciation_lexicon: [...prev.pronunciation_lexicon, newEntry]
      };
    });

    setNewLexTerm('');
    setNewLexPhonetic('');
    setNewLexNotes('');
  };

  // Word count & duration calculation
  const wordCount = activeChapter?.content ? activeChapter.content.split(/\s+/).filter(Boolean).length : 0;
  const estDurationMin = Math.ceil(wordCount / 150);

  return (
    <div className="space-y-6">
      {/* Studio Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-purple-950 to-zinc-950 p-6 sm:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden border border-indigo-800/40">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold tracking-wide uppercase">
              <Headphones className="w-3.5 h-3.5 text-indigo-400" /> ElevenLabs AI Audiobook Production Studio
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              AI Voice Director & Script Conversion Engine
            </h2>
            <p className="text-indigo-100 text-xs sm:text-sm leading-relaxed">
              Automatically convert manuscript chapters into production-ready ElevenLabs audio scripts complete with sanitized spoken numbers, character voice rosters, emotion delivery tags, millisecond pause timing, and SSML phoneme dictionaries.
            </p>
          </div>

          <button
            onClick={handleConvertChapter}
            disabled={isGenerating || !activeChapter}
            className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 disabled:opacity-50 text-white font-extrabold px-6 py-4 rounded-2xl text-xs sm:text-sm transition-all shadow-xl shadow-indigo-950/50 flex items-center justify-center gap-2.5 shrink-0 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Converting Chapter to Voice Script...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-indigo-200" /> Convert Chapter to Audiobook Script
              </>
            )}
          </button>
        </div>
      </div>

      {/* PROMINENT MASTER FULL CHAPTER AUDIO PLAYER & CONTROLS STATION */}
      <div className="bg-gradient-to-br from-indigo-950 via-purple-950 to-zinc-950 text-white p-6 sm:p-8 rounded-3xl border border-indigo-700/50 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-indigo-800/60 pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-extrabold uppercase tracking-wider border border-emerald-400/30 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> Master Audio Narration Station
              </span>
              <span className="text-xs text-indigo-300 font-medium">
                Chapter: <strong className="text-white">{activeChapter?.title || 'Selected Chapter'}</strong>
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              🎧 Continuous Full Chapter Audiobook Narration
            </h3>
            <p className="text-xs sm:text-sm text-indigo-200 leading-relaxed max-w-2xl">
              Listen to complete continuous audio narration for this chapter. Automatically parses multi-character dialogue, applies assigned AI voice artists, and maintains natural dramatic pauses.
            </p>
          </div>

          {/* Master Play / Pause Action Button & Manuscript Audio Adaptor */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={handleAdaptManuscriptForAudio}
              disabled={isAdaptingForAudio || !activeChapter?.content}
              className="px-5 py-4 rounded-2xl font-extrabold text-xs sm:text-sm bg-purple-600/80 hover:bg-purple-600 text-white transition-all shadow-lg flex items-center justify-center gap-2 border border-purple-400/30 cursor-pointer disabled:opacity-50"
              title="Rewrite print manuscript into spoken audiobook prose"
            >
              {isAdaptingForAudio ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-purple-200" />
                  <span>Adapting for Audio...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-purple-200" />
                  <span>✨ Adapt Manuscript for Audio</span>
                </>
              )}
            </button>

            <button
              onClick={() => handleStartOrPauseMasterPlayback()}
              disabled={isGenerating || !activeChapter?.content}
              className={`px-8 py-4 rounded-2xl font-black text-sm sm:text-base transition-all shadow-xl flex items-center justify-center gap-3 cursor-pointer ${
                isMasterPlaying
                  ? 'bg-amber-500 hover:bg-amber-400 text-amber-950 shadow-amber-500/30 ring-4 ring-amber-400/30'
                  : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 hover:from-emerald-400 hover:to-indigo-400 text-white shadow-emerald-950/50 hover:scale-[1.02]'
              } disabled:opacity-50`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                  <span>Preparing Voice Script & Audio...</span>
                </>
              ) : isMasterPlaying ? (
                <>
                  <Pause className="w-6 h-6 fill-amber-950 text-amber-950" />
                  <span>PAUSE FULL CHAPTER AUDIO</span>
                </>
              ) : (
                <>
                  <Play className="w-6 h-6 fill-white text-white" />
                  <span>PLAY FULL CHAPTER AUDIO</span>
                </>
              )}
            </button>

            {isMasterPlaying && (
              <button
                onClick={stopMasterPlayback}
                className="px-4 py-4 bg-red-600/80 hover:bg-red-600 text-white font-bold rounded-2xl text-xs transition-colors flex items-center justify-center gap-1.5 border border-red-500/40 cursor-pointer"
                title="Stop narration"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>Stop</span>
              </button>
            )}
          </div>
        </div>

        {/* Audio Engine Selection & Inter-segment Pause Pacing Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-200">Audio Engine:</span>
              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => setSpeechEnginePreference('elevenlabs')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    speechEnginePreference === 'elevenlabs'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  ElevenLabs Multi-Voice AI
                </button>
                <button
                  onClick={() => setSpeechEnginePreference('browser')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    speechEnginePreference === 'browser'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Native Speech (Free)
                </button>
              </div>
            </div>

            {/* Inter-Line Pause Pacing Selector */}
            <div className="flex items-center gap-2 border-l border-white/10 pl-4">
              <span className="text-xs font-bold text-indigo-200 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> Inter-Line Pause:
              </span>
              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => setPausePacingMode('seamless')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    pausePacingMode === 'seamless'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="0ms pause between spoken lines for smooth continuous flow"
                >
                  ⚡ Seamless (0ms)
                </button>
                <button
                  onClick={() => setPausePacingMode('natural')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    pausePacingMode === 'natural'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="50ms subtle breath pause between lines"
                >
                  🌿 Natural (50ms)
                </button>
                <button
                  onClick={() => setPausePacingMode('dramatic')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    pausePacingMode === 'dramatic'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="150ms dramatic beat pause between lines"
                >
                  🎭 Dramatic (150ms)
                </button>
              </div>
            </div>

            {/* Airport PA Announcer Tannoy Chime & Acoustic Filter Toggle */}
            <div className="flex items-center gap-2 border-l border-white/10 pl-4">
              <span className="text-xs font-bold text-indigo-200 flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-sky-400" /> Airport PA Chime:
              </span>
              <button
                onClick={() => setPaAnnouncerChimeEnabled(!paAnnouncerChimeEnabled)}
                className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 border ${
                  paAnnouncerChimeEnabled
                    ? 'bg-sky-600 text-white border-sky-400/40 shadow-sm'
                    : 'bg-black/40 text-zinc-400 border-white/10 hover:text-white'
                }`}
                title="Plays signature 2-tone airport Tannoy chime (Bing-Bong) before Airport Announcer & PA lines"
              >
                <span>{paAnnouncerChimeEnabled ? '🔔 Chime ON' : '🔕 Chime OFF'}</span>
              </button>
            </div>
          </div>

          <div className="text-xs text-indigo-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              {speechEnginePreference === 'elevenlabs'
                ? `ElevenLabs Key Ready (${elevenLabsVoices.length} Voices)`
                : 'Using System Voices'}
            </span>
          </div>
        </div>

        {/* Active Narration Segment Teleprompter & HUD */}
        {conversionData && conversionData.audiobook_script.length > 0 ? (
          <div className="bg-black/50 backdrop-blur-md p-5 rounded-2xl border border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-emerald-400 uppercase tracking-wider text-[11px] bg-emerald-950/80 px-2.5 py-1 rounded-md border border-emerald-500/30">
                  {isMasterPlaying ? '▶ Speaking Line' : 'Master Audio HUD'}
                </span>
                <span className="font-bold text-indigo-200">
                  Segment {masterSegmentIndex + 1} of {conversionData.audiobook_script.length}
                </span>
                <span className="text-zinc-500">•</span>
                <span className="text-zinc-300 font-semibold">
                  {Math.round(((masterSegmentIndex + 1) / conversionData.audiobook_script.length) * 100)}% Complete
                </span>
              </div>

              {/* Prev / Next Segment Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSkipMasterSegment('prev')}
                  disabled={masterSegmentIndex <= 0}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <SkipBack className="w-3.5 h-3.5" /> Previous Line
                </button>
                <button
                  onClick={() => handleSkipMasterSegment('next')}
                  disabled={masterSegmentIndex >= conversionData.audiobook_script.length - 1}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  Next Line <SkipForward className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Chapter Progress Bar */}
            <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-400 h-full transition-all duration-300 rounded-full"
                style={{ width: `${((masterSegmentIndex + 1) / conversionData.audiobook_script.length) * 100}%` }}
              />
            </div>

            {/* Current Spoken Segment Card */}
            {conversionData.audiobook_script[masterSegmentIndex] && (
              <div className="p-4 rounded-xl bg-indigo-950/70 border border-indigo-500/30 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-purple-500/30 text-purple-200 text-[11px] font-black uppercase tracking-wider border border-purple-400/30 flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-purple-300" />
                      {conversionData.audiobook_script[masterSegmentIndex].speaker_name}
                    </span>
                    <span className="text-[10px] text-indigo-300 bg-indigo-900/60 px-2 py-0.5 rounded border border-indigo-700">
                      Rate: {conversionData.audiobook_script[masterSegmentIndex].speaking_rate}x
                    </span>
                  </div>

                  <span className="text-[10px] text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                    🎭 {conversionData.audiobook_script[masterSegmentIndex].delivery_emotion}
                  </span>
                </div>

                <p className="text-sm sm:text-base font-semibold text-white leading-relaxed font-sans">
                  "{conversionData.audiobook_script[masterSegmentIndex].clean_spoken_text}"
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-indigo-200 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-indigo-300 shrink-0" />
            <span>
              Click <strong className="text-white">PLAY FULL CHAPTER AUDIO</strong> above to convert manuscript text and begin instant continuous narration!
            </span>
          </div>
        )}
      </div>
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Chapter Selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-indigo-600" /> Chapter Sync:
          </label>
          <select
            value={selectedChapterId}
            onChange={(e) => {
              setSelectedChapterId(e.target.value);
              if (onSelectChapter) onSelectChapter(e.target.value);
            }}
            className="bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            {chapters.map((ch, idx) => (
              <option key={ch.id} value={ch.id}>
                Chapter {idx + 1}: {ch.title}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
            <span className="flex items-center gap-1 bg-zinc-100 px-2.5 py-1 rounded-lg">
              <Clock className="w-3.5 h-3.5 text-indigo-600" /> ~{estDurationMin} min narration
            </span>
            <span className="flex items-center gap-1 bg-zinc-100 px-2.5 py-1 rounded-lg">
              <FileText className="w-3.5 h-3.5 text-purple-600" /> {wordCount.toLocaleString()} words
            </span>
          </div>
        </div>

        {/* Right: ElevenLabs Key Input & Voice Sync Status */}
        <div className="flex items-center gap-2 bg-indigo-50/80 border border-indigo-100 p-2 rounded-xl flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1.5 bg-white border border-zinc-200 rounded-lg px-2.5 py-1 text-xs shadow-2xs">
            <Key className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <input
              type={showKeyText ? "text" : "password"}
              value={elevenLabsApiKey}
              onChange={(e) => handleSaveElevenKey(e.target.value)}
              placeholder="ElevenLabs API Key..."
              className="bg-transparent text-xs text-zinc-800 focus:outline-none w-44 sm:w-56 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKeyText(!showKeyText)}
              className="p-1 text-zinc-400 hover:text-zinc-700 rounded transition-colors"
              title={showKeyText ? "Hide API Key" : "Show API Key"}
            >
              {showKeyText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            {elevenLabsApiKey !== DEFAULT_ELEVENLABS_KEY && (
              <button
                type="button"
                onClick={() => handleSaveElevenKey(DEFAULT_ELEVENLABS_KEY)}
                className="p-1 text-zinc-400 hover:text-indigo-600 rounded transition-colors"
                title="Reset to default ElevenLabs API Key"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={handleRefreshVoices}
            disabled={isLoadingVoices}
            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0 disabled:opacity-50 shadow-2xs"
            title="Fetch custom voice clones from ElevenLabs account"
          >
            {isLoadingVoices ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Sync Voices</span>
          </button>

          <span className="text-[10px] font-bold text-indigo-900 bg-indigo-100/80 px-2 py-1 rounded border border-indigo-200 shrink-0">
            {elevenLabsVoices.length} Voices Ready
          </span>
        </div>
      </div>

      {/* Main Studio View Area */}
      {conversionData ? (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden space-y-0">
          {/* Subtab Navigation Bar */}
          <div className="bg-zinc-50 border-b border-zinc-200 px-4 pt-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setStudioSubTab('script')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-t border-x cursor-pointer ${
                studioSubTab === 'script'
                  ? 'bg-white text-indigo-700 border-zinc-200 border-b-white -mb-px shadow-2xs'
                  : 'bg-transparent text-zinc-600 border-transparent hover:text-zinc-900'
              }`}
            >
              <Volume2 className="w-4 h-4 text-indigo-600" />
              Line-by-Line Script ({conversionData.audiobook_script.length} Segments)
            </button>

            <button
              onClick={() => setStudioSubTab('roster')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-t border-x cursor-pointer ${
                studioSubTab === 'roster'
                  ? 'bg-white text-indigo-700 border-zinc-200 border-b-white -mb-px shadow-2xs'
                  : 'bg-transparent text-zinc-600 border-transparent hover:text-zinc-900'
              }`}
            >
              <UserCheck className="w-4 h-4 text-purple-600" />
              🎙️ Voiceover Casting Setup ({conversionData.character_roster.length} Cast)
            </button>

            <button
              onClick={() => setStudioSubTab('lexicon')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-t border-x cursor-pointer ${
                studioSubTab === 'lexicon'
                  ? 'bg-white text-indigo-700 border-zinc-200 border-b-white -mb-px shadow-2xs'
                  : 'bg-transparent text-zinc-600 border-transparent hover:text-zinc-900'
              }`}
            >
              <FileText className="w-4 h-4 text-emerald-600" />
              Pronunciation Dictionary ({conversionData.pronunciation_lexicon.length} Terms)
            </button>

            <button
              onClick={() => setStudioSubTab('soundscapes')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-t border-x cursor-pointer ${
                studioSubTab === 'soundscapes'
                  ? 'bg-white text-indigo-700 border-zinc-200 border-b-white -mb-px shadow-2xs'
                  : 'bg-transparent text-zinc-600 border-transparent hover:text-zinc-900'
              }`}
            >
              <Music className="w-4 h-4 text-pink-600" />
              Ambient Soundscapes
            </button>

            <button
              onClick={() => setStudioSubTab('settings')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-t border-x cursor-pointer ${
                studioSubTab === 'settings'
                  ? 'bg-white text-indigo-700 border-zinc-200 border-b-white -mb-px shadow-2xs'
                  : 'bg-transparent text-zinc-600 border-transparent hover:text-zinc-900'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 text-purple-600" />
              Speech Engine Settings
            </button>

            <button
              onClick={() => setStudioSubTab('export')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-t border-x cursor-pointer ${
                studioSubTab === 'export'
                  ? 'bg-white text-indigo-700 border-zinc-200 border-b-white -mb-px shadow-2xs'
                  : 'bg-transparent text-zinc-600 border-transparent hover:text-zinc-900'
              }`}
            >
              <Download className="w-4 h-4 text-amber-600" />
              Export & ElevenLabs API Tools
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Audio Synthesis Notice / Error Banner */}
            {ttsNotice && (
              <div className={`p-4 rounded-xl text-xs flex items-center justify-between border ${
                ttsNotice.type === 'error'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-indigo-50 border-indigo-200 text-indigo-900'
              }`}>
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>{ttsNotice.message}</span>
                </div>
                <button
                  onClick={() => setStudioSubTab('settings')}
                  className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-bold text-[11px] hover:bg-amber-700 transition-colors shrink-0"
                >
                  Adjust Voice Settings
                </button>
              </div>
            )}
            {/* SUBTAB 1: Line-by-Line Interactive Script */}
            {studioSubTab === 'script' && (
              <div className="space-y-6">
                {/* Chapter Metadata Header */}
                <div className="bg-zinc-900 text-zinc-100 p-5 rounded-2xl border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                      ACX Production Chapter Header
                    </span>
                    <h3 className="text-base font-bold text-white">
                      {conversionData.chapter_metadata.clean_spoken_title}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Overall Tone: <strong className="text-zinc-200">{conversionData.chapter_metadata.overall_tone}</strong> • Target Pacing: <strong className="text-zinc-200">{conversionData.chapter_metadata.target_pacing_wpm} WPM</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => triggerCopy(JSON.stringify(conversionData, null, 2), 'JSON Script Copied!')}
                      className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedNotice === 'JSON Script Copied!' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copy Full JSON</span>
                    </button>
                  </div>
                </div>

                {/* Human Fluency & Continuous Cadence Toolbar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-indigo-900/10 via-purple-900/10 to-pink-900/10 p-4 rounded-2xl border border-indigo-200">
                  <div className="space-y-1">
                    <span className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" /> Human Audio Cadence & Paragraph Flow Engine
                    </span>
                    <p className="text-xs text-zinc-600 leading-relaxed">
                      Combine consecutive narrator micro-lines into fluid continuous paragraphs to give text-to-speech actors natural breathing room, unbroken pitch melody, and publication-ready realism.
                    </p>
                  </div>
                  <button
                    onClick={handleMergeMicroSegmentsUI}
                    className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center gap-1.5 shrink-0 transition-all cursor-pointer hover:scale-[1.02]"
                    title="Combine short disjointed lines into full fluid paragraphs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>✨ Merge Micro-Lines into Fluid Paragraphs</span>
                  </button>
                </div>

                {/* Line Item List */}
                <div className="space-y-4">
                  {conversionData.audiobook_script.map((seg, idx) => {
                    const charMeta = conversionData.character_roster.find(c => c.character_id === seg.speaker_id);
                    const isNarrator = seg.speaker_id === 'narrator' || seg.speaker_name.toLowerCase().includes('narrator');
                    const isPlaying = playingSegmentId === seg.segment_id;

                    return (
                      <div
                        key={seg.segment_id || idx}
                        className={`p-5 rounded-2xl border transition-all ${
                          isPlaying
                            ? 'bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-300 shadow-md'
                            : isNarrator
                            ? 'bg-zinc-50/80 border-zinc-200 hover:border-zinc-300'
                            : 'bg-purple-50/40 border-purple-200 hover:border-purple-300'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200/60 mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                                isNarrator
                                  ? 'bg-zinc-200 text-zinc-800'
                                  : 'bg-purple-200 text-purple-900'
                              }`}
                            >
                              {isNarrator ? <BookOpen className="w-3 h-3 text-zinc-600" /> : <UserCheck className="w-3 h-3 text-purple-700" />}
                              {seg.speaker_name}
                            </span>

                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold border border-amber-200">
                              🎭 {seg.delivery_emotion}
                            </span>

                            <span className="text-[10px] text-zinc-500 font-medium">
                              Rate: {seg.speaking_rate}x
                            </span>

                            {seg.pause_after_ms > 0 && (
                              <span className="text-[10px] font-mono text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200">
                                ⏱ +{seg.pause_after_ms}ms pause
                              </span>
                            )}

                            {seg.soundscape_cue && (
                              <span className="text-[10px] font-semibold text-pink-700 bg-pink-100 px-2 py-0.5 rounded border border-pink-200 flex items-center gap-1">
                                🎵 {seg.soundscape_cue}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handlePlaySegment(seg)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                                isPlaying
                                  ? 'bg-red-600 text-white animate-pulse'
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                              }`}
                            >
                              {isPlaying ? <Square className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white" />}
                              <span>{isPlaying ? 'Stop' : 'Audition Line'}</span>
                            </button>

                            <button
                              onClick={() => triggerCopy(seg.clean_spoken_text, `Copied segment #${idx + 1}`)}
                              className="p-1.5 text-zinc-400 hover:text-zinc-700 bg-white border border-zinc-200 rounded-lg"
                              title="Copy sanitized line text"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Clean Spoken Text & Raw Text */}
                        <div className="space-y-2">
                          <div className="text-sm font-semibold text-zinc-900 leading-relaxed font-sans">
                            {seg.clean_spoken_text}
                          </div>

                          {seg.raw_text !== seg.clean_spoken_text && (
                            <p className="text-[11px] text-zinc-400 italic line-through">
                              Original raw draft: "{seg.raw_text}"
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SUBTAB 2: Character Voice Roster & Guided Setup */}
            {studioSubTab === 'roster' && (
              <div className="space-y-6">
                {/* STEP-BY-STEP VOICE CASTING SETUP WIZARD BANNER */}
                <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-zinc-900 text-white p-6 rounded-2xl shadow-sm space-y-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-indigo-800/80 pb-4">
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 text-[10px] font-extrabold uppercase tracking-wider border border-indigo-400/30">
                        <Sparkles className="w-3 h-3 text-indigo-300" /> Step-by-Step Voice Setup
                      </span>
                      <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                        🎙️ Voiceover Artist Casting & Voice Setup
                      </h3>
                      <p className="text-xs text-indigo-200 max-w-2xl leading-relaxed">
                        Follow this 3-step setup to cast your story narrator and assign tailored AI voice artists to each character.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleAutoMatchVoices}
                        className="px-3.5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                        title="Auto-assign voices based on AI character recommendations"
                      >
                        <Sparkles className="w-4 h-4 text-indigo-200" />
                        <span>Auto-Match All Voices</span>
                      </button>
                    </div>
                  </div>

                  {/* 3 Step Visual Progress Guide */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-xl border border-white/10 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-400 text-indigo-950 font-black text-xs flex items-center justify-center shrink-0">1</span>
                        <h4 className="text-xs font-extrabold text-white">Choose Primary Narrator</h4>
                      </div>
                      <p className="text-[11px] text-indigo-200 pl-7">
                        Select an expressive narrator voice for prose, descriptions, and scene headers.
                      </p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-xl border border-white/10 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-purple-400 text-purple-950 font-black text-xs flex items-center justify-center shrink-0">2</span>
                        <h4 className="text-xs font-extrabold text-white">Cast Character Dialogue</h4>
                      </div>
                      <p className="text-[11px] text-indigo-200 pl-7">
                        Match distinct male/female voice talents to dialogue for clear speaker separation.
                      </p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-xl border border-white/10 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-400 text-emerald-950 font-black text-xs flex items-center justify-center shrink-0">3</span>
                        <h4 className="text-xs font-bold text-white">Audition & Preview</h4>
                      </div>
                      <p className="text-[11px] text-indigo-200 pl-7">
                        Click <strong className="text-white">Audition Line</strong> on any character card to hear live voice samples.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Voice Filters & Roster Management Bar */}
                <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-zinc-700">Filter Voice Options:</span>
                      <div className="flex items-center gap-1.5 bg-white border border-zinc-200 p-1 rounded-xl">
                        <button
                          onClick={() => setVoiceGenderFilter('all')}
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                            voiceGenderFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-zinc-600 hover:text-zinc-900'
                          }`}
                        >
                          All ({elevenLabsVoices.length} Voices)
                        </button>
                        <button
                          onClick={() => setVoiceGenderFilter('male')}
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                            voiceGenderFilter === 'male' ? 'bg-indigo-600 text-white' : 'text-zinc-600 hover:text-zinc-900'
                          }`}
                        >
                          Male
                        </button>
                        <button
                          onClick={() => setVoiceGenderFilter('female')}
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                            voiceGenderFilter === 'female' ? 'bg-indigo-600 text-white' : 'text-zinc-600 hover:text-zinc-900'
                          }`}
                        >
                          Female
                        </button>
                      </div>

                      <button
                        onClick={handleAutoMatchVoices}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        title="Automatically assign matching male and female voices across the entire manuscript character roster"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                        <span>⚡ Auto-Match Voices by Gender</span>
                      </button>

                      <button
                        onClick={handleAddCharacterToRoster}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Add Character to Cast</span>
                      </button>
                    </div>

                    <div className="text-xs text-zinc-500 font-medium flex items-center gap-2">
                      <span>Engine: <strong className="text-indigo-700 uppercase">{speechEnginePreference}</strong></span>
                      <span>•</span>
                      <span className="text-emerald-700 font-bold">{elevenLabsApiKey ? '30+ Studio Voices Active' : 'Browser Fallback'}</span>
                    </div>
                  </div>

                  {/* Inline Quick Add Custom ElevenLabs Voice ID */}
                  <div className="pt-2 border-t border-zinc-200/80 flex flex-col sm:flex-row items-center gap-2">
                    <span className="text-[11px] font-bold text-zinc-600 shrink-0">Paste Any ElevenLabs Voice ID:</span>
                    <input
                      type="text"
                      placeholder="Paste ElevenLabs Voice ID (e.g. 21m00Tcm4TlvDq8ikWAM)"
                      value={customVoiceInput}
                      onChange={(e) => setCustomVoiceInput(e.target.value)}
                      className="w-full sm:w-72 bg-white px-3 py-1 border border-zinc-300 rounded-lg text-xs font-mono text-zinc-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        if (customVoiceInput.trim()) {
                          handleAddCustomVoiceId(customVoiceInput);
                          setCustomVoiceInput('');
                        }
                      }}
                      disabled={!customVoiceInput.trim()}
                      className="bg-zinc-800 hover:bg-black disabled:opacity-40 text-white text-xs font-bold px-3 py-1 rounded-lg shrink-0 cursor-pointer transition-colors"
                    >
                      + Add Voice ID
                    </button>
                  </div>
                </div>

                {/* Character Cast Roster Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {conversionData.character_roster.map((char) => {
                    const isNarrator = char.character_id === 'narrator' || char.name.toLowerCase().includes('narrator');
                    const assignedVoice = elevenLabsVoices.find(v => v.voice_id === char.assigned_voice_id) || elevenLabsVoices[0];
                    const isAuditioning = playingSegmentId === `audition-${char.character_id}`;

                    // Filter voices dropdown options
                    const femaleVoices = elevenLabsVoices.filter(v => getVoiceGender(v) === 'female');
                    const maleVoices = elevenLabsVoices.filter(v => getVoiceGender(v) === 'male');
                    const otherVoices = elevenLabsVoices.filter(v => getVoiceGender(v) === 'neutral');

                    // Find match voice for suggested match button
                    const suggestedVoice = elevenLabsVoices.find(
                      v => v.name.toLowerCase() === char.suggested_elevenlabs_voice?.toLowerCase() ||
                           v.name.toLowerCase().includes(char.suggested_elevenlabs_voice?.toLowerCase() || '')
                    );

                    const currentCharGender = (char.gender || 'male').toLowerCase();

                    return (
                      <div
                        key={char.character_id}
                        className={`p-6 rounded-2xl border transition-all space-y-4 shadow-2xs ${
                          isNarrator
                            ? 'bg-amber-50/40 border-amber-300 ring-1 ring-amber-200'
                            : 'bg-white border-zinc-200 hover:border-zinc-300'
                        }`}
                      >
                        {/* Header: Name & Interactive Gender Selector */}
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span
                                className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
                                  isNarrator
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : currentCharGender === 'female'
                                    ? 'bg-pink-100 text-pink-900 border-pink-300'
                                    : 'bg-indigo-100 text-indigo-900 border-indigo-200'
                                }`}
                              >
                                {isNarrator ? 'Primary Story Narrator' : currentCharGender === 'female' ? 'Female Character' : 'Male Character'}
                              </span>

                              {/* Interactive Gender Toggle Selector */}
                              {!isNarrator && (
                                <div className="inline-flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200">
                                  <button
                                    onClick={() => handleChangeCharacterGender(char.character_id, 'female')}
                                    className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md transition-all cursor-pointer ${
                                      currentCharGender === 'female'
                                        ? 'bg-pink-600 text-white shadow-2xs'
                                        : 'text-zinc-600 hover:text-zinc-900'
                                    }`}
                                  >
                                    Female
                                  </button>
                                  <button
                                    onClick={() => handleChangeCharacterGender(char.character_id, 'male')}
                                    className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md transition-all cursor-pointer ${
                                      currentCharGender === 'male'
                                        ? 'bg-indigo-600 text-white shadow-2xs'
                                        : 'text-zinc-600 hover:text-zinc-900'
                                    }`}
                                  >
                                    Male
                                  </button>
                                  <button
                                    onClick={() => handleChangeCharacterGender(char.character_id, 'neutral')}
                                    className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md transition-all cursor-pointer ${
                                      currentCharGender === 'neutral'
                                        ? 'bg-zinc-700 text-white shadow-2xs'
                                        : 'text-zinc-600 hover:text-zinc-900'
                                    }`}
                                  >
                                    Neutral
                                  </button>
                                </div>
                              )}
                            </div>

                            <h3 className="text-base font-extrabold text-zinc-900 flex items-center gap-2">
                              {char.name}
                              <span className="text-[11px] font-medium text-zinc-400">({char.age_group || 'adult'})</span>
                            </h3>
                          </div>

                          {/* Audition Voice Buttons */}
                          <div className="flex items-center gap-2 shrink-0">
                            <AudioWaveformEqualizer isPlaying={isAuditioning} />

                            <button
                              onClick={() => handleAuditionCharacterVoice(char.character_id, char.name, assignedVoice.voice_id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                                isAuditioning
                                  ? 'bg-red-600 text-white animate-pulse'
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                              }`}
                              title="Hear sample speech for this character voice"
                            >
                              {isAuditioning ? <Square className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white" />}
                              <span>{isAuditioning ? 'Stop' : 'Audition'}</span>
                            </button>

                            {/* Duo Test Button */}
                            {!isNarrator && conversionData.character_roster.find(c => c.character_id === 'narrator' || c.name.toLowerCase().includes('narrator')) && (
                              <button
                                onClick={() => {
                                  const narratorChar = conversionData.character_roster.find(c => c.character_id === 'narrator' || c.name.toLowerCase().includes('narrator'))!;
                                  handleAuditionDuoConversation(narratorChar, char);
                                }}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                  playingSegmentId === `duo-${conversionData.character_roster.find(c => c.character_id === 'narrator' || c.name.toLowerCase().includes('narrator'))?.character_id}-${char.character_id}`
                                    ? 'bg-purple-600 text-white animate-pulse'
                                    : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200'
                                }`}
                                title="Listen to Narrator and this character speak back-to-back to verify voice contrast"
                              >
                                <Headphones className="w-3.5 h-3.5" />
                                <span>Test Duo</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Vocal Traits & Recommended Match */}
                        <div className="bg-zinc-50 p-3.5 rounded-xl border border-zinc-100 space-y-1 text-xs text-zinc-600">
                          <p><strong className="text-zinc-800">Vocal Tone:</strong> {char.vocal_tone}</p>
                          <p><strong className="text-zinc-800">Accent:</strong> {char.recommended_accent}</p>
                          
                          <div className="flex items-center justify-between pt-1 border-t border-zinc-200/60 mt-1">
                            <span className="text-zinc-800 font-semibold">AI Suggested Voice: <strong className="text-indigo-700">{char.suggested_elevenlabs_voice}</strong></span>
                            {suggestedVoice && char.assigned_voice_id !== suggestedVoice.voice_id && (
                              <button
                                onClick={() => handleAssignVoice(char.character_id, suggestedVoice.voice_id)}
                                className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer uppercase"
                              >
                                Use Suggested
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Voice Dropdown & Visual Picker Trigger */}
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">
                              Assigned Voiceover Talent ({elevenLabsVoices.length} Available):
                            </label>

                            <button
                              onClick={() => {
                                setSelectedCharacterForCasting(char);
                                setVoiceSearchQuery('');
                                setVoiceGenderFilter('all');
                                setVoiceAccentFilter('all');
                              }}
                              className="text-[11px] font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200/80 transition-colors"
                            >
                              <Mic className="w-3 h-3 text-indigo-600" />
                              Browse 30+ Voices Gallery
                            </button>
                          </div>

                          {/* Currently Casted Voice Banner */}
                          <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs text-white shrink-0 shadow-2xs ${
                                getVoiceGender(assignedVoice) === 'female' ? 'bg-pink-500' : 'bg-indigo-600'
                              }`}>
                                {assignedVoice.name.charAt(0)}
                              </div>
                              <div>
                                <h4 className="text-xs font-extrabold text-zinc-900 flex items-center gap-1.5">
                                  {assignedVoice.name}
                                  <span className="text-[9px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.2 rounded border border-indigo-200">
                                    {assignedVoice.labels?.accent || 'American'}
                                  </span>
                                </h4>
                                <p className="text-[11px] text-zinc-600 line-clamp-1 font-sans">
                                  {assignedVoice.description}
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={() => handleAuditionCharacterVoice(char.character_id, char.name, assignedVoice.voice_id)}
                              className={`p-2 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                                isAuditioning ? 'bg-red-600 text-white animate-pulse' : 'bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200'
                              }`}
                              title="Test current assigned voice"
                            >
                              {isAuditioning ? <Square className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-zinc-700" />}
                            </button>
                          </div>

                          <select
                            value={char.assigned_voice_id || assignedVoice.voice_id}
                            onChange={(e) => handleAssignVoice(char.character_id, e.target.value)}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs font-bold text-zinc-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer shadow-2xs"
                          >
                            <optgroup label={`Female Voices (${femaleVoices.length})`}>
                              {femaleVoices.map(v => (
                                <option key={v.voice_id} value={v.voice_id}>
                                  {v.name} ({v.category} • Female {v.labels?.accent ? `• ${v.labels.accent}` : ''})
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label={`Male Voices (${maleVoices.length})`}>
                              {maleVoices.map(v => (
                                <option key={v.voice_id} value={v.voice_id}>
                                  {v.name} ({v.category} • Male {v.labels?.accent ? `• ${v.labels.accent}` : ''})
                                </option>
                              ))}
                            </optgroup>
                            {otherVoices.length > 0 && (
                              <optgroup label={`Custom & Other Voices (${otherVoices.length})`}>
                                {otherVoices.map(v => (
                                  <option key={v.voice_id} value={v.voice_id}>
                                    {v.name} ({v.voice_id})
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Call-to-action */}
                <div className="bg-indigo-50 border border-indigo-200 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-extrabold text-indigo-950 flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600" /> All Voice Artists Casted & Ready
                    </h4>
                    <p className="text-xs text-indigo-800">
                      Ready to review character lines, pauses, and speech delivery in the interactive script editor?
                    </p>
                  </div>

                  <button
                    onClick={() => setStudioSubTab('script')}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
                  >
                    Proceed to Interactive Script Editor →
                  </button>
                </div>
              </div>
            )}

            {/* SUBTAB 3: Pronunciation Lexicon */}
            {studioSubTab === 'lexicon' && (
              <div className="space-y-6">
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-950">
                        SSML Phonetic Dictionary & Lexicon ({conversionData.pronunciation_lexicon.length} Terms)
                      </h4>
                      <p className="text-xs text-emerald-800">
                        Ensures consistent ElevenLabs pronunciation across fantasy names, fictional locations, and complex technical terminology.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Add New Lexicon Term */}
                <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200 space-y-3">
                  <h4 className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-emerald-600" /> Add Custom Pronunciation Entry
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Term (e.g. Eldoria)"
                      value={newLexTerm}
                      onChange={(e) => setNewLexTerm(e.target.value)}
                      className="bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Phonetic (e.g. el-DOR-ee-uh)"
                      value={newLexPhonetic}
                      onChange={(e) => setNewLexPhonetic(e.target.value)}
                      className="bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Notes / Explanation"
                      value={newLexNotes}
                      onChange={(e) => setNewLexNotes(e.target.value)}
                      className="bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                  <button
                    onClick={handleAddLexiconTerm}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Add Entry
                  </button>
                </div>

                {/* Lexicon Items Table */}
                <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-100 border-b border-zinc-200 text-zinc-700 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Term</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Phonetic Spelling</th>
                        <th className="p-3">SSML Tag</th>
                        <th className="p-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {conversionData.pronunciation_lexicon.map((item, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50">
                          <td className="p-3 font-bold text-zinc-900">{item.term}</td>
                          <td className="p-3">
                            <span className="bg-zinc-100 px-2 py-0.5 rounded font-mono text-[10px] font-semibold text-zinc-700">
                              {item.category}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-emerald-700">{item.phonetic_spelling}</td>
                          <td className="p-3 font-mono text-[11px] text-zinc-600">{item.ssml_phoneme}</td>
                          <td className="p-3 text-zinc-500">{item.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUBTAB 4: Ambient Soundscapes */}
            {studioSubTab === 'soundscapes' && (
              <div className="space-y-6">
                <div className="bg-pink-50 border border-pink-200 p-4 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Music className="w-6 h-6 text-pink-600 shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-pink-950">
                        Atmospheric Scene Soundscapes & Music ({conversionData.background_soundscapes.length} Scenes)
                      </h4>
                      <p className="text-xs text-pink-800">
                        Recommended ambient music and sound effects to layer behind ElevenLabs narration during audio mastering.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {conversionData.background_soundscapes.map((sc, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs space-y-3">
                      <span className="text-[10px] font-bold text-pink-700 bg-pink-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        {sc.scene_marker}
                      </span>
                      <h3 className="text-sm font-bold text-zinc-900 mt-2">
                        {sc.ambient_description}
                      </h3>
                      <p className="text-xs text-zinc-600">
                        <strong className="text-zinc-800">Suggested Genre:</strong> {sc.suggested_music_genre}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap pt-2">
                        {sc.sound_effects.map((fx, i) => (
                          <span key={i} className="bg-zinc-100 border border-zinc-200 px-2.5 py-1 rounded-lg text-[11px] font-medium text-zinc-700">
                            🔊 {fx}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SUBTAB 5: Speech Engine & Voice Settings */}
            {studioSubTab === 'settings' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-zinc-900 text-white p-6 rounded-2xl shadow-sm space-y-2">
                  <h3 className="text-base font-extrabold flex items-center gap-2">
                    <SlidersHorizontal className="w-5 h-5 text-purple-300" /> Speech Engine & Voice Synthesis Settings
                  </h3>
                  <p className="text-xs text-indigo-200 leading-relaxed max-w-2xl">
                    Configure ElevenLabs model options, explicit language target codes, voice stability sliders, or select native browser voice models for auditioning.
                  </p>
                </div>

                {/* Section 1: Engine & Primary Language Selection */}
                <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-2xs space-y-5">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">
                    Active Speech Engine & Target Language / Accent
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-zinc-800 mb-2">
                        Speech Synthesis Engine
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setSpeechEnginePreference('elevenlabs')}
                          className={`p-3.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center gap-2.5 cursor-pointer ${
                            speechEnginePreference === 'elevenlabs'
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-950 ring-2 ring-indigo-200 shadow-2xs'
                              : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                          }`}
                        >
                          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" /> ElevenLabs Cloud AI
                        </button>
                        <button
                          type="button"
                          onClick={() => setSpeechEnginePreference('browser')}
                          className={`p-3.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center gap-2.5 cursor-pointer ${
                            speechEnginePreference === 'browser'
                              ? 'bg-purple-50 border-purple-500 text-purple-950 ring-2 ring-purple-200 shadow-2xs'
                              : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                          }`}
                        >
                          <Volume2 className="w-4 h-4 text-purple-600 shrink-0" /> Browser Speech Engine
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-800 mb-2">
                        Target Language / Accent Code
                      </label>
                      <select
                        value={ttsLanguage}
                        onChange={(e) => setTtsLanguage(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-zinc-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                      >
                        <option value="en-US">🇺🇸 English (American Accent - en-US)</option>
                        <option value="en-GB">🇬🇧 English (British Accent - en-GB)</option>
                        <option value="en-AU">🇦🇺 English (Australian Accent - en-AU)</option>
                        <option value="no-NO">🇳🇴 Norwegian (Norsk - no-NO)</option>
                        <option value="de-DE">🇩🇪 German (Deutsch - de-DE)</option>
                        <option value="fr-FR">🇫🇷 French (Français - fr-FR)</option>
                        <option value="es-ES">🇪🇸 Spanish (Español - es-ES)</option>
                      </select>
                      <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">
                        Setting language explicitly prevents browser OS language mismatches (e.g. Norwegian system voice pronouncing English).
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 2: ElevenLabs Fine-Tuning */}
                <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-2xs space-y-5">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> ElevenLabs AI Voice Model & Fine-Tuning
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-zinc-800 mb-2">
                        ElevenLabs Model
                      </label>
                      <select
                        value={elevenLabsModel}
                        onChange={(e) => setElevenLabsModel(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-zinc-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                      >
                        <option value="eleven_multilingual_v2">eleven_multilingual_v2 (Recommended High Quality)</option>
                        <option value="eleven_monolingual_v1">eleven_monolingual_v1 (Classic English Narrator)</option>
                        <option value="eleven_turbo_v2_5">eleven_turbo_v2_5 (High Speed Multilingual)</option>
                        <option value="eleven_flash_v2_5">eleven_flash_v2_5 (Ultra Low Latency)</option>
                      </select>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-zinc-800">Stability: {stability.toFixed(2)}</label>
                          <span className="text-[10px] text-zinc-400">Higher = Consistent, Lower = Expressive</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={stability}
                          onChange={(e) => setStability(parseFloat(e.target.value))}
                          className="w-full accent-indigo-600"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-zinc-800">Clarity / Similarity Boost: {similarityBoost.toFixed(2)}</label>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={similarityBoost}
                          onChange={(e) => setSimilarityBoost(parseFloat(e.target.value))}
                          className="w-full accent-indigo-600"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Browser Native System Voice Selection */}
                <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-2xs space-y-5">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4" /> Browser Native System Voice Fallback Selection
                  </h4>

                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-zinc-800">
                      Detected System Voices ({browserVoices.length} available)
                    </label>
                    <select
                      value={selectedBrowserVoiceURI}
                      onChange={(e) => setSelectedBrowserVoiceURI(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-zinc-800 focus:ring-2 focus:ring-purple-500 focus:outline-none cursor-pointer"
                    >
                      <option value="">Auto-select matching voice ({ttsLanguage})</option>
                      {browserVoices.map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {v.name} ({v.lang}) {v.default ? ' [Default OS Voice]' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Select an explicit voice like "Google US English", "Samantha", or "Daniel" to guarantee crisp English pronunciation when offline or using browser speech synthesis.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB 5: Export & ElevenLabs Tools */}
            {studioSubTab === 'export' && (
              <div className="space-y-6">
                <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl space-y-2">
                  <h4 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                    <Download className="w-4 h-4 text-amber-700" /> Export Options for Audio Production
                  </h4>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Download complete production packages formatted for ElevenLabs Projects API, voice actors, and audio editing workstations (DAWs).
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <button
                    onClick={() => {
                      const jsonStr = JSON.stringify(conversionData, null, 2);
                      const blob = new Blob([jsonStr], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${activeChapter.title}_ElevenLabs_Script.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="p-6 bg-white rounded-2xl border border-zinc-200 hover:border-indigo-400 hover:shadow-md transition-all text-left space-y-3 cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Download className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-zinc-900">ElevenLabs JSON Script</h4>
                    <p className="text-xs text-zinc-500">
                      Full structured JSON object with character voice assignments, pause timing, and sanitized text.
                    </p>
                  </button>

                  <button
                    onClick={() => {
                      let ssml = `<speak>\n`;
                      conversionData.audiobook_script.forEach(seg => {
                        ssml += `  <!-- Speaker: ${seg.speaker_name} (${seg.delivery_emotion}) -->\n`;
                        ssml += `  <p>${seg.ssml_text || seg.clean_spoken_text}</p>\n`;
                        if (seg.pause_after_ms > 0) {
                          ssml += `  <break time="${seg.pause_after_ms}ms"/>\n`;
                        }
                      });
                      ssml += `</speak>`;

                      const blob = new Blob([ssml], { type: 'application/xml' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${activeChapter.title}_SSML.xml`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="p-6 bg-white rounded-2xl border border-zinc-200 hover:border-purple-400 hover:shadow-md transition-all text-left space-y-3 cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                      <FileText className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-zinc-900">ElevenLabs SSML (.xml)</h4>
                    <p className="text-xs text-zinc-500">
                      Standard SSML document with break tags, phonetic pronunciations, and emotion cues.
                    </p>
                  </button>

                  <button
                    onClick={() => {
                      let md = `# AUDIOBOOK DIRECTOR SCRIPT: ${activeChapter.title}\n\n`;
                      md += `**Book Title:** ${bookDetails.title || 'Untitled'}\n`;
                      md += `**Author:** ${bookDetails.authorName || 'Author'}\n\n`;
                      md += `## CHARACTER VOICE ROSTER\n`;
                      conversionData.character_roster.forEach(c => {
                        md += `- **${c.name}** (${c.gender}, ${c.age_group}): ${c.vocal_tone} • Accent: ${c.recommended_accent}\n`;
                      });
                      md += `\n## MANUSCRIPT NARRATION SCRIPT\n\n`;
                      conversionData.audiobook_script.forEach(s => {
                        md += `**[${s.speaker_name.toUpperCase()}]** *(${s.delivery_emotion}, ${s.speaking_rate}x)*\n`;
                        md += `"${s.clean_spoken_text}"\n`;
                        md += `*[pause ${s.pause_after_ms}ms]*\n\n`;
                      });

                      const blob = new Blob([md], { type: 'text/markdown' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${activeChapter.title}_Voice_Director_Script.md`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="p-6 bg-white rounded-2xl border border-zinc-200 hover:border-emerald-400 hover:shadow-md transition-all text-left space-y-3 cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-zinc-900">Voice Director Script (.md)</h4>
                    <p className="text-xs text-zinc-500">
                      Human-readable director script formatted for live voice actor recording sessions.
                    </p>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-3xl border border-dashed border-zinc-300 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-600 shadow-xs">
            <Headphones className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-extrabold text-zinc-900">
              No Audiobook Script Converted Yet
            </h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
              Select a chapter above and click <strong className="text-indigo-600 font-bold">"Convert Chapter to Audiobook Script"</strong> to automatically sanitize text, isolate character dialogue, build a voice roster, and generate millisecond pause annotations for ElevenLabs TTS.
            </p>
          </div>
          <button
            onClick={handleConvertChapter}
            disabled={isGenerating || !activeChapter}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-3 rounded-xl text-xs transition-colors cursor-pointer shadow-md"
          >
            <Sparkles className="w-4 h-4 text-indigo-200" /> Start AI Conversion
          </button>
        </div>
      )}
      {/* VOICE TALENT CASTING GALLERY MODAL */}
      {selectedCharacterForCasting && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-zinc-200 my-8">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-5">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 text-[10px] font-extrabold uppercase tracking-wider border border-indigo-200">
                  <Mic className="w-3 h-3 text-indigo-600" /> Voice Talent Audition Gallery
                </span>
                <h3 className="text-xl font-black text-zinc-900 flex items-center gap-2">
                  Cast Voice for: <span className="text-indigo-600">{selectedCharacterForCasting.name}</span>
                </h3>
                <p className="text-xs text-zinc-600">
                  {selectedCharacterForCasting.gender} • {selectedCharacterForCasting.age_group} • Tone: <strong className="text-zinc-800">{selectedCharacterForCasting.vocal_tone}</strong> • Preferred Accent: <strong className="text-zinc-800">{selectedCharacterForCasting.recommended_accent}</strong>
                </p>
              </div>

              <button
                onClick={() => setSelectedCharacterForCasting(null)}
                className="p-2 text-zinc-400 hover:text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-full transition-colors cursor-pointer"
                title="Close Voice Gallery"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* AI Recommendation Quick Action */}
            {selectedCharacterForCasting.suggested_elevenlabs_voice && (
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-2xl border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                    AI
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-indigo-950">
                      Recommended AI Match: <span className="text-indigo-700 underline">{selectedCharacterForCasting.suggested_elevenlabs_voice}</span>
                    </h4>
                    <p className="text-[11px] text-indigo-800">
                      Matches this character's emotion, gender, and accent traits.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const suggested = elevenLabsVoices.find(v => v.name.toLowerCase() === selectedCharacterForCasting.suggested_elevenlabs_voice?.toLowerCase() || v.name.toLowerCase().includes(selectedCharacterForCasting.suggested_elevenlabs_voice?.toLowerCase() || ''));
                    if (suggested) {
                      handleAssignVoice(selectedCharacterForCasting.character_id, suggested.voice_id);
                      setSelectedCharacterForCasting(null);
                      setTtsNotice({ type: 'success', message: `Casted ${suggested.name} as ${selectedCharacterForCasting.name}!` });
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
                >
                  ✓ Use Recommended Match
                </button>
              </div>
            )}

            {/* Search & Filter Toolbar */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={voiceSearchQuery}
                    onChange={(e) => setVoiceSearchQuery(e.target.value)}
                    placeholder="Search 30+ voices by name (e.g. Rachel, George), accent (British, American)..."
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {voiceSearchQuery && (
                    <button
                      onClick={() => setVoiceSearchQuery('')}
                      className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 text-xs font-bold cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Custom Voice ID Direct Input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customVoiceInput}
                    onChange={(e) => setCustomVoiceInput(e.target.value)}
                    placeholder="Custom Voice ID..."
                    className="w-44 px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => {
                      if (customVoiceInput.trim()) {
                        handleAssignVoice(selectedCharacterForCasting.character_id, customVoiceInput.trim());
                        setSelectedCharacterForCasting(null);
                        setCustomVoiceInput('');
                        setTtsNotice({ type: 'success', message: `Assigned custom Voice ID to ${selectedCharacterForCasting.name}` });
                      }
                    }}
                    className="px-3 py-2.5 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl shrink-0 cursor-pointer"
                  >
                    Set ID
                  </button>
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-zinc-500 mr-1 flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5 text-zinc-400" /> Filter:
                  </span>

                  {(['all', 'male', 'female'] as const).map(g => (
                    <button
                      key={g}
                      onClick={() => setVoiceGenderFilter(g)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-colors cursor-pointer ${
                        voiceGenderFilter === g ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      {g === 'all' ? 'All Genders' : g}
                    </button>
                  ))}

                  <div className="h-4 w-px bg-zinc-200 mx-1" />

                  {[
                    { id: 'all', label: 'All Accents' },
                    { id: 'american', label: '🇺🇸 American' },
                    { id: 'british', label: '🇬🇧 British' },
                    { id: 'irish', label: '🇮🇪 Irish' },
                    { id: 'australian', label: '🇦🇺 Australian' }
                  ].map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => setVoiceAccentFilter(acc.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        voiceAccentFilter === acc.id ? 'bg-purple-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      {acc.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Audition Line Bar */}
              <div className="bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100 flex items-center gap-2">
                <Mic className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-1" />
                <span className="text-[11px] font-extrabold text-indigo-900 shrink-0">Custom Audition Line:</span>
                <input
                  type="text"
                  value={customAuditionText}
                  onChange={(e) => setCustomAuditionText(e.target.value)}
                  placeholder="Type any custom sentence to test voices (e.g. 'The dark tower stood tall against the stormy sky...')"
                  className="w-full bg-white px-3 py-1 border border-indigo-200 rounded-lg text-xs font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {customAuditionText && (
                  <button
                    onClick={() => setCustomAuditionText('')}
                    className="text-[10px] font-bold text-zinc-500 hover:text-zinc-800 px-2 cursor-pointer shrink-0"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Voice Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto pr-1">
              {elevenLabsVoices
                .filter(v => {
                  if (voiceGenderFilter === 'male') {
                    if (getVoiceGender(v) !== 'male') return false;
                  }
                  if (voiceGenderFilter === 'female') {
                    if (getVoiceGender(v) !== 'female') return false;
                  }
                  if (voiceAccentFilter !== 'all') {
                    const acc = (v.labels?.accent || '').toLowerCase();
                    const desc = (v.description || '').toLowerCase();
                    if (!acc.includes(voiceAccentFilter) && !desc.includes(voiceAccentFilter)) return false;
                  }
                  if (voiceSearchQuery.trim()) {
                    const q = voiceSearchQuery.toLowerCase().trim();
                    const nameMatch = v.name.toLowerCase().includes(q);
                    const descMatch = (v.description || '').toLowerCase().includes(q);
                    const labelMatch = Object.values(v.labels || {}).some(val => val.toLowerCase().includes(q));
                    if (!nameMatch && !descMatch && !labelMatch) return false;
                  }
                  return true;
                })
                .map((v) => {
                  const isAssigned = selectedCharacterForCasting.assigned_voice_id === v.voice_id;
                  const isAuditioning = playingSegmentId === `audition-${selectedCharacterForCasting.character_id}`;
                  const isFemale = getVoiceGender(v) === 'female';

                  return (
                    <div
                      key={v.voice_id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                        isAssigned
                          ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-500/30'
                          : 'bg-zinc-50/50 hover:bg-white border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0 shadow-xs ${
                              isFemale ? 'bg-pink-500' : 'bg-indigo-600'
                            }`}>
                              {v.name.charAt(0)}
                            </div>
                            <div>
                              <h4 className="text-sm font-extrabold text-zinc-900 flex items-center gap-1.5">
                                {v.name}
                                {isAssigned && (
                                  <span className="text-[10px] bg-indigo-600 text-white font-extrabold px-2 py-0.5 rounded-full">
                                    Currently Casted
                                  </span>
                                )}
                              </h4>
                              <p className="text-[10px] text-zinc-500 font-medium">
                                {v.category} • {v.labels?.gender || (isFemale ? 'female' : 'male')} {v.labels?.accent ? `• ${v.labels.accent}` : ''}
                              </p>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-zinc-600 leading-relaxed font-sans line-clamp-2">
                          {v.description}
                        </p>
                      </div>

                      {/* Card Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t border-zinc-200/60">
                        <AudioWaveformEqualizer isPlaying={isAuditioning} />

                        <button
                          onClick={() => handleAuditionCharacterVoice(selectedCharacterForCasting.character_id, selectedCharacterForCasting.name, v.voice_id, customAuditionText)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            isAuditioning
                              ? 'bg-red-600 text-white animate-pulse'
                              : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-800'
                          }`}
                        >
                          {isAuditioning ? <Square className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-zinc-700" />}
                          <span>{isAuditioning ? 'Stop' : 'Test Voice'}</span>
                        </button>

                        <button
                          onClick={() => {
                            handleAssignVoice(selectedCharacterForCasting.character_id, v.voice_id);
                            setSelectedCharacterForCasting(null);
                            setTtsNotice({
                              type: 'success',
                              message: `Successfully casted ${v.name} for ${selectedCharacterForCasting.name}!`
                            });
                          }}
                          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-xs ${
                            isAssigned
                              ? 'bg-emerald-600 text-white cursor-default'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          }`}
                        >
                          {isAssigned ? '✓ Selected' : `✓ Cast as ${selectedCharacterForCasting.name}`}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-zinc-200">
              <span className="text-xs text-zinc-500 font-medium">
                {elevenLabsVoices.length} voice models available in library
              </span>
              <button
                onClick={() => setSelectedCharacterForCasting(null)}
                className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close Gallery
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUDIOBOOK SPOKEN EDITION REWRITE MODAL */}
      {showRewriteModal && audioRewriteResult && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-zinc-200">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-indigo-950 via-purple-950 to-zinc-900 text-white flex items-center justify-between">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold uppercase tracking-wider border border-emerald-400/30">
                  <Sparkles className="w-3 h-3 text-emerald-400" /> Audiobook Spoken Edition Adaptation
                </div>
                <h3 className="text-xl font-extrabold text-white">
                  Audiobook Spoken Prose Optimization
                </h3>
                <p className="text-xs text-indigo-200">
                  Transformed print manuscript for natural oral rhythm, dialogue flow, and effortless AI narration.
                </p>
              </div>
              <button
                onClick={() => setShowRewriteModal(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Pills of Audio Changes */}
            {audioRewriteResult.summary_of_changes && audioRewriteResult.summary_of_changes.length > 0 && (
              <div className="bg-indigo-50/70 p-4 border-b border-indigo-100 space-y-2">
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Audio-First Enhancements Applied:
                </span>
                <div className="flex flex-wrap gap-2">
                  {audioRewriteResult.summary_of_changes.map((change, i) => (
                    <div key={i} className="text-xs bg-white text-indigo-950 font-semibold px-3 py-1 rounded-xl border border-indigo-200 shadow-2xs flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-indigo-600 shrink-0" />
                      <span>{change}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Side by Side Comparison */}
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                <span className="text-xs font-extrabold text-zinc-800 uppercase tracking-wider">
                  Manuscript Comparison: Print vs. Spoken Audio Edition
                </span>
                <button
                  onClick={() => triggerCopy(audioRewriteResult.adapted_content, 'Spoken Edition Copied!')}
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{copiedNotice === 'Spoken Edition Copied!' ? 'Copied!' : 'Copy Spoken Text'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original Print Manuscript */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-500 uppercase tracking-wider px-1">
                    <span>📖 Original Print Manuscript</span>
                    <span>{activeChapter?.content.split(/\s+/).filter(Boolean).length} words</span>
                  </div>
                  <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 text-xs leading-relaxed text-zinc-700 max-h-[380px] overflow-y-auto whitespace-pre-wrap font-serif">
                    {activeChapter?.content}
                  </div>
                </div>

                {/* Audiobook Spoken Edition */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-600 uppercase tracking-wider px-1">
                    <span className="flex items-center gap-1">✨ Audiobook Spoken Edition</span>
                    <span>{audioRewriteResult.adapted_content.split(/\s+/).filter(Boolean).length} words</span>
                  </div>
                  <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-200 text-xs leading-relaxed text-zinc-900 max-h-[380px] overflow-y-auto whitespace-pre-wrap font-sans font-medium">
                    {audioRewriteResult.adapted_content}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-5 bg-zinc-50 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-zinc-500 italic">
                Applying will update your chapter text & re-generate the multi-voice narration script automatically.
              </span>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => setShowRewriteModal(false)}
                  className="px-4 py-2.5 bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-700 text-xs font-bold rounded-xl transition-colors w-full sm:w-auto cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyAdaptedText}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 w-full sm:w-auto cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-emerald-200" />
                  <span>Apply Audio Edition & Regenerate Script</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
