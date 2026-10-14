import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type Credit = { author: string; license: string; licenseUrl: string; sourceUrl: string };
type License = { id?: number; short_name: string; url: string };
type WgerExercise = {
  id: number; category: { name: string }; equipment: { name: string }[];
  translations: { name: string; language: number; description: string; license_author?: string; license?: number }[];
  license: License; license_author: string;
  images: { image: string; is_main: boolean; license_author: string; license?: License | number }[];
  videos: { video: string; license_author: string; license?: License | number }[];
};

// Render upstream descriptions as text, never as executable HTML.
export function descriptionSteps(html: string): string[] {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(?:p|li|div|h[1-6])>|<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#(?:39|x27);/g, "'")
    .split('\n').map(step => step.trim()).filter(Boolean);
}

function mediaUrl(value?: string): string {
  if (!value) return '';
  try { const url = new URL(value, 'https://wger.de'); return url.protocol === 'https:' ? url.href : ''; }
  catch { return ''; }
}

export function mapWgerExercise(exercise: WgerExercise, licenses: License[] = []) {
  const translation = exercise.translations.find(item => item.language === 2 && item.name.trim());
  if (!translation) return null;
  const sourceUrl = `https://wger.de/api/v2/exerciseinfo/${exercise.id}/`;
  const credit = (author: string, value: License | number | undefined = exercise.license): Credit => {
    const license = typeof value === 'number' ? licenses.find(item => item.id === value) : value;
    return { author: author || exercise.license_author, license: license?.short_name ?? `License ${value}`, licenseUrl: mediaUrl(license?.url), sourceUrl };
  };
  const image = exercise.images.find(item => item.is_main) ?? exercise.images[0];
  const video = exercise.videos[0];
  const categories: Record<string, string> = { Abs: 'Core', Calves: 'Legs', Thighs: 'Legs', Biceps: 'Arms', Triceps: 'Arms' };
  const equipment = exercise.equipment.map(item => item.name === 'none (bodyweight)' ? 'Bodyweight' : item.name);
  return {
    _id: `wger-${exercise.id}`, slug: `wger-${exercise.id}`, name: translation.name,
    targetMuscle: categories[exercise.category.name] ?? exercise.category.name,
    equipment: equipment.join(', ') || 'Bodyweight', equipmentList: equipment.length ? equipment : ['Bodyweight'],
    difficulty: '', trackingStatus: 'Manual', instructions: descriptionSteps(translation.description),
    pictureUrl: mediaUrl(image?.image), videoUrl: mediaUrl(video?.video),
    source: 'wger', attribution: credit(translation.license_author || exercise.license_author, translation.license ?? exercise.license),
    imageAttribution: image ? credit(image.license_author, image.license) : null,
    videoAttribution: video ? credit(video.license_author, video.license) : null,
  };
}

export type WgerLibraryExercise = NonNullable<ReturnType<typeof mapWgerExercise>>;

@Injectable()
export class WgerService {
  private cache: { items: WgerLibraryExercise[]; expires: number } | undefined;
  private pending: Promise<WgerLibraryExercise[]> | undefined;
  constructor(private readonly config: ConfigService) {}

  async catalog(): Promise<WgerLibraryExercise[]> {
    if (this.cache && this.cache.expires > Date.now()) return this.cache.items;
    if (!this.pending) this.pending = this.load().finally(() => { this.pending = undefined; });
    return this.pending;
  }

  private async load(): Promise<WgerLibraryExercise[]> {
    try {
      const key = this.config.get<string>('WGER_API_KEY')?.trim();
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (key) headers.Authorization = `Token ${key}`;
      const items: WgerLibraryExercise[] = [];
      const signal = AbortSignal.timeout(45_000);
      const licenseResponse = await fetch('https://wger.de/api/v2/license/?limit=100', { headers, signal });
      if (!licenseResponse.ok) throw new Error('wger licenses unavailable');
      const { results: licenses } = await licenseResponse.json() as { results: License[] };
      if (!Array.isArray(licenses)) throw new Error('Invalid wger licenses');
      let offset = 0;
      for (;;) {
        const response = await fetch(`https://wger.de/api/v2/exerciseinfo/?limit=200&offset=${offset}`, { headers, signal });
        if (!response.ok) throw new Error('wger request failed');
        const data = await response.json() as { results: WgerExercise[]; next: string | null };
        if (!Array.isArray(data.results)) throw new Error('Invalid wger response');
        for (const exercise of data.results) { const item = mapWgerExercise(exercise, licenses); if (item) items.push(item); }
        if (!data.next) break;
        if (!data.results.length || offset >= 10_000) throw new Error('Invalid wger pagination');
        offset += data.results.length;
      }
      items.sort((a, b) => a.name.localeCompare(b.name));
      this.cache = { items, expires: Date.now() + 60 * 60 * 1000 };
      return items;
    } catch {
      throw new ServiceUnavailableException('The wger exercise library is unavailable. Please try again shortly.');
    }
  }
}
