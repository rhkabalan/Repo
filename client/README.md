# ATHAR Client

The 3D game client for ATHAR. One TypeScript + Three.js codebase runs in any modern
browser and gets packaged as iOS and Android apps (and desktop later). It talks to the
backend in `../backend`.

## Run it

```bash
# 1. start the backend (see backend/README.md); it listens on :8080
# 2. start the client
cd client
npm install
npm run dev          # http://localhost:5173 (proxies /v1 to the backend)
npm run build        # production build in dist/
```

To point a build at a deployed API, set `VITE_API_URL=https://api.example.com`.

## What's in it

- **3D world:** Mecca's Hospitality Lane, the passage gate and the Meeting Courtyard, with
  physically based lighting, a low golden-hour sun, soft shadows, sky-based ambient light,
  filmic tone mapping, subtle bloom, distance haze and drifting dust. Quality scales
  automatically for phones.
- **Characters:** procedural stand-ins (robe, cloak, turban, beard) with idle, walk, run,
  talk, carry and sit animations. Each character loads a rigged GLB the moment one exists
  (`new Character(look, modelUrl)`) and plays its `idle` / `walk` / `run` clips instead.
- **Controls:** WASD or arrows plus Shift to run and E to interact; on touch, a joystick, a
  Run toggle and an Interact button; tap the ground to walk there. The camera follows and
  pulls in when a wall is in the way.
- **The full Mecca mission:** the guide's choice (route board or spoken riddle); both
  accounts, with a certainty label and their sources; the passage puzzle with feedback; the
  water task (running spills the water); the story-order puzzle; the journal choice; and the
  completion screen with the score.
- **1, 2 or 3 players:** "Play with friends" lets you pick 1, 2 or 3 players, create a room
  and share its code, or join with a code. Party members see each other move in real time
  and share world progress, while each makes their own choices.
- **Arabic and English:** right-to-left layout for Arabic, with Amiri and Noto Kufi Arabic
  fonts. All game content comes from the server in the chosen language.
- **Screens:** home (over a cinematic view of the lane), chapter map, achievements and
  journal.

## Layout

```
src/
  main.ts            boot, screens, party lobby, session lifecycle
  i18n.ts            UI strings (ar/en), RTL switching
  content.ts         types for the server's content catalog
  net/api.ts         REST client with token refresh
  net/realtime.ts    WebSocket client (auto-reconnect)
  net/driver.ts      SoloDriver (REST) and PartyDriver (real-time), same interface
  game/world.ts      renderer, sky, lights, post-processing
  game/textures.ts   procedural plaster/stone/sand/cloth/wood textures
  game/mecca.ts      Mecca environment, colliders, interaction points
  game/character.ts  characters (procedural stand-in or rigged GLB)
  game/controls.ts   keyboard, touch joystick, tap-to-walk
  game/player.ts     movement, collisions, follow camera
  game/session.ts    the Mecca mission: interactions, HUD, objectives, minimap
  ui/ui.ts           panels, puzzles, toasts
```

## Next steps

- Replace the stand-ins with the generated 3D characters and props (Higgsfield, once
  credits are added).
- Package as apps with Capacitor (`npx cap add ios android`).
- Build the other four chapters in 3D once their content is ported.
- The Kaaba is deliberately not modelled yet; it needs a dedicated, reviewed design.
