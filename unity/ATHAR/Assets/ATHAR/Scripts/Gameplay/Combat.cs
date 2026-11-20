using System;
using System.Collections.Generic;
using System.Linq;
using Athar.World;
using UnityEngine;

namespace Athar.Gameplay
{
    /// <summary>
    /// Staff combat and stealth for the fictional traveler. Non-graphic by design: hits flash
    /// and stagger, opponents never bleed or die. When beaten they kneel, yield and leave; the
    /// player is "overwhelmed" rather than killed and retries from a checkpoint.
    /// </summary>
    public struct PlayerStats
    {
        public float MaxHealth, MaxStamina, Defense;
        public static PlayerStats From(int staminaLevel, int defenseLevel) => new()
        {
            MaxHealth = 100,
            MaxStamina = 100 + 25 * staminaLevel,
            Defense = Mathf.Min(0.45f, 0.15f * defenseLevel),
        };
    }

    public static class Tuning
    {
        public const float AttackDuration = 0.42f, AttackHitAt = 0.16f, AttackRange = 1.9f, AttackArcDeg = 108, AttackStamina = 12, ComboWindow = 0.35f;
        public const float DodgeDuration = 0.38f, DodgeIFrames = 0.3f, DodgeDistance = 3.6f, DodgeStamina = 22;
        public const float ParryWindow = 0.22f, BlockChip = 18;
    }

    public class PlayerCombat
    {
        public float Health, Stamina;
        public PlayerStats Stats;
        public float AttackT = -1, DodgeT = -1, BlockHeldFor = -1, HurtT;
        public int Combo;
        float comboTimer;
        Vector3 dodgeDir;
        readonly HashSet<Enemy> hitThisSwing = new();

        public PlayerCombat(PlayerStats s) { Stats = s; Health = s.MaxHealth; Stamina = s.MaxStamina; }

        public void SetStats(PlayerStats s)
        {
            Health = Mathf.Min(s.MaxHealth, Health + (s.MaxHealth - Stats.MaxHealth));
            Stamina = Mathf.Min(s.MaxStamina, Stamina);
            Stats = s;
        }

        public void Restore() { Health = Stats.MaxHealth; Stamina = Stats.MaxStamina; }
        public bool Attacking => AttackT >= 0;
        public bool Dodging => DodgeT >= 0;
        public bool Invulnerable => DodgeT >= 0 && DodgeT < Tuning.DodgeIFrames;

        public bool TryAttack()
        {
            if (Dodging || Stamina < Tuning.AttackStamina * 0.5f) return false;
            if (Attacking && AttackT < Tuning.AttackDuration - Tuning.ComboWindow) return false;
            Combo = comboTimer > 0 ? Combo % 3 + 1 : 1;
            AttackT = 0;
            Stamina = Mathf.Max(0, Stamina - Tuning.AttackStamina);
            hitThisSwing.Clear();
            return true;
        }

        public bool TryDodge(Vector3 dir)
        {
            if (Dodging || Stamina < Tuning.DodgeStamina) return false;
            DodgeT = 0; AttackT = -1;
            Stamina -= Tuning.DodgeStamina;
            dir.y = 0;
            dodgeDir = dir.normalized;
            return true;
        }

        /// <summary>Advances timers; returns the dodge roll offset for this frame.</summary>
        public Vector3 Tick(float dt, bool blocking, bool moving, bool running)
        {
            var offset = Vector3.zero;
            if (AttackT >= 0) { AttackT += dt; if (AttackT >= Tuning.AttackDuration) { AttackT = -1; comboTimer = Tuning.ComboWindow; } }
            else if (comboTimer > 0) comboTimer -= dt;
            if (DodgeT >= 0)
            {
                float before = DodgeT;
                DodgeT += dt;
                float Ease(float t) => 1 - Mathf.Pow(1 - Mathf.Min(1, t / Tuning.DodgeDuration), 2);
                offset = dodgeDir * ((Ease(DodgeT) - Ease(before)) * Tuning.DodgeDistance);
                if (DodgeT >= Tuning.DodgeDuration) DodgeT = -1;
            }
            BlockHeldFor = blocking && !Dodging && !Attacking ? Mathf.Max(0, BlockHeldFor) + dt : -1;
            if (HurtT > 0) HurtT -= dt;
            bool spending = Attacking || Dodging || BlockHeldFor >= 0 || (moving && running);
            if (!spending) Stamina = Mathf.Min(Stats.MaxStamina, Stamina + dt * 32);
            else if (moving && running) Stamina = Mathf.Max(0, Stamina - dt * 8);
            return offset;
        }

