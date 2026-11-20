using System;
using UnityEngine;

namespace Athar.Gameplay
{
    /// <summary>
    /// One input source for keyboard, mouse and the on-screen touch controls.
    /// Keyboard: WASD/arrows move, Shift run, J or left click attack, K or right click block (hold),
    /// Space dodge, C sneak (toggle), E interact. Touch controls write into this from the HUD.
    /// </summary>
    public class InputReader : MonoBehaviour
    {
        public Vector2 Move { get; private set; }
        public bool Run { get; private set; }
        public bool Block { get; private set; }
        public bool Sneak { get; set; }
        public bool Enabled = true;

        public event Action Attack, Dodge, Interact, SneakToggled;

        /// <summary>Set by the HUD.</summary>
        public Vector2 Joystick;
        public bool TouchBlock;
        public Func<Vector2, bool> PointerOverUi = _ => false;

        public void FireAttack() { if (Enabled) Attack?.Invoke(); }
        public void FireDodge() { if (Enabled) Dodge?.Invoke(); }
        public void FireInteract() { if (Enabled) Interact?.Invoke(); }
        public void ToggleSneak() { Sneak = !Sneak; SneakToggled?.Invoke(); }

        void Update()
        {
            float x = (Input.GetKey(KeyCode.D) || Input.GetKey(KeyCode.RightArrow) ? 1 : 0) - (Input.GetKey(KeyCode.A) || Input.GetKey(KeyCode.LeftArrow) ? 1 : 0);
            float y = (Input.GetKey(KeyCode.W) || Input.GetKey(KeyCode.UpArrow) ? 1 : 0) - (Input.GetKey(KeyCode.S) || Input.GetKey(KeyCode.DownArrow) ? 1 : 0);
            var move = new Vector2(x, y) + Joystick;
            Move = Enabled ? Vector2.ClampMagnitude(move, 1) : Vector2.zero;
            Run = (Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift) || Joystick.magnitude > 0.92f) && !Sneak;
            bool mouseBlock = Input.GetMouseButton(1) && !PointerOverUi(Input.mousePosition);
            Block = Enabled && (Input.GetKey(KeyCode.K) || TouchBlock || mouseBlock);

            if (!Enabled) return;
            if (Input.GetKeyDown(KeyCode.J)) FireAttack();
            if (Input.GetMouseButtonDown(0) && Input.touchCount == 0 && !PointerOverUi(Input.mousePosition)) FireAttack();
            if (Input.GetKeyDown(KeyCode.Space)) FireDodge();
            if (Input.GetKeyDown(KeyCode.E) || Input.GetKeyDown(KeyCode.Return)) FireInteract();
            if (Input.GetKeyDown(KeyCode.C)) ToggleSneak();
        }
    }
}
