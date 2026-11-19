import * as THREE from 'three';
import './styles.css';
import type { Catalog } from './content';
import { buildMecca } from './game/mecca';
import { GameSession } from './game/session';
import { World } from './game/world';
import { getLang, initialLang, setLang, t } from './i18n';
import { api } from './net/api';
import { PartyDriver, SoloDriver } from './net/driver';
import { Realtime } from './net/realtime';
import { esc, hideScreen, showScreen, toast } from './ui/ui';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const hud = document.getElementById('hud') as HTMLElement;
const world = new World(canvas);
let catalog: Catalog;
let session: GameSession | null = null;
let realtime: Realtime | null = null;

// ---------------------------------------------------------------- cinematic backdrop
let backdrop: { group: THREE.Group; stop: () => void } | null = null;
function showBackdrop() {
  if (backdrop) return;
  const env = buildMecca();
  world.scene.add(env.group);
  const stop = world.onUpdate((dt, time) => {
    env.update(dt, time);
    const z = -20 - Math.sin(time * 0.05) * 18;
    world.camera.position.set(Math.sin(time * 0.07) * 1.5, 2.2 + Math.sin(time * 0.1) * 0.3, z + 6);
    world.camera.lookAt(0, 2.4, z - 12);
    world.followSun(new THREE.Vector3(0, 0, z));
  });
  backdrop = { group: env.group, stop };
}
function hideBackdrop() {
  if (!backdrop) return;
  backdrop.stop();
  world.scene.remove(backdrop.group);
  backdrop = null;
}

// ---------------------------------------------------------------- data
async function loadCatalog() {
  api.lang = getLang();
  catalog = await api.get<Catalog>('/v1/journey/content');
}

async function ensureSignedIn() {
  if (api.signedIn) {
    try {
      await api.get('/v1/me');
      return;
    } catch {
      /* fall through to a new guest session */
    }
  }
  await api.signInAsGuest();
}

// ---------------------------------------------------------------- screens
function home() {
  showBackdrop();
  const el = showScreen(`
    <div class="home">
      <div class="logo">${getLang() === 'ar' ? 'أثر' : 'ATHAR'}</div>
      <div class="ornament"></div>
      <p class="subtitle">${esc(t('subtitle'))}</p>
      <div class="menu">
        <button class="btn btn-primary" data-go="play">${esc(t('play'))}</button>
        <button class="btn" data-go="party">${esc(t('playTogether'))}</button>
        <button class="btn" data-go="chapters">${esc(t('chapters'))}</button>
        <button class="btn" data-go="achievements">${esc(t('achievements'))}</button>
        <button class="btn" data-go="journal">${esc(t('journal'))}</button>
      </div>
      <div class="lang"><button class="btn" data-go="lang">${esc(t('language'))}</button></div>
    </div>`);
  el.querySelectorAll<HTMLElement>('[data-go]').forEach((b) =>
    b.addEventListener('click', () => {
      const go = b.dataset.go;
      if (go === 'play') void startSolo('mecca');
      if (go === 'party') party();
      if (go === 'chapters') void chapters();
      if (go === 'achievements') void achievements();
      if (go === 'journal') void journal();
      if (go === 'lang') void switchLang();
    }),
  );
}

async function switchLang() {
  setLang(getLang() === 'ar' ? 'en' : 'ar');
  await loadCatalog();
  home();
}

const statusLabel = (s: string) => t(s === 'in_progress' ? 'inProgress' : (s as 'locked' | 'completed' | 'available'));

async function chapters() {
  const journey = await api.get<{ chapters: { chapterId: string; status: string; earnedXp: number; maxXp: number }[] }>('/v1/journey');
  const el = showScreen(`
    <div class="sheet">
      <div class="top"><h2>${esc(t('chapters'))}</h2><button class="btn" data-back>${esc(t('back'))}</button></div>
      <div class="chapter-list">
        ${catalog.chapters
          .map((c) => {
            const p = journey.chapters.find((x) => x.chapterId === c.id)!;
            const playable = p.status !== 'locked';
            return `<button class="chapter" data-chapter="${c.id}" ${playable ? '' : 'disabled'}>
              <div class="num">${c.order}</div>
              <div><div class="name">${esc(c.setting)} — ${esc(c.title)}</div><div class="setting">${p.earnedXp} / ${p.maxXp} ${esc(t('xp'))}</div></div>
              <div class="status">${esc(statusLabel(p.status))}</div>
            </button>`;
          })
          .join('')}
      </div>
    </div>`);
  el.querySelector('[data-back]')!.addEventListener('click', home);
  el.querySelectorAll<HTMLElement>('[data-chapter]').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.chapter!;
      if (id === 'mecca') void startSolo(id);
      else toast(getLang() === 'ar' ? 'هذا الفصل قيد الإنتاج ثلاثي الأبعاد.' : 'This chapter is still in 3D production.');
    }),
  );
}

