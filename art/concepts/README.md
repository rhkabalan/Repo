# ATHAR character concepts

Concept sheets supplied by the project team (marked "concept design · historical details to
be verified"). Each folder holds the original `sheet.png` plus clean `front`, `side` and
`back` crops (1024×1024), ready as input for multi-view image-to-3D.

| Folder | Design | Palette / signature details | Current casting (`client/src/game/cast.ts`) |
|---|---|---|---|
| `traveler/` | 01 · The Traveler | cream linen robe, brown fringed shawl, leather belt, satchel | Player (Mecca) |
| `steadfast/` | 02 · The Steadfast | blue-gray robe, heavy dark-brown fringed cloak, tan sash, full beard | Resting traveler NPC |
| `elder/` | 03 · The Elder | cream robe, rust fringed shawl, long gray beard, wooden staff | Guide NPC |

## 3D pipeline

1. Multi-view image-to-3D (front + side + back), textured with PBR, auto-rigged as a humanoid.
2. Extra animation clips on the same rig: idle, walk, run (and talk, carry and sit as needed).
3. Save as `client/public/models/<design>.glb` with clips named `idle`, `walk`, `run`, …
4. Uncomment `model:` for that design in `client/src/game/cast.ts`.

Loose cloth (fringes, shawl tails) becomes solid mesh; cloth simulation is a later polish
step.
