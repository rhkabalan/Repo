import { LOOKS, type Look } from './character';

/**
 * Who looks like whom. Each design comes from a concept sheet in art/concepts/. When its
 * rigged 3D model is ready, drop the .glb in public/models/ and set `model`; every
 * character using that design switches over, keeping the stand-in as fallback.
 */
export interface Design {
  look: Look;
  /** Rigged GLB (its built-in clip is used as `walk`). */
  model?: string;
  /** Extra animation GLBs on the same rig, by role. */
  clips?: Record<string, string>;
}

export const DESIGNS: Record<'traveler' | 'steadfast' | 'elder', Design> = {
  traveler: { look: LOOKS.traveler! /* , model: '/models/traveler.glb' */ },
  steadfast: { look: LOOKS.steadfast! /* , model: '/models/steadfast.glb' */ },
  elder: { look: LOOKS.elder! /* , model: '/models/elder.glb' */ },
};

export type CharacterId = keyof typeof DESIGNS;
export const CHARACTER_IDS: CharacterId[] = ['traveler', 'steadfast', 'elder'];
export const isCharacterId = (v: unknown): v is CharacterId => CHARACTER_IDS.includes(v as CharacterId);

/** Players' characters come from their own choice; this falls back for anyone who hasn't chosen. */
export const designFor = (id: string | null | undefined): Design => (isCharacterId(id) ? DESIGNS[id] : DESIGNS.traveler);

/**
 * NPC casting for Mecca. NPCs take designs no player in the session is using, so the guide
 * never looks like you; when every design is taken they use neutral townsfolk looks.
 */
export function castNpcs(taken: string[]): { guide: Design; restingTraveler: Design } {
  const free = (['elder', 'steadfast', 'traveler'] as CharacterId[]).filter((id) => !taken.includes(id));
  return {
    guide: free[0] ? DESIGNS[free[0]] : { look: LOOKS.guide! },
    restingTraveler: free[1] ? DESIGNS[free[1]] : { look: LOOKS.wayfarer! },
  };
}
