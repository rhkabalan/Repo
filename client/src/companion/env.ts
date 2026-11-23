/**
 * Scenes for companion chapter 1. Built procedurally to the period look in
 * docs/research/locations.md: Ghifar's goat-hair tents and wells; Mecca's barren granite valley
 * with the Kaaba as rebuilt by Quraysh c. 605 (courses of stone and timber, a plain cloth cover,
 * raised door), houses crowding an open court, and Zamzam. No mosque, colonnades or minarets.
 */
import * as THREE from 'three';
import type { Collider } from '../game/mecca';
import { cloth, plaster, sand, stoneBlocks, wood } from '../game/textures';
import { prop } from './props';

export interface SceneBase {
  group: THREE.Group;
  colliders: Collider[];
  ground: THREE.Object3D;
  points: Record<string, THREE.Vector3>;
  update(dt: number, t: number): void;
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const shadowed = <T extends THREE.Object3D>(o: T) => {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) c.castShadow = c.receiveShadow = true;
  });
  return o;
};
const mat = (color: string, rough = 0.9, map?: THREE.Texture) => new THREE.MeshStandardMaterial({ color, roughness: rough, map: map ?? null });

function addGround(g: THREE.Group, color: string, repeat = 50, flat = 90) {
  const tex = sand().clone();
  tex.needsUpdate = true;
  tex.repeat.set(repeat, repeat);
  const geo = new THREE.PlaneGeometry(600, 600, 180, 180);
  const p = geo.attributes.position!;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const d = Math.hypot(x, y);
    const dune = d > flat ? Math.sin(x * 0.045) * Math.cos(y * 0.035) * 2.5 + (d - flat) * 0.05 : 0;
    p.setZ(i, dune + Math.sin(x * 0.6) * Math.cos(y * 0.5) * 0.03 - 0.04);
  }
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, color, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  g.add(ground);
  return ground;
}

function addHills(g: THREE.Group, r: () => number, color: string, near = 140, count = 24, centerZ = 0) {
  // Rugged granite ridges: noisy, flattened rock masses instead of smooth cones.
  const m = new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true });
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + r() * 0.2;
    const dist = near + r() * 60;
    const geo = new THREE.IcosahedronGeometry(1, 3);
    const p = geo.attributes.position!;
    const seed = r() * 100;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
      const n = 1 + Math.sin(x * 4.1 + seed) * Math.cos(z * 3.7 + seed) * 0.22 + Math.sin(y * 7.3 + seed * 2) * 0.12;
      p.setXYZ(k, x * n, Math.max(y, -0.15) * n, z * n);
    }
    geo.computeVertexNormals();
    const ridge = new THREE.Mesh(geo, m);
    const w = 34 + r() * 30, h = 18 + r() * 34;
    ridge.scale.set(w, h, w * (0.6 + r() * 0.5));
    ridge.position.set(Math.cos(a) * dist, -2, centerZ + Math.sin(a) * dist);
    ridge.rotation.y = r() * Math.PI;
    g.add(ridge);
  }
}

function acacia(r: () => number) {
  return prop('acacia', acaciaStandIn(r), 4.2 + r() * 1.2);
}
function acaciaStandIn(r: () => number) {
  const t = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 2.2, 6), mat('#5b4330'));
  trunk.position.y = 1.1;
  trunk.rotation.z = (r() - 0.5) * 0.3;
  t.add(trunk);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(1.8, 10, 6), mat('#6f7a43', 1));
  crown.scale.set(1.5, 0.35, 1.3);
  crown.position.y = 2.4;
  t.add(crown);
  return shadowed(t);
}

/** A low-poly dromedary. */
export function camel(color = '#b38a5a') {
  return prop('camel', camelStandIn(color), 2.3, { rotY: Math.PI / 2 });
}
function camelStandIn(color: string) {
  const c = new THREE.Group();
  const m = mat(color, 1);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.1, 8, 14), m);
  body.rotation.z = Math.PI / 2;
  body.position.y = 1.75;
  c.add(body);
  const hump = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), m);
  hump.scale.set(1.2, 0.85, 0.85);
  hump.position.set(-0.05, 2.15, 0);
  c.add(hump);
  // Curved neck: two segments, then a long narrow head.
  const neck1 = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.8, 8), m);
  neck1.position.set(1.0, 1.75, 0);
  neck1.rotation.z = -1.0;
  c.add(neck1);
  const neck2 = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.75, 8), m);
  neck2.position.set(1.38, 2.25, 0);
  neck2.rotation.z = -0.15;
  c.add(neck2);
  const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.32, 4, 8), m);
  head.rotation.z = Math.PI / 2 - 0.25;
  head.position.set(1.58, 2.62, 0);
  c.add(head);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 4), m);
    ear.position.set(1.42, 2.76, s * 0.06);
    c.add(ear);
  }
  for (const [x, z] of [[0.6, 0.22], [0.6, -0.22], [-0.65, 0.22], [-0.65, -0.22]]) {
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.8, 6), m);
    thigh.position.set(x!, 1.15, z!);
    c.add(thigh);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.8, 6), m);
    shin.position.set(x!, 0.42, z!);
    c.add(shin);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.05, 8), m);
    foot.position.set(x!, 0.03, z!);
    c.add(foot);
  }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.5, 5), m);
  tail.position.set(-0.98, 1.6, 0);
  tail.rotation.z = 0.25;
  c.add(tail);
  // Saddle blanket.
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.9), mat('#8a3b2a', 1, cloth('#8a3b2a', '#d9a046')));
  blanket.position.set(-0.05, 2.5, 0);
  c.add(blanket);
  c.userData.head = head;
  return shadowed(c);
}

/** A black goat-hair tent with woven side panels. */
function tent(r: () => number, w = 6, d = 4) {
  return prop('tent', tentStandIn(r, w, d), 2.4, { fit: 'width', width: Math.max(w, d) });
}
function tentStandIn(r: () => number, w: number, d: number) {
  const t = new THREE.Group();
  const hair = mat('#2a2421', 1, cloth('#2c2622', '#3a322c'));
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), hair);
  roof.position.y = 2.1;
  roof.rotation.x = 0.06;
  t.add(roof);
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, 2.0, 0.06), hair);
  back.position.set(0, 1.05, -d / 2);
  t.add(back);
  const panel = mat('#8a3b2a', 0.95, cloth('#9a4a2c', '#c08a3e'));
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.8, d), panel);
    side.position.set((s * w) / 2, 0.95, 0);
    t.add(side);
  }
  const poleM = mat('#5a4029');
  for (const x of [-w / 2 + 0.2, 0, w / 2 - 0.2]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.2, 6), poleM);
    pole.position.set(x, 1.1, d / 2 - 0.2);
    t.add(pole);
  }
  // Rugs and a few cushions inside.
  const rug = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.03, d * 0.7), mat('#7a2e22', 1, cloth('#7a2e22', '#c7963e')));
  rug.position.y = 0.02;
  t.add(rug);
  t.rotation.y = r() * 0.3 - 0.15;
  return shadowed(t);
}