        public bool SwingConnects(float dt) => AttackT >= Tuning.AttackHitAt && AttackT - dt < Tuning.AttackHitAt;
        public bool CanHit(Enemy e) => hitThisSwing.Add(e);
    }

    public enum EnemyState { Idle, Approach, Circle, Windup, Strike, Recover, Stagger, Yield, Gone }

    public class EnemyOptions
    {
        public int Health = 4;
        public float Damage = 14;
        public bool Training;
        public float YawDeg, ScanDeg, ScanSpeed = 0.6f;
        public float VisionRange; // 0 = no stealth vision
        public float VisionFovDeg = 70;
    }

    /// <summary>A fictional opponent: a sparring partner or an extortioner.</summary>
    public class Enemy
    {
        public EnemyState State = EnemyState.Idle;
        public int Health;
        public float Detection;
        public readonly Figure Figure;
        public readonly EnemyOptions Opts;
        public readonly Vector3 Home;
        readonly GameObject telegraph, cone;
        readonly Material telegraphMat;
        float t, scanT, strafe;
        static readonly int WorldMask = ~(1 << MeshKit.IgnoreRaycastLayer);

        public Enemy(Figure figure, EnemyOptions opts)
        {
            Figure = figure; Opts = opts; Health = opts.Health;
            Home = figure.transform.position;
            strafe = UnityEngine.Random.value > 0.5f ? 1 : -1;
            scanT = UnityEngine.Random.value * 10;
            figure.EquipStaff();
            telegraphMat = MaterialKit.Unlit(new Color(1f, 0.42f, 0.24f, 0f), true);
            telegraph = MeshKit.FromMesh(MeshKit.Ring(0.45f, 0.62f), figure.transform, telegraphMat, "telegraph");
            telegraph.transform.localPosition = Vector3.up * 0.05f;
            if (opts.VisionRange > 0)
            {
                cone = MeshKit.FromMesh(MeshKit.Fan(opts.VisionRange, opts.VisionFovDeg), figure.transform, MaterialKit.Unlit(new Color(1f, 0.82f, 0.48f, 0.1f), true), "vision");
                cone.transform.localPosition = Vector3.up * 0.04f;
            }
        }

        public Vector3 Position => Figure.transform.position;
        public bool Active => State != EnemyState.Yield && State != EnemyState.Gone;
        public Vector3 Forward => Figure.transform.forward;
        public void HideCone() { if (cone) cone.SetActive(false); }

        public void Engage()
        {
            if (State != EnemyState.Idle) return;
            State = EnemyState.Approach; t = 0;
            HideCone();
        }

        public void TakeHit(int damage, Vector3 from)
        {
            if (!Active) return;
            Health -= damage;
            var away = Position - from; away.y = 0;
            Figure.transform.position += away.normalized * 0.35f;
            if (Health <= 0) { State = EnemyState.Yield; t = 0; Figure.SetAnim("yield"); telegraph.SetActive(false); return; }
            State = EnemyState.Stagger; t = 0;
            Figure.SetAnim("hit");
        }

        public void Parried() { State = EnemyState.Stagger; t = -0.9f; Figure.SetAnim("hit"); }

        /// <summary>0 when unseen; otherwise how quickly the player is noticed (closer = faster).</summary>
        public float Sees(Vector3 player)
        {
            if (Opts.VisionRange <= 0 || !Active) return 0;
            var to = player - Position; to.y = 0;
            float dist = to.magnitude;
            if (dist > Opts.VisionRange || Vector3.Angle(Forward, to) > Opts.VisionFovDeg / 2) return 0;
            if (Physics.Linecast(Position + Vector3.up * 1.5f, player + Vector3.up * 1.2f, WorldMask, QueryTriggerInteraction.Ignore)) return 0;
            return 1 - dist / Opts.VisionRange;
        }

        void Face(Vector3 dir, float dt, float k = 10)
        {
            dir.y = 0;
            if (dir.sqrMagnitude < 1e-4f) return;
            Figure.transform.rotation = Quaternion.Slerp(Figure.transform.rotation, Quaternion.LookRotation(dir), Mathf.Clamp01(dt * k));
        }

        void Step(Vector3 dir, float speed, float dt)
        {
            dir.y = 0;
            var next = Position + dir.normalized * speed * dt;
            if (!Physics.CheckSphere(next + Vector3.up * 0.9f, 0.35f, WorldMask, QueryTriggerInteraction.Ignore)) Figure.transform.position = next;
        }

