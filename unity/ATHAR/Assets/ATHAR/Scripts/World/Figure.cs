using System.Collections.Generic;
using UnityEngine;

namespace Athar.World
{
    /// <summary>Colours and silhouette details for a character design (see art/concepts).</summary>
    public class Look
    {
        public Color Robe, Cloak, Turban, Skin, Beard, Sash;
        public float CloakLength = 0.95f; // 0.55 shawl … 1 full cloak
        public string BeardLength = "full"; // short | full | long | none
        public bool Fringe, Satchel, Staff;

        static Color C(string hex) { ColorUtility.TryParseHtmlString(hex, out var c); return c; }

        public static readonly Dictionary<string, Look> Designs = new()
        {
            ["traveler"] = new Look { Robe = C("#d4c6a8"), Cloak = C("#6e5340"), Turban = C("#b5a789"), Skin = C("#a87a55"), Beard = C("#231a14"), Sash = C("#5a3a24"), BeardLength = "short", CloakLength = 0.85f, Fringe = true, Satchel = true },
            ["steadfast"] = new Look { Robe = C("#5f6878"), Cloak = C("#4a3a2d"), Turban = C("#bcb098"), Skin = C("#9c7152"), Beard = C("#2a2420"), Sash = C("#8a7357"), BeardLength = "full", CloakLength = 1f, Fringe = true },
            ["elder"] = new Look { Robe = C("#d8cdb6"), Cloak = C("#8a4d32"), Turban = C("#bfb296"), Skin = C("#a3765a"), Beard = C("#8f8a84"), Sash = C("#d8cdb6"), BeardLength = "long", CloakLength = 0.62f, Fringe = true, Staff = true },
            ["townsman"] = new Look { Robe = C("#a65f3c"), Cloak = C("#5c3a26"), Turban = C("#cfc2a6"), Skin = C("#ad8059"), Beard = C("#2f2520"), Sash = C("#7a2e1f") },
            ["wayfarer"] = new Look { Robe = C("#8b6d4a"), Cloak = C("#4f3b28"), Turban = C("#a3927a"), Skin = C("#9b7150"), Beard = C("#3b3029"), Sash = C("#5a3a24") },
            ["sparring"] = new Look { Robe = C("#5e7454"), Cloak = C("#3c4a35"), Turban = C("#d3c8b0"), Skin = C("#b48460"), Beard = C("#2a211b"), Sash = C("#3c4a35") },
            ["guide"] = new Look { Robe = C("#3a4a6b"), Cloak = C("#26324a"), Turban = C("#d9cfb8"), Skin = C("#a47a56"), Beard = C("#5a5550"), Sash = C("#7a2e1f") },
        };

        public static Look For(string id) => id != null && Designs.TryGetValue(id, out var l) ? l : Designs["traveler"];
    }

    /// <summary>
    /// A character stand-in built from primitives with procedural animation. The same
    /// animation names (idle, walk, run, attack, block, dodge, crouch, hit, yield, sit, talk)
    /// will map onto Animator states once the rigged Higgsfield models are imported.
    /// </summary>
    public class Figure : MonoBehaviour
    {
        public string Anim { get; private set; } = "idle";
        Transform body, head, armL, armR, footL, footR, staff;
        float phase;

        public static Figure Create(Look look, Transform parent, Vector3 pos, float yawDeg, string name = "Figure")
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localRotation = Quaternion.Euler(0, yawDeg, 0);
            var f = go.AddComponent<Figure>();
            f.Build(look);
            MeshKit.SetLayerRecursive(go, MeshKit.IgnoreRaycastLayer);
            return f;
        }