function well(withPulley = true) {
  return prop('well', wellStandIn(withPulley), withPulley ? 2.4 : 1.2, { fit: 'width', width: 2.5 });
}
function wellStandIn(withPulley: boolean) {
  const w = new THREE.Group();
  const stone = mat('#8d7a62', 0.95, stoneBlocks(5));
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.9, 18, 1, true), stone);
  ring.position.y = 0.45;
  ring.material.side = THREE.DoubleSide;
  w.add(ring);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.12, 6, 20), stone);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.9;
  w.add(lip);
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.0, 18), new THREE.MeshStandardMaterial({ color: '#2c4a52', roughness: 0.15, metalness: 0.1 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.35;
  w.add(water);
  if (withPulley) {
    const woodM = mat('#6a4a2c', 0.9, wood());
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.2, 0.14), woodM);
      post.position.set(s * 1.2, 1.1, 0);
      w.add(post);
    }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 8), woodM);
    beam.rotation.z = Math.PI / 2;
    beam.position.y = 2.15;
    w.add(beam);
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.3, 10), mat('#5a3a22'));
    bucket.position.y = 1.4;
    w.add(bucket);
  }
  return shadowed(w);
}

// ====================================================================== Ghifar
export interface GhifarScene extends SceneBase {
  /** The widow's tent: fallen until raised. */
  raiseTent(): void;
  setTrough(level: number): void;
  fire: THREE.PointLight;
  camels: THREE.Group[];
}

export function buildGhifar(): GhifarScene {
  const g = new THREE.Group();
  const colliders: Collider[] = [];
  const r = rng(7);
  // Flat out past the night camp on the road (z ≈ −125).
  const ground = addGround(g, '#dcc29a', 60, 150);
  addHills(g, r, '#8a6a4c', 185, 30);
  const block = (x: number, z: number, w: number, d: number) => colliders.push({ min: new THREE.Vector2(x - w / 2, z - d / 2), max: new THREE.Vector2(x + w / 2, z + d / 2) });

  // Camp tents in a loose ring.
  for (const [x, z, rot] of [[-12, -4, 0.4], [-6, -12, 0.1], [4, -14, -0.2], [12, -8, -0.6], [-14, 8, 1.2], [14, 6, -1.4]] as const) {
    const t = tent(r);
    t.position.set(x, 0, z);
    t.rotation.y += rot;
    g.add(t);
    block(x, z, 5, 4);
  }
  // Abu Dharr's tent.
  const ad = tent(r, 5, 3.6);
  ad.position.set(-2, 0, -24);
  g.add(ad);
  block(-2, -24, 4.5, 3.4);

  for (const [x, z] of [[1.4, -22.6], [-12, -1.5], [13, -10]] as const) {
    const jars = prop('jars', new THREE.Group(), 0.9);
    jars.position.set(x, 0, z);
    g.add(jars);
  }
  // The widow's fallen tent: cloth on the ground until raised.
  const widow = new THREE.Group();
  widow.position.set(-9, 0, 14);
  const fallen = new THREE.Mesh(new THREE.BoxGeometry(5, 0.08, 4), mat('#2a2421', 1, cloth('#2c2622', '#3a322c')));
  fallen.position.y = 0.05;
  fallen.rotation.z = 0.05;
  widow.add(fallen);
  const raised = tent(r, 5, 3.6);
  raised.visible = false;
  widow.add(raised);
  g.add(shadowed(widow));

  // Well and trough.
  const w = well();
  w.position.set(6, 0, 2);
  g.add(w);
  block(6, 2, 2.4, 2.4);
  const trough = new THREE.Group();
  trough.position.set(9.5, 0, 2);
  const tr = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 3.2), mat('#7d6a52', 1, stoneBlocks(8)));
  tr.position.y = 0.25;
  trough.add(tr);
  const troughWater = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 3.0), new THREE.MeshStandardMaterial({ color: '#35606a', roughness: 0.1 }));
  troughWater.position.y = 0.1;
  trough.add(troughWater);
  g.add(shadowed(trough));
  block(9.5, 2, 1, 3.3);

  const camels: THREE.Group[] = [];
  for (const [x, z, ry] of [[12.5, -0.5, 2.9], [12.8, 2, 3.3], [15.5, -3, 2.4], [16.8, 0.8, 3.6]] as const) {
    const c = camel(r() > 0.5 ? '#b38a5a' : '#a07a4e');
    c.position.set(x, 0, z);
    c.rotation.y = ry;
    g.add(c);
    camels.push(c);
  }
  for (let i = 0; i < 14; i++) {
    const t = acacia(r);
    const a = r() * Math.PI * 2, d = 26 + r() * 40;
    t.position.set(Math.cos(a) * d, 0, Math.sin(a) * d - 10);
    g.add(t);
  }

  // The road toward Mecca leaves the camp to the south (−z) and ends at a night camp.
  const roadTex = stoneBlocks(13).clone();
  roadTex.needsUpdate = true;
  roadTex.repeat.set(1, 30);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(3, 100), new THREE.MeshStandardMaterial({ map: roadTex, color: '#b5946c', roughness: 1 }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.02, -78);
  road.receiveShadow = true;
  g.add(road);
  for (let i = 0; i < 18; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + r() * 1.2), mat('#6e5844', 1));
    const side = r() > 0.5 ? 1 : -1;
    rock.position.set(side * (4 + r() * 12), 0.2, -32 - r() * 90);
    rock.rotation.set(r(), r(), r());
    g.add(shadowed(rock));
  }
  // Night camp: fire ring, a resting camel.
  const fireGroup = new THREE.Group();
  fireGroup.position.set(0, 0, -124);
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18), mat('#5b4a3a'));
    const a = (i / 8) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.55, 0.1, Math.sin(a) * 0.55);
    fireGroup.add(s);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 8), new THREE.MeshBasicMaterial({ color: '#ffb347', toneMapped: false }));
  flame.position.y = 0.4;
  fireGroup.add(flame);
  const fire = new THREE.PointLight('#ff9a4a', 0, 18, 1.6);
  fire.position.y = 1.2;
  fireGroup.add(fire);
  g.add(fireGroup);
  const restCamel = camel('#a8825a');
  restCamel.position.set(3.5, -0.6, -127);
  restCamel.rotation.y = 1.2;
  g.add(restCamel);

  return {
    group: g,
    colliders,
    ground,
    camels,
    fire,
    points: {
      spawn: v3(2, 0, 8),
      well: v3(6, 0, 4.2),
      trough: v3(8.4, 0, 2),
      widowTent: v3(-9, 0, 11.5),
      widow: v3(-12, 0, 12),
      pole1: v3(-18, 0, 2),
      pole2: v3(-3, 0, 20),
      pole3: v3(-15, 0, 22),
      abuDharr: v3(-2, 0, -21),
      unaysStart: v3(0, 0, -60),
      unaysEnd: v3(-0.5, 0, -19),
      roadStart: v3(0, 0, -28),
      nightCamp: v3(0, 0, -121),
    },
    raiseTent() {
      fallen.visible = false;
      raised.visible = true;
      block(-9, 14, 4.5, 3.4);
    },
    setTrough(level: number) {
      troughWater.position.y = 0.1 + level * 0.3;
    },
    update(_dt, t) {
      flame.scale.set(1 + Math.sin(t * 13) * 0.1, 1 + Math.sin(t * 9) * 0.2, 1);
      if (fire.intensity > 0) fire.intensity = 26 + Math.sin(t * 17) * 4;
      for (const [i, c] of camels.entries()) {
        const head = c.children[0]?.userData.head as THREE.Object3D | undefined; // only the stand-in has one
        if (head) head.position.y = 2.62 + Math.sin(t * 1.3 + i) * 0.05;
      }
    },
  };
}

