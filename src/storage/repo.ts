import type { Project } from '@/model/types';
import { db } from './db';

export const projectsRepo = {
  /** Most recently edited first. */
  list: () => db.projects.orderBy('updatedAt').reverse().toArray(),
  get: (id: string) => db.projects.get(id),
  async save(project: Project): Promise<Project> {
    const saved = { ...project, updatedAt: Date.now() };
    await db.projects.put(saved);
    return saved;
  },
  remove: (id: string) => db.projects.delete(id),
};

export const settingsRepo = {
  async get<T>(key: string, fallback: T): Promise<T> {
    const row = await db.settings.get(key);
    return row === undefined ? fallback : (row.value as T);
  },
  set: (key: string, value: unknown) => db.settings.put({ key, value }),
  remove: (key: string) => db.settings.delete(key),
};
