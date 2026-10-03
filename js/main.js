(() => {
  'use strict';

  /* ---------- Reveal on scroll ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      e.target.querySelectorAll('.count').forEach(countUp);
      if (e.target.classList.contains('count')) countUp(e.target);
      io.unobserve(e.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  function countUp(el) {
    if (el.dataset.done) return;
    el.dataset.done = '1';
    const to = Number(el.dataset.to);
    const dur = 1200;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * eased).toLocaleString('ja-JP');
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- HUD: timecode + scroll progress + active chapter ---------- */
  const hudTime = document.getElementById('hudTime');
  const hudProgress = document.getElementById('hudProgress');
  const start = Date.now();
  const pad = (n) => String(n).padStart(2, '0');
  setInterval(() => {
    const s = Math.floor((Date.now() - start) / 1000);
    hudTime.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  }, 1000);

  const navLinks = [...document.querySelectorAll('.hud__nav a')];
  const chapters = navLinks.map((a) => document.querySelector(a.getAttribute('href')));
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    hudProgress.textContent = String(Math.round((scrollY / max) * 100) || 0).padStart(3, '0');
    let current = -1;
    chapters.forEach((c, i) => { if (c && c.getBoundingClientRect().top < innerHeight * 0.4) current = i; });
    navLinks.forEach((a, i) => a.classList.toggle('is-active', i === current));
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Hero AF box: hunts then locks ---------- */
  const af = document.getElementById('afBox');
  const spots = [[62, 30], [24, 58], [74, 62], [44, 22], [58, 48]];
  let k = 0;
  setInterval(() => {
    af.classList.remove('lock');
    k = (k + 1) % spots.length;
    af.style.left = spots[k][0] + '%';
    af.style.top = spots[k][1] + '%';
    setTimeout(() => af.classList.add('lock'), 950);
  }, 2600);
  setTimeout(() => af.classList.add('lock'), 600);

  /* ---------- Footnotes: map number -> source entry ---------- */
  const sourceMap = {};
  document.querySelectorAll('.source-list li').forEach((li) => {
    const label = li.querySelector('b').textContent;
    label.split(',').forEach((part) => {
      const range = part.trim().split(/[–-]/).map(Number);
      const [a, b = a] = range;
      for (let n = a; n <= b; n++) sourceMap[n] = li;
    });
  });
  document.querySelectorAll('sup a').forEach((a) => {
    const n = Number(a.textContent);
    const li = sourceMap[n];
    if (!li) return;
    a.href = '#' + li.id;
    a.title = li.querySelector('a').textContent;
    a.addEventListener('click', () => {
      li.classList.add('flash');
      setTimeout(() => li.classList.remove('flash'), 1600);
    });
  });

  /* ---------- Capacity simulator ---------- */
  const USABLE_GB = 7450; // 8TB (decimal) ≈ 7.45 TiB usable
  const $ = (id) => document.getElementById(id);
  const ratio = $('ratio'), raw = $('rawSize'), br = $('bitrate');
  const calc = () => {
    const p = Number(ratio.value);
    ratio.style.setProperty('--p', p + '%');
    $('ratioPhotoLabel').textContent = p;
    $('ratioVideoLabel').textContent = 100 - p;

    const photoMB = USABLE_GB * 1024 * (p / 100);
    const videoGB = USABLE_GB * ((100 - p) / 100);
    const photos = Math.floor(photoMB / Number(raw.value));
    const gbPerHour = (Number(br.value) / 8) * 3600 / 1024; // Mbps -> GB/h
    const hours = Math.floor(videoGB / gbPerHour);
    $('outPhotos').textContent = photos.toLocaleString('ja-JP');
    $('outVideo').textContent = hours.toLocaleString('ja-JP');
  };
  [ratio, raw, br].forEach((el) => el.addEventListener('input', calc));
  calc();
})();
