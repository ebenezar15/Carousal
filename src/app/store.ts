// App-level state (Zustand). Settings persist to IndexedDB; the current carousel keeps an undo history
// via zundo (the editor in Phase 3 builds on this).
import { create } from 'zustand';
import { temporal } from 'zundo';
import type { Carousel, Project } from '@/model/types';
import type { CarouselPlan } from '@/engine/schema';
import type { Doc } from '@/editor/ops';
import { projectsRepo, settingsRepo } from '@/storage/repo';
import { DEFAULT_CLAUDE_FAST_MODEL, DEFAULT_CLAUDE_MODEL, DEFAULT_OLLAMA_URL, type OpenAIPresetId, type ProviderPreference } from '@/engine';

export interface Settings {
  provider: ProviderPreference;
  claudeModel: string;
  /** Model for quick tasks (translation, captions, headline ideas). */
  claudeFastModel: string;
  ollamaUrl: string;
  ollamaModel: string;
  /** '' = same as ollamaModel. */
  ollamaFastModel: string;
  /** OpenAI-compatible "free / local models" provider. */
  openaiPreset: OpenAIPresetId;
  /** '' = the preset's URL. */
  openaiBaseUrl: string;
  openaiModel: string;
  /** '' = same as openaiModel. */
  openaiFastModel: string;
  theme: 'system' | 'light' | 'dark';
}

export const defaultSettings: Settings = {
  provider: 'auto',
  claudeModel: DEFAULT_CLAUDE_MODEL,
  claudeFastModel: DEFAULT_CLAUDE_FAST_MODEL,
  ollamaUrl: DEFAULT_OLLAMA_URL,
  ollamaModel: '',
  ollamaFastModel: '',
  openaiPreset: 'openrouter',
  openaiBaseUrl: '',
  openaiModel: '',
  openaiFastModel: '',
  theme: 'system',
};

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  load(): Promise<void>;
  update(patch: Partial<Settings>): Promise<void>;
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loaded: false,
  async load() {
    const saved = await settingsRepo.get<Partial<Settings>>('app', {});
    set({ settings: { ...defaultSettings, ...saved }, loaded: true });
  },
  async update(patch) {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    await settingsRepo.set('app', settings);
  },
}));

interface ProjectsState {
  projects: Project[];
  current: Project | null;
  refresh(): Promise<void>;
  open(project: Project): void;
  save(project: Project): Promise<Project>;
  remove(id: string): Promise<void>;
}

export const useProjects = create<ProjectsState>((set, get) => ({
  projects: [],
  current: null,
  async refresh() {
    set({ projects: await projectsRepo.list() });
  },
  open(project) {
    set({ current: project });
    useDocument.getState().load(project.carousel, (project.plan as CarouselPlan | undefined) ?? null);
  },
  async save(project) {
    const saved = await projectsRepo.save(project);
    set({ current: saved });
    await get().refresh();
    return saved;
  },
  async remove(id) {
    await projectsRepo.remove(id);
    if (get().current?.id === id) set({ current: null });
    await get().refresh();
  },
}));

interface DocumentState {
  carousel: Carousel | null;
  plan: CarouselPlan | null;
  /** Replaces the document and clears undo history (opening a project). */
  load(c: Carousel, plan: CarouselPlan | null): void;
  setCarousel(c: Carousel): void;
  /** Applies a pure document operation (records one undo step, or joins the active gesture). */
  apply(fn: (d: Doc) => Doc): void;
}

/** A gesture (drag, slider scrub) records a single undo step for all of its updates. */
const gesture = { active: false, recorded: false };
export function beginGesture() {
  gesture.active = true;
  gesture.recorded = false;
}
export function endGesture() {
  gesture.active = false;
  gesture.recorded = false;
}

/** The carousel being edited (and the plan it came from), with unlimited undo/redo (useDocument.temporal). */
export const useDocument = create<DocumentState>()(
  temporal(
    (set, get) => ({
      carousel: null,
      plan: null,
      load(c, plan) {
        set({ carousel: c, plan });
        useDocument.temporal.getState().clear();
      },
      setCarousel(c) {
        set({ carousel: c });
      },
      apply(fn) {
        const { carousel, plan } = get();
        if (!carousel) return;
        const next = fn({ carousel, plan: plan ?? { title: '', language: 'en', paletteMood: 'minimal', slides: carousel.slides.map(() => ({ role: 'body', headline: '', body: '', bullets: [], stat: null, quote: null, emphasis: [], layoutHint: '', iconKeywords: [] })), caption: '', hashtags: [] } });
        const t = useDocument.temporal.getState();
        if (gesture.active && gesture.recorded) {
          t.pause();
          set({ carousel: next.carousel, plan: next.plan });
          t.resume();
        } else {
          set({ carousel: next.carousel, plan: next.plan });
          if (gesture.active) gesture.recorded = true;
        }
      },
    }),
    { partialize: (s) => ({ carousel: s.carousel, plan: s.plan }) },
  ),
);

export type Route = 'generate' | 'editor' | 'templates' | 'settings';
export const useRoute = create<{ route: Route; go(r: Route): void }>((set) => ({ route: 'generate', go: (route) => set({ route }) }));
