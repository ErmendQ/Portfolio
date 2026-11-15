/* Erik Thomas — portfolio behaviour, shared by index.html and i.html.
   Content lives in site/data.js; styles in site/app.css. No build step, no dependencies.

   Routes are hashes: #status, #skills, #inventory, #contact and #inventory/<project>.
   A project opens as a page layered over the menu; the menu underneath is left
   exactly as it was, so closing the page costs nothing.

   A tap is answered in the same frame: the screen changes first and the address
   follows. Nothing here waits on the browser's own navigation or history, because
   on a phone those round trips are slow enough to feel like a missed tap. */
(() => {
'use strict';
const S = window.SITE;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/\p{M}|['’]/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };

const html = document.documentElement;
const shell = $('#shell'), view = $('#view'), page = $('#page'), sheet = $('#sheet'), scrim = $('#scrim'), pgScroll = $('#pgScroll');
const mqPhone = matchMedia('(max-width: 860px)');
const mqStill = matchMedia('(prefers-reduced-motion: reduce)');
const still = () => mqStill.matches;
/* iOS drags a picture of the previous screen in with its edge swipe (true on iOS only). */
const swipeNav = !!(window.CSS && CSS.supports && CSS.supports('-webkit-touch-callout', 'none'));
const EASE = 'cubic-bezier(.16, 1, .3, 1)';
const TABS = S.tabs.map((x) => x[0]);

/* Media: data holds bare names from assets/; the page reads the web copies. */
const stem = (f) => f.replace(/\.[^.]+$/, '');
const isVid = (f) => /\.mp4$/i.test(f);
const pic = (f, w) => 'assets/web/' + stem(f) + '-' + w + '.webp';
const set = (f, ws) => ws.map((w) => pic(f, w) + ' ' + w + 'w').join(', ');
const clip = (f, hd) => 'assets/web/' + stem(f) + (hd ? '-1080.mp4' : '-720.mp4');

const ICONS = {
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>',
  down: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  ext: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  back: '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
  arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  expand: '<path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>'
};
const icon = (n, cls) => '<svg class="i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[n] + '</svg>';

/* i.html carries data-all and also shows the projects marked `unlisted`.
   Slots are numbered after filtering, so the inventory never has a gap. */
const projects = S.projects
  .filter((p) => !p.unlisted || html.hasAttribute('data-all'))
  .sort((a, b) => a.slot.localeCompare(b.slot))
  .map((p, i) => Object.assign({}, p, { slot: String(i + 1).padStart(2, '0'), id: slug(p.name) }));
const cases = projects.filter((p) => p.cover);          /* the ones with a case study */
const byId = (id) => cases.find((p) => p.id === id);

const st = {
  lang: store('et-lang') === 'hu' ? 'hu' : 'en',
  tab: null, id: null, mi: {}, th: null, invSeen: false, fromGrid: false,
  draft: { name: '', email: '', text: '' }, sent: null, hue: {}
};
const hu = () => st.lang === 'hu';
const t = (s) => (hu() && Object.prototype.hasOwnProperty.call(S.hu, s) ? S.hu[s] : s);
const tt = (s) => esc(t(s));

/* ---------- sound ----------
   Web Audio, not an <audio> element: it plays the moment it is asked to, mixes with
   whatever the visitor is listening to instead of pausing it, and an iPhone keeps it
   quiet when its ringer switch is off. The sample is fetched while idle (see the end). */
let ac = null, click = null, clickData = null;
function chirp() {
  if (ac.state !== 'running') { const r = ac.resume(); if (r && r.catch) r.catch(() => {}); }
  if (!click) return;
  const src = ac.createBufferSource();
  src.buffer = click; src.connect(ac.destination); src.start();
}
function select() {
  try {
    if (ac) { chirp(); return; }
    const AC = window.AudioContext || window.webkitAudioContext, data = clickData;
    if (!AC || !data) return;
    /* First use. Starting the audio engine costs a few frames, so it happens just
       after the tap has been answered on screen; a timer set inside a tap still
       carries the tap's permission to make sound. */
    clickData = null;
    setTimeout(() => {
      try { ac = new AC(); chirp(); ac.decodeAudioData(data, (buf) => { click = buf; chirp(); }, () => {}); } catch (e) {}
    }, 60);
  } catch (e) {}
}

/* ---------- menu views ---------- */
const cvHref = () => (hu() ? S.cv.hu : S.cv.en);
/* On a phone the address opens the mail app; everywhere it is also copied, so a
   desktop without a mail client still gets something useful out of the click. */
const mailBtn = () => '<a class="btn solid mail" href="mailto:' + S.email + '" data-act="mail">' + icon('mail') +
  '<span class="swap"><span class="a">' + esc(S.email) + '</span><span class="b">' + tt('COPIED TO CLIPBOARD') + '</span></span></a>';
const cells = (rows) => rows.map(([k, v]) => '<div><div class="k">' + tt(k) + '</div><div class="v">' + tt(v) + '</div></div>').join('');

function vStatus() {
  const f = cases[0];
  return '<div class="v-status">' +
    '<div class="col">' +
      '<div class="portrait">' +
        '<img class="fade" src="assets/web/portrait-800.webp" srcset="' + set('portrait.jpg', [400, 800, 1600]) + '" sizes="(max-width: 599px) 100vw, 300px" alt="Erik Thomas" width="800" height="1200" fetchpriority="high" decoding="async">' +
      '</div>' +
      '<div class="cells">' + cells(S.vitals) + '</div>' +
      '<div class="acts">' + mailBtn() +
        '<a class="btn cv" href="' + cvHref() + '" download title="' + tt('Download CV') + '" aria-label="' + tt('Download CV') + '">' + icon('down') + 'CV</a></div>' +
    '</div>' +
    '<div class="col wide">' +
      '<div><div class="lbl">' + tt('Profile') + '</div>' +
        '<p class="lead">' + tt('I design and build complex gameplay systems that feel simple in the hand — polished and fine-tuned until the intended player experience is achieved.') + '</p>' +
        '<p class="intro">' + tt('Based in Budapest. I work across design and code: prototyping the mechanic, writing the systems that hold it up, then spending the long tail on feel — timings, input buffers, feedback, the hundred small corrections that turn a working feature into an entertaining one.') + '</p></div>' +
      '<div class="focus">' + cells(S.focus) + '</div>' +
      '<div><div class="lbl">' + tt('Highlighted project') + '</div>' +
        '<a class="feat" href="#inventory/' + f.id + '" data-sfx data-open="' + f.id + '">' +
          '<div class="thumb"><img class="fade" src="' + pic(f.cover, 400) + '" alt="" decoding="async"><span class="badge">' + f.slot + '</span></div>' +
          '<div class="txt"><div class="name">' + esc(f.name) + '</div><div class="blurb">' + tt(f.blurb) + '</div>' +
            '<div class="row"><span class="chip">' + esc(f.engine) + '</span><span class="chip">' + esc(f.year) + '</span>' +
            '<span class="open">' + esc(t('OPEN CASE STUDY →').replace(/\s*→$/, '')) + icon('arrow') + '</span></div></div>' +
        '</a></div>' +
    '</div></div>';
}

function vSkills() {
  return '<div class="v-skills">' + S.skills.map((b) =>
    '<section class="branch" style="--c:' + b.rgb + '; --soft:' + b.soft + '">' +
      '<div class="top"><h2 class="title">' + tt(b.title) + '</h2><div class="note">' + tt(b.note) + '</div></div>' +
      '<div class="stem"></div>' +
      '<ul>' + b.items.map((s) => '<li><span>' + tt(s) + '</span></li>').join('') + '</ul>' +
    '</section>').join('') + '</div>';
}

function vInventory() {
  return '<div class="v-grid">' + projects.map((p, i) => {
    const on = !!p.cover;
    const inner =
      '<div class="cov' + (on ? ' has' : '') + '">' +
        (on ? '<img class="fade" src="' + pic(p.cover, 800) + '" srcset="' + set(p.cover, [400, 800]) + '" sizes="(max-width: 860px) 100vw, 420px" alt="" ' + (i > 5 ? 'loading="lazy" ' : '') + 'decoding="async">'
            : '<span class="soon">' + tt('cover coming soon') + '</span>') +
        '<span class="badge">' + p.slot + '</span>' +
      '</div>' +
      '<div class="txt">' +
        '<div class="name">' + esc(p.name) + (p.download ? '<span class="dl-ico" title="' + tt('Download for Windows') + '">' + icon('down') + '</span>' : '') + '</div>' +
        '<div class="blurb">' + (on && p.blurb ? tt(p.blurb) : tt('Upload in progress…')) + '</div>' +
        '<div class="tags">' + (p.tags || []).map((g) => '<span class="chip">' + tt(g) + '</span>').join('') + '</div>' +
      '</div>';
    return on ? '<a class="card" href="#inventory/' + p.id + '" data-sfx data-open="' + p.id + '">' + inner + '</a>'
              : '<div class="card locked" aria-disabled="true">' + inner + '</div>';
  }).join('') + '</div>';
}

function vContact() {
  const d = st.draft, sent = st.sent || {};
  return '<div class="v-contact">' +
    '<div>' +
      '<div class="lbl">' + tt('Recruit') + '</div>' +
      '<p class="c-lead">' + tt('Available for gameplay programming, systems design or creative development work — contract or full-time.') + '</p>' +
      '<p class="c-body">' + tt('Happiest on a team that ships. Send a build, a design doc, or a rough idea and I\'ll tell you honestly what I\'d do with it.') + '<span>' + tt('You can email me at:') + '</span></p>' +
      mailBtn() +
    '</div>' +
    '<div class="links">' +
      S.links.map(([k, v, href]) => '<a href="' + href + '" target="_blank" rel="noopener noreferrer"><span class="k">' + esc(k) + '</span><span class="v">' + esc(v) + '</span>' + icon('ext') + '</a>').join('') +
      '<a class="cv" href="' + cvHref() + '" download><span class="k">' + tt('Résumé') + '</span><span class="v">' + tt('Download PDF') + '</span>' + icon('down') + '</a>' +
    '</div>' +
    '<form class="fb" id="fb" novalidate>' +
      '<div class="note"><div class="lbl">' + tt('Feedback') + '</div><p>' + tt('This portfolio is still being polished and iterated on constantly. If something reads oddly, looks broken, or could simply be better — tell me. Every note is welcome.') + '</p></div>' +
      '<div class="two">' +
        '<input type="text" name="name" value="' + esc(d.name) + '" placeholder="' + esc(sent.name || t('Your name (optional)')) + '" aria-label="' + tt('Your name (optional)') + '" autocomplete="name" maxlength="120">' +
        '<input type="email" name="email" value="' + esc(d.email) + '" placeholder="' + esc(sent.email || t('Email for a reply (optional)')) + '" aria-label="' + tt('Email for a reply (optional)') + '" autocomplete="email" maxlength="160">' +
      '</div>' +
      '<textarea name="text" rows="3" placeholder="' + esc(sent.text || t('What worked, what didn’t, what you’d change…')) + '" aria-label="' + tt('Feedback') + '" maxlength="4000">' + esc(d.text) + '</textarea>' +
      '<input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<div class="send-row"><button type="submit" class="btn send">' + esc(t('SEND FEEDBACK →').replace(/\s*→$/, '')) + icon('arrow') + '</button><span class="status" role="status" aria-live="polite"></span></div>' +
    '</form>' +
  '</div>';
}
const VIEWS = { status: vStatus, skills: vSkills, inventory: vInventory, contact: vContact };

/* ---------- project page ---------- */
function mediaList(sys) {
  let img = 0, vid = 0;
  return (sys.media || []).map((f) => (isVid(f)
    ? { f, video: true, label: (hu() ? 'Klip ' : 'Clip ') + String(++vid).padStart(2, '0') }
    : { f, video: false, label: (hu() ? 'Kép ' : 'Shot ') + String(++img).padStart(2, '0') }));
}

function mediaEl(m, big) {
  if (m.video) {
    const src = clip(m.f, big && innerWidth >= 1000);
    return big
      ? '<video src="' + src + '" poster="' + pic(m.f, 1600) + '" controls playsinline loop preload="auto"></video>'
      : '<video data-src="' + src + '" poster="' + pic(m.f, 800) + '" muted loop playsinline preload="none" data-act="toggle" aria-label="' + esc(m.label) + '"></video>';
  }
  return big
    ? '<img src="' + pic(m.f, 1600) + '" alt="' + esc(m.label) + '" decoding="async">'
    : '<img src="' + pic(m.f, 800) + '" srcset="' + set(m.f, [800, 1600]) + '" sizes="(max-width: 860px) 100vw, 45vw" alt="' + esc(m.label) + '" loading="lazy" decoding="async">';
}

function viewer(i, sys, big) {
  const list = mediaList(sys), n = st.mi[i] || 0, many = list.length > 1;
  const stage =
    '<div class="stage-box">' +
      '<div class="media">' + mediaEl(list[n], big) + '</div>' +
      (big ? '' : '<button type="button" class="ctl big" data-act="theater" data-sys="' + i + '">' + icon('expand') + tt('Big screen') + '</button>') +
      '<div class="veil"></div>' +
      (many ? '<button type="button" class="ctl prev" data-act="step" data-d="-1" data-sys="' + i + '" aria-label="' + tt('Previous') + '">' + icon('left') + '</button>' +
              '<button type="button" class="ctl next-m" data-act="step" data-d="1" data-sys="' + i + '" aria-label="' + tt('Next') + '">' + icon('right') + '</button>' +
              (big ? '' : '<span class="counter">' + (n + 1) + ' / ' + list.length + '</span>') : '') +
    '</div>';
  const thumbs = '<div class="thumbs">' + (many ? list.map((m, k) =>
    '<button type="button" data-act="pick" data-n="' + k + '" data-sys="' + i + '" aria-current="' + (k === n) + '" aria-label="' + esc(m.label) + '" title="' + esc(m.label) + '">' +
      '<img src="' + pic(m.f, 400) + '" alt="" loading="lazy" decoding="async">' + (m.video ? '<span class="vid">' + icon('play', 'solid') + '</span>' : '') +
    '</button>').join('') : '') + '</div>';
  if (!big) return stage + (many ? thumbs : '');
  return stage + '<div class="bar">' + thumbs + '<div class="bar-r"><span class="th-count">' + (many ? (n + 1) + ' / ' + list.length : '') + '</span>' +
    '<button type="button" class="ov-btn" data-act="close">' + icon('close') + tt('Close') + '</button></div></div>';
}

function vPage(p) {
  const sys = p.systems || [], nx = cases[(cases.indexOf(p) + 1) % cases.length];
  /* The cover the grid already loaded stands in until the sharp one arrives. */
  const hero = p.youtube
    ? '<button type="button" class="yt" data-act="yt" aria-label="' + tt('Play video') + ': ' + esc(p.name) + '">' +
        '<img src="' + pic(p.cover, 1600) + '" srcset="' + set(p.cover, [800, 1600]) + '" sizes="(max-width: 860px) 100vw, 55vw" alt="" decoding="async">' +
        '<span class="play" aria-hidden="true">' + icon('play', 'solid') + '</span></button>' +
      '<a class="ytlink" href="https://youtu.be/' + p.youtube + '" target="_blank" rel="noopener">' + tt('Open on YouTube') + icon('ext') + '</a>'
    : '<img src="' + pic(p.cover, 1600) + '" srcset="' + set(p.cover, [800, 1600]) + '" sizes="(max-width: 860px) 100vw, 55vw" alt="' + esc(p.name) + '" decoding="async">';
  const count = hu() ? sys.length + ' RENDSZER' : sys.length + (sys.length === 1 ? ' SYSTEM' : ' SYSTEMS');
  return '<article class="pg">' +
    '<div class="hero-grid">' +
      '<div class="hero" style="background-image:url(' + pic(p.cover, 800) + ')">' + hero + '</div>' +
      '<div class="info">' +
        '<div><div class="kicker">' + p.slot + ' — ' + tt('CASE STUDY') + '</div>' +
          '<h2 class="ptitle" id="pgTitle">' + esc(p.name) + '</h2>' +
          '<p class="summary">' + tt(p.summary || p.blurb) + '</p></div>' +
        (p.download ? '<a class="dl" href="' + esc(p.download) + '" target="_blank" rel="noopener">' + icon('down') + '<span>' + tt('Download for Windows') + '</span></a>' : '') +
        (p.meta ? '<div class="meta">' + cells(p.meta) + '</div>' : '') +
        (p.built && p.built.length ? '<div><div class="sec-lbl">' + tt('What I built') + '</div><ul class="built">' + p.built.map((b) => '<li>' + tt(b) + '</li>').join('') + '</ul></div>' : '') +
      '</div>' +
    '</div>' +
    (sys.length ? '<section class="systems">' +
      '<div class="sys-head"><div><div class="sec-lbl">' + tt('Systems breakdown') + '</div><h2 class="h2">' + tt('How it works under the hood') + '</h2></div><div class="count">' + count + '</div></div>' +
      '<div class="sys-list">' + sys.map((s, i) =>
        '<article class="sys">' +
          '<div class="txt"><div class="idx">SYS ' + String(i + 1).padStart(2, '0') + '</div><h3>' + tt(s.title) + '</h3><p>' + tt(s.body) + '</p>' +
            (s.blueprint ? '<button type="button" class="bp-btn" data-act="bp" data-sys="' + i + '"><span>' + tt('SEE BLUEPRINT') + '</span>' + icon('ext') + '</button>' : '') +
          '</div>' +
          (s.media && s.media.length ? '<div class="mv" data-sys="' + i + '">' + viewer(i, s, false) + '</div>' : '<div></div>') +
        '</article>').join('') + '</div>' +
    '</section>' : '') +
    (nx !== p ? '<a class="next" href="#inventory/' + nx.id + '" data-act="swap" data-sfx>' +
      '<span class="thumb"><img src="' + pic(nx.cover, 400) + '" alt="" loading="lazy" decoding="async"></span>' +
      '<span><span class="sec-lbl">' + tt('Next project') + '</span><span class="name">' + esc(nx.name) + '</span></span>' + icon('arrow') + '</a>' : '') +
  '</article>';
}

/* The page's accent follows the dominant hue of the project's cover. It is read off
   the cover the menu has already loaded, so it is known before the page opens. */
function measure(im) {
  try {
    const n = 24, c = document.createElement('canvas'); c.width = c.height = n;
    const ctx = c.getContext('2d'); ctx.drawImage(im, 0, 0, n, n);
    const d = ctx.getImageData(0, 0, n, n).data;
    let x = 0, y = 0, sw = 0, ss = 0, sc = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
      if (mx === mn || l < .06 || l > .97) continue;
      const dl = mx - mn, sat = l > .5 ? dl / (2 - mx - mn) : dl / (mx + mn);
      let h = mx === r ? (g - b) / dl + (g < b ? 6 : 0) : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4;
      h *= 60;
      const w = sat * (1 - Math.abs(l - .5) * 1.2);
      x += Math.cos(h * Math.PI / 180) * w; y += Math.sin(h * Math.PI / 180) * w;
      sw += w; ss += sat; sc++;
    }
    if (sc && sw) {
      let h = Math.atan2(y, x) * 180 / Math.PI; if (h < 0) h += 360;
      return { h: Math.round(h), s: Math.max(14, Math.min(34, Math.round((ss / sc) * 100 * .8))) };
    }
  } catch (e) {}
  return { h: 145, s: 20 };
}
function hueOf(p, done) {
  if (st.hue[p.cover]) { done(st.hue[p.cover]); return; }
  const im = new Image();
  im.onload = () => { st.hue[p.cover] = measure(im); done(st.hue[p.cover]); };
  im.src = pic(p.cover, 400);
}
const tint = (el, v) => { el.style.setProperty('--h', v.h); el.style.setProperty('--s', v.s); };
/* An image in the menu finished loading: fade it in, and note its project's hue. */
function ready(im) {
  im.classList.add('in');
  const a = im.closest('[data-open]'), p = a && byId(a.dataset.open);
  if (p && !st.hue[p.cover]) st.hue[p.cover] = measure(im);
}

/* ---------- clips: only the ones on screen load and run ---------- */
const openOv = () => $('dialog.ov[open]');
const play = (v) => { const r = v.play(); if (r && r.catch) r.catch(() => {}); };
/* Big screen starts with sound when the browser allows it, muted otherwise. */
const playLoud = (v) => { const r = v.play(); if (r && r.catch) r.catch(() => { v.muted = true; play(v); }); };
const io = new IntersectionObserver((entries) => entries.forEach((en) => {
  const v = en.target;
  if (!en.isIntersecting) { if (!v.paused) v.pause(); return; }
  if (!v.getAttribute('src')) v.src = v.dataset.src;
  if (!openOv() && !v.dataset.paused) play(v);
}), { threshold: 0.25 });
const unload = (v) => { io.unobserve(v); v.pause(); v.removeAttribute('src'); v.load(); };
function resumeVisible() {
  $$('video[data-src]', page).forEach((v) => {
    const r = v.getBoundingClientRect();
    if (r.bottom > 0 && r.top < innerHeight && !v.dataset.paused && v.getAttribute('src')) play(v);
  });
}

function showMedia(i, n) {
  const p = byId(st.id); if (!p || !p.systems[i]) return;
  const list = mediaList(p.systems[i]);
  n = ((n % list.length) + list.length) % list.length;
  if (n === (st.mi[i] || 0)) return;
  st.mi[i] = n;
  const boxes = [$('.mv[data-sys="' + i + '"]', page)];
  if (st.th === i) boxes.push($('#thMv'));
  boxes.forEach((box) => {
    if (!box) return;
    const big = box.id === 'thMv', veil = $('.veil', box), media = $('.media', box);
    $$('.thumbs button', box).forEach((b, k) => b.setAttribute('aria-current', String(k === n)));
    $$('.counter, .th-count', box).forEach((c) => { c.textContent = (n + 1) + ' / ' + list.length; });
    veil.classList.add('on');
    clearTimeout(box._swap); clearTimeout(box._lift);
    box._swap = setTimeout(() => {
      const old = $('video', media); if (old) unload(old);
      media.innerHTML = mediaEl(list[n], big);
      const el = media.firstElementChild;
      const lift = () => { clearTimeout(box._lift); veil.classList.remove('on'); };
      box._lift = setTimeout(lift, 1400);
      if (el.tagName === 'VIDEO') {
        el.addEventListener('loadeddata', lift, { once: true }); el.addEventListener('error', lift, { once: true });
        if (big) playLoud(el); else io.observe(el);
      } else if (el.complete) lift();
      else { el.addEventListener('load', lift, { once: true }); el.addEventListener('error', lift, { once: true }); }
    }, 170);
  });
}

/* ---------- the page itself ---------- */
let origin = null;      /* the card a project was opened from; the page grows out of it */
let seq = 0;            /* guards a transition against one that started after it */
let closing = false;    /* the page is on its way out */
const titleIO = new IntersectionObserver((e) => sheet.classList.toggle('scrolled', !e[0].isIntersecting), { root: pgScroll, rootMargin: '-70px 0px 0px 0px' });
pgScroll.addEventListener('scroll', () => sheet.classList.toggle('moved', pgScroll.scrollTop > 8), { passive: true });

function fillPage(p) {
  $$('video', pgScroll).forEach(unload);
  st.id = p.id; st.mi = {};
  pgScroll.innerHTML = vPage(p);
  pgScroll.scrollTop = 0;
  $('#sheetTint').style.backgroundImage = 'url(' + pic(p.cover, 'bg') + ')';
  $('#crumb').innerHTML = p.slot + ' — <b>' + esc(p.name) + '</b>';
  hueOf(p, (v) => { if (st.id === p.id) tint(page, v); });
  sheet.classList.remove('scrolled', 'moved');
  titleIO.disconnect(); titleIO.observe($('#pgTitle'));
  $$('video[data-src]', pgScroll).forEach((v) => io.observe(v));
}

function originPoint() {
  const s = sheet.getBoundingClientRect();
  if (origin && origin.isConnected && origin.offsetParent) {
    const r = origin.getBoundingClientRect();
    return (r.left + r.width / 2 - s.left) + 'px ' + (r.top + r.height / 2 - s.top) + 'px';
  }
  return '50% 42%';
}

/* How the sheet arrives, as [keyframes, ms, easing]; it leaves the same way in reverse.
   On a phone it slides up whole: a move large enough to read even if a frame is lost
   at the start, and transform only, so the compositor can carry it on its own. */
function motion() {
  if (still()) return [[{ opacity: 0 }, { opacity: 1 }], 160, 'ease-out'];
  if (mqPhone.matches) return [[{ transform: 'translateY(100%)' }, { transform: 'none' }], 460, 'cubic-bezier(.32, .72, 0, 1)'];
  sheet.style.transformOrigin = originPoint();
  return [[{ opacity: 0, transform: 'scale(.86)' }, { opacity: 1, transform: 'none' }], 460, EASE];
}

function openPage(p, animate) {
  const mine = ++seq;
  closing = false;
  sheet.getAnimations().concat(scrim.getAnimations()).forEach((a) => a.cancel());
  fillPage(p);
  html.classList.add('page-open');
  html.classList.remove('page-settled');
  if (!page.open) page.showModal();
  const settle = () => { if (mine === seq) html.classList.add('page-settled'); };
  if (!animate) { settle(); return; }
  const [kf, ms, ease] = motion();
  scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: Math.min(ms, 260), easing: 'ease-out' });
  sheet.animate(kf, { duration: ms, easing: ease }).finished.then(settle, () => {});
}

