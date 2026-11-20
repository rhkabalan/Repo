import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

export type Quality = 'high' | 'medium' | 'low';

export function detectQuality(): Quality {
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || matchMedia('(pointer: coarse)').matches;
  return mobile ? 'medium' : 'high';
}

/** Renderer, camera, lighting, sky and post-processing for a warm late-afternoon look. */
export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);
  readonly sun = new THREE.DirectionalLight(0xffcf98, 2.1);
  private composer: EffectComposer;
  private readonly clock = new THREE.Clock();
  private updaters: ((dt: number, t: number) => void)[] = [];

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly quality: Quality = detectQuality(),
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'high', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 2 : 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.78;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.setupSky();
    this.setupLights();

    // MSAA render target keeps edges crisp through post-processing.
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: quality === 'high' ? 4 : 0 });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (quality !== 'low') this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.5, 1.15));
    this.composer.addPass(new OutputPass());

    this.resize();
    addEventListener('resize', () => this.resize());
  }

  private setupSky() {
    const sky = new Sky();
    sky.scale.setScalar(450);
    const u = sky.material.uniforms;
    u.turbidity!.value = 4;
    u.rayleigh!.value = 1.1;
    u.mieCoefficient!.value = 0.004;
    u.mieDirectionalG!.value = 0.86;
    const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(68), THREE.MathUtils.degToRad(58));
    u.sunPosition!.value.copy(sunDir);
    this.scene.add(sky);

    // Image-based lighting from the sky for soft, believable fill light.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.add(sky.clone());
    this.scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    this.scene.environmentIntensity = 0.4;

    this.scene.fog = new THREE.FogExp2(0xd9b88f, 0.0055);
    this.sun.position.copy(sunDir).multiplyScalar(80);
  }

  private setupLights() {
    this.scene.add(new THREE.HemisphereLight(0xfff1d6, 0x8a6440, 0.6));
    const s = this.sun;
    s.castShadow = this.quality !== 'low';
    s.shadow.mapSize.setScalar(this.quality === 'high' ? 4096 : 2048);
    s.shadow.camera.near = 1;
    s.shadow.camera.far = 220;
    const r = 70;
    Object.assign(s.shadow.camera, { left: -r, right: r, top: r, bottom: -r });
    s.shadow.bias = -0.0004;
    s.shadow.normalBias = 0.03;
    this.scene.add(s, s.target);
  }

  /** Keep the shadow frustum centred on the player so shadows stay sharp. */
  followSun(target: THREE.Vector3) {
    const dir = this.sun.position.clone().sub(this.sun.target.position).normalize();
    this.sun.target.position.copy(target);
    this.sun.position.copy(target).addScaledVector(dir, 80);
  }

  onUpdate(fn: (dt: number, t: number) => void): () => void {
    this.updaters.push(fn);
    return () => (this.updaters = this.updaters.filter((f) => f !== fn));
  }

  resize() {
    const w = this.canvas.clientWidth || innerWidth;
    const h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 62 : 50; // wider view in portrait on phones
    this.camera.updateProjectionMatrix();
  }

  start() {
    this.renderer.setAnimationLoop(() => {
      const dt = Math.min(this.clock.getDelta(), 0.05);
      const t = this.clock.elapsedTime;
      for (const fn of this.updaters) fn(dt, t);
      this.composer.render();
    });
  }
}