        /// <summary>Returns true on the frame a strike lands.</summary>
        public bool Tick(float dt, Vector3 player, bool mayAttack)
        {
            t += dt;
            var to = player - Position; to.y = 0;
            float dist = to.magnitude;
            var c = telegraphMat.color;
            telegraphMat.color = new Color(c.r, c.g, c.b, State == EnemyState.Windup ? 0.5f + 0.4f * Mathf.Sin(t * 30) : 0);
            if (telegraphMat.HasProperty("_BaseColor")) telegraphMat.SetColor("_BaseColor", telegraphMat.color);
            bool struck = false;
            switch (State)
            {
                case EnemyState.Idle:
                    if (Opts.ScanDeg > 0)
                    {
                        scanT += dt * Opts.ScanSpeed;
                        Figure.transform.rotation = Quaternion.Euler(0, Opts.YawDeg + Mathf.Sin(scanT) * Opts.ScanDeg, 0);
                    }
                    Figure.SetAnim("idle");
                    break;
                case EnemyState.Approach:
                    Face(to, dt);
                    if (dist > 2.4f) { Step(to, 2.6f, dt); Figure.SetAnim("walk"); }
                    else { State = EnemyState.Circle; t = 0; }
                    break;
                case EnemyState.Circle:
                    Face(to, dt);
                    var side = Vector3.Cross(Vector3.up, to).normalized * strafe;
                    var keep = dist > 2.8f ? to.normalized : dist < 2.0f ? -to.normalized : Vector3.zero;
                    Step(side + keep, 1.3f, dt);
                    Figure.SetAnim("walk");
                    if (t > 2.5f) { strafe = -strafe; t = 0.61f; }
                    if (mayAttack && t > 0.6f && dist < 3.2f) { State = EnemyState.Windup; t = 0; }
                    break;
                case EnemyState.Windup:
                    Face(to, dt, 6);
                    Figure.SetAnim("block");
                    if (dist > 1.6f) Step(to, 1.8f, dt);
                    if (t > (Opts.Training ? 0.85f : 0.65f)) { State = EnemyState.Strike; t = 0; Figure.SetAnim("attack"); struck = true; }
                    break;
                case EnemyState.Strike:
                    if (t > 0.3f) { State = EnemyState.Recover; t = 0; }
                    break;
                case EnemyState.Recover:
                    Figure.SetAnim("idle");
                    if (t > 0.7f) { State = EnemyState.Circle; t = 0; }
                    break;
                case EnemyState.Stagger:
                    if (t > 0.35f) { State = EnemyState.Circle; t = 0; }
                    break;
                case EnemyState.Yield:
                    if (t > 1.6f)
                    {
                        Figure.SetAnim("walk");
                        var away = Position - player; away.y = 0;
                        Face(away, dt);
                        Step(away, 2.2f, dt);
                        if (t > 4.2f) { State = EnemyState.Gone; Figure.gameObject.SetActive(false); }
                    }
                    break;
            }
            return struck;
        }

        public void ResetTo()
        {
            Health = Opts.Health; Detection = 0; State = EnemyState.Idle; t = 0;
            Figure.gameObject.SetActive(true);
            Figure.transform.SetPositionAndRotation(Home, Quaternion.Euler(0, Opts.YawDeg, 0));
            Figure.SetAnim("idle");
            telegraph.SetActive(true);
            if (cone) cone.SetActive(true);
        }
    }

    public enum CombatEventType { Hit, Parry, Blocked, Hurt, Yielded, Detected, Overwhelmed, Victory }

    /// <summary>One encounter: turn-taking, hits both ways, stealth detection and the outcome.</summary>
    public class Fight
    {
        public readonly string Id;
        public readonly bool Stealth;
        public readonly List<Enemy> Enemies = new();
        public bool Started, Over;
        public event Action<CombatEventType, Enemy, bool> Event; // (type, enemy, finisher)
        Enemy token;
        float tokenCooldown;

        public Fight(string id, bool stealth = false) { Id = id; Stealth = stealth; }

        public void Start()
        {
            if (Started || Over) return;
            Started = true;
            foreach (var e in Enemies) e.Engage();
        }