/* Moving between projects while the page is open: the sheet stays, its content changes. */
function swapPage(p) {
  const mine = ++seq;
  if (still()) { fillPage(p); return; }
  pgScroll.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: 'ease-in', fill: 'forwards' }).finished.then(() => {
    if (mine !== seq) return;
    fillPage(p);
    pgScroll.getAnimations().forEach((a) => a.cancel());
    pgScroll.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: EASE });
  }, () => {});
}

function closePage(animate) {
  if (!page.open || closing) return;
  closing = true;
  const mine = ++seq;
  html.classList.remove('page-open', 'page-settled');       /* the menu is back before the page leaves */
  const done = () => { if (mine === seq) page.close(); };
  if (!animate) { done(); return; }
  const [kf, ms, ease] = motion(), opt = { duration: ms * .6, easing: mqPhone.matches ? ease : 'ease-out', fill: 'forwards' };
  scrim.animate([{ opacity: 1 }, { opacity: 0 }], opt);
  sheet.animate(kf.slice().reverse(), opt).finished.then(done, () => {});
}

/* Everything that must happen however the page went away (button, Esc, back gesture). */
page.addEventListener('close', () => {
  if (page.open) return;              /* opened again before this event arrived */
  html.classList.remove('page-open', 'page-settled');
  $$('video', pgScroll).forEach(unload);
  pgScroll.innerHTML = '';            /* also stops a playing YouTube embed */
  sheet.getAnimations().concat(scrim.getAnimations()).forEach((a) => a.cancel());
  titleIO.disconnect();
  st.id = null; st.mi = {}; closing = false;
  /* Closed by the browser itself (Android's back button dismisses dialogs): the address still names it. */
  if (parse().id && !backs) history.replaceState(null, '', '#inventory');
});
page.addEventListener('cancel', (e) => { e.preventDefault(); leave(); });

