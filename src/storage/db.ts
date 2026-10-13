// Offline-first persistence (IndexedDB via Dexie). All app data lives here; nothing requires a server.
import Dexie, { type EntityTable } from 'dexie';
import type { Carousel, Project } from '@/model/types';

export interface TemplateRecord {
  id: string;
  name: string;
  styleId: string;
  presetId: string;
  createdAt: number;
  carousel: Carousel;
  thumbnail?: string;
}

export interface BrandKit {
  id: string;
  name: string;
  logoAssetId?: string;
  colors: string[];
  headingFont?: string;
  bodyFont?: string;
  handle?: string;
  watermark?: boolean;
}

export interface AssetRecord {
  id: string;
  name: string;
  mime: string;
  blob: Blob;
  createdAt: number;
}

export interface SettingRecord {
  key: string;
  value: unknown;
}

export class CarouselDB extends Dexie {
  projects!: EntityTable<Project, 'id'>;
  templates!: EntityTable<TemplateRecord, 'id'>;
  brandKits!: EntityTable<BrandKit, 'id'>;
  assets!: EntityTable<AssetRecord, 'id'>;
  settings!: EntityTable<SettingRecord, 'key'>;

  constructor(name = 'carouselforge') {
    super(name);
    this.version(1).stores({
      projects: 'id, updatedAt, name',
      templates: 'id, styleId, presetId, createdAt',
      brandKits: 'id, name',
      assets: 'id, createdAt',
      settings: 'key',
    });
  }
}

export const db = new CarouselDB();
