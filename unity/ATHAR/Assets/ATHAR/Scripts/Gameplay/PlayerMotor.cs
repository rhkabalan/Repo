using Athar.World;
using UnityEngine;

namespace Athar.Gameplay
{
    /// <summary>Moves the player relative to the camera, with collisions and gravity.</summary>
    [RequireComponent(typeof(CharacterController))]
    public class PlayerMotor : MonoBehaviour
    {
        public const float Walk = 2.6f, RunSpeed = 5.6f;
        public InputReader Input;
        public FollowCamera Cam;
        public Figure Figure;
        public float SpeedScale = 1;
        public bool CanTurn = true;
        /// <summary>When set, drives the figure's animation (combat states).</summary>
        public string AnimOverride;
        public Vector3 Velocity { get; private set; }
        public bool Moving => Velocity.sqrMagnitude > 0.05f;
        CharacterController cc;
        float fall;

        void Awake()
        {
            cc = GetComponent<CharacterController>();
            cc.radius = 0.4f; cc.height = 1.8f; cc.center = new Vector3(0, 0.9f, 0); cc.stepOffset = 0.3f; cc.slopeLimit = 50;
        }

        /// <summary>Camera-relative input direction on the ground plane (zero when idle).</summary>
        public Vector3 InputDirection()
        {
            var m = Input.Move;
            if (m.sqrMagnitude < 0.01f) return Vector3.zero;
            var fwd = Cam ? Cam.Forward : Vector3.forward;
            var right = new Vector3(fwd.z, 0, -fwd.x);
            return (fwd * m.y + right * m.x).normalized * Mathf.Min(1, m.magnitude);
        }

        public Vector3 Facing => transform.forward;

        public void FaceTowards(Vector3 dir)
        {
            dir.y = 0;
            if (dir.sqrMagnitude > 1e-4f) transform.rotation = Quaternion.LookRotation(dir);
        }

        /// <summary>Move by an offset (dodge roll, knockback) with collisions.</summary>
        public void Push(Vector3 offset) { if (offset.sqrMagnitude > 0) cc.Move(offset); }

        public void Teleport(Vector3 pos)
        {
            cc.enabled = false;
            transform.position = pos;
            cc.enabled = true;
            if (Cam) Cam.Snap();
        }

        public void Tick(float dt)
        {
            var dir = InputDirection();
            float speed = (Input.Run ? RunSpeed : Walk) * SpeedScale;
            Velocity = Vector3.Lerp(Velocity, dir * speed, Mathf.Clamp01(dt * 10));
            fall = cc.isGrounded ? -1f : fall - 9.8f * dt;
            cc.Move((Velocity + Vector3.up * fall) * dt);

            if (Moving && CanTurn)
            {
                var target = Quaternion.LookRotation(new Vector3(Velocity.x, 0, Velocity.z));
                transform.rotation = Quaternion.Slerp(transform.rotation, target, Mathf.Clamp01(dt * 12));
            }
            if (Figure)
                Figure.SetAnim(!string.IsNullOrEmpty(AnimOverride) ? AnimOverride : Moving ? (Input.Run ? "run" : "walk") : "idle");
        }
    }
}