/* The close button, the back pill, Esc and a click outside. The page leaves at once
   and the address catches up: stepping back through history takes a few hundred
   milliseconds on a phone, and that must not be what the tap waits for. Stepping
   back (rather than rewriting the entry) keeps the phone's own back gesture and
   these buttons ending in the same place. */
function leave() {
  if (!page.open || closing) return;
  closePage(true);
  if (st.fromGrid) stepBack(); else history.replaceState(null, '', '#inventory');
  document.title = baseTitle;
}

/* ---------- overlays above the page: big screen and blueprint viewer ----------
   Each pushes a history entry, so the phone's back gesture closes it. */
function openOverlay(d) {
  const p = byId(st.id);
  $$('video', pgScroll).forEach((v) => { if (!v.paused) v.pause(); });
  if (p && st.hue[p.cover]) tint(d, st.hue[p.cover]);
  d.showModal();
  history.pushState({ ov: 1 }, '');
}
const closeOverlay = () => { const d = openOv(); if (d) d.close(); };
$$('dialog.ov').forEach((d) => {
  d.addEventListener('cancel', (e) => { e.preventDefault(); d.close(); });
  d.addEventListener('close', () => {
    if (d.id === 'theater') { $$('video', d).forEach(unload); $('#thMv').innerHTML = ''; st.th = null; }
    else { const f = $('#bpFrame'); if (f) f.remove(); }
    /* It has left the screen already; now drop the history entry it pushed. */
    if (history.state && history.state.ov) stepBack();
    resumeVisible();
  });
});
$('#theater').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeOverlay(); });

