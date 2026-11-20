using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using UnityEngine;

namespace Athar.Core
{
    public class PuzzleRecord { public bool Solved; public int Attempts; }

    public class ChapterProgress
    {
        public string Status = "locked"; // locked | available | in_progress | completed
        public List<string> Discoveries = new();
        public Dictionary<string, PuzzleRecord> Puzzles = new();
        public Dictionary<string, string> Choices = new();
        public Dictionary<string, int> Tasks = new();
        public List<string> Collectibles = new();
        public Dictionary<string, string> Encounters = new();
        public Dictionary<string, string> CommittedChoices = new();
        public int TimesCompleted;
        public string CompletedAt;

        public void ResetRun()
        {
            Discoveries.Clear(); Puzzles.Clear(); Choices.Clear(); Tasks.Clear(); Collectibles.Clear(); Encounters.Clear();
        }
    }

    /// <summary>The player's journey. Mirrors the server's JourneyState so saves can sync.</summary>
    public class JourneyState
    {
        public int CatalogVersion;
        public Dictionary<string, ChapterProgress> Chapters = new();
        public List<string> Collected = new();
        public List<string> Badges = new();
        public List<string> Claimed = new();
        public int Xp;
        public Dictionary<string, int> Inventory = new();
        public Dictionary<string, int> Upgrades = new() { { "stamina", 0 }, { "defense", 0 }, { "exploration", 0 }, { "capacity", 0 } };
        public List<string> Fragments = new();
    }

    public class Award
    {
        public string Type; // xp | badge | item | chapter_unlocked
        public int Amount; public string Reason; public string BadgeId; public string ItemId; public string ChapterId;
    }

    public class JourneyException : Exception
    {
        public readonly string Code;
        public JourneyException(string code, string message) : base(message) { Code = code; }
    }

    public class Outcome
    {
        public readonly List<Award> Awards = new();
        public readonly Dictionary<string, object> Result = new();
        public T Get<T>(string key, T fallback = default) => Result.TryGetValue(key, out var v) && v is T t ? t : fallback;
    }

    /// <summary>
    /// The journey rules, a faithful port of the server engine (backend/src/journey/engine.ts):
    /// prerequisites, one-time rewards, capacity, encounters, mechanisms, upgrades, unlocks.
    /// Every method validates before changing anything, then mutates the state and saves.
    /// </summary>
    public class Journey
    {
        public readonly Catalog Catalog;
        public JourneyState State { get; private set; }
        public event Action<Outcome> Changed;
        readonly string savePath;

        public Journey(Catalog catalog, string saveFile = "journey.json")
        {
            Catalog = catalog;
            savePath = Path.Combine(Application.persistentDataPath, saveFile);
            State = LoadOrCreate();
        }

        // ------------------------------------------------------------ persistence
        JourneyState LoadOrCreate()
        {
            try
            {
                if (File.Exists(savePath))
                    return Upgrade(JsonConvert.DeserializeObject<JourneyState>(File.ReadAllText(savePath), Catalog.Json));
            }
            catch (Exception e) { Debug.LogWarning($"ATHAR: could not read save, starting fresh ({e.Message})"); }
            return Fresh();
        }

        void Save()
        {
            try { File.WriteAllText(savePath, JsonConvert.SerializeObject(State, Catalog.Json)); }
            catch (Exception e) { Debug.LogWarning($"ATHAR: could not save ({e.Message})"); }
        }

        public void ResetAll() { State = Fresh(); Save(); Changed?.Invoke(new Outcome()); }

        JourneyState Fresh()
        {
            var s = new JourneyState { CatalogVersion = Catalog.Version };
            foreach (var c in Ordered()) s.Chapters[c.Id] = new ChapterProgress { Status = c.Order == 1 ? "available" : "locked" };
            return s;
        }

        /// <summary>Adds chapters from newer catalogs and opens one inserted after a finished chapter.</summary>
        JourneyState Upgrade(JourneyState s)
        {
            foreach (var c in Catalog.Chapters) if (!s.Chapters.ContainsKey(c.Id)) s.Chapters[c.Id] = new ChapterProgress();
            foreach (var k in new[] { "stamina", "defense", "exploration", "capacity" }) if (!s.Upgrades.ContainsKey(k)) s.Upgrades[k] = 0;
            var ordered = Ordered();
            for (int i = 1; i < ordered.Count; i++)
            {
                var p = s.Chapters[ordered[i].Id];
                if (p.Status == "locked" && s.Chapters[ordered[i - 1].Id].TimesCompleted > 0) p.Status = "available";
            }
            if (ordered.Count > 0 && s.Chapters[ordered[0].Id].Status == "locked") s.Chapters[ordered[0].Id].Status = "available";
            s.CatalogVersion = Catalog.Version;
            return s;
        }

