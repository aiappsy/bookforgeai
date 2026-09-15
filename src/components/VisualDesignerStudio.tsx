import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Palette, 
  Users, 
  Layers, 
  Image as ImageIcon, 
  Download, 
  Check, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Lock, 
  Unlock, 
  BookOpen, 
  Compass, 
  FileText, 
  ArrowRight, 
  Maximize2, 
  X, 
  SlidersHorizontal,
  ChevronDown,
  Info,
  CheckCircle2,
  FileDown
} from 'lucide-react';
import { 
  CharacterProfile, 
  ExtractedScene, 
  ChapterIllustration,
  extractCharacterProfilesFromManuscript,
  extractChapterScenesAndMoments,
  generateSceneIllustrationWithNanoBanana
} from '../services/geminiService';

interface ChapterItem {
  id: string;
  title: string;
  content: string;
  status: 'idle' | 'generating' | 'done';
}

interface VisualDesignerStudioProps {
  chapters: ChapterItem[];
  activeChapterId?: string;
  bookTitle?: string;
  bookCategory?: string;
  customApiKey?: string;
  characterBible: CharacterProfile[];
  chapterIllustrations: ChapterIllustration[];
  onUpdateCharacterBible: (characters: CharacterProfile[]) => void;
  onUpdateIllustrations: (illustrations: ChapterIllustration[]) => void;
  onInsertIllustrationIntoChapter: (chapterId: string, markdownSnippet: string) => void;
  onNavigateToChapter?: (chapterId: string) => void;
}

export const CATEGORY_ART_STYLES: Record<string, { id: string; name: string; desc: string }[]> = {
  guides: [
    { id: 'tech_saas_vector', name: "Modern Tech & SaaS Vector", desc: "Crisp UI components, modern indigo/cyan gradients, sleek vector lines (Linear/Stripe aesthetic)." },
    { id: 'system_blueprint', name: "Clean Architecture Blueprint & System Diagram", desc: "Precision geometric lines, labeled components, technical schematic layout." },
    { id: 'isometric_3d_tech', name: "Isometric 3D Technology & Cloud Infrastructure", desc: "Volumetric servers, cloud infrastructure blocks, modular SaaS architecture." },
    { id: 'minimalist_diagram', name: "Minimalist Line-Art & Workflow Flowchart", desc: "High-contrast clean outlines, node-and-connector visual clarity, elegant monochrome." },
    { id: 'developer_workspace', name: "Modern Developer Studio & Workspace", desc: "Clean studio workspace, multiple glowing code monitors, focused engineering aesthetic." },
    { id: 'editorial_infographic', name: "Technical Infographic & Data Visualization", desc: "Structured data blocks, comparison matrices, clean modern typography accents." }
  ],
  white_paper: [
    { id: 'corporate_infographic', name: "Institutional Research & Enterprise Infographic", desc: "Gartner/McKinsey-grade structured diagrams, executive data presentation." },
    { id: 'system_blueprint', name: "Enterprise Architecture Blueprint", desc: "Precision geometric lines, labeled components, technical schematic layout." },
    { id: 'tech_saas_vector', name: "Modern Tech & SaaS Vector", desc: "Crisp UI elements, modern indigo/cyan gradients, sleek vector lines." },
    { id: 'minimalist_diagram', name: "Minimalist Executive Flowchart", desc: "High-contrast clean outlines, elegant monochrome." }
  ],
  non_fiction: [
    { id: 'editorial_thought_leadership', name: "Editorial Thought Leadership (NYT / Economist)", desc: "Conceptual visual metaphors, sophisticated editorial color palette, smart conceptual depth." },
    { id: 'business_vector', name: "Modern Business & Strategy Vector", desc: "Clean geometric figures, growth arrows, organizational frameworks." },
    { id: 'studio_portrait', name: "Modern Studio Photography & Workspace", desc: "Cinematic depth of field, warm ambient lighting, realistic workshop or office setting." },
    { id: 'minimalist_zen', name: "Minimalist Geometric & Zen Line Art", desc: "Subtle organic forms, mindfulness and habit growth metaphors." }
  ],
  fiction: [
    { id: 'cinematic_concept_art', name: "Cinematic Concept Art & Matte Painting", desc: "Dramatic lighting, epic depth, atmospheric realism, motion-picture scale." },
    { id: 'graphic_novel_noir', name: "Graphic Novel Noir & Heavy Ink", desc: "High-contrast shadows, bold inks, expressive line work, graphic storytelling." },
    { id: 'epic_fantasy_digital', name: "Lush Fantasy & Sci-Fi Digital Art", desc: "Vibrant magical lighting, intricate world-building, rich environmental textures." },
    { id: 'classic_pen_ink', name: "Classic Pen & Ink Etching (Victorian)", desc: "Fine cross-hatching, vintage storybook engraving, timeless literary style." }
  ],
  children_stories: [
    { id: 'whimsical_watercolor', name: "Whimsical Storybook (Watercolor & Ink)", desc: "Soft gentle washes, delicate ink outlines, classic Beatrix Potter and Oliver Jeffers aesthetic." },
    { id: 'pixar_3d_animation', name: "Modern 3D Digital Animation (Pixar/Disney)", desc: "Vibrant expressive characters, volumetric lighting, rich 3D textures, and cinematic depth." },
    { id: 'coloring_book_bold', name: "Children's Coloring Book (Clean Bold Line Art)", desc: "Crisp black line art with thick outlines and open white spaces, ideal for print coloring activities." },
    { id: 'classic_pen_ink', name: "Classic Pen & Ink Storybook (Black & White)", desc: "Intricate cross-hatching, fine line weight, vintage fairy tale engravings and Victorian woodcuts." },
    { id: 'pastel_crayon', name: "Soft Pastel & Wax Crayon Bedtime", desc: "Warm comforting crayon textures, gentle dreamlike hues, tactile bedtime story charm." },
    { id: 'gouache_colored_pencil', name: "Lush Gouache & Colored Pencil", desc: "Rich opaque matte tones, textured pencil strokes, vibrant folk-art storybook illustration." },
    { id: 'papercut_claymation', name: "Papercut & Clay Craft 3D", desc: "Layered craft paper silhouettes, tactile claymation depth, charming handmade feel." },
    { id: 'ghibli_anime', name: "Studio Ghibli Inspired Pastoral Anime", desc: "Lush hand-painted cloudscapes, whimsical creatures, peaceful nature tones." }
  ]
};

