'use client';
import { useId } from 'react';
import { Icon } from '../Home/icons';
import { BADGE_CATEGORIES, badgeMeta, type BadgeCategory, type BadgeTier } from './badgeCatalog';

const star = (points: number, outer: number, inner: number) => Array.from({ length: points * 2 }, (_, i) => {
  const r = i % 2 ? inner : outer, a = (Math.PI * i) / points - Math.PI / 2;
  return `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`;
}).join(' ');

/** One silhouette per category so a badge's family reads at a glance. */
const SHAPES: Record<BadgeCategory, string> = {
  personal: 'M24 5 H76 L95 33 L74 95 H26 L5 33 Z',
  rhythm: 'M50 3 L91 26.5 V73.5 L50 97 L9 73.5 V26.5 Z',
  forge: 'M50 3 L90 15 V47 C90 72 72 89 50 97 C28 89 10 72 10 47 V15 Z',
  iron: 'M31 3 H69 L97 31 V69 L69 97 H31 L3 69 V31 Z',
  fuel: 'M50 2 C66 24 88 42 88 62 A38 36 0 0 1 12 62 C12 42 34 24 50 2 Z',
  questline: `M${star(8, 48, 39).replace(/ /g, ' L')} Z`,
  ascension: 'M50 2 A48 48 0 1 1 49.9 2 Z',
};

/** Rim metals by rarity: [highlight, base, shadow]. */
const RIMS: Record<BadgeTier, [string, string, string]> = {
  common: ['#f3c595', '#c07a3e', '#6d3b17'],
  rare: ['#ffffff', '#b9c4d4', '#5f6b7d'],
  epic: ['#fff0b0', '#f0b429', '#8a5a05'],
  legendary: ['#e9d5ff', '#67e8f9', '#facc15'],
};

/**
 * Original crest art for a badge, drawn as one self-contained SVG so it also renders
 * on the share card. Locked badges keep their silhouette in muted slate.
 */
export default function BadgeCrest({ id, earned, size = 72 }: { id: string; earned: boolean; size?: number }) {
  const uid = useId().replace(/:/g, '');
  const meta = badgeMeta(id);
  const hue = BADGE_CATEGORIES.find(category => category.id === meta.category)?.hue ?? '#22c55e';
  const [hi, base, low] = earned ? RIMS[meta.tier] : ['#5b6779', '#3b4657', '#232b38'];
  const field = earned ? hue : '#3b4657';
  const glyphColor = earned ? '#ffffff' : '#7b8799';
  const shape = SHAPES[meta.category];
  const inner = 'translate(50 50) scale(.8) translate(-50 -50)';
  const glyphY = meta.label ? 23 : 29;
  return <svg className={`badge-crest badge-crest-${meta.category} badge-tier-${meta.tier} ${earned ? 'is-earned' : 'is-locked'}`} viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ color: glyphColor }} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id={`rim-${uid}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={hi}/><stop offset=".55" stopColor={base}/><stop offset="1" stopColor={low}/>
      </linearGradient>
      <radialGradient id={`field-${uid}`} cx=".5" cy=".32" r=".75">
        <stop offset="0" stopColor={field} stopOpacity={earned ? .95 : .55}/><stop offset=".7" stopColor="#0d1420"/><stop offset="1" stopColor="#070b12"/>
      </radialGradient>
      <linearGradient id={`shine-${uid}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity={earned ? .35 : .08}/><stop offset=".45" stopColor="#ffffff" stopOpacity="0"/>
      </linearGradient>
    </defs>
    <path d={shape} fill={`url(#rim-${uid})`}/>
    <path d={shape} transform={inner} fill={`url(#field-${uid})`}/>
    <path d={shape} transform="translate(50 50) scale(.8) translate(-50 -50)" fill="none" stroke={earned ? hi : '#4a5568'} strokeOpacity=".55" strokeWidth="1.2"/>
    {meta.tier === 'legendary' && earned && <path d={shape} transform="translate(50 50) scale(.9) translate(-50 -50)" fill="none" stroke="#ffffff" strokeOpacity=".5" strokeWidth=".8" strokeDasharray="2 3"/>}
    <path d={shape} transform={inner} fill={`url(#shine-${uid})`}/>
    <g transform={`translate(${50 - 17} ${glyphY})`} style={{ color: glyphColor }}><Icon name={meta.glyph} size={34}/></g>
    {meta.label && <>
      <rect x={50 - Math.max(14, meta.label.length * 4.2)} y="64" width={Math.max(28, meta.label.length * 8.4)} height="15" rx="7.5" fill={earned ? '#0b1220' : '#1b2330'} stroke={`url(#rim-${uid})`} strokeWidth="1.4"/>
      <text x="50" y="75" textAnchor="middle" fontSize="10.5" fontWeight="800" fontFamily="Inter, system-ui, sans-serif" fill={earned ? hi : '#8a96a8'}>{meta.label}</text>
    </>}
  </svg>;
}
