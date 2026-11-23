using System;
using System.Collections.Generic;
using UnityEngine;
using Random = UnityEngine.Random;

namespace Athar.World
{
    public enum InteractKind { Trainer, Rest, Merchant, Traveler, Lever, SideDoor, Discovery }

    public class InteractPoint
    {
        public string Id; public InteractKind Kind; public string AreaId; public Vector3 Position; public float Radius;
        public GameObject Marker;
    }

    public class EnemySpawn { public string EncounterId; public Vector3 Position; public float YawDeg; public float ScanDeg; }

    public class GridPuzzle
    {
        public Vector3 Origin; public Vector3 ColDir; public float Cell; public int Cols, Rows;
        public List<Vector2Int> Crates = new(); public List<Vector2Int> Plates = new();
        public Vector3 World(int col, int row) => Origin + ColDir * (col * Cell) + Vector3.back * (row * Cell);
    }

    /// <summary>Everything gameplay needs to know about the built district.</summary>
    public class MeccaLayout
    {
        public Transform Root;
        public Vector3 Spawn;
        public readonly Dictionary<string, Vector3> Pickups = new();
        public readonly List<EnemySpawn> Enemies = new();
        public readonly List<InteractPoint> Interactables = new();
        public GridPuzzle Puzzle;
        public Rect SneakGoal, RouteGoal;
        public readonly Dictionary<string, Vector3> Checkpoints = new();
        public Func<Vector3, string> AreaAt;
        public Action OpenGate, OpenSideDoor, RaiseBackGate;
    }

    /// <summary>
    /// Builds the Mecca adventure district procedurally: Training Yard → Market Lane (side
    /// alley → Back Alley → Collapsed Passage) → the plaza held by extortioners → Meeting
    /// Courtyard. Gameplay spaces only, not reconstructions of historical locations; the Kaaba
    /// is intentionally not modelled. Coordinates mirror the web prototype (web x → −x).
    /// </summary>
    public static class MeccaBuilder
    {
        // Web-prototype coordinates → Unity (mirror X so the layout reads the same on screen).
        static Vector3 P(float x, float z, float y = 0) => new(-x, y, z);
        static float Yaw(float webRadians) => -webRadians * Mathf.Rad2Deg;
        static Rect R(float minX, float minZ, float maxX, float maxZ) => Rect.MinMaxRect(-maxX, minZ, -minX, maxZ);

        const float GateZ = -58f;
        const float LaneHalf = 3.6f;

