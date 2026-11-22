import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { cloth } from './textures';

export type Anim = 'idle' | 'walk' | 'run' | 'talk' | 'carry' | 'interact' | 'sit' | 'attack' | 'block' | 'dodge' | 'crouch' | 'hit' | 'yield';

export interface Look {
  robe: string;
  robeStripe: string;
  cloak: string;
  turban: string;
  skin: string;
  beard: string | null;
  height?: number;
  /** Sash/belt colour. */
  sash?: string;
  /** short = trimmed, full = to the collarbone, long = to the chest. */
  beardLength?: 'short' | 'full' | 'long';
  /** 0.55 = shawl over the shoulders, 1 = cloak to the shins. */
  cloakLength?: number;
  /** Fringed hem on the cloak/shawl. */
  fringe?: boolean;
  satchel?: boolean;
  staff?: boolean;
}

export const LOOKS: Record<string, Look> = {
  /* Designs from the ATHAR concept sheets (art/concepts). */
  traveler: { robe: '#d4c6a8', robeStripe: '#cbbd9e', cloak: '#6e5340', turban: '#b5a789', skin: '#a87a55', beard: '#231a14', sash: '#5a3a24', beardLength: 'short', cloakLength: 0.85, fringe: true, satchel: true },
  steadfast: { robe: '#5f6878', robeStripe: '#58616f', cloak: '#4a3a2d', turban: '#bcb098', skin: '#9c7152', beard: '#2a2420', sash: '#8a7357', beardLength: 'full', cloakLength: 1, fringe: true },
  elder: { robe: '#d8cdb6', robeStripe: '#cfc3aa', cloak: '#8a4d32', turban: '#bfb296', skin: '#a3765a', beard: '#8f8a84', sash: '#d8cdb6', beardLength: 'long', cloakLength: 0.62, fringe: true, staff: true },
  abuDharr: { robe: '#b9a47f', robeStripe: '#ad9873', cloak: '#6b4a2e', turban: '#d6cbb3', skin: '#b98a63', beard: '#2b211b' },
  guide: { robe: '#3a4a6b', robeStripe: '#33425f', cloak: '#26324a', turban: '#d9cfb8', skin: '#a47a56', beard: '#5a5550' },
  wayfarer: { robe: '#8b6d4a', robeStripe: '#7e6242', cloak: '#4f3b28', turban: '#a3927a', skin: '#9b7150', beard: '#3b3029' },
  townsman: { robe: '#a65f3c', robeStripe: '#985636', cloak: '#5c3a26', turban: '#cfc2a6', skin: '#ad8059', beard: '#2f2520' },
  companion1: { robe: '#5e7454', robeStripe: '#566a4d', cloak: '#3c4a35', turban: '#d3c8b0', skin: '#b48460', beard: '#2a211b' },
  companion2: { robe: '#7a4f6b', robeStripe: '#6f4862', cloak: '#4a3045', turban: '#d6cbb3', skin: '#a77b58', beard: '#3a2d25' },
};

const gltf = new GLTFLoader();
const modelCache = new Map<string, Promise<{ scene: THREE.Object3D; animations: THREE.AnimationClip[] }>>();

/**
 * A character in the world. Uses an authored rigged GLB when one is available, otherwise a
 * detailed procedural stand-in with procedural animation. Either way the API is the same.
 */
export class Character {
  readonly root = new THREE.Group();
  anim: Anim = 'idle';
  private body = new THREE.Group();
  private parts: Record<string, THREE.Object3D> = {};
  private phase = Math.random() * 10;
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private currentAction: THREE.AnimationAction | null = null;
  private label: THREE.Sprite | null = null;
  carrying: THREE.Object3D | null = null;

  /**
   * @param modelUrl rigged GLB for this character
   * @param clips extra GLBs on the same skeleton, each contributing named animation clips
   *              (e.g. { idle: '/models/traveler-idle.glb', run: '/models/traveler-run.glb' })
   */
  constructor(look: Look, modelUrl?: string, clips: Record<string, string> = {}) {
    this.root.add(this.body);
    this.buildProcedural(look);
    if (modelUrl) void this.loadModel(modelUrl, clips);
  }

