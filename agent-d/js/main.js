(() => {
  'use strict';

  // Header / to-top
  const header = document.querySelector('.site-header');
  const toTop = document.querySelector('.to-top');
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('scrolled', y > 20);
    toTop.classList.toggle('show', y > 600);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // Mobile nav
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('nav');
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }));

  // Reveal on scroll (+ bars inside .spec)
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // Active nav link
  const sections = [...document.querySelectorAll('main section[id]')];
  const navLinks = [...nav.querySelectorAll('a')];
  const navIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id));
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => navIO.observe(s));

  // Count-up stats
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = Number(el.dataset.count);
    const start = performance.now();
    const step = now => {
      const p = Math.min((now - start) / 1200, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  // Capacity calculator
  const CAPACITY_GB = 8e12 / 1024 ** 3; // ≈ 7450 GiB (OS表示上の実効容量)
  const $ = id => document.getElementById(id);
  const fmtGB = gb => gb >= 1024 ? (gb / 1024).toFixed(2) + ' TB' : gb.toFixed(1) + ' GB';
  const RING = 2 * Math.PI * 52;

  function calc() {
    const rawMB = Number($('rawType').value);
    const photos = Number($('photos').value);
    const vGBh = Number($('videoType').value);
    const hours = Number($('video').value);
    $('photosOut').textContent = photos.toLocaleString();
    $('videoOut').textContent = hours;

    const monthly = (photos * rawMB) / 1024 + hours * vGBh;
    $('monthly').textContent = fmtGB(monthly);
    $('yearly').textContent = fmtGB(monthly * 12);
    $('maxPhotos').textContent = '約' + Math.floor(CAPACITY_GB * 1024 / rawMB).toLocaleString() + '枚';
    $('maxVideo').textContent = '約' + Math.floor(CAPACITY_GB / vGBh).toLocaleString() + '時間';

    let label, ratio;
    if (monthly <= 0) { label = '∞'; ratio = 0; }
    else {
      const months = CAPACITY_GB / monthly;
      if (months < 1) label = '1か月未満';
      else if (months < 12) label = `約${Math.round(months)}か月`;
      else if (months > 1200) label = '100年以上';
      else label = `約${(months / 12).toFixed(1)}年`;
      // 高校3年間(36か月)で使う割合をリングに表示
      ratio = Math.min(36 / months, 1);
    }
    $('years').textContent = label;
    $('ringFg').style.strokeDashoffset = RING * (1 - ratio);
  }
  ['rawType', 'photos', 'videoType', 'video'].forEach(id => $(id).addEventListener('input', calc));
  calc();

  // Tabs
  const tabBtns = document.querySelectorAll('.tab-buttons button');
  tabBtns.forEach(btn => btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === btn.dataset.tab));
  }));

  // Backup checklist (localStorage)
  const items = [
    '撮影後すぐにPCへデータを取り込む',
    'バックアップ完了までメモリーカードを消さない',
    'WD Blue 8TBにフォルダ分け（年/月/イベント）して保管',
    '外付けHDD/SSDへ定期的に差分バックアップ',
    'お気に入りのJPEGをクラウドにアップロード',
    '重要データは暗号化USBにもコピー（パスワード保護）',
    'S.M.A.R.T情報でHDDの健康状態をチェック',
    '部活PCなど別の場所にもコピー（オフサイト保管）'
  ];
  const KEY = 'a7iv-backup-checklist';
  let state;
  try { state = JSON.parse(localStorage.getItem(KEY)) || []; } catch { state = []; }
  const list = $('checklist');
  items.forEach((text, i) => {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!state[i];
    const span = document.createElement('span');
    span.textContent = text;
    label.append(cb, span);
    list.append(label);
    cb.addEventListener('change', () => {
      state[i] = cb.checked;
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
      updateProgress();
    });
  });
  function updateProgress() {
    const done = items.filter((_, i) => state[i]).length;
    $('checkBar').style.width = (done / items.length * 100) + '%';
    $('checkMsg').textContent = done === items.length
      ? '🎉 完璧！あなたのデータは3-2-1ルールでしっかり守られています。'
      : `${done} / ${items.length} 完了`;
  }
  updateProgress();
})();
