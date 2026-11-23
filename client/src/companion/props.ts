/**
 * Generated 3D props (Higgsfield text-to-3D, compressed with gltf-transform). Scene builders
 * wrap their simple stand-in meshes with `prop()`: the stand-in shows at once, and the real
 * model replaces it as soon as it has loaded, scaled to the same height and set on the ground.
 * A per-model cap keeps the triangle count reasonable on phones; beyond it the stand-ins stay.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export type PropName =
  | 'tent' | 'camel' | 'palm' | 'well' | 'house' | 'olive' | 'acacia' | 'sheep'
  | 'stall' | 'jars' | 'column' | 'shade' | 'press';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<PropName, Promise<THREE.Object3D | null>>();
const used = new Map<PropName, number>();
const CAP: Partial<Record<PropName, number>> = { palm: 36, olive: 18, acacia: 14, house: 28, column: 40, tent: 16, camel: 12, sheep: 8 };

/** Turn off to compare with the stand-ins (or on very weak devices). */
export let propsEnabled = true;
export function setPropsEnabled(on: boolean) {
  propsEnabled = on;
}

function load(name: PropName) {
  let p = cache.get(name);
  if (!p) {
    p = loader
      .loadAsync(`${import.meta.env.BASE_URL}props/${name}.glb`)
      .then((g) => {
        const root = g.scene;
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = m.receiveShadow = true;
            const mat = m.material as THREE.MeshStandardMaterial;
            if (mat && 'roughness' in mat) mat.roughness = Math.max(mat.roughness, 0.55);
          }
        });
        return root as THREE.Object3D;
      })
      .catch(() => null);
    cache.set(name, p);
  }
  return p;
}

/**
 * Wrap a stand-in with a prop. Returns a group to position/rotate like the stand-in. When the
 * model loads it is scaled so its height matches `height` (metres), centred and grounded.
 */
export function prop(name: PropName, standIn: THREE.Object3D, height: number, opts: { fit?: 'height' | 'width'; width?: number; rotY?: number } = {}) {
  const holder = new THREE.Group();
  holder.add(standIn);
  const n = (used.get(name) ?? 0) + 1;
  used.set(name, n);
  if (!propsEnabled || n > (CAP[name] ?? 999)) return holder;
  void load(name).then((model) => {
    if (!model) return;
    const inst = model.clone(true);
    // Generated models face +z; turn them to face the way the stand-in did.
    if (opts.rotY) inst.rotation.y = opts.rotY;
    const box = new THREE.Box3().setFromObject(inst);
    const size = box.getSize(new THREE.Vector3());
    const s = opts.fit === 'width' && opts.width ? opts.width / Math.max(size.x, size.z) : height / Math.max(size.y, 1e-3);
    inst.scale.setScalar(s);
    const b2 = new THREE.Box3().setFromObject(inst);
    const c = b2.getCenter(new THREE.Vector3());
    inst.position.set(-c.x, -b2.min.y, -c.z);
    holder.remove(standIn);
    holder.add(inst);
  });
  return holder;
}

/** Start loading every prop early so they appear as soon as a scene is shown. */
export function preloadProps(names: PropName[]) {
  if (!propsEnabled) return;
  for (const n of names) void load(n);
}
