import * as THREE from 'three';
import { cloth, plaster, sand, stoneBlocks, wood } from './textures';

/**
 * Mecca adventure district: Training Yard → Market Lane (side alley → Back Alley →
 * Collapsed Passage) → the plaza held by extortioners → Meeting Courtyard.
 * These are gameplay spaces, not reconstructions of specific historical locations.
 * The Kaaba is intentionally not modelled here; it needs dedicated, reviewed treatment.
 */

export interface Interactable {
  id: string;
  kind: 'trainer' | 'rest' | 'merchant' | 'traveler' | 'lever' | 'sideDoor' | 'discovery';
  areaId: string;
  position: THREE.Vector3;
  radius: number;
  marker?: THREE.Object3D;
}

export interface Collider {
  min: THREE.Vector2;
  max: THREE.Vector2;
  id?: string;
}

export interface EnemySpawn {
  encounterId: string;
  position: THREE.Vector3;
  facing: number;
  scan?: number;
}

export interface Environment {
  group: THREE.Group;
  interactables: Interactable[];
  colliders: Collider[];
  spawn: THREE.Vector3;
  areaAt(p: THREE.Vector3): string;
  /** Opens the courtyard gates (obstacle resolved). */
  openGate(): void;
  /** Opens the locked side door in the gate wall (other route). */
  openSideDoor(): void;
  /** Raises the counterweight gate in the back alley (puzzle solved). */
  raiseBackGate(): void;
  /** Where each collectible from the content catalog sits in the world. */
  pickups: Record<string, THREE.Vector3>;
  enemies: EnemySpawn[];
  puzzle: { origin: THREE.Vector2; cell: number; cols: number; rows: number; crates: [number, number][]; plates: [number, number][] };
  /** Reaching this zone unseen counts as sneaking past the extortioners. */
  sneakGoal: { min: THREE.Vector2; max: THREE.Vector2 };
  /** Passing through the side door counts as the other route. */
  routeGoal: { min: THREE.Vector2; max: THREE.Vector2 };
  /** Area where the extortioner encounter takes place. */
  obstacleZone: { min: THREE.Vector2; max: THREE.Vector2 };
  checkpoints: Record<string, THREE.Vector3>;
  update(dt: number, t: number): void;
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

export function buildMecca(): Environment {
  const g = new THREE.Group();
  const colliders: Collider[] = [];
  const interactables: Interactable[] = [];
  const animated: ((dt: number, t: number) => void)[] = [];
  const r = rng(42);
  const shadowed = <T extends THREE.Object3D>(o: T) => {
    o.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) c.castShadow = c.receiveShadow = true;
    });
    return o;
  };
  const box = (w: number, h: number, d: number, mat: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  const block = (x: number, z: number, w: number, d: number, id?: string) =>
    colliders.push({ min: new THREE.Vector2(x - w / 2, z - d / 2), max: new THREE.Vector2(x + w / 2, z + d / 2), id });

  // ---------- Ground ----------
  const groundTex = sand().clone();
  groundTex.needsUpdate = true;
  groundTex.repeat.set(40, 40);
  const groundGeo = new THREE.PlaneGeometry(400, 400, 200, 200);
  const pos = groundGeo.attributes.position!;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // Plane local y = -world z, so the valley centre at world z = -50 is local y = +50.
    const d = Math.hypot(x, y - 50);
    // Flat playable valley floor, rolling dunes beyond.
    const dune = d > 70 ? Math.sin(x * 0.05) * Math.cos(y * 0.04) * 2 + (d - 70) * 0.04 : 0;
    pos.setZ(i, dune + Math.sin(x * 0.7) * Math.cos(y * 0.6) * 0.03 - 0.04);
  }
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1, color: '#e4c89f' }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  g.add(ground);

  // Packed-earth path down the lane.
  const pathTex = stoneBlocks(9).clone();
  pathTex.needsUpdate = true;
  pathTex.repeat.set(2, 16);
  pathTex.repeat.set(2, 20);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(6, 62), new THREE.MeshStandardMaterial({ map: pathTex, color: '#b99a74', roughness: 0.95 }));
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.03, -27);
  // Training yard and back alley floors.
  for (const [x, z, w, d, rep] of [[0, 9.5, 19, 14, 6], [13.5, -31, 6, 50, 14], [7, -26.2, 7, 6, 3], [0, -52.7, 32, 10, 8]] as const) {
    const t = stoneBlocks(11).clone();
    t.needsUpdate = true;
    t.repeat.set(w / 3, rep);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, color: '#c4a37c', roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(x, 0.035, z);
    floor.receiveShadow = true;
    g.add(floor);
  }
  path.receiveShadow = true;
  g.add(path);

  // ---------- Mountains around the valley ----------
  const hillMat = new THREE.MeshStandardMaterial({ color: '#9c7552', roughness: 1, flatShading: true });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const dist = 150 + r() * 60;
    const hgt = 25 + r() * 45;
    const hill = new THREE.Mesh(new THREE.ConeGeometry(30 + r() * 25, hgt, 7, 3), hillMat);
    hill.position.set(Math.cos(a) * dist, hgt / 2 - 3, -50 + Math.sin(a) * dist);
    hill.rotation.y = r() * Math.PI;
    g.add(hill);
  }

  // ---------- Houses ----------
  const plasterColors = ['#c4a47c', '#b8976f', '#cdb08a', '#b08a62', '#c29d74'];
  const stoneTex = stoneBlocks();
  /** A house whose front (door, windows, awning) faces the lane. `side` is which side of the lane it sits on. */
  function house(x: number, z: number, w: number, d: number, h: number, side: 'left' | 'right', opts: HouseOpts = {}) {
    const facing = 1;
    const house = new THREE.Group();
    const col = plasterColors[Math.floor(r() * plasterColors.length)]!;
    const wallTex = plaster(col, Math.floor(r() * 5)).clone();
    wallTex.needsUpdate = true;
    wallTex.repeat.set(w / 4, h / 4);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 });
    const body = box(w, h, d, wallMat);
    body.position.y = h / 2;
    house.add(body);
    // stone plinth
    const baseTex = stoneTex.clone();
    baseTex.needsUpdate = true;
    baseTex.repeat.set(w / 2, 0.5);
    const base = box(w + 0.12, 0.9, d + 0.12, new THREE.MeshStandardMaterial({ map: baseTex, roughness: 1 }));
    base.position.y = 0.45;
    house.add(base);
    // parapet and roof beams
    const parapet = box(w + 0.2, 0.35, d + 0.2, wallMat);
    parapet.position.y = h + 0.17;
    house.add(parapet);
    const beamMat = new THREE.MeshStandardMaterial({ map: wood(), roughness: 0.9 });
    for (let bx = -w / 2 + 0.6; bx < w / 2; bx += 1.1) {
      const beam = box(0.16, 0.16, 0.5, beamMat);
      beam.position.set(bx, h - 0.4, (facing * d) / 2 + facing * 0.2);
      house.add(beam);
    }
    const front = (facing * d) / 2;
    // windows
    const darkMat = new THREE.MeshStandardMaterial({ color: '#2a1c12', roughness: 1 });
    for (let wx = -w / 2 + 1.2; wx < w / 2 - 0.8; wx += 2.2) {
      if (opts.door && Math.abs(wx) < 1.2) continue;
      const win = box(0.6, 0.8, 0.1, darkMat);
      win.position.set(wx, h * 0.62, front + facing * 0.02);
      house.add(win);
      const lintel = box(0.85, 0.12, 0.18, beamMat);
      lintel.position.set(wx, h * 0.62 + 0.48, front + facing * 0.05);
      house.add(lintel);
    }
    if (opts.door) {
      const doorFrame = box(1.6, 2.5, 0.25, new THREE.MeshStandardMaterial({ map: baseTex, roughness: 1 }));
      doorFrame.position.set(0, 1.25, front + facing * 0.05);
      house.add(doorFrame);
      const door = box(1.1, 2.1, 0.12, beamMat);
      door.position.set(0, 1.05, front + facing * 0.14);
      house.add(door);
    }
    if (opts.lantern) {
      const lantern = new THREE.Group();
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.32, 8), new THREE.MeshStandardMaterial({ color: '#ffcf7a', emissive: '#ffa53a', emissiveIntensity: 3 }));
      lantern.add(glass);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.18, 8), new THREE.MeshStandardMaterial({ color: '#3a2a1a', metalness: 0.6, roughness: 0.4 }));
      cap.position.y = 0.25;
      lantern.add(cap);
      const light = new THREE.PointLight('#ffb35c', 6, 9, 1.6);
      lantern.add(light);
      lantern.position.set(1.0, 2.7, front + facing * 0.45);
      house.add(lantern);
      animated.push((_dt, t) => (light.intensity = 5.5 + Math.sin(t * 9 + x) * 0.5 + Math.sin(t * 23) * 0.3));
    }
    if (opts.awning) {
      const aw = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.8, 8, 4), new THREE.MeshStandardMaterial({ map: cloth(opts.awning, '#efe3c8'), side: THREE.DoubleSide, roughness: 0.9 }));
      aw.position.set(-w / 4, 2.9, front + facing * 0.9);
      aw.rotation.x = -1.15;
      house.add(aw);
      for (const px of [-w / 4 - 1.6, -w / 4 + 1.6]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6), beamMat);
        pole.position.set(px, 1.3, front + facing * 1.7);
        house.add(pole);
      }
    }
    house.position.set(x, 0, z);
    house.rotation.y = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
    g.add(shadowed(house));
    block(x, z, d, w); // rotated footprint: depth along x, frontage along z
  }

  // Left (x<0) and right (x>0) rows, facing the lane.
  const laneHalf = 3.6;
  type HouseOpts = { door?: boolean; lantern?: boolean; awning?: string };
  let z = 2;
  const leftRow: [number, number, number, HouseOpts][] = [
    [7, 6, 5.5, {}],
    [8, 7, 6.5, { awning: '#8a3b2a' }],
    [9, 7, 7, { door: true, lantern: true }], // Ali's house: discovery 1
    [7, 6, 5, {}],
    [8, 7, 6, { awning: '#2f4f6b' }],
    [8, 6, 7.5, {}],
  ];
  for (const [w, d, h, opts] of leftRow) {
    house(-laneHalf - d / 2, z - w / 2, w, d, h, 'left', opts);
    z -= w + 0.4;
  }
  z = 2;
  const rightRow: [number, number, number, HouseOpts][] = [
    [8, 6, 6, { awning: '#6b5a2f' }],
    [7, 7, 5, {}],
    [9, 6, 6.5, { lantern: true }],
    [6, 6, 5.5, {}],
    [9, 7, 7, { awning: '#7a2f45' }],
    [8, 6, 6, {}],
  ];
  rightRow.forEach(([w, d, h, opts], i) => {
    // The 4th plot is the side alley into the back streets.
    if (i !== 3) house(laneHalf + d / 2, z - w / 2, w, d, h, 'right', opts);
    z -= w + 0.4;
  });

  const wallMat = new THREE.MeshStandardMaterial({ map: (() => { const t = stoneTex.clone(); t.needsUpdate = true; t.repeat.set(4, 1); return t; })(), roughness: 1 });
  // ---------- Training yard (start) ----------
  const yardWall = (x: number, z: number, w: number, d: number, h = 2.6) => {
    const m = box(w, h, d, wallMat);
    m.position.set(x, h / 2, z);
    g.add(shadowed(m));
    block(x, z, w, d);
  };
  yardWall(0, 17, 21, 1);
  yardWall(-10, 9.5, 1, 16);
  yardWall(10, 9.5, 1, 16);
  yardWall(-6.8, 2.4, 6.4, 1, 2.2);
  yardWall(6.8, 2.4, 6.4, 1, 2.2);
  // Sparring posts and a weapons rack.
  for (const [x, zz] of [[-6, 13], [6, 13], [-6.5, 6]] as const) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.7, 10), new THREE.MeshStandardMaterial({ map: wood(), roughness: 0.9 }));
    post.position.set(x, 0.85, zz);
    g.add(shadowed(post));
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 10), new THREE.MeshStandardMaterial({ map: cloth('#9a8466', '#8a7458') }));
    wrap.position.set(x, 1.2, zz);
    g.add(shadowed(wrap));
    block(x, zz, 0.4, 0.4);
  }
  const rack = box(1.8, 1.2, 0.3, new THREE.MeshStandardMaterial({ map: wood(), roughness: 0.9 }));
  rack.position.set(-9.2, 0.6, 12);
  rack.rotation.y = Math.PI / 2;
  g.add(shadowed(rack));
  // Rest point: a bench and lantern where upgrades are made.
  const bench = box(1.8, 0.45, 0.6, new THREE.MeshStandardMaterial({ map: wood(), roughness: 0.9 }));
  bench.position.set(7.8, 0.22, 6);
  g.add(shadowed(bench));
  block(7.8, 6, 1.8, 0.6);
  const fire = new THREE.PointLight('#ffb35c', 5, 8, 1.6);
  fire.position.set(7.8, 1.2, 7.2);
  g.add(fire);
  animated.push((_dt, t) => (fire.intensity = 4.5 + Math.sin(t * 11) * 0.6));
  const embers = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.4, 8), new THREE.MeshStandardMaterial({ color: '#ff9a3d', emissive: '#ff7a1a', emissiveIntensity: 2.5 }));
  embers.position.set(7.8, 0.2, 7.2);
  g.add(embers);

  // ---------- Props along the lane ----------
  const potMat = new THREE.MeshStandardMaterial({ color: '#a8643c', roughness: 0.85 });
  const potProfile = [[0, 0], [0.18, 0.02], [0.3, 0.25], [0.28, 0.5], [0.14, 0.68], [0.16, 0.76], [0, 0.76]].map(([x, y]) => new THREE.Vector2(x!, y!));
  const potGeo = new THREE.LatheGeometry(potProfile, 18);
  for (let i = 0; i < 18; i++) {
    const side = r() > 0.5 ? 1 : -1;
    const pot = new THREE.Mesh(potGeo, potMat);
    pot.position.set(side * (laneHalf - 0.4 - r() * 0.3), 0, -r() * 52);
    pot.scale.setScalar(0.7 + r() * 0.6);
    pot.castShadow = pot.receiveShadow = true;
    g.add(pot);
  }
  const crateMat = new THREE.MeshStandardMaterial({ map: wood(), roughness: 0.9 });
  for (let i = 0; i < 6; i++) {
    const c = box(0.7, 0.6, 0.7, crateMat);
    c.position.set((r() > 0.5 ? 1 : -1) * (laneHalf - 0.6), 0.3, -8 - r() * 40);
    c.rotation.y = r();
    g.add(shadowed(c));
  }

  // Palms
  function palm(x: number, z: number, h = 7) {
    const p = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 1 });
    const lean = (r() - 0.5) * 0.3;
    for (let i = 0; i < 12; i++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.17 - i * 0.006, 0.2 - i * 0.006, h / 12, 9), trunkMat);
      seg.position.set(Math.sin(lean) * i * 0.12, (i + 0.5) * (h / 12), 0);
      p.add(seg);
    }
    const leafMat = new THREE.MeshStandardMaterial({ color: '#5d7a3a', roughness: 0.8, side: THREE.DoubleSide });
    const crown = new THREE.Group();
    crown.position.set(Math.sin(lean) * 1.4, h, 0);
    for (let i = 0; i < 11; i++) {
      const leafGeo = new THREE.PlaneGeometry(0.7, 3.4, 1, 6);
      const lp = leafGeo.attributes.position!;
      for (let k = 0; k < lp.count; k++) {
        const y = lp.getY(k) + 1.7;
        lp.setZ(k, -0.08 * y * y);
        lp.setX(k, lp.getX(k) * (1 - y / 3.6));
      }
      leafGeo.translate(0, 1.7, 0);
      leafGeo.computeVertexNormals();
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.rotation.set(-1.1 + r() * 0.3, (i / 11) * Math.PI * 2, 0, 'YXZ');
      crown.add(leaf);
    }
    p.add(crown);
    animated.push((_dt, t) => (crown.rotation.z = Math.sin(t * 0.8 + x) * 0.04));
    p.position.set(x, 0, z);
    g.add(shadowed(p));
    block(x, z, 0.5, 0.5);
  }

  // ---------- Passage gate ----------
  const gateZ = -58;
  const gate = new THREE.Group();
  const gateStone = new THREE.MeshStandardMaterial({ map: (() => { const t = stoneTex.clone(); t.needsUpdate = true; t.repeat.set(1, 2); return t; })(), roughness: 1 });
  for (const side of [-1, 1]) {
    const pier = box(2.2, 6.5, 2, gateStone);
    pier.position.set(side * 3.1, 3.25, 0);
    gate.add(pier);
    if (side > 0) {
      const wall = box(14, 5.5, 1.4, gateStone);
      wall.position.set(11, 2.75, 0);
      gate.add(wall);
    } else {
      // Left wall with a small doorway for the side door (x -10..-8).
      for (const [cx, w] of [[-14.1, 8.2], [-6.1, 3.8]] as const) {
        const seg = box(w, 5.5, 1.4, gateStone);
        seg.position.set(cx, 2.75, 0);
        gate.add(seg);
      }
      const over = box(2, 2.6, 1.4, gateStone);
      over.position.set(-9, 4.2, 0);
      gate.add(over);
    }
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.55, 10, 24, Math.PI), gateStone);
  arch.position.set(0, 5.2, 0);
  gate.add(arch);
  const lintel = box(8.4, 1.0, 2, gateStone);
  lintel.position.set(0, 7.3, 0);
  gate.add(lintel);
  const doorMat = new THREE.MeshStandardMaterial({ map: wood(), roughness: 0.85 });
  const doors: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const leaf = box(2.0, 4.8, 0.25, doorMat);
    leaf.geometry.translate(side * -1.0, 0, 0);
    leaf.position.set(side * 2.0, 2.4, 0);
    gate.add(leaf);
    doors.push(leaf);
  }
  /* Symbol plinths removed in the adventure layout.
  const symbolColors = ['#ffcc55', '#d9a35f', '#5fb7d9'];
  const symbols: THREE.Mesh[] = [];
  [-2.2, 0, 2.2].forEach((sx, i) => {
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.1, 10), gateStone);
    plinth.position.set(sx, 0.55, 2.6);
    gate.add(plinth);
    const emblem = new THREE.Mesh(
      i === 0 ? new THREE.IcosahedronGeometry(0.28, 1) : i === 1 ? new THREE.ConeGeometry(0.3, 0.4, 4) : new THREE.SphereGeometry(0.26, 16, 12),
      new THREE.MeshStandardMaterial({ color: symbolColors[i], emissive: symbolColors[i], emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.2 }),
    );
    emblem.position.set(sx, 1.45, 2.6);
    gate.add(emblem);
    symbols.push(emblem);
  });
  animated.push((_dt, t) => symbols.forEach((s, i) => ((s.rotation.y = t * 0.8 + i), (s.position.y = 1.45 + Math.sin(t * 1.5 + i) * 0.06))));
  */
  gate.position.z = gateZ;
  g.add(shadowed(gate));
  block(-3.1, gateZ, 2.2, 2);
  block(3.1, gateZ, 2.2, 2);
  // Left wall split around a small locked side door (x -10..-8).
  block(-14.1, gateZ, 8.2, 1.4);
  block(-6.1, gateZ, 3.8, 1.4);
  block(-9, gateZ, 2, 1.4, 'side-door');
  block(11, gateZ, 14, 1.4);
  block(0, gateZ, 4, 0.6, 'gate');
  let gateOpen = 0;
  let gateTarget = 0;
  animated.push((dt) => {
    gateOpen += (gateTarget - gateOpen) * Math.min(1, dt * 1.5);
    doors[0]!.rotation.y = gateOpen * 1.6;
    doors[1]!.rotation.y = -gateOpen * 1.6;
  });

  // Side door (other route).
  const sideDoor = box(1.8, 2.6, 0.2, doorMat);
  sideDoor.geometry.translate(0.9, 0, 0);
  sideDoor.position.set(-9.9, 1.3, gateZ + 0.75);
  g.add(shadowed(sideDoor));
  let sideOpen = 0;
  let sideTarget = 0;
  animated.push((dt) => {
    sideOpen += (sideTarget - sideOpen) * Math.min(1, dt * 2);
    sideDoor.rotation.y = -sideOpen * 1.7;
  });
  /* Route board removed in the adventure layout.
  const board = new THREE.Group();
  const boardPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2), doorMat);
  boardPost.position.y = 1.1;
  board.add(boardPost);
  const boardFace = box(1.4, 0.9, 0.08, new THREE.MeshStandardMaterial({ map: wood(), color: '#c9a77d' }));
  boardFace.position.y = 2.0;
  board.add(boardFace);
  board.position.set(2.9, 0, -48);
  board.rotation.y = -Math.PI / 2.4;
  g.add(shadowed(board));
  */

  // ---------- Meeting Courtyard ----------
  const cz = -80;
  const courtTex = stoneBlocks(5).clone();
  courtTex.needsUpdate = true;
  courtTex.repeat.set(8, 8);
  const court = new THREE.Mesh(new THREE.PlaneGeometry(34, 38), new THREE.MeshStandardMaterial({ map: courtTex, color: '#cdb08c', roughness: 0.9 }));
  court.rotation.x = -Math.PI / 2;
  court.position.set(0, 0.04, cz);
  court.receiveShadow = true;
  g.add(court);
  // Colonnade on three sides
  const colMat = new THREE.MeshStandardMaterial({ map: plaster('#c2a47e', 2), roughness: 0.9 });
  const colGeo = new THREE.CylinderGeometry(0.32, 0.38, 4.4, 14);
  const capGeo = new THREE.BoxGeometry(0.95, 0.35, 0.95);
  const addColumn = (x: number, z: number) => {
    const c = new THREE.Mesh(colGeo, colMat);
    c.position.set(x, 2.2, z);
    const cap = new THREE.Mesh(capGeo, colMat);
    cap.position.set(x, 4.55, z);
    g.add(shadowed(c), shadowed(cap));
    block(x, z, 0.8, 0.8);
  };
  for (let x = -15; x <= 15; x += 3.75) addColumn(x, cz - 18);
  for (let zz = cz - 14.25; zz <= cz + 12; zz += 3.75) {
    addColumn(-15, zz);
    addColumn(15, zz);
  }
  // Roof beams over colonnades
  const roofMat = new THREE.MeshStandardMaterial({ map: wood(), roughness: 0.9 });
  for (const [x, zz, w, d] of [[0, cz - 19.2, 34, 3], [-16.2, cz - 3, 3, 33], [16.2, cz - 3, 3, 33]] as const) {
    const roof = box(w, 0.35, d, roofMat);
    roof.position.set(x, 4.9, zz);
    g.add(shadowed(roof));
  }
  // Outer walls of the courtyard
  for (const [x, zz, w, d] of [[0, cz - 21, 36, 1.2], [-18, cz - 3, 1.2, 36], [18, cz - 3, 1.2, 36]] as const) {
    const wall = box(w, 5.4, d, wallMat);
    wall.position.set(x, 2.7, zz);
    g.add(shadowed(wall));
    block(x, zz, w, d);
  }
  palm(-10, cz + 8);
  palm(10, cz + 8, 8);
  palm(-11, cz - 12, 7.5);
  palm(11, cz - 12, 6.5);
  palm(6.5, -30, 6);

  // ---------- Back alley ----------
  yardWall(17, -31, 1, 51, 4);
  yardWall(13.8, -5.8, 6.4, 1, 4);
  // North of the back alley (behind the first houses) is solid.
  block(13.8, -1.5, 6.4, 8);
  // Collapsed passage: rubble walls either side of a counterweight gate at z = -39.5.
  const backGate = box(5.6, 3.2, 0.3, doorMat);
  backGate.position.set(13.7, 1.6, -39.5);
  g.add(shadowed(backGate));
  block(13.7, -39.5, 6.4, 0.6, 'back-gate');
  for (const [x, zz] of [[11.2, -40.3], [16.2, -40.6], [12.4, -41.4]] as const) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + r() * 0.3), gateStone);
    rock.position.set(x, 0.4, zz);
    rock.rotation.set(r(), r(), r());
    g.add(shadowed(rock));
  }
  let backRaise = 0;
  let backTarget = 0;
  animated.push((dt) => {
    backRaise += (backTarget - backRaise) * Math.min(1, dt * 1.2);
    backGate.position.y = 1.6 + backRaise * 3.2;
  });
  const lever = new THREE.Group();
  const leverBase = box(0.5, 0.3, 0.5, gateStone);
  const leverArm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), doorMat);
  leverArm.position.y = 0.5;
  leverArm.rotation.z = 0.4;
  lever.add(leverBase, leverArm);
  lever.position.set(11.2, 0.15, -29.4);
  g.add(shadowed(lever));

  // Cover along the gate wall: crate stacks that block the gang's line of sight, so the
  // back-passage exit offers a real sneaking route (move while the lookout looks away).
  for (const [x, zz, w] of [[10.2, -55.3, 1.8], [7.4, -55.1, 1.6], [4.9, -55.5, 1.6]] as const) {
    const stack = new THREE.Group();
    const crateMat2 = new THREE.MeshStandardMaterial({ map: wood(), color: '#a98458', roughness: 0.9 });
    const c1 = box(w, 0.95, 0.9, crateMat2);
    c1.position.y = 0.48;
    const c2 = box(w * 0.55, 0.7, 0.8, crateMat2);
    c2.position.set(w * 0.18, 1.3, 0);
    c2.rotation.y = 0.2;
    stack.add(c1, c2);
    stack.position.set(x, 0, zz);
    g.add(shadowed(stack));
    block(x, zz, w, 0.9);
  }

  // Outer bounds
  block(-30, -28, 38, 72);
  block(36, -28, 38, 72);
  block(-50, -80, 64, 60);
  block(50, -80, 64, 60);
  block(0, -101, 60, 2);

  // ---------- Well (water task) ----------
  const well = new THREE.Group();
  const wellRing = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.9, 20, 1, true), gateStone);
  wellRing.position.y = 0.45;
  well.add(wellRing);
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.8, 20), new THREE.MeshStandardMaterial({ color: '#3a6f86', roughness: 0.05, metalness: 0.1 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.5;
  well.add(water);
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2), doorMat);
    post.position.set(s * 0.8, 1.2, 0);
    well.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8), doorMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 2.1;
  well.add(bar);
  well.position.set(2.4, 0, -36);
  g.add(shadowed(well));
  block(2.4, -36, 1.8, 1.8);

  // ---------- Markers ----------
  function marker(color: string) {
    const m = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 8, 40), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.06;
    m.add(ring);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 4, 24, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }),
    );
    beam.position.y = 2;
    m.add(beam);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    gem.position.y = 2.4;
    m.add(gem);
    animated.push((_dt, t) => {
      gem.rotation.y = t * 1.5;
      gem.position.y = 2.4 + Math.sin(t * 2) * 0.12;
      ring.scale.setScalar(1 + Math.sin(t * 2.5) * 0.06);
    });
    g.add(m);
    return m;
  }
  const add = (i: Omit<Interactable, 'marker'>, color?: string) => {
    const it: Interactable = { ...i };
    if (color) {
      it.marker = marker(color);
      it.marker.position.copy(i.position);
    }
    interactables.push(it);
  };
  add({ id: 'trainer', kind: 'trainer', areaId: 'training-yard', position: v3(-4.5, 0, 11), radius: 2.4 });
  add({ id: 'rest', kind: 'rest', areaId: 'training-yard', position: v3(7.8, 0, 6.8), radius: 2.2 }, '#ffb347');
  add({ id: 'traveler', kind: 'traveler', areaId: 'market-lane', position: v3(-2.6, 0, -15.5), radius: 2.2 });
  add({ id: 'merchant', kind: 'merchant', areaId: 'market-lane', position: v3(-2.7, 0, -31), radius: 2.2 });
  add({ id: 'lever', kind: 'lever', areaId: 'back-alley', position: v3(11.2, 0, -29.4), radius: 1.8 });
  add({ id: 'side-door', kind: 'sideDoor', areaId: 'market-lane', position: v3(-9, 0, -56.6), radius: 2 });
  add({ id: 'arrival-hospitality', kind: 'discovery', areaId: 'meeting-courtyard', position: v3(0, 0, -93), radius: 2.4 }, '#ffd27a');

  // Stone tablet where the second account is read.
  const tablet = box(1.6, 2.2, 0.35, gateStone);
  tablet.position.set(0, 1.1, -95);
  g.add(shadowed(tablet));
  block(0, -95, 1.6, 0.5);
  /* Lectern removed in the adventure layout.
  const lectern = new THREE.Group();
  const stand = box(0.5, 1.1, 0.5, doorMat);
  stand.position.y = 0.55;
  const top = box(0.9, 0.08, 0.6, doorMat);
  top.position.y = 1.15;
  top.rotation.x = -0.3;
  lectern.add(stand, top);
  lectern.position.set(7, 0, -79.5);
  g.add(shadowed(lectern));
  */

  // ---------- Dust motes in the sunlight ----------
  const dustCount = 900;
  const dustGeo = new THREE.BufferGeometry();
  const dp = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dp[i * 3] = (r() - 0.5) * 30;
    dp[i * 3 + 1] = r() * 7;
    dp[i * 3 + 2] = -r() * 100;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: '#ffe6bf', size: 0.05, transparent: true, opacity: 0.55, depthWrite: false }));
  g.add(dust);
  animated.push((dt) => {
    const a = dustGeo.attributes.position!;
    for (let i = 0; i < dustCount; i++) {
      a.setX(i, a.getX(i) + Math.sin(i + a.getY(i)) * dt * 0.08);
      a.setY(i, (a.getY(i) + dt * 0.05) % 7);
    }
    a.needsUpdate = true;
  });

  const removeCollider = (id: string) => {
    for (let i = colliders.length - 1; i >= 0; i--) if (colliders[i]!.id === id) colliders.splice(i, 1);
  };

  return {
    group: g,
    interactables,
    colliders,
    spawn: v3(0, 0, 14),
    areaAt: (p) => {
      if (p.z < gateZ - 0.8) return 'meeting-courtyard';
      if (p.z > 2.9) return 'training-yard';
      if (p.x > 10.6) return p.z < -39.5 ? 'back-route' : 'back-alley';
      if (p.x > 3.6 && p.z < -22.8 && p.z > -29.6) return 'back-alley';
      return 'market-lane';
    },
    openGate() {
      gateTarget = 1;
      removeCollider('gate');
    },
    openSideDoor() {
      sideTarget = 1;
      removeCollider('side-door');
    },
    raiseBackGate() {
      backTarget = 1;
      removeCollider('back-gate');
    },
    pickups: {
      'water-3': v3(-8.6, 0, 15.6),
      'wood-2': v3(8.8, 0, 15.8),
      'water-1': v3(-2.9, 0, -8.5),
      'provisions-1': v3(2.9, 0, -20.5),
      'rope-1': v3(-2.9, 0, -38.5),
      'fragment-1': v3(2.6, 0, -4),
      'merchant-bundle': v3(15.8, 0, -8.5),
      'water-2': v3(11.4, 0, -14),
      'wood-1': v3(16, 0, -20),
      'fragment-2': v3(11.6, 0, -24.5),
      'provisions-2': v3(15.6, 0, -44),
      'rope-2': v3(11.6, 0, -48.5),
      'fragment-3': v3(15.4, 0, -52),
    },
    enemies: [
      { encounterId: 'staff-training', position: v3(1.5, 0, 9), facing: Math.PI * 0.1 },
      { encounterId: 'extortioners', position: v3(-2.2, 0, -51.2), facing: 0, scan: 0.35 },
      { encounterId: 'extortioners', position: v3(0.6, 0, -50.4), facing: 0.15, scan: 0.25 },
      // The lookout keeps turning toward the back streets.
      { encounterId: 'extortioners', position: v3(3.2, 0, -51.6), facing: Math.PI * 0.5, scan: 0.7 },
    ],
    puzzle: { origin: new THREE.Vector2(11.65, -30.8), cell: 1.3, cols: 4, rows: 6, crates: [[1, 1], [2, 2]], plates: [[0, 5], [3, 5]] },
    sneakGoal: { min: new THREE.Vector2(-3.6, -57.6), max: new THREE.Vector2(3.6, -55.4) },
    routeGoal: { min: new THREE.Vector2(-10.4, -61), max: new THREE.Vector2(-7.6, -58.9) },
    obstacleZone: { min: new THREE.Vector2(-10.5, -58), max: new THREE.Vector2(17, -44) },
    checkpoints: {
      'staff-training': v3(0, 0, 13),
      extortioners: v3(0, 0, -40),
    },
    update(dt, t) {
      for (const fn of animated) fn(dt, t);
    },
  };
}