function openTheater(i) {
  const p = byId(st.id); if (!p) return;
  st.th = i;
  $('#thMv').innerHTML = viewer(i, p.systems[i], true);
  openOverlay($('#theater'));
  const v = $('#thMv video'); if (v) playLoud(v);
}
function openBlueprint(i) {
  const s = byId(st.id).systems[i];
  $('#bpTitle').textContent = t(s.title);
  /* A fresh iframe per open: changing an existing iframe's src adds session-history
     entries, which would make the phone's back gesture step the hidden viewer. */
  const f = document.createElement('iframe');
  f.id = 'bpFrame'; f.title = t(s.title);
  f.src = 'blueprint-viewer/index.html?src=' + s.blueprint.map((x) => 'assets/' + x).join(',');
  $('#bp').appendChild(f);
  openOverlay($('#bp'));
}

/* ---------- navigation ---------- */
const navs = [$('#tabs'), $('#dock')];
navs.forEach((nav) => {
  nav.innerHTML = '<span class="tab-bar"></span>' + TABS.map((id) =>
    '<a class="tab' + (id === 'inventory' ? ' has-sub' : '') + '" href="#' + id + '" data-tab="' + id + '" data-sfx><span class="t"></span>' + (id === 'inventory' ? '<span class="sub"></span>' : '') + '</a>').join('');
});

