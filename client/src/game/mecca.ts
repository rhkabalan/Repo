import * as THREE from 'three';
import { cloth, plaster, sand, stoneBlocks, wood } from './textures';

/**
 * Mecca chapter environment: Hospitality Lane → passage gate → Meeting Courtyard.
 * These are gameplay spaces, not reconstructions of specific historical locations.
 * The Kaaba is intentionally not modelled here; it needs dedicated, reviewed treatment.
 */

export interface Interactable {
  id: string;
  kind: 'npc' | 'discovery' | 'well' | 'traveler' | 'board' | 'gate' | 'lectern';
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

export interface Environment {
  group: THREE.Group;
  interactables: Interactable[];
  colliders: Collider[];
  spawn: THREE.Vector3;
  areaAt(p: THREE.Vector3): string;
  openGate(): void;
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
  const path = new THREE.Mesh(new THREE.PlaneGeometry(6, 58), new THREE.MeshStandardMaterial({ map: pathTex, color: '#b99a74', roughness: 0.95 }));
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.03, -28);
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
  for (const [w, d, h, opts] of rightRow) {
    house(laneHalf + d / 2, z - w / 2, w, d, h, 'right', opts);
    z -= w + 0.4;
  }

  // Back wall behind the start.
  const wallMat = new THREE.MeshStandardMaterial({ map: (() => { const t = stoneTex.clone(); t.needsUpdate = true; t.repeat.set(4, 1); return t; })(), roughness: 1 });
  // Open approach behind the start so the camera has room; low wall further back.
  const startWall = box(16, 2.2, 1, wallMat);
  startWall.position.set(0, 1.1, 14);
  g.add(shadowed(startWall));
  block(0, 14, 16, 1);
  block(-10, 9, 12, 10);
  block(10, 9, 12, 10);

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
    const wall = box(14, 5.5, 1.4, gateStone);
    wall.position.set(side * 11, 2.75, 0);
    gate.add(wall);
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
  // Symbol plinths (Sun, Shelter, Water) in front of the gate.
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
  gate.position.z = gateZ;
  g.add(shadowed(gate));
  block(-3.1, gateZ, 2.2, 2);
  block(3.1, gateZ, 2.2, 2);
  block(-11, gateZ, 14, 1.4);
  block(11, gateZ, 14, 1.4);
  block(0, gateZ, 4, 0.6, 'gate');
  let gateOpen = 0;
  let gateTarget = 0;
  animated.push((dt) => {
    gateOpen += (gateTarget - gateOpen) * Math.min(1, dt * 1.5);
    doors[0]!.rotation.y = gateOpen * 1.6;
    doors[1]!.rotation.y = -gateOpen * 1.6;
  });

  // Route board near the gate.
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

  // Lane edges / outer bounds
  block(-30, -28, 40, 70);
  block(30, -28, 40, 70);
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
  add({ id: 'guide', kind: 'npc', areaId: 'hospitality-lane', position: v3(1.6, 0, -7), radius: 2.2 });
  add({ id: 'traveler', kind: 'traveler', areaId: 'hospitality-lane', position: v3(-2.6, 0, -15.5), radius: 2.2 });
  add({ id: 'ali-hospitality', kind: 'discovery', areaId: 'hospitality-lane', position: v3(-2.4, 0, -18.3), radius: 2 }, '#ffd27a');
  add({ id: 'well', kind: 'well', areaId: 'hospitality-lane', position: v3(2.4, 0, -34.6), radius: 2.2 });
  add({ id: 'route-board', kind: 'board', areaId: 'hospitality-lane', position: v3(2.4, 0, -48), radius: 2 });
  add({ id: 'passage', kind: 'gate', areaId: 'hospitality-lane', position: v3(0, 0, -54.5), radius: 2.6 }, '#9fd6ff');
  add({ id: 'public-declaration', kind: 'discovery', areaId: 'meeting-courtyard', position: v3(0, 0, -93), radius: 2.2 }, '#ffd27a');
  add({ id: 'story-order', kind: 'lectern', areaId: 'meeting-courtyard', position: v3(7, 0, -78), radius: 2.2 }, '#c7a6ff');

  // Stone tablet where the second account is read.
  const tablet = box(1.6, 2.2, 0.35, gateStone);
  tablet.position.set(0, 1.1, -95);
  g.add(shadowed(tablet));
  block(0, -95, 1.6, 0.5);
  // Lectern
  const lectern = new THREE.Group();
  const stand = box(0.5, 1.1, 0.5, doorMat);
  stand.position.y = 0.55;
  const top = box(0.9, 0.08, 0.6, doorMat);
  top.position.y = 1.15;
  top.rotation.x = -0.3;
  lectern.add(stand, top);
  lectern.position.set(7, 0, -79.5);
  g.add(shadowed(lectern));

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

  return {
    group: g,
    interactables,
    colliders,
    spawn: v3(0, 0, 3),
    areaAt: (p) => (p.z < gateZ ? 'meeting-courtyard' : 'hospitality-lane'),
    openGate() {
      gateTarget = 1;
      const i = colliders.findIndex((c) => c.id === 'gate');
      if (i >= 0) colliders.splice(i, 1);
    },
    update(dt, t) {
      for (const fn of animated) fn(dt, t);
    },
  };
}
