import { t, type StringKey } from '../i18n';

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Re-apply translated labels to every element with data-i18n. */
export function translate(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n as StringKey)));
}

export function showScreen(html: string) {
  const el = $('#screen');
  el.innerHTML = html;
  el.hidden = false;
  translate(el);
  return el;
}

export function hideScreen() {
  const el = $('#screen');
  el.hidden = true;
  el.innerHTML = '';
}

export interface ModalAction {
  id: string;
  label: string;
  primary?: boolean;
}

/** A centred panel; resolves with the id of the action pressed (or 'close'). */
export function modal(opts: { title?: string; eyebrow?: string; body: string; actions?: ModalAction[]; className?: string; onMount?: (el: HTMLElement, done: (id: string) => void) => void }): Promise<string> {
  return new Promise((resolve) => {
    const layer = $('#modal');
    layer.hidden = false;
    layer.innerHTML = `
      <div class="panel ${opts.className ?? ''}" role="dialog" aria-modal="true">
        ${opts.eyebrow ? `<div class="eyebrow">${esc(opts.eyebrow)}</div>` : ''}
        ${opts.title ? `<h2>${esc(opts.title)}</h2>` : ''}
        <div class="panel-body">${opts.body}</div>
        <div class="panel-actions">
          ${(opts.actions ?? [{ id: 'close', label: t('close'), primary: true }])
            .map((a) => `<button class="btn ${a.primary ? 'btn-primary' : ''}" data-action="${a.id}">${esc(a.label)}</button>`)
            .join('')}
        </div>
      </div>`;
    const done = (id: string) => {
      layer.hidden = true;
      layer.innerHTML = '';
      resolve(id);
    };
    layer.querySelectorAll<HTMLElement>('[data-action]').forEach((b) => b.addEventListener('click', () => done(b.dataset.action!)));
    opts.onMount?.(layer.firstElementChild as HTMLElement, done);
    (layer.querySelector('.btn-primary') as HTMLElement | null)?.focus();
  });
}

export const modalOpen = () => !$('#modal').hidden;

export function toast(text: string, kind: 'info' | 'xp' | 'badge' | 'warn' = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = text;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3800);
}

export interface SequenceOption {
  id: string;
  label: string;
  icon?: string;
}

/**
 * Pick options in order (passage symbols, story events). Calls `submit` with the chosen
 * order; `submit` returns null on success or a feedback string to show and let them retry.
 */
export function sequencePuzzle(opts: {
  title: string;
  prompt: string;
  options: SequenceOption[];
  hint?: string;
  submit: (answer: string[]) => Promise<string | null>;
}): Promise<'solved' | 'closed'> {
  return new Promise((resolve) => {
    void modal({
      title: opts.title,
      className: 'puzzle',
      body: `
        <p class="prompt">${esc(opts.prompt)}</p>
        <div class="slots">${opts.options.map((_, i) => `<div class="slot" data-slot="${i}"><span>${i + 1}</span></div>`).join('')}</div>
        <div class="choices">${opts.options
          .map((o) => `<button class="choice-card" data-id="${o.id}">${o.icon ? `<span class="icon">${o.icon}</span>` : ''}<span>${esc(o.label)}</span></button>`)
          .join('')}</div>
        ${opts.hint ? `<p class="hint-line">${esc(opts.hint)}</p>` : ''}
        <p class="feedback" aria-live="polite"></p>`,
      actions: [
        { id: 'reset', label: t('reset') },
        { id: 'close', label: t('close') },
      ],
      onMount: (el, done) => {
        const picked: string[] = [];
        const feedback = el.querySelector('.feedback') as HTMLElement;
        const slots = [...el.querySelectorAll<HTMLElement>('.slot')];
        const cards = [...el.querySelectorAll<HTMLButtonElement>('.choice-card')];
        const render = () => {
          slots.forEach((s, i) => {
            const o = opts.options.find((x) => x.id === picked[i]);
            s.classList.toggle('filled', !!o);
            s.innerHTML = o ? `${o.icon ? `<span class="icon">${o.icon}</span>` : ''}<span>${esc(o.label)}</span>` : `<span>${i + 1}</span>`;
          });
          cards.forEach((c) => (c.disabled = picked.includes(c.dataset.id!)));
        };
        const reset = el.querySelector('[data-action="reset"]') as HTMLElement;
        reset.replaceWith(reset.cloneNode(true));
        el.querySelector('[data-action="reset"]')!.addEventListener('click', () => {
          picked.length = 0;
          feedback.textContent = '';
          render();
        });
        el.querySelector('[data-action="close"]')!.addEventListener('click', () => resolve('closed'));
        cards.forEach((c) =>
          c.addEventListener('click', async () => {
            picked.push(c.dataset.id!);
            render();
            if (picked.length < opts.options.length) return;
            cards.forEach((x) => (x.disabled = true));
            const problem = await opts.submit([...picked]);
            if (!problem) {
              el.classList.add('solved');
              setTimeout(() => {
                done('solved');
                resolve('solved');
              }, 700);
            } else {
              feedback.textContent = problem;
              el.classList.add('shake');
              setTimeout(() => el.classList.remove('shake'), 500);
              picked.length = 0;
              render();
            }
          }),
        );
      },
    });
  });
}
