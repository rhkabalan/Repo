using System.Collections.Generic;
using UnityEngine;

namespace Athar.World
{
    /// <summary>Small procedural mesh builders and GameObject helpers.</summary>
    public static class MeshKit
    {
        public const int IgnoreRaycastLayer = 2;

        /// <summary>Surface of revolution around Y from a (radius, height) profile.</summary>
        public static Mesh Lathe(IList<Vector2> profile, int segments = 24, float startDeg = 0, float lengthDeg = 360)
        {
            var verts = new List<Vector3>();
            var uvs = new List<Vector2>();
            var tris = new List<int>();
            int rings = profile.Count;
            for (int s = 0; s <= segments; s++)
            {
                float a = (startDeg + lengthDeg * s / segments) * Mathf.Deg2Rad;
                float sin = Mathf.Sin(a), cos = Mathf.Cos(a);
                for (int r = 0; r < rings; r++)
                {
                    var p = profile[r];
                    verts.Add(new Vector3(p.x * sin, p.y, p.x * cos));
                    uvs.Add(new Vector2((float)s / segments * 4, p.y));
                }
            }
            for (int s = 0; s < segments; s++)
                for (int r = 0; r < rings - 1; r++)
                {
                    int a = s * rings + r, b = (s + 1) * rings + r;
                    tris.AddRange(new[] { a, a + 1, b, b, a + 1, b + 1 });
                }
            var mesh = new Mesh { name = "lathe" };
            mesh.SetVertices(verts);
            mesh.SetUVs(0, uvs);
            mesh.SetTriangles(tris, 0);
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            return mesh;
        }

        /// <summary>Flat ring sector on the XZ plane (telegraphs, swing arcs, pressure stones).</summary>
        public static Mesh Ring(float inner, float outer, float startDeg = 0, float lengthDeg = 360, int segments = 32)
        {
            var verts = new List<Vector3>();
            var tris = new List<int>();
            for (int s = 0; s <= segments; s++)
            {
                float a = (startDeg + lengthDeg * s / segments) * Mathf.Deg2Rad;
                var dir = new Vector3(Mathf.Sin(a), 0, Mathf.Cos(a));
                verts.Add(dir * inner);
                verts.Add(dir * outer);
            }
            for (int s = 0; s < segments; s++)
            {
                int i = s * 2;
                tris.AddRange(new[] { i, i + 1, i + 2, i + 1, i + 3, i + 2 });
                tris.AddRange(new[] { i, i + 2, i + 1, i + 1, i + 2, i + 3 }); // double-sided
            }
            var mesh = new Mesh { name = "ring" };
            mesh.SetVertices(verts);
            mesh.SetTriangles(tris, 0);
            mesh.RecalculateNormals();
            return mesh;
        }

        /// <summary>A flat fan (vision cone) pointing along +Z.</summary>
        public static Mesh Fan(float radius, float fovDeg, int segments = 24) => Ring(0.01f, radius, -fovDeg / 2, fovDeg, segments);

        public static GameObject Prim(PrimitiveType type, Transform parent, Vector3 pos, Vector3 scale, Material mat, bool collider = true, string name = null)
        {
            var go = GameObject.CreatePrimitive(type);
            if (name != null) go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            go.GetComponent<Renderer>().sharedMaterial = mat;
            if (!collider) Object.Destroy(go.GetComponent<Collider>());
            return go;
        }

        public static GameObject FromMesh(Mesh mesh, Transform parent, Material mat, string name = "mesh")
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            go.AddComponent<MeshRenderer>().sharedMaterial = mat;
            return go;
        }

        /// <summary>An invisible wall.</summary>
        public static BoxCollider Block(Transform parent, Vector3 center, Vector3 size, string name = "block")
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = center;
            var c = go.AddComponent<BoxCollider>();
            c.size = size;
            return c;
        }

        public static void SetLayerRecursive(GameObject go, int layer)
        {
            go.layer = layer;
            foreach (Transform t in go.transform) SetLayerRecursive(t.gameObject, layer);
        }
    }
}
