using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Athar.Core;
using Athar.Gameplay;
using Athar.UI;
using Athar.World;
using UnityEngine;
using UnityEngine.UIElements;

namespace Athar.Game
{
    /// <summary>
    /// Runs ATHAR: environment, menus, and the Mecca adventure. The player is a fictional
    /// traveler; all action belongs to them. Abu Dharr appears only in sourced historical
    /// scenes, shown in their own frame and kept apart from the fiction.
    /// </summary>
    public class AtharGame : MonoBehaviour
    {
        /// <summary>Hook for render-pipeline setup (post-processing), registered by Rendering/PostFx.</summary>
        public static Action<Camera> ConfigureCamera;

        const string ChapterId = "mecca";
        Catalog catalog;
        Journey journey;
        Ui ui;
        Hud hud;
        InputReader input;
        Camera cam;
        FollowCamera follow;

        // Session state
        GameObject worldRoot;
        MeccaLayout layout;
        PlayerMotor player;
        PlayerCombat me;
        Fight training, gang;
        Effects effects;
        PushPuzzle puzzle;
        readonly List<Pickup> pickups = new();
        readonly List<Figure> npcs = new();
        InteractPoint nearest;
        bool busy, playing;
        float hitStop, mapTimer;

        string ProfileName { get => PlayerPrefs.GetString("athar.name", ""); set => PlayerPrefs.SetString("athar.name", value); }
        string CharacterId { get => PlayerPrefs.GetString("athar.character", ""); set => PlayerPrefs.SetString("athar.character", value); }
        Chapter Chapter => catalog.Chapter(ChapterId);
        Mission Mission => Chapter.Mission;
        ChapterProgress Run => journey.Progress(ChapterId);

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot()
        {
            if (FindObjectOfType<AtharGame>() == null) new GameObject("ATHAR").AddComponent<AtharGame>();
        }

        void Awake()
        {
            Application.targetFrameRate = 60;
            Loc.Init();
            catalog = Catalog.Load();
            journey = new Journey(catalog);
            input = gameObject.AddComponent<InputReader>();
            SetUpEnvironment();
            ui = Ui.Create();
            input.PointerOverUi = p => ui.PointerOver(p);
            ShowTitle();
        }

        // ------------------------------------------------------------ environment
        void SetUpEnvironment()
        {
            cam = Camera.main;
            if (!cam)
            {
                var go = new GameObject("Main Camera") { tag = "MainCamera" };
                cam = go.AddComponent<Camera>();
            }
            cam.fieldOfView = Screen.width < Screen.height ? 62 : 50;
            cam.nearClipPlane = 0.1f; cam.farClipPlane = 600;
            cam.allowHDR = true;
            follow = cam.gameObject.GetComponent<FollowCamera>() ?? cam.gameObject.AddComponent<FollowCamera>();
            ConfigureCamera?.Invoke(cam);

            foreach (var l in FindObjectsOfType<Light>()) if (l.type == LightType.Directional) Destroy(l.gameObject);
            var sun = new GameObject("Sun").AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1f, 0.82f, 0.6f);
            sun.intensity = 1.6f;
            sun.shadows = LightShadows.Soft;
            sun.shadowStrength = 0.85f;
            // Low golden-hour sun behind the camera's right shoulder, raking across the lane.
            sun.transform.rotation = Quaternion.LookRotation(new Vector3(0.79f, -0.37f, -0.49f));
            RenderSettings.sun = sun;