        void Build(Look look)
        {
            body = new GameObject("body").transform;
            body.SetParent(transform, false);
            var robeMat = MaterialKit.Lit(look.Robe, 0.05f, MaterialKit.Cloth(), new Vector2(3, 1));
            var robe = MeshKit.FromMesh(MeshKit.Lathe(new[] {
                new Vector2(0, 0), new Vector2(0.34f, 0.02f), new Vector2(0.36f, 0.1f), new Vector2(0.33f, 0.5f), new Vector2(0.28f, 0.95f),
                new Vector2(0.26f, 1.2f), new Vector2(0.27f, 1.36f), new Vector2(0.2f, 1.45f), new Vector2(0.11f, 1.5f), new Vector2(0, 1.5f) }, 28), body, robeMat, "robe");

            float hem = 1.45f - look.CloakLength * 1.37f;
            var cloakMat = MaterialKit.Lit(look.Cloak, 0.02f);
            MeshKit.FromMesh(MeshKit.Lathe(new[] {
                new Vector2(0, hem), new Vector2(0.39f, hem + 0.02f), new Vector2(0.37f, Mathf.Max(hem + 0.1f, 0.6f)), new Vector2(0.32f, 1.15f),
                new Vector2(0.31f, 1.38f), new Vector2(0.22f, 1.47f), new Vector2(0, 1.47f) }, 28, 36, 288), body, cloakMat, "cloak");
            if (look.Fringe)
                for (int i = 0; i < 36; i++)
                {
                    float a = (36 + 288f * i / 35) * Mathf.Deg2Rad;
                    MeshKit.Prim(PrimitiveType.Cube, body, new Vector3(Mathf.Sin(a) * 0.39f, hem - 0.03f, Mathf.Cos(a) * 0.39f), new Vector3(0.012f, 0.07f, 0.012f), cloakMat, false);
                }
            var sash = MeshKit.Prim(PrimitiveType.Cylinder, body, new Vector3(0, 0.95f, 0), new Vector3(0.6f, 0.035f, 0.6f), MaterialKit.Lit(look.Sash, 0.1f), false, "sash");

            head = new GameObject("head").transform;
            head.SetParent(body, false);
            head.localPosition = new Vector3(0, 1.62f, 0);
            var skin = MaterialKit.Lit(look.Skin, 0.35f);
            MeshKit.Prim(PrimitiveType.Sphere, head, Vector3.zero, new Vector3(0.25f, 0.29f, 0.26f), skin, false, "face");
            MeshKit.Prim(PrimitiveType.Capsule, head, new Vector3(0, -0.01f, 0.13f), new Vector3(0.04f, 0.035f, 0.04f), skin, false, "nose").transform.localRotation = Quaternion.Euler(90, 0, 0);
            var dark = MaterialKit.Lit(new Color(0.11f, 0.08f, 0.06f), 0.4f);
            foreach (var side in new[] { -1f, 1f })
                MeshKit.Prim(PrimitiveType.Sphere, head, new Vector3(side * 0.045f, 0.03f, 0.118f), Vector3.one * 0.026f, dark, false, "eye");
            if (look.BeardLength != "none")
            {
                float len = look.BeardLength == "short" ? 0.16f : look.BeardLength == "long" ? 0.34f : 0.24f;
                MeshKit.Prim(PrimitiveType.Sphere, head, new Vector3(0, -0.07f - len * 0.25f, 0.06f), new Vector3(0.21f, len, 0.17f), MaterialKit.Lit(look.Beard, 0.05f), false, "beard");
            }
            var wrap = MaterialKit.Lit(look.Turban, 0.05f, MaterialKit.Cloth(), new Vector2(2, 2));
            for (int i = 0; i < 3; i++)
                MeshKit.Prim(PrimitiveType.Sphere, head, new Vector3(0, 0.09f + i * 0.04f, -0.01f), new Vector3(0.31f - i * 0.03f, 0.1f, 0.31f - i * 0.03f), wrap, false, "wrap");
            MeshKit.Prim(PrimitiveType.Sphere, head, new Vector3(0, 0.16f, -0.01f), new Vector3(0.22f, 0.14f, 0.22f), wrap, false, "crown");
            MeshKit.Prim(PrimitiveType.Cube, head, new Vector3(0.02f, -0.08f, -0.13f), new Vector3(0.08f, 0.32f, 0.015f), wrap, false, "tail");

            armL = Arm(-1, look, robeMat, skin);
            armR = Arm(1, look, robeMat, skin);
            footL = MeshKit.Prim(PrimitiveType.Cube, body, new Vector3(-0.11f, 0.025f, 0.05f), new Vector3(0.1f, 0.05f, 0.24f), MaterialKit.Lit(new Color(0.29f, 0.19f, 0.13f), 0.3f), false, "footL").transform;
            footR = MeshKit.Prim(PrimitiveType.Cube, body, new Vector3(0.11f, 0.025f, 0.05f), new Vector3(0.1f, 0.05f, 0.24f), MaterialKit.Lit(new Color(0.29f, 0.19f, 0.13f), 0.3f), false, "footR").transform;
            if (look.Satchel)
            {
                var leather = MaterialKit.Lit(new Color(0.42f, 0.27f, 0.16f), 0.35f);
                MeshKit.Prim(PrimitiveType.Cube, body, new Vector3(0.28f, 0.82f, 0.12f), new Vector3(0.2f, 0.17f, 0.08f), leather, false, "satchel").transform.localRotation = Quaternion.Euler(0, -28, 0);
                MeshKit.Prim(PrimitiveType.Cube, body, new Vector3(0.02f, 1.1f, 0.2f), new Vector3(0.04f, 0.75f, 0.015f), leather, false, "strap").transform.localRotation = Quaternion.Euler(0, 0, 40);
            }
            if (look.Staff) EquipStaff();
            body.localScale = Vector3.one * 1.08f;
        }

        Transform Arm(float side, Look look, Material sleeve, Material skin)
        {
            var shoulder = new GameObject(side < 0 ? "armL" : "armR").transform;
            shoulder.SetParent(body, false);
            shoulder.localPosition = new Vector3(side * 0.3f, 1.38f, 0);
            MeshKit.Prim(PrimitiveType.Capsule, shoulder, new Vector3(0, -0.26f, 0), new Vector3(0.13f, 0.27f, 0.13f), sleeve, false, "sleeve");
            MeshKit.Prim(PrimitiveType.Sphere, shoulder, new Vector3(0, -0.54f, 0), Vector3.one * 0.1f, skin, false, "hand");
            return shoulder;
        }

