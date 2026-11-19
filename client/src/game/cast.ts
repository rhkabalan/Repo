import { LOOKS, type Look } from './character';

/**
 * Who looks like whom. Each design comes from a concept sheet in art/concepts/. When its
 * rigged 3D model is ready, drop the .glb in public/models/ and set `model`; every
 * character using that design switches over, keeping the stand-in as fallback.
 */
export interface Design {
  look: Look;
  model?: string;
}

export const DESIGNS: Record<'traveler' | 'steadfast' | 'elder', Design> = {
  traveler: { look: LOOKS.traveler! /* , model: '/models/traveler.glb' */ },
  steadfast: { look: LOOKS.steadfast! /* , model: '/models/steadfast.glb' */ },
  elder: { look: LOOKS.elder! /* , model: '/models/elder.glb' */ },
};

/** Casting for the Mecca chapter. Change a line here to recast a role. */
export const CAST = {
  player: DESIGNS.traveler,
  guide: DESIGNS.elder,
  restingTraveler: DESIGNS.steadfast,
};

/** Party members get distinct colourways so friends can tell each other apart. */
export const PARTY_LOOKS: Look[] = [LOOKS.companion1!, LOOKS.companion2!];
