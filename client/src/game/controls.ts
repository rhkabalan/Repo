import * as THREE from 'three';

type Action = 'attack' | 'dodge' | 'interact' | 'sneak';

/**
 * Unified input for action play.
 * Keyboard: WASD/arrows move, Shift run, J or left click attack, K or right click block (hold),
 * Space dodge, C sneak (toggle), E interact.
 * Touch: joystick (push fully to run), Attack, Block (hold), Dodge, Sneak, and the context
 * prompt chip to interact. Tap the ground to walk there when not in combat.
 */
export class Controls {
  readonly move = new THREE.Vector2(); // x = right, y = forward, length ≤ 1
  running = false;
  blocking = false;
  sneaking = false;
  tapTarget: THREE.Vector3 | null = null;
  /** Camera look input this frame, in pixels of drag (x = yaw, y = pitch). Consumed by the player controller. */
  readonly look = new THREE.Vector2();
  /** Zoom input this frame (positive = further out). */
  zoom = 0;
  /** Seconds since the player last moved the camera by hand. */
  lookIdle = 99;
  enabled = true;
  /** Disable tap-to-walk while fighting so taps don't fight the joystick. */
  allowTapMove = true;
  private keys = new Set<string>();
  private joy = new THREE.Vector2();
  private touchBlock = false;
  private mouseBlock = false;
  private handlers = new Map<Action, (() => void)[]>();
  private raycaster = new THREE.Raycaster();
  dispose: () => void;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: THREE.Camera,
    private ground: THREE.Object3D,
    hud: HTMLElement,
  ) {
    const typing = (e: Event) => !!(e.target as HTMLElement).closest?.('input, textarea, button, [role="dialog"]');
    const down = (e: KeyboardEvent) => {
      if (typing(e)) return;
      this.keys.add(e.code);
      if (e.repeat) return;
      if (e.code === 'KeyE' || e.code === 'Enter') this.fire('interact');
      if (e.code === 'KeyJ') this.fire('attack');
      if (e.code === 'Space') {
        e.preventDefault();
        this.fire('dodge');
      }
      if (e.code === 'KeyC') this.toggleSneak();
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.code);
    const blur = () => {
      this.keys.clear();
      this.mouseBlock = this.touchBlock = false;
    };
    // Drag anywhere on the view to look around (mouse or touch); a short tap/click still
    // walks (touch) or strikes (mouse). Two fingers pinch, or the mouse wheel, to zoom.
    const pointers = new Map<number, { x: number; y: number; sx: number; sy: number; dragged: boolean; button: number }>();
    let pinch = 0;
    const DRAG = 8;
    const mouseDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button === 2) {
        this.mouseBlock = true;
        return;
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, dragged: false, button: e.button });
      try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or already released */ }
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      }
    };
    const move = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (!p.dragged && Math.hypot(p.x - p.sx, p.y - p.sy) > DRAG) p.dragged = true;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        this.zoom += (pinch - d) * 0.03;
        pinch = d;
        a!.dragged = b!.dragged = true;
      } else if (p.dragged) {
        this.look.x += dx;
        this.look.y += dy;
      }
      if (p.dragged) this.lookIdle = 0;
    };
    const mouseUp = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button === 2) {
        this.mouseBlock = false;
        return;
      }
      const p = pointers.get(e.pointerId);
      pointers.delete(e.pointerId);
      if (!p || p.dragged) return;
      if (e.pointerType === 'mouse') {
        if (p.button === 0) this.fire('attack');
      } else this.onTap(e);
    };
    const cancel = (e: PointerEvent) => pointers.delete(e.pointerId);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      this.zoom += Math.sign(e.deltaY) * 0.8;
      this.lookIdle = 0;
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointercancel', cancel);
    canvas.addEventListener('wheel', wheel, { passive: false });
    const noMenu = (e: Event) => e.preventDefault();
    addEventListener('keydown', down);
    addEventListener('keyup', up);
    addEventListener('blur', blur);
    canvas.addEventListener('pointerdown', mouseDown);
    canvas.addEventListener('pointerup', mouseUp);
    canvas.addEventListener('contextmenu', noMenu);
    this.dispose = () => {
      removeEventListener('keydown', down);
      removeEventListener('keyup', up);
      removeEventListener('blur', blur);
      canvas.removeEventListener('pointerdown', mouseDown);
      canvas.removeEventListener('pointerup', mouseUp);
      canvas.removeEventListener('contextmenu', noMenu);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('wheel', wheel);
    };
    this.buildTouchUi(hud);
  }

  /** Swap the surface tap-to-walk raycasts against (when the scene changes). */
  setGround(ground: THREE.Object3D) {
    this.ground = ground;
  }

  on(action: Action, fn: () => void) {
    this.handlers.set(action, [...(this.handlers.get(action) ?? []), fn]);
  }

  /** Back-compat for callers that only need interaction. */
  onInteract(fn: () => void) {
    this.on('interact', fn);
  }

  fire(action: Action) {
    if (!this.enabled) return;
    for (const fn of this.handlers.get(action) ?? []) fn();
  }

  private toggleSneak() {
    this.sneaking = !this.sneaking;
    this.sneakBtn?.classList.toggle('active', this.sneaking);
    this.fire('sneak');
  }

  private sneakBtn: HTMLElement | null = null;

  private buildTouchUi(hud: HTMLElement) {
    const pad = document.createElement('div');
    pad.className = 'joystick';
    pad.innerHTML = '<div class="joystick-knob"></div>';
    hud.appendChild(pad);
    const knob = pad.firstElementChild as HTMLElement;
    let id: number | null = null;
    const center = new THREE.Vector2();
    const update = (e: PointerEvent) => {
      const v = new THREE.Vector2(e.clientX - center.x, e.clientY - center.y);
      const max = pad.clientWidth * 0.38;
      if (v.length() > max) v.setLength(max);
      knob.style.transform = `translate(${v.x}px, ${v.y}px)`;
      this.joy.set(v.x / max, -v.y / max);
    };
    pad.addEventListener('pointerdown', (e) => {
      id = e.pointerId;
      pad.setPointerCapture(id);
      const r = pad.getBoundingClientRect();
      center.set(r.left + r.width / 2, r.top + r.height / 2);
      this.tapTarget = null;
      update(e);
    });
    pad.addEventListener('pointermove', (e) => e.pointerId === id && update(e));
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null;
      this.joy.set(0, 0);
      knob.style.transform = '';
    };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);

    const cluster = document.createElement('div');
    cluster.className = 'action-cluster';
    cluster.innerHTML = `
      <button class="act act-attack" data-i18n="attack"></button>
      <button class="act act-block" data-i18n="block"></button>
      <button class="act act-dodge" data-i18n="dodge"></button>
      <button class="act act-sneak" data-i18n="sneak"></button>`;
    hud.appendChild(cluster);
    const press = (sel: string, fn: () => void) =>
      cluster.querySelector(sel)!.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        fn();
      });
    press('.act-attack', () => this.fire('attack'));
    press('.act-dodge', () => this.fire('dodge'));
    press('.act-sneak', () => this.toggleSneak());
    this.sneakBtn = cluster.querySelector('.act-sneak');
    const block = cluster.querySelector('.act-block') as HTMLElement;
    block.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      block.setPointerCapture(e.pointerId);
      this.touchBlock = true;
      block.classList.add('active');
    });
    const release = () => {
      this.touchBlock = false;
      block.classList.remove('active');
    };
    block.addEventListener('pointerup', release);
    block.addEventListener('pointercancel', release);
  }

  private onTap(e: PointerEvent) {
    if (!this.enabled || !this.allowTapMove) return;
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.ground, false)[0];
    if (hit) this.tapTarget = hit.point.clone().setY(0);
  }

  update() {
    const k = this.keys;
    // Keyboard camera turn: Q / R.
    if (k.has('KeyQ')) { this.look.x -= 6; this.lookIdle = 0; }
    if (k.has('KeyR')) { this.look.x += 6; this.lookIdle = 0; }
    this.lookIdle += 1 / 60;
    const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const ky = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    this.move.set(kx, ky).add(this.joy);
    if (this.move.length() > 1) this.move.normalize();
    if (!this.enabled) this.move.set(0, 0);
    if (this.move.lengthSq() > 0.01) this.tapTarget = null;
    const joyRun = this.joy.length() > 0.92;
    this.running = (k.has('ShiftLeft') || k.has('ShiftRight') || joyRun) && !this.sneaking;
    this.blocking = this.enabled && (k.has('KeyK') || this.touchBlock || this.mouseBlock);
  }
}