/* The bar glides with a transform only: its box takes the new tab's size at once,
   and the animation plays it forward from wherever it visibly was (FLIP). */
function placeBar(glide) {
  navs.forEach((nav) => {
    const a = $('.tab[aria-current="page"]', nav), bar = $('.tab-bar', nav);
    if (!a || !a.offsetWidth) return;            /* this nav is hidden at the current width */
    const was = bar.getBoundingClientRect(), home = nav.getBoundingClientRect();
    const x = a.offsetLeft - bar.offsetLeft, w = a.offsetWidth, shown = bar.style.opacity === '1';
    bar.getAnimations().forEach((an) => an.cancel());
    bar.style.width = w + 'px';
    bar.style.transform = 'translateX(' + x + 'px)';
    bar.style.opacity = '1';
    if (!glide || !shown || !was.width || still()) return;
    const x0 = was.left - home.left - nav.clientLeft - bar.offsetLeft;
    if (Math.abs(x0 - x) < 1 && Math.abs(was.width - w) < 1) return;
    bar.animate([{ transform: 'translateX(' + x0 + 'px) scaleX(' + was.width / w + ')' }, { transform: 'translateX(' + x + 'px) scaleX(1)' }], { duration: 500, easing: EASE });
  });
}

/* Which tab is current. Runs on every switch, so it touches nothing else. */
function markTab(glide) {
  navs.forEach((nav) => $$('.tab', nav).forEach((a) => {
    if (a.dataset.tab === st.tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    a.classList.toggle('flash', a.dataset.tab === 'inventory' && !st.invSeen);
  }));
  placeBar(glide);
}

/* Everything in the chrome that is worded: runs at the start and on a language change. */
function paintChrome() {
  navs.forEach((nav) => {
    nav.setAttribute('aria-label', t('Sections'));
    $$('.tab', nav).forEach((a) => {
      const def = S.tabs.find((x) => x[0] === a.dataset.tab);
      $('.t', a).textContent = hu() ? def[2] : def[1];
      const sub = $('.sub', a); if (sub) sub.textContent = t('Projects');
    });
  });
  $$('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
  $$('[data-t-label]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.tLabel)));
  $$('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === st.lang)));
  $('#pgBack').innerHTML = icon('back') + '<span>' + esc(t('← BACK TO INVENTORY').replace(/^←\s*/, '')) + '</span>';
  markTab();
}

const panels = {};
function fadeIn(root) { $$('img.fade', root).forEach((im) => { if (im.complete && im.naturalWidth) ready(im); }); }
function panel(tab) {
  let el = panels[tab];
  if (!el) {
    el = panels[tab] = document.createElement('section');
    el.className = 'panel off'; el.dataset.tab = tab; el.tabIndex = -1;
    el.innerHTML = VIEWS[tab]();
    view.appendChild(el); fadeIn(el);
  }
  return el;
}

/* quiet: the tab changes underneath something else (first paint, a project page
   opening over it, a swipe back), so nothing should move or take focus. */
function showTab(tab, quiet) {
  const el = panel(tab);
  st.tab = tab;
  if (tab === 'inventory') st.invSeen = true;
  Object.keys(panels).forEach((k) => panels[k].classList.toggle('off', k !== tab));
  markTab(!quiet);
  if (quiet) return;
  /* A keyboard user who just activated a tab lands in its content. */
  if (document.activeElement && document.activeElement.closest('.tabs')) el.focus({ preventScroll: true });
  /* The new tab comes into focus. A panel is never larger than the screen, so the blur stays cheap. */
  el.animate(still() ? [{ opacity: 0 }, { opacity: 1 }]
    : [{ opacity: 0, filter: 'blur(14px)', transform: 'scale(1.012)' }, { opacity: 1, filter: 'blur(0px)', transform: 'none' }],
    { duration: still() ? 160 : 380, easing: 'cubic-bezier(.3, .7, .3, 1)' });
}

function parse(hash) {
  let h = (hash === undefined ? location.hash : hash).replace(/^#\/?/, '');
  try { h = decodeURIComponent(h); } catch (e) {}
  const [tab, id] = h.split('/');
  const ok = TABS.indexOf(tab) >= 0 ? tab : 'status';
  return { tab: ok, id: ok === 'inventory' && id && byId(id) ? id : null };
}

/* Make the screen match the address. instant: without animating (see the popstate handler). */
const baseTitle = document.title;
function route(first, instant) {
  const r = parse(), p = r.id ? byId(r.id) : null;
  /* A project that doesn't exist here (typo, or unlisted on this page): tidy the address. */
  if (!p && location.hash.indexOf('/') > 0) history.replaceState(null, '', '#' + r.tab);
  const d = openOv();
  if (d && !(history.state && history.state.ov)) d.close();
  if (r.tab !== st.tab) {
    /* Opening a project from another tab: the inventory is simply there underneath. */
    st.fromGrid = false;
    showTab(r.tab, first || instant || !!p);
  }
  if (p && (p.id !== st.id || closing)) { if (page.open && !closing) swapPage(p); else openPage(p, !first && !instant); }
  else if (!p && page.open) closePage(!instant);
  document.title = p ? p.name + ' — Erik Thomas' : baseTitle;
}

/* Our own history.back() calls that have not landed yet. A tap that arrives in the
   meantime waits for them, so the address and the screen cannot get out of step. */
let backs = 0, backT = 0, queued = null;
function stepBack() {
  backs++;
  clearTimeout(backT); backT = setTimeout(() => { backs = 0; flush(); }, 1500);
  history.back();
}
function flush() { if (!backs && queued) { const q = queued; queued = null; go(q[0], q[1]); } }

/* Go somewhere inside the site: the address and the screen change in one step. */
function go(hash, replace) {
  if (backs) { queued = [hash, replace]; return; }
  const a = parse(), b = parse(hash);
  if (a.tab !== b.tab || a.id !== b.id) history[replace ? 'replaceState' : 'pushState'](null, '', hash);
  route();
}

/* Back, forward, or an address typed by hand. */
addEventListener('popstate', () => {
  const ours = backs > 0;
  if (ours && !--backs) clearTimeout(backT);
  /* An edge swipe on iOS has already slid the destination into view, so the screen
     only has to match it; animating again would play the change twice. */
  route(false, !ours && swipeNav);
  flush();
});

/* ---------- language ---------- */
const GLYPHS = 'ÁÉÍÓÖŐÚÜŰ#%&@$*+=<>/\\|01░▒';
function glitch(s, p) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === ' ' || c === '\n' || c === '—') { out += c; continue; }
    const h = ((i * 2654435761) % 1000) / 1000;
    out += p > (i / s.length) * 0.72 + h * 0.28 ? c : GLYPHS[(i * 7 + Math.floor(p * 97) * 13 + Math.floor(h * 1000)) % GLYPHS.length];
  }
  return out;
}
/* The new language is in place from the first frame; each character stays masked
   by a glyph until its own threshold passes, so lengths never change mid-decode. */
let decodeT = 0;
function decode() {
  if (still()) return;
  const nodes = [], seen = (n) => (n.data.trim() && !n.parentNode.closest('.off, .seg, .boot') ? 1 : 3);
  [shell, $('#dock')].forEach((root) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: seen });
    for (let n = w.nextNode(); n; n = w.nextNode()) nodes.push([n, n.data]);
  });
  let step = 0;
  const frame = () => {
    const p = step / 6;
    nodes.forEach(([n, s]) => { n.data = p >= 1 ? s : glitch(s, p); });
    view.style.filter = p >= 1 ? '' : 'blur(' + (1.7 * Math.sin(Math.PI * p)).toFixed(2) + 'px)';
    if (p >= 1) { clearInterval(decodeT); placeBar(); }
    step++;
  };
  clearInterval(decodeT); frame();
  decodeT = setInterval(frame, 26);
}
function setLang(l) {
  if (l === st.lang) return;
  st.lang = l; store('et-lang', l); html.lang = l;
  Object.keys(panels).forEach((k) => { const y = panels[k].scrollTop; panels[k].innerHTML = VIEWS[k](); fadeIn(panels[k]); panels[k].scrollTop = y; });
  paintChrome();
  decode();
}

