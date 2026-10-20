/* Louella Pet — interações da landing page */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Header: borda ao rolar ---------- */
  const header = document.querySelector('.site-header');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Menu mobile ---------- */
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('menu');
  const toggleLabel = toggle.querySelector('.sr-only');

  const setMenu = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    toggleLabel.textContent = open ? 'Fechar menu' : 'Abrir menu';
  };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      setMenu(false);
      toggle.focus();
    }
  });
  window.matchMedia('(min-width: 900px)').addEventListener('change', () => setMenu(false));

  /* ---------- Filtro da vitrine ---------- */
  const chips = document.querySelectorAll('.chip[data-filter]');
  const products = document.querySelectorAll('#product-grid .product');
  const filterStatus = document.getElementById('filter-status');
  const labels = { all: 'todos os produtos', pet: 'produtos para o pet', higiene: 'produtos de higiene' };

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const filter = chip.dataset.filter;
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));

      let count = 0;
      let shown = 0;
      products.forEach((p) => {
        const cats = p.dataset.cat.split(' ');
        const show = filter === 'all' || cats.includes(filter) || cats.includes('all');
        const wasHidden = p.hidden;
        p.hidden = !show;
        p.classList.add('is-in'); // nunca esconder pelo reveal depois de filtrar
        p.classList.remove('is-filtered-in');
        if (show && wasHidden) {
          p.style.setProperty('--fd', `${Math.min(shown, 8) * 35}ms`);
          void p.offsetWidth; // reinicia a animação
          p.classList.add('is-filtered-in');
        }
        if (show) shown++;
        if (show && !cats.includes('all')) count++;
      });
      filterStatus.textContent = filter === 'all'
        ? `Mostrando todos os ${count} produtos.`
        : `Mostrando ${count} ${labels[filter]}.`;
    });
  });

  /* ---------- Entrada ao rolar (grades de cards) ----------
     Os cards são visíveis por padrão; só os que ainda estão abaixo da dobra
     são "armados" para entrar ao rolar. Sem JS ou com movimento reduzido, nada some. */
  if ('IntersectionObserver' in window && !reduceMotion.matches) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    document.querySelectorAll('.product-grid, .fc-list, .review-list').forEach((list) => {
      [...list.children].forEach((el, i) => {
        if (el.getBoundingClientRect().top < window.innerHeight) return;
        el.style.setProperty('--d', `${(i % 4) * 70}ms`); // escalonamento leve por linha
        el.classList.add('reveal-armed');
        io.observe(el);
      });
    });
  }

  /* ---------- Almofada interativa (hero) ---------- */
  const canvas = document.getElementById('sofa-canvas');
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext('2d');
  const stage = canvas.parentElement;
  const btn = document.getElementById('sofa-btn');
  const btnLabel = btn.querySelector('.label');
  const btnIcon = btn.querySelector('use');
  const doneBadge = document.getElementById('sofa-done');
  const status = document.getElementById('sofa-status');

  // cores de pelo: do gato branco e do cachorro caramelo que dormem no sofá
  const HAIR_COLORS = ['#FFFFFF', '#FFFFFF', '#F4E9D4', '#E3B37A', '#E3B37A', '#C98F52', '#A8733F'];
  // área das almofadas (proporções do canvas)
  const AREA = { x0: 0.05, x1: 0.95, y0: 0.27, y1: 0.93 };

  let W = 0, H = 0, dpr = 1;
  let hairs = [];
  let total = 0;
  let roller = null;      // posição atual do rolo {x, y} em px
  let lastPos = null;     // última posição usada para recolher pelos
  let pressed = false;
  let finished = false;
  let anim = null;        // varredura automática em andamento
  let frame = 0;
  let bg = null;          // fundo pré-renderizado

  function seedHairs() {
    hairs = [];
    // densidade constante: menos pelos em telas pequenas
    const n = Math.round(Math.min(380, Math.max(160, (W * H) / 560)));
    for (let i = 0; i < n; i++) {
      hairs.push({
        x: AREA.x0 + Math.random() * (AREA.x1 - AREA.x0),
        y: AREA.y0 + Math.random() * (AREA.y1 - AREA.y0),
        len: 10 + Math.random() * 18,
        a: Math.random() * Math.PI,
        bend: (Math.random() - 0.5) * 1.1,
        w: 1.5 + Math.random() * 1.3,
        c: HAIR_COLORS[(Math.random() * HAIR_COLORS.length) | 0],
      });
    }
    total = n;
    finished = false;
  }

  function rollerSize() {
    const w = Math.max(84, Math.min(150, W * 0.24));
    return { w, h: w * 0.28 };
  }

  function parkedPos() {
    return { x: W * 0.78, y: H * 0.86 };
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function buildBackground() {
    bg = document.createElement('canvas');
    bg.width = canvas.width;
    bg.height = canvas.height;
    const c = bg.getContext('2d');
    c.scale(dpr, dpr);

    // encosto
    c.fillStyle = '#0379B6';
    c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,.08)';
    roundRect(c, W * 0.03, H * 0.05, W * 0.94, H * 0.2, 22);
    c.fill();

    // duas almofadas
    const gap = W * 0.015;
    const cw = (W * (AREA.x1 - AREA.x0) + W * 0.04 - gap) / 2;
    const cy = H * (AREA.y0 - 0.03);
    const ch = H * (AREA.y1 - AREA.y0 + 0.05);
    [W * (AREA.x0 - 0.02), W * (AREA.x0 - 0.02) + cw + gap].forEach((cx) => {
      c.fillStyle = '#0491D8';
      roundRect(c, cx, cy, cw, ch, 20);
      c.fill();
      c.strokeStyle = '#0E2238';
      c.lineWidth = 2;
      c.stroke();
      // costura
      c.setLineDash([6, 6]);
      c.strokeStyle = 'rgba(255,255,255,.35)';
      c.lineWidth = 1.5;
      roundRect(c, cx + 10, cy + 10, cw - 20, ch - 20, 14);
      c.stroke();
      c.setLineDash([]);
    });

    // trama do tecido
    c.save();
    c.globalAlpha = 0.07;
    c.strokeStyle = '#FFFFFF';
    c.lineWidth = 1;
    for (let i = -H; i < W; i += 7) {
      c.beginPath();
      c.moveTo(i, H);
      c.lineTo(i + H, 0);
      c.stroke();
    }
    c.restore();
  }

  function drawHair(h) {
    const x = h.x * W, y = h.y * H;
    const dx = Math.cos(h.a) * h.len / 2;
    const dy = Math.sin(h.a) * h.len / 2;
    const bx = -Math.sin(h.a) * h.bend * h.len;
    const by = Math.cos(h.a) * h.bend * h.len;
    ctx.beginPath();
    ctx.moveTo(x - dx, y - dy);
    ctx.quadraticCurveTo(x + bx, y + by, x + dx, y + dy);
    ctx.strokeStyle = h.c;
    ctx.lineWidth = h.w;
    ctx.stroke();
  }

  function drawRoller(p) {
    const { w, h } = rollerSize();
    const x = p.x - w / 2, y = p.y - h / 2;

    ctx.save();
    // cabo
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0E2238';
    ctx.lineWidth = h * 0.62 + 4;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + h * 0.3);
    ctx.lineTo(p.x + w * 0.12, p.y + h * 2.6);
    ctx.stroke();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = h * 0.62;
    ctx.stroke();

    // corpo
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, x - 6, y - 6, w + 12, h + 12, (h + 12) / 2);
    ctx.fill();
    ctx.strokeStyle = '#0E2238';
    ctx.lineWidth = 2;
    ctx.stroke();

    // almofada vermelha do rolo
    ctx.fillStyle = '#E2403F';
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.28)';
    ctx.lineWidth = 1;
    for (let i = x + 6; i < x + w - 4; i += 5) {
      ctx.beginPath();
      ctx.moveTo(i, y + 3);
      ctx.lineTo(i - 2, y + h - 3);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---- Cachorro e gato no encosto (traço da logo) ---- */
  const INK = '#0E2238';
  const P = (d) => new Path2D(d);
  // desenhos em unidades locais: gato 120x80, cachorro 150x80, apoiados em y = 72
  const CAT = {
    w: 120,
    tail: P('M98 70 C116 70 120 52 110 44'),
    body: P('M24 72 C22 46 44 30 72 30 C98 30 112 48 110 72 Z'),
    ears: P('M19 42 L17 22 L31 31 Z M38 30 L51 21 L51 40 Z'),
    innerEars: P('M21 36 L20 27 L27 32 Z M41 30 L48 26 L48 35 Z'),
    head: P('M53 48 A19 19 0 1 1 15 48 A19 19 0 1 1 53 48 Z'),
    sleep: P('M25 48 Q29 52 33 48 M37 48 Q41 52 45 48'),
    eyes: [[29, 47], [41, 47]],
    nose: P('M32.5 54 L37.5 54 L35 57 Z'),
    mouth: P('M35 57 Q33 60 30.5 58.5 M35 57 Q37 60 39.5 58.5'),
    paws: [[30, 72], [46, 72]],
    heart: [34, 18],
  };
  const DOG = {
    w: 150,
    tail: P('M136 66 C150 58 150 44 144 38'),
    body: P('M36 72 C36 44 66 34 98 36 C126 38 140 52 140 72 Z'),
    spot: P('M92 44 C102 38 118 40 120 50 C114 56 98 56 92 44 Z'),
    head: P('M64 50 A24 21 0 1 1 16 50 A24 21 0 1 1 64 50 Z'),
    snout: P('M35 59 A13 9.5 0 1 1 9 59 A13 9.5 0 1 1 35 59 Z'),
    nose: P('M16.5 55 A4.5 3.5 0 1 1 7.5 55 A4.5 3.5 0 1 1 16.5 55 Z'),
    ear: P('M48 31 C64 29 69 52 60 65 C51 62 43 47 48 31 Z'),
    sleep: P('M29 45 Q33 49 37 45'),
    eyes: [[33, 45]],
    paws: [[18, 72], [38, 72]],
    heart: [40, 18],
  };
  const HEART = P('M0 3 C0 -1.5 -6.5 -1.5 -6.5 3.5 C-6.5 7 -2 9.5 0 12 C2 9.5 6.5 7 6.5 3.5 C6.5 -1.5 0 -1.5 0 3 Z');
  let wokeAt = 0;

  function petScale() {
    return (H * 0.21) / 80;
  }

  function fillStroke(path, fill, lw) {
    ctx.fillStyle = fill;
    ctx.fill(path);
    ctx.lineWidth = lw;
    ctx.strokeStyle = INK;
    ctx.stroke(path);
  }

  function paw(x, y, fill, lw) {
    ctx.beginPath();
    ctx.ellipse(x, y, 8, 4.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }

  function thickTail(path, color, lw, width) {
    ctx.lineWidth = width + lw * 2;
    ctx.strokeStyle = INK;
    ctx.stroke(path);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke(path);
  }

  function face(pet, awake, lw) {
    if (awake) {
      ctx.fillStyle = INK;
      pet.eyes.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 2.8, 0, Math.PI * 2);
        ctx.fill();
      });
    } else {
      ctx.lineWidth = lw;
      ctx.strokeStyle = INK;
      ctx.stroke(pet.sleep);
    }
  }

  function heart(pet, k) {
    if (k <= 0) return;
    const [hx, hy] = pet.heart;
    ctx.save();
    ctx.translate(hx, hy - 6 * k);
    ctx.scale(k * 1.3, k * 1.3);
    ctx.fillStyle = '#E2403F';
    ctx.fill(HEART);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = INK;
    ctx.stroke(HEART);
    ctx.restore();
  }

  function drawPets(awake, k) {
    const s = petScale();
    const lw = 2 / s; // contorno de 2px na tela, qualquer que seja a escala
    const baseY = H * 0.255 - 72 * s;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // cachorro à esquerda, virado para o centro
    ctx.save();
    ctx.translate(W * 0.05 + DOG.w * s, baseY);
    ctx.scale(-s, s);
    thickTail(DOG.tail, '#E3B37A', lw, 8);
    fillStroke(DOG.body, '#E3B37A', lw);
    ctx.fillStyle = '#C98F52';
    ctx.fill(DOG.spot);
    fillStroke(DOG.head, '#E3B37A', lw);
    fillStroke(DOG.snout, '#F6E3C6', lw);
    fillStroke(DOG.ear, '#A8733F', lw);
    ctx.fillStyle = INK;
    ctx.fill(DOG.nose);
    face(DOG, awake, lw);
    DOG.paws.forEach(([x, y]) => paw(x, y, '#F6E3C6', lw));
    heart(DOG, k);
    ctx.restore();

    // gato à direita
    ctx.save();
    ctx.translate(W * 0.95 - CAT.w * s, baseY);
    ctx.scale(s, s);
    thickTail(CAT.tail, '#FFFFFF', lw, 7);
    fillStroke(CAT.body, '#FFFFFF', lw);
    fillStroke(CAT.ears, '#FFFFFF', lw);
    ctx.fillStyle = '#F6B8BE';
    ctx.fill(CAT.innerEars);
    fillStroke(CAT.head, '#FFFFFF', lw);
    face(CAT, awake, lw);
    ctx.fillStyle = '#F29CA3';
    ctx.fill(CAT.nose);
    ctx.lineWidth = lw * 0.8;
    ctx.strokeStyle = INK;
    ctx.stroke(CAT.mouth);
    CAT.paws.forEach(([x, y]) => paw(x, y, '#FFFFFF', lw));
    heart(CAT, k);
    ctx.restore();

    ctx.restore();
  }

  function render() {
    frame = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (bg) ctx.drawImage(bg, 0, 0, W, H);

    // pets acordam quando o sofá fica limpo; o coração surge em 450ms
    let k = 0;
    if (finished) {
      k = reduceMotion.matches ? 1 : Math.min(1, (performance.now() - wokeAt) / 450);
      k = 1 - Math.pow(1 - k, 3);
    }
    ctx.lineCap = 'round';
    for (let i = 0; i < hairs.length; i++) drawHair(hairs[i]);

    drawPets(finished, k);
    if (finished && k < 1) requestRender();
    drawRoller(roller || parkedPos());
  }

  function requestRender() {
    if (!frame) frame = requestAnimationFrame(render);
  }

  // remove os pelos que ficaram sob o rolo no trajeto de a até b
  function sweep(a, b) {
    const { w, h } = rollerSize();
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(dist / (h * 0.5)));
    const halfW = w / 2, halfH = h / 2 + 4;
    for (let s = 0; s <= steps; s++) {
      const px = a.x + (b.x - a.x) * (s / steps);
      const py = a.y + (b.y - a.y) * (s / steps);
      hairs = hairs.filter((hr) => Math.abs(hr.x * W - px) > halfW || Math.abs(hr.y * H - py) > halfH);
    }
    checkDone();
  }

  function checkDone() {
    if (finished || !total) return;
    if (hairs.length / total < 0.08) {
      hairs = [];
      finished = true;
      wokeAt = performance.now();
      doneBadge.hidden = false;
      status.textContent = 'Sofá limpo! O cachorro e o gato acordaram. Assim funciona o Rolo Tira Pelos.';
      btnLabel.textContent = 'Espalhar pelos de novo';
      btnIcon.setAttribute('href', '#i-rotate-ccw');
    }
  }

  function reset() {
    seedHairs();
    doneBadge.hidden = true;
    status.textContent = '';
    btnLabel.textContent = 'Passar o rolo';
    btnIcon.setAttribute('href', '#i-sparkles');
    roller = null;
    requestRender();
  }

  function pointerPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  let activePointer = null;

  canvas.addEventListener('pointerdown', (e) => {
    if (pressed && e.pointerId !== activePointer) return; // ignora um segundo dedo
    stopAnim();
    pressed = true;
    activePointer = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    roller = pointerPos(e);
    lastPos = roller;
    sweep(roller, roller);
    requestRender();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (anim) return;
    if (pressed && e.pointerId !== activePointer) return;
    const p = pointerPos(e);
    // com mouse, passar por cima já limpa; no toque, só arrastando
    if (pressed || e.pointerType === 'mouse') {
      sweep(lastPos || p, p);
      lastPos = p;
    }
    roller = p;
    requestRender();
  });

  const release = () => { pressed = false; lastPos = null; activePointer = null; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', release);
  canvas.addEventListener('pointerleave', () => {
    if (anim) return;
    release();
    roller = null;
    requestRender();
  });

  // varredura automática em zigue-zague (teclado e demonstração)
  function buildPath(rows) {
    const { w, h } = rollerSize();
    const pts = [];
    const left = W * AREA.x0 + w * 0.35;
    const right = W * AREA.x1 - w * 0.35;
    const top = H * AREA.y0 + h * 0.4;
    const bottom = H * AREA.y1 - h * 0.4;
    for (let r = 0; r < rows.length; r++) {
      const y = top + (bottom - top) * rows[r];
      const fromLeft = r % 2 === 0;
      pts.push({ x: fromLeft ? left : right, y });
      pts.push({ x: fromLeft ? right : left, y });
    }
    return pts;
  }

  function animatePath(pts, duration, onEnd) {
    stopAnim();
    const lens = [];
    let totalLen = 0;
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      lens.push(l);
      totalLen += l;
    }
    const start = performance.now();
    let prev = pts[0];
    roller = prev;

    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      let d = eased * totalLen;
      let i = 0;
      while (i < lens.length - 1 && d > lens[i]) { d -= lens[i]; i++; }
      const k = lens[i] ? Math.min(1, d / lens[i]) : 1;
      const p = {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * k,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * k,
      };
      sweep(prev, p);
      prev = p;
      roller = p;
      render();
      if (t < 1) {
        anim = requestAnimationFrame(step);
      } else {
        anim = null;
        if (onEnd) onEnd();
      }
    };
    anim = requestAnimationFrame(step);
  }

  function stopAnim() {
    if (anim) cancelAnimationFrame(anim);
    anim = null;
  }

  btn.addEventListener('click', () => {
    if (finished) { reset(); return; }
    if (reduceMotion.matches) {
      hairs = [];
      checkDone();
      finished = true;
      requestRender();
      return;
    }
    const { h } = rollerSize();
    const span = H * (AREA.y1 - AREA.y0);
    const rows = Math.max(3, Math.ceil(span / (h * 0.95)));
    const fractions = Array.from({ length: rows }, (_, i) => i / (rows - 1));
    animatePath(buildPath(fractions), 650 * rows, () => {
      hairs = [];
      checkDone();
      roller = null;
      render();
    });
  });

  // ajuste de tamanho (mantém os pelos, que usam coordenadas relativas)
  function resize() {
    const r = stage.getBoundingClientRect();
    if (!r.width) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    buildBackground();
    render();
  }

  resize();
  seedHairs();
  render();
  if ('ResizeObserver' in window) {
    new ResizeObserver(resize).observe(stage);
  } else {
    window.addEventListener('resize', resize);
  }

  // demonstração única ao carregar: uma passada no meio da almofada
  if (!reduceMotion.matches) {
    const intro = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      intro.disconnect();
      setTimeout(() => {
        if (pressed || anim || finished) return;
        animatePath(buildPath([0.5]), 1300, () => { roller = null; render(); });
      }, 600);
    }, { threshold: 0.6 });
    intro.observe(stage);
  }
})();
