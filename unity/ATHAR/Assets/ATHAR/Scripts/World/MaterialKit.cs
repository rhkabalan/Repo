using System.Collections.Generic;
using UnityEngine;

namespace Athar.World
{
    /// <summary>
    /// Materials for the procedural world. Uses URP Lit when present (via a template material
    /// created by ATHAR > Set Up Project, so the shader is always included in builds) and falls
    /// back to the built-in Standard shader. Surface textures are generated once at startup.
    /// </summary>
    public static class MaterialKit
    {
        static Material litTemplate, unlitTemplate;
        static readonly Dictionary<string, Material> Cache = new();
        static readonly Dictionary<string, Texture2D> Textures = new();

        static Material LitTemplate()
        {
            if (litTemplate) return litTemplate;
            litTemplate = Resources.Load<Material>("Materials/AtharLit");
            if (!litTemplate)
            {
                var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
                litTemplate = new Material(shader);
            }
            return litTemplate;
        }

        static Material UnlitTemplate()
        {
            if (unlitTemplate) return unlitTemplate;
            unlitTemplate = Resources.Load<Material>("Materials/AtharUnlit");
            if (!unlitTemplate)
            {
                var shader = Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color");
                unlitTemplate = new Material(shader);
            }
            return unlitTemplate;
        }

        static void SetColor(Material m, Color c)
        {
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c);
            if (m.HasProperty("_Color")) m.SetColor("_Color", c);
        }

        static void SetTexture(Material m, Texture2D t, Vector2 tiling)
        {
            if (!t) return;
            foreach (var prop in new[] { "_BaseMap", "_MainTex" })
            {
                if (!m.HasProperty(prop)) continue;
                m.SetTexture(prop, t);
                m.SetTextureScale(prop, tiling);
            }
        }

        public static Material Lit(Color color, float smoothness = 0.1f, Texture2D tex = null, Vector2? tiling = null, Color? emission = null)
        {
            var key = $"lit:{ColorUtility.ToHtmlStringRGBA(color)}:{smoothness}:{(tex ? tex.name : "")}:{tiling}:{emission}";
            if (Cache.TryGetValue(key, out var cached)) return cached;
            var m = new Material(LitTemplate());
            SetColor(m, color);
            if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", smoothness);
            if (m.HasProperty("_Glossiness")) m.SetFloat("_Glossiness", smoothness);
            SetTexture(m, tex, tiling ?? Vector2.one);
            if (emission.HasValue)
            {
                m.EnableKeyword("_EMISSION");
                m.SetColor("_EmissionColor", emission.Value);
                m.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
            }
            Cache[key] = m;
            return m;
        }

        /// <summary>Unlit, optionally transparent (markers, sight cones, effects).</summary>
        public static Material Unlit(Color color, bool transparent = false)
        {
            var m = new Material(UnlitTemplate());
            SetColor(m, color);
            if (transparent)
            {
                // URP Unlit transparent setup.
                if (m.HasProperty("_Surface")) m.SetFloat("_Surface", 1);
                if (m.HasProperty("_Blend")) m.SetFloat("_Blend", 0);
                m.SetOverrideTag("RenderType", "Transparent");
                m.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
                m.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
                m.SetInt("_ZWrite", 0);
                m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
                m.renderQueue = (int)UnityEngine.Rendering.RenderQueue.Transparent;
                if (m.HasProperty("_Cull")) m.SetFloat("_Cull", 0);
            }
            return m;
        }

        // ------------------------------------------------------------ procedural textures
        static float Hash(int x, int y, int seed)
        {
            unchecked
            {
                int h = x * 374761393 + y * 668265263 + seed * 2147483647;
                h = (h ^ (h >> 13)) * 1274126177;
                return ((h ^ (h >> 16)) & 0xffff) / 65535f;
            }
        }

        static float Noise(float x, float y, int seed)
        {
            int xi = Mathf.FloorToInt(x), yi = Mathf.FloorToInt(y);
            float xf = x - xi, yf = y - yi;
            float u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
            float a = Hash(xi, yi, seed), b = Hash(xi + 1, yi, seed), c = Hash(xi, yi + 1, seed), d = Hash(xi + 1, yi + 1, seed);
            return Mathf.Lerp(Mathf.Lerp(a, b, u), Mathf.Lerp(c, d, u), v);
        }

        static float Fbm(float x, float y, int seed)
        {
            float sum = 0, amp = 0.5f, freq = 1;
            for (int i = 0; i < 4; i++) { sum += Noise(x * freq, y * freq, seed + i) * amp; amp *= 0.5f; freq *= 2.1f; }
            return sum;
        }

        static Texture2D Make(string name, int size, System.Func<int, int, Color> pixel)
        {
            if (Textures.TryGetValue(name, out var t)) return t;
            t = new Texture2D(size, size, TextureFormat.RGBA32, true) { name = name, wrapMode = TextureWrapMode.Repeat, anisoLevel = 8 };
            var px = new Color[size * size];
            for (int y = 0; y < size; y++) for (int x = 0; x < size; x++) px[y * size + x] = pixel(x, y);
            t.SetPixels(px);
            t.Apply(true, true);
            Textures[name] = t;
            return t;
        }

        /// <summary>Weathered lime plaster: soft blotches, grain and streaks from the top.</summary>
        public static Texture2D Plaster(int seed = 1) => Make($"plaster{seed}", 256, (x, y) =>
        {
            float n = Fbm(x / 48f, y / 48f, seed) * 0.22f + Hash(x, y, seed) * 0.07f;
            float streak = Fbm(x / 6f, 0.5f, seed + 9) * Mathf.Clamp01((y - 120) / 136f) * 0.12f;
            float v = 0.9f - n - streak;
            return new Color(v, v * 0.97f, v * 0.93f);
        });

        /// <summary>Cut stone blocks in staggered courses.</summary>
        public static Texture2D Stone(int seed = 3) => Make($"stone{seed}", 256, (x, y) =>
        {
            int row = y / 32;
            int offset = row % 2 == 0 ? 0 : 24;
            int col = (x + offset) / 48;
            bool mortar = y % 32 < 2 || (x + offset) % 48 < 2;
            float tone = 0.72f + Hash(col, row, seed) * 0.2f - Hash(x, y, seed) * 0.08f;
            if (mortar) tone *= 0.55f;
            return new Color(tone, tone * 0.93f, tone * 0.82f);
        });

        /// <summary>Fine desert sand with darker grains.</summary>
        public static Texture2D Sand() => Make("sand", 512, (x, y) =>
        {
            float n = Fbm(x / 90f, y / 90f, 7) * 0.18f + Hash(x, y, 7) * 0.12f;
            float v = 0.86f - n;
            return new Color(v, v * 0.86f, v * 0.66f);
        });

        /// <summary>Striped woven cloth.</summary>
        public static Texture2D Cloth() => Make("cloth", 64, (x, y) =>
        {
            float stripe = (x / 8) % 2 == 0 ? 1f : 0.86f;
            float v = stripe * (0.92f + Hash(x, y, 4) * 0.08f);
            return new Color(v, v, v);
        });

        /// <summary>Planked wood grain.</summary>
        public static Texture2D Wood() => Make("wood", 128, (x, y) =>
        {
            float grain = Fbm(x / 40f, y / 3f, 11) * 0.35f;
            bool gap = x % 42 < 2;
            float v = 0.55f - grain + Hash(x, y, 11) * 0.05f;
            if (gap) v *= 0.5f;
            return new Color(v * 1.1f, v * 0.78f, v * 0.5f);
        });
    }
}
