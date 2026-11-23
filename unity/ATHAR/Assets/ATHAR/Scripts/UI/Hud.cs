using System;
using System.Collections.Generic;
using Athar.Core;
using Athar.Gameplay;
using UnityEngine;
using UnityEngine.UIElements;

namespace Athar.UI
{
    /// <summary>In-game HUD: objective, vitals, supplies, XP, minimap, detection, prompt and touch controls.</summary>
    public class Hud
    {
        readonly Ui ui;
        readonly InputReader input;
        public readonly VisualElement Root;
        Label objective, xp;
        VisualElement healthFill, staminaFill, inv, detect, detectFill, sneakBtn;
        Button prompt;
        readonly Image minimap;
        readonly Texture2D mapTex;
        readonly Color32[] mapPixels;
        const int MapW = 120, MapH = 150;

        public event Action Hint, Menu, PromptTapped;


        public Hud(Ui ui, InputReader input)
        {
            this.ui = ui; this.input = input;
            Root = new VisualElement { pickingMode = PickingMode.Ignore };
            Root.style.position = Position.Absolute;
            Root.style.left = 0; Root.style.right = 0; Root.style.top = 0; Root.style.bottom = 0;

            // Top: objective + vitals + supplies on the reading side, buttons and map on the other.
            var top = Ui.Row(10);
            top.pickingMode = PickingMode.Ignore;
            top.style.position = Position.Absolute;
            top.style.top = 14; top.style.left = 14; top.style.right = 14;
            top.style.justifyContent = Justify.SpaceBetween;
            top.style.alignItems = Align.FlexStart;
            top.style.flexWrap = Wrap.NoWrap;

            var left = new VisualElement { pickingMode = PickingMode.Ignore };
            left.style.maxWidth = 460;
            var obj = Ui.Box();
            Ui.Pad(obj, 10, 16);
            obj.pickingMode = PickingMode.Ignore;
            obj.Add(ui.Text(Loc.T("objective"), 14, Ui.Gold));
            objective = ui.Text("", 19, null, false, 40);
            obj.Add(objective);
            left.Add(obj);
            healthFill = Bar(left, Ui.Hex("#e0875a"));
            staminaFill = Bar(left, Ui.Hex("#e7c27d"));
            inv = Ui.Row(6);
            inv.pickingMode = PickingMode.Ignore;
            inv.style.marginTop = 6;
            left.Add(inv);

            var right = new VisualElement { pickingMode = PickingMode.Ignore };
            right.style.alignItems = Loc.Rtl ? Align.FlexStart : Align.FlexEnd;
            var buttons = Ui.Row();
            buttons.Add(ui.Btn(Loc.T("hint"), () => Hint?.Invoke(), false, 17));
            buttons.Add(ui.Btn("☰", () => Menu?.Invoke(), false, 17));
            right.Add(buttons);
            var xpPill = Ui.Box(Ui.Panel, 999);
            Ui.Pad(xpPill, 6, 14);
            xp = ui.Text("0", 18, Ui.Gold, true);
            xpPill.Add(xp);
            right.Add(xpPill);
            mapTex = new Texture2D(MapW, MapH, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear };
            mapPixels = new Color32[MapW * MapH];
            minimap = new Image { image = mapTex, pickingMode = PickingMode.Ignore };
            minimap.style.width = 120; minimap.style.height = 150; minimap.style.marginTop = 6;
            Ui.Round(minimap, 14);
            Ui.Border(minimap, Ui.Edge);
            minimap.style.backgroundColor = new Color(0.11f, 0.07f, 0.04f, 0.7f);
            right.Add(minimap);

            top.Add(left);
            top.Add(right);
            Root.Add(top);

            // Detection meter.
            detect = new VisualElement { pickingMode = PickingMode.Ignore };
            detect.style.position = Position.Absolute;
            detect.style.top = 170; detect.style.left = new Length(50, LengthUnit.Percent); detect.style.marginLeft = -80;
            detect.style.width = 160; detect.style.height = 8;
            detect.style.backgroundColor = new Color(0.08f, 0.05f, 0.02f, 0.6f);
            Ui.Round(detect, 999); Ui.Border(detect, new Color(1f, 0.42f, 0.24f, 0.5f));
            detectFill = new VisualElement();
            detectFill.style.height = new Length(100, LengthUnit.Percent);
            detectFill.style.backgroundColor = Ui.Hex("#ff8a4d");
            Ui.Round(detectFill, 999);
            detect.Add(detectFill);
            Root.Add(detect);

            // Context prompt (tap to interact).
            prompt = ui.Btn("", () => PromptTapped?.Invoke(), true, 19);
            prompt.style.position = Position.Absolute;
            prompt.style.bottom = 220; prompt.style.alignSelf = Align.Center;
            prompt.style.left = new Length(50, LengthUnit.Percent);
            prompt.style.translate = new Translate(new Length(-50, LengthUnit.Percent), 0);
            Root.Add(prompt);

            BuildTouchControls();
        }

