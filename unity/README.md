# ATHAR — Unity client

The 3D game client, built in Unity 6 with URP. It plays the Mecca chapter as a
single-player adventure: the player is a fictional traveler following the journey of
Abu Dharr al-Ghifari, and his sourced history appears only in separate historical scenes.

The rules, content and saves match the backend (`backend/src/journey`), so multiplayer
and cloud saves can be connected later without changing the game data.

## Open the project

1. Install **Unity Hub**, then **Unity 6000.0.40f1** (any Unity 6 LTS release works;
   Hub offers to upgrade). Add the **WebGL** and/or **Android** build modules if you
   want those builds.
2. In Hub: **Add → Add project from disk →** `unity/ATHAR`.
3. The first open imports packages (a few minutes), then runs **ATHAR → Set Up Project**
   by itself. It creates the URP pipeline, the material templates, the UI theme, the
   `Mecca` scene and the player settings. You can run it again from the menu at any time.
4. Open `Assets/ATHAR/Scenes/Mecca.unity` and press **Play**.

## Controls

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Move | WASD / arrows | left stick |
| Camera | follows behind you automatically | same |
| Run | Shift | push the stick to the edge |
| Sneak (toggle) | C | sneak button |
| Staff attack (combo) | left click / J | attack button |
| Block (tap just before a hit to parry) | right click hold / K | block button |
| Dodge | Space | dodge button |
| Interact | E / Enter | prompt button |

## Builds

From the editor: **ATHAR → Build → WebGL / Android / Windows** (output in `Build/`).

From the command line:

```
Unity -batchmode -quit -projectPath unity/ATHAR -buildTarget WebGL \
      -executeMethod Athar.EditorTools.AtharBuild.Build -customBuildPath build/WebGL
```

CI: `.github/workflows/unity.yml` builds WebGL, Android and Windows with GameCI.
It needs repository secrets `UNITY_LICENSE`, `UNITY_EMAIL` and `UNITY_PASSWORD`
(see https://game-ci.com/docs/github/activation). It runs on manual dispatch, or on
every push to `unity/` once the repository variable `UNITY_CI_ENABLED` is `true`.

## Layout

```
Assets/ATHAR/
  Resources/Content/catalog.json   game content, exported from the backend
  Resources/Fonts/                 Amiri (OFL) for Arabic and English
  Resources/Portraits/             character portraits for the select screen
  Scripts/Core/      catalog, journey rules and saves, localisation, Arabic shaping
  Scripts/World/     procedural Mecca district, figures, pickups, the crate puzzle
  Scripts/Gameplay/  input, movement, camera, staff combat and stealth
  Scripts/UI/        UI Toolkit helpers and the HUD
  Scripts/Game/      AtharGame: menus and the Mecca adventure
  Scripts/Rendering/ URP post-processing
  Scripts/Editor/    project setup and build scripts
```

When the content changes in the backend, refresh the Unity copy:

```
cd backend && npm run export:unity
```

## Not done yet

- The Higgsfield 3D character models (`.glb`) still need importing. Add the
  `com.unity.cloud.gltfast` package, drop the files in `Assets/ATHAR/Models/`, and
  `Figure` can use them in place of the built-in figures.
- Multiplayer and Google sign-in through the backend API.
- The chapters after Mecca.
