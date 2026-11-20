using System;
using System.Collections.Generic;
using UnityEngine;

namespace Athar.World
{
    /// <summary>A collectible in the world: a small model with a soft glint that bobs in place.</summary>
    public class Pickup : MonoBehaviour
    {
        public string Id;
        public string Kind; // water | provisions | wood | rope | fragment | merchant-bundle
        public bool Collected;
        Transform model;
        float t;

        public static Pickup Create(Transform parent, string id, string kind, Vector3 pos)
        {
            var go = new GameObject("pickup-" + id);
            go.transform.SetParent(parent, false);
            go.transform.position = pos;
            var p = go.AddComponent<Pickup>();
            p.Id = id; p.Kind = kind; p.t = UnityEngine.Random.value * 6;
            p.model = new GameObject("model").transform;
            p.model.SetParent(go.transform, false);
            Material M(string hex, float s = 0.2f) { ColorUtility.TryParseHtmlString(hex, out var c); return MaterialKit.Lit(c, s); }
            switch (kind)
            {
                case "water": MeshKit.Prim(PrimitiveType.Sphere, p.model, Vector3.zero, new Vector3(0.36f, 0.46f, 0.3f), M("#7a5032", 0.4f), false); break;
                case "provisions": MeshKit.Prim(PrimitiveType.Cylinder, p.model, Vector3.zero, new Vector3(0.36f, 0.14f, 0.36f), M("#c9a46a"), false); break;
                case "wood":
                    for (int i = 0; i < 3; i++)
                        MeshKit.Prim(PrimitiveType.Cylinder, p.model, new Vector3(0, i * 0.09f, (i - 1) * 0.06f), new Vector3(0.1f, 0.25f, 0.1f), M("#6e4a2c"), false).transform.localRotation = Quaternion.Euler(0, 0, 90);
                    break;
                case "rope": MeshKit.Prim(PrimitiveType.Cylinder, p.model, Vector3.zero, new Vector3(0.34f, 0.05f, 0.34f), M("#b08a54"), false); break;
                case "fragment": MeshKit.Prim(PrimitiveType.Cylinder, p.model, Vector3.zero, new Vector3(0.12f, 0.17f, 0.12f), M("#efe2c2"), false).transform.localRotation = Quaternion.Euler(0, 0, 70); break;
                default: MeshKit.Prim(PrimitiveType.Sphere, p.model, Vector3.zero, new Vector3(0.48f, 0.36f, 0.48f), M("#8a3b2a"), false); break;
            }
            var glint = MeshKit.Prim(PrimitiveType.Sphere, go.transform, Vector3.up * 0.4f, Vector3.one * 0.6f,
                MaterialKit.Unlit(kind == "fragment" ? new Color(0.78f, 0.65f, 1f, 0.22f) : new Color(1f, 0.88f, 0.59f, 0.22f), true), false, "glint");
            MeshKit.SetLayerRecursive(go, MeshKit.IgnoreRaycastLayer);
            return p;
        }

        void Update()
        {
            if (Collected) return;
            t += Time.deltaTime;
            model.localPosition = Vector3.up * (0.35f + Mathf.Sin(t * 2.2f) * 0.06f);
            model.Rotate(0, 70 * Time.deltaTime, 0);
        }

        public void Take() { Collected = true; gameObject.SetActive(false); }
    }

    /// <summary>
    /// Crate-pushing puzzle: crates slide one grid cell when the player walks into them; when
    /// every pressure stone is covered, the counterweight gate rises.
    /// </summary>
    public class PushPuzzle : MonoBehaviour
    {
        GridPuzzle cfg;
        readonly List<(Vector2Int cell, Vector2Int start, Transform t)> crates = new();
        readonly List<Material> plateMats = new();
        float pushTimer;
        string pushKey = "";
        public bool Solved { get; private set; }
        public event Action OnSolved;