/* ---------- contact ---------- */
function copyEmail(btn) {
  const sw = $('.swap', btn);
  const done = () => {
    clearTimeout(btn._t1); clearTimeout(btn._t2); clearTimeout(btn._t3);
    sw.classList.add('fading');
    btn._t1 = setTimeout(() => { btn.classList.add('copied'); sw.classList.remove('fading'); }, 170);
    btn._t2 = setTimeout(() => sw.classList.add('fading'), 2100);
    btn._t3 = setTimeout(() => { btn.classList.remove('copied'); sw.classList.remove('fading'); }, 2270);
  };
  const legacy = () => {
    try {
      const ta = document.createElement('textarea');
      ta.value = S.email; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    } catch (e) {}
    done();
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(S.email).then(done, legacy);
  else legacy();
}

let fbT = 0;
function fbStatus(form, msg, err) {
  const el = $('.status', form);
  el.textContent = msg ? t(msg) : ''; el.classList.toggle('err', !!err);
  clearTimeout(fbT);
  if (msg && !err && msg !== 'SENDING…') fbT = setTimeout(() => { el.textContent = ''; }, 5000);
}
async function sendFeedback(form) {
  const d = st.draft, text = d.text.trim(), btn = $('.send', form), F = (k) => form.elements.namedItem(k);
  if (!text) { fbStatus(form, 'WRITE SOMETHING FIRST', true); F('text').focus(); return; }
  const entry = { at: new Date().toISOString(), name: d.name.trim() || null, email: d.email.trim() || null, text, lang: st.lang };
  btn.disabled = true; fbStatus(form, 'SENDING…');
  try {
    /* Apps Script answers without CORS headers, so this is fire-and-forget:
       a resolved fetch means it left the browser; only a network error rejects. */
    if (!F('website').value) {
      await fetch(S.feedbackEndpoint, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(entry) });
    }
    st.sent = entry; st.draft = { name: '', email: '', text: '' };
    ['name', 'email', 'text'].forEach((k) => { F(k).value = ''; });
    F('name').placeholder = entry.name || t('Your name (optional)');
    F('email').placeholder = entry.email || t('Email for a reply (optional)');
    F('text').placeholder = text;
    fbStatus(form, 'THANKS — YOUR NOTE IS LOGGED');
  } catch (e) {
    fbStatus(form, 'COULDN’T SEND — PLEASE EMAIL ME INSTEAD', true);
  } finally { btn.disabled = false; }
}
view.addEventListener('input', (e) => {
  const f = e.target;
  if (f.form && f.form.id === 'fb' && f.name in st.draft) { st.draft[f.name] = f.value; fbStatus(f.form, ''); }
});
view.addEventListener('submit', (e) => { if (e.target.id === 'fb') { e.preventDefault(); sendFeedback(e.target); } });
/* iOS slides the whole screen up for the keyboard and can leave it there afterwards. */
view.addEventListener('focusout', () => setTimeout(() => { const a = document.activeElement; if (!a || !a.form) scrollTo(0, 0); }, 60));