        public static MeccaLayout Build(Transform parent)
        {
            var root = new GameObject("Mecca").transform;
            root.SetParent(parent, false);
            var L = new MeccaLayout { Root = root };
            var rnd = new System.Random(42);
            float Rand() => (float)rnd.NextDouble();

            var stoneTex = MaterialKit.Stone();
            var woodMat = MaterialKit.Lit(new Color(0.55f, 0.4f, 0.27f), 0.1f, MaterialKit.Wood());
            var stoneMat = MaterialKit.Lit(new Color(0.78f, 0.7f, 0.6f), 0.05f, stoneTex, new Vector2(3, 2));
            var gateStone = MaterialKit.Lit(new Color(0.74f, 0.65f, 0.54f), 0.05f, stoneTex, new Vector2(1, 2));

            Ground(root);
            Floors(root, stoneTex);
            Mountains(root, Rand);

            // ---------- Training yard (start) ----------
            void Wall(float x, float z, float w, float d, float h = 2.6f, Material m = null) =>
                MeshKit.Prim(PrimitiveType.Cube, root, P(x, z, h / 2), new Vector3(w, h, d), m ?? stoneMat, true, "wall");
            Wall(0, 23, 21, 1);
            Wall(-10, 12.5f, 1, 22);
            Wall(10, 12.5f, 1, 22);
            Wall(-6.8f, 2.4f, 6.4f, 1, 2.2f);
            Wall(6.8f, 2.4f, 6.4f, 1, 2.2f);
            foreach (var (x, z) in new[] { (-6f, 13f), (6f, 13f), (-6.5f, 6f) })
            {
                MeshKit.Prim(PrimitiveType.Cylinder, root, P(x, z, 0.85f), new Vector3(0.3f, 0.85f, 0.3f), woodMat, true, "post");
                MeshKit.Prim(PrimitiveType.Cylinder, root, P(x, z, 1.2f), new Vector3(0.4f, 0.25f, 0.4f), MaterialKit.Lit(new Color(0.6f, 0.52f, 0.4f), 0.05f, MaterialKit.Cloth()), false, "wrap");
            }
            MeshKit.Prim(PrimitiveType.Cube, root, P(-9.2f, 12, 0.6f), new Vector3(0.3f, 1.2f, 1.8f), woodMat, true, "rack");
            MeshKit.Prim(PrimitiveType.Cube, root, P(7.8f, 6, 0.22f), new Vector3(1.8f, 0.45f, 0.6f), woodMat, true, "bench");
            var fire = PointLight(root, P(7.8f, 7.2f, 1.2f), new Color(1f, 0.7f, 0.36f), 3.5f, 8);
            fire.gameObject.AddComponent<Flicker>().Base = 3.5f;
            MeshKit.Prim(PrimitiveType.Sphere, root, P(7.8f, 7.2f, 0.18f), new Vector3(0.5f, 0.3f, 0.5f),
                MaterialKit.Lit(new Color(1f, 0.6f, 0.24f), 0.2f, null, null, new Color(2.5f, 1.2f, 0.3f)), false, "embers");

            // ---------- Houses along the market lane ----------
            var plasterColors = new[] { "#c4a47c", "#b8976f", "#cdb08a", "#b08a62", "#c29d74" };
            void House(float x, float z, float w, float d, float h, bool leftSide, bool door, bool lantern, string awning)
            {
                ColorUtility.TryParseHtmlString(plasterColors[rnd.Next(plasterColors.Length)], out var col);
                var house = new GameObject("house").transform;
                house.SetParent(root, false);
                house.localPosition = P(x, z);
                // Local +Z is the front; turn it to face the lane.
                house.localRotation = Quaternion.Euler(0, leftSide ? -90 : 90, 0);
                var wall = MaterialKit.Lit(col, 0.03f, MaterialKit.Plaster(rnd.Next(1, 4)), new Vector2(w / 4, h / 4));
                MeshKit.Prim(PrimitiveType.Cube, house, new Vector3(0, h / 2, 0), new Vector3(w, h, d), wall, true, "body");
                MeshKit.Prim(PrimitiveType.Cube, house, new Vector3(0, 0.45f, 0), new Vector3(w + 0.12f, 0.9f, d + 0.12f),
                    MaterialKit.Lit(new Color(0.72f, 0.64f, 0.53f), 0.05f, stoneTex, new Vector2(w / 2, 0.5f)), false, "plinth");
                MeshKit.Prim(PrimitiveType.Cube, house, new Vector3(0, h + 0.17f, 0), new Vector3(w + 0.2f, 0.35f, d + 0.2f), wall, false, "parapet");
                float front = d / 2;
                for (float bx = -w / 2 + 0.6f; bx < w / 2; bx += 1.1f)
                    MeshKit.Prim(PrimitiveType.Cube, house, new Vector3(bx, h - 0.4f, front + 0.2f), new Vector3(0.16f, 0.16f, 0.5f), woodMat, false, "beam");
                var darkMat = MaterialKit.Lit(new Color(0.16f, 0.11f, 0.07f), 0f);
                for (float wx = -w / 2 + 1.2f; wx < w / 2 - 0.8f; wx += 2.2f)
                {
                    if (door && Mathf.Abs(wx) < 1.2f) continue;
                    MeshKit.Prim(PrimitiveType.Cube, house, new Vector3(wx, h * 0.62f, front + 0.02f), new Vector3(0.6f, 0.8f, 0.1f), darkMat, false, "window");
                    MeshKit.Prim(PrimitiveType.Cube, house, new Vector3(wx, h * 0.62f + 0.48f, front + 0.05f), new Vector3(0.85f, 0.12f, 0.18f), woodMat, false, "lintel");
                }
                if (door)
                {
                    MeshKit.Prim(PrimitiveType.Cube, house, new Vector3(0, 1.25f, front + 0.05f), new Vector3(1.6f, 2.5f, 0.25f), gateStone, false, "doorframe");
                    MeshKit.Prim(PrimitiveType.Cube, house, new Vector3(0, 1.05f, front + 0.14f), new Vector3(1.1f, 2.1f, 0.12f), woodMat, false, "door");
                }
                if (lantern)
                {
                    var glow = MaterialKit.Lit(new Color(1f, 0.8f, 0.48f), 0.4f, null, null, new Color(3f, 1.6f, 0.5f));
                    MeshKit.Prim(PrimitiveType.Cylinder, house, new Vector3(1f, 2.7f, front + 0.45f), new Vector3(0.26f, 0.16f, 0.26f), glow, false, "lantern");
                    var l = PointLight(house, new Vector3(1f, 2.7f, front + 0.45f), new Color(1f, 0.7f, 0.36f), 4f, 9);
                    l.gameObject.AddComponent<Flicker>().Base = 4f;
                }
                if (awning != null)
                {
                    ColorUtility.TryParseHtmlString(awning, out var ac);
                    var aw = MeshKit.Prim(PrimitiveType.Cube, house, new Vector3(-w / 4, 2.9f, front + 0.9f), new Vector3(3.4f, 0.04f, 1.8f),
                        MaterialKit.Lit(ac, 0.05f, MaterialKit.Cloth(), new Vector2(6, 1)), false, "awning");
                    aw.transform.localRotation = Quaternion.Euler(-24, 0, 0);
                    foreach (var px in new[] { -w / 4 - 1.6f, -w / 4 + 1.6f })
                        MeshKit.Prim(PrimitiveType.Cylinder, house, new Vector3(px, 1.3f, front + 1.7f), new Vector3(0.1f, 1.3f, 0.1f), woodMat, false, "pole");
                }
            }
            float zz = 2;
            var leftRow = new (float w, float d, float h, bool door, bool lantern, string awning)[] {
                (7, 6, 5.5f, false, false, null), (8, 7, 6.5f, false, false, "#8a3b2a"), (9, 7, 7, true, true, null),
                (7, 6, 5, false, false, null), (8, 7, 6, false, false, "#2f4f6b"), (8, 6, 7.5f, false, false, null) };
            foreach (var h in leftRow) { House(-LaneHalf - h.d / 2, zz - h.w / 2, h.w, h.d, h.h, true, h.door, h.lantern, h.awning); zz -= h.w + 0.4f; }
            zz = 2;
            var rightRow = new (float w, float d, float h, bool door, bool lantern, string awning)[] {
                (8, 6, 6, false, false, "#6b5a2f"), (7, 7, 5, false, false, null), (9, 6, 6.5f, false, true, null),
                (6, 6, 5.5f, false, false, null), (9, 7, 7, false, false, "#7a2f45"), (8, 6, 6, false, false, null) };
            for (int i = 0; i < rightRow.Length; i++)
            {
                var h = rightRow[i];
                if (i != 3) House(LaneHalf + h.d / 2, zz - h.w / 2, h.w, h.d, h.h, false, h.door, h.lantern, h.awning); // 4th plot = side alley
                zz -= h.w + 0.4f;
            }

            // Pots and crates along the lane.
            var pot = MeshKit.Lathe(new[] { new Vector2(0, 0), new Vector2(0.18f, 0.02f), new Vector2(0.3f, 0.25f), new Vector2(0.28f, 0.5f), new Vector2(0.14f, 0.68f), new Vector2(0.16f, 0.76f), new Vector2(0, 0.76f) }, 16);
            var potMat = MaterialKit.Lit(new Color(0.66f, 0.39f, 0.24f), 0.15f);
            for (int i = 0; i < 16; i++)
            {
                float side = Rand() > 0.5f ? 1 : -1;
                var p = MeshKit.FromMesh(pot, root, potMat, "pot");
                p.transform.localPosition = P(side * (LaneHalf - 0.4f - Rand() * 0.3f), -Rand() * 46);
                p.transform.localScale = Vector3.one * (0.7f + Rand() * 0.6f);
            }

            // ---------- Back alley, puzzle, cover ----------
            Wall(17, -31, 1, 51, 4);
            Wall(13.8f, -5.8f, 6.4f, 1, 4);
            MeshKit.Block(root, P(13.8f, -1.5f, 2), new Vector3(6.4f, 4, 8));
            var backGate = MeshKit.Prim(PrimitiveType.Cube, root, P(13.7f, -39.5f, 1.6f), new Vector3(6.4f, 3.2f, 0.3f), woodMat, true, "counterweight-gate");
            foreach (var (x, z) in new[] { (11.2f, -40.3f), (16.2f, -40.6f), (12.4f, -41.4f) })
                MeshKit.Prim(PrimitiveType.Sphere, root, P(x, z, 0.4f), Vector3.one * (1.2f + Rand() * 0.5f), gateStone, false, "rubble");
            var lever = MeshKit.Prim(PrimitiveType.Cube, root, P(11.2f, -29.4f, 0.15f), new Vector3(0.5f, 0.3f, 0.5f), gateStone, true, "lever");
            MeshKit.Prim(PrimitiveType.Cylinder, lever.transform, new Vector3(0.3f, 1.5f, 0), new Vector3(0.2f, 1.7f, 0.2f), woodMat, false, "arm").transform.localRotation = Quaternion.Euler(0, 0, 23);
            foreach (var (x, z, w) in new[] { (10.2f, -55.3f, 1.8f), (7.4f, -55.1f, 1.6f), (4.9f, -55.5f, 1.6f) })
            {
                MeshKit.Prim(PrimitiveType.Cube, root, P(x, z, 0.48f), new Vector3(w, 0.95f, 0.9f), woodMat, true, "cover");
                MeshKit.Prim(PrimitiveType.Cube, root, P(x + w * 0.18f, z, 1.3f), new Vector3(w * 0.55f, 0.7f, 0.8f), woodMat, true, "cover-top").transform.localRotation = Quaternion.Euler(0, 12, 0);
            }

            // ---------- Passage gate wall, doors, side door ----------
            foreach (var (cx, w) in new[] { (-3.1f, 2.2f), (3.1f, 2.2f) })
                MeshKit.Prim(PrimitiveType.Cube, root, P(cx, GateZ, 3.25f), new Vector3(w, 6.5f, 2), gateStone, true, "pier");
            MeshKit.Prim(PrimitiveType.Cube, root, P(11, GateZ, 2.75f), new Vector3(14, 5.5f, 1.4f), gateStone, true, "gatewall");
            MeshKit.Prim(PrimitiveType.Cube, root, P(-14.1f, GateZ, 2.75f), new Vector3(8.2f, 5.5f, 1.4f), gateStone, true, "gatewall");
            MeshKit.Prim(PrimitiveType.Cube, root, P(-6.1f, GateZ, 2.75f), new Vector3(3.8f, 5.5f, 1.4f), gateStone, true, "gatewall");
            MeshKit.Prim(PrimitiveType.Cube, root, P(-9, GateZ, 4.2f), new Vector3(2, 2.6f, 1.4f), gateStone, true, "over-door");
            MeshKit.Prim(PrimitiveType.Cube, root, P(0, GateZ, 7.3f), new Vector3(8.4f, 1, 2), gateStone, false, "lintel");
            var arch = MeshKit.Prim(PrimitiveType.Cylinder, root, P(0, GateZ, 5.2f), new Vector3(4.4f, 0.9f, 4.4f), gateStone, false, "arch");
            arch.transform.localRotation = Quaternion.Euler(90, 0, 0);
            var doors = new List<Transform>();
            foreach (var side in new[] { -1f, 1f })
            {
                var hinge = new GameObject("door-hinge").transform;
                hinge.SetParent(root, false);
                hinge.localPosition = P(side * 2f, GateZ);
                MeshKit.Prim(PrimitiveType.Cube, hinge, new Vector3(side * 1.0f, 2.4f, 0), new Vector3(2.0f, 4.8f, 0.25f), woodMat, true, "door");
                doors.Add(hinge);
            }
            var sideHinge = new GameObject("side-door-hinge").transform;
            sideHinge.SetParent(root, false);
            sideHinge.localPosition = P(-9.9f, GateZ + 0.75f);
            MeshKit.Prim(PrimitiveType.Cube, sideHinge, new Vector3(-0.9f, 1.3f, 0), new Vector3(1.8f, 2.6f, 0.2f), woodMat, true, "side-door");

            // ---------- Meeting courtyard ----------
            const float cz = -80;
            var colMat = MaterialKit.Lit(new Color(0.76f, 0.64f, 0.5f), 0.04f, MaterialKit.Plaster(2));
            void Column(float x, float z)
            {
                MeshKit.Prim(PrimitiveType.Cylinder, root, P(x, z, 2.2f), new Vector3(0.7f, 2.2f, 0.7f), colMat, true, "column");
                MeshKit.Prim(PrimitiveType.Cube, root, P(x, z, 4.55f), new Vector3(0.95f, 0.35f, 0.95f), colMat, false, "capital");
            }
            for (float x = -15; x <= 15; x += 3.75f) Column(x, cz - 18);
            for (float z = cz - 14.25f; z <= cz + 12; z += 3.75f) { Column(-15, z); Column(15, z); }
            foreach (var (x, z, w, d) in new[] { (0f, cz - 19.2f, 34f, 3f), (-16.2f, cz - 3, 3f, 33f), (16.2f, cz - 3, 3f, 33f) })
                MeshKit.Prim(PrimitiveType.Cube, root, P(x, z, 4.9f), new Vector3(w, 0.35f, d), woodMat, false, "roof");
            foreach (var (x, z, w, d) in new[] { (0f, cz - 21, 36f, 1.2f), (-18f, cz - 3, 1.2f, 36f), (18f, cz - 3, 1.2f, 36f) })
                Wall(x, z, w, d, 5.4f);
            foreach (var (x, z, h) in new[] { (-10f, cz + 8, 7f), (10f, cz + 8, 8f), (-11f, cz - 12, 7.5f), (11f, cz - 12, 6.5f), (6.5f, -30f, 6f) })
                Palm(root, P(x, z), h, Rand);
            MeshKit.Prim(PrimitiveType.Cube, root, P(0, -95, 1.1f), new Vector3(1.6f, 2.2f, 0.35f), gateStone, true, "tablet");

            // Outer bounds.
            MeshKit.Block(root, P(-30, -28, 2), new Vector3(38, 4, 72));
            MeshKit.Block(root, P(36, -28, 2), new Vector3(38, 4, 72));
            MeshKit.Block(root, P(0, -101, 2), new Vector3(60, 4, 2));

            Dust(root);

            // ---------- Gameplay data ----------
            L.Spawn = P(0, 13);
            L.Checkpoints["staff-training"] = P(0, 12);
            L.Checkpoints["extortioners"] = P(0, -40);
            foreach (var (id, x, z) in new[] {
                ("water-3", -8.6f, 19.5f), ("wood-2", 8.8f, 20f), ("water-1", -2.9f, -8.5f), ("provisions-1", 2.9f, -20.5f),
                ("rope-1", -2.9f, -38.5f), ("fragment-1", 2.6f, -4f), ("merchant-bundle", 15.8f, -8.5f), ("water-2", 11.4f, -14f),
                ("wood-1", 16f, -20f), ("fragment-2", 11.6f, -24.5f), ("provisions-2", 15.6f, -44f), ("rope-2", 11.6f, -48.5f), ("fragment-3", 15.4f, -52f) })
                L.Pickups[id] = P(x, z);
            L.Enemies.Add(new EnemySpawn { EncounterId = "staff-training", Position = P(1.5f, 9), YawDeg = Yaw(Mathf.PI * 0.1f) });
            L.Enemies.Add(new EnemySpawn { EncounterId = "extortioners", Position = P(-2.2f, -51.2f), YawDeg = 0, ScanDeg = 20 });
            L.Enemies.Add(new EnemySpawn { EncounterId = "extortioners", Position = P(0.6f, -50.4f), YawDeg = Yaw(0.15f), ScanDeg = 14 });
            // The lookout keeps turning toward the back streets.
            L.Enemies.Add(new EnemySpawn { EncounterId = "extortioners", Position = P(3.2f, -51.6f), YawDeg = Yaw(Mathf.PI * 0.5f), ScanDeg = 40 });

            void Point(string id, InteractKind kind, string area, float x, float z, float radius, Color? marker = null)
            {
                var ip = new InteractPoint { Id = id, Kind = kind, AreaId = area, Position = P(x, z), Radius = radius };
                if (marker.HasValue) ip.Marker = Marker(root, ip.Position, marker.Value);
                L.Interactables.Add(ip);
            }
            Point("trainer", InteractKind.Trainer, "training-yard", -4.5f, 11, 2.4f);
            Point("rest", InteractKind.Rest, "training-yard", 7.8f, 6.8f, 2.2f, new Color(1f, 0.7f, 0.28f));
            Point("traveler", InteractKind.Traveler, "market-lane", -2.6f, -15.5f, 2.2f);
            Point("merchant", InteractKind.Merchant, "market-lane", -2.7f, -31, 2.2f);
            Point("lever", InteractKind.Lever, "back-alley", 11.2f, -29.4f, 1.8f);
            Point("side-door", InteractKind.SideDoor, "market-lane", -9, -56.6f, 2f);
            Point("arrival-hospitality", InteractKind.Discovery, "meeting-courtyard", 0, -93, 2.4f, new Color(1f, 0.82f, 0.48f));

            L.Puzzle = new GridPuzzle { Origin = P(11.65f, -30.8f), ColDir = Vector3.left, Cell = 1.3f, Cols = 4, Rows = 6 };
            L.Puzzle.Crates.Add(new Vector2Int(1, 1)); L.Puzzle.Crates.Add(new Vector2Int(2, 2));
            L.Puzzle.Plates.Add(new Vector2Int(0, 5)); L.Puzzle.Plates.Add(new Vector2Int(3, 5));
            L.SneakGoal = R(-3.6f, -57.6f, 3.6f, -55.4f);
            L.RouteGoal = R(-10.4f, -61f, -7.6f, -58.9f);

            L.AreaAt = pos =>
            {
                float x = -pos.x, z = pos.z; // back to web coordinates
                if (z < GateZ - 0.8f) return "meeting-courtyard";
                if (z > 2.9f) return "training-yard";
                if (x > 10.6f) return z < -39.5f ? "back-route" : "back-alley";
                if (x > LaneHalf && z < -22.8f && z > -29.6f) return "back-alley";
                return "market-lane";
            };
            var animator = root.gameObject.AddComponent<WorldAnimator>();
            L.OpenGate = () => { foreach (var (d, i) in new[] { (doors[0], -1), (doors[1], 1) }) animator.RotateTo(d, Quaternion.Euler(0, i * 92, 0)); };
            L.OpenSideDoor = () => animator.RotateTo(sideHinge, Quaternion.Euler(0, 97, 0));
            L.RaiseBackGate = () => animator.MoveTo(backGate.transform, backGate.transform.localPosition + Vector3.up * 3.2f);
            return L;
        }

