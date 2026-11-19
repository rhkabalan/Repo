import { LOOKS, type Look } from './character';

/**
 * Who looks like whom. Each design comes from a concept sheet in art/concepts/. When its
 * rigged 3D model is ready, drop the .glb in public/models/ and set `model`; every
 * character using that design switches over, keeping the stand-in as fallback.
 */
/** Where generated models are served from until they are copied into public/models. */
const MODEL_CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_38DJH2MZxmBs8rcoGInHY3dJHJE';

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
    model: `${MODEL_CDN}/hf_20261119_014717_c5558e0c-b2ab-4148-88ec-1366c23a3a74.glb`,
    clips: {
      idle: `${MODEL_CDN}/hf_20261119_015942_f6d34e6c-b465-4684-89c9-942dabaad33d.glb`,
      run: `${MODEL_CDN}/hf_20261119_015943_79bdcd5c-2c4b-40ee-a293-3314b6373e46.glb`,
    },
  },
  steadfast: {
    look: LOOKS.steadfast!,
    model: `${MODEL_CDN}/hf_20261119_021650_a8b10fc6-c05b-444e-82d1-759d2e541ff3.glb`,
    clips: {
      idle: `${MODEL_CDN}/hf_20261119_022825_2570af75-f4a3-4916-8bd2-8d88a488e998.glb`,
      run: `${MODEL_CDN}/hf_20261119_022826_8bf73be0-0a65-4cd7-aca2-3c913515ffe1.glb`,
    },
  },
  elder: {
    look: LOOKS.elder!,
    model: `${MODEL_CDN}/hf_20261119_021652_baa0b0c5-0456-42ef-9f6d-60fc8b743160.glb`,
    clips: {
      idle: `${MODEL_CDN}/hf_20261119_022827_2cb37b63-0956-47bd-9a66-71e21a78a869.glb`,
      run: `${MODEL_CDN}/hf_20261119_022828_4b416458-9afc-451e-912c-63bf113dc3c4.glb`,
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