        List<Chapter> Ordered() => Catalog.Chapters.OrderBy(c => c.Order).ToList();

        // ------------------------------------------------------------ queries
        public ChapterProgress Progress(string chapterId) => State.Chapters[chapterId];
        public int Count(string itemId) => State.Inventory.TryGetValue(itemId, out var n) ? n : 0;
        public int Level(string upgradeId) => State.Upgrades.TryGetValue(upgradeId, out var n) ? n : 0;

        public int CapacityFor(string itemId)
        {
            var item = Catalog.Item(itemId);
            return item == null ? 0 : item.BaseCapacity + item.CapacityPerLevel * Level("capacity");
        }

        public bool IsAreaOpen(Mission m, ChapterProgress p, string areaId)
        {
            var a = m.Areas.Find(x => x.Id == areaId);
            if (a == null) return false;
            if (!string.IsNullOrEmpty(a.UnlockedBy) && !(p.Puzzles.TryGetValue(a.UnlockedBy, out var r) && r.Solved)) return false;
            if (!string.IsNullOrEmpty(a.UnlockedByEncounter) && !p.Encounters.ContainsKey(a.UnlockedByEncounter)) return false;
            return true;
        }

        public int MaxXp(Mission m) =>
            m.CompletionXp + m.Discoveries.Sum(d => d.Xp) + m.Puzzles.Sum(p => p.Xp) + m.Tasks.Sum(t => t.Xp) +
            m.Collectibles.Sum(c => c.Xp) + m.Encounters.Sum(e => e.Rewards.Count == 0 ? 0 : e.Rewards.Values.Max(r => r.Xp));

        public int EarnedXp(Chapter c)
        {
            var m = c.Mission;
            bool Has(string k) => State.Claimed.Contains(k);
            return m.Discoveries.Where(d => Has($"discovery:{c.Id}:{d.Id}")).Sum(d => d.Xp)
                + m.Puzzles.Where(p => Has($"puzzle:{c.Id}:{p.Id}")).Sum(p => p.Xp)
                + m.Tasks.Where(t => Has($"task:{c.Id}:{t.Id}")).Sum(t => t.Xp)
                + m.Collectibles.Where(x => Has($"collect:{c.Id}:{x.Id}") || Has($"fragment:{c.Id}:{x.Id}")).Sum(x => x.Xp)
                + m.Encounters.Sum(e =>
                {
                    var paid = e.Rewards.Where(kv => Has($"encounter:{c.Id}:{e.Id}:{kv.Key}")).Select(kv => kv.Value.Xp).ToList();
                    return paid.Count == 0 ? 0 : paid.Max();
                })
                + (Has($"mission:{c.Id}") ? m.CompletionXp : 0);
        }

        // ------------------------------------------------------------ helpers
        (Chapter, ChapterProgress) Open(string chapterId)
        {
            var c = Catalog.Chapter(chapterId) ?? throw new JourneyException("bad_request", $"Unknown chapter {chapterId}");
            var p = State.Chapters[c.Id];
            if (p.Status == "locked") throw new JourneyException("chapter_locked", "Complete the previous chapter first");
            return (c, p);
        }

        static void Start(ChapterProgress p) { if (p.Status == "available") p.Status = "in_progress"; }

        void RequireArea(Mission m, ChapterProgress p, string areaId)
        {
            if (!IsAreaOpen(m, p, areaId)) throw new JourneyException("area_locked", "That area is not open yet");
        }

        bool HasItems(Dictionary<string, int> items) => items == null || items.All(kv => Count(kv.Key) >= kv.Value);

        void TakeItems(Dictionary<string, int> items)
        {
            if (items == null) return;
            foreach (var kv in items) State.Inventory[kv.Key] = Count(kv.Key) - kv.Value;
        }

        int AddItem(string itemId, int amount)
        {
            var have = Count(itemId);
            var added = Math.Max(0, Math.Min(amount, CapacityFor(itemId) - have));
            State.Inventory[itemId] = have + added;
            return added;
        }

        void Claim(Outcome o, string key, int xp, string reason, string badge = null, Dictionary<string, int> items = null)
        {
            if (State.Claimed.Contains(key)) return;
            State.Claimed.Add(key);
            if (items != null)
                foreach (var kv in items)
                {
                    var added = AddItem(kv.Key, kv.Value);
                    if (added > 0) o.Awards.Add(new Award { Type = "item", ItemId = kv.Key, Amount = added });
                }
            if (xp > 0) { State.Xp += xp; o.Awards.Add(new Award { Type = "xp", Amount = xp, Reason = reason }); }
            if (!string.IsNullOrEmpty(badge) && !State.Badges.Contains(badge))
            {
                State.Badges.Add(badge);
                o.Awards.Add(new Award { Type = "badge", BadgeId = badge });
            }
        }