        /// <summary>The walking staff: the traveler's weapon in training and encounters.</summary>
        public void EquipStaff()
        {
            if (staff) return;
            staff = MeshKit.Prim(PrimitiveType.Cylinder, armR, new Vector3(0, -0.5f, 0.05f), new Vector3(0.05f, 0.85f, 0.05f), MaterialKit.Lit(new Color(0.42f, 0.29f, 0.17f), 0.2f), false, "staff").transform;
            staff.localRotation = Quaternion.Euler(75, 0, 0);
            MeshKit.SetLayerRecursive(staff.gameObject, MeshKit.IgnoreRaycastLayer);
        }

        public void SetAnim(string anim)
        {
            if (anim == Anim) return;
            Anim = anim;
        }

        void Update() => Animate(Time.deltaTime);

        public void Animate(float dt)
        {
            bool moving = Anim == "walk" || Anim == "run" || Anim == "carry" || Anim == "crouch";
            float speed = Anim == "run" ? 11 : moving ? 7 : Anim == "attack" ? 14 : 1.6f;
            phase += dt * speed;
            float p = phase;
            float swing = Anim == "run" ? 50 : 26;

            var bodyPos = new Vector3(0, moving ? Mathf.Abs(Mathf.Sin(p)) * (Anim == "run" ? 0.07f : 0.035f) : Mathf.Sin(p) * 0.006f, 0);
            var bodyRot = new Vector3(Anim == "run" ? 7 : 0, 0, moving ? Mathf.Sin(p) * 1.5f : 0);
            Vector3 l = Vector3.zero, r = Vector3.zero;
            var headRot = new Vector3(0, Anim == "talk" ? Mathf.Sin(p * 0.7f) * 9 : Mathf.Sin(p * 0.3f) * 3, 0);

            switch (Anim)
            {
                case "sit": bodyPos.y = -0.55f; l.x = r.x = -35; break;
                case "attack":
                    float t = (p * 0.9f) % (Mathf.PI * 2);
                    r = new Vector3(-126 + Mathf.Sin(t) * 80, 0, -17); l.x = -52; bodyRot.y = Mathf.Sin(t) * 20; break;
                case "block": l = new Vector3(-86, 0, 29); r = new Vector3(-86, 0, -29); bodyRot.x = -3; break;
                case "dodge": bodyRot.x = 26; bodyPos.y = -0.15f; l.x = r.x = 34; break;
                case "crouch": bodyPos.y = -0.22f; bodyRot.x = 17; l.x = Mathf.Sin(p) * 14 - 17; r.x = -Mathf.Sin(p) * 14 - 17; break;
                case "hit": bodyRot.x = -17; l.x = r.x = -23; break;
                case "yield": bodyPos.y = -0.45f; bodyRot.x = 20; l.x = r.x = 11; headRot.x = 29; break;
                case "carry": l = new Vector3(-63, 0, 14); r = new Vector3(-63, 0, -14); break;
                case "talk": r = new Vector3(-40 + Mathf.Sin(p * 2) * 9, 0, -11); l.x = Mathf.Sin(p) * 3; break;
                default:
                    if (moving) { l.x = Mathf.Sin(p) * swing; r.x = -Mathf.Sin(p) * swing; }
                    else { l = new Vector3(Mathf.Sin(p) * 2, 0, 3.4f); r = new Vector3(-Mathf.Sin(p) * 2, 0, -3.4f); }
                    break;
            }
            float k = Mathf.Clamp01(dt * 14);
            body.localPosition = Vector3.Lerp(body.localPosition, bodyPos, k);
            body.localRotation = Quaternion.Slerp(body.localRotation, Quaternion.Euler(bodyRot), k);
            armL.localRotation = Quaternion.Slerp(armL.localRotation, Quaternion.Euler(l), k);
            armR.localRotation = Quaternion.Slerp(armR.localRotation, Quaternion.Euler(r), k);
            head.localRotation = Quaternion.Slerp(head.localRotation, Quaternion.Euler(headRot), k);
            footL.localPosition = new Vector3(-0.11f, 0.025f, 0.05f + (moving ? Mathf.Sin(p) * 0.16f : 0));
            footR.localPosition = new Vector3(0.11f, 0.025f, 0.05f - (moving ? Mathf.Sin(p) * 0.16f : 0));
        }

        /// <summary>Floating name label above the head.</summary>
        public void SetLabel(string text, Font font)
        {
            var go = new GameObject("label");
            go.transform.SetParent(transform, false);
            go.transform.localPosition = new Vector3(0, 2.15f, 0);
            var tm = go.AddComponent<TextMesh>();
            tm.text = Core.ArabicText.Prepare(text);
            tm.font = font;
            tm.characterSize = 0.05f;
            tm.fontSize = 48;
            tm.anchor = TextAnchor.MiddleCenter;
            tm.color = new Color(1f, 0.95f, 0.86f);
            go.GetComponent<MeshRenderer>().sharedMaterial = font.material;
            go.AddComponent<Billboard>();
        }
    }

    public class Billboard : MonoBehaviour
    {
        void LateUpdate()
        {
            var cam = Camera.main;
            if (cam) transform.rotation = Quaternion.LookRotation(transform.position - cam.transform.position);
        }
    }
}
