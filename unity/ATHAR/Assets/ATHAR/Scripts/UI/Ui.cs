using System;
using System.Collections.Generic;
using Athar.Core;
using UnityEngine;
using UnityEngine.UIElements;

namespace Athar.UI
{
    /// <summary>
    /// UI Toolkit helpers built in code: one panel for the whole game, the ATHAR palette,
    /// Arabic-aware labels (shaped, right-aligned, wrapped), buttons, modals and toasts.
    /// </summary>
    public class Ui : MonoBehaviour
    {
        public static readonly Color Gold = Hex("#e7c27d"), GoldDeep = Hex("#c99a4b"), Ink = Hex("#f6ead4"), InkDim = Hex("#cdb999"),
            Panel = new(0.11f, 0.07f, 0.04f, 0.86f), Edge = new(0.91f, 0.76f, 0.49f, 0.35f), Accent = Hex("#8fd3ff"), Danger = Hex("#ff8f7a"),
            Sourced = Hex("#b6e3a8"), Uncertain = Hex("#ffd38a");

        public VisualElement Root { get; private set; }
        public VisualElement Layer { get; private set; }   // full-screen menus
        VisualElement modalLayer, toastLayer;
        public Font Font { get; private set; }
        public Font FontBold { get; private set; }
        public bool ModalOpen => modalLayer.childCount > 0;
        IPanel panel;

        public static Color Hex(string h) { ColorUtility.TryParseHtmlString(h, out var c); return c; }

        public static Ui Create()
        {
            var go = new GameObject("UI");
            go.SetActive(false);
            var ui = go.AddComponent<Ui>();
            // Created by ATHAR > Set Up Project with the default runtime theme (button and text-field styles).
            var settings = Resources.Load<PanelSettings>("UI/AtharPanel");
            if (!settings) settings = ScriptableObject.CreateInstance<PanelSettings>();
            else settings = Instantiate(settings);
            settings.scaleMode = PanelScaleMode.ScaleWithScreenSize;
            settings.referenceResolution = new Vector2Int(1280, 760);
            settings.screenMatchMode = PanelScreenMatchMode.MatchWidthOrHeight;
            settings.match = 0.5f;
            var doc = go.AddComponent<UIDocument>();
            doc.panelSettings = settings;
            go.SetActive(true);
            ui.Font = Resources.Load<Font>("Fonts/Amiri-Regular");
            ui.FontBold = Resources.Load<Font>("Fonts/Amiri-Bold") ?? ui.Font;
            ui.Root = doc.rootVisualElement;
            ui.panel = ui.Root.panel;
            ui.Root.pickingMode = PickingMode.Ignore;
            ui.Root.style.flexGrow = 1;
            if (ui.Font) ui.Root.style.unityFontDefinition = new StyleFontDefinition(FontDefinition.FromFont(ui.Font));
            ui.Root.style.color = Ink;
            ui.Layer = ui.Full("layer"); ui.Root.Add(ui.Layer);
            ui.modalLayer = ui.Full("modal"); ui.Root.Add(ui.modalLayer);
            ui.toastLayer = new VisualElement { name = "toasts", pickingMode = PickingMode.Ignore };
            ui.toastLayer.style.position = Position.Absolute;
            ui.toastLayer.style.top = 120; ui.toastLayer.style.left = 0; ui.toastLayer.style.right = 0;
            ui.toastLayer.style.alignItems = Align.Center;
            ui.Root.Add(ui.toastLayer);
            return ui;
        }

        VisualElement Full(string name)
        {
            var v = new VisualElement { name = name, pickingMode = PickingMode.Ignore };
            v.style.position = Position.Absolute;
            v.style.left = 0; v.style.right = 0; v.style.top = 0; v.style.bottom = 0;
            return v;
        }

        /// <summary>Is the screen point over an interactive UI element? (Input.mousePosition space)</summary>
        public bool PointerOver(Vector2 screen)
        {
            if (panel == null) return false;
            var p = RuntimePanelUtils.ScreenToPanel(panel, new Vector2(screen.x, Screen.height - screen.y));
            var picked = panel.Pick(p);
            return picked != null && picked != Root;
        }

        // ------------------------------------------------------------ styling helpers
        public static void Pad(VisualElement v, float y, float x)
        {
            v.style.paddingTop = y; v.style.paddingBottom = y; v.style.paddingLeft = x; v.style.paddingRight = x;
        }

        public static void Round(VisualElement v, float r)
        {
            v.style.borderTopLeftRadius = r; v.style.borderTopRightRadius = r; v.style.borderBottomLeftRadius = r; v.style.borderBottomRightRadius = r;
        }

        public static void Border(VisualElement v, Color c, float w = 1)
        {
            v.style.borderTopColor = c; v.style.borderBottomColor = c; v.style.borderLeftColor = c; v.style.borderRightColor = c;
            v.style.borderTopWidth = w; v.style.borderBottomWidth = w; v.style.borderLeftWidth = w; v.style.borderRightWidth = w;
        }

