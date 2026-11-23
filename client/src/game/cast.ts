import { LOOKS, type Look } from './character';

/**
 * Who looks like whom. Each design comes from a concept sheet in art/concepts/. When its
 * rigged 3D model is ready, drop the .glb in public/models/ and set `model`; every
 * character using that design switches over, keeping the stand-in as fallback.
 */
/** Generated models, compressed with gltf-transform (meshopt + webp) and served with the app. */
const M = (name: string) => `${import.meta.env.BASE_URL}models/${name}.json`;

export interface Design {
  look: Look;
  /** Rigged GLB (its built-in clip is used as `walk`). */
  model?: string;
  /** Extra animation GLBs on the same rig, by role. */
  clips?: Record<string, string>;
}

export const DESIGNS: Record<'traveler' | 'steadfast' | 'elder', Design> = {
  traveler: {
    look: LOOKS.traveler!,
    // Generated from art/concepts/traveler (Higgsfield multi-view → rigged, walk clip built in).
    model: M('traveler'),
    clips: {
      idle: M('traveler-idle'),
      run: M('traveler-run'),
    },
  },
  steadfast: {
    look: LOOKS.steadfast!,
    model: M('steadfast'),
    clips: {
      idle: M('steadfast-idle'),
      run: M('steadfast-run'),
    },
  },
  elder: {
    look: LOOKS.elder!,
    model: M('elder'),
    clips: {
      idle: M('elder-idle'),
      run: M('elder-run'),
    },
  },
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