export function getArtStylesForCategory(category?: string) {
  if (!category) return CATEGORY_ART_STYLES.guides;
  if (category === 'guides' || category === 'sales_copy' || category === 'web_copy') return CATEGORY_ART_STYLES.guides;
  if (category === 'white_paper') return CATEGORY_ART_STYLES.white_paper;
  if (category === 'non_fiction') return CATEGORY_ART_STYLES.non_fiction;
  if (category === 'fiction') return CATEGORY_ART_STYLES.fiction;
  return CATEGORY_ART_STYLES.children_stories;
}

export const VisualDesignerStudio: React.FC<VisualDesignerStudioProps> = ({
  chapters,
  activeChapterId,
  bookTitle = 'Untitled Manuscript',
  bookCategory = 'guides',
  customApiKey,
  characterBible,
  chapterIllustrations,
  onUpdateCharacterBible,
  onUpdateIllustrations,
  onInsertIllustrationIntoChapter,
  onNavigateToChapter
}) => {
  const isChildren = bookCategory === 'children_stories';
  const isGuides = bookCategory === 'guides' || bookCategory === 'white_paper' || bookCategory === 'sales_copy' || bookCategory === 'web_copy';
  const isNonFiction = bookCategory === 'non_fiction';
  const isFiction = bookCategory === 'fiction';
  const hasCharacters = isFiction || isChildren;

  const currentCategoryStyles = getArtStylesForCategory(bookCategory);

  const [activeTab, setActiveTab] = useState<'illustrator' | 'character_bible' | 'gallery'>('illustrator');
  const [selectedChapterId, setSelectedChapterId] = useState<string>(activeChapterId || chapters[0]?.id || '');
  
  // Scene extraction state
  const [isExtractingScenes, setIsExtractingScenes] = useState(false);
  const [extractedScenes, setExtractedScenes] = useState<ExtractedScene[]>([]);
  const [selectedScene, setSelectedScene] = useState<ExtractedScene | null>(null);

  // Generation Controls
  const [scenePrompt, setScenePrompt] = useState('');
  const [colorMode, setColorMode] = useState<'color' | 'black_and_white'>('color');
  const [selectedArtStyle, setSelectedArtStyle] = useState(currentCategoryStyles[0].name);
  const [aspectRatio, setAspectRatio] = useState<'4:3' | '1:1' | '16:9' | '3:4'>('4:3');
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  const [isGeneratingIllustration, setIsGeneratingIllustration] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [latestGeneratedImage, setLatestGeneratedImage] = useState<string | null>(null);
  const [feedbackInput, setFeedbackInput] = useState('');

  // Character Bible state
  const [isExtractingChars, setIsExtractingChars] = useState(false);
  const [editingChar, setEditingChar] = useState<CharacterProfile | null>(null);
  const [showAddCharModal, setShowAddCharModal] = useState(false);
  const [newChar, setNewChar] = useState<Partial<CharacterProfile>>({
    name: '',
    role: 'protagonist',
    speciesOrType: 'Human child (age 6)',
    physicalAppearance: '',
    clothingAndAttire: '',
    distinctiveFeatures: '',
    isLocked: true
  });

  // Modal / Preview
  const [previewImageModal, setPreviewImageModal] = useState<ChapterIllustration | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (activeChapterId) {
      setSelectedChapterId(activeChapterId);
    } else if (chapters.length > 0 && !selectedChapterId) {
      setSelectedChapterId(chapters[0].id);
    }
  }, [activeChapterId, chapters]);

  const currentChapter = chapters.find(c => c.id === selectedChapterId) || chapters[0];

  const showToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // --- CHARACTER BIBLE ACTIONS ---
  const handleAutoExtractCharacters = async () => {
    const fullManuscript = chapters.map(c => `# ${c.title}\n\n${c.content}`).join('\n\n');
    if (!fullManuscript.trim()) {
      showToast("Please write or generate chapters first before analyzing characters.");
      return;
    }
    setIsExtractingChars(true);
    try {
      const extracted = await extractCharacterProfilesFromManuscript(fullManuscript, bookCategory, customApiKey);
      if (extracted.length > 0) {
        // Merge or replace
        const existingNames = new Set(characterBible.map(c => c.name.toLowerCase()));
        const uniqueNew = extracted.filter(c => !existingNames.has(c.name.toLowerCase()));
        const merged = [...characterBible, ...uniqueNew];
        onUpdateCharacterBible(merged.length > 0 ? merged : extracted);
        showToast(`Successfully extracted ${extracted.length} character profiles into Character Bible!`);
        // Auto-select characters for active scenes
        setSelectedCharIds(merged.map(c => c.id));
      } else {
        showToast("No distinct characters detected. You can add them manually.");
      }
    } catch (e) {
      console.error(e);
      showToast("Character extraction failed. Please try again.");
    } finally {
      setIsExtractingChars(false);
    }
  };

  const handleSaveNewCharacter = () => {
    if (!newChar.name?.trim()) {
      showToast("Character Name is required.");
      return;
    }
    const anchor = newChar.lockedPromptAnchor || 
      `${newChar.name} (${newChar.speciesOrType}): ${newChar.physicalAppearance}, wearing ${newChar.clothingAndAttire}. Distinct features: ${newChar.distinctiveFeatures}`;

    const created: CharacterProfile = {
      id: 'char_' + Date.now(),
      name: newChar.name.trim(),
      role: newChar.role || 'protagonist',
      speciesOrType: newChar.speciesOrType || 'Character',
      physicalAppearance: newChar.physicalAppearance || '',
      clothingAndAttire: newChar.clothingAndAttire || '',
      distinctiveFeatures: newChar.distinctiveFeatures || '',
      lockedPromptAnchor: anchor,
      isLocked: true
    };

    onUpdateCharacterBible([...characterBible, created]);
    setShowAddCharModal(false);
    setNewChar({
      name: '',
      role: 'protagonist',
      speciesOrType: 'Human child (age 6)',
      physicalAppearance: '',
      clothingAndAttire: '',
      distinctiveFeatures: '',
      isLocked: true
    });
    showToast(`Saved ${created.name} to Character Bible.`);
  };

  const handleToggleLockCharacter = (charId: string) => {
    const updated = characterBible.map(c => c.id === charId ? { ...c, isLocked: !c.isLocked } : c);
    onUpdateCharacterBible(updated);
  };

  const handleDeleteCharacter = (charId: string) => {
    const updated = characterBible.filter(c => c.id !== charId);
    onUpdateCharacterBible(updated);
    setSelectedCharIds(prev => prev.filter(id => id !== charId));
  };

  // --- SCENE EXTRACTION ACTIONS ---
  const handleExtractScenesFromChapter = async () => {
    if (!currentChapter || !currentChapter.content || currentChapter.content.length < 30) {
      showToast("Selected chapter has no content to analyze. Write or generate the chapter first.");
      return;
    }

    setIsExtractingScenes(true);
    try {
      const scenes = await extractChapterScenesAndMoments(
        currentChapter.title,
        currentChapter.content,
        characterBible,
        bookCategory,
        customApiKey
      );
      setExtractedScenes(scenes);
      if (scenes.length > 0) {
        handleSelectScene(scenes[0]);
        showToast(`Extracted ${scenes.length} key visual scenes from "${currentChapter.title}".`);
      } else {
        showToast("No key visual scenes found. You can write your custom scene prompt below.");
      }
    } catch (e) {
      console.error(e);
      showToast("Scene analysis failed. Please try again.");
    } finally {
      setIsExtractingScenes(false);
    }
  };

  const handleSelectScene = (scene: ExtractedScene) => {
    setSelectedScene(scene);
    setScenePrompt(scene.suggestedPrompt || scene.sceneSummary);
    setColorMode(scene.colorModeRecommendation || 'color');
    if (scene.suggestedArtStyle) {
      const match = currentCategoryStyles.find(s => s.name.toLowerCase().includes(scene.suggestedArtStyle?.toLowerCase() || ''));
      if (match) setSelectedArtStyle(match.name);
    }
    // Match characters by name in bible
    if (hasCharacters && scene.characterNames && scene.characterNames.length > 0) {
      const matchedIds = characterBible
        .filter(c => scene.characterNames.some(n => c.name.toLowerCase().includes(n.toLowerCase()) || n.toLowerCase().includes(c.name.toLowerCase())))
        .map(c => c.id);
      setSelectedCharIds(matchedIds.length > 0 ? matchedIds : characterBible.map(c => c.id));
    }
  };

  // --- GENERATION ACTION ---
  const handleGenerateIllustration = async (refinementText?: string) => {
    const basePrompt = refinementText ? `${scenePrompt}. Revision: ${refinementText}` : scenePrompt;
    if (!basePrompt.trim()) {
      showToast("Please enter or select a scene prompt to draw.");
      return;
    }

    setIsGeneratingIllustration(true);
    setGenerationStep("Nano Banana analyzing visual composition...");

    try {
      const activeCharacters = hasCharacters ? characterBible.filter(c => selectedCharIds.includes(c.id)) : [];
      
      setGenerationStep(
        colorMode === 'black_and_white' 
          ? (isGuides ? "Rendering precision monochrome blueprint & diagram..." : "Rendering high-contrast Black & White ink line art...") 
          : (isGuides ? "Synthesizing modern tech vector illustration..." : "Synthesizing full-color illustration...")
      );

      const imageUrl = await generateSceneIllustrationWithNanoBanana({
        scenePrompt: basePrompt,
        chapterTitle: currentChapter?.title || 'Chapter',
        colorMode,
        artStyle: selectedArtStyle,
        aspectRatio,
        charactersInScene: activeCharacters,
        bookCategory,
        apiKey: customApiKey
      });

      if (imageUrl) {
        const newIllustration: ChapterIllustration = {
          id: 'illus_' + Date.now(),
          chapterId: selectedChapterId,
          sceneTitle: selectedScene?.title || `Visual for ${currentChapter?.title || 'Chapter'}`,
          prompt: basePrompt,
          imageUrl,
          colorMode,
          artStyle: selectedArtStyle,
          aspectRatio,
          characterNamesUsed: activeCharacters.map(c => c.name),
          createdAt: Date.now(),
          insertedInMarkdown: false
        };

        setLatestGeneratedImage(imageUrl);
        onUpdateIllustrations([newIllustration, ...chapterIllustrations]);
        showToast("Visual generated successfully!");
        setFeedbackInput('');
      } else {
        showToast("Failed to generate visual. Please try another prompt.");
      }
    } catch (e) {
      console.error(e);
      showToast("Generation error occurred. Please try again.");
    } finally {
      setIsGeneratingIllustration(false);
      setGenerationStep('');
    }
  };

  const handleInsertIntoMarkdown = (illus: ChapterIllustration, position: 'top' | 'bottom' = 'top') => {
    const markdownTag = `\n\n![Illustration: ${illus.sceneTitle}](${illus.imageUrl})\n*${illus.sceneTitle} (${illus.colorMode === 'black_and_white' ? 'Monochrome' : 'Full Color'})*\n\n`;
    onInsertIllustrationIntoChapter(illus.chapterId, markdownTag, position);
    
    const updated = chapterIllustrations.map(item => item.id === illus.id ? { ...item, insertedInMarkdown: true } : item);
    onUpdateIllustrations(updated);
    showToast(position === 'top' ? "Inserted as chapter header banner!" : "Inserted into chapter content!");
  };

  const handleCopyMarkdown = (illus: ChapterIllustration) => {
    const markdownTag = `![Illustration: ${illus.sceneTitle}](${illus.imageUrl})`;
    navigator.clipboard.writeText(markdownTag);
    showToast("Copied Markdown tag to clipboard!");
  };

  const handleDownloadImage = (illus: ChapterIllustration) => {
    const link = document.createElement('a');
    link.href = illus.imageUrl;
    link.download = `${bookTitle.replace(/\s+/g, '_')}_Ch_${illus.chapterId}_${illus.sceneTitle.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Downloaded high-resolution image!");
  };

  const handleDeleteIllustration = (id: string) => {
    const updated = chapterIllustrations.filter(item => item.id !== id);
    onUpdateIllustrations(updated);
    if (previewImageModal?.id === id) setPreviewImageModal(null);
    showToast("Illustration removed.");
  };

  const chapterIllustrationsCount = (chId: string) => {
    return chapterIllustrations.filter(i => i.chapterId === chId).length;
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 custom-scrollbar bg-zinc-50/50">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Toast Status */}
        {statusMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-zinc-700 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Header Hero Banner */}
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-indigo-900 text-white p-6 md:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-96 h-96 bg-yellow-400/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="space-y-2 relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-yellow-200 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" /> 
              {isGuides ? "Nano Banana Technical & Architectural Visuals" : isNonFiction ? "Nano Banana Editorial Designer" : isFiction ? "Nano Banana Concept Art Studio" : "Nano Banana Visual Designer & Art Studio"}
            </div>
            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight">
              {isGuides ? "Technical Diagram & Visual Studio" : isNonFiction ? "Editorial & Conceptual Visual Studio" : isFiction ? "Cinematic Story & Scene Illustrator" : "Children's Book & Storybook Illustration Engine"}
            </h1>
            <p className="text-amber-100 text-sm leading-relaxed">
              {isGuides 
                ? "Generate clean architecture blueprints, modern SaaS graphics, workflow diagrams, and technical chapter banners." 
                : isNonFiction 
                ? "Craft sophisticated thought leadership visuals, business framework diagrams, and high-impact chapter headers."
                : isFiction 
                ? "Bring your scenes to life with cinematic concept art, graphic novel frames, and character-locked illustrations." 
                : "Analyze chapter stories, extract pivotal scene moments, generate seamless color or black & white line-art illustrations, and guarantee 100% character cohesion across every page."}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative z-10 w-full md:w-auto">
            <div className="bg-black/30 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 text-center sm:text-left">
              <div className="text-[10px] text-amber-200 uppercase font-bold">Total Artwork Assets</div>
              <div className="text-xl font-extrabold text-white flex items-center justify-center sm:justify-start gap-2">
                <span>{chapterIllustrations.length} Visuals</span>
                {hasCharacters && <span className="text-xs font-normal text-amber-300">({characterBible.length} Cast Members)</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Main Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-2 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('illustrator')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'illustrator'
                ? 'bg-amber-500 text-white shadow-md'
                : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>{isGuides ? "Chapter Diagram & Visual Designer" : isNonFiction ? "Editorial & Concept Designer" : "Chapter Scene Illustrator"}</span>
          </button>

          {hasCharacters && (
            <button
              onClick={() => setActiveTab('character_bible')}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'character_bible'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Character Bible & Cast Cohesion ({characterBible.length})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('gallery')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'gallery'
                ? 'bg-zinc-900 text-white shadow-md'
                : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Book Artwork Gallery ({chapterIllustrations.length})</span>
          </button>
        </div>

        {/* TAB 1: CHAPTER SCENE ILLUSTRATOR */}
        {activeTab === 'illustrator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Chapter Selection & Scene Extractor */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Chapter Selector & Auto-Scene Extraction */}
              <div className="bg-white rounded-3xl border border-zinc-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-amber-600" /> Target Chapter
                  </label>
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                    {chapterIllustrationsCount(selectedChapterId)} Illustrated
                  </span>
                </div>

                <div className="relative">
                  <select
                    value={selectedChapterId}
                    onChange={(e) => {
                      setSelectedChapterId(e.target.value);
                      setSelectedScene(null);
                    }}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-xl p-3 text-xs font-semibold text-zinc-800 focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
                  >
                    {chapters.map((ch, idx) => (
                      <option key={ch.id} value={ch.id}>
                        Chapter {idx + 1}: {ch.title} ({chapterIllustrationsCount(ch.id)} visuals)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Auto Scene Extraction Trigger */}
                <button
                  onClick={handleExtractScenesFromChapter}
                  disabled={isExtractingScenes || !currentChapter?.content}
                  className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isExtractingScenes ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{isGuides ? "Nano Banana analyzing architecture & concepts..." : "Nano Banana analyzing chapter text..."}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-yellow-200" />
                      <span>{isGuides ? "Auto-Analyze & Extract Visual Concepts" : "Auto-Analyze & Extract Scene Moments"}</span>
                    </>
                  )}
                </button>

                <p className="text-[11px] text-zinc-500 leading-snug">
                  {isGuides 
                    ? "Nano Banana reads your chapter text, detects key architecture workflows, cloud components, or procedures, and generates ready-to-render visual prompts." 
                    : "Nano Banana reads your chapter prose, finds the most visual moments, and formulates ready-to-draw scene prompts."}
                </p>
              </div>

              {/* Quick Presets for Technical Guides & Non-Fiction */}
              {!hasCharacters && (
                <div className="bg-indigo-50/60 border border-indigo-100 rounded-3xl p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" /> Quick Visual Presets for {currentChapter?.title || 'Chapter'}
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setScenePrompt(`High-impact chapter hero header banner illustrating the core theme of: "${currentChapter?.title || 'this chapter'}". Modern technical SaaS visual, sleek linear gradient aesthetic, studio lighting, widescreen composition.`);
                        setAspectRatio('16:9');
                        setColorMode('color');
                      }}
                      className="text-left p-3 bg-white hover:bg-indigo-50/80 border border-indigo-200/70 rounded-xl text-xs font-semibold text-zinc-800 transition-all flex items-center justify-between cursor-pointer"
                    >
                      <span>🚀 Chapter Header Banner (16:9)</span>
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setScenePrompt(`Detailed architectural blueprint and node-and-connector workflow diagram illustrating the system processes described in: "${currentChapter?.title || 'this chapter'}". Precision technical lines, clean geometric layout, modular cloud blocks.`);
                        setAspectRatio('4:3');
                      }}
                      className="text-left p-3 bg-white hover:bg-indigo-50/80 border border-indigo-200/70 rounded-xl text-xs font-semibold text-zinc-800 transition-all flex items-center justify-between cursor-pointer"
                    >
                      <span>🏗️ System Architecture & Workflow Diagram</span>
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setScenePrompt(`Modern developer studio workspace with glowing code monitors, architectural notes on a glass board, focused engineering aesthetic, illustrating: "${currentChapter?.title || 'this chapter'}".`);
                        setAspectRatio('4:3');
                        setColorMode('color');
                      }}
                      className="text-left p-3 bg-white hover:bg-indigo-50/80 border border-indigo-200/70 rounded-xl text-xs font-semibold text-zinc-800 transition-all flex items-center justify-between cursor-pointer"
                    >
                      <span>💻 Modern Developer & Engineering Studio</span>
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                    </button>
                  </div>
                </div>
              )}

              {/* Detected Scenes List */}
              {extractedScenes.length > 0 && (
                <div className="bg-white rounded-3xl border border-zinc-200 p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                    <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Compass className="w-4 h-4 text-indigo-600" /> 
                      {isGuides ? `Detected Visual Concepts (${extractedScenes.length})` : `Detected Scene Moments (${extractedScenes.length})`}
                    </h3>
                  </div>

                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                    {extractedScenes.map((scene) => (
                      <div
                        key={scene.id}
                        onClick={() => handleSelectScene(scene)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                          selectedScene?.id === scene.id
                            ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-200 shadow-sm'
                            : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-100/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-bold text-xs text-zinc-900 truncate">{scene.title}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            scene.colorModeRecommendation === 'black_and_white'
                              ? 'bg-zinc-900 text-white'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {scene.colorModeRecommendation === 'black_and_white' ? (isGuides ? 'Monochrome' : 'B&W Line Art') : 'Full Color'}
                          </span>
                        </div>
                        
                        <p className="text-[11px] text-zinc-600 italic line-clamp-2 mb-2">
                          "{scene.excerpt || scene.sceneSummary}"
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-medium">
                          <span>Focus: <strong className="text-zinc-700">{scene.mood}</strong></span>
                          <span>Layout: <strong className="text-zinc-700">{scene.composition}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Character Bible Quick Status Box (Only for Character-driven books) */}
              {hasCharacters && (
                <div className="bg-indigo-50/60 border border-indigo-100 rounded-3xl p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-indigo-600" /> Character Consistency Anchor
                    </h4>
                    <button
                      onClick={() => setActiveTab('character_bible')}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                    >
                      Manage Cast ({characterBible.length})
                    </button>
                  </div>

                  {characterBible.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-[11px] text-indigo-900 leading-snug">
                        Select which characters appear in this scene to lock their visual identity, facial features, and attire:
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {characterBible.map(char => {
                          const isSelected = selectedCharIds.includes(char.id);
                          return (
                            <button
                              key={char.id}
                              type="button"
                              onClick={() => {
                                setSelectedCharIds(prev => 
                                  isSelected ? prev.filter(id => id !== char.id) : [...prev, char.id]
                                );
                              }}
                              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'bg-white text-zinc-700 border border-indigo-200 hover:bg-indigo-50'
                              }`}
                            >
                              <Lock className="w-3 h-3 text-amber-300" />
                              <span>{char.name}</span>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/80 p-3 rounded-2xl border border-indigo-100 text-center space-y-2">
                      <p className="text-[11px] text-zinc-600">
                        No character profiles created yet. Auto-extract them from your manuscript to ensure identical facial designs across every chapter!
                      </p>
                      <button
                        onClick={handleAutoExtractCharacters}
                        disabled={isExtractingChars}
                        className="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-100/70 px-3 py-1.5 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        {isExtractingChars ? 'Extracting...' : 'Auto-Build Character Cast'}
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Right Column: Prompt Customizer, Art Style & Generator Output */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Studio Canvas / Controls */}
              <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm space-y-5">
                
                {/* Mode Selector: Color vs B&W */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-800 uppercase tracking-wider block">
                    {isGuides ? "Visual Color Palette Mode" : "Illustration Color Mode"}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setColorMode('color')}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-center gap-2 font-bold text-xs cursor-pointer ${
                        colorMode === 'color'
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-600 shadow-md ring-2 ring-amber-200'
                          : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      <Palette className="w-4 h-4" />
                      <span>{isGuides ? "Vibrant Modern Tech Palette" : "Vibrant Full Color Storybook"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setColorMode('black_and_white')}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-center gap-2 font-bold text-xs cursor-pointer ${
                        colorMode === 'black_and_white'
                          ? 'bg-zinc-900 text-white border-black shadow-md ring-2 ring-zinc-400'
                          : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      <Layers className="w-4 h-4 text-zinc-300" />
                      <span>{isGuides ? "Clean Monochrome / Blueprint" : "Black & White Line Art / Ink"}</span>
                    </button>
                  </div>
                </div>

                {/* Art Style Preset Dropdown */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-800 uppercase tracking-wider block">
                    {isGuides ? "Technical Visual Style & Medium" : isNonFiction ? "Editorial Art Style & Medium" : isFiction ? "Cinematic Art Style & Medium" : "Children's Art Style & Medium"}
                  </label>
                  <select
                    value={selectedArtStyle}
                    onChange={(e) => setSelectedArtStyle(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-xl p-3 text-xs font-semibold text-zinc-800 focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
                  >
                    {currentCategoryStyles.map(style => (
                      <option key={style.id} value={style.name}>
                        {style.name} — {style.desc.slice(0, 50)}...
                      </option>
                    ))}
                  </select>
                </div>

                {/* Aspect Ratio Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-800 uppercase tracking-wider block">
                    Visual Aspect Ratio & Layout
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: '16:9', label: '16:9 Widescreen', desc: isGuides ? 'Chapter Banner' : 'Double Spread' },
                      { id: '4:3', label: '4:3 Landscape', desc: isGuides ? 'Standard Diagram' : 'Storybook' },
                      { id: '1:1', label: '1:1 Square', desc: 'Inline Figure' },
                      { id: '3:4', label: '3:4 Portrait', desc: 'Full Page Inset' }
                    ].map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setAspectRatio(item.id as any)}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          aspectRatio === item.id
                            ? 'bg-indigo-50 border-indigo-600 text-indigo-900 font-bold shadow-2xs'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                        }`}
                      >
                        <div className="text-xs font-bold">{item.id}</div>
                        <div className="text-[9px] text-zinc-400">{item.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scene Description / Prompt */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                      {isGuides ? "Visual Directives & Architecture Prompt" : "Scene Description & Visual Directives"}
                    </label>
                    <span className="text-[10px] text-zinc-400">Nano Banana AI Visual Engine</span>
                  </div>
                  <textarea
                    rows={4}
                    value={scenePrompt}
                    onChange={(e) => setScenePrompt(e.target.value)}
                    placeholder={isGuides ? "Describe the architecture diagram, technical concept, workflow, cloud components, or workspace scene..." : "Describe the scene moment, character actions, emotional expression, environment, lighting, and props..."}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-2xl p-3.5 text-xs text-zinc-800 focus:ring-2 focus:ring-amber-500 focus:outline-none resize-y font-sans leading-relaxed shadow-inner"
                  />
                </div>

                {/* Primary Action Button: Generate */}
                <button
                  type="button"
                  onClick={() => handleGenerateIllustration()}
                  disabled={isGeneratingIllustration || !scenePrompt.trim()}
                  className="w-full py-4 px-6 bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white font-extrabold text-sm rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingIllustration ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>{generationStep || 'Nano Banana generating visual...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 text-yellow-200 animate-pulse" />
                      <span>{isGuides ? "Generate Technical Visual (Nano Banana)" : "Generate Chapter Illustration (Nano Banana)"}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Latest Artwork Output Canvas */}
              {latestGeneratedImage && (
                <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <h3 className="text-sm font-bold text-zinc-900">Latest Rendered Visual</h3>
                    </div>
                    <span className="text-xs font-bold px-3 py-1 bg-amber-50 text-amber-800 rounded-full border border-amber-200">
                      {colorMode === 'black_and_white' ? (isGuides ? 'Monochrome' : 'B&W Line Art') : 'Full Color'}
                    </span>
                  </div>

                  {/* Image View Area */}
                  <div className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-200 shadow-md group">
                    <img 
                      src={latestGeneratedImage} 
                      alt="Generated chapter visual" 
                      className="w-full max-h-[480px] object-contain mx-auto"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* Insertion & Export Actions */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const illus = chapterIllustrations[0];
                        if (illus) handleInsertIntoMarkdown(illus, 'top');
                      }}
                      className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-emerald-200" />
                      <span>📌 Insert at Top (Header)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const illus = chapterIllustrations[0];
                        if (illus) handleInsertIntoMarkdown(illus, 'bottom');
                      }}
                      className="py-3 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ArrowRight className="w-4 h-4 text-indigo-200" />
                      <span>📍 Insert at End</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const illus = chapterIllustrations[0];
                        if (illus) handleDownloadImage(illus);
                      }}
                      className="py-3 px-3 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-emerald-400" />
                      <span>📥 Download PNG</span>
                    </button>
                  </div>

                  {/* Quick Copy Markdown snippet */}
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const illus = chapterIllustrations[0];
                        if (illus) handleCopyMarkdown(illus);
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 underline cursor-pointer"
                    >
                      <span>📋 Copy Markdown Tag to Clipboard</span>
                    </button>
                  </div>

                  {/* Refine / Iteration Bar */}
                  <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200 space-y-2">
                    <label className="text-[11px] font-bold text-zinc-700 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Fine-Tune / Iteration Feedback
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={feedbackInput}
                        onChange={(e) => setFeedbackInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGenerateIllustration(feedbackInput)}
                        placeholder={isGuides ? "e.g. 'Add glowing database icons, make lines sharper, and use a dark background'" : "e.g. 'Make the character smile and add sunset glow'"}
                        className="flex-1 bg-white border border-zinc-300 rounded-xl px-3.5 py-2 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleGenerateIllustration(feedbackInput)}
                        disabled={isGeneratingIllustration || !feedbackInput.trim()}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-40 cursor-pointer"
                      >
                        Refine
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* TAB 2: CHARACTER BIBLE & CAST COHESION */}
        {activeTab === 'character_bible' && (
          <div className="space-y-6">
            
            {/* Top Toolbar */}
            <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" /> Character Consistency Bible
                </h2>
                <p className="text-xs text-zinc-500">
                  Locked visual profiles guarantee identical character faces, hair, clothing, and colors across every chapter drawing.
                </p>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  type="button"
                  onClick={handleAutoExtractCharacters}
                  disabled={isExtractingChars}
                  className="flex-1 md:flex-initial py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>{isExtractingChars ? 'Scanning Manuscript...' : 'Auto-Extract Cast from Book'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddCharModal(true)}
                  className="flex-1 md:flex-initial py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Character Manually</span>
                </button>
              </div>
            </div>

            {/* Character Cards Grid */}
            {characterBible.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {characterBible.map((char) => (
                  <div 
                    key={char.id} 
                    className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-6 space-y-4 hover:shadow-md transition-shadow relative group"
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-2 border-b border-zinc-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-base text-zinc-900">{char.name}</h3>
                          <button
                            type="button"
                            onClick={() => handleToggleLockCharacter(char.id)}
                            title={char.isLocked ? "Character visual anchor is LOCKED for consistency" : "Character anchor is UNLOCKED"}
                            className={`p-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                              char.isLocked 
                                ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                                : 'bg-zinc-100 text-zinc-600'
                            }`}
                          >
                            {char.isLocked ? <Lock className="w-3 h-3 text-amber-700" /> : <Unlock className="w-3 h-3" />}
                            <span>{char.isLocked ? 'Locked' : 'Editable'}</span>
                          </button>
                        </div>
                        <span className="text-[11px] font-semibold text-indigo-600">{char.speciesOrType || 'Character'}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteCharacter(char.id)}
                        className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete character"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Physical Details */}
                    <div className="space-y-2.5 text-xs text-zinc-700">
                      <div>
                        <span className="font-bold text-zinc-500 uppercase text-[9px] block">Face & Physical Features</span>
                        <p className="leading-snug text-zinc-800 mt-0.5">{char.physicalAppearance || 'Not specified'}</p>
                      </div>

                      <div>
                        <span className="font-bold text-zinc-500 uppercase text-[9px] block">Signature Attire & Outfit</span>
                        <p className="leading-snug text-zinc-800 mt-0.5">{char.clothingAndAttire || 'Not specified'}</p>
                      </div>

                      {char.distinctiveFeatures && (
                        <div>
                          <span className="font-bold text-zinc-500 uppercase text-[9px] block">Distinctive Props & Accessories</span>
                          <p className="leading-snug text-zinc-800 mt-0.5">{char.distinctiveFeatures}</p>
                        </div>
                      )}
                    </div>

                    {/* Locked Visual Anchor Prompt */}
                    <div className="bg-zinc-50 rounded-2xl p-3 border border-zinc-200 space-y-1">
                      <span className="font-bold text-[9px] text-amber-800 uppercase flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5 text-amber-600" /> Locked Generation Prompt Anchor
                      </span>
                      <p className="text-[11px] text-zinc-600 font-mono italic leading-relaxed line-clamp-3">
                        "{char.lockedPromptAnchor}"
                      </p>
                    </div>

                    {/* Quick Draw Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCharIds([char.id]);
                        setScenePrompt(`Portrait illustration of ${char.name} in their signature outfit in a gentle storybook environment.`);
                        setActiveTab('illustrator');
                      }}
                      className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Palette className="w-3.5 h-3.5" />
                      <span>Generate Scene with {char.name}</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-zinc-200 p-12 text-center space-y-4 max-w-xl mx-auto shadow-sm">
                <Users className="w-12 h-12 text-indigo-300 mx-auto" />
                <h3 className="text-base font-bold text-zinc-900">No Character Profiles Yet</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Extract characters directly from your manuscript or add them manually to give each character a consistent visual DNA (outfit, hair, colors, face).
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={handleAutoExtractCharacters}
                    disabled={isExtractingChars}
                    className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-yellow-300" />
                    <span>Auto-Extract from Book</span>
                  </button>
                  <button
                    onClick={() => setShowAddCharModal(true)}
                    className="py-2.5 px-5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Add Manually
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* TAB 3: BOOK ARTWORK GALLERY */}
        {activeTab === 'gallery' && (
          <div className="space-y-6">
            
            {/* Gallery Header */}
            <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-zinc-800" /> Illustrated Chapter Artwork Gallery ({chapterIllustrations.length})
                </h2>
                <p className="text-xs text-zinc-500">
                  All artwork created across your manuscript. Easily insert illustrations into chapter prose or export in high resolution.
                </p>
              </div>

              {chapterIllustrations.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      chapterIllustrations.forEach(illus => handleDownloadImage(illus));
                    }}
                    className="py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <FileDown className="w-4 h-4 text-emerald-400" />
                    <span>Download All Illustrations (.zip batch)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Illustrations Grid */}
            {chapterIllustrations.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {chapterIllustrations.map((illus) => {
                  const targetChapter = chapters.find(c => c.id === illus.chapterId);
                  return (
                    <div 
                      key={illus.id}
                      className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col group hover:shadow-lg transition-all"
                    >
                      {/* Image Frame */}
                      <div 
                        onClick={() => setPreviewImageModal(illus)}
                        className="relative aspect-[4/3] bg-zinc-900 cursor-pointer overflow-hidden"
                      >
                        <img 
                          src={illus.imageUrl} 
                          alt={illus.sceneTitle} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">
                          {illus.colorMode === 'black_and_white' ? '🖋️ Black & White' : '🎨 Full Color'}
                        </div>
                        {illus.insertedInMarkdown && (
                          <div className="absolute top-3 right-3 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                            <Check className="w-3 h-3" /> In Chapter Prose
                          </div>
                        )}
                      </div>

                      {/* Content Info */}
                      <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-0.5">
                            {targetChapter ? `Chapter: ${targetChapter.title}` : 'Story Scene'}
                          </div>
                          <h3 className="font-bold text-sm text-zinc-900 line-clamp-1">{illus.sceneTitle}</h3>
                          <p className="text-[11px] text-zinc-500 italic line-clamp-2 mt-1">"{illus.prompt}"</p>
                        </div>

                        {/* Action buttons */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100">
                          <button
                            type="button"
                            onClick={() => handleInsertIntoMarkdown(illus)}
                            className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{illus.insertedInMarkdown ? 'Re-Insert' : 'Insert in Text'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadImage(illus)}
                            className="py-2 px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] font-bold rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-zinc-200 p-12 text-center space-y-4 max-w-xl mx-auto shadow-sm">
                <ImageIcon className="w-12 h-12 text-zinc-300 mx-auto" />
                <h3 className="text-base font-bold text-zinc-900">No Chapter Illustrations Generated Yet</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Use the Chapter Scene Illustrator to analyze your book chapters and generate bespoke children's illustrations.
                </p>
                <button
                  onClick={() => setActiveTab('illustrator')}
                  className="py-2.5 px-5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all inline-flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-yellow-200" />
                  <span>Start Illustrating Chapters</span>
                </button>
              </div>
            )}

          </div>
        )}

        {/* MODAL: ADD CHARACTER MANUALLY */}
        {showAddCharModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <h3 className="font-bold text-base text-zinc-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" /> Add Character Profile to Bible
                </h3>
                <button 
                  onClick={() => setShowAddCharModal(false)}
                  className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs text-zinc-800">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-zinc-700 block mb-1">Character Name *</label>
                    <input 
                      type="text"
                      value={newChar.name}
                      onChange={(e) => setNewChar(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Barnaby the Fox, Lily"
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-xl p-2.5 font-semibold text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-zinc-700 block mb-1">Species / Type</label>
                    <input 
                      type="text"
                      value={newChar.speciesOrType}
                      onChange={(e) => setNewChar(prev => ({ ...prev, speciesOrType: e.target.value }))}
                      placeholder="e.g. Human child (age 6), Red Fox"
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-xl p-2.5 font-semibold text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Physical Features (Face, Hair, Build)</label>
                  <input 
                    type="text"
                    value={newChar.physicalAppearance}
                    onChange={(e) => setNewChar(prev => ({ ...prev, physicalAppearance: e.target.value }))}
                    placeholder="e.g. Messy curly brown hair, round rosy cheeks, bright hazel eyes, freckles"
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Signature Outfit & Attire (Identical Across Book)</label>
                  <input 
                    type="text"
                    value={newChar.clothingAndAttire}
                    onChange={(e) => setNewChar(prev => ({ ...prev, clothingAndAttire: e.target.value }))}
                    placeholder="e.g. Oversized yellow raincoat with wooden toggle buttons, teal boots, red scarf"
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Distinctive Props or Quirks</label>
                  <input 
                    type="text"
                    value={newChar.distinctiveFeatures}
                    onChange={(e) => setNewChar(prev => ({ ...prev, distinctiveFeatures: e.target.value }))}
                    placeholder="e.g. Always carries a glowing acorn lantern and a tiny leather satchel"
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCharModal(false)}
                  className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveNewCharacter}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  Save Character Profile
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: IMAGE FULL PREVIEW */}
        {previewImageModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-zinc-900 text-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-4 border border-zinc-700">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="font-bold text-sm text-white truncate">{previewImageModal.sceneTitle}</h3>
                <button 
                  onClick={() => setPreviewImageModal(null)}
                  className="text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-[60vh] flex items-center justify-center bg-black rounded-2xl overflow-hidden p-2">
                <img 
                  src={previewImageModal.imageUrl} 
                  alt={previewImageModal.sceneTitle} 
                  className="max-h-[55vh] w-auto object-contain mx-auto"
                  referrerPolicy="no-referrer"
                />
              </div>

              <p className="text-xs text-zinc-400 italic">"{previewImageModal.prompt}"</p>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => handleInsertIntoMarkdown(previewImageModal)}
                  className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Insert into Chapter Text</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDeleteIllustration(previewImageModal.id)}
                    className="py-2.5 px-3 bg-red-900/60 hover:bg-red-800 text-red-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadImage(previewImageModal)}
                    className="py-2.5 px-4 bg-white text-zinc-900 hover:bg-zinc-200 font-bold text-xs rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download PNG</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
