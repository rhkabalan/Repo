import * as THREE from 'three';

/**
 * Procedural surface textures (plaster, stone, sand, cloth) drawn on canvases, so the
 * stand-in world looks crafted rather than flat. Replaced by authored PBR textures later.
 */

function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, r: () => number) => void, seed = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  draw(ctx, rand(seed));
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function speckle(ctx: CanvasRenderingContext2D, r: () => number, size: number, count: number, alpha: number, light: boolean) {
  for (let i = 0; i < count; i++) {
    const v = light ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${r() * alpha})`;
    const s = r() * 3 + 0.5;
    ctx.fillRect(r() * size, r() * size, s, s);
  }
}

const cache = new Map<string, THREE.Texture>();
const cached = (key: string, make: () => THREE.Texture) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key)!;
};

export const plaster = (hex: string, seed = 1) =>
  cached(`plaster:${hex}:${seed}`, () =>
    canvasTexture(
      512,
      (ctx, r) => {
        ctx.fillStyle = hex;
        ctx.fillRect(0, 0, 512, 512);
        // soft blotches
        for (let i = 0; i < 60; i++) {
          const g = ctx.createRadialGradient(r() * 512, r() * 512, 0, r() * 512, r() * 512, 40 + r() * 120);
          const dark = r() > 0.5;
          g.addColorStop(0, dark ? 'rgba(90,60,30,0.10)' : 'rgba(255,240,215,0.10)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, 512, 512);
        }
        speckle(ctx, r, 512, 9000, 0.12, false);
        speckle(ctx, r, 512, 5000, 0.10, true);
        // weathering streaks from the top
        for (let i = 0; i < 25; i++) {
          const x = r() * 512;
          const g = ctx.createLinearGradient(x, 0, x, 200 + r() * 250);
          g.addColorStop(0, 'rgba(80,55,30,0.18)');
          g.addColorStop(1, 'rgba(80,55,30,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x, 0, 2 + r() * 6, 450);
        }
      },
      seed,
    ),
  );

export const stoneBlocks = (seed = 3) =>
  cached(`stone:${seed}`, () =>
    canvasTexture(
      512,
      (ctx, r) => {
        ctx.fillStyle = '#8a7258';
        ctx.fillRect(0, 0, 512, 512);
        const rows = 8;
        const h = 512 / rows;
        for (let y = 0; y < rows; y++) {
          let x = y % 2 ? -h * 0.6 : 0;
          while (x < 512) {
            const w = h * (1.2 + r() * 0.9);
            const tone = 130 + r() * 50;
            ctx.fillStyle = `rgb(${tone + 20},${tone - 5},${tone - 35})`;
            ctx.fillRect(x + 2, y * h + 2, w - 4, h - 4);
            x += w;
          }
        }
        speckle(ctx, r, 512, 12000, 0.15, false);
        speckle(ctx, r, 512, 4000, 0.08, true);
      },
      seed,
    ),
  );

export const sand = () =>
  cached('sand', () =>
    canvasTexture(
      1024,
      (ctx, r) => {
        ctx.fillStyle = '#c9a678';
        ctx.fillRect(0, 0, 1024, 1024);
        for (let i = 0; i < 140; i++) {
          const g = ctx.createRadialGradient(r() * 1024, r() * 1024, 0, r() * 1024, r() * 1024, 60 + r() * 200);
          g.addColorStop(0, r() > 0.5 ? 'rgba(120,85,50,0.10)' : 'rgba(250,225,185,0.12)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, 1024, 1024);
        }
        speckle(ctx, r, 1024, 40000, 0.18, false);
        speckle(ctx, r, 1024, 20000, 0.12, true);
        // a few pebbles
        for (let i = 0; i < 400; i++) {
          ctx.fillStyle = `rgba(${90 + r() * 40},${70 + r() * 30},${50 + r() * 20},0.5)`;
          ctx.beginPath();
          ctx.ellipse(r() * 1024, r() * 1024, 1 + r() * 3, 1 + r() * 2, r() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      },
      7,
    ),
  );

export const cloth = (a: string, b: string) =>
  cached(`cloth:${a}:${b}`, () =>
    canvasTexture(256, (ctx, r) => {
      ctx.fillStyle = a;
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = b;
      for (let x = 0; x < 256; x += 32) ctx.fillRect(x, 0, 12, 256);
      speckle(ctx, r, 256, 3000, 0.12, false);
    }),
  );

export const wood = () =>
  cached('wood', () =>
    canvasTexture(256, (ctx, r) => {
      ctx.fillStyle = '#5b3a22';
      ctx.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 2) {
        ctx.fillStyle = `rgba(${30 + r() * 30},${18 + r() * 15},${8},${0.25 + r() * 0.3})`;
        ctx.fillRect(0, y, 256, 1 + r());
      }
      for (let x = 0; x < 256; x += 42) {
        ctx.fillStyle = 'rgba(20,10,5,0.6)';
        ctx.fillRect(x, 0, 2, 256);
      }
    }),
  );