  private mat(color: string, rough = 0.85, map?: THREE.Texture) {
    return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, map });
  }

  private buildProcedural(look: Look) {
    const h = look.height ?? 1.0;
    const shadow = (m: THREE.Mesh) => ((m.castShadow = true), (m.receiveShadow = true), m);

    // Robe: a lathe profile flaring to the ankles.
    const robeProfile = [
      [0.0, 0.0], [0.34, 0.02], [0.36, 0.1], [0.33, 0.5], [0.28, 0.95], [0.26, 1.2], [0.27, 1.36], [0.2, 1.45], [0.11, 1.5], [0.0, 1.5],
    ].map(([x, y]) => new THREE.Vector2(x!, y!));
    const robe = shadow(new THREE.Mesh(new THREE.LatheGeometry(robeProfile, 28), this.mat(look.robe, 0.9, cloth(look.robe, look.robeStripe))));
    this.body.add(robe);

    // Open cloak over the shoulders and back.
    const len = look.cloakLength ?? 0.95;
    const hemY = 1.45 - len * 1.37; // where the cloak ends
    const cloakProfile = [[0.0, hemY], [0.39, hemY + 0.02], [0.37, Math.max(hemY + 0.1, 0.6)], [0.32, 1.15], [0.31, 1.38], [0.22, 1.47], [0.0, 1.47]]
      .filter(([, y], i, a) => i === 0 || y! >= a[i - 1]![1]!)
      .map(([x, y]) => new THREE.Vector2(x!, y!));
    // Lathe angle 0 faces +z (the character's front); leave a ~70° opening there.
    const cloakGeo = new THREE.LatheGeometry(cloakProfile, 28, Math.PI * 0.2, Math.PI * 1.6);
    const cloak = shadow(new THREE.Mesh(cloakGeo, new THREE.MeshStandardMaterial({ color: look.cloak, roughness: 0.95, side: THREE.DoubleSide })));
    this.body.add(cloak);
    if (look.fringe) {
      // Short hanging threads along the hem.
      const fringeMat = new THREE.MeshStandardMaterial({ color: look.cloak, roughness: 1 });
      const thread = new THREE.CylinderGeometry(0.006, 0.006, 0.07, 3);
      for (let i = 0; i < 40; i++) {
        const a = Math.PI * 0.2 + (i / 39) * Math.PI * 1.6;
        const f = new THREE.Mesh(thread, fringeMat);
        f.position.set(Math.sin(a) * 0.39, hemY - 0.03, Math.cos(a) * 0.39);
        this.body.add(f);
      }
    }

    // Sash
    const sash = shadow(new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.035, 8, 28), this.mat(look.sash ?? '#7a2e1f', 0.8)));
    sash.rotation.x = Math.PI / 2;
    sash.position.y = 0.95;
    this.body.add(sash);

    // Head
    const head = new THREE.Group();
    head.position.y = 1.62;
    this.body.add(head);
    const skin = this.mat(look.skin, 0.6);
    const face = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 18), skin));
    face.scale.set(0.95, 1.12, 1);
    head.add(face);
    const nose = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 8), skin));
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, -0.005, 0.13);
    head.add(nose);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), this.mat('#1d1510', 0.3));
      eye.position.set(side * 0.045, 0.03, 0.115);
      head.add(eye);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.02), this.mat(look.beard ?? '#2b211b', 0.9));
      brow.position.set(side * 0.047, 0.06, 0.118);
      brow.rotation.z = side * -0.12;
      head.add(brow);
    }
    if (look.beard) {
      const beard = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 14, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58), this.mat(look.beard, 1)));
      const lengthScale = { short: 1.05, full: 1.45, long: 2.1 }[look.beardLength ?? 'full'];
      beard.scale.set(1, lengthScale, 0.95);
      beard.position.set(0, -0.04 - (lengthScale - 1.05) * 0.06, 0.025);
      head.add(beard);
      const moustache = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 12, Math.PI), this.mat(look.beard, 1));
      moustache.position.set(0, -0.035, 0.118);
      moustache.rotation.x = Math.PI;
      head.add(moustache);
    }
    // Turban: wrapped torus layers plus a crown.
    const turbanMat = this.mat(look.turban, 0.95);
    for (let i = 0; i < 3; i++) {
      const wrap = shadow(new THREE.Mesh(new THREE.TorusGeometry(0.12 - i * 0.012, 0.045, 10, 26), turbanMat));
      wrap.rotation.x = Math.PI / 2 + (i - 1) * 0.12;
      wrap.position.y = 0.1 + i * 0.035;
      head.add(wrap);
    }
    const crown = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), turbanMat));
    crown.position.y = 0.14;
    head.add(crown);
    // Tail of the turban cloth down the back.
    const tail = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.015), turbanMat));
    tail.position.set(0.02, -0.06, -0.12);
    tail.rotation.x = 0.2;
    head.add(tail);

    // Arms (shoulder pivots so they can swing).
    for (const side of [-1, 1] as const) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.3, 1.38, 0);
      const sleeve = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.42, 6, 12), this.mat(look.robe, 0.9)));
      sleeve.position.y = -0.26;
      shoulder.add(sleeve);
      const hand = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), skin));
      hand.position.y = -0.54;
      shoulder.add(hand);
      this.body.add(shoulder);
      this.parts[side < 0 ? 'armL' : 'armR'] = shoulder;
    }
    // Sandals peeking out.
    for (const side of [-1, 1] as const) {
      const foot = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.24), this.mat('#4a3020', 0.8)));
      foot.position.set(side * 0.11, 0.025, 0.05);
      this.body.add(foot);
      this.parts[side < 0 ? 'footL' : 'footR'] = foot;
    }
    if (look.satchel) {
      const leather = this.mat('#6b4428', 0.7);
      const bag = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.17, 0.08), leather));
      bag.position.set(0.28, 0.82, 0.12);
      bag.rotation.y = -0.5;
      this.body.add(bag);
      const strap = shadow(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.012, 4, 30, Math.PI * 0.9), leather));
      strap.position.set(0.02, 1.08, 0.05);
      strap.rotation.set(0.15, 0, 0.75);
      this.body.add(strap);
    }
    if (look.staff) {
      const staff = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 1.75, 7), this.mat('#6a4a2c', 0.9)));
      staff.position.set(0, -0.32, 0.05);
      this.parts.armR!.add(staff); // held in the right hand, swings with the arm
    }
    this.parts.head = head;
    this.body.scale.setScalar(h * 1.08);
  }

  private static load(url: string) {
    if (!modelCache.has(url)) {
      modelCache.set(url, gltf.loadAsync(url).then((g) => ({ scene: g.scene, animations: g.animations })));
    }
    return modelCache.get(url)!;
  }

  private async loadModel(url: string, clips: Record<string, string>) {
    try {
      const { scene, animations: baseClips } = await Character.load(url);
      // Pull clips from the extra GLBs and name them by role (idle, run, ...).
      const extra = await Promise.all(
        Object.entries(clips).map(async ([name, clipUrl]) => {
          try {
            const clip = (await Character.load(clipUrl)).animations[0]?.clone();
            if (!clip) return undefined;
            clip.name = name;
            // Extra clips come from separately rigged files: their position data uses another
            // scale and their armature node carries its own axis correction. Keep only joint
            // rotations here; bones are filtered against the model's skeleton below.
            clip.tracks = clip.tracks.filter((t) => t.name.endsWith('.quaternion'));
            (clip.userData as { external?: boolean }).external = true;
            return clip;
          } catch {
            return undefined;
          }
        }),
      );
      for (const clip of baseClips) {
        for (const track of clip.tracks) {
          if (!track.name.endsWith('.position') || !/hips/i.test(track.name)) continue;
          // In-place locomotion: the game moves the character, the clip must not.
          const v = track.values;
          for (let i = 0; i < v.length; i += 3) {
            v[i] = v[0]!;
            v[i + 2] = v[2]!;
          }
        }
      }
      const model = cloneSkinned(scene);
      const bones: THREE.Bone[] = [];
      model.traverse((o) => {
        if ((o as THREE.Bone).isBone) bones.push(o as THREE.Bone);
      });
      const boneNames = new Set(bones.map((b) => b.name));
      const external = extra.filter((c): c is THREE.AnimationClip => !!c);
      for (const clip of external) {
        // Only drive real bones of this model, never the armature/root nodes: their rotation
        // in another file would tip the whole character over (into the ground).
        clip.tracks = clip.tracks.filter((t) => boneNames.has(THREE.PropertyBinding.parseTrackName(t.name).nodeName));
      }
      const animations = [...baseClips, ...external];
      model.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
      });
      // Normalise height to ~1.75m with feet on the ground.
      const box = new THREE.Box3().setFromObject(model);
      const scale = 1.75 / (box.max.y - box.min.y || 1);
      model.scale.setScalar(scale);
      model.position.y = -box.min.y * scale;
      this.root.remove(this.body);
      this.root.add(model);
      // Ground lock: remember how high the feet sit at rest, then keep them from going lower.
      this.model = model;
      this.modelBaseY = model.position.y;
      this.feet = bones.filter((b) => /foot|toe|ankle/i.test(b.name));
      if (this.feet.length === 0) this.feet = bones;
      this.restFootY = this.lowestFoot();
      if (this.staff) {
        this.staff.removeFromParent();
        this.staff = null;
        this.equipStaff();
      }
      this.mixer = new THREE.AnimationMixer(model);
      for (const clip of animations) this.actions.set(clip.name.toLowerCase(), this.mixer.clipAction(clip));
      this.playClip(this.anim);
    } catch (err) {
      console.warn('Character model failed to load; keeping stand-in', url, err);
    }
  }

  private playClip(anim: Anim) {
    if (!this.mixer) return;
    // Exact clip name first, then any clip whose name contains it (e.g. "Armature|Casual_Walk").
    const pick = (names: string[]) =>
      names.map((n) => this.actions.get(n) ?? [...this.actions].find(([k]) => k.includes(n))?.[1]).find(Boolean);
    const next =
      pick(
        {
          walk: ['walk', 'walking'],
          run: ['run', 'running', 'walk'],
          idle: ['idle'],
          talk: ['talk', 'idle'],
          carry: ['carry', 'walk'],
          interact: ['interact', 'idle'],
          sit: ['sit', 'idle'],
          attack: ['attack', 'idle'],
          block: ['block', 'idle'],
          dodge: ['dodge', 'run'],
          crouch: ['crouch', 'sneak', 'walk'],
          hit: ['hit', 'idle'],
          yield: ['yield', 'kneel', 'idle'],
        }[anim],
      ) ??
      this.actions.values().next().value;
    if (!next || next === this.currentAction) return;
    next.reset().fadeIn(0.25).play();
    this.currentAction?.fadeOut(0.25);
    this.currentAction = next;
  }

  /**
   * Covers the face with a veil of soft light, the way the Prophet ﷺ and the Imams (a) are
   * shown. Only for procedural characters (they have a head group to veil).
   */
  veil() {
    const head = this.parts.head;
    if (!head) return;
    head.children.forEach((c, i) => {
      // Keep the turban (the torus wraps, crown and tail come after the face features).
      if (i < head.children.length - 5) c.visible = false;
    });
    const veilMat = new THREE.MeshStandardMaterial({ color: '#fffaf0', emissive: '#fff1cf', emissiveIntensity: 1.6, roughness: 1, toneMapped: false });
    const veil = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 18), veilMat);
    veil.scale.set(0.95, 1.18, 1);
    veil.position.set(0, -0.02, 0.01);
    head.add(veil);
    // A gentle halo of light around the head.
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: '#fff3d6', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
    glow.scale.setScalar(0.8);
    glow.position.set(0, 0.02, 0);
    head.add(glow);
  }

  setAnim(anim: Anim) {
    if (anim === this.anim) return;
    this.anim = anim;
    this.playClip(anim);
  }

  setLabel(text: string | null, color = '#fff3dc') {
    if (this.label) {
      this.root.remove(this.label);
      this.label.material.map?.dispose();
      this.label = null;
    }
    if (!text) return;
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.font = '600 54px "Noto Naskh Arabic", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(30,20,12,0.55)';
    const w = Math.min(500, ctx.measureText(text).width + 60);
    ctx.beginPath();
    ctx.roundRect(256 - w / 2, 22, w, 84, 42);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillText(text, 256, 66);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    this.label.scale.set(1.6, 0.4, 1);
    this.label.position.y = 2.1;
    this.label.renderOrder = 10;
    this.root.add(this.label);
  }

  private model: THREE.Object3D | null = null;
  private modelBaseY = 0;
  private feet: THREE.Bone[] = [];
  private restFootY = 0;
  private readonly tmp = new THREE.Vector3();

  private overlay = 0;

  /**
   * Rigged models only have walk/idle/run clips so far: express combat states with a light
   * whole-body pose on top (lean, crouch, kneel) until dedicated clips are generated.
   */
  private poseOverlay(dt: number) {
    if (!this.model) return;
    this.overlay += dt;
    const targets: Partial<Record<Anim, [number, number, number]>> = {
      // [lean forward, crouch scale, twist]
      attack: [0.18, 1, Math.sin(this.overlay * 18) * 0.5],
      block: [-0.08, 0.96, 0.25],
      dodge: [0.35, 0.85, 0],
      crouch: [0.25, 0.82, 0],
      hit: [-0.25, 1, 0],
      yield: [0.55, 0.7, 0],
    };
    const [lean, squash, twist] = targets[this.anim] ?? [0, 1, 0];
    const k = Math.min(1, dt * 12);
    this.model.rotation.x += (lean - this.model.rotation.x) * k;
    this.model.rotation.y += (twist - this.model.rotation.y) * k;
    const sy = this.model.scale.y / (this.model.scale.x || 1);
    const ny = sy + (squash - sy) * k;
    this.model.scale.y = this.model.scale.x * ny;
  }

  private staff: THREE.Object3D | null = null;

  /** Give the character a walking staff (their weapon in training and encounters). */
  equipStaff() {
    if (this.staff) return;
    const staff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.028, 1.7, 7),
      new THREE.MeshStandardMaterial({ color: '#6a4a2c', roughness: 0.85 }),
    );
    staff.castShadow = true;
    this.staff = staff;
    const armR = this.parts.armR;
    if (armR && !this.model) {
      staff.position.set(0, -0.5, 0.05);
      staff.rotation.x = Math.PI / 2.4;
      armR.add(staff);
      return;
    }
    let hand: THREE.Object3D | undefined;
    this.model?.traverse((o) => {
      if (!hand && (o as THREE.Bone).isBone && /right.?hand|hand.?r\b|hand_r/i.test(o.name)) hand = o;
    });
    if (hand) {
      // Bones are in the model's (scaled) space; undo the scale so the staff stays 1.7m.
      const s = 1 / (this.model!.scale.x || 1);
      staff.scale.setScalar(s);
      staff.rotation.x = Math.PI / 2;
      hand.add(staff);
    } else {
      staff.position.set(0.35, 0.9, 0.2);
      this.root.add(staff);
    }
  }

  /** Lowest foot bone height, in the character root's local space. */
  private lowestFoot(): number {
    this.root.updateMatrixWorld(true);
    let min = Infinity;
    for (const b of this.feet) {
      b.getWorldPosition(this.tmp);
      this.root.worldToLocal(this.tmp);
      min = Math.min(min, this.tmp.y);
    }
    return Number.isFinite(min) ? min : 0;
  }

  update(dt: number) {
    if (this.mixer) {
      this.mixer.update(dt);
      this.poseOverlay(dt);
      if (this.model && this.feet.length) {
        // Lift the body if an animation pushes the feet below where they rest.
        this.model.position.y = this.modelBaseY;
        const sink = this.restFootY - this.lowestFoot();
        if (sink > 0.005) this.model.position.y = this.modelBaseY + sink;
      }
      return;
    }
    const speed = this.anim === 'run' ? 11 : this.anim === 'walk' || this.anim === 'carry' ? 7 : 1.6;
    this.phase += dt * speed;
    const p = this.phase;
    const { armL, armR, footL, footR, head } = this.parts;
    const moving = this.anim === 'walk' || this.anim === 'run' || this.anim === 'carry' || this.anim === 'crouch';
    const swing = this.anim === 'run' ? 0.85 : 0.45;

    this.body.position.y = moving ? Math.abs(Math.sin(p)) * (this.anim === 'run' ? 0.07 : 0.035) : Math.sin(p) * 0.006;
    this.body.rotation.x = this.anim === 'run' ? 0.12 : 0;
    if (this.anim === 'attack') this.phase += dt * 8; // swings are fast
    this.body.rotation.z = moving ? Math.sin(p) * 0.025 : 0;

    if (this.anim === 'sit') {
      this.body.position.y = -0.55;
      armL!.rotation.x = armR!.rotation.x = -0.6;
    } else if (this.anim === 'attack') {
      // Overhead-to-forward staff swing.
      const t = (p * 0.9) % (Math.PI * 2);
      armR!.rotation.x = -2.2 + Math.sin(t) * 1.4;
      armR!.rotation.z = -0.3;
      armL!.rotation.x = -0.9;
      this.body.rotation.y = Math.sin(t) * 0.35;
    } else if (this.anim === 'block') {
      armL!.rotation.x = armR!.rotation.x = -1.5;
      armL!.rotation.z = 0.5;
      armR!.rotation.z = -0.5;
      this.body.rotation.x = -0.05;
    } else if (this.anim === 'dodge') {
      this.body.rotation.x = 0.45;
      this.body.position.y = -0.15;
      armL!.rotation.x = armR!.rotation.x = 0.6;
    } else if (this.anim === 'crouch') {
      this.body.position.y = -0.22;
      this.body.rotation.x = 0.3;
      armL!.rotation.x = Math.sin(p) * 0.25 - 0.3;
      armR!.rotation.x = -Math.sin(p) * 0.25 - 0.3;
    } else if (this.anim === 'hit') {
      this.body.rotation.x = -0.3;
      armL!.rotation.x = armR!.rotation.x = -0.4;
    } else if (this.anim === 'yield') {
      // Kneel with the head bowed and the staff lowered: the opponent gives up.
      this.body.position.y = -0.45;
      this.body.rotation.x = 0.35;
      armL!.rotation.x = armR!.rotation.x = 0.2;
      head!.rotation.x = 0.5;
    } else if (this.anim === 'carry') {
      armL!.rotation.x = armR!.rotation.x = -1.1;
      armL!.rotation.z = 0.25;
      armR!.rotation.z = -0.25;
    } else if (moving) {
      armL!.rotation.x = Math.sin(p) * swing;
      armR!.rotation.x = -Math.sin(p) * swing;
      armL!.rotation.z = armR!.rotation.z = 0;
    } else if (this.anim === 'talk') {
      armR!.rotation.x = -0.7 + Math.sin(p * 2) * 0.15;
      armR!.rotation.z = -0.2;
      armL!.rotation.x = Math.sin(p) * 0.05;
    } else if (this.anim === 'interact') {
      armR!.rotation.x = armL!.rotation.x = -0.9;
    } else {
      armL!.rotation.x = Math.sin(p) * 0.04;
      armR!.rotation.x = -Math.sin(p) * 0.04;
      armL!.rotation.z = 0.06;
      armR!.rotation.z = -0.06;
    }
    footL!.position.z = 0.05 + (moving ? Math.sin(p) * 0.16 : 0);
    footR!.position.z = 0.05 - (moving ? Math.sin(p) * 0.16 : 0);
    head!.rotation.y = this.anim === 'talk' ? Math.sin(p * 0.7) * 0.15 : Math.sin(p * 0.3) * 0.05;
    if (this.anim !== 'yield') head!.rotation.x = 0;
    if (this.anim !== 'attack') this.body.rotation.y = 0;
  }
}

let halo: THREE.Texture | null = null;
function haloTexture() {
  if (halo) return halo;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,248,226,0.95)');
  grad.addColorStop(0.45, 'rgba(255,236,190,0.45)');
  grad.addColorStop(1, 'rgba(255,230,180,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  halo = new THREE.CanvasTexture(c);
  halo.colorSpace = THREE.SRGBColorSpace;
  return halo;
}
