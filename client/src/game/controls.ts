import * as THREE from 'three';

/** Unified input: keyboard, on-screen joystick + buttons (touch), and tap-to-walk. */
export class Controls {
  readonly move = new THREE.Vector2(); // x = right, y = forward, length ≤ 1
  running = false;
  tapTarget: THREE.Vector3 | null = null;
  private keys = new Set<string>();
  private joy = new THREE.Vector2();
  private interactHandlers: (() => void)[] = [];
  enabled = true;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: THREE.Camera,
    private readonly ground: THREE.Object3D,
    hud: HTMLElement,
  ) {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.('input, textarea, button')) return;
      this.keys.add(e.code);
      if ((e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') && !e.repeat) this.fireInteract();
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.code);
    const blur = () => this.keys.clear();
    const tap = (e: PointerEvent) => this.onTap(e);
    addEventListener('keydown', down);
    addEventListener('keyup', up);
    addEventListener('blur', blur);
    this.canvas.addEventListener('pointerup', tap);
    this.dispose = () => {
      removeEventListener('keydown', down);
      removeEventListener('keyup', up);
      removeEventListener('blur', blur);
      this.canvas.removeEventListener('pointerup', tap);
    };
    this.buildTouchUi(hud);
  }

  dispose: () => void;

  onInteract(fn: () => void) {
    this.interactHandlers.push(fn);
  }

  private fireInteract() {
    if (this.enabled) for (const fn of this.interactHandlers) fn();
  }

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

    const buttons = document.createElement('div');
    buttons.className = 'action-buttons';
    buttons.innerHTML = '<button class="btn-run" data-i18n="run"></button><button class="btn-interact" data-i18n="interact"></button>';
    hud.appendChild(buttons);
    const run = buttons.querySelector('.btn-run') as HTMLElement;
    run.addEventListener('pointerdown', () => {
      this.touchRun = !this.touchRun;
      run.classList.toggle('active', this.touchRun);
    });
    buttons.querySelector('.btn-interact')!.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.fireInteract();
    });
  }

  private touchRun = false;
  private raycaster = new THREE.Raycaster();

  private onTap(e: PointerEvent) {
    if (!this.enabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.ground, false)[0];
    if (hit) this.tapTarget = hit.point.clone().setY(0);
  }

  update() {
    const k = this.keys;
    const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const ky = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    this.move.set(kx, ky).add(this.joy);
    if (this.move.length() > 1) this.move.normalize();
    if (!this.enabled) this.move.set(0, 0);
    if (this.move.lengthSq() > 0.01) this.tapTarget = null;
    this.running = k.has('ShiftLeft') || k.has('ShiftRight') || this.touchRun;
  }
}
