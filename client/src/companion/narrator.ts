/**
 * The narrator: plays a recorded line in the chosen voice language and shows it as a subtitle.
 * Voice can be Arabic, English or off; subtitles follow the interface language. When the voice
 * is off (or audio can't play) the subtitle stays up for a reading time instead.
 */
import { narration, type L, type NarrationLine } from '../../../backend/src/journey/content/companion';

export type Voice = 'ar' | 'en' | 'off';

export class Narrator {
  voice: Voice;
  private audio = new Audio();
  private box: HTMLElement;
  private text: HTMLElement;
  private badge: HTMLElement;
  private sources: HTMLElement;
  private skipResolve: (() => void) | null = null;
  private token = 0;

  constructor(
    host: HTMLElement,
    private readonly lang: () => 'ar' | 'en',
    voice: Voice,
  ) {
    this.voice = voice;
    this.audio.preload = 'auto';
    this.box = document.createElement('div');
    this.box.className = 'narration';
    this.box.hidden = true;
    this.box.innerHTML = `<div class="narration-badge"></div><p class="narration-text"></p><div class="narration-foot"><small class="narration-sources"></small><button class="narration-skip" type="button"></button></div>`;
    host.appendChild(this.box);
    this.text = this.box.querySelector('.narration-text')!;
    this.badge = this.box.querySelector('.narration-badge')!;
    this.sources = this.box.querySelector('.narration-sources')!;
    const skip = this.box.querySelector<HTMLButtonElement>('.narration-skip')!;
    skip.addEventListener('click', () => this.skip());
    addEventListener('keydown', (e) => {
      if (!this.box.hidden && (e.code === 'Escape' || e.code === 'KeyN')) this.skip();
    });
  }

  private url(id: string, voice: 'ar' | 'en') {
    return `${import.meta.env.BASE_URL}companion/voice/${id}.${voice}.mp3`;
  }

  /** Warm the cache for the next lines so playback starts at once. */
  preload(ids: string[]) {
    if (this.voice === 'off') return;
    for (const id of ids) {
      const a = new Audio();
      a.preload = 'auto';
      a.src = this.url(id, this.voice);
    }
  }

  skip() {
    this.audio.pause();
    this.skipResolve?.();
  }

  get speaking() {
    return !this.box.hidden;
  }

  /** Narrate the given lines in order; resolves when they are done or skipped. */
  async say(...ids: string[]): Promise<void> {
    for (const id of ids) {
      const line = narration.find((n) => n.id === id);
      if (line) await this.one(line);
    }
  }

  private one(line: NarrationLine): Promise<void> {
    const my = ++this.token;
    const lang = this.lang();
    const tr = (v: L) => v[lang];
    this.box.hidden = false;
    this.box.classList.toggle('fiction', !line.sourced);
    this.badge.textContent = line.sourced ? (lang === 'ar' ? 'روايةٌ من المصادر' : 'From the sources') : lang === 'ar' ? 'الراوي' : 'Narrator';
    this.text.textContent = tr(line.text);
    this.sources.textContent = line.sources.map(tr).join(' · ');
    (this.box.querySelector('.narration-skip') as HTMLElement).textContent = lang === 'ar' ? 'تخطٍّ ⏭' : 'Skip ⏭';
    this.box.classList.remove('in');
    void this.box.offsetWidth;
    this.box.classList.add('in');

    return new Promise<void>((resolve) => {
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        this.skipResolve = null;
        if (my === this.token) this.box.hidden = true;
        resolve();
      };
      this.skipResolve = done;
      const readTime = () => setTimeout(done, Math.max(3500, tr(line.text).length * 65));
      if (this.voice === 'off') return void readTime();
      this.audio.src = this.url(line.id, this.voice);
      this.audio.onended = () => setTimeout(done, 450);
      this.audio.onerror = () => readTime();
      this.audio.play().catch(() => readTime());
    });
  }
}