        public static VisualElement Box(Color? bg = null, float radius = 16)
        {
            var v = new VisualElement();
            v.style.backgroundColor = bg ?? Panel;
            Round(v, radius);
            Border(v, Edge);
            return v;
        }

        public static VisualElement Row(float gap = 8)
        {
            var v = new VisualElement();
            v.style.flexDirection = Loc.Rtl ? FlexDirection.RowReverse : FlexDirection.Row;
            v.style.flexWrap = Wrap.Wrap;
            v.style.alignItems = Align.Center;
            v.userData = gap;
            return v;
        }

        /// <summary>A label that renders Arabic correctly: shaped, wrapped at ~maxChars, right-aligned.</summary>
        public Label Text(string text, float size = 20, Color? color = null, bool bold = false, int maxChars = 0, bool center = false)
        {
            var l = new Label(ArabicText.Prepare(text ?? "", maxChars));
            l.style.fontSize = size;
            l.style.color = color ?? Ink;
            l.style.whiteSpace = Loc.Rtl ? WhiteSpace.NoWrap : WhiteSpace.Normal;
            l.style.unityTextAlign = center ? TextAnchor.MiddleCenter : Loc.Rtl ? TextAnchor.UpperRight : TextAnchor.UpperLeft;
            if (bold && FontBold) l.style.unityFontDefinition = new StyleFontDefinition(FontDefinition.FromFont(FontBold));
            l.pickingMode = PickingMode.Ignore;
            return l;
        }

        public Button Btn(string text, Action onClick, bool primary = false, float size = 20)
        {
            var b = new Button(onClick) { text = ArabicText.Prepare(text) };
            b.style.fontSize = size;
            b.style.color = primary ? Hex("#2a1a0c") : Ink;
            b.style.backgroundColor = primary ? Gold : new Color(1f, 0.94f, 0.84f, 0.1f);
            Border(b, primary ? GoldDeep : Edge);
            Round(b, 999);
            Pad(b, 10, 22);
            b.style.marginTop = 4; b.style.marginBottom = 4; b.style.marginLeft = 4; b.style.marginRight = 4;
            b.style.unityTextAlign = TextAnchor.MiddleCenter;
            if (primary && FontBold) b.style.unityFontDefinition = new StyleFontDefinition(FontDefinition.FromFont(FontBold));
            return b;
        }

        // ------------------------------------------------------------ toasts and modals
        public void Toast(string text, Color? color = null)
        {
            var t = Box(Panel, 999);
            Pad(t, 8, 18);
            t.style.marginBottom = 6;
            t.pickingMode = PickingMode.Ignore;
            t.Add(Text(text, 19, color, false, 0, true));
            toastLayer.Add(t);
            t.schedule.Execute(() => t.style.opacity = 0).StartingIn(3000);
            t.schedule.Execute(() => t.RemoveFromHierarchy()).StartingIn(3500);
        }

        public class Action2 { public string Id, Label; public bool Primary; }

        /// <summary>A centred panel; calls back with the id of the pressed action.</summary>
        public VisualElement Modal(string eyebrow, string title, VisualElement body, IList<Action2> actions, Action<string> done, bool history = false)
        {
            CloseModal();
            var shade = Full("shade");
            shade.pickingMode = PickingMode.Position;
            shade.style.backgroundColor = new Color(0.04f, 0.02f, 0.01f, 0.5f);
            shade.style.alignItems = Align.Center;
            shade.style.justifyContent = Justify.Center;
            var box = Box(history ? new Color(0.21f, 0.15f, 0.09f, 0.95f) : Panel, 22);
            if (history) Border(box, new Color(0.94f, 0.89f, 0.76f, 0.6f), 2);
            box.style.width = new Length(92, LengthUnit.Percent);
            box.style.maxWidth = 640;
            Pad(box, 22, 26);
            if (!string.IsNullOrEmpty(eyebrow)) box.Add(Text(eyebrow, 15, history ? Hex("#efe2c2") : Accent));
            if (!string.IsNullOrEmpty(title)) { var tl = Text(title, 30, history ? Hex("#f3e6c4") : Gold, true, 30); tl.style.marginBottom = 10; box.Add(tl); }
            if (body != null) box.Add(body);
            var row = Row();
            row.style.justifyContent = Justify.FlexEnd;
            row.style.marginTop = 14;
            foreach (var a in actions ?? new List<Action2> { new() { Id = "close", Label = Loc.T("close"), Primary = true } })
            {
                var id = a.Id;
                row.Add(Btn(a.Label, () => { CloseModal(); done?.Invoke(id); }, a.Primary));
            }
            box.Add(row);
            shade.Add(box);
            modalLayer.Add(shade);
            return box;
        }

        public void CloseModal() => modalLayer.Clear();

        public void Say(string speaker, string text, Action done = null)
        {
            var body = new VisualElement();
            body.Add(Text(speaker, 20, Gold, true));
            body.Add(Text(text, 21, null, false, 44));
            Modal(null, null, body, new[] { new Action2 { Id = "ok", Label = Loc.T("continue"), Primary = true } }, _ => done?.Invoke());
        }
    }
}
