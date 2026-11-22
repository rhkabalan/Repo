/**
 * Scenes for companion chapter 1. Built procedurally to the period look in
 * docs/research/locations.md: Ghifar's goat-hair tents and wells; Mecca's barren granite valley
 * with the Kaaba as rebuilt by Quraysh c. 605 (courses of stone and timber, a plain cloth cover,
 * raised door), houses crowding an open court, and Zamzam. No mosque, colonnades or minarets.
 */
import * as THREE from 'three';
import type { Collider } from '../game/mecca';
import { cloth, plaster, sand, stoneBlocks, wood } from '../game/textures';

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
  for (const [x, z, ry] of [[12.5, 0, 2.9], [12.8, 3.6, 3.3], [15, -2, 2.4], [16, 5, 3.6]] as const) {
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
      for (const [i, c] of camels.entries()) (c.userData.head as THREE.Object3D).position.y = 2.62 + Math.sin(t * 1.3 + i) * 0.05;
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
  const route = [v3(42, 0, -6), v3(34, 0, -18), v3(22, 0, -30), v3(8, 0, -40), v3(-8, 0, -44), v3(-20, 0, -52), v3(-30, 0, -60)];
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
      house.position.set(x, 0, z);
      g.add(shadowed(house));
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
    stall.position.set(side * 5.5, 0, z);
    g.add(shadowed(stall));
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
      meeting: v3(-30, 0, -60),
      prophetSeat: v3(-31.2, 0, -63.4),
      crowd: v3(4, 0, 18),
    },
    placeStone(i: number) {
      slotMeshes[i]!.visible = true;
    },
    update() {},
  };
}
