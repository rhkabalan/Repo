using System.Collections.Generic;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using UnityEngine;

namespace Athar.Core
{
    /// <summary>
    /// The bilingual content catalog, exported from the server (backend: npm run export:unity)
    /// to Resources/Content/catalog.json so the Unity game and the server share one source of truth.
    /// </summary>
    public class LText
    {
        public string Ar;
        public string En;
        public string Get(Lang lang) => lang == Lang.Ar ? Ar : En;
        public override string ToString() => En;
    }

    public class SourceRef { public string Id; public LText Citation; public string Url; public LText Note; }
    public class Meta { public string Certainty; public string Review; public string EditorNote; }
    public class Skill { public string Id; public LText Name; public LText Description; }
    public class Badge { public string Id; public LText Name; public LText Description; public string Category; }
    public class Item { public string Id; public LText Name; public string Kind; public int BaseCapacity; public int CapacityPerLevel; }
    public class Upgrade { public string Id; public LText Name; public LText Description; public List<Dictionary<string, int>> Costs = new(); }

    public class Area { public string Id; public LText Name; public string UnlockedBy; public string UnlockedByEncounter; public Meta Meta; }

    public class Discovery
    {
        public string Id; public string AreaId; public LText Title; public LText Body;
        public List<SourceRef> Sources = new(); public int Xp; public string Badge; public Meta Meta;
    }

    public class PuzzleOption { public string Id; public LText Label; }

    public class Puzzle
    {
        public string Id; public string Kind; public string AreaId; public LText Prompt;
        public List<PuzzleOption> Options = new(); public List<string> Solution = new();
        public List<string> RequiresDiscoveries = new(); public int Xp; public Meta Meta;
    }

    public class ChoiceOption { public string Id; public LText Label; public LText Journal; public Dictionary<string, int> Skills = new(); }

    public class Choice
    {
        public string Id; public LText Prompt; public List<ChoiceOption> Options = new();
        public bool RequiredForCompletion; public string RequiresPuzzle; public Meta Meta;
    }

    public class OptionalTask
    {
        public string Id; public LText Title; public LText Description; public int Goal; public int Xp; public string Badge;
        public Dictionary<string, int> Consumes = new(); public Dictionary<string, int> Rewards = new(); public Meta Meta;
    }

    public class Collectible
    {
        public string Id; public string AreaId; public string Item; public int Amount;
        public LText Title; public LText Text; public int Xp; public Meta Meta;
        public bool IsFragment => Item == "fragment";
    }

    public class Reward { public int Xp; public Dictionary<string, int> Items = new(); }

    public class Encounter
    {
        public string Id; public string AreaId; public LText Title; public LText Description;
        public List<string> Methods = new();
        public Dictionary<string, Reward> Rewards = new();
        public Dictionary<string, Dictionary<string, int>> Requires = new();
        public bool RequiredForCompletion; public Meta Meta;
    }

    public class Mission
    {
        public string Id; public LText Title; public LText Summary;
        public List<Area> Areas = new(); public List<Discovery> Discoveries = new(); public List<Puzzle> Puzzles = new();
        public List<Choice> Choices = new(); public List<OptionalTask> Tasks = new();
        public List<Collectible> Collectibles = new(); public List<Encounter> Encounters = new();
        public List<string> CompletionRequiresPuzzles = new(); public List<string> CompletionRequiresDiscoveries = new();
        public int CompletionXp; public string CompletionBadge;
    }

    public class Chapter { public string Id; public int Order; public LText Title; public LText Setting; public string Format; public Mission Mission; }

    public class Catalog
    {
        public int Version;
        public List<Chapter> Chapters = new();
        public List<Skill> Skills = new();
        public List<Badge> Badges = new();
        public List<Item> Items = new();
        public List<Upgrade> Upgrades = new();

        public Chapter Chapter(string id) => Chapters.Find(c => c.Id == id);
        public Item Item(string id) => Items.Find(i => i.Id == id);
        public Badge Badge(string id) => Badges.Find(b => b.Id == id);

        /// <summary>camelCase JSON, but dictionary keys (item ids, methods) stay exactly as written.</summary>
        public static readonly JsonSerializerSettings Json = new()
        {
            ContractResolver = new DefaultContractResolver { NamingStrategy = new CamelCaseNamingStrategy { ProcessDictionaryKeys = false } },
            NullValueHandling = NullValueHandling.Ignore,
        };

        public static Catalog Load()
        {
            var asset = Resources.Load<TextAsset>("Content/catalog");
            if (asset == null)
            {
                Debug.LogError("ATHAR: Resources/Content/catalog.json is missing. Run `npm run export:unity` in backend/.");
                return new Catalog();
            }
            return JsonConvert.DeserializeObject<Catalog>(asset.text, Json);
        }
    }
}