            var sky = Resources.Load<Material>("Materials/AtharSky");
            if (!sky) { var s = Shader.Find("Skybox/Procedural"); if (s) { sky = new Material(s); sky.SetFloat("_SunSize", 0.05f); sky.SetFloat("_AtmosphereThickness", 0.8f); sky.SetFloat("_Exposure", 1.1f); } }
            if (sky) RenderSettings.skybox = sky;
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.78f, 0.74f, 0.66f);
            RenderSettings.ambientEquatorColor = new Color(0.62f, 0.5f, 0.38f);
            RenderSettings.ambientGroundColor = new Color(0.36f, 0.26f, 0.17f);
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogColor = new Color(0.85f, 0.72f, 0.56f);
            RenderSettings.fogDensity = 0.0055f;
            QualitySettings.shadowDistance = 70;
        }

        // ------------------------------------------------------------ menus
        void Clear() { ui.Layer.Clear(); ui.CloseModal(); }

        VisualElement Sheet(float maxWidth = 760)
        {
            Clear();
            // Out of play, menus sit over the period painting of Mecca (art/locations).
            if (!playing)
            {
                var backdrop = new VisualElement();
                backdrop.style.position = Position.Absolute;
                backdrop.style.left = 0; backdrop.style.right = 0; backdrop.style.top = 0; backdrop.style.bottom = 0;
                var art = Resources.Load<Texture2D>("Locations/mecca-kaaba");
                if (art) backdrop.style.backgroundImage = new StyleBackground(art);
                backdrop.style.unityBackgroundScaleMode = ScaleMode.ScaleAndCrop;
                ui.Layer.Add(backdrop);
            }
            var shade = new VisualElement();
            shade.style.position = Position.Absolute;
            shade.style.left = 0; shade.style.right = 0; shade.style.top = 0; shade.style.bottom = 0;
            shade.style.backgroundColor = new Color(0.08f, 0.05f, 0.03f, playing ? 0.75f : 0.62f);
            shade.style.alignItems = Align.Center; shade.style.justifyContent = Justify.Center;
            var sheet = new ScrollView();
            sheet.style.maxWidth = maxWidth;
            sheet.style.width = new Length(94, LengthUnit.Percent);
            sheet.style.maxHeight = new Length(94, LengthUnit.Percent);
            shade.Add(sheet);
            ui.Layer.Add(shade);
            return sheet;
        }

        void ShowTitle()
        {
            playing = false;
            var s = Sheet(560);
            s.style.alignItems = Align.Center;
            s.Add(ui.Text(Loc.T("title"), 96, Ui.Gold, true, 0, true));
            s.Add(ui.Text(Loc.T("subtitle"), 20, Ui.InkDim, false, 40, true));
            var menu = new VisualElement();
            menu.style.marginTop = 24; menu.style.width = 340; menu.style.alignSelf = Align.Center;
            menu.Add(ui.Btn(Loc.T("play"), () => { if (string.IsNullOrEmpty(CharacterId)) ShowCharacterSelect(StartMecca); else StartMecca(); }, true, 22));
            menu.Add(ui.Btn(Loc.Rtl ? "شخصيتك" : "Your character", () => ShowCharacterSelect(ShowTitle)));
            menu.Add(ui.Btn(Loc.T("journal"), ShowJournal));
            menu.Add(ui.Btn(Loc.T("language"), () => { Loc.Set(Loc.Rtl ? Lang.En : Lang.Ar); ShowTitle(); }));
            s.Add(menu);
            if (!string.IsNullOrEmpty(CharacterId))
                s.Add(ui.Text($"{ProfileName} · {CharacterName(CharacterId)}", 18, Ui.InkDim, false, 0, true));
        }

        static string CharacterName(string id) => id switch
        {
            "steadfast" => Loc.Rtl ? "الثابت" : "The Steadfast",
            "elder" => Loc.Rtl ? "الشيخ" : "The Elder",
            _ => Loc.Rtl ? "المسافر" : "The Traveler",
        };

        static string CharacterTag(string id) => id switch
        {
            "steadfast" => Loc.Rtl ? "صلبٌ في الحق، لا تلين له عزيمة." : "Firm in truth; his resolve does not bend.",
            "elder" => Loc.Rtl ? "حكيمٌ أنضجته السنون، يتّكئ على عصاه ويتأمّل." : "Wise with years; he leans on his staff and reflects.",
            _ => Loc.Rtl ? "شابٌّ خرج يبحث عن الحقيقة، خفيف الزاد قويّ العزم." : "A young seeker on the road, travelling light and resolute.",
        };

        void ShowCharacterSelect(Action then)
        {
            var s = Sheet(900);
            s.Add(ui.Text(Loc.Rtl ? "اختر شخصيتك" : "Choose your character", 34, Ui.Gold, true));
            string picked = string.IsNullOrEmpty(CharacterId) ? "traveler" : CharacterId;
            var cards = Ui.Row(12);
            cards.style.justifyContent = Justify.Center;
            var cardEls = new Dictionary<string, VisualElement>();
            foreach (var id in new[] { "traveler", "steadfast", "elder" })
            {
                var card = Ui.Box(new Color(1f, 0.94f, 0.84f, 0.05f), 18);
                card.style.width = 250; card.style.marginLeft = 6; card.style.marginRight = 6; card.style.marginTop = 10;
                Ui.Border(card, Ui.Edge, 2);
                var img = new Image { image = Resources.Load<Texture2D>("Portraits/" + id), scaleMode = ScaleMode.ScaleAndCrop };
                img.style.height = 220;
                img.style.borderTopLeftRadius = 16; img.style.borderTopRightRadius = 16;
                card.Add(img);
                var info = new VisualElement(); Ui.Pad(info, 10, 14);
                info.Add(ui.Text(CharacterName(id), 24, Ui.Gold, true));
                info.Add(ui.Text(CharacterTag(id), 16, Ui.InkDim, false, 26));
                card.Add(info);
                var cid = id;
                card.RegisterCallback<ClickEvent>(_ =>
                {
                    picked = cid;
                    foreach (var kv in cardEls) Ui.Border(kv.Value, kv.Key == picked ? Ui.Gold : Ui.Edge, 2);
                });
                cardEls[id] = card;
                cards.Add(card);
            }
            foreach (var kv in cardEls) Ui.Border(kv.Value, kv.Key == picked ? Ui.Gold : Ui.Edge, 2);
            s.Add(cards);
            s.Add(ui.Text(Loc.Rtl ? "اسم شخصيتك" : "Your character’s name", 18, Ui.InkDim));
            var nameField = new TextField { value = ProfileName, maxLength = 24 };
            nameField.style.fontSize = 22;
            s.Add(nameField);
            var feedback = ui.Text("", 17, Ui.Danger);
            s.Add(feedback);
            var row = Ui.Row(); row.style.justifyContent = Justify.FlexEnd;
            row.Add(ui.Btn(Loc.T("back"), ShowTitle));
            row.Add(ui.Btn(Loc.Rtl ? "تأكيد" : "Confirm", () =>
            {
                var name = (nameField.value ?? "").Trim();
                // Same rules as the server's display names.
                if (name.Length < 3 || name.Length > 24) { feedback.text = ArabicText.Prepare(Loc.Rtl ? "يجب أن يكون الاسم من ٣ إلى ٢٤ حرفًا." : "The name must be 3 to 24 characters."); return; }
                if (!Regex.IsMatch(name, @"^[\p{L}\p{N} _.\-]+$")) { feedback.text = ArabicText.Prepare(Loc.Rtl ? "استخدم الحروف والأرقام والمسافات فقط." : "Use only letters, numbers and spaces."); return; }
                ProfileName = name; CharacterId = picked; PlayerPrefs.Save();
                then();
            }, true));
            s.Add(row);
        }

        void ShowJournal()
        {
            var s = Sheet();
            s.Add(ui.Text(Loc.T("journal"), 34, Ui.Gold, true));
            int count = 0;
            foreach (var key in journey.State.Collected)
            {
                var parts = key.Split(':');
                var d = catalog.Chapter(parts[0])?.Mission.Discoveries.Find(x => x.Id == parts[1]);
                if (d == null) continue;
                s.Add(ui.Text(Loc.Of(d.Title), 24, Ui.Gold, true, 40));
                s.Add(ui.Text(Loc.Of(d.Body), 19, null, false, 48));
                count++;
            }
            foreach (var key in journey.State.Fragments)
            {
                var parts = key.Split(':');
                var f = catalog.Chapter(parts[0])?.Mission.Collectibles.Find(x => x.Id == parts[1]);
                if (f?.Title == null) continue;
                s.Add(ui.Text(Loc.Of(f.Title), 22, Ui.Gold, true, 40));
                s.Add(ui.Text(Loc.T("certainty_fictional"), 15, Ui.Accent));
                s.Add(ui.Text(Loc.Of(f.Text), 19, null, false, 48));
                count++;
            }
            if (count == 0) s.Add(ui.Text(Loc.Rtl ? "لم تجمع أي روايات بعد." : "No accounts collected yet.", 19, Ui.InkDim));
            s.Add(ui.Btn(Loc.T("back"), () => { if (playing) Resume(); else ShowTitle(); }));
        }

        // ------------------------------------------------------------ session
        void StartMecca()
        {
            Clear();
            if (worldRoot) Destroy(worldRoot);
            pickups.Clear(); npcs.Clear();
            worldRoot = new GameObject("World");
            layout = MeccaBuilder.Build(worldRoot.transform);
            effects = worldRoot.AddComponent<Effects>();

            // Player.
            var look = Look.For(CharacterId);
            var playerGo = new GameObject("Player");
            playerGo.transform.SetParent(worldRoot.transform, false);
            playerGo.transform.position = layout.Spawn;
            playerGo.transform.rotation = Quaternion.Euler(0, 180, 0);
            playerGo.layer = MeshKit.IgnoreRaycastLayer;
            playerGo.AddComponent<CharacterController>();
            var fig = Figure.Create(look, playerGo.transform, Vector3.zero, 0, "figure");
            fig.EquipStaff();
            player = playerGo.AddComponent<PlayerMotor>();
            player.Input = input; player.Cam = follow; player.Figure = fig;
            follow.Target = playerGo.transform; follow.Motor = player; follow.Yaw = 180;
            follow.Snap();

            me = new PlayerCombat(PlayerStats.From(journey.Level("stamina"), journey.Level("defense")));

            // NPCs take designs no player picked: the yard master, the resting traveler, the merchant.
            var free = new[] { "elder", "steadfast", "traveler" }.Where(id => id != CharacterId).ToArray();
            Npc("trainer", Look.For(free[0]), "talk", 140).EquipStaff();
            Npc("traveler", Look.For(free.Length > 1 ? free[1] : "wayfarer"), "sit", -90);
            Npc("merchant", Look.For("townsman"), "idle", -90);

            // Encounters.
            training = new Fight("staff-training");
            gang = new Fight("extortioners", stealth: true);
            training.Event += (t, e, f) => OnCombat(training, t, e, f);
            gang.Event += (t, e, f) => OnCombat(gang, t, e, f);
            foreach (var sp in layout.Enemies)
            {
                bool isTraining = sp.EncounterId == "staff-training";
                var efig = Figure.Create(Look.For(isTraining ? "sparring" : "wayfarer"), worldRoot.transform, sp.Position, sp.YawDeg, "opponent");
                var opts = isTraining
                    ? new EnemyOptions { Health = 4, Damage = 6, Training = true, YawDeg = sp.YawDeg }
                    : new EnemyOptions { Health = 4, Damage = 14, YawDeg = sp.YawDeg, ScanDeg = sp.ScanDeg, VisionRange = 9, VisionFovDeg = 70 };
                (isTraining ? training : gang).Enemies.Add(new Enemy(efig, opts));
            }

            // Puzzle and pickups.
            puzzle = PushPuzzle.Create(worldRoot.transform, layout.Puzzle);
            puzzle.OnSolved += PuzzleSolved;
            foreach (var c in Mission.Collectibles)
                if (layout.Pickups.TryGetValue(c.Id, out var pos))
                    pickups.Add(Pickup.Create(worldRoot.transform, c.Id, c.IsFragment ? "fragment" : c.Item, pos));

            // HUD.
            hud = new Hud(ui, input);
            hud.Hint += ShowHint;
            hud.Menu += ShowMenu;
            hud.PromptTapped += Interact;
            ui.Root.Insert(0, hud.Root);
            input.Attack += Attack;
            input.Dodge += Dodge;
            input.Interact += Interact;

            ApplySavedProgress();
            playing = true;
            RefreshHud();
            ui.Toast(Loc.T("fictionalNote"));
        }

        Figure Npc(string id, Look look, string anim, float yaw)
        {
            var ip = layout.Interactables.Find(i => i.Id == id);
            var f = Figure.Create(look, worldRoot.transform, ip.Position, yaw, id);
            f.SetAnim(anim);
            npcs.Add(f);
            return f;
        }

        void ApplySavedProgress()
        {
            if (Run.Status == "available") Run.Status = "in_progress";
            if (Run.Encounters.ContainsKey("staff-training")) training.Over = true;
            if (Run.Encounters.TryGetValue("extortioners", out var how))
            {
                gang.Over = true;
                foreach (var e in gang.Enemies) { e.HideCone(); e.Figure.gameObject.SetActive(false); }
                layout.OpenGate();
                if (how == "route") layout.OpenSideDoor();
            }
            if (Run.Puzzles.TryGetValue("collapsed-passage", out var p) && p.Solved) { puzzle.MarkSolved(); layout.RaiseBackGate(); }
            foreach (var pk in pickups) if (Run.Collectibles.Contains(pk.Id)) pk.Take();
            foreach (var ip in layout.Interactables)
                if (ip.Kind == InteractKind.Discovery && ip.Marker) ip.Marker.SetActive(!Run.Discoveries.Contains(ip.Id));
        }

        void Resume() { Clear(); playing = true; }

        void EndSession()
        {
            input.Attack -= Attack; input.Dodge -= Dodge; input.Interact -= Interact;
            hud?.Root.RemoveFromHierarchy();
            if (worldRoot) Destroy(worldRoot);
            playing = false;
            ShowTitle();
        }

        // ------------------------------------------------------------ HUD state
        string ObjectiveKey()
        {
            if (Run.Status == "completed") return "obj.done";
            if (!Run.Encounters.ContainsKey("staff-training")) return "obj.training";
            if (!Run.Encounters.ContainsKey("extortioners")) return "obj.obstacle";
            return "obj.discover";
        }

        void RefreshHud()
        {
            if (hud == null) return;
            hud.SetObjective(Loc.T(ObjectiveKey()));
            hud.SetXp(journey.EarnedXp(Chapter));
            hud.SetInventory(journey);
            me.SetStats(PlayerStats.From(journey.Level("stamina"), journey.Level("defense")));
        }

        void ShowAwards(Outcome o)
        {
            foreach (var a in o.Awards)
            {
                if (a.Type == "xp") ui.Toast($"+{a.Amount} {Loc.T("xp")}", Ui.Gold);
                else if (a.Type == "badge") ui.Toast(Loc.Of(catalog.Badge(a.BadgeId)?.Name), Ui.Gold);
                else if (a.Type == "item") ui.Toast($"{Loc.Of(catalog.Item(a.ItemId)?.Name)} +{a.Amount}");
            }
            RefreshHud();
        }

        /// <summary>Runs a journey action, reporting rule errors as a toast.</summary>
        Outcome Act(Func<Outcome> action)
        {
            try { var o = action(); ShowAwards(o); return o; }
            catch (JourneyException e) { ui.Toast(e.Message, Ui.Danger); return null; }
        }

        void ShowHint()
        {
            string key = ObjectiveKey();
            string text = key switch
            {
                "obj.training" => Loc.Rtl ? "معلّم الساحة يقف قرب أعمدة التدريب." : "The yard master stands by the training posts.",
                "obj.obstacle" => Run.Puzzles.TryGetValue("collapsed-passage", out var p) && p.Solved
                    ? (Loc.Rtl ? "من آخر الممرّ المنهار، تسلّل خلف العصابة مستترًا بالصناديق." : "From the end of the collapsed passage, sneak behind the gang using the crates as cover.")
                    : journey.Count("side-gate-key") > 0
                        ? (Loc.Rtl ? "الباب الجانبي في الجدار يسار البوابة." : "The side door is in the wall left of the gate.")
                        : (Loc.Rtl ? "الزقاق الجانبي يمين السوق يقود إلى طرق خلفية. والتاجر قد يساعدك." : "The side alley on the right of the market leads to back streets. The merchant may help you."),
                "obj.discover" => Loc.Rtl ? "اللوح الحجري في صدر الساحة." : "The stone tablet at the far end of the courtyard.",
                _ => Loc.T("obj.done"),
            };
            ui.Toast(text);
        }

        void ShowMenu()
        {
            playing = false;
            ui.Modal(null, null, null, new[] {
                new Ui.Action2 { Id = "journal", Label = Loc.T("journal") },
                new Ui.Action2 { Id = "exit", Label = Loc.T("back") },
                new Ui.Action2 { Id = "close", Label = Loc.T("continue"), Primary = true } },
                id => { if (id == "exit") EndSession(); else if (id == "journal") ShowJournal(); else playing = true; });
        }

        // ------------------------------------------------------------ combat
        IEnumerable<Fight> ActiveFights() => new[] { training, gang }.Where(f => !f.Over);

        void Attack()
        {
            if (!playing || busy || ui.ModalOpen || !me.TryAttack()) return;
            var target = ActiveFights().SelectMany(f => f.Enemies).Where(e => e.Active)
                .OrderBy(e => (e.Position - player.transform.position).sqrMagnitude).FirstOrDefault();
            if (target != null && Vector3.Distance(target.Position, player.transform.position) < 3.2f)
                player.FaceTowards(target.Position - player.transform.position);
            effects.Swing(player.transform.position, player.transform.rotation, me.Combo);
        }

        void Dodge()
        {
            if (!playing || busy || ui.ModalOpen) return;
            var dir = player.InputDirection();
            if (dir.sqrMagnitude < 0.01f) dir = -player.Facing; // no input: hop back
            if (me.TryDodge(dir)) player.FaceTowards(dir);
        }

        void OnCombat(Fight fight, CombatEventType type, Enemy enemy, bool finisher)
        {
            switch (type)
            {
                case CombatEventType.Hit:
                    effects.Burst(enemy.Position, finisher ? new Color(1f, 0.82f, 0.48f) : new Color(1f, 0.95f, 0.84f), finisher ? 0.9f : 0.6f);
                    hitStop = finisher ? 0.09f : 0.05f;
                    if (finisher) follow.Shake(0.15f);
                    break;
                case CombatEventType.Parry:
                    effects.Burst(Vector3.Lerp(player.transform.position, enemy.Position, 0.5f), Ui.Accent, 1f);
                    hitStop = 0.12f;
                    ui.Toast(Loc.T("parry"), Ui.Accent);
                    break;
                case CombatEventType.Blocked: effects.Burst(player.transform.position, Ui.InkDim, 0.4f); break;
                case CombatEventType.Hurt: follow.Shake(0.2f); break;
                case CombatEventType.Detected: ui.Toast(Loc.T("spotted"), Ui.Danger); break;
                case CombatEventType.Overwhelmed: Overwhelmed(fight); break;
                case CombatEventType.Victory:
                    if (fight == training) TrainingDone(); else ResolveGang("fight");
                    break;
            }
        }

        void Overwhelmed(Fight fight)
        {
            busy = true; input.Enabled = false;
            ui.Toast(Loc.T("overwhelmed"), Ui.Danger);
            Invoke(nameof(Retry), 1.2f);
            retryFight = fight;
        }

        Fight retryFight;
        void Retry()
        {
            retryFight.Reset();
            me.Restore();
            if (layout.Checkpoints.TryGetValue(retryFight.Id, out var cp)) player.Teleport(cp);
            input.Enabled = true; busy = false;
        }

        void TrainingDone()
        {
            if (Act(() => journey.ResolveEncounter(ChapterId, "staff-training", "fight")) == null) return;
            // Sparring partners just step back; nobody is hurt in training.
            foreach (var e in training.Enemies) { e.ResetTo(); }
            training.Over = true;
            ui.Say(Loc.T("trainer.name"), Loc.T("trainer.done"));
        }

        void ResolveGang(string method)
        {
            if (Run.Encounters.ContainsKey("extortioners")) return;
            if (Act(() => journey.ResolveEncounter(ChapterId, "extortioners", method)) == null) return;
            gang.Over = true;
            foreach (var e in gang.Enemies) e.HideCone();
            layout.OpenGate();
            ui.Toast(Loc.T(method == "fight" ? "wonFight" : method == "sneak" ? "sneakedPast" : "tookRoute"), Ui.Gold);
            RefreshHud();
        }

        void PuzzleSolved()
        {
            layout.RaiseBackGate();
            ui.Toast(Loc.T("gateRaised"), Ui.Gold);
            Act(() => journey.AttemptPuzzle(ChapterId, "collapsed-passage", new[] { "solved" }));
        }

        // ------------------------------------------------------------ interactions
        void Interact()
        {
            if (!playing || busy || ui.ModalOpen || nearest == null) return;
            switch (nearest.Kind)
            {
                case InteractKind.Trainer: TalkToTrainer(); break;
                case InteractKind.Rest: Rest(); break;
                case InteractKind.Traveler: Traveler(); break;
                case InteractKind.Merchant: Merchant(); break;
                case InteractKind.Lever: puzzle.ResetCrates(); ui.Toast(Loc.T(puzzle.Solved ? "gateRaised" : "leverReset")); break;
                case InteractKind.SideDoor:
                    if (Run.Encounters.ContainsKey("extortioners")) break;
                    if (journey.Count("side-gate-key") == 0) ui.Toast(Loc.T("needKey"));
                    else layout.OpenSideDoor();
                    break;
                case InteractKind.Discovery: Discover(nearest.Id); break;
            }
        }

        void TalkToTrainer()
        {
            if (Run.Encounters.ContainsKey("staff-training")) { ui.Say(Loc.T("trainer.name"), Loc.T("trainer.done")); return; }
            var body = new VisualElement();
            body.Add(ui.Text(Loc.T("trainer.name"), 20, Ui.Gold, true));
            body.Add(ui.Text(Loc.T("trainer.intro"), 20, null, false, 46));
            body.Add(ui.Text(Loc.T("controlsHelp"), 16, Ui.InkDim, false, 56));
            ui.Modal(null, null, body, new[] {
                new Ui.Action2 { Id = "later", Label = Loc.T("close") },
                new Ui.Action2 { Id = "go", Label = Loc.T("trainingStart"), Primary = true } },
                id => { if (id == "go") training.Start(); });
        }

        void Rest()
        {
            me.Restore();
            ui.Toast(Loc.T("restored"));
            var body = new VisualElement();
            body.Add(ui.Text(Loc.T("rest.intro"), 19, null, false, 46));
            foreach (var u in catalog.Upgrades)
            {
                int level = journey.Level(u.Id);
                var row = Ui.Row(8);
                row.style.justifyContent = Justify.SpaceBetween;
                row.style.marginTop = 8;
                var info = new VisualElement();
                info.Add(ui.Text($"{Loc.Of(u.Name)}  {new string('●', level)}{new string('○', u.Costs.Count - level)}", 19, Ui.Gold, true));
                info.Add(ui.Text(Loc.Of(u.Description), 15, Ui.InkDim, false, 34));
                row.Add(info);
                if (level < u.Costs.Count)
                {
                    var cost = u.Costs[level];
                    var label = $"{Loc.T("upgrade")} · " + string.Join(" · ", cost.Select(kv => $"{Loc.Of(catalog.Item(kv.Key)?.Name)} {kv.Value}"));
                    var uid = u.Id;
                    var btn = ui.Btn(label, () => { if (Act(() => journey.BuyUpgrade(uid)) != null) { ui.Toast($"{Loc.T("upgrade")} ✓", Ui.Gold); Rest(); } },
                        cost.All(kv => journey.Count(kv.Key) >= kv.Value), 16);
                    row.Add(btn);
                }
                else row.Add(ui.Text(Loc.T("maxLevel"), 16, Ui.Gold));
                body.Add(row);
            }
            ui.Modal(null, Loc.T("restPoint"), body, null, null);
        }

        void Traveler()
        {
            var task = Mission.Tasks.Find(t => t.Id == "water-delivery");
            Run.Tasks.TryGetValue(task.Id, out var done);
            if (done >= task.Goal) { ui.Say(Loc.T("traveler.name"), Loc.T("traveler.thanks")); return; }
            if (journey.Count("water") == 0) { ui.Say(Loc.T("traveler.name"), Loc.T("traveler.thirsty")); return; }
            var o = Act(() => journey.TaskProgress(ChapterId, task.Id, 1));
            if (o == null) return;
            ui.Toast($"{Loc.Of(catalog.Item("water").Name)} {o.Get<int>("count")}/{o.Get<int>("goal")}");
            if (o.Get<bool>("complete")) ui.Say(Loc.T("traveler.name"), Loc.T("traveler.thanks"));
        }

        void Merchant()
        {
            var task = Mission.Tasks.Find(t => t.Id == "merchant-goods");
            Run.Tasks.TryGetValue(task.Id, out var done);
            if (done >= task.Goal) { ui.Say(Loc.T("merchant.name"), Loc.T("merchant.done")); return; }
            if (journey.Count("merchant-bundle") == 0) { ui.Say(Loc.T("merchant.name"), Loc.T("merchant.ask")); return; }
            if (Act(() => journey.TaskProgress(ChapterId, task.Id, 1)) != null) ui.Say(Loc.T("merchant.name"), Loc.T("merchant.thanks"));
        }

        void Discover(string id)
        {
            var d = Mission.Discoveries.Find(x => x.Id == id);
            if (!Run.Discoveries.Contains(id) && Act(() => journey.FindDiscovery(ChapterId, id)) == null) return;
            var marker = layout.Interactables.Find(i => i.Id == id)?.Marker;
            if (marker) marker.SetActive(false);
            // Historical scenes have their own frame, separate from the fictional adventure.
            var body = new VisualElement();
            var cert = d.Meta?.Certainty ?? "sourced";
            body.Add(ui.Text(Loc.T("certainty_" + cert), 15, cert == "sourced" ? Ui.Sourced : cert == "uncertain" ? Ui.Uncertain : Ui.Accent));
            body.Add(ui.Text(Loc.Of(d.Body), 22, null, false, 42));
            body.Add(ui.Text(Loc.T("sources"), 16, Ui.InkDim, true));
            foreach (var s in d.Sources) body.Add(ui.Text("• " + Loc.Of(s.Citation), 15, Ui.InkDim, false, 60));
            ui.Modal(Loc.T("historicalAccount"), Loc.Of(d.Title), body, new[] { new Ui.Action2 { Id = "ok", Label = Loc.T("continue"), Primary = true } }, _ => JournalChoice(), history: true);
        }

        void JournalChoice()
        {
            var choice = Mission.Choices.Find(c => c.Id == "journal-emphasis");
            if (choice == null || Run.Choices.ContainsKey(choice.Id)) { Complete(); return; }
            ui.Modal(Loc.T("journal"), Loc.Of(choice.Prompt), null,
                choice.Options.Select(o => new Ui.Action2 { Id = o.Id, Label = Loc.Of(o.Label), Primary = true }).ToList(),
                id => { Act(() => journey.MakeChoice(ChapterId, choice.Id, id)); Complete(); });
        }

        void Complete()
        {
            if (Run.Status != "completed" && Act(() => journey.CompleteMission(ChapterId)) == null) return;
            RefreshHud();
            var choice = Mission.Choices.Find(c => c.Id == "journal-emphasis");
            var option = choice?.Options.Find(o => Run.CommittedChoices.TryGetValue(choice.Id, out var v) && v == o.Id);
            Run.Encounters.TryGetValue("extortioners", out var method);
            var body = new VisualElement();
            body.Add(ui.Text($"{journey.EarnedXp(Chapter)} / {journey.MaxXp(Mission)}", 52, Ui.Gold, true, 0, true));
            body.Add(ui.Text(Loc.T("xp") + (method != null ? " · " + Loc.T(method == "fight" ? "wonFight" : method == "sneak" ? "sneakedPast" : "tookRoute") : ""), 18, Ui.InkDim, false, 0, true));
            if (option?.Journal != null) { body.Add(ui.Text(Loc.T("journal"), 20, Ui.Gold, true)); body.Add(ui.Text(Loc.Of(option.Journal), 19, null, false, 44)); }
            ui.Modal(Loc.Of(Chapter.Setting), Loc.T("missionComplete"), body, new[] {
                new Ui.Action2 { Id = "explore", Label = Loc.T("keepExploring") },
                new Ui.Action2 { Id = "next", Label = Loc.T("nextChapter"), Primary = true } },
                id => { if (id == "next") { ui.Toast(Loc.Rtl ? "رحلة غِفار قيد الإنتاج." : "The Ghifar journey is in production.", Ui.Gold); EndSession(); } });
        }

        void Collect(Pickup p)
        {
            var o = Act(() => journey.Collect(ChapterId, p.Id));
            if (o == null) return;
            if (o.Get<bool>("full")) { ui.Toast(Loc.T("fullBag"), Ui.Danger); return; }
            p.Take();
            if (o.Get<bool>("fragment"))
                ui.Toast($"{Loc.T("journal")}: {Loc.Of(Mission.Collectibles.Find(c => c.Id == p.Id)?.Title)}", Ui.Accent);
            else
                ui.Toast($"{Loc.T("collected")}: {Loc.Of(catalog.Item(o.Get<string>("itemId"))?.Name)}");
        }

        string LabelFor(InteractPoint ip) => ip.Kind switch
        {
            InteractKind.Trainer => Loc.T("trainer.name"),
            InteractKind.Rest => Loc.T("restPoint"),
            InteractKind.Traveler => Loc.T("traveler.name"),
            InteractKind.Merchant => Loc.T("merchant.name"),
            InteractKind.Lever => Loc.T("label.lever"),
            InteractKind.SideDoor => Loc.T("label.sideDoor"),
            _ => Loc.Of(Mission.Discoveries.Find(d => d.Id == ip.Id)?.Title),
        };

        // ------------------------------------------------------------ loop
        void Update()
        {
            if (!playing || player == null) return;
            float dt = Time.deltaTime;
            if (hitStop > 0) { hitStop -= dt; dt *= 0.08f; }
            input.Enabled = !busy && !ui.ModalOpen;
            var pos = player.transform.position;

            var offset = me.Tick(dt, input.Block, player.Moving, input.Run);
            player.Push(offset);
            player.SpeedScale = me.Attacking ? 0.25f : me.BlockHeldFor >= 0 ? 0.4f : input.Sneak ? 0.5f : 1;
            player.CanTurn = !me.Attacking;
            player.AnimOverride = me.Dodging ? "dodge" : me.Attacking ? "attack" : me.HurtT > 0 ? "hit" : me.BlockHeldFor >= 0 ? "block" : input.Sneak ? "crouch" : null;
            player.Tick(dt);

            if (me.SwingConnects(dt)) foreach (var f in ActiveFights()) f.PlayerSwing(pos, player.Facing, me);

            if (!training.Over && training.Started) training.Tick(dt, pos, me, input.Sneak);
            bool resolved = Run.Encounters.ContainsKey("extortioners");
            gang.Tick(dt, pos, me, input.Sneak);
            if (!resolved && !gang.Started)
            {
                var flat = new Vector2(pos.x, pos.z);
                if (layout.SneakGoal.Contains(flat)) ResolveGang("sneak");
                else if (layout.RouteGoal.Contains(flat)) ResolveGang("route");
            }
            hud.SetDetection(gang.Started || resolved ? 0 : gang.Enemies.Max(e => e.Detection));
            hud.SetVitals(me);

            puzzle.Tick(dt, pos, player.Moving ? player.Velocity.normalized : Vector3.zero);
            string area = layout.AreaAt(pos);
            foreach (var p in pickups)
            {
                if (p.Collected || Vector3.Distance(p.transform.position, pos) > 1.1f) continue;
                var c = Mission.Collectibles.Find(x => x.Id == p.Id);
                if (c != null && journey.IsAreaOpen(Mission, Run, c.AreaId)) Collect(p);
            }

            bool inFight = ActiveFights().Any(f => f.Started);
            nearest = null;
            float best = float.MaxValue;
            foreach (var ip in layout.Interactables)
            {
                float d = Vector3.Distance(ip.Position, pos);
                bool reachable = ip.AreaId == area || (ip.Kind == InteractKind.SideDoor && area == "market-lane");
                if (d < ip.Radius && d < best && reachable && !inFight) { nearest = ip; best = d; }
            }
            hud.SetPrompt(nearest != null && !ui.ModalOpen ? LabelFor(nearest) : null);

            mapTimer -= Time.deltaTime;
            if (mapTimer <= 0) { mapTimer = 0.15f; DrawMap(pos); }
        }

        void DrawMap(Vector3 pos)
        {
            // Map window in web coordinates: x ∈ [−20, 20], z ∈ [18, −100]; Unity x is mirrored.
            Vector2 ToMap(Vector3 w) => new((-w.x + 20) / 40f * Hud.Width, (18 - w.z) / 118f * Hud.Height);
            var floor = new Color(0.79f, 0.65f, 0.47f, 0.35f);
            Rect R(float x0, float z0, float x1, float z1) => Rect.MinMaxRect(-x1, Mathf.Min(z0, z1), -x0, Mathf.Max(z0, z1));
            var areas = new[] { (R(-9.5f, 16.5f, 9.5f, 2.9f), floor), (R(-3.6f, 2.9f, 3.6f, -58), floor), (R(3.6f, -23.2f, 10.6f, -29.2f), floor),
                (R(10.6f, -6, 16.5f, -56), floor), (R(-10, -47.4f, 16.5f, -58), floor), (R(-17, -61, 17, -99), floor) };
            var dots = new List<(Vector3, Color, int)>();
            bool explore = journey.Level("exploration") > 0;
            foreach (var p in pickups)
                if (!p.Collected && (p.Kind == "fragment" || explore))
                    dots.Add((p.transform.position, p.Kind == "fragment" ? new Color(0.78f, 0.65f, 1f) : new Color(1f, 0.88f, 0.59f), 2));
            foreach (var ip in layout.Interactables)
                if (ip.Kind != InteractKind.Discovery || (ip.Marker && ip.Marker.activeSelf))
                    dots.Add((ip.Position, ip.Kind == InteractKind.Discovery ? Ui.Gold : ip.Kind == InteractKind.Rest ? new Color(1f, 0.7f, 0.28f) : Ui.Accent, 2));
            if (!Run.Encounters.ContainsKey("extortioners"))
                foreach (var e in gang.Enemies) if (e.Active) dots.Add((e.Position, Ui.Danger, 2));
            dots.Add((pos, Ui.Ink, 3));
            hud.DrawMap(ToMap, areas, dots);
        }
    }
}