        public static PushPuzzle Create(Transform parent, GridPuzzle cfg)
        {
            var go = new GameObject("push-puzzle");
            go.transform.SetParent(parent, false);
            var p = go.AddComponent<PushPuzzle>();
            p.cfg = cfg;
            var stone = MaterialKit.Lit(new Color(0.54f, 0.48f, 0.4f), 0.1f);
            foreach (var plate in cfg.Plates)
            {
                var m = new Material(stone);
                p.plateMats.Add(m);
                MeshKit.Prim(PrimitiveType.Cylinder, go.transform, cfg.World(plate.x, plate.y) + Vector3.up * 0.04f, new Vector3(cfg.Cell * 0.88f, 0.04f, cfg.Cell * 0.88f), m, false, "plate");
            }
            var crateMat = MaterialKit.Lit(new Color(0.76f, 0.6f, 0.42f), 0.1f, MaterialKit.Wood());
            foreach (var c in cfg.Crates)
            {
                var size = cfg.Cell * 0.82f;
                var crate = MeshKit.Prim(PrimitiveType.Cube, go.transform, cfg.World(c.x, c.y) + Vector3.up * size / 2, Vector3.one * size, crateMat, true, "crate").transform;
                p.crates.Add((c, c, crate));
            }
            return p;
        }

        bool Occupied(Vector2Int cell) => crates.Exists(c => c.cell == cell);

        public List<Vector2Int> Cells() => crates.ConvertAll(c => c.cell);

        /// <summary>Pushing into a crate for a moment slides it one cell.</summary>
        public void Tick(float dt, Vector3 player, Vector3 moveDir)
        {
            float h = cfg.Cell * 0.41f;
            for (int i = 0; i < crates.Count; i++)
            {
                var (cell, _, t) = crates[i];
                t.position = Vector3.Lerp(t.position, cfg.World(cell.x, cell.y) + Vector3.up * h, Mathf.Clamp01(dt * 10));
            }
            if (Solved || moveDir.sqrMagnitude < 0.2f) { pushTimer = 0; return; }
            // Snap the input to the dominant axis.
            var axis = Mathf.Abs(moveDir.x) > Mathf.Abs(moveDir.z) ? new Vector3(Mathf.Sign(moveDir.x), 0, 0) : new Vector3(0, 0, Mathf.Sign(moveDir.z));
            for (int i = 0; i < crates.Count; i++)
            {
                var c = crates[i];
                var to = cfg.World(c.cell.x, c.cell.y) - player; to.y = 0;
                float along = Vector3.Dot(to, axis);
                float across = (to - axis * along).magnitude;
                if (along <= 0 || along > h + 0.55f || across > 0.45f) continue;
                string key = $"{c.cell}:{axis}";
                if (key != pushKey) { pushKey = key; pushTimer = 0; }
                pushTimer += dt;
                if (pushTimer < 0.22f) return;
                pushTimer = 0;
                // Convert the world axis into a grid step.
                var step = Vector2Int.zero;
                if (Vector3.Dot(axis, cfg.ColDir) > 0.5f) step.x = 1;
                else if (Vector3.Dot(axis, cfg.ColDir) < -0.5f) step.x = -1;
                else if (axis.z < 0) step.y = 1;
                else step.y = -1;
                var next = c.cell + step;
                if (next.x < 0 || next.y < 0 || next.x >= cfg.Cols || next.y >= cfg.Rows || Occupied(next)) return;
                crates[i] = (next, c.start, c.t);
                CheckPlates();
                return;
            }
        }

        void CheckPlates()
        {
            int covered = 0;
            for (int i = 0; i < cfg.Plates.Count; i++)
            {
                bool on = Occupied(cfg.Plates[i]);
                var m = plateMats[i];
                if (on) { m.EnableKeyword("_EMISSION"); m.SetColor("_EmissionColor", new Color(1f, 0.7f, 0.28f) * 0.8f); covered++; }
                else m.SetColor("_EmissionColor", Color.black);
            }
            if (covered == cfg.Plates.Count && !Solved) { Solved = true; OnSolved?.Invoke(); }
        }

        /// <summary>The reset lever: crates slide back to where they started.</summary>
        public void ResetCrates()
        {
            if (Solved) return;
            for (int i = 0; i < crates.Count; i++) crates[i] = (crates[i].start, crates[i].start, crates[i].t);
            CheckPlates();
        }

        /// <summary>Restore a solved puzzle from saved progress.</summary>
        public void MarkSolved()
        {
            Solved = true;
            for (int i = 0; i < crates.Count && i < cfg.Plates.Count; i++)
            {
                crates[i] = (cfg.Plates[i], crates[i].start, crates[i].t);
                crates[i].t.position = cfg.World(cfg.Plates[i].x, cfg.Plates[i].y) + Vector3.up * cfg.Cell * 0.41f;
            }
            CheckPlates();
        }
    }
}
