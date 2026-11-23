import * as THREE from 'three';
import type { Character } from './character';
import type { Controls } from './controls';
import type { Collider } from './mecca';

const WALK = 2.6;
const RUN = 5.6;
const RADIUS = 0.4;

/** Moves the local player's character with collisions and drives a follow camera. */
export class PlayerController {
  readonly velocity = new THREE.Vector3();
  /** Camera sits at player + (sin yaw, cos yaw) * distance; 0 = behind a player facing -z. */
  private camYaw = 0;
  /** Camera elevation angle (radians) and distance; the player can change both. */
  private camPitch = 0.42;
  private camDist = 10;
  private readonly camPos = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();
  moving = false;
  /** Multiplies movement speed (attacking, blocking, sneaking slow you down). */
  speedScale = 1;
  /** When false the player keeps its facing (e.g. mid-swing). */
  canTurn = true;
  /** Set to drive the animation yourself (combat states). */
  animOverride: import('./character').Anim | null = null;

  constructor(
    readonly character: Character,
    private readonly controls: Controls,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly colliders: Collider[],
  ) {
    this.snapCamera();
  }

  get position() {
    return this.character.root.position;
  }

  private collide(p: THREE.Vector3) {
    for (const c of this.colliders) {
      const cx = THREE.MathUtils.clamp(p.x, c.min.x, c.max.x);
      const cz = THREE.MathUtils.clamp(p.z, c.min.y, c.max.y);
      const dx = p.x - cx;
      const dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < RADIUS * RADIUS) {
        if (d2 === 0) {
          // inside: push out along the shallowest axis
          const left = p.x - c.min.x, right = c.max.x - p.x, top = p.z - c.min.y, bottom = c.max.y - p.z;
          const m = Math.min(left, right, top, bottom);
          if (m === left) p.x = c.min.x - RADIUS;
          else if (m === right) p.x = c.max.x + RADIUS;
          else if (m === top) p.z = c.min.y - RADIUS;
          else p.z = c.max.y + RADIUS;
        } else {
          const d = Math.sqrt(d2);
          p.x = cx + (dx / d) * RADIUS;
          p.z = cz + (dz / d) * RADIUS;
        }
      }
    }
  }

  update(dt: number) {
    const input = this.controls.move;
    const dir = new THREE.Vector3();
    if (input.lengthSq() > 0.01) {
      // Camera-relative movement.
      const fwd = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      dir.addScaledVector(fwd, input.y).addScaledVector(right, input.x);
    } else if (this.controls.tapTarget) {
      dir.subVectors(this.controls.tapTarget, this.position).setY(0);
      if (dir.length() < 0.3) {
        this.controls.tapTarget = null;
        dir.set(0, 0, 0);
      } else dir.normalize();
    }
    const speed = (this.controls.running ? RUN : WALK) * this.speedScale;
    const target = dir.multiplyScalar(speed * Math.max(input.length(), dir.lengthSq() > 0 ? 1 : 0));
    this.velocity.lerp(target, Math.min(1, dt * 10));
    const next = this.position.clone().addScaledVector(this.velocity, dt);
    this.collide(next);
    this.position.copy(next);

    this.moving = this.velocity.lengthSq() > 0.05;
    if (this.moving && this.canTurn) {
      const yaw = Math.atan2(this.velocity.x, this.velocity.z);
      const cur = this.character.root.rotation.y;
      const delta = Math.atan2(Math.sin(yaw - cur), Math.cos(yaw - cur));
      this.character.root.rotation.y = cur + delta * Math.min(1, dt * 12);
    }
    if (this.animOverride) this.character.setAnim(this.animOverride);
    else if (!this.character.carrying || this.character.anim !== 'carry') {
      this.character.setAnim(this.moving ? (this.controls.running ? 'run' : 'walk') : 'idle');
    }
    this.updateCamera(dt);
  }

  /** Camera boom: shortened when a wall stands between the player and the camera. */
  /** Move by an offset (dodge roll, knockback) with collisions. */
  push(offset: THREE.Vector3) {
    if (offset.lengthSq() === 0) return;
    const next = this.position.clone().add(offset);
    this.collide(next);
    this.position.copy(next);
  }

  /** Unit vector the character is facing. */
  facing(out = new THREE.Vector3()) {
    const y = this.character.root.rotation.y;
    return out.set(Math.sin(y), 0, Math.cos(y));
  }

  /** Face a direction immediately (e.g. turn toward the nearest opponent when swinging). */
  faceTowards(dir: THREE.Vector3) {
    if (dir.lengthSq() < 1e-4) return;
    this.character.root.rotation.y = Math.atan2(dir.x, dir.z);
  }

  /** Camera-relative input direction in world space (zero when idle). */
  inputDirection(out = new THREE.Vector3()) {
    const input = this.controls.move;
    if (input.lengthSq() < 0.01) return out.set(0, 0, 0);
    const fwd = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    return out.copy(fwd.multiplyScalar(input.y)).addScaledVector(right, input.x).normalize();
  }

  private desiredCamera(out: THREE.Vector3) {
    const maxDist = this.camDist * Math.cos(this.camPitch);
    const sx = Math.sin(this.camYaw);
    const sz = Math.cos(this.camYaw);
    let dist = maxDist;
    for (let d = 0.6; d <= maxDist; d += 0.25) {
      const x = this.position.x + sx * d;
      const z = this.position.z + sz * d;
      if (this.colliders.some((c) => x > c.min.x - 0.3 && x < c.max.x + 0.3 && z > c.min.y - 0.3 && z < c.max.y + 0.3)) {
        dist = Math.max(1.6, d - 0.4);
        break;
      }
    }
    // When a wall shortens the boom, rise higher so the player can still see over it.
    const blocked = 1 - dist / maxDist;
    const height = 1.4 + this.camDist * Math.sin(this.camPitch) + blocked * 3.5;
    return out.set(this.position.x + sx * dist, height, this.position.z + sz * dist);
  }

  snapCamera() {
    this.desiredCamera(this.camPos);
    this.camera.position.copy(this.camPos);
    this.lookAt.copy(this.position).setY(1.4);
    this.camera.lookAt(this.lookAt);
  }

  private updateCamera(dt: number) {
    // Free look: drag to orbit and tilt, pinch or wheel to zoom.
    const look = this.controls.look;
    if (look.lengthSq() > 0) {
      this.camYaw -= look.x * 0.006;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + look.y * 0.004, 0.12, 1.25);
      look.set(0, 0);
    }
    if (this.controls.zoom !== 0) {
      this.camDist = THREE.MathUtils.clamp(this.camDist + this.controls.zoom, 4, 22);
      this.controls.zoom = 0;
    }
    // Gently swing the camera behind the direction of travel, unless the player is steering it.
    if (this.moving && this.controls.move.y > 0.3 && this.controls.lookIdle > 2.5) {
      const behind = Math.atan2(-this.velocity.x, -this.velocity.z);
      const d = Math.atan2(Math.sin(behind - this.camYaw), Math.cos(behind - this.camYaw));
      this.camYaw += d * Math.min(1, dt * 1.2);
    }
    const want = this.desiredCamera(new THREE.Vector3());
    this.camPos.lerp(want, Math.min(1, dt * 5));
    this.camera.position.copy(this.camPos);
    this.lookAt.lerp(new THREE.Vector3(this.position.x, 1.5, this.position.z), Math.min(1, dt * 8));
    this.camera.lookAt(this.lookAt);
  }
}