async function achievements() {
  const j = await api.get<any>('/v1/journey');
  const a = j.achievements;
  const el = showScreen(`
    <div class="sheet">
      <div class="top"><h2>${esc(t('achievements'))}</h2><button class="btn" data-back>${esc(t('back'))}</button></div>
      <div class="stats">
        <div class="stat"><b>${j.xp}</b><span>${esc(t('xp'))}</span></div>
        <div class="stat"><b>${j.level}</b><span>${esc(t('level'))}</span></div>
        <div class="stat"><b>${a.completedChapters}/${a.totalChapters}</b><span>${esc(t('chapters'))}</span></div>
        <div class="stat"><b>${a.discoveredClues}</b><span>${esc(t('clues'))}</span></div>
      </div>
      <h3>${esc(t('badges'))}</h3>
      <div class="tags" style="margin:10px 0 20px">${a.badges.map((b: any) => `<span class="tag" title="${esc(b.description)}">🏅 ${esc(b.name)}</span>`).join('') || '—'}</div>
      <h3>${esc(t('skills'))}</h3>
      <div class="tags" style="margin-top:10px">${a.skills.map((s: any) => `<span class="tag">${esc(s.name)} · ${s.level}</span>`).join('')}</div>
    </div>`);
  el.querySelector('[data-back]')!.addEventListener('click', home);
}

async function journal() {
  const j = await api.get<any>('/v1/journey');
  const entries = [
    ...j.journal.accounts.map((a: any) => `<div class="journal-entry"><h3>${esc(a.title)}</h3><span class="certainty ${a.certainty}">${esc(t(`certainty_${a.certainty}` as 'certainty_sourced'))}</span><p>${esc(a.body)}</p></div>`),
    ...j.journal.reflections.map((r: any) => `<div class="journal-entry"><p><i>${esc(r.text)}</i></p></div>`),
  ];
  const el = showScreen(`
    <div class="sheet">
      <div class="top"><h2>${esc(t('journal'))}</h2><button class="btn" data-back>${esc(t('back'))}</button></div>
      ${entries.join('') || `<p>${getLang() === 'ar' ? 'لم تجمع أي روايات بعد.' : 'No accounts collected yet.'}</p>`}
    </div>`);
  el.querySelector('[data-back]')!.addEventListener('click', home);
}

// ---------------------------------------------------------------- party lobby (1, 2 or 3 players)
function party() {
  let size = 2;
  const el = showScreen(`
    <div class="sheet">
      <div class="top"><h2>${esc(t('playTogether'))}</h2><button class="btn" data-back>${esc(t('back'))}</button></div>
      <div>${esc(t('partySize'))}</div>
      <div class="seg">
        <button class="btn" data-size="1">${esc(t('onePlayer'))}</button>
        <button class="btn active" data-size="2">${esc(t('twoPlayers'))}</button>
        <button class="btn" data-size="3">${esc(t('threePlayers'))}</button>
      </div>
      <div class="row"><button class="btn btn-primary" data-create>${esc(t('createRoom'))}</button></div>
      <div style="margin-top:22px">${esc(t('joinRoom'))}</div>
      <div class="row" style="margin-top:8px"><input class="code-input" maxlength="6" placeholder="ABC123" /><button class="btn" data-join>${esc(t('joinRoom'))}</button></div>
    </div>`);
  el.querySelector('[data-back]')!.addEventListener('click', home);
  el.querySelectorAll<HTMLElement>('[data-size]').forEach((b) =>
    b.addEventListener('click', () => {
      size = Number(b.dataset.size);
      el.querySelectorAll('[data-size]').forEach((x) => x.classList.toggle('active', x === b));
    }),
  );
  el.querySelector('[data-create]')!.addEventListener('click', () => {
    if (size === 1) return void startSolo('mecca');
    void lobby({ create: { partySize: size } });
  });
  el.querySelector('[data-join]')!.addEventListener('click', () => {
    const code = (el.querySelector('.code-input') as HTMLInputElement).value.trim().toUpperCase();
    if (code.length >= 4) void lobby({ join: code });
  });
}