        public void Tick(float dt, Vector3 player, PlayerCombat me, bool sneaking)
        {
            if (Over) { foreach (var e in Enemies) e.Tick(dt, player, false); return; }
            if (Stealth && !Started)
            {
                foreach (var e in Enemies)
                {
                    float seen = e.Sees(player);
                    float rate = seen > 0 ? (0.6f + seen * 2.2f) * (sneaking ? 0.35f : 1) : -0.5f;
                    e.Detection = Mathf.Clamp01(e.Detection + rate * dt);
                    if (e.Detection >= 1) { Event?.Invoke(CombatEventType.Detected, e, false); Start(); break; }
                }
            }
            tokenCooldown -= dt;
            if (token != null && (!token.Active || token.State == EnemyState.Circle || token.State == EnemyState.Stagger))
            {
                token = null; tokenCooldown = 0.5f;
            }
            if (token == null && tokenCooldown <= 0 && Started)
                token = Enemies.Where(e => e.State == EnemyState.Circle).OrderBy(e => (e.Position - player).sqrMagnitude).FirstOrDefault();
            foreach (var e in Enemies)
                if (e.Tick(dt, player, e == token)) ResolveStrike(e, player, me);
            if (Started && Enemies.All(e => !e.Active)) { Over = true; Event?.Invoke(CombatEventType.Victory, null, false); }
        }

        public void PlayerSwing(Vector3 player, Vector3 facing, PlayerCombat me)
        {
            if (Over) return;
            foreach (var e in Enemies)
            {
                if (!e.Active) continue;
                var to = e.Position - player; to.y = 0;
                if (to.magnitude > Tuning.AttackRange || Vector3.Angle(facing, to) > Tuning.AttackArcDeg / 2) continue;
                if (!me.CanHit(e)) continue;
                if (!Started) Start(); // attacking from hiding starts the fight
                bool finisher = me.Combo == 3;
                e.TakeHit(finisher ? 2 : 1, player);
                Event?.Invoke(CombatEventType.Hit, e, finisher);
                if (!e.Active) Event?.Invoke(CombatEventType.Yielded, e, false);
            }
        }

        void ResolveStrike(Enemy e, Vector3 player, PlayerCombat me)
        {
            var to = player - e.Position; to.y = 0;
            if (to.magnitude > 2.1f || Vector3.Angle(e.Forward, to) > 60) return; // whiffed
            if (me.Invulnerable) return; // dodged through it
            if (me.BlockHeldFor >= 0)
            {
                if (me.BlockHeldFor <= Tuning.ParryWindow) { e.Parried(); Event?.Invoke(CombatEventType.Parry, e, false); }
                else { me.Stamina = Mathf.Max(0, me.Stamina - Tuning.BlockChip); Event?.Invoke(CombatEventType.Blocked, e, false); }
                return;
            }
            me.Health = Mathf.Max(0, me.Health - Mathf.Round(e.Opts.Damage * (1 - me.Stats.Defense)));
            me.HurtT = 0.3f;
            Event?.Invoke(CombatEventType.Hurt, e, false);
            if (me.Health <= 0) Event?.Invoke(CombatEventType.Overwhelmed, e, false);
        }

        public void Reset()
        {
            Started = false; Over = false; token = null;
            foreach (var e in Enemies) e.ResetTo();
        }
    }

    /// <summary>Short-lived visual effects: swing arcs and impact bursts.</summary>
    public class Effects : MonoBehaviour
    {
        readonly List<(GameObject go, Material mat, float life, float max, float grow)> items = new();

        public void Swing(Vector3 at, Quaternion facing, int combo)
        {
            var mat = MaterialKit.Unlit(combo == 3 ? new Color(1f, 0.82f, 0.48f, 0.55f) : new Color(1f, 0.95f, 0.84f, 0.55f), true);
            var go = MeshKit.FromMesh(MeshKit.Ring(0.9f, 1.6f, -Tuning.AttackArcDeg / 2, Tuning.AttackArcDeg, 20), transform, mat, "swing");
            go.transform.SetPositionAndRotation(at + Vector3.up * 1.05f, facing);
            items.Add((go, mat, 0.18f, 0.18f, 0));
        }

        public void Burst(Vector3 at, Color color, float size = 0.6f)
        {
            var mat = MaterialKit.Unlit(new Color(color.r, color.g, color.b, 0.9f), true);
            var go = MeshKit.Prim(PrimitiveType.Sphere, transform, at + Vector3.up * 1.2f, Vector3.one * size, mat, false, "burst");
            items.Add((go, mat, 0.22f, 0.22f, 2.5f));
        }

        void Update()
        {
            for (int i = items.Count - 1; i >= 0; i--)
            {
                var it = items[i];
                it.life -= Time.deltaTime;
                float k = Mathf.Max(0, it.life / it.max);
                var c = it.mat.color; c.a = k * 0.8f;
                it.mat.color = c;
                if (it.mat.HasProperty("_BaseColor")) it.mat.SetColor("_BaseColor", c);
                if (it.grow > 0) it.go.transform.localScale = Vector3.one * (0.6f + (1 - k) * it.grow);
                if (it.life <= 0) { Destroy(it.go); items.RemoveAt(i); }
                else items[i] = it;
            }
        }
    }
}