        VisualElement Bar(VisualElement parent, Color c)
        {
            var bar = new VisualElement { pickingMode = PickingMode.Ignore };
            bar.style.height = 9; bar.style.width = 240; bar.style.marginTop = 6;
            bar.style.backgroundColor = new Color(0.08f, 0.05f, 0.02f, 0.6f);
            Ui.Round(bar, 999); Ui.Border(bar, Ui.Edge);
            var fill = new VisualElement();
            fill.style.height = new Length(100, LengthUnit.Percent);
            fill.style.backgroundColor = c;
            Ui.Round(fill, 999);
            bar.Add(fill);
            if (Loc.Rtl) bar.style.flexDirection = FlexDirection.RowReverse;
            parent.Add(bar);
            return fill;
        }

        VisualElement Circle(string label, float size, bool primary)
        {
            var b = new VisualElement();
            b.style.position = Position.Absolute;
            b.style.width = size; b.style.height = size;
            b.style.backgroundColor = primary ? Ui.Gold : Ui.Panel;
            Ui.Round(b, size / 2); Ui.Border(b, Ui.Edge);
            b.style.alignItems = Align.Center; b.style.justifyContent = Justify.Center;
            b.Add(ui.Text(label, primary ? 20 : 16, primary ? Ui.Hex("#2a1a0c") : Ui.Ink, primary, 0, true));
            return b;
        }

        void BuildTouchControls()
        {
            // Joystick, bottom-left in both languages (thumb position, not reading direction).
            var pad = new VisualElement();
            pad.style.position = Position.Absolute;
            pad.style.left = 26; pad.style.bottom = 26; pad.style.width = 140; pad.style.height = 140;
            pad.style.backgroundColor = new Color(1f, 0.94f, 0.84f, 0.08f);
            Ui.Round(pad, 70); Ui.Border(pad, Ui.Edge);
            var knob = new VisualElement { pickingMode = PickingMode.Ignore };
            knob.style.position = Position.Absolute; knob.style.width = 60; knob.style.height = 60;
            knob.style.left = 40; knob.style.top = 40;
            knob.style.backgroundColor = Ui.Gold;
            Ui.Round(knob, 30);
            pad.Add(knob);
            int pointer = -1;
            void Update(Vector2 local)
            {
                var v = local - new Vector2(70, 70);
                v = Vector2.ClampMagnitude(v, 52);
                knob.style.left = 40 + v.x; knob.style.top = 40 + v.y;
                input.Joystick = new Vector2(v.x / 52, -v.y / 52);
            }
            pad.RegisterCallback<PointerDownEvent>(e => { pointer = e.pointerId; pad.CapturePointer(e.pointerId); Update(e.localPosition); });
            pad.RegisterCallback<PointerMoveEvent>(e => { if (e.pointerId == pointer) Update(e.localPosition); });
            void End(int id) { if (id != pointer) return; pointer = -1; pad.ReleasePointer(id); input.Joystick = Vector2.zero; knob.style.left = 40; knob.style.top = 40; }
            pad.RegisterCallback<PointerUpEvent>(e => End(e.pointerId));
            pad.RegisterCallback<PointerCancelEvent>(e => End(e.pointerId));
            Root.Add(pad);

            // Actions, bottom-right.
            var cluster = new VisualElement();
            cluster.style.position = Position.Absolute;
            cluster.style.right = 18; cluster.style.bottom = 20; cluster.style.width = 200; cluster.style.height = 200;
            cluster.pickingMode = PickingMode.Ignore;
            var attack = Circle(Loc.T("attack"), 94, true); attack.style.right = 8; attack.style.bottom = 8;
            var block = Circle(Loc.T("block"), 66, false); block.style.right = 114; block.style.bottom = 4;
            var dodge = Circle(Loc.T("dodge"), 66, false); dodge.style.right = 26; dodge.style.bottom = 114;
            sneakBtn = Circle(Loc.T("sneak"), 56, false); sneakBtn.style.right = 114; sneakBtn.style.bottom = 96;
            attack.RegisterCallback<PointerDownEvent>(_ => input.FireAttack());
            dodge.RegisterCallback<PointerDownEvent>(_ => input.FireDodge());
            sneakBtn.RegisterCallback<PointerDownEvent>(_ => input.ToggleSneak());
            block.RegisterCallback<PointerDownEvent>(e => { block.CapturePointer(e.pointerId); input.TouchBlock = true; block.style.backgroundColor = new Color(0.56f, 0.83f, 1f, 0.35f); });
            void Release(int id) { block.ReleasePointer(id); input.TouchBlock = false; block.style.backgroundColor = Ui.Panel; }
            block.RegisterCallback<PointerUpEvent>(e => Release(e.pointerId));
            block.RegisterCallback<PointerCancelEvent>(e => Release(e.pointerId));
            cluster.Add(attack); cluster.Add(block); cluster.Add(dodge); cluster.Add(sneakBtn);
            Root.Add(cluster);
            if (Application.platform != RuntimePlatform.Android && Application.platform != RuntimePlatform.IPhonePlayer)
            {
                pad.style.opacity = 0.5f;
                cluster.style.opacity = 0.5f;
            }
        }