async function lobby(how: { create?: { partySize: number }; join?: string }) {
  realtime?.close();
  realtime = new Realtime(api);
  try {
    await realtime.connect();
  } catch {
    return void toast(t('offline'), 'warn');
  }
  const rt = realtime;
  const names = new Map<string, string>();
  let roomState: any = null;
  const render = () => {
    if (!roomState) return;
    const me = roomState.players.find((p: any) => p.userId === rt.userId);
    const isHost = me?.isHost;
    const el = showScreen(`
      <div class="sheet">
        <div class="top"><h2>${esc(t('playTogether'))}</h2><button class="btn" data-leave>${esc(t('back'))}</button></div>
        <div style="text-align:center">${esc(t('shareCode'))}</div>
        <div class="code">${esc(roomState.code ?? '')}</div>
        <div class="roster">
          ${roomState.players.map((p: any) => `<div><span>${esc(p.displayName)}${p.userId === rt.userId ? ` (${esc(t('you'))})` : ''}</span><span>${p.isHost ? esc(t('host')) : p.ready ? '✓ ' + esc(t('ready')) : '…'}</span></div>`).join('')}
          ${Array.from({ length: roomState.maxPlayers - roomState.players.length }, () => `<div><span>${esc(t('waiting'))}</span><span></span></div>`).join('')}
        </div>
        <div class="row">
          ${isHost ? `<button class="btn btn-primary" data-start>${esc(t('start'))}</button>` : `<button class="btn btn-primary" data-ready>${esc(me?.ready ? '✓ ' + t('ready') : t('ready'))}</button>`}
        </div>
      </div>`);
    el.querySelector('[data-leave]')!.addEventListener('click', () => {
      rt.send({ t: 'room.leave' });
      rt.close();
      party();
    });
    el.querySelector('[data-start]')?.addEventListener('click', () => rt.send({ t: 'room.start' }));
    el.querySelector('[data-ready]')?.addEventListener('click', () => rt.send({ t: 'room.ready', ready: !me?.ready }));
  };
  let started = false;
  rt.on((m) => {
    if (m.t === 'room.state') {
      roomState = m.room;
      for (const p of m.room.players) names.set(p.userId, p.displayName);
      if (!started && m.room.phase === 'lobby') render();
    } else if (m.t === 'error') {
      toast(m.message, 'warn');
    } else if (m.t === 'game.countdown') {
      showScreen(`<div class="loading"><div class="spinner"></div>${esc(t('loading'))}</div>`);
    } else if (m.t === 'game.start' && !started) {
      started = true;
      beginSession(new PartyDriver(rt, 'mecca'), names);
    }
  });
  if (how.create) rt.send({ t: 'room.create', gameId: 'athar-journey', partySize: how.create.partySize, options: { chapterId: 'mecca' } });
  else rt.send({ t: 'room.join', code: how.join });
}

// ---------------------------------------------------------------- sessions
async function startSolo(chapterId: string) {
  showScreen(`<div class="loading"><div class="spinner"></div>${esc(t('loading'))}</div>`);
  const driver = new SoloDriver(chapterId);
  try {
    await driver.init();
  } catch {
    return void toast(t('offline'), 'warn');
  }
  beginSession(driver, new Map());
}

function beginSession(driver: SoloDriver | PartyDriver, names: Map<string, string>) {
  hideBackdrop();
  hideScreen();
  session?.dispose();
  session = new GameSession(world, catalog, driver, hud, names, {
    onExit: () => endSession(),
    onComplete: () => {
      endSession();
      void chapters();
    },
  });
}

function endSession() {
  session?.dispose();
  session = null;
  realtime?.close();
  realtime = null;
  home();
}

// ---------------------------------------------------------------- boot
async function boot() {
  setLang(initialLang());
  world.start();
  if (import.meta.env.DEV && location.search.includes('lineup')) {
    hideScreen();
    (await import('./game/lineup')).showLineup(world);
    return;
  }
  try {
    await ensureSignedIn();
    await loadCatalog();
  } catch {
    showBackdrop();
    showScreen(`<div class="loading">${esc(t('offline'))}<div style="margin-top:16px"><button class="btn" onclick="location.reload()">${esc(t('retry'))}</button></div></div>`);
    return;
  }
  home();
}

void boot();
