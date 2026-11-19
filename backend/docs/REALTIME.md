# Real-time protocol (v1)

Plain WebSocket + JSON, so every engine and platform can connect: Unity (`NativeWebSocket`,
`System.Net.WebSockets`), Godot (`WebSocketPeer`), Unreal (`IWebSocket`), Flutter
(`web_socket_channel`), Swift (`URLSessionWebSocketTask`), Kotlin (OkHttp), and browsers.

**Endpoint:** `wss://<host>/v1/realtime`

## Connecting

1. Get an access token from the REST API (`/v1/auth/guest` or `/v1/auth/google`).
2. Open the socket, authenticating in one of two ways:
   - **Native clients:** send header `Authorization: Bearer <accessToken>`.
   - **Browsers** (can't set headers): send `{"t":"auth","token":"<accessToken>"}` as the
     first frame within 5 seconds.
3. Wait for `welcome` before sending anything else.

A player has one live socket. Connecting again (new device, app restart) closes the old
socket with code `4000`. If the player was in a match, the new socket is put straight back
into it (`room.state` then `game.start` arrive right after `welcome`).

Access tokens expire (15 min by default). They're only checked at connect time, so an open
socket keeps working; refresh the token before reconnecting.

## Flows

**Quick match:** `queue.join` → `queue.joined` → `match.found` → `room.state` →
`game.countdown` → `game.start` → many `game.state` / `game.event` → `game.end`

**Private room (play with friends):** host sends `room.create` → gets `room.state` with a
6-character `code` to share → friends send `room.join` with the code → everyone except the
host sends `room.ready` → host sends `room.start` → countdown and game as above.

**Authoritative solo:** `room.create` with `"mode":"solo"` starts immediately. (For offline
solo, use the REST solo session endpoints instead.)

## Client → server

| `t` | Fields | Notes |
|---|---|---|
| `auth` | `token` | Only as the first frame, when no header was sent |
| `ping` | `ts?` | Echoed in `pong`; use to measure latency |
| `queue.join` | `gameId` | Join the quick-match queue |
| `queue.leave` | | |
| `room.create` | `gameId`, `mode?` (`multiplayer` \| `solo`), `partySize?`, `options?` | `partySize` = number of seats; private rooms start when all are filled |
| `room.join` | `code` | Case-insensitive |
| `room.ready` | `ready` (bool) | Lobby only |
| `room.start` | | Host only; everyone else must be ready |
| `room.leave` | | Quits the room / match |
| `input` | `seq` (int, increasing), `data` | `data` is validated against the game's input schema |
| `chat` | `text` (1–280 chars) | Broadcast to the room |

## Server → client

| `t` | Fields |
|---|---|
| `welcome` | `userId`, `serverTime`, `protocolVersion` |
| `pong` | `ts?`, `serverTime` |
| `error` | `code`, `message` |
| `queue.joined` / `queue.left` | `gameId`, `position` |
| `match.found` | `roomId`, `gameId` |
| `room.state` | `room` (id, code, phase, players with displayName, characterId, ready, connected, isHost) |
| `room.left` | `roomId`, `reason` |
| `game.countdown` | `startsAt` (epoch ms), `durationMs` |
| `game.start` | `tickRate`, `serverTime` |
| `game.state` | `tick`, `serverTime`, `ackSeq`, `state` (game-specific snapshot) |
| `game.event` | `tick`, `event` (game-specific, e.g. `orb.collected`) |
| `game.end` | `matchId`, `results[]` (userId, displayName, score, placement, xp) |
| `chat` | `from`, `displayName`, `text`, `serverTime` |

`ackSeq` is the last input `seq` the server applied for you. For smooth movement, apply inputs
locally right away (prediction), then re-apply any inputs newer than `ackSeq` on top of each
server snapshot (reconciliation). Interpolate other players between the last two snapshots.

## ATHAR co-op (`gameId: "athar-journey"`)

Create: `{"t":"room.create","gameId":"athar-journey","partySize":3,"options":{"chapterId":"mecca"}}`.
`partySize` is 1, 2 or 3; with 1 the run starts immediately. `room.start` fails with
`chapter_locked` (naming the players) if the chapter isn't unlocked for everyone.

Inputs (`input.data`):

```jsonc
// your character's position, ~10 times a second while moving
{ "kind": "move", "areaId": "hospitality-lane", "x": 320, "y": 180, "facing": "right", "anim": "walk" }
// a journey action (same as the REST journey events, without chapterId)
{ "kind": "action", "action": { "type": "discovery.find", "discoveryId": "ali-hospitality" } }
{ "kind": "action", "action": { "type": "puzzle.attempt", "puzzleId": "passage", "answer": ["sun","shelter","water"] } }
{ "kind": "action", "action": { "type": "task.progress", "taskId": "water-delivery", "amount": 1 } }
{ "kind": "action", "action": { "type": "choice.make", "choiceId": "journal-emphasis", "optionId": "courage" } }
{ "kind": "action", "action": { "type": "mission.complete" } }
```

`game.state.state` contains `openAreas`, `discoveries`, `puzzles`, `tasks`, `completed` and
`players` (position, animation, which choices each has made, XP earned this run; only your
own entry includes your actual choices).

`game.event.event` types: `discovery.find`, `puzzle.attempt` (with `result`), `task.progress`,
`choice.made`, `mission.completed`, `journey.awards` (XP and badges credited to `playerId`'s
account), and `action.rejected` (`playerId`, `code`, `message`, `details`, e.g. which
players still need to choose).

## Rules and limits

- The server is authoritative: clients send intent (`input`), never positions or scores.
- 60 messages/second sustained (burst 120). Repeated abuse closes the socket with `4008`.
- Max frame size: 16 KB.
- If a player drops mid-match, they have 20 seconds to reconnect before they're removed.

## Close codes

| Code | Meaning |
|---|---|
| 4000 | Replaced by a newer connection for the same player |
| 4001 | Authentication failed |
| 4002 | No auth frame within 5 seconds |
| 4008 | Rate limited |
| 4010 | Server shutting down; reconnect with backoff |