        // ------------------------------------------------------------ updates
        public void SetObjective(string text) { objective.text = ArabicText.Prepare(text, 40); }
        public void SetXp(int earned) { xp.text = ArabicText.Prepare($"{earned} {Loc.T("xp")}"); }

        public void SetVitals(PlayerCombat me)
        {
            healthFill.style.width = new Length(me.Health / me.Stats.MaxHealth * 100, LengthUnit.Percent);
            staminaFill.style.width = new Length(me.Stamina / me.Stats.MaxStamina * 100, LengthUnit.Percent);
            sneakBtn.style.backgroundColor = input.Sneak ? new Color(0.56f, 0.83f, 1f, 0.35f) : Ui.Panel;
        }

        public void SetInventory(Journey j)
        {
            inv.Clear();
            foreach (var item in j.Catalog.Items)
            {
                int n = j.Count(item.Id);
                if (n <= 0) continue;
                var chip = Ui.Box(Ui.Panel, 999);
                Ui.Pad(chip, 3, 10);
                chip.style.marginRight = 4; chip.style.marginLeft = 4;
                int cap = j.CapacityFor(item.Id);
                chip.Add(ui.Text($"{Loc.Of(item.Name)} {n}{(cap > 1 ? "/" + cap : "")}", 16));
                inv.Add(chip);
            }
        }

        public void SetDetection(float amount)
        {
            detect.style.display = amount < 0.02f ? DisplayStyle.None : DisplayStyle.Flex;
            detectFill.style.width = new Length(amount * 100, LengthUnit.Percent);
        }

        public void SetPrompt(string text)
        {
            prompt.style.display = string.IsNullOrEmpty(text) ? DisplayStyle.None : DisplayStyle.Flex;
            if (!string.IsNullOrEmpty(text)) prompt.text = ArabicText.Prepare($"{Loc.T("interact")} — {text}");
        }

        /// <summary>Draws the minimap. Points are (world position, colour, radius in pixels).</summary>
        public void DrawMap(Func<Vector3, Vector2> toMap, IEnumerable<(Rect r, Color c)> areas, IEnumerable<(Vector3 p, Color c, int r)> dots)
        {
            var clear = new Color32(0, 0, 0, 0);
            for (int i = 0; i < mapPixels.Length; i++) mapPixels[i] = clear;
            foreach (var (r, c) in areas)
            {
                var a = toMap(new Vector3(r.xMin, 0, r.yMin));
                var b = toMap(new Vector3(r.xMax, 0, r.yMax));
                int x0 = Mathf.Clamp(Mathf.RoundToInt(Mathf.Min(a.x, b.x)), 0, MapW - 1), x1 = Mathf.Clamp(Mathf.RoundToInt(Mathf.Max(a.x, b.x)), 0, MapW - 1);
                int y0 = Mathf.Clamp(Mathf.RoundToInt(Mathf.Min(a.y, b.y)), 0, MapH - 1), y1 = Mathf.Clamp(Mathf.RoundToInt(Mathf.Max(a.y, b.y)), 0, MapH - 1);
                for (int y = y0; y <= y1; y++) for (int x = x0; x <= x1; x++) mapPixels[(MapH - 1 - y) * MapW + x] = c;
            }
            foreach (var (p, c, rad) in dots)
            {
                var m = toMap(p);
                for (int dy = -rad; dy <= rad; dy++)
                    for (int dx = -rad; dx <= rad; dx++)
                    {
                        if (dx * dx + dy * dy > rad * rad) continue;
                        int x = Mathf.RoundToInt(m.x) + dx, y = Mathf.RoundToInt(m.y) + dy;
                        if (x < 0 || y < 0 || x >= MapW || y >= MapH) continue;
                        mapPixels[(MapH - 1 - y) * MapW + x] = c;
                    }
            }
            mapTex.SetPixels32(mapPixels);
            mapTex.Apply(false);
        }

        public const int Width = MapW, Height = MapH;
    }
}
