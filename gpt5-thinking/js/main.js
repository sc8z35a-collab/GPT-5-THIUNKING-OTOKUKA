/* =========================================================
   THINK / VALUE — UI & motion (GSAP + ScrollTrigger + Lenis)
   ========================================================= */
(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined';
  if (hasGSAP && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ---------- text splitting ---------- */
  function splitChars(el) {
    const txt = el.textContent; el.textContent = '';
    for (const ch of txt) {
      const s = document.createElement('span'); s.className = 'char';
      s.textContent = ch === ' ' ? '\u00a0' : ch; el.appendChild(s);
    }
  }
  // Japanese-aware chunking: split on punctuation / brackets so lines wrap nicely
  function splitWords(el) {
    const txt = el.textContent; el.textContent = '';
    const parts = txt.match(/[^：・、。（）「」“”]+[：・、。（）「」“”]*|[：・、。（）「」“”]+/g) || [txt];
    parts.forEach(p => {
      const w = document.createElement('span'); w.className = 'w';
      const i = document.createElement('span'); i.textContent = p;
      w.appendChild(i); el.appendChild(w);
    });
  }
  $$('.split').forEach(splitChars);
  $$('.split-lines').forEach(splitWords);

  /* ---------- loader ---------- */
  const loader = $('#loader'), loaderNum = $('#loaderNum');
  let prog = 0, webglOk = !!window.__webglReady, fontsOk = false;
  addEventListener('webgl:ready', () => { webglOk = true; });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { fontsOk = true; });
  const started = performance.now();
  (function loop() {
    const ready = (webglOk && fontsOk) || performance.now() - started > 6000;
    prog += ((ready ? 100 : 86) - prog) * (ready ? 0.12 : 0.03);
    loaderNum.textContent = String(Math.floor(prog)).padStart(3, '0');
    if (ready && prog > 99.4) { loaderNum.textContent = '100'; setTimeout(intro, 200); return; }
    requestAnimationFrame(loop);
  })();

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  if (window.Lenis && !reduced) {
    lenis = new Lenis({ duration: 1.25, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    if (hasGSAP) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })();
    }
    lenis.stop();
  }
  const scrollToEl = el => lenis ? lenis.scrollTo(el, { offset: -20, duration: 1.6 }) : el.scrollIntoView({ behavior: 'smooth' });
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href'); const el = id === '#top' ? document.body : $(id);
    if (!el) return; e.preventDefault(); closeMenu(); scrollToEl(el);
  }));

  /* ---------- intro animation ---------- */
  function intro() {
    loader.classList.add('is-done'); document.body.classList.remove('is-loading');
    lenis && lenis.start();
    if (!hasGSAP) { $$('.reveal').forEach(e => { e.style.opacity = 1; e.style.transform = 'none'; e.classList.add('is-in'); }); return; }
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.from('.hero__meta span', { y: 20, opacity: 0, stagger: .08, duration: 1 })
      .from('.hero__l1 .char', { yPercent: 120, rotateX: -90, opacity: 0, stagger: .05, duration: 1.4 }, '-=.7')
      .from('.hero__l2 .char', { yPercent: 120, rotateX: -90, opacity: 0, stagger: .04, duration: 1.4 }, '-=1.15')
      .from('.hero__l3 .char, .hero__l3 .bar', { y: 60, opacity: 0, stagger: .05, duration: 1.2 }, '-=1.1')
      .from('.hero__badge', { scale: .8, opacity: 0, duration: 1 }, '-=.8')
      .from('.hero__sub .w > span', { yPercent: 110, stagger: .03, duration: 1 }, '-=.8')
      .from('.hero__equation > *', { y: 30, opacity: 0, rotateX: -60, stagger: .08, duration: 1 }, '-=.8')
      .from('.scroll-cue', { opacity: 0, duration: 1 }, '-=.6')
      .from('.hud', { yPercent: -100, opacity: 0, duration: 1.2 }, 0.2);
    setupScroll();
  }

  /* ---------- scroll-driven ---------- */
  const sections = $$('[data-scene]');
  const rail = $('#rail');
  sections.forEach((s, i) => {
    const li = document.createElement('li'); li.title = s.dataset.name;
    li.addEventListener('click', () => scrollToEl(s)); li.style.pointerEvents = 'auto'; li.style.cursor = 'pointer';
    rail.appendChild(li);
  });
  rail.parentElement.style.pointerEvents = 'auto';
  const hudIdx = $('#hudIdx'), hudName = $('#hudName'), hudPct = $('#hudPct'), bar = $('#progressBar');

  function setActive(i) {
    const s = sections[i]; if (!s) return;
    $$('li', rail).forEach((l, k) => l.classList.toggle('is-active', k === i));
    hudIdx.textContent = String(i).padStart(2, '0');
    hudName.textContent = s.dataset.name;
    dispatchEvent(new CustomEvent('scene:change', { detail: { index: +s.dataset.scene } }));
  }

  function setupScroll() {
    if (!hasGSAP) return;
    // progress
    ScrollTrigger.create({
      start: 0, end: 'max', onUpdate: self => {
        bar.style.transform = `scaleX(${self.progress})`;
        hudPct.textContent = String(Math.round(self.progress * 100)).padStart(3, '0');
      }
    });
    // chapter activation → 3D scene
    sections.forEach((s, i) => ScrollTrigger.create({
      trigger: s, start: 'top 55%', end: 'bottom 55%',
      onEnter: () => setActive(i), onEnterBack: () => setActive(i)
    }));
    // chapter titles
    $$('.ch-head').forEach(h => {
      gsap.from($$('.w > span', h), { yPercent: 115, rotate: 4, stagger: .035, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 82%' } });
      gsap.from($('.ch-num', h), { x: -40, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 85%' } });
      const num = $('.ch-num', h);
      gsap.fromTo(num, { '--py': '80px' }, { '--py': '-80px', ease: 'none', scrollTrigger: { trigger: h, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    // reveals
    $$('.reveal').forEach(el => {
      gsap.to(el, {
        opacity: 1, y: 0, duration: 1.4, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 85%', onEnter: () => el.classList.add('is-in') }
      });
    });
    // hero parallax out
    gsap.to('.hero__title', { yPercent: -30, opacity: .15, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    // marquee skew with velocity
    const track = $('.marquee__track');
    ScrollTrigger.create({ onUpdate: self => gsap.to(track, { skewX: gsap.utils.clamp(-12, 12, self.getVelocity() / -200), duration: .4, overwrite: true }) });
    // formula explode-in
    gsap.from('.formula > *', { scale: 0, rotateY: 120, opacity: 0, stagger: .12, duration: 1.6, ease: 'elastic.out(1,.6)', scrollTrigger: { trigger: '.formula', start: 'top 80%' } });
    // verdict
    gsap.from('.vb-cond', { letterSpacing: '1em', opacity: 0, duration: 2, ease: 'expo.out', scrollTrigger: { trigger: '.verdict-big', start: 'top 75%' } });
    gsap.from('.vb-yes', { scale: .3, rotateX: 80, opacity: 0, duration: 2.2, ease: 'expo.out', scrollTrigger: { trigger: '.verdict-big', start: 'top 70%' } });
    gsap.from('.final-quote p', { y: 80, opacity: 0, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: '.final-quote', start: 'top 80%' } });
    // cards fan-in
    gsap.from('.card3d', { y: 120, rotateX: -40, opacity: 0, stagger: .15, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: '.cards3d', start: 'top 80%', onEnter: () => $('.cards3d').classList.add('is-in') } });
    // trigger widget init when visible
    ScrollTrigger.create({ trigger: '#ch2 .notebook', start: 'top 75%', once: true, onEnter: () => playDraft() });
    ScrollTrigger.refresh();
  }

  /* ---------- custom cursor + magnetic ---------- */
  const cur = $('#cursor'), dot = $('#cursorDot');
  if (matchMedia('(hover:hover)').matches && hasGSAP) {
    const xTo = gsap.quickTo(cur, 'x', { duration: .5, ease: 'power3' }), yTo = gsap.quickTo(cur, 'y', { duration: .5, ease: 'power3' });
    addEventListener('pointermove', e => { xTo(e.clientX); yTo(e.clientY); dot.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; });
    document.addEventListener('pointerover', e => { if (e.target.closest('a,button,input,.tier,.card3d')) cur.classList.add('is-hover'); });
    document.addEventListener('pointerout', e => { if (e.target.closest('a,button,input,.tier,.card3d')) cur.classList.remove('is-hover'); });
    $$('[data-magnetic]').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * .35, y: (e.clientY - r.top - r.height / 2) * .35, duration: .6, ease: 'power3' });
      });
      el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: .9, ease: 'elastic.out(1,.4)' }));
    });
  }

  /* ---------- 3D tilt ---------- */
  if (matchMedia('(hover:hover)').matches && !reduced) {
    $$('[data-tilt]').forEach(el => {
      if (el.classList.contains('card3d')) return; // cards flip instead
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', px * 100 + '%'); el.style.setProperty('--my', py * 100 + '%');
        el.style.transform = `perspective(1000px) rotateY(${(px - .5) * 8}deg) rotateX(${(.5 - py) * 8}deg)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transition = 'transform .9s cubic-bezier(.16,1,.3,1)'; el.style.transform = ''; setTimeout(() => el.style.transition = '', 900); });
    });
  }
  $$('.card3d').forEach(c => c.addEventListener('click', () => c.classList.toggle('is-flipped')));

  /* ---------- menu ---------- */
  const menuBtn = $('#menuBtn'), toc = $('#toc');
  $$('.toc li').forEach((li, i) => li.firstElementChild.style.setProperty('--i', i));
  function closeMenu() { toc.classList.remove('is-open'); menuBtn.setAttribute('aria-expanded', 'false'); lenis && lenis.start(); }
  menuBtn.addEventListener('click', () => {
    const open = !toc.classList.contains('is-open');
    toc.classList.toggle('is-open', open); menuBtn.setAttribute('aria-expanded', String(open));
    if (lenis) open ? lenis.stop() : lenis.start();
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  /* ---------- range fill helper ---------- */
  const fill = r => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min)) * 100 + '%');
  $$('input[type=range]').forEach(r => { fill(r); r.addEventListener('input', () => fill(r)); });

  /* =========================================================
     WIDGETS
     ========================================================= */

  /* INTRO: COST ⇄ BENEFIT balance */
  (() => {
    const beam = $('#beam'), cs = $('#costStack'), bs = $('#benStack');
    const chips = $$('.balance .chip');
    function update() {
      cs.innerHTML = ''; bs.innerHTML = '';
      let c = 0, b = 0;
      chips.forEach(ch => {
        if (!ch.classList.contains('is-on')) return;
        const i = document.createElement('i'); i.textContent = ch.textContent;
        if (ch.dataset.side === 'cost') { cs.appendChild(i); c++; } else { bs.appendChild(i); b++; }
      });
      const ang = Math.max(-16, Math.min(16, (b - c) * 4));
      beam.style.transform = `rotate(${ang}deg)`;
      [...cs.children, ...bs.children].forEach(el => el.style.transform = `rotate(${-ang}deg)`);
    }
    chips.forEach(ch => ch.addEventListener('click', () => { ch.classList.toggle('is-on'); update(); }));
    // default: a few on each side
    [0, 1, 4, 5, 6].forEach(i => chips[i] && chips[i].classList.add('is-on'));
    update();
  })();

  /* CH1: AUTO router */
  (() => {
    const btns = $$('#routerQ .qbtn'), packet = $('#packet');
    const pf = $('#pathFast'), pt = $('#pathThink');
    const rRoute = $('#rRoute'), rDelib = $('#rDelib'), rLat = $('#rLat');
    let raf;
    function run(route) {
      const path = route === 'fast' ? pf : pt;
      pf.classList.toggle('is-live', route === 'fast'); pt.classList.toggle('is-live', route === 'think');
      rRoute.textContent = route === 'fast' ? 'INSTANT/FAST' : 'THINKING';
      rRoute.style.color = route === 'fast' ? 'var(--fast)' : 'var(--think2)';
      rDelib.style.width = route === 'fast' ? '22%' : '92%';
      rLat.style.width = route === 'fast' ? '18%' : '78%';
      const len = path.getTotalLength(), dur = route === 'fast' ? 900 : 2600;
      cancelAnimationFrame(raf);
      const t0 = performance.now();
      (function step(now) {
        let p = ((now - t0) % (dur + 500)) / dur; p = Math.min(p, 1);
        const e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        const pt2 = path.getPointAtLength(e * len);
        packet.setAttribute('cx', pt2.x); packet.setAttribute('cy', pt2.y);
        packet.setAttribute('fill', route === 'fast' ? '#5ef2ff' : '#ff5ec8');
        raf = requestAnimationFrame(step);
      })(t0);
    }
    btns.forEach(b => b.addEventListener('click', () => { btns.forEach(x => x.classList.toggle('is-active', x === b)); run(b.dataset.route); }));
    run('fast');
  })();

  /* CH2: draft notebook + TEST-TIME COMPUTE */
  const draftItems = $$('#draftLines li');
  const finalOut = $('#finalOut'), ttc = $('#ttc');
  const mDepth = $('#mDepth'), mWait = $('#mWait'), ttMode = $('#ttMode');
  function updateTTC() {
    const v = +ttc.value;
    const visible = Math.round(v / 100 * draftItems.length);
    draftItems.forEach((li, i) => li.classList.toggle('on', i < visible));
    mDepth.style.width = (8 + v * .9) + '%';
    mWait.style.width = (6 + v * .88) + '%';
    if (v < 34) { ttMode.textContent = '速いけど浅い'; ttMode.style.color = 'var(--fast)'; finalOut.textContent = '清書だけを見る（下書きの段階でのミスに気づきにくい）'; }
    else if (v < 67) { ttMode.textContent = '時間＝推論パワー'; ttMode.style.color = 'var(--gold)'; finalOut.textContent = '下書きで段階的に分解しつつ清書へ'; }
    else { ttMode.textContent = '遅いけど深い'; ttMode.style.color = 'var(--think2)'; finalOut.textContent = '下書きの段階でミスに気づき、根拠を整えて清書する。難問ほどメリットが効く'; }
    dispatchEvent(new CustomEvent('scene:think', { detail: { value: v / 100 } }));
  }
  ttc.addEventListener('input', updateTTC);
  updateTTC();
  function playDraft() {
    if (!hasGSAP || reduced) return;
    const o = { v: +ttc.value };
    gsap.to(o, { v: 100, duration: 3, ease: 'power2.inOut', onUpdate: () => { ttc.value = o.v; fill(ttc); updateTTC(); } });
  }
  // reset think boost when leaving ch2
  addEventListener('scene:change', e => { if (e.detail.index !== 3) dispatchEvent(new CustomEvent('scene:think', { detail: { value: 0 } })); else updateTTC(); });

  /* CH3: orbit items placement + safety toggle */
  (() => {
    const items = $$('.orb-item'), R = 150;
    items.forEach((it, i) => {
      const a = i / items.length * Math.PI * 2;
      it.style.transform = `translate(-50%,-50%) translate(${Math.cos(a) * R}px,${Math.sin(a) * R}px) rotateZ(${-0}deg) rotateX(-68deg)`;
      it.dataset.a = a;
    });
    // counter-rotate labels so they always face the viewer
    const ring = $('.orbit__ring'); const t0 = performance.now();
    (function spin(now) {
      const deg = ((now - t0) / 18000 * 360) % 360;
      items.forEach(it => {
        const a = +it.dataset.a;
        it.style.transform = `translate(-50%,-50%) translate(${Math.cos(a) * R}px,${Math.sin(a) * R}px) rotateZ(${-deg}deg) rotateX(-68deg)`;
      });
      requestAnimationFrame(spin);
    })(t0);
    void ring;

    const out = $('#safeOut'), btns = $$('#safeSeg button');
    const txt = {
      hard: '「ただ断る（HARD REFUSAL）」だけの方針。',
      safe: 'ポリシーの範囲内で最大限役に立つ方向。有害性（HARMFULNESS）の低減と有用性（HELPFULNESS）の両立が目標。'
    };
    const set = v => { btns.forEach(b => b.classList.toggle('is-active', b.dataset.v === v)); out.textContent = txt[v]; };
    btns.forEach(b => b.addEventListener('click', () => set(b.dataset.v)));
    set('safe');
  })();

  /* CH4: tiers */
  (() => {
    const out = $('#tierOut');
    $$('.tier').forEach(t => {
      const show = () => { $$('.tier').forEach(x => x.classList.toggle('is-hot', x === t)); out.textContent = `${t.dataset.tier} — ${t.dataset.desc}`; };
      t.addEventListener('pointerenter', show); t.addEventListener('click', show);
    });
  })();

  /* CH5: quadrant */
  (() => {
    const dot = $('#quadDot'), out = $('#moodOut'), btns = $$('#moodSeg button');
    const q1 = $('.q1'), q2 = $('.q2');
    const states = {
      hard: { l: '74%', t: '26%', hl: q2, txt: '難問の安定解決に価値を置く局面では、“考えてから話す”理詰め寄り（LOGIC‑HEAVY）なテンポがプラスに働く。' },
      chat: { l: '26%', t: '26%', hl: q1, txt: '雑談の軽さを求める場面では、コスト（待ち時間）＞ベネフィットと映ることもある。性能は高いのに印象は低い。' }
    };
    const set = v => {
      const s = states[v]; dot.style.left = s.l; dot.style.top = s.t; out.textContent = s.txt;
      $$('.q').forEach(q => q.classList.toggle('is-hl', q === s.hl));
      btns.forEach(b => b.classList.toggle('is-active', b.dataset.v === v));
    };
    btns.forEach(b => b.addEventListener('click', () => set(b.dataset.v)));
    set('hard');
  })();

  /* CH7: value calculator */
  (() => {
    const sL = $('#sLen'), sD = $('#sDif'), sT = $('#sTol');
    const oL = $('#oLen'), oD = $('#oDif'), oT = $('#oTol');
    const arc = $('#gArc'), needle = $('#gNeedle'), verdict = $('#verdict'), sub = $('#verdictSub');
    function calc() {
      oL.textContent = sL.value; oD.textContent = sD.value; oT.textContent = sT.value;
      // ROI of Thinking rises with length & difficulty, and with LOW tolerance to errors
      const score = (+sL.value * .3 + +sD.value * .4 + (100 - +sT.value) * .3) / 100; // 0..1
      arc.style.strokeDashoffset = 283 * (1 - score);
      needle.style.transform = `rotate(${-90 + score * 180}deg)`;
      let col, v, s;
      if (score < .4) { col = 'var(--fast)'; v = 'INSTANT経路で十分'; s = 'Thinkingは“過剰品質（OVER‑QUALITY）”になりうる。'; }
      else if (score < .62) { col = 'var(--gold)'; v = 'AUTOに任せる'; s = '必要と判断したときだけThinkingを発動させ、無駄撃ちを抑える。'; }
      else { col = 'var(--think2)'; v = 'ThinkingのROIが高い'; s = '“難しい・長い・正確さが超重要”な課題。再作業の削減（REWORK REDUCTION）が効く。'; }
      arc.style.stroke = col; verdict.style.color = col; verdict.textContent = v; sub.textContent = s;
    }
    [sL, sD, sT].forEach(r => r.addEventListener('input', calc));
    $$('.pbtn').forEach(b => b.addEventListener('click', () => {
      const [l, d, t] = b.dataset.p.split(',').map(Number);
      const anim = (r, to) => {
        if (!hasGSAP) { r.value = to; fill(r); calc(); return; }
        const o = { v: +r.value };
        gsap.to(o, { v: to, duration: .9, ease: 'expo.out', onUpdate: () => { r.value = o.v; fill(r); calc(); } });
      };
      anim(sL, l); anim(sD, d); anim(sT, t);
    }));
    calc();
  })();

  /* CH8: study scenario */
  (() => {
    const cards = $$('.scard'), fillEl = $('#bbFill');
    const set = m => { cards.forEach(c => c.classList.toggle('is-active', c.dataset.mode === m)); fillEl.style.left = m === 'fast' ? '85%' : '15%'; };
    cards.forEach(c => c.addEventListener('click', () => set(c.dataset.mode)));
    // auto alternate to illustrate ADAPTIVE USE until the user interacts
    let auto = true, m = 'think';
    cards.forEach(c => c.addEventListener('click', () => { auto = false; }));
    set(m);
    setInterval(() => { if (!auto) return; m = m === 'think' ? 'fast' : 'think'; set(m); }, 3200);
  })();

  /* CH9: TRUST = TECHNOLOGY × HABITS */
  (() => {
    const sT = $('#sTech'), sH = $('#sHab'), oT = $('#oTech'), oH = $('#oHab');
    const val = $('#trustVal'), fg = $('#shFg'), msg = $('#trustMsg');
    let shown = 0;
    function calc() {
      oT.textContent = sT.value; oH.textContent = sH.value;
      const t = Math.round(+sT.value * +sH.value / 100);
      fg.style.setProperty('--fill', t + '%');
      if (hasGSAP) { const o = { v: shown }; gsap.to(o, { v: t, duration: .6, onUpdate: () => { val.textContent = Math.round(o.v); }, onComplete: () => { shown = t; } }); }
      else val.textContent = t;
      msg.textContent = t >= 60 ? '技術と習慣の両輪が、長期的な“お得”を保証する。'
        : +sH.value < 40 ? '誤りをゼロにはできない。CRITICAL READING と CROSS‑CHECK は人間側の責任。'
        : '技術と習慣の両輪をそろえよう。';
      msg.style.color = t >= 60 ? 'var(--ben)' : 'var(--gold)';
    }
    [sT, sH].forEach(r => r.addEventListener('input', calc));
    calc();
  })();
})();