        // ------------------------------------------------------------ pieces
        static Light PointLight(Transform parent, Vector3 pos, Color color, float intensity, float range)
        {
            var go = new GameObject("light");
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            var l = go.AddComponent<Light>();
            l.type = LightType.Point;
            l.color = color;
            l.intensity = intensity;
            l.range = range;
            l.shadows = LightShadows.None;
            return l;
        }

        static void Ground(Transform root)
        {
            // Flat walkable floor under the play area, rolling dunes beyond (visual only).
            MeshKit.Block(root, new Vector3(0, -0.5f, -40), new Vector3(120, 1, 160), "floor");
            const int n = 120; const float size = 400;
            var verts = new Vector3[(n + 1) * (n + 1)];
            var uvs = new Vector2[verts.Length];
            for (int i = 0; i <= n; i++)
                for (int j = 0; j <= n; j++)
                {
                    float x = -size / 2 + size * i / n, z = -size / 2 + size * j / n - 50;
                    float d = Mathf.Sqrt(x * x + (z + 50) * (z + 50));
                    float y = d > 70 ? Mathf.Sin(x * 0.05f) * Mathf.Cos(z * 0.04f) * 2 + (d - 70) * 0.04f : 0;
                    verts[i * (n + 1) + j] = new Vector3(x, y - 0.04f, z);
                    uvs[i * (n + 1) + j] = new Vector2(x / 10f, z / 10f);
                }
            var tris = new List<int>();
            for (int i = 0; i < n; i++)
                for (int j = 0; j < n; j++)
                {
                    int a = i * (n + 1) + j, b = a + n + 1;
                    tris.AddRange(new[] { a, a + 1, b, b, a + 1, b + 1 });
                }
            var mesh = new Mesh { name = "ground", indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
            mesh.vertices = verts; mesh.uv = uvs; mesh.triangles = tris.ToArray();
            mesh.RecalculateNormals();
            MeshKit.FromMesh(mesh, root, MaterialKit.Lit(new Color(0.9f, 0.8f, 0.64f), 0f, MaterialKit.Sand()), "dunes");
        }

        static void Floors(Transform root, Texture2D stone)
        {
            foreach (var (x, z, w, d) in new[] { (0f, -27f, 6f, 62f), (0f, 12.6f, 19f, 20f), (13.5f, -31f, 6f, 50f), (7f, -26.2f, 7f, 6f), (0f, -52.7f, 32f, 10f), (0f, -80f, 34f, 38f) })
                MeshKit.Prim(PrimitiveType.Cube, root, P(x, z, 0.02f), new Vector3(w, 0.04f, d),
                    MaterialKit.Lit(new Color(0.77f, 0.64f, 0.49f), 0.05f, stone, new Vector2(w / 3, d / 3)), false, "paving");
        }

        static void Mountains(Transform root, Func<float> rand)
        {
            var mat = MaterialKit.Lit(new Color(0.61f, 0.46f, 0.32f), 0f);
            for (int i = 0; i < 24; i++)
            {
                float a = i / 24f * Mathf.PI * 2, dist = 150 + rand() * 60, h = 25 + rand() * 45, r = 30 + rand() * 25;
                var hill = MeshKit.FromMesh(MeshKit.Lathe(new[] { new Vector2(r, 0), new Vector2(r * 0.6f, h * 0.45f), new Vector2(r * 0.15f, h * 0.95f), new Vector2(0, h) }, 7), root, mat, "mountain");
                hill.transform.localPosition = new Vector3(Mathf.Cos(a) * dist, -3, -50 + Mathf.Sin(a) * dist);
                hill.transform.localRotation = Quaternion.Euler(0, rand() * 360, 0);
            }
        }

        static void Palm(Transform root, Vector3 pos, float h, Func<float> rand)
        {
            var palm = new GameObject("palm").transform;
            palm.SetParent(root, false);
            palm.localPosition = pos;
            var trunk = MaterialKit.Lit(new Color(0.48f, 0.35f, 0.23f), 0f);
            for (int i = 0; i < 10; i++)
                MeshKit.Prim(PrimitiveType.Cylinder, palm, new Vector3(i * 0.05f, (i + 0.5f) * h / 10, 0), new Vector3(0.34f - i * 0.012f, h / 20, 0.34f - i * 0.012f), trunk, i == 0, "trunk");
            var leaf = MaterialKit.Lit(new Color(0.36f, 0.48f, 0.23f), 0.15f);
            var crown = new GameObject("crown").transform;
            crown.SetParent(palm, false);
            crown.localPosition = new Vector3(0.5f, h, 0);
            for (int i = 0; i < 10; i++)
            {
                var pivot = new GameObject("frond").transform;
                pivot.SetParent(crown, false);
                pivot.localRotation = Quaternion.Euler(28 + rand() * 18, i * 36, 0);
                MeshKit.Prim(PrimitiveType.Cube, pivot, new Vector3(0, 0, 1.6f), new Vector3(0.55f, 0.03f, 3.2f), leaf, false, "leaf");
            }
            crown.gameObject.AddComponent<Sway>();
        }

        static GameObject Marker(Transform root, Vector3 pos, Color color)
        {
            var m = new GameObject("marker");
            m.transform.SetParent(root, false);
            m.transform.localPosition = pos;
            var ring = MeshKit.FromMesh(MeshKit.Ring(0.5f, 0.6f), m.transform, MaterialKit.Unlit(color), "ring");
            ring.transform.localPosition = Vector3.up * 0.06f;
            var beam = MeshKit.Prim(PrimitiveType.Cylinder, m.transform, Vector3.up * 2, new Vector3(1f, 2f, 1f), MaterialKit.Unlit(new Color(color.r, color.g, color.b, 0.12f), true), false, "beam");
            var gem = MeshKit.Prim(PrimitiveType.Cube, m.transform, Vector3.up * 2.4f, Vector3.one * 0.22f, MaterialKit.Unlit(color), false, "gem");
            gem.transform.localRotation = Quaternion.Euler(45, 0, 45);
            gem.AddComponent<Spin>();
            MeshKit.SetLayerRecursive(m, MeshKit.IgnoreRaycastLayer);
            return m;
        }

        static void Dust(Transform root)
        {
            var go = new GameObject("dust");
            go.transform.SetParent(root, false);
            go.transform.localPosition = new Vector3(0, 3, -40);
            var ps = go.AddComponent<ParticleSystem>();
            var main = ps.main;
            main.startLifetime = 12; main.startSpeed = 0.05f; main.startSize = 0.05f; main.maxParticles = 800;
            main.startColor = new Color(1f, 0.92f, 0.75f, 0.55f);
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            var emission = ps.emission; emission.rateOverTime = 60;
            var shape = ps.shape; shape.shapeType = ParticleSystemShapeType.Box; shape.scale = new Vector3(30, 6, 110);
            var noise = ps.noise; noise.enabled = true; noise.strength = 0.1f;
            go.GetComponent<ParticleSystemRenderer>().sharedMaterial = MaterialKit.Unlit(new Color(1f, 0.93f, 0.78f, 0.5f), true);
            ps.Play();
        }
    }

