// App-level state (Zustand). Settings persist to IndexedDB; the current carousel keeps an undo history
// via zundo (the editor in Phase 3 builds on this).
import { create } from 'zustand';
import { temporal } from 'zundo';
import type { Carousel, Project } from '@/model/types';
import { projectsRepo, settingsRepo } from '@/storage/repo';
import { DEFAULT_CLAUDE_MODEL, DEFAULT_OLLAMA_URL, type ProviderPreference } from '@/engine';

export interface Settings {
  provider: ProviderPreference;
  claudeModel: string;
  ollamaUrl: string;
  ollamaModel: string;
  theme: 'system' | 'light' | 'dark';
}

export const defaultSettings: Settings = {
  provider: 'auto',
  claudeModel: DEFAULT_CLAUDE_MODEL,
  ollamaUrl: DEFAULT_OLLAMA_URL,
  ollamaModel: '',
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
    useDocument.getState().load(project.carousel);
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
  load(c: Carousel): void;
  setCarousel(c: Carousel): void;
}

/** The carousel being edited, with unlimited undo/redo (useDocument.temporal). */
export const useDocument = create<DocumentState>()(
  temporal(
    (set) => ({
      carousel: null,
      load(c) {
        set({ carousel: c });
        useDocument.temporal.getState().clear();
      },
      setCarousel(c) {
        set({ carousel: c });
      },
    }),
    { partialize: (s) => ({ carousel: s.carousel }) },
  ),
);