/* ---------- events ---------- */
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-sfx]')) select();
  const opener = e.target.closest('[data-open]');
  if (opener) { origin = opener; st.fromGrid = st.tab === 'inventory' && !st.id; }
  const el = e.target.closest('[data-act]'), i = el ? +el.dataset.sys : 0;
  switch (el && el.dataset.act) {
    case 'lang': select(); setLang(el.dataset.lang); break;
    case 'leave': select(); leave(); break;
    /* Next project: replace the entry, so Back still leads out of the page. */
    case 'swap': e.preventDefault(); go(el.getAttribute('href'), true); break;
    case 'skip': e.preventDefault(); panels[st.tab].focus(); break;
    case 'step': showMedia(i, (st.mi[i] || 0) + +el.dataset.d); break;
    case 'pick': showMedia(i, +el.dataset.n); break;
    case 'theater': openTheater(i); break;
    case 'bp': openBlueprint(i); break;
    case 'close': closeOverlay(); break;
    case 'mail':
      copyEmail(el);
      if (!matchMedia('(pointer: coarse)').matches) e.preventDefault();
      break;
    case 'toggle':
      if (el.paused) { delete el.dataset.paused; play(el); } else { el.dataset.paused = '1'; el.pause(); }
      break;
    case 'yt': {
      const p = byId(st.id);
      /* YouTube refuses embeds from a file:// page, so an offline copy links out instead. */
      if (location.protocol === 'file:') { open('https://youtu.be/' + p.youtube, '_blank', 'noopener'); break; }
      el.outerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + p.youtube + '?rel=0&modestbranding=1&playsinline=1&autoplay=1" title="' + tt('Gameplay capture') + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
      break;
    }
  }
  /* Links within the site are answered here, not by letting the browser navigate to
     the hash and waiting for it to report back. */
  const a = e.target.closest('a[href^="#"]');
  if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  /* Tapping the tab you are on takes it back to the top. */
  if (a.dataset.tab === st.tab && !page.open) panels[st.tab].scrollTo({ top: 0, behavior: still() ? 'auto' : 'smooth' });
  go(a.getAttribute('href'));
});