        Outcome Done(Outcome o) { Save(); Changed?.Invoke(o); return o; }

        // ------------------------------------------------------------ actions
        public Outcome Collect(string chapterId, string collectibleId)
        {
            var (c, p) = Open(chapterId);
            var m = c.Mission;
            var x = m.Collectibles.Find(k => k.Id == collectibleId) ?? throw new JourneyException("bad_request", $"Unknown collectible {collectibleId}");
            RequireArea(m, p, x.AreaId);
            var o = new Outcome();
            Start(p);
            if (p.Collectibles.Contains(x.Id)) { o.Result["alreadyCollected"] = true; return o; }
            if (x.IsFragment)
            {
                p.Collectibles.Add(x.Id);
                var key = $"{c.Id}:{x.Id}";
                if (!State.Fragments.Contains(key)) State.Fragments.Add(key);
                Claim(o, $"fragment:{key}", x.Xp, "fragment");
                o.Result["fragment"] = true;
                return Done(o);
            }
            var added = AddItem(x.Item, x.Amount);
            if (added == 0) { o.Result["full"] = true; o.Result["capacity"] = CapacityFor(x.Item); return o; }
            p.Collectibles.Add(x.Id);
            Claim(o, $"collect:{c.Id}:{x.Id}", x.Xp, "collect");
            o.Result["itemId"] = x.Item;
            o.Result["added"] = added;
            return Done(o);
        }

        public Outcome ResolveEncounter(string chapterId, string encounterId, string method)
        {
            var (c, p) = Open(chapterId);
            var m = c.Mission;
            var e = m.Encounters.Find(k => k.Id == encounterId) ?? throw new JourneyException("bad_request", $"Unknown encounter {encounterId}");
            if (!e.Methods.Contains(method)) throw new JourneyException("bad_request", $"{method} is not a way through here");
            RequireArea(m, p, e.AreaId);
            var o = new Outcome();
            Start(p);
            if (p.Encounters.ContainsKey(e.Id)) { o.Result["alreadyResolved"] = true; return o; }
            e.Requires.TryGetValue(method, out var needs);
            if (!HasItems(needs)) throw new JourneyException("missing_items", "You need something to go this way");
            p.Encounters[e.Id] = method;
            e.Rewards.TryGetValue(method, out var reward);
            Claim(o, $"encounter:{c.Id}:{e.Id}:{method}", reward?.Xp ?? 0, $"encounter_{method}", null, reward?.Items);
            o.Result["method"] = method;
            return Done(o);
        }

        public Outcome FindDiscovery(string chapterId, string discoveryId)
        {
            var (c, p) = Open(chapterId);
            var d = c.Mission.Discoveries.Find(k => k.Id == discoveryId) ?? throw new JourneyException("bad_request", $"Unknown discovery {discoveryId}");
            RequireArea(c.Mission, p, d.AreaId);
            var o = new Outcome();
            Start(p);
            if (!p.Discoveries.Contains(d.Id)) p.Discoveries.Add(d.Id);
            var key = $"{c.Id}:{d.Id}";
            if (!State.Collected.Contains(key)) State.Collected.Add(key);
            Claim(o, $"discovery:{key}", d.Xp, "discovery", d.Badge);
            return Done(o);
        }

        public Outcome AttemptPuzzle(string chapterId, string puzzleId, IList<string> answer)
        {
            var (c, p) = Open(chapterId);
            var z = c.Mission.Puzzles.Find(k => k.Id == puzzleId) ?? throw new JourneyException("bad_request", $"Unknown puzzle {puzzleId}");
            RequireArea(c.Mission, p, z.AreaId);
            if (z.RequiresDiscoveries.Any(d => !p.Discoveries.Contains(d))) throw new JourneyException("prerequisites_missing", "Find the related accounts first");
            var o = new Outcome();
            if (!p.Puzzles.TryGetValue(z.Id, out var rec)) p.Puzzles[z.Id] = rec = new PuzzleRecord();
            if (rec.Solved) { o.Result["correct"] = true; return o; }
            Start(p);
            rec.Attempts++;
            var correct = z.Kind == "mechanism"
                ? answer.Count == 1 && answer[0] == "solved"
                : answer.SequenceEqual(z.Solution);
            o.Result["correct"] = correct;
            if (correct)
            {
                rec.Solved = true;
                Claim(o, $"puzzle:{c.Id}:{z.Id}", z.Xp, "puzzle");
            }
            return Done(o);
        }

