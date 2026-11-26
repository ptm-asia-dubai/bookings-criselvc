/* CriselVC · Bookings — interactions
   Everything here is progressive enhancement: with JS off the page, the reels, the logo wall
   and the inquiry form (normal POST to Netlify Forms) all still work. */
(() => {
  window.__cvc = true; // tells the head fallback timer that the script ran
  const root = document.documentElement;
  const mq = (q) => window.matchMedia(q);
  const reduceMQ = mq('(prefers-reduced-motion: reduce)');
  const reduce = reduceMQ.matches;
  const finePointer = mq('(hover: hover) and (pointer: fine)').matches;
  const hasIO = 'IntersectionObserver' in window;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* ---------- Nav: solid after scroll, current section ---------- */
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('is-solid', window.scrollY > 40);
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

  const links = $$('.nav__links a[href^="#"]');
  const targets = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  if (hasIO) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => {
          if (a.getAttribute('href') === '#' + e.target.id) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.forEach((t) => spy.observe(t));
  }

  /* ---------- Mobile menu ---------- */
  const menu = $('#menu');
  const openBtn = $('#menu-open');
  const closeBtn = $('#menu-close');
  const openMenu = () => { menu.hidden = false; requestAnimationFrame(() => menu.classList.add('is-open')); openBtn.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; closeBtn.focus(); };
  const closeMenu = () => { menu.classList.remove('is-open'); openBtn.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; setTimeout(() => { menu.hidden = true; }, reduce ? 0 : 300); };
  openBtn.addEventListener('click', openMenu);
  closeBtn.addEventListener('click', () => { closeMenu(); openBtn.focus(); });
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { closeMenu(); openBtn.focus(); } });

  /* ---------- S1·I1 Scroll reveals: sections get .is-in, children stagger in ---------- */
  const rv = $$('.rv');
  const sections = $$('main > section, .foot');
  if (reduce || !hasIO) {
    rv.forEach((el) => el.classList.add('in'));
    sections.forEach((s) => s.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      let n = 0;
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.style.setProperty('--rv-delay', Math.min(n++, 6) * 80 + 'ms');
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    rv.forEach((el) => io.observe(el));

    const so = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); so.unobserve(e.target); }
    }), { threshold: 0.12 });
    sections.forEach((s) => so.observe(s));
  }

  /* ---------- S1·I2 Hero: parallax layers (desktop only) + typed tagline ---------- */
  const hero = $('.hero');
  const layers = $$('[data-parallax]', hero);
  const desktop = mq('(min-width: 961px)');
  if (!reduce && layers.length) {
    let ticking = false;
    const paint = () => {
      ticking = false;
      const y = window.scrollY;
      const on = desktop.matches && y < hero.offsetHeight * 1.2;
      layers.forEach((el) => {
        el.style.transform = on ? `translate3d(0, ${(y * parseFloat(el.dataset.parallax)).toFixed(1)}px, 0)` : '';
      });
    };
    const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(paint); } };
    window.addEventListener('scroll', req, { passive: true });
    desktop.addEventListener?.('change', req);
    paint();
  }

  const tw = $('[data-type]', hero);
  if (tw) {
    const text = tw.textContent.trim();
    if (!reduce) {
      tw.textContent = '';
      const sr = Object.assign(document.createElement('span'), { className: 'sr-only', textContent: text });
      const ghost = Object.assign(document.createElement('span'), { className: 'tw-ghost', textContent: text });
      const live = Object.assign(document.createElement('span'), { className: 'tw-live' });
      ghost.setAttribute('aria-hidden', 'true'); live.setAttribute('aria-hidden', 'true');
      tw.append(sr, ghost, live);
      tw.classList.add('is-typing');
      let i = 0;
      const step = () => {
        live.textContent = text.slice(0, ++i);
        if (i < text.length) setTimeout(step, text[i - 1] === '·' ? 140 : 34 + Math.random() * 30);
        else setTimeout(() => tw.classList.replace('is-typing', 'is-typed'), 900);
      };
      setTimeout(step, 650);
    }
  }

  /* ---------- S1·I3 Magnetic CTAs (fine pointers only; touch skips) ---------- */
  if (finePointer && !reduce) {
    const MAX = 6;
    const clamp = (v) => Math.max(-MAX, Math.min(MAX, v));
    document.addEventListener('pointermove', (e) => {
      const el = e.target.closest?.('[data-magnet]');
      if (!el || e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      const dx = clamp(((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * MAX);
      const dy = clamp(((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * MAX);
      el.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    }, { passive: true });
    $$('[data-magnet]').forEach((el) => {
      el.classList.add('is-magnet');
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- S2·I1 Reel carousel: lazy embeds behind posters, dots, arrows, keys ---------- */
  const strip = $('.reels');
  if (strip) {
    const reels = $$('.reel', strip);
    const load = (reel) => {
      const f = $('iframe[data-src]', reel);
      if (!f) return;
      f.addEventListener('load', () => reel.classList.add('is-loaded'), { once: true });
      f.src = f.dataset.src;
      f.removeAttribute('data-src');
    };
    if (hasIO) {
      const lo = new IntersectionObserver((entries) => entries.forEach((e) => {
        if (e.isIntersecting) { load(e.target); lo.unobserve(e.target); }
      }), { rootMargin: '300px 0px' });
      reels.forEach((r) => lo.observe(r));
    } else reels.forEach(load);

    const ctrl = $('.reels__ctrl');
    const dots = $$('.reels__dots button', ctrl);
    const current = () => {
      const left = strip.getBoundingClientRect().left;
      let best = 0, dist = Infinity;
      reels.forEach((r, i) => { const d = Math.abs(r.getBoundingClientRect().left - left); if (d < dist) { dist = d; best = i; } });
      return best;
    };
    const go = (i) => {
      i = Math.max(0, Math.min(reels.length - 1, i));
      const x = reels[i].getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft;
      strip.scrollTo({ left: x, behavior: reduce ? 'auto' : 'smooth' });
    };
    const sync = () => {
      const c = current();
      dots.forEach((d, i) => d.setAttribute('aria-current', i === c ? 'true' : 'false'));
      const [prev, next] = $$('.reels__arrow', ctrl);
      prev.disabled = strip.scrollLeft < 4;
      next.disabled = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 4;
    };
    const fit = () => {
      const overflow = strip.scrollWidth > strip.clientWidth + 4;
      ctrl.hidden = !overflow;
      strip.classList.toggle('is-carousel', overflow);
      if (overflow) strip.setAttribute('tabindex', '0'); else strip.removeAttribute('tabindex');
      sync();
    };
    dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
    $$('.reels__arrow', ctrl).forEach((b) => b.addEventListener('click', () => go(current() + Number(b.dataset.dir))));
    strip.addEventListener('keydown', (e) => {
      if (e.target !== strip) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(current() + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(current() - 1); }
    });
    let st; strip.addEventListener('scroll', () => { clearTimeout(st); st = setTimeout(sync, 60); }, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(strip); else window.addEventListener('resize', fit);
    fit();

    /* Instagram reports its embed height — size each iframe to it */
    window.addEventListener('message', (e) => {
      if (e.origin !== 'https://www.instagram.com') return;
      let d = e.data;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return; } }
      if (!d || d.type !== 'MEASURE' || !d.details || !d.details.height) return;
      const f = $$('.reel iframe', strip).find((fr) => fr.contentWindow === e.source);
      if (f) { f.style.height = Math.ceil(d.details.height) + 'px'; f.closest('.reel').classList.add('is-loaded'); }
    });
  }

  /* ---------- S2·I2 Lightbox: prev/next, swipe, Esc, focus trap, Ken Burns paused ---------- */
  const lb = $('#lightbox');
  const lbImg = $('#lb-img');
  const lbCount = $('#lb-count');
  const tiles = $$('.g');
  let idx = 0, lastFocus = null;
  const show = (i, dir = 0) => {
    idx = (i + tiles.length) % tiles.length;
    const t = tiles[idx], im = $('img', t);
    lbImg.classList.remove('is-shown');
    lbImg.style.setProperty('--from', dir * 40 + 'px');
    lbImg.onload = () => requestAnimationFrame(() => lbImg.classList.add('is-shown'));
    lbImg.src = t.dataset.full; lbImg.alt = im.alt;
    if (lbImg.complete) requestAnimationFrame(() => lbImg.classList.add('is-shown'));
    lbCount.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(tiles.length).padStart(2, '0')}`;
  };
  tiles.forEach((t, i) => {
    t.setAttribute('aria-label', 'Enlarge: ' + $('img', t).alt);
    t.addEventListener('click', () => {
      lastFocus = t; show(i);
      lb.showModal();
      root.classList.add('lb-open');
      $('#lb-close').focus();
    });
  });
  $('#lb-close').addEventListener('click', () => lb.close());
  $('#lb-prev').addEventListener('click', () => show(idx - 1, -1));
  $('#lb-next').addEventListener('click', () => show(idx + 1, 1));
  lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
  lb.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(idx - 1, -1);
    if (e.key === 'ArrowRight') show(idx + 1, 1);
    if (e.key === 'Tab') { // keep focus inside the viewer
      const f = $$('button', lb);
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!lb.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    }
  });
  let sx = null, sy = 0;
  lb.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { sx = e.clientX; sy = e.clientY; } });
  lb.addEventListener('pointerup', (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(idx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });
  lb.addEventListener('pointercancel', () => { sx = null; });
  lb.addEventListener('close', () => { root.classList.remove('lb-open'); if (lastFocus) lastFocus.focus(); });

  /* ---------- S2·I3 Sticky mix player (only when a mix URL is configured) ---------- */
  const mixUrl = ($('meta[name="criselvc-mix"]')?.content || '').trim();
  const mix = $('#mix');
  const embedFor = (u) => {
    try {
      const url = new URL(u);
      if (/(^|\.)soundcloud\.com$/.test(url.hostname)) return { h: 120, src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.href)}&color=%23ad1616&auto_play=true&hide_related=true&show_comments=false&show_reposts=false&show_teaser=false&visual=false` };
      if (/(^|\.)mixcloud\.com$/.test(url.hostname)) return { h: 60, src: `https://player-widget.mixcloud.com/widget/iframe/?hide_cover=1&mini=1&autoplay=1&feed=${encodeURIComponent(url.pathname)}` };
    } catch { /* not a URL */ }
    return null;
  };
  const embed = mixUrl && embedFor(mixUrl);
  if (mix && embed && sessionStorage.getItem('cvc-mix') !== 'closed') {
    const playBtn = $('#mix-play');
    const box = $('#mix-embed');
    mix.hidden = false;
    document.body.classList.add('has-mix');
    const reveal = () => mix.classList.toggle('is-up', window.scrollY > window.innerHeight * 0.6 || mix.classList.contains('is-playing'));
    window.addEventListener('scroll', reveal, { passive: true }); reveal();
    playBtn.addEventListener('click', () => {
      if (!box.firstChild) {
        const f = document.createElement('iframe');
        Object.assign(f, { src: embed.src, title: 'CriselVC mix player', height: embed.h, allow: 'autoplay; encrypted-media' });
        f.setAttribute('frameborder', '0');
        box.appendChild(f);
      }
      const open = !mix.classList.contains('is-open');
      mix.classList.toggle('is-open', open);
      mix.classList.add('is-playing');
      playBtn.setAttribute('aria-expanded', String(open));
      playBtn.textContent = open ? 'Hide player' : 'Show player';
    });
    $('#mix-close').addEventListener('click', () => {
      box.innerHTML = ''; mix.hidden = true; document.body.classList.remove('has-mix'); sessionStorage.setItem('cvc-mix', 'closed');
    });
  }

  /* ---------- S4·I2 Venue logo marquee (static grid for reduced motion) ---------- */
  const venues = $('.venues');
  if (venues && !reduce) {
    const wall = venues.closest('.logo-wall');
    const viewport = document.createElement('div');
    viewport.className = 'marquee';
    venues.before(viewport); viewport.appendChild(venues);
    $$('li', venues).forEach((li) => {
      const c = li.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      $$('img', c).forEach((im) => { im.alt = ''; });
      venues.appendChild(c);
    });
    wall.classList.add('is-marquee');
    const toggle = $('#marquee-toggle');
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      const paused = wall.classList.toggle('is-paused');
      toggle.setAttribute('aria-pressed', String(paused));
      toggle.textContent = paused ? 'Play' : 'Pause';
    });
  }

  /* ---------- S4·I3 Country counter + flag chips (EPK: twelve countries) ---------- */
  const countries = $('.countries');
  const big = countries && $('[data-count]', countries);
  if (big) {
    const target = Number(big.dataset.count);
    const flags = $$('.flags li', countries);
    if (flags.length !== target) console.warn(`Country count (${target}) does not match flags (${flags.length})`);
    flags.forEach((li, i) => li.style.setProperty('--i', i));
    const face = $('span', big);
    const word = face.textContent;
    const run = () => {
      if (reduce) return;
      const t0 = performance.now(), dur = 1300;
      big.classList.add('is-counting');
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        face.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3)))).padStart(2, '0');
        if (p < 1) requestAnimationFrame(tick);
        else setTimeout(() => { face.textContent = word; big.classList.replace('is-counting', 'is-counted'); }, 450);
      };
      requestAnimationFrame(tick);
    };
    if (hasIO && !reduce) {
      const co = new IntersectionObserver((es) => { if (es[0].isIntersecting) { co.disconnect(); run(); } }, { threshold: 0.4 });
      co.observe(countries);
    }
  }

  /* ---------- S3 Inquiry form: lanes, steps, quote hints, calendar, AJAX submit ---------- */
  const form = $('#inquiry');
  if (!form) return;
  const laneSets = $$('.lane-fields', form);

  function setLane(lane) {
    laneSets.forEach((fs) => {
      const on = fs.dataset.lane === lane;
      fs.hidden = !on;
      fs.querySelectorAll('input,select,textarea').forEach((el) => {
        if (el.hasAttribute('data-required')) el.required = on;
        if (!on) { if (el.type === 'checkbox') el.checked = false; else el.value = ''; }
      });
    });
    $('#err-lane').textContent = '';
    hint();
  }

  /* S3·I2 Live set guide — copy only, no prices. Edit freely once the EPK packages are confirmed. */
  const TIPS = {
    'Club night': 'Peak-time or a full journey set — read and rebuilt for the room in real time.',
    'Private event': 'Hospitality-led: groove-forward through arrival, building to a dance floor later in the night.',
    'Corporate event': 'A warm, unhurried build for networking that can lift into a proper floor once speeches are done.',
    'Wedding': 'Settles the room through dinner, then one continuous wave from first dance to close.',
    'Festival': 'Festival side-stage: rhythmic, physical peak with Afro and Latin percussion up front.',
    'Brand activation': 'Brand and nightlife activations: a tailored sound that carries the brand without feeling like a playlist.',
    'Other': 'Tell us about the room — every set is built around it.',
  };
  const CREATIVE = {
    'Half day': 'Half day suits a single content shoot or one appearance.',
    'Full day': 'Full day leaves room for content, styling changes and an appearance or short set.',
    'Multi-day': 'Multi-day engagements are scoped together with management before dates are held.',
    'Ongoing / retainer': 'Retainers are planned with management around touring dates.',
  };
  const hintBox = $('#quote-hint'), hintLen = $('#hint-len'), hintTip = $('#hint-tip');
  const mins = (v) => { const m = /^(\d{2}):(\d{2})/.exec(v || ''); return m ? +m[1] * 60 + +m[2] : null; };
  function hint() {
    if (!hintBox) return;
    const lane = form.querySelector('input[name="lane"]:checked')?.value;
    let len = '', tip = '';
    if (lane === 'Artist') {
      const s = mins(form.artist_set_start.value), e = mins(form.artist_set_end.value);
      if (s !== null && e !== null) {
        let d = e - s; if (d <= 0) d += 1440; // runs past midnight
        const h = Math.floor(d / 60), m = d % 60;
        len = `Set length: ${h ? h + ' h' : ''}${h && m ? ' ' : ''}${m ? m + ' min' : ''}` + (e <= s ? ' · past midnight' : '');
        tip = d < 90 ? 'A short slot works best as a focused, peak-time set.'
          : d <= 180 ? 'Room for the full arc — warm build, driving peak, progressive lift.'
          : d <= 360 ? 'A journey set: she opens by settling the room and guides it from arrival to peak to release.'
          : 'An extended booking — management will talk through pacing and breaks with you.';
      }
      const t = TIPS[form.artist_event_type.value];
      if (t) tip = tip ? `${t} ${tip}` : t;
    } else if (lane === 'Creative') {
      tip = CREATIVE[form.creative_duration.value] || '';
    } else if (lane === 'Trader') {
      if (form.trader_format.value) tip = 'Sessions are educational only. Share the audience level so the material can be pitched right.';
    }
    hintLen.textContent = len; hintLen.hidden = !len;
    hintTip.textContent = tip;
    const show = !!(len || tip);
    if (show !== !hintBox.hidden) { hintBox.hidden = !show; }
    if (show) { hintBox.classList.remove('is-pulse'); void hintBox.offsetWidth; hintBox.classList.add('is-pulse'); }
  }
  ['artist_event_type', 'artist_set_start', 'artist_set_end', 'creative_duration', 'trader_format'].forEach((n) => form[n]?.addEventListener('change', hint));

  $$('input[name="lane"]', form).forEach((r) => r.addEventListener('change', () => setLane(r.value)));
  const preset = form.querySelector('input[name="lane"]:checked');
  setLane(preset ? preset.value : 'Artist');

  /* S3·I1 Steps */
  const steps = $$('.step', form);
  const bar = $('.steps-bar', form);
  const status = $('#step-status');
  const names = ['Event', 'Date', 'Details'];
  let cur = 1;
  form.classList.add('is-stepped');
  bar.hidden = false;
  steps.forEach((s) => s.setAttribute('tabindex', '-1'));

  function goStep(n, focus = true) {
    cur = n;
    steps.forEach((s) => s.classList.toggle('is-active', Number(s.dataset.step) === n));
    $$('.steps-bar__list li', bar).forEach((li) => {
      const k = Number(li.dataset.step);
      li.classList.toggle('is-done', k < n);
      li.classList.toggle('is-current', k === n);
    });
    $('#steps-fill').style.transform = `scaleX(${n / steps.length})`;
    status.textContent = `Step ${n} of ${steps.length}: ${names[n - 1]}`;
    if (focus) {
      const s = steps[n - 1];
      s.focus({ preventScroll: true });
      const top = form.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.6) form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  }

  const dateInput = $('#event_date');
  function validStep(n) {
    const s = steps[n - 1];
    let ok = true;
    if (n === 1 && !form.querySelector('input[name="lane"]:checked')) { $('#err-lane').textContent = 'Choose an engagement type.'; ok = false; }
    if (n === 2 && !/^\d{4}-\d{2}-\d{2}$/.test(dateInput.value)) { $('#err-date').textContent = 'Choose a date.'; ok = false; }
    const fields = $$('input,select,textarea', s).filter((el) => el.type !== 'hidden' && !el.closest('[hidden]') && el.name !== 'bot-field');
    const bad = fields.filter((el) => !el.checkValidity());
    if (bad.length) ok = false;
    if (!ok) {
      s.classList.add('was-validated');
      if (bad[0]) { bad[0].focus(); bad[0].reportValidity(); }
      else if (n === 2) $('#cal-grid button[data-date]:not(:disabled)')?.focus();
    }
    return ok;
  }

  $$('.step-btn[data-go]', form).forEach((b) => b.addEventListener('click', () => {
    const to = Number(b.dataset.go);
    if (to > cur && !validStep(cur)) return;
    goStep(to);
  }));
  goStep(1, false);

  /* S4·I1 Availability calendar — GET /api/availability?month=YYYY-MM → { live, busy[] }, Asia/Dubai */
  const pad = (n) => String(n).padStart(2, '0');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date());
  const [ty, tm] = today.split('-').map(Number);
  const view = { y: ty, m: tm };
  const first = { y: ty, m: tm };
  const cache = {};
  const grid = $('#cal-grid');
  const note = $('#cal-note');
  const title = $('#cal-title');
  const prev = $('#cal-prev');
  const picked = $('#picked');
  const monthKey = (v) => `${v.y}-${pad(v.m)}`;
  const longDate = (iso, year) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' });

  async function fetchMonth(key) {
    if (cache[key]) return cache[key];
    try {
      const r = await fetch(`/api/availability?month=${key}`, { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      cache[key] = { live: j.live === true, busy: Array.isArray(j.busy) ? j.busy : [] };
    } catch (e) {
      cache[key] = { live: false, busy: [] };
    }
    return cache[key];
  }

  async function render() {
    const key = monthKey(view);
    title.textContent = new Date(Date.UTC(view.y, view.m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    prev.disabled = view.y === first.y && view.m === first.m;
    note.textContent = 'Checking availability…'; note.classList.remove('is-live');
    grid.classList.add('is-loading');
    const data = await fetchMonth(key);
    if (key !== monthKey(view)) return;
    grid.classList.remove('is-loading');
    const busy = new Set(data.busy);
    note.textContent = data.live ? 'Live calendar · struck-through dates are already booked.' : 'All dates subject to confirmation.';
    note.classList.toggle('is-live', data.live);

    grid.innerHTML = '';
    ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].forEach((d) => { const s = document.createElement('div'); s.className = 'dow'; s.textContent = d; s.setAttribute('aria-hidden', 'true'); grid.appendChild(s); });
    const startDow = (new Date(Date.UTC(view.y, view.m - 1, 1)).getUTCDay() + 6) % 7;
    const days = new Date(Date.UTC(view.y, view.m, 0)).getUTCDate();
    for (let i = 0; i < startDow; i++) grid.appendChild(document.createElement('div'));
    for (let d = 1; d <= days; d++) {
      const iso = `${key}-${pad(d)}`;
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = d; b.dataset.date = iso;
      b.style.setProperty('--d', (startDow + d) * 12 + 'ms');
      b.setAttribute('aria-label', longDate(iso));
      const isPast = iso < today;
      const isBusy = data.live && busy.has(iso);
      if (iso === today) b.classList.add('today');
      if (isPast) { b.disabled = true; b.classList.add('past'); }
      if (isBusy) { b.disabled = true; b.classList.add('busy'); b.setAttribute('aria-label', b.getAttribute('aria-label') + ', unavailable'); }
      b.setAttribute('aria-pressed', dateInput.value === iso ? 'true' : 'false');
      b.addEventListener('click', () => pick(iso));
      grid.appendChild(b);
    }
    if (dateInput.value && dateInput.value.startsWith(key) && data.live && busy.has(dateInput.value)) pick('');
  }

  function pick(iso) {
    dateInput.value = iso;
    grid.querySelectorAll('button[data-date]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.date === iso ? 'true' : 'false'));
    picked.textContent = iso ? longDate(iso, true) : 'No date chosen yet';
    picked.classList.toggle('empty', !iso);
    if (iso) { picked.classList.remove('is-pop'); void picked.offsetWidth; picked.classList.add('is-pop'); }
    $('#err-date').textContent = '';
  }

  prev.addEventListener('click', () => { if (--view.m < 1) { view.m = 12; view.y--; } render(); });
  $('#cal-next').addEventListener('click', () => { if (++view.m > 12) { view.m = 1; view.y++; } render(); });
  render();

  /* S3·I3 Submit: AJAX to Netlify Forms → animated thank-you card. Native POST stays as fallback. */
  const nativeSubmit = () => HTMLFormElement.prototype.submit.call(form);
  form.addEventListener('submit', async (e) => {
    if (!window.fetch) return; // let the browser POST normally
    e.preventDefault();
    const errForm = $('#err-form');
    errForm.textContent = '';
    for (let n = 1; n <= steps.length; n++) {
      if (!validStep(n)) {
        if (n !== cur) { goStep(n); validStep(n); }
        errForm.textContent = 'Some details are missing. Check the highlighted fields.';
        return;
      }
    }
    const btn = $('#submit');
    btn.disabled = true; btn.firstChild.textContent = 'Sending… ';
    let r;
    try {
      const body = new URLSearchParams(new FormData(form)).toString();
      r = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    } catch (err) {
      btn.disabled = false; btn.firstChild.textContent = 'Send inquiry ';
      errForm.textContent = 'The inquiry did not send. Check your connection and try again.';
      return;
    }
    if (!r.ok) { nativeSubmit(); return; }
    success();
  });

  function success() {
    const sent = $('#sent');
    $('#sent-date').textContent = dateInput.value ? `Requested date · ${longDate(dateInput.value, true)}` : '';
    form.hidden = true;
    sent.hidden = false;
    requestAnimationFrame(() => sent.classList.add('is-in'));
    sent.focus({ preventScroll: true });
    sent.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    if (!reduce) confetti($('#confetti'));
  }

  function confetti(canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.scale(dpr, dpr);
    const colors = ['#ad1616', '#c42020', '#ad1616', '#adb3bb', '#ffffff'];
    const parts = Array.from({ length: 140 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 80, y: H * 0.35,
      vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 11 - 4,
      w: 4 + Math.random() * 6, h: 6 + Math.random() * 10,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      c: colors[(Math.random() * colors.length) | 0],
    }));
    const t0 = performance.now();
    const frame = (t) => {
      ctx.clearRect(0, 0, W, H);
      const age = t - t0;
      parts.forEach((p) => {
        p.vy += 0.28; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - age / 3200);
        ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
        ctx.restore();
      });
      if (age < 3300) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
    };
    requestAnimationFrame(frame);
  }
})();
