import { GearItem, GearKind } from '../models';

/** Display order, label and icon of each equipment kind (used by the studio editor and the public profile). */
export const GEAR_KINDS: readonly { kind: GearKind; label: string; plural: string; icon: string; placeholder: string }[] = [
  { kind: 'camera', label: 'Camera', plural: 'Cameras', icon: 'camera', placeholder: 'e.g. Canon EOS R5' },
  { kind: 'lens', label: 'Lens', plural: 'Lenses', icon: 'aperture', placeholder: 'e.g. 35mm f/1.4' },
  { kind: 'video', label: 'Video', plural: 'Video', icon: 'video', placeholder: 'e.g. Sony FX3 cinema camera' },
  { kind: 'drone', label: 'Drone', plural: 'Drones', icon: 'plane', placeholder: 'e.g. DJI Mavic 3' },
  { kind: 'lighting', label: 'Lighting', plural: 'Lighting', icon: 'lightbulb', placeholder: 'e.g. Godox AD200 flash kit' },
  { kind: 'audio', label: 'Audio', plural: 'Audio', icon: 'mic', placeholder: 'e.g. Rode wireless microphones' },
  { kind: 'accessory', label: 'Other', plural: 'Other gear', icon: 'package', placeholder: 'e.g. Tripod, gimbal, backdrops' },
];

export const GEAR_MAX_ITEMS = 30;
export const GEAR_MAX_NAME = 60;

/** Trims names, drops empty rows and duplicates, enforces the limits. Used before saving. */
export function cleanGear(items: GearItem[]): GearItem[] {
  const seen = new Set<string>(); const out: GearItem[] = [];
  for (const i of items) {
    const name = i.name.trim().slice(0, GEAR_MAX_NAME); const key = `${i.kind}|${name.toLowerCase()}`;
    if (name && !seen.has(key)) { seen.add(key); out.push({ kind: i.kind, name }); }
  }
  return out.slice(0, GEAR_MAX_ITEMS);
}