        public Outcome MakeChoice(string chapterId, string choiceId, string optionId)
        {
            var (c, p) = Open(chapterId);
            var ch = c.Mission.Choices.Find(k => k.Id == choiceId) ?? throw new JourneyException("bad_request", $"Unknown choice {choiceId}");
            if (ch.Options.All(op => op.Id != optionId)) throw new JourneyException("bad_request", $"Unknown option {optionId}");
            if (!string.IsNullOrEmpty(ch.RequiresPuzzle) && !(p.Puzzles.TryGetValue(ch.RequiresPuzzle, out var r) && r.Solved))
                throw new JourneyException("prerequisites_missing", "Solve the puzzle first");
            if (p.Status == "completed") throw new JourneyException("chapter_completed", "Replay the chapter to choose differently");
            Start(p);
            p.Choices[ch.Id] = optionId;
            return Done(new Outcome());
        }

        public Outcome TaskProgress(string chapterId, string taskId, int amount)
        {
            var (c, p) = Open(chapterId);
            var t = c.Mission.Tasks.Find(k => k.Id == taskId) ?? throw new JourneyException("bad_request", $"Unknown task {taskId}");
            var o = new Outcome();
            Start(p);
            p.Tasks.TryGetValue(t.Id, out var before);
            var step = Math.Min(amount, t.Goal - before);
            if (step <= 0) { o.Result["count"] = before; o.Result["goal"] = t.Goal; o.Result["complete"] = true; return o; }
            var cost = t.Consumes?.ToDictionary(kv => kv.Key, kv => kv.Value * step);
            if (!HasItems(cost)) throw new JourneyException("missing_items", "You do not have what is needed");
            TakeItems(cost);
            var count = before + step;
            p.Tasks[t.Id] = count;
            if (count >= t.Goal) Claim(o, $"task:{c.Id}:{t.Id}", t.Xp, "optional_task", t.Badge, t.Rewards);
            o.Result["count"] = count; o.Result["goal"] = t.Goal; o.Result["complete"] = count >= t.Goal;
            return Done(o);
        }

        public Outcome CompleteMission(string chapterId)
        {
            var (c, p) = Open(chapterId);
            var m = c.Mission;
            if (p.Status == "completed") throw new JourneyException("chapter_completed", "Already complete");
            var missing = m.CompletionRequiresPuzzles.Where(id => !(p.Puzzles.TryGetValue(id, out var r) && r.Solved))
                .Concat(m.Choices.Where(ch => ch.RequiredForCompletion && !p.Choices.ContainsKey(ch.Id)).Select(ch => ch.Id))
                .Concat(m.Encounters.Where(e => e.RequiredForCompletion && !p.Encounters.ContainsKey(e.Id)).Select(e => e.Id))
                .Concat(m.CompletionRequiresDiscoveries.Where(d => !p.Discoveries.Contains(d)))
                .ToList();
            if (missing.Count > 0) throw new JourneyException("prerequisites_missing", "Not finished yet: " + string.Join(", ", missing));
            var o = new Outcome();
            p.Status = "completed";
            p.CompletedAt = DateTime.UtcNow.ToString("o");
            p.TimesCompleted++;
            p.CommittedChoices = new Dictionary<string, string>(p.Choices);
            Claim(o, $"mission:{c.Id}", m.CompletionXp, "mission_complete", m.CompletionBadge);
            var next = Ordered().FirstOrDefault(x => x.Order > c.Order);
            if (next != null && State.Chapters[next.Id].Status == "locked")
            {
                State.Chapters[next.Id].Status = "available";
                o.Awards.Add(new Award { Type = "chapter_unlocked", ChapterId = next.Id });
            }
            return Done(o);
        }

        public Outcome Replay(string chapterId)
        {
            var (_, p) = Open(chapterId);
            if (p.Status != "completed") throw new JourneyException("not_completed", "Only completed chapters can be replayed");
            p.ResetRun();
            p.Status = "in_progress";
            return Done(new Outcome());
        }

        public Outcome BuyUpgrade(string upgradeId)
        {
            var u = Catalog.Upgrades.Find(k => k.Id == upgradeId) ?? throw new JourneyException("bad_request", $"Unknown upgrade {upgradeId}");
            var level = Level(upgradeId);
            if (level >= u.Costs.Count) throw new JourneyException("max_level", "Already at the highest level");
            var cost = u.Costs[level];
            if (!HasItems(cost)) throw new JourneyException("missing_items", "Not enough materials");
            TakeItems(cost);
            State.Upgrades[upgradeId] = level + 1;
            var o = new Outcome();
            o.Result["level"] = level + 1;
            return Done(o);
        }
    }
}