document.addEventListener('load', (e) => { const im = e.target; if (im.classList && im.classList.contains('fade')) ready(im); }, true);

/* Touching a card warms the sharp cover its page will ask for. */
document.addEventListener('pointerover', (e) => {
  const a = e.target.closest && e.target.closest('[data-open]');
  if (!a || a._warm) return;
  a._warm = 1;
  const p = byId(a.dataset.open);
  if (p && !(navigator.connection && navigator.connection.saveData)) new Image().src = pic(p.cover, innerWidth * devicePixelRatio > 1700 ? 1600 : 800);
}, { passive: true });

/* Swipe through a gallery on touch screens. */
let swipe = null;
document.addEventListener('pointerdown', (e) => {
  const box = e.pointerType === 'touch' && e.target.closest('.stage-box');
  swipe = box ? { x: e.clientX, y: e.clientY, mv: box.closest('.mv') } : null;
}, { passive: true });
document.addEventListener('pointercancel', () => { swipe = null; }, { passive: true });
document.addEventListener('pointerup', (e) => {
  if (!swipe) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y, mv = swipe.mv;
  swipe = null;
  if (Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  const i = mv.id === 'thMv' ? st.th : +mv.dataset.sys;
  showMedia(i, (st.mi[i] || 0) + (dx < 0 ? 1 : -1));
}, { passive: true });

addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tg = e.target;
  if (tg && (tg.isContentEditable || /^(input|textarea|select)$/i.test(tg.tagName))) return;
  if ($('#theater').open && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { showMedia(st.th, (st.mi[st.th] || 0) + (e.key === 'ArrowLeft' ? -1 : 1)); return; }
  if (page.open || openOv()) return;
  const k = e.key && e.key.toLowerCase();
  if (k !== 'e' && k !== 'q') return;
  select();
  go('#' + TABS[(TABS.indexOf(st.tab) + (k === 'e' ? 1 : TABS.length - 1)) % TABS.length]);
});

/* ---------- rim light: the glass edge catches light near the cursor ---------- */
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  let raf = 0, px = 0, py = 0;
  const rims = $$('.rim');
  const paint = () => {
    raf = 0;
    rims.forEach((rim) => {
      const dot = rim.firstElementChild, host = rim.parentNode;
      if (!host.offsetParent) { dot.style.opacity = '0'; return; }
      const r = host.getBoundingClientRect();
      const near = px > r.left - 120 && px < r.right + 120 && py > r.top - 120 && py < r.bottom + 120;
      dot.style.opacity = near ? '1' : '0';
      if (near) dot.style.transform = 'translate3d(' + (px - r.left) + 'px,' + (py - r.top) + 'px,0)';
    });
  };
  addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; if (!raf && !still()) raf = requestAnimationFrame(paint); }, { passive: true });
}

/* ---------- start ---------- */
const relayout = () => placeBar();
new ResizeObserver(relayout).observe($('#head'));
new ResizeObserver(relayout).observe($('#dock'));
if (document.fonts) document.fonts.ready.then(relayout);
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
document.addEventListener('touchstart', () => {}, { passive: true });   /* iOS applies :active only when a touch listener exists */
html.lang = st.lang;
paintChrome();
route(true);

/* While idle: fetch the click sound and build the other tabs, so the first visit to
   each is as quick as every later one and the inventory's covers are already loaded. */
(window.requestIdleCallback || ((f) => setTimeout(f, 500)))(() => {
  fetch('assets/ui-select.wav').then((r) => r.arrayBuffer()).then((b) => { clickData = b; }).catch(() => {});
  if (!(navigator.connection && navigator.connection.saveData)) TABS.forEach(panel);
});

(() => {
  let seen = false;
  try { seen = sessionStorage.getItem('et-boot') === '1'; sessionStorage.setItem('et-boot', '1'); } catch (e) {}
  if (seen || still() || parse().id) return;
  const boot = $('#boot'), caret = $('i', boot);
  boot.hidden = false;
  let i = 0, tick = 0, hold = 0;
  const end = () => {
    clearInterval(tick); clearTimeout(hold);
    removeEventListener('pointerdown', end); removeEventListener('keydown', end);
    boot.classList.add('done'); setTimeout(() => { boot.hidden = true; }, 260);
  };
  addEventListener('pointerdown', end); addEventListener('keydown', end);
  tick = setInterval(() => {
    caret.insertAdjacentHTML('beforebegin', '<div>' + tt(S.boot[i]) + '</div>');
    if (++i < S.boot.length) return;
    clearInterval(tick);
    hold = setTimeout(end, 320);
  }, 190);
})();
})();