// ====================================================================== Mecca
export interface MeccaValley extends SceneBase {
  /** Waypoints for Ali's careful walk from his house to where the Prophet was. */
  route: THREE.Vector3[];
  /** Men of Quraysh watching the streets during the walk. */
  watchers: { pos: THREE.Vector3; facing: number }[];
  wallSlots: THREE.Vector3[];
  stones: THREE.Vector3[];
  placeStone(i: number): void;
  lamps: THREE.PointLight[];
}

/** The Kaaba as rebuilt by Quraysh around 605 CE. */
function kaaba() {
  const k = new THREE.Group();
  const W = 10, D = 12, H = 9;
  // Alternating courses of grey stone and dark timber.
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  const courses = 16;
  for (let i = 0; i < courses; i++) {
    const y = (i / courses) * 512;
    const h = 512 / courses;
    if (i % 3 === 2) {
      ctx.fillStyle = '#3d2b1d';
      ctx.fillRect(0, y, 256, h);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let x = 0; x < 256; x += 9) ctx.fillRect(x, y, 1, h);
    } else {
      ctx.fillStyle = '#6f6a62';
      ctx.fillRect(0, y, 256, h);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      const off = (i % 2) * 18;
      for (let x = -off; x < 256; x += 36) ctx.fillRect(x, y, 2, h);
      ctx.fillRect(0, y + h - 2, 256, 2);
      for (let n = 0; n < 120; n++) {
        ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},0.06)`;
        ctx.fillRect(Math.random() * 256, y + Math.random() * h, 3, 2);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  body.position.y = H / 2;
  k.add(body);
  // A plain striped cloth hung over the upper walls (natural tones; not the later black kiswa).
  const drape = cloth('#b9a17a', '#8a6a48');
  const drapeMat = new THREE.MeshStandardMaterial({ map: drape, roughness: 1, side: THREE.DoubleSide });
  for (const [w, x, z, ry] of [[W, 0, D / 2 + 0.05, 0], [W, 0, -D / 2 - 0.05, Math.PI], [D, W / 2 + 0.05, 0, Math.PI / 2], [D, -W / 2 - 0.05, 0, -Math.PI / 2]] as const) {
    const geo = new THREE.PlaneGeometry(w + 0.2, 3.6, 24, 4);
    const p = geo.attributes.position!;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 2.2) * 0.06 * (1.8 - p.getY(i)) * 0.5);
    geo.computeVertexNormals();
    const panel = new THREE.Mesh(geo, drapeMat);
    panel.position.set(x, H - 1.8, z);
    panel.rotation.y = ry;
    k.add(panel);
  }
  // Raised wooden door on the east face.
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.1), new THREE.MeshStandardMaterial({ map: wood(), color: '#6a4a2c', roughness: 0.8 }));
  door.position.set(W / 2 + 0.08, 3.4, 1.5);
  door.rotation.y = Math.PI / 2;
  k.add(door);
  // The low curved wall of the Hijr on the north side.
  const hijr = new THREE.Mesh(new THREE.TorusGeometry(5, 0.35, 6, 24, Math.PI), new THREE.MeshStandardMaterial({ map: stoneBlocks(4), color: '#8d8174', roughness: 0.95 }));
  hijr.rotation.x = -Math.PI / 2;
  hijr.position.set(0, 0.5, -D / 2);
  hijr.scale.z = 3;
  k.add(hijr);
  return shadowed(k);
}

export function buildMeccaValley(): MeccaValley {
  const g = new THREE.Group();
  const colliders: Collider[] = [];
  const r = rng(11);
  const ground = addGround(g, '#d8bd94');
  addHills(g, r, '#5f4a3a', 110, 30);
  const block = (x: number, z: number, w: number, d: number) => colliders.push({ min: new THREE.Vector2(x - w / 2, z - d / 2), max: new THREE.Vector2(x + w / 2, z + d / 2) });

  // Open court around the House.
  const courtTex = sand().clone();
  courtTex.needsUpdate = true;
  courtTex.repeat.set(12, 12);
  const court = new THREE.Mesh(new THREE.CircleGeometry(21, 48), new THREE.MeshStandardMaterial({ map: courtTex, color: '#e8d2ad', roughness: 1 }));
  court.rotation.x = -Math.PI / 2;
  court.position.y = 0.02;
  court.receiveShadow = true;
  g.add(court);
  g.add(kaaba());
  block(0, 0, 10.6, 12.6);

  // Zamzam.
  const zam = well(false);
  zam.position.set(9, 0, -9);
  g.add(zam);
  block(9, -9, 2.4, 2.4);

  // Ali's careful route through the lanes, from his house (east) to the house where the Prophet was (north-west).
  const route = [v3(42, 0, -6), v3(34, 0, -18), v3(22, 0, -30), v3(8, 0, -40), v3(-8, 0, -44), v3(-20, 0, -52), v3(-26.5, 0, -57)];
  const nearRoute = (x: number, z: number, m: number) => {
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i]!, b = route[i + 1]!;
      const ab = new THREE.Vector2(b.x - a.x, b.z - a.z);
      const t = THREE.MathUtils.clamp(((x - a.x) * ab.x + (z - a.z) * ab.y) / ab.lengthSq(), 0, 1);
      if (Math.hypot(x - (a.x + ab.x * t), z - (a.z + ab.y * t)) < m) return true;
    }
    return false;
  };

  // Houses: flat-roofed stone and mud brick, crowding the court, leaving the route and lanes clear.
  const colors = ['#b8976f', '#c4a47c', '#a98a66', '#bfa07a', '#b08a62'];
  const stoneTex = stoneBlocks();
  const keepClear = (x: number, z: number, w: number, d: number) => {
    const rad = Math.max(w, d) / 2 + 2.2;
    if (Math.hypot(x, z) < 22 + rad * 0.6) return true; // the court
    if (nearRoute(x, z, rad)) return true;
    if (Math.abs(x) < 3 + w / 2 && z > 18 && z < 60) return true; // south lane to the market
    if (Math.abs(z) < 3 + d / 2 && x > 18 && x < 50 && !(x > 38)) return true; // east lane to Ali's house
    if (Math.hypot(x - 42, z + 2) < 6) return true; // Ali's house plot
    if (Math.hypot(x + 32, z + 64) < 7) return true; // the meeting house plot
    if (x > -26 && x < -10 && z > 26 && z < 40) return true; // the poor man's yard
    return false;
  };
  for (let gx = -70; gx <= 70; gx += 9) {
    for (let gz = -80; gz <= 60; gz += 9) {
      const w = 5 + r() * 3, d = 5 + r() * 3;
      const x = gx + (r() - 0.5) * 2, z = gz + (r() - 0.5) * 2;
      if (Math.hypot(x, z + 10) > 78 || keepClear(x, z, w, d)) continue;
      const h = 3.2 + r() * 3;
      const house = new THREE.Group();
      const useStone = r() > 0.6;
      const m = new THREE.MeshStandardMaterial({ map: useStone ? stoneTex : plaster(colors[Math.floor(r() * colors.length)]!, Math.floor(r() * 9)), roughness: 0.95 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.y = h / 2;
      house.add(b);
      const parapet = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.3, d + 0.2), mat('#9d7e5c'));
      parapet.position.y = h + 0.15;
      house.add(parapet);
      // Roof beams poking out.
      for (let i = 0; i < 4; i++) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.5), mat('#4a3322'));
        beam.position.set(-w / 2 + 0.6 + i * ((w - 1.2) / 3), h - 0.4, d / 2 + 0.2);
        house.add(beam);
      }
      const houseProp = prop('house', shadowed(house), h + 0.3, { fit: 'width', width: Math.max(w, d) });
      houseProp.position.set(x, 0, z);
      g.add(houseProp);
      block(x, z, w, d);
    }
  }

  // Ali's house and the meeting house: modest, with doors facing the route.
  const special = (x: number, z: number, ry: number) => {
    const h = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 6), new THREE.MeshStandardMaterial({ map: plaster('#c9ab83', 4), roughness: 0.95 }));
    b.position.y = 2;
    h.add(b);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 0.1), mat('#5a3e26', 0.8, wood()));
    door.position.set(0, 1.05, 3.05);
    h.add(door);
    const lamp = new THREE.PointLight('#ffb35a', 0, 9, 1.8);
    lamp.position.set(0.9, 2.4, 3.5);
    h.add(lamp);
    h.position.set(x, 0, z);
    h.rotation.y = ry;
    g.add(shadowed(h));
    block(x, z, 7, 7);
    return lamp;
  };
  const lamps = [special(46, -2, -Math.PI / 2 + 0.4), special(-34, -66, Math.PI * 0.25)];
  // A palm-frond shade before the meeting house, where the Prophet sits.
  const shade = new THREE.Group();
  const frond = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 3.4), mat('#8a7a4a', 1));
  frond.position.y = 2.5;
  shade.add(frond);
  for (const [px, pz] of [[-1.9, -1.5], [1.9, -1.5], [-1.9, 1.5], [1.9, 1.5]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.5, 7), mat('#6a5034', 1));
    post.position.set(px!, 1.25, pz!);
    shade.add(post);
  }
  const mat2 = new THREE.Mesh(new THREE.BoxGeometry(3, 0.04, 2.2), mat('#7a2e22', 1, cloth('#7a2e22', '#c7963e')));
  mat2.position.y = 0.03;
  shade.add(mat2);
  const shadeProp = prop('shade', shadowed(shade), 2.8, { fit: 'width', width: 4.4 });
  shadeProp.position.set(-29.4, 0, -61.4);
  shadeProp.rotation.y = Math.PI * 0.25;
  g.add(shadeProp);

  // Market lane south of the court.
  const stallCloth = [cloth('#a8452a', '#d9a046'), cloth('#2f5a6a', '#d8c39a'), cloth('#6a4a2a', '#e0c08a')];
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    const z = 26 + Math.floor(i / 2) * 9;
    const stall = new THREE.Group();
    const awning = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.05, 2.4), new THREE.MeshStandardMaterial({ map: stallCloth[i % 3]!, roughness: 1, side: THREE.DoubleSide }));
    awning.position.y = 2.3;
    awning.rotation.x = 0.12 * side;
    stall.add(awning);
    for (const [px, pz] of [[-1.6, -1.1], [1.6, -1.1], [-1.6, 1.1], [1.6, 1.1]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.3, 6), mat('#5a4029'));
      pole.position.set(px!, 1.15, pz!);
      stall.add(pole);
    }
    for (let j = 0; j < 4; j++) {
      const jar = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat(['#a0643a', '#8a5a34', '#c49a5a', '#7a4a2a'][j]!));
      jar.scale.y = 1.25;
      jar.position.set(-1 + j * 0.7, 0.28, 0);
      stall.add(jar);
    }
    const stallProp = prop('stall', shadowed(stall), 2.6, { fit: 'width', width: 3.6 });
    stallProp.position.set(side * 5.5, 0, z);
    g.add(stallProp);
    block(side * 5.5, z, 3.4, 2.4);
  }

  // The poor man's yard: a broken wall with five gaps, stones lying around.
  const wallSlots = [v3(-21, 0, 33), v3(-19.4, 0, 33), v3(-17.8, 0, 33), v3(-16.2, 0, 33), v3(-14.6, 0, 33)];
  const wallMat = new THREE.MeshStandardMaterial({ map: stoneBlocks(2), color: '#9c8a72', roughness: 0.95 });
  const baseWall = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.9, 0.6), wallMat);
  baseWall.position.set(-17.8, 0.45, 33);
  g.add(shadowed(baseWall));
  block(-17.8, 33, 8.4, 0.7);
  const slotMeshes = wallSlots.map((p) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 0.6), wallMat);
    m.position.set(p.x, 1.35, p.z);
    m.visible = false;
    g.add(shadowed(m));
    return m;
  });
  const hut = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), new THREE.MeshStandardMaterial({ map: plaster('#b08a62', 2), roughness: 1 }));
  hut.position.set(-18, 1.5, 37.5);
  g.add(shadowed(hut));
  block(-18, 37.5, 5, 4);
  const stones = [v3(-24, 0, 28), v3(-12, 0, 27), v3(-26, 0, 34), v3(-10, 0, 31), v3(-22, 0, 25)];

  return {
    group: g,
    colliders,
    ground,
    route,
    lamps,
    wallSlots,
    stones,
    watchers: [
      { pos: v3(30, 0, -26), facing: -2.2 },
      { pos: v3(4, 0, -34), facing: 0.6 },
      { pos: v3(-18, 0, -44), facing: 2.6 },
    ],
    points: {
      arrive: v3(0, 0, 50),
      kaabaFront: v3(7.6, 0, 6),
      abuDharrRest: v3(6.4, 0, 8),
      zamzam: v3(9, 0, -6.6),
      thirsty: v3(-12, 0, 14),
      poorMan: v3(-18, 0, 30.5),
      aliHouse: v3(42, 0, -6),
      meeting: v3(-26.5, 0, -57),
      prophetSeat: v3(-29.4, 0, -61.4),
      crowd: v3(4, 0, 18),
    },
    placeStone(i: number) {
      slotMeshes[i]!.visible = true;
    },
    update() {},
  };
}

// ====================================================================== shared props
function palm(r: () => number, h = 6 + r() * 4) {
  return prop('palm', palmStandIn(r, h), h + 1.5);
}
function palmStandIn(r: () => number, h: number) {
  const p = new THREE.Group();
  const trunkMat = mat('#6b5236', 1);
  const segs = 7;
  const lean = (r() - 0.5) * 0.25;
  for (let i = 0; i < segs; i++) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.17 - i * 0.008, 0.2 - i * 0.008, h / segs, 7), trunkMat);
    s.position.set(lean * i * 0.6, h / segs / 2 + (i * h) / segs, 0);
    p.add(s);
  }
  const top = new THREE.Vector3(lean * segs * 0.6, h, 0);
  const frondMat = new THREE.MeshStandardMaterial({ color: '#5f7a3a', roughness: 1, side: THREE.DoubleSide });
  for (let i = 0; i < 10; i++) {
    const geo = new THREE.PlaneGeometry(0.5, 3.2, 1, 6);
    const pos = geo.attributes.position!;
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k) + 1.6;
      pos.setZ(k, -0.12 * y * y);
      pos.setX(k, pos.getX(k) * (1 - y / 3.6));
    }
    geo.translate(0, 1.6, 0);
    const f = new THREE.Mesh(geo, frondMat);
    f.position.copy(top);
    f.rotation.set(-1.1 + r() * 0.3, (i / 10) * Math.PI * 2, 0, 'YXZ');
    p.add(f);
  }
  return shadowed(p);
}

function blackRocks(g: THREE.Group, r: () => number, cx: number, cz: number, spread: number, n: number) {
  const m = mat('#2b2622', 1);
  for (let i = 0; i < n; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + r() * 1.6), m);
    rock.position.set(cx + (r() - 0.5) * spread, 0.2, cz + (r() - 0.5) * spread);
    rock.rotation.set(r(), r(), r());
    rock.scale.y = 0.5;
    g.add(shadowed(rock));
  }
}

// ====================================================================== Medina
export interface MedinaScene extends SceneBase {
  gates: THREE.Vector3[];
  openGate(i: number): void;
}

export function buildMedina(): MedinaScene {
  const g = new THREE.Group();
  const colliders: Collider[] = [];
  const r = rng(23);
  const ground = addGround(g, '#c9b089', 50, 120);
  const block = (x: number, z: number, w: number, d: number) => colliders.push({ min: new THREE.Vector2(x - w / 2, z - d / 2), max: new THREE.Vector2(x + w / 2, z + d / 2) });
  // Mount Uhud to the north, a long red-brown ridge; low hills elsewhere.
  const uhud = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), new THREE.MeshStandardMaterial({ color: '#8a4f34', roughness: 1, flatShading: true }));
  uhud.scale.set(160, 45, 40);
  uhud.position.set(0, -6, -230);
  g.add(uhud);
  addHills(g, r, '#7a6048', 200, 18);
  blackRocks(g, r, -60, 20, 40, 30);
  blackRocks(g, r, 70, -10, 40, 30);

  // The Prophet's mosque: mud-brick walls, an open court, a roof of palm fronds on palm-trunk pillars.
  const brick = new THREE.MeshStandardMaterial({ map: plaster('#a88a64', 6), roughness: 1 });
  const W = 34, D = 30, H = 2.6, cx = 0, cz = -10;
  const wall = (x: number, z: number, w: number, d: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), brick);
    m.position.set(x, H / 2, z);
    g.add(shadowed(m));
    block(x, z, w, d);
  };
  // North wall (back), east and west walls with doorways, south wall with a wide door.
  wall(cx, cz - D / 2, W, 0.7);
  wall(cx - W / 2, cz - 6, 0.7, D - 12);
  wall(cx - W / 2, cz + D / 2 - 2.5, 0.7, 5);
  wall(cx + W / 2, cz - 6, 0.7, D - 12);
  wall(cx + W / 2, cz + D / 2 - 2.5, 0.7, 5);
  wall(cx - 10, cz + D / 2, W / 2 - 3, 0.7);
  wall(cx + 10, cz + D / 2, W / 2 - 3, 0.7);
  const trunk = mat('#6b5236', 1);
  const fronds = new THREE.Mesh(new THREE.BoxGeometry(W - 1, 0.18, 8), mat('#8a7a4a', 1));
  fronds.position.set(cx, H + 0.4, cz - D / 2 + 4.5);
  g.add(shadowed(fronds));
  for (let i = 0; i < 8; i++) {
    for (const row of [0, 1]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, H + 0.4, 7), trunk);
      col.position.set(cx - W / 2 + 2.5 + i * ((W - 5) / 7), (H + 0.4) / 2, cz - D / 2 + 2 + row * 5);
      g.add(shadowed(col));
    }
  }
  // The shaded platform at the back, where the poor of the community stayed.
  const suffa = new THREE.Mesh(new THREE.BoxGeometry(10, 0.35, 4), mat('#9c8262', 1));
  suffa.position.set(cx + 10, 0.17, cz - D / 2 + 2.4);
  g.add(shadowed(suffa));

  // Houses around the mosque.
  const colors = ['#b8976f', '#a98a66', '#bfa07a'];
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = 32 + r() * 34;
    const x = Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (z > 18 && Math.abs(x) < 10) continue; // keep the southern approach clear
    if (x > 24 && x < 60 && z > -60 && z < -20) continue; // the north-east garden
    const w = 5 + r() * 3, dd = 5 + r() * 3, h = 3 + r() * 1.5;
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), new THREE.MeshStandardMaterial({ map: plaster(colors[i % 3]!, i), roughness: 1 }));
    box.position.y = h / 2;
    const house = prop('house', shadowed(box), h + 0.3, { fit: 'width', width: Math.max(w, dd) });
    house.position.set(x, 0, z);
    g.add(house);
    block(x, z, w, dd);
  }
  // Clan towers (atam).
  for (const [x, z] of [[-48, -40], [52, 10], [-30, 40]] as const) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(5, 9, 5), new THREE.MeshStandardMaterial({ map: stoneBlocks(6), color: '#8d7a62', roughness: 1 }));
    t.position.set(x, 4.5, z);
    g.add(shadowed(t));
    block(x, z, 5, 5);
  }
  // Palm groves everywhere outside the town core.
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, d = 28 + r() * 70;
    const x = Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (z > 18 && Math.abs(x) < 8) continue;
    const p = palm(r);
    p.position.set(x, 0, z);
    g.add(p);
  }
  // The south garden: three irrigation channels with wooden gates.
  const water = new THREE.MeshStandardMaterial({ color: '#3b6a74', roughness: 0.15 });
  const channels: THREE.Mesh[] = [];
  const gates: THREE.Vector3[] = [];
  const gateMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const x = -26 + i * 6;
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 16), mat('#6a5640'));
    ch.position.set(x, 0.02, 34);
    g.add(ch);
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 16), water);
    w.position.set(x, 0.04, 34);
    w.scale.z = 0.02;
    g.add(w);
    channels.push(w);
    const gate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.12), mat('#5a4029', 0.9, wood()));
    gate.position.set(x, 0.35, 25.6);
    g.add(shadowed(gate));
    gateMeshes.push(gate);
    gates.push(v3(x, 0, 24.6));
    for (let k = 0; k < 4; k++) {
      const p = palm(r, 4 + r() * 2);
      p.position.set(x + (k % 2 ? 1.6 : -1.6), 0, 29 + k * 3);
      g.add(p);
    }
  }
  // The north-east garden, where the Prophet rests under a palm.
  for (let i = 0; i < 12; i++) {
    const p = palm(r);
    p.position.set(36 + (i % 4) * 5 + r() * 2, 0, -46 + Math.floor(i / 4) * 6 + r() * 2);
    g.add(p);
  }
  const lowWall = new THREE.Mesh(new THREE.BoxGeometry(26, 1.2, 0.5), brick);
  lowWall.position.set(44, 0.6, -28);
  g.add(shadowed(lowWall));
  block(48, -28, 18, 0.6);

  return {
    group: g,
    colliders,
    ground,
    gates,
    points: {
      arrive: v3(0, 0, 60),
      dates: v3(12, 0, 20),
      suffa: v3(10, 0, -21.5),
      northGarden: v3(40, 0, -32),
      prophetRest: v3(44, 0, -40),
      mosqueDoor: v3(0, 0, 7),
      prophetSeat: v3(-4, 0, -21.8),
      aliSeat: v3(-2.4, 0, -21.4),
      abuDharrSeat: v3(-3.2, 0, -18.6),
    },
    openGate(i: number) {
      gateMeshes[i]!.position.y = 1.1;
      channels[i]!.scale.z = 1;
    },
    update() {},
  };
}

// ====================================================================== the road to Tabuk
export interface TabukScene extends SceneBase {
  path: THREE.Vector3[];
  wells: THREE.Vector3[];
  setStorm(amount: number): void;
  dustAt(p: THREE.Vector3): void;
  armyCamp: THREE.Vector3;
}

export function buildTabuk(): TabukScene {
  const g = new THREE.Group();
  const colliders: Collider[] = [];
  const r = rng(31);
  const ground = addGround(g, '#d7a873', 70, 260);
  // Sandstone mesas and black basalt hills along the way.
  const sand = new THREE.MeshStandardMaterial({ color: '#b9773f', roughness: 1, flatShading: true });
  const basalt = new THREE.MeshStandardMaterial({ color: '#3a302a', roughness: 1, flatShading: true });
  for (let i = 0; i < 40; i++) {
    const side = i % 2 ? 1 : -1;
    const z = 20 - i * 12 - r() * 6;
    const x = side * (25 + r() * 60);
    const mesa = new THREE.Mesh(new THREE.CylinderGeometry(6 + r() * 10, 9 + r() * 12, 10 + r() * 22, 6 + Math.floor(r() * 3)), r() > 0.3 ? sand : basalt);
    mesa.position.set(x, 4, z);
    mesa.rotation.y = r() * Math.PI;
    g.add(shadowed(mesa));
  }
  for (let i = 0; i < 60; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + r() * 1.3), r() > 0.5 ? basalt : sand);
    rock.position.set((r() > 0.5 ? 1 : -1) * (4 + r() * 18), 0.2, 10 - r() * 470);
    rock.rotation.set(r(), r(), r());
    g.add(shadowed(rock));
  }
  // The track: a winding path south to north (−z).
  const path: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) path.push(v3(Math.sin(i * 0.55) * 7, 0, 10 - i * 19));
  const track = mat('#c49565', 1);
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!, b = path[i + 1]!;
    const len = a.distanceTo(b);
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(3, len + 0.5), track);
    seg.rotation.x = -Math.PI / 2;
    seg.rotation.z = -Math.atan2(b.x - a.x, -(b.z - a.z));
    seg.position.set((a.x + b.x) / 2, 0.025, (a.z + b.z) / 2);
    seg.receiveShadow = true;
    g.add(seg);
  }
  // Wells along the way.
  const wells = [path[6]!.clone().add(v3(4, 0, 0)), path[13]!.clone().add(v3(-4, 0, 0)), path[19]!.clone().add(v3(4, 0, 0))];
  for (const w of wells) {
    const m = well(false);
    m.scale.setScalar(0.7);
    m.position.copy(w);
    g.add(m);
    colliders.push({ min: new THREE.Vector2(w.x - 0.9, w.z - 0.9), max: new THREE.Vector2(w.x + 0.9, w.z + 0.9) });
  }
  // The army's camp at Tabuk.
  const armyCamp = path[path.length - 1]!.clone().add(v3(0, 0, -16));
  for (let i = 0; i < 14; i++) {
    const t = tent(r, 4, 3);
    const a = (i / 14) * Math.PI * 2;
    t.position.set(armyCamp.x + Math.cos(a) * 18, 0, armyCamp.z + Math.sin(a) * 14);
    t.rotation.y = -a + Math.PI / 2;
    g.add(t);
  }
  for (let i = 0; i < 8; i++) {
    const c = camel(i % 2 ? '#b38a5a' : '#a07a4e');
    c.position.set(armyCamp.x - 26 + i * 3, 0, armyCamp.z - 6 + (i % 3));
    c.rotation.y = Math.PI / 2;
    g.add(c);
  }
  // Blowing sand for the storm.
  const count = 1500;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 60;
    pos[i * 3 + 1] = Math.random() * 8;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#d9a46a', size: 0.12, transparent: true, opacity: 0, depthWrite: false }));
  g.add(dust);
  let storm = 0;
  return {
    group: g,
    colliders,
    ground,
    path,
    wells,
    armyCamp,
    points: { start: path[0]!.clone().add(v3(2, 0, 4)), camelFalls: path[11]!.clone() },
    dustAt(p: THREE.Vector3) {
      dust.position.set(p.x, 0, p.z);
    },
    setStorm(amount: number) {
      storm = amount;
      (dust.material as THREE.PointsMaterial).opacity = amount * 0.8;
    },
    update(dt: number) {
      if (storm <= 0) return;
      const p = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        let x = p.getX(i) + dt * 14 * storm;
        if (x > 30) x -= 60;
        p.setX(i, x);
      }
      p.needsUpdate = true;
    },
  };
}

// ====================================================================== Damascus (c. 650: still a Roman city)
export function buildDamascus(): SceneBase {
  const g = new THREE.Group();
  const colliders: Collider[] = [];
  const r = rng(41);
  const ground = addGround(g, '#b9a58a', 50, 120);
  addHills(g, r, '#8d7860', 170, 20);
  const block = (x: number, z: number, w: number, d: number) => colliders.push({ min: new THREE.Vector2(x - w / 2, z - d / 2), max: new THREE.Vector2(x + w / 2, z + d / 2) });
  const lime = new THREE.MeshStandardMaterial({ map: stoneBlocks(3), color: '#d8ccb4', roughness: 0.9 });
  // The paved colonnaded street.
  const paveTex = stoneBlocks(14).clone();
  paveTex.needsUpdate = true;
  paveTex.repeat.set(3, 30);
  const pave = new THREE.Mesh(new THREE.PlaneGeometry(12, 110), new THREE.MeshStandardMaterial({ map: paveTex, color: '#c8b89c', roughness: 0.95 }));
  pave.rotation.x = -Math.PI / 2;
  pave.position.set(0, 0.03, -20);
  pave.receiveShadow = true;
  g.add(pave);
  for (let i = 0; i < 18; i++) {
    for (const side of [-1, 1]) {
      const x = side * 6.2, z = 30 - i * 6;
      if (z < -34 && z > -46) continue; // the arch
      const colGroup = new THREE.Group();
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 5.2, 12), lime);
      col.position.y = 2.6;
      colGroup.add(col);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.9), lime);
      cap.position.y = 5.35;
      colGroup.add(cap);
      const column = prop('column', shadowed(colGroup), 5.5);
      column.position.set(x, 0, z);
      g.add(column);
      block(x, z, 0.8, 0.8);
    }
  }
  // Shops behind the colonnades.
  for (const side of [-1, 1]) {
    const shops = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 100), new THREE.MeshStandardMaterial({ map: plaster('#c9b896', 7), roughness: 1 }));
    shops.position.set(side * 12.5, 2.5, -20);
    g.add(shadowed(shops));
    block(side * 12.5, -20, 6, 100);
  }
  // A Roman arch across the street.
  for (const side of [-1, 1]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(2.2, 8, 2.4), lime);
    pier.position.set(side * 4.5, 4, -40);
    g.add(shadowed(pier));
    block(side * 4.5, -40, 2.2, 2.4);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(11.2, 2, 2.4), lime);
  lintel.position.set(0, 9, -40);
  g.add(shadowed(lintel));
  // The walled precinct of the Church of St John at the far end (no mosque yet).
  const precinct = new THREE.Mesh(new THREE.BoxGeometry(40, 9, 4), lime);
  precinct.position.set(0, 4.5, -78);
  g.add(shadowed(precinct));
  block(0, -78, 40, 4);
  const basilica = new THREE.Mesh(new THREE.BoxGeometry(24, 6, 14), new THREE.MeshStandardMaterial({ color: '#a55a3a', roughness: 0.9 }));
  basilica.position.set(0, 12, -86);
  g.add(basilica);
  // Mu‘awiya's palace on the west side of the plaza.
  const palace = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 12), new THREE.MeshStandardMaterial({ map: plaster('#d6c8a8', 3), roughness: 0.9 }));
  palace.position.set(-17, 4, -4);
  g.add(shadowed(palace));
  block(-17, -4, 14, 12);
  const gate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 3), new THREE.MeshStandardMaterial({ color: '#3f5a3a', roughness: 0.6 }));
  gate.position.set(-9.85, 2, -4);
  g.add(gate);
  // Market stalls and an oven along the street.
  const stallCloth = [cloth('#a8452a', '#d9a046'), cloth('#2f5a6a', '#d8c39a'), cloth('#6a4a2a', '#e0c08a')];
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    const z = 22 - i * 7;
    const aw = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.05, 2), new THREE.MeshStandardMaterial({ map: stallCloth[i % 3]!, roughness: 1, side: THREE.DoubleSide }));
    aw.position.set(side * 8, 2.3, z);
    g.add(aw);
  }
  const oven = new THREE.Mesh(new THREE.SphereGeometry(1.1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#8a5a3a', roughness: 1 }));
  oven.position.set(4.5, 0, 24);
  g.add(shadowed(oven));
  block(4.5, 24, 2, 2);
  for (let i = 0; i < 10; i++) {
    const t = acacia(r);
    t.position.set((r() > 0.5 ? 1 : -1) * (30 + r() * 30), 0, -r() * 80 + 20);
    g.add(t);
  }
  return {
    group: g,
    colliders,
    ground,
    points: {
      arrive: v3(0, 0, 34),
      preach: v3(2, 0, -18),
      oven: v3(3, 0, 22),
      poor1: v3(-4.5, 0, 12),
      poor2: v3(4.8, 0, -2),
      poor3: v3(-4.6, 0, -28),
      palaceGate: v3(-8.6, 0, -4),
      l1: v3(-3, 0, 18), l2: v3(4, 0, 8), l3: v3(-4, 0, -8), l4: v3(3.5, 0, -30), l5: v3(-2, 0, -50),
    },
    update() {},
  };
}

// ====================================================================== Jabal Amil (reported tradition)
export function buildJabalAmil(): SceneBase {
  const g = new THREE.Group();
  const colliders: Collider[] = [];
  const r = rng(53);
  const ground = addGround(g, '#a9a07a', 60, 140);
  const block = (x: number, z: number, w: number, d: number) => colliders.push({ min: new THREE.Vector2(x - w / 2, z - d / 2), max: new THREE.Vector2(x + w / 2, z + d / 2) });
  // The sea to the west.
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(300, 600), new THREE.MeshStandardMaterial({ color: '#3f7f95', roughness: 0.2, metalness: 0.1 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-215, 0.05, 0);
  g.add(sea);
  // Green hills to the east, terraced.
  const hillMat = new THREE.MeshStandardMaterial({ color: '#7d8a52', roughness: 1, flatShading: true });
  for (let i = 0; i < 14; i++) {
    const hill = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), hillMat);
    hill.scale.set(40 + r() * 30, 18 + r() * 20, 40 + r() * 30);
    hill.position.set(90 + r() * 80, -4, -160 + i * 25);
    g.add(hill);
  }
  const terraceMat = new THREE.MeshStandardMaterial({ map: stoneBlocks(9), color: '#b5a68a', roughness: 1 });
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(30, 0.6, 0.6), terraceMat);
    t.position.set(20 + i * 2, 0.3, -10 - i * 7);
    g.add(shadowed(t));
  }
  // Olive trees.
  const olives: THREE.Vector3[] = [];
  const oliveMat = new THREE.MeshStandardMaterial({ color: '#6c7a4a', roughness: 1 });
  for (let i = 0; i < 26; i++) {
    const x = -10 + (i % 6) * 7 + r() * 2, z = 10 - Math.floor(i / 6) * 9 + r() * 2;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 1.6, 6), mat('#5a4636', 1));
    trunk.position.y = 0.8;
    tree.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), oliveMat);
    crown.scale.set(1.2, 0.8, 1.2);
    crown.position.y = 2.2;
    tree.add(crown);
    const olive = prop('olive', shadowed(tree), 3.6 + r() * 1.2);
    olive.position.set(x, 0, z);
    g.add(olive);
    if (i % 5 === 0 && olives.length < 5) olives.push(v3(x + 1.6, 0, z));
  }
  // The olive press.
  const press = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, 0.8, 16), terraceMat);
  const pressProp = prop('press', shadowed(press), 1.6, { fit: 'width', width: 3.2 });
  press.position.y = 0.4;
  pressProp.position.set(-16, 0, 18);
  g.add(pressProp);
  block(-16, 18, 3, 3);
  // Villages: Sarafand by the sea, Mays toward the hills.
  const house = (x: number, z: number) => {
    const h = new THREE.Mesh(new THREE.BoxGeometry(5, 3.2, 5), new THREE.MeshStandardMaterial({ map: plaster('#d9cfb6', Math.floor(r() * 9)), roughness: 1 }));
    h.position.set(x, 1.6, z);
    g.add(shadowed(h));
    block(x, z, 5, 5);
  };
  for (let i = 0; i < 7; i++) house(-48 + (i % 3) * 8, 20 + Math.floor(i / 3) * 9);
  for (let i = 0; i < 7; i++) house(52 + (i % 3) * 8, -66 - Math.floor(i / 3) * 9);
  for (let i = 0; i < 3; i++) {
    const boat = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 1.4), mat('#6a4a2c'));
    boat.position.set(-66, 0.3, 14 + i * 6);
    g.add(boat);
  }
  // The broken terrace wall (four gaps).
  const slots = [v3(4, 0, -22), v3(6, 0, -22), v3(8, 0, -22), v3(10, 0, -22)];
  const slotMeshes = slots.map((p) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 0.6), terraceMat);
    m.position.set(p.x, 0.35, p.z);
    m.visible = false;
    g.add(shadowed(m));
    return m;
  });
  const stones = [v3(0, 0, -18), v3(13, 0, -19), v3(2, 0, -27), v3(12, 0, -27)];
  return {
    group: g,
    colliders,
    ground,
    points: {
      arrive: v3(-40, 0, 4),
      sarafand: v3(-38, 0, 12),
      press: v3(-13.6, 0, 18),
      mays: v3(48, 0, -56),
      o1: olives[0]!, o2: olives[1]!, o3: olives[2]!, o4: olives[3]!, o5: olives[4]!,
      t1: stones[0]!, t2: stones[1]!, t3: stones[2]!, t4: stones[3]!,
      wall: v3(7, 0, -20.8),
    },
    update() {},
    // Expose the wall slots through userData for the chapter.
    ...{ placeSlot: (i: number) => (slotMeshes[i]!.visible = true) },
  } as SceneBase & { placeSlot(i: number): void };
}

// ====================================================================== al-Rabadhah
export function sheep() {
  return prop('sheep', sheepStandIn(), 0.95);
}
function sheepStandIn() {
  const s = new THREE.Group();
  const wool = mat('#e8e0d0', 1);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), wool);
  body.scale.set(1.3, 0.9, 0.9);
  body.position.y = 0.6;
  s.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), mat('#3a302a', 1));
  head.position.set(0.6, 0.75, 0);
  s.add(head);
  for (const [x, z] of [[0.3, 0.2], [0.3, -0.2], [-0.3, 0.2], [-0.3, -0.2]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 5), mat('#3a302a', 1));
    leg.position.set(x!, 0.2, z!);
    s.add(leg);
  }
  return shadowed(s);
}

export function buildRabadhah(): SceneBase {
  const g = new THREE.Group();
  const colliders: Collider[] = [];
  const r = rng(61);
  const ground = addGround(g, '#c9a97c', 60, 160);
  addHills(g, r, '#8a6a52', 190, 22);
  blackRocks(g, r, 30, -40, 50, 25);
  const block = (x: number, z: number, w: number, d: number) => colliders.push({ min: new THREE.Vector2(x - w / 2, z - d / 2), max: new THREE.Vector2(x + w / 2, z + d / 2) });
  const hut = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), new THREE.MeshStandardMaterial({ map: plaster('#a88a64', 5), roughness: 1 }));
  hut.position.set(-4, 1.5, -6);
  g.add(shadowed(hut));
  block(-4, -6, 5, 4);
  const t = tent(r, 4, 3);
  t.position.set(3, 0, -7);
  g.add(t);
  block(3, -7, 4, 3);
  const w = well();
  w.position.set(8, 0, 4);
  g.add(w);
  block(8, 4, 2.4, 2.4);
  for (let i = 0; i < 12; i++) {
    const a = acacia(r);
    a.position.set((r() - 0.5) * 120, 0, (r() - 0.5) * 120);
    if (a.position.length() < 14) continue;
    g.add(a);
  }
  const jars = prop('jars', new THREE.Group(), 0.9);
  jars.position.set(-1, 0, -3.6);
  g.add(jars);
  // The road to Iraq, east.
  const road = new THREE.Mesh(new THREE.PlaneGeometry(140, 2.6), mat('#b8966a', 1));
  road.rotation.x = -Math.PI / 2;
  road.position.set(70, 0.025, 10);
  road.receiveShadow = true;
  g.add(road);
  // A low grave mound, hidden until the end.
  const grave = new THREE.Mesh(new THREE.SphereGeometry(1.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#9a7a58', 1));
  grave.scale.set(1.6, 0.4, 0.8);
  grave.position.set(-10, 0, 6);
  grave.visible = false;
  g.add(grave);
  return {
    group: g,
    colliders,
    ground,
    points: {
      arrive: v3(0, 0, 14),
      hut: v3(-4, 0, -3.4),
      well: v3(8, 0, 6.4),
      roadWatch: v3(14, 0, 10),
      caravanStart: v3(120, 0, 10),
      grave: v3(-10, 0, 6),
      s1: v3(-20, 0, 18), s2: v3(22, 0, -18), s3: v3(-24, 0, -20), s4: v3(18, 0, 26),
    },
    update() {},
    ...{ showGrave: () => (grave.visible = true) },
  } as SceneBase & { showGrave(): void };
}