    // ---------------------------------------------------------------- small behaviours
    public class Flicker : MonoBehaviour
    {
        public float Base = 4;
        Light l; float seed;
        void Awake() { l = GetComponent<Light>(); seed = Random.value * 10; }
        void Update() { l.intensity = Base + Mathf.Sin(Time.time * 9 + seed) * 0.4f + Mathf.Sin(Time.time * 23) * 0.2f; }
    }

    public class Sway : MonoBehaviour
    {
        float seed;
        void Awake() => seed = Random.value * 10;
        void Update() => transform.localRotation = Quaternion.Euler(0, 0, Mathf.Sin(Time.time * 0.8f + seed) * 2.3f);
    }

    public class Spin : MonoBehaviour
    {
        Vector3 basePos;
        void Awake() => basePos = transform.localPosition;
        void Update()
        {
            transform.Rotate(0, 90 * Time.deltaTime, 0, Space.World);
            transform.localPosition = basePos + Vector3.up * Mathf.Sin(Time.time * 2) * 0.12f;
        }
    }

    /// <summary>Animates doors and gates opening (rotation or movement over ~1s).</summary>
    public class WorldAnimator : MonoBehaviour
    {
        readonly List<(Transform t, Quaternion? rot, Vector3? pos)> jobs = new();
        public void RotateTo(Transform t, Quaternion rot) => jobs.Add((t, rot, null));
        public void MoveTo(Transform t, Vector3 pos) => jobs.Add((t, null, pos));
        void Update()
        {
            float k = Mathf.Clamp01(Time.deltaTime * 1.6f);
            foreach (var (t, rot, pos) in jobs)
            {
                if (rot.HasValue) t.localRotation = Quaternion.Slerp(t.localRotation, rot.Value, k);
                if (pos.HasValue) t.localPosition = Vector3.Lerp(t.localPosition, pos.Value, k);
            }
        }
    }
}
