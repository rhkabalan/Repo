import * as THREE from 'three';
import { Character } from './character';
import { DESIGNS } from './cast';
import { sand } from './textures';
import type { World } from './world';

/** Development preview (?lineup): the character designs side by side in game lighting. */
export function showLineup(world: World) {
  const tex = sand().clone();
  tex.needsUpdate = true;
  tex.repeat.set(8, 8);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  world.scene.add(ground);
  const cs = (['traveler', 'steadfast', 'elder'] as const).map((id, i) => {
    const c = new Character(DESIGNS[id].look, DESIGNS[id].model);
    c.root.position.set((i - 1) * 1.6, 0, 0);
    c.root.rotation.y = 0.35 - i * 0.35;
    c.setLabel({ traveler: 'The Traveler', steadfast: 'The Steadfast', elder: 'The Elder' }[id]);
    world.scene.add(c.root);
    return c;
  });
  world.camera.position.set(0, 1.5, 4.6);
  world.camera.lookAt(0, 1.05, 0);
  world.followSun(new THREE.Vector3());
  world.onUpdate((dt) => cs.forEach((c) => c.update(dt)));
}
