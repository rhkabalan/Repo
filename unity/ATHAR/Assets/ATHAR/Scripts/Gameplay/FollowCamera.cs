using Athar.World;
using UnityEngine;

namespace Athar.Gameplay
{
    /// <summary>
    /// Third-person follow camera. Swings gently behind the direction of travel, pulls in when
    /// a wall is in the way, and supports a short shake for impacts.
    /// </summary>
    public class FollowCamera : MonoBehaviour
    {
        public Transform Target;
        public PlayerMotor Motor;
        public float Distance = 7.5f;
        public float Yaw = 180; // degrees; 180 = behind a player facing -Z
        float shake;
        Vector3 smoothPos, lookAt;
        const int WorldMask = ~(1 << MeshKit.IgnoreRaycastLayer);

        /// <summary>Forward direction on the ground (away from the camera).</summary>
        public Vector3 Forward => Quaternion.Euler(0, Yaw, 0) * Vector3.forward;

        public void Shake(float amount) => shake = Mathf.Max(shake, amount);

        Vector3 Desired()
        {
            var pivot = Target.position + Vector3.up * 1.4f;
            var back = -Forward;
            float dist = Distance;
            if (Physics.SphereCast(pivot, 0.3f, back + Vector3.up * 0.35f, out var hit, Distance, WorldMask, QueryTriggerInteraction.Ignore))
                dist = Mathf.Max(1.6f, hit.distance - 0.2f);
            float height = 1.6f + dist / Distance * 2.6f;
            return Target.position + back * dist + Vector3.up * height;
        }

        public void Snap()
        {
            if (!Target) return;
            smoothPos = Desired();
            lookAt = Target.position + Vector3.up * 1.4f;
            transform.position = smoothPos;
            transform.LookAt(lookAt);
        }

        void LateUpdate()
        {
            if (!Target) return;
            float dt = Time.deltaTime;
            if (Motor && Motor.Moving && Motor.Input.Move.y > 0.3f)
            {
                var v = Motor.Velocity;
                float behind = Mathf.Atan2(v.x, v.z) * Mathf.Rad2Deg;
                Yaw = Mathf.LerpAngle(Yaw, behind, Mathf.Clamp01(dt * 1.2f));
            }
            smoothPos = Vector3.Lerp(smoothPos, Desired(), Mathf.Clamp01(dt * 5));
            lookAt = Vector3.Lerp(lookAt, Target.position + Vector3.up * 1.4f, Mathf.Clamp01(dt * 8));
            var pos = smoothPos;
            if (shake > 0)
            {
                shake -= dt;
                pos += Random.insideUnitSphere * shake * 0.5f;
            }
            transform.position = pos;
            transform.LookAt(lookAt);
        }
    }
}
