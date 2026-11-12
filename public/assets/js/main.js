/* CriselVC · Bookings — design preview interactions */
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Nav: solid after scroll, current section ---------- */
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('is-solid', window.scrollY > 40);
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

  const links = [...document.querySelectorAll('.nav__links a[href^="#"]')];
  const targets = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + e.target.id));
        links.forEach((a) => { if (a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'true'); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.forEach((t) => spy.observe(t));
  }

  /* ---------- Mobile menu ---------- */
  const menu = document.getElementById('menu');
  const openBtn = document.getElementById('menu-open');
  const closeBtn = document.getElementById('menu-close');
  const openMenu = () => { menu.hidden = false; requestAnimationFrame(() => menu.classList.add('is-open')); openBtn.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; closeBtn.focus(); };
  const closeMenu = () => { menu.classList.remove('is-open'); openBtn.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; setTimeout(() => { menu.hidden = true; }, reduce ? 0 : 300); };
  openBtn.addEventListener('click', openMenu);
  closeBtn.addEventListener('click', () => { closeMenu(); openBtn.focus(); });
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { closeMenu(); openBtn.focus(); } });

  /* ---------- Reveal ---------- */
  const rv = document.querySelectorAll('.rv');
  if (reduce || !('IntersectionObserver' in window)) rv.forEach((el) => el.classList.add('in'));
  else {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    rv.forEach((el) => io.observe(el));
  }

  /* ---------- Lightbox ---------- */
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lb-img');
  const lbCount = document.getElementById('lb-count');
  const tiles = [...document.querySelectorAll('.g')];
  let idx = 0, lastFocus = null;
  const show = (i) => {
    idx = (i + tiles.length) % tiles.length;
    const t = tiles[idx], im = t.querySelector('img');
    lbImg.src = t.dataset.full; lbImg.alt = im.alt;
    lbCount.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(tiles.length).padStart(2, '0')}`;
  };
  tiles.forEach((t, i) => {
    t.setAttribute('aria-label', 'Enlarge: ' + t.querySelector('img').alt);
    t.addEventListener('click', () => { lastFocus = t; show(i); lb.showModal(); });
  });
  document.getElementById('lb-close').addEventListener('click', () => lb.close());
  document.getElementById('lb-prev').addEventListener('click', () => show(idx - 1));
  document.getElementById('lb-next').addEventListener('click', () => show(idx + 1));
  lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
  lb.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') show(idx - 1); if (e.key === 'ArrowRight') show(idx + 1); });
  lb.addEventListener('close', () => { if (lastFocus) lastFocus.focus(); });

  /* ---------- Form (ported from the bookings draft; names and behaviour unchanged) ---------- */
  const form = document.getElementById('inquiry');
  if (!form) return;
  const laneInputs = form.querySelectorAll('input[name="lane"]');
  const laneSets = form.querySelectorAll('.lane-fields');

  function setLane(lane) {
    laneSets.forEach((fs) => {
      const on = fs.dataset.lane === lane;
      fs.hidden = !on;
      fs.querySelectorAll('input,select,textarea').forEach((el) => {
        if (el.hasAttribute('data-required')) el.required = on;
        if (!on) { if (el.type === 'checkbox') el.checked = false; else el.value = ''; }
      });
    });
    document.getElementById('err-lane').textContent = '';
  }
  laneInputs.forEach((r) => r.addEventListener('change', () => setLane(r.value)));
  const preset = form.querySelector('input[name="lane"]:checked');
  setLane(preset ? preset.value : 'Artist');

  /* Availability calendar — GET /api/availability?month=YYYY-MM → { live, busy[] }, Asia/Dubai */
  const pad = (n) => String(n).padStart(2, '0');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date());
  const [ty, tm] = today.split('-').map(Number);
  const view = { y: ty, m: tm };
  const first = { y: ty, m: tm };
  const cache = {};
  const input = document.getElementById('event_date');
  const grid = document.getElementById('cal-grid');
  const note = document.getElementById('cal-note');
  const title = document.getElementById('cal-title');
  const prev = document.getElementById('cal-prev');
  const picked = document.getElementById('picked');
  const monthKey = (v) => `${v.y}-${pad(v.m)}`;

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
    const data = await fetchMonth(key);
    if (key !== monthKey(view)) return;
    const busy = new Set(data.busy);
    note.textContent = data.live ? 'Struck-through dates are already booked.' : 'All dates subject to confirmation.';
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
      b.setAttribute('aria-label', new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }));
      const isPast = iso < today;
      const isBusy = data.live && busy.has(iso);
      if (iso === today) b.classList.add('today');
      if (isPast) { b.disabled = true; b.classList.add('past'); }
      if (isBusy) { b.disabled = true; b.classList.add('busy'); b.setAttribute('aria-label', b.getAttribute('aria-label') + ', unavailable'); }
      b.setAttribute('aria-pressed', input.value === iso ? 'true' : 'false');
      b.addEventListener('click', () => pick(iso));
      grid.appendChild(b);
    }
    if (input.value && input.value.startsWith(key) && data.live && busy.has(input.value)) pick('');
  }

  function pick(iso) {
    input.value = iso;
    grid.querySelectorAll('button[data-date]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.date === iso ? 'true' : 'false'));
    picked.textContent = iso
      ? new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
      : 'No date chosen yet';
    picked.classList.toggle('empty', !iso);
    document.getElementById('err-date').textContent = '';
  }

  prev.addEventListener('click', () => { if (--view.m < 1) { view.m = 12; view.y--; } render(); });
  document.getElementById('cal-next').addEventListener('click', () => { if (++view.m > 12) { view.m = 1; view.y++; } render(); });
  render();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errForm = document.getElementById('err-form');
    errForm.textContent = '';
    form.classList.add('was-validated');
    let ok = true;
    if (!form.querySelector('input[name="lane"]:checked')) { document.getElementById('err-lane').textContent = 'Choose an engagement type.'; ok = false; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.value)) { document.getElementById('err-date').textContent = 'Choose a date.'; ok = false; }
    if (!form.checkValidity()) ok = false;
    if (!ok) {
      form.reportValidity();
      errForm.textContent = 'Some details are missing. Check the highlighted fields.';
      return;
    }
    const btn = document.getElementById('submit');
    btn.disabled = true; btn.firstChild.textContent = 'Sending… ';
    try {
      const body = new URLSearchParams(new FormData(form)).toString();
      const r = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      if (!r.ok) throw new Error(r.status);
      window.location.href = '/success.html';
    } catch (err) {
      btn.disabled = false; btn.firstChild.textContent = 'Send inquiry ';
      errForm.textContent = 'The inquiry did not send. Check your connection and try again.';
    }
  });
})();
