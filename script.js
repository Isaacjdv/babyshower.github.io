/* ============================================================
   LILLAN & CRISTIAN — BABY SHOWER & GENDER REVEAL
   Versión: Google Sheets + GitHub Pages
   ============================================================ */

const CFG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxP_1jQ4CRmtkFYqn2Q5oEEVk4EAjL5a1idrLkUpO3LwQmhT0riRmHhx1bBNcvrAfX-/exec',
  PARENTS: 'Lillan & Cristian',
  EVENT_DATE: '2026-11-17T16:00:00-05:00',
  // Ajustado para que HOY (12 nov 2026) esté en semana 23
  DUE_DATE: '2027-03-11',
  PLACE: {
    name: 'Casa de Lillan',
    address: 'Casa de Lillan',
    mapsQuery: 'Casa de Lillan',
    lat: null,
    lon: null
  },
  ALLOW_DEMO: true,
  GROQ_KEY: '',
  GROQ_MODEL: '',
  USE_POLLINATIONS: true,
  GENDER_SEAL: '',
  WHATSAPP_TO: ''
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const ls = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  json: (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } }
};

const esc = s => {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const pick = a => a[Math.random() * a.length | 0];
const eventTime = () => new Date(CFG.EVENT_DATE).getTime();
const demo = new URLSearchParams(location.search).get('demo') === '1' && CFG.ALLOW_DEMO;
const me = () => ls.get('babyVisitorName') || '';

const PASTELS = ['#f8c8dc','#bde0fe','#c9f0dd','#e4d4f4','#fff1b8','#ffd9c7','#ee93b9','#6fb3ea'];

function googleRequest(params = {}) {
  return new Promise((resolve, reject) => {
    if (!CFG.API_URL) {
      reject(new Error('No está configurada la URL de Google Sheets.'));
      return;
    }
    const callback = '__babyCallback_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Tiempo de espera agotado al conectar con Google Sheets.'));
    }, 20000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callback];
      script.remove();
    }

    window[callback] = data => {
      cleanup();
      if (!data || data.success !== true) {
        reject(new Error(data?.error || 'Respuesta inválida de Google Sheets.'));
        return;
      }
      resolve(data);
    };

    const query = new URLSearchParams({ ...params, callback });
    const separator = CFG.API_URL.includes('?') ? '&' : '?';
    script.src = CFG.API_URL + separator + query.toString();
    script.onerror = () => {
      cleanup();
      reject(new Error('No se pudo conectar con Google Apps Script.'));
    };
    document.head.appendChild(script);
  });
}

function emptyDocument() {
  return {
    votes: { niño: 0, niña: 0 },
    names: {},
    guesses: [],
    gifts: {},
    messages: [],
    rsvps: [],
    rsvpFamilies: [],
    rsvpCount: 0,
    rsvpPeople: 0,
    kicks: 0,
    pops: 0
  };
}

function normalizeDocument(data) {
  const base = emptyDocument();
  if (!data || typeof data !== 'object') return base;
  return {
    ...base,
    ...data,
    votes: { ...base.votes, ...(data.votes || {}) },
    names: data.names || {},
    guesses: Array.isArray(data.guesses) ? data.guesses : [],
    gifts: data.gifts || {},
    messages: Array.isArray(data.messages) ? data.messages : [],
    rsvps: Array.isArray(data.rsvps) ? data.rsvps : [],
    rsvpFamilies: Array.isArray(data.rsvpFamilies) ? data.rsvpFamilies : [],
    kicks: Number(data.kicks) || 0,
    pops: Number(data.pops) || 0
  };
}

const S = {
  doc: emptyDocument(),
  mode: 'google-sheets',
  offline: false,
  initialized: false,

  async init() {
    try {
      await this.load();
      this.initialized = true;
      this.offline = false;
    } catch (error) {
      console.error('Error inicializando Google Sheets:', error);
      this.offline = true;
      if (!this.doc) this.doc = emptyDocument();
    }
    return this.doc;
  },

  async load() {
    try {
      const result = await googleRequest({ action: 'load' });
      if (!result || !result.doc) throw new Error('Google Sheets no devolvió el documento.');
      this.doc = normalizeDocument(result.doc);
      this.offline = false;
      return this.doc;
    } catch (error) {
      this.offline = true;
      console.error('Error cargando datos:', error);
      throw error;
    }
  },

  async op(payload) {
    try {
      const result = await googleRequest({
        action: 'op',
        payload: JSON.stringify(payload)
      });
      if (result.doc) {
        this.doc = normalizeDocument(result.doc);
      } else {
        await this.load();
      }
      this.offline = false;
      return { ok: true, doc: this.doc };
    } catch (error) {
      console.error('Error guardando operación:', payload.t, error);
      this.offline = true;
      return { ok: false, error: error.message || 'No se pudo guardar la información.' };
    }
  }
};

let doc = S.doc;

function toast(msg, ms = 3400) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), ms);
}

function note(el, msg, cls, ms = 5000) {
  if (!el) return;
  el.className = 'form-note ' + cls;
  el.textContent = msg;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.textContent = ''; }, ms);
}

async function typeInto(el, text, speed = 20) {
  if (!el) return;
  const token = el._tok = Symbol();
  el.textContent = '';
  el.classList.add('typing');
  for (const ch of text) {
    if (el._tok !== token) return;
    el.textContent += ch;
    await sleep(speed);
  }
  if (el._tok === token) el.classList.remove('typing');
}

const SYS = 'Eres parte de una invitación de baby shower. Responde siempre en español, con ternura y buen humor. Solo el texto pedido, sin comillas ni introducciones, sin emojis.';

async function ai(prompt, { system = SYS, max = 140 } = {}) {
  const clean = t => (t || '').trim().replace(/^["“«]+|["”»]+$/g, '').trim();
  if (!CFG.USE_POLLINATIONS) return null;
  try {
    const url = 'https://text.pollinations.ai/' + encodeURIComponent(system + '\n\n' + prompt) + '?model=openai';
    const response = await fetch(url);
    if (!response.ok) return null;
    const result = clean(await response.text());
    if (result && result.length < 1500 && !/^\s*\{/.test(result)) return result;
  } catch (error) {
    console.warn('IA no disponible:', error);
  }
  return null;
}

const WEEKS = {
  20: ['🍌', 'Como un plátano', '≈ 25 cm', 'Ya se oyen los latidos con claridad y responde a sonidos.', 'Las huellas de los dedos ya están formadas.'],
  21: ['🥕', 'Como una zanahoria', '≈ 27 cm', 'Empieza a percibir sabores.', 'Los movimientos se vuelven más fluidos.'],
  22: ['🍠', 'Como una papa dulce', '≈ 28 cm', 'Las cejas y pestañas se forman.', 'Explora el cordón con las manitos.'],
  23: ['🥭', 'Como un mango', '≈ 29 cm', 'Reconoce voces familiares.', 'El oído interno madura.'],
  24: ['🌽', 'Como una mazorca', '≈ 30 cm', 'Los pulmones maduran poco a poco.', 'Un ruido fuerte puede darle un sobresalto.'],
  25: ['🍆', 'Como una berenjena', '≈ 32 cm', 'Responde a la luz y al sonido.', 'El cabellito empieza a crecer.'],
  26: ['🥬', 'Como una lechuga', '≈ 33 cm', 'Abre y cierra los ojitos.', 'Los ciclos de sueño se regularizan.'],
  27: ['🥦', 'Como una coliflor', '≈ 34 cm', 'Sueña y hace gestos.', 'El cerebro avanza rápidamente.'],
  28: ['🥬', 'Como una berza', '≈ 35 cm', 'Casi 1 kg de amor.', 'Los pulmones siguen madurando.'],
  29: ['🎃', 'Como una calabaza', '≈ 36 cm', 'Gana grasa y sus huesos se fortalecen.', 'Los músculos se tonifican.'],
  30: ['🥗', 'Como un repollo', '≈ 38 cm', 'Practica la respiración.', 'El hipo es frecuente.'],
  31: ['🥥', 'Como un coco', '≈ 39 cm', 'Cada patadita es un hola.', 'Recibe anticuerpos de mamá.'],
  32: ['🍍', 'Como una piña', '≈ 40 cm', 'Muchos bebés se colocan cabeza abajo.', 'Las uñas están casi completas.'],
  33: ['🍈', 'Como un melón', '≈ 42 cm', 'Cada día está más preparado.', 'Los huesos del cráneo siguen flexibles.'],
  34: ['🍉', 'Como una sandía pequeña', '≈ 43 cm', 'Los pulmones maduran.', 'La voz de mamá y papá es especial.'],
  35: ['🍊', 'Como un pomelo', '≈ 45 cm', 'Engorda rápidamente.', 'Los riñones ya funcionan.'],
  36: ['🥬', 'Como una lechuga romana', '≈ 46 cm', '¡Casi a término!', 'Practica la succión.'],
  37: ['🍈', 'Como un melón cantalupo', '≈ 47 cm', 'Listo para nacer cuando llegue el momento.', 'El vernix protege su piel.'],
  38: ['🍉', 'Como una sandía', '≈ 48 cm', 'Esperando el momento perfecto.', 'Casi no queda espacio.'],
  39: ['👶', 'Como un pequeño humano', '≈ 49 cm', 'Cualquier día puede ser el gran día.', 'Solo falta el primer abrazo.'],
  40: ['🎉', '¡Llegó el gran día!', '≈ 50 cm', '¡Bienvenido al mundo!', 'Hoy puede cambiar todo para mejor.']
};

const dueMs = () => new Date(CFG.DUE_DATE + 'T12:00:00-05:00').getTime();
const getWeek = () => Math.max(20, Math.min(40, 40 - Math.ceil((dueMs() - Date.now()) / (7 * 864e5))));

const SIGNS = [
  ['Capricornio', '♑', 1, 19], ['Acuario', '♒', 2, 18], ['Piscis', '♓', 3, 20],
  ['Aries', '♈', 4, 19], ['Tauro', '♉', 5, 20], ['Géminis', '♊', 6, 20],
  ['Cáncer', '♋', 7, 22], ['Leo', '♌', 8, 22], ['Virgo', '♍', 9, 22],
  ['Libra', '♎', 10, 22], ['Escorpio', '♏', 11, 21], ['Sagitario', '♐', 12, 21],
  ['Capricornio', '♑', 13, 31]
];

function zodiac(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number);
  return SIGNS.find(s => m < s[2] || (m === s[2] && d <= s[3])) || SIGNS[0];
}

const cv = $('#confettiCanvas');
const cx = cv ? cv.getContext('2d') : null;
let parts = [];
let raf = 0;

const sizeCv = () => { if (!cv) return; cv.width = innerWidth; cv.height = innerHeight; };
sizeCv();
addEventListener('resize', sizeCv);

function fire(x, y, n = 80, colors = PASTELS, power = 1) {
  if (!cx) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (4 + Math.random() * 11) * power;
    parts.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 6 * power,
      size: 5 + Math.random() * 8, color: pick(colors),
      life: 90 + Math.random() * 60, rot: Math.random() * 360,
      vr: (Math.random() - .5) * 14, circle: Math.random() > .6
    });
  }
  if (!raf) raf = requestAnimationFrame(loop);
}

function loop() {
  if (!cx || !cv) return;
  cx.clearRect(0, 0, cv.width, cv.height);
  parts = parts.filter(p => p.life > 0);
  for (const p of parts) {
    p.x += p.vx; p.y += p.vy; p.vy += .28; p.vx *= .985; p.rot += p.vr; p.life--;
    cx.save();
    cx.translate(p.x, p.y);
    cx.rotate(p.rot * Math.PI / 180);
    cx.globalAlpha = Math.min(1, p.life / 40);
    cx.fillStyle = p.color;
    if (p.circle) {
      cx.beginPath(); cx.arc(0, 0, p.size / 2, 0, 7); cx.fill();
    } else {
      cx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size / 1.6);
    }
    cx.restore();
  }
  raf = parts.length ? requestAnimationFrame(loop) : 0;
}

const cannons = colors => {
  fire(0, innerHeight * .75, 110, colors, 1.5);
  fire(innerWidth, innerHeight * .75, 110, colors, 1.5);
  setTimeout(() => fire(innerWidth / 2, innerHeight * .4, 140, colors, 1.4), 350);
};

function emojiRain(list = ['🍼', '🧸', '👶', '🎈', '💙', '💗', '⭐'], n = 40) {
  for (let i = 0; i < n; i++) {
    const e = document.createElement('span');
    e.className = 'rain';
    e.textContent = pick(list);
    e.style.cssText = `left:${Math.random() * 100}vw;animation-duration:${3 + Math.random() * 3}s;animation-delay:${Math.random() * 2.5}s;font-size:${1.2 + Math.random() * 1.6}rem`;
    document.body.appendChild(e);
    setTimeout(() => e.remove(), 8000);
  }
}

let refreshTimer = null;
let flushTimer = null;
let tickTimer = null;

addEventListener('load', async () => {
  initTheme();
  const loader = $('#loader');
  try {
    await S.init();
    doc = S.doc;
  } catch (error) {
    console.error('Error en carga inicial:', error);
  }
  if (loader) loader.classList.add('hide');

  initBalloons();
  initNav();
  initReveal();
  initGreeting();
  initSparkles();
  initBaby();
  initKicks();
  initParty();
  initGames();
  initGifts();
  initPhotos();
  initBooth();
  initRevealBox();
  initMessages();
  initRsvp();
  initAudio();
  if (typeof initKonami === 'function') initKonami();
  initShare();

  renderAll();
  refresh();

  clearInterval(refreshTimer);
  clearInterval(flushTimer);
  clearInterval(tickTimer);

  refreshTimer = setInterval(refresh, 5000);
  flushTimer = setInterval(flush, 6000);
  tickTimer = setInterval(tick, 1000);
  tick();
});

addEventListener('pagehide', () => flush());

let refreshing = false;

async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    const result = await S.load();
    doc = result;
    renderAll();
  } catch (error) {
    console.error('Error actualizando información:', error);
    doc = S.doc;
  } finally {
    refreshing = false;
  }
  const banner = $('#syncBanner');
  const dev = /^(localhost|127\.)/.test(location.hostname) || location.protocol === 'file:' || location.search.includes('debug');
  if (banner) {
    banner.hidden = !(dev && S.offline);
    banner.textContent = S.offline
      ? '⚠ Sin conexión con Google Sheets. Los cambios no se han sincronizado.'
      : '☁ Información sincronizada con Google Sheets.';
  }
}

function renderAll() {
  if (!doc) doc = emptyDocument();
  renderVotes();
  renderNames();
  renderGuesses();
  renderGifts();
  renderKicks();
  renderMessages();
  renderRsvpCount();
  renderConfirmedGuests(doc);
}

const pending = { kick: 0, pop: 0 };

async function flush() {
  for (const t of ['kick', 'pop']) {
    const n = pending[t];
    if (n > 0) {
      pending[t] = 0;
      const r = await S.op({ t, n });
      if (!r.ok) pending[t] += n;
      else doc = S.doc;
    }
  }
}

function initGreeting() {
  const modal = $('#nameModal');
  const input = $('#visitorNameInput');
  const saveBtn = $('#saveNameBtn');
  if (!modal) return;

  function closeNameModal() {
    modal.classList.add('hidden');
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  }
  function openNameModal() {
    modal.classList.remove('hidden');
    modal.style.display = '';
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => input?.focus(), 300);
  }
  function saveName() {
    if (!input) return;
    const name = input.value.trim();
    if (name.length < 2) {
      input.style.borderColor = '#ee93b9';
      toast('Escribe tu nombre para entrar a la fiesta 💕');
      input.focus();
      return;
    }
    ls.set('babyVisitorName', name);
    applyName(name);
    closeNameModal();
    fire(innerWidth / 2, innerHeight / 2, 60);
    toast(`¡Bienvenido/a ${name}! 🎉`);
  }

  const saved = me();
  if (saved) {
    applyName(saved);
    closeNameModal();
  } else {
    openNameModal();
  }
  if (saveBtn) saveBtn.onclick = saveName;
  if (input) {
    input.onkeydown = e => {
      if (e.key === 'Enter') { e.preventDefault(); saveName(); }
    };
  }
  const heroNames = $('.hero .names');
  if (heroNames) heroNames.onclick = openNameModal;
  const enterBtn = $('#enterPartyBtn');
  if (enterBtn) enterBtn.onclick = saveName;
}

function applyName(n) {
  const title = $('#greetingTitle');
  const subtitle = $('#greetingSubtitle');
  if (title) title.innerHTML = `¡Hola ${esc(n)}!<br>El gran secreto te espera`;
  if (subtitle) {
    subtitle.innerHTML = 'Qué bueno verte por aquí.<br><strong>¿Niño o niña?</strong> Solo el tiempo (y tú) lo sabrán.';
  }
  if ($('#ticketName')) $('#ticketName').textContent = n;
  let h = 0;
  for (const c of n) h = (h * 31 + c.charCodeAt(0)) % 900;
  if ($('#ticketNo')) $('#ticketNo').textContent = String(100 + h);
  if ($('#ticketTable')) {
    $('#ticketTable').textContent = '🪑 Mesa ' + ['Dulce Espera', 'Nube Rosa', 'Cielo Celeste', 'Menta Fresca', 'Luna Lila'][h % 5];
  }
  ['msgName', 'guestName'].forEach(id => {
    const el = $('#' + id);
    if (el && !el.value) el.value = n;
  });
}

function initBalloons() {
  const box = $('#balloons');
  if (!box) return;
  const make = () => {
    const b = document.createElement('div');
    b.className = 'balloon';
    b.style.cssText = `left:${Math.random() * 96}%;background:${pick(PASTELS)};animation-duration:${22 + Math.random() * 20}s;animation-delay:${-Math.random() * 25}s;--s:${.7 + Math.random() * .7}`;
    b.onclick = () => {
      const r = b.getBoundingClientRect();
      fire(r.left + r.width / 2, r.top + r.height / 2, 34, [getComputedStyle(b).backgroundColor, '#fff', '#fff1b8'], .8);
      b.remove();
      pending.pop++;
      renderPops();
      setTimeout(make, 1500);
      if ((doc.pops + pending.pop) % 25 === 0) {
        toast('🎈 ¡Ya llevan ' + (doc.pops + pending.pop) + ' globos reventados entre todos!');
      }
    };
    box.appendChild(b);
  };
  for (let i = 0; i < 12; i++) make();
}

function renderPops() {
  const el = $('#popNum');
  if (el) el.textContent = doc.pops + pending.pop;
}

function initSparkles() {
  if (!matchMedia('(pointer:fine)').matches) return;
  let last = 0;
  addEventListener('pointermove', e => {
    const now = performance.now();
    if (now - last < 70) return;
    last = now;
    const s = document.createElement('i');
    s.className = 'spark';
    s.textContent = pick(['✦', '✧', '♡', '·']);
    s.style.cssText = `left:${e.clientX}px;top:${e.clientY}px;color:${pick(PASTELS)}`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 900);
  }, { passive: true });
}

function initNav() {
  const links = $('#navLinks');
  addEventListener('scroll', () => {
    $('#nav')?.classList.toggle('scrolled', scrollY > 40);
  }, { passive: true });
  const toggle = $('#navToggle');
  if (toggle && links) toggle.onclick = () => links.classList.toggle('open');
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = $(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
        links?.classList.remove('open');
      }
    });
  });
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver(es => {
      es.forEach(e => {
        if (e.isIntersecting) {
          $$('.nav-links a').forEach(a => {
            a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id);
          });
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('header[id], section[id]').forEach(s => spy.observe(s));
  }
}

function initReveal() {
  if (!('IntersectionObserver' in window)) {
    $$('.reveal').forEach(el => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(es => {
    es.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: .1 });
  $$('.reveal').forEach(el => io.observe(el));
}

function initTheme() {
  const set = t => {
    document.documentElement.dataset.theme = t;
    const btn = $('#themeBtn');
    if (btn) btn.textContent = t === 'night' ? '☀️' : '🌙';
    ls.set('babyTheme', t);
  };
  set(ls.get('babyTheme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day'));
  const btn = $('#themeBtn');
  if (btn) {
    btn.onclick = () => {
      set(document.documentElement.dataset.theme === 'night' ? 'day' : 'night');
    };
  }
}

function tick() {
  const diff = eventTime() - Date.now();
  const ids = ['days', 'hours', 'minutes', 'seconds'];
  const rids = ['rDays', 'rHours', 'rMinutes', 'rSeconds'];
  let v = [0, 0, 0, 0];
  if (diff > 0) {
    v = [
      Math.floor(diff / 864e5),
      Math.floor(diff % 864e5 / 36e5),
      Math.floor(diff % 36e5 / 6e4),
      Math.floor(diff % 6e4 / 1e3)
    ];
  }
  v.forEach((n, i) => {
    const a = $('#' + ids[i]);
    const b = $('#' + rids[i]);
    const value = String(n).padStart(2, '0');
    if (a) a.textContent = value;
    if (b) b.textContent = value;
  });
  if (diff <= 0 || demo) unlockReveal();
}

function initBaby() {
  const w = getWeek();
  const d = WEEKS[w];
  $('#currentWeek').textContent = w;
  $('#weekNumber').textContent = w;
  $('#babyEmoji').textContent = d[0];
  $('#babySizeTitle').textContent = d[1];
  $('#babySizeDesc').textContent = d[2];
  const pct = Math.round(w / 40 * 100);
  $('#progressPercent').textContent = pct;
  $('#daysToDue').textContent = Math.max(0, Math.ceil((dueMs() - Date.now()) / 864e5));
  setTimeout(() => { $('#progressFill').style.width = pct + '%'; }, 400);

  const box = $('#weeksTimeline');
  const show = k => {
    $$('.week-item', box).forEach(i => i.classList.toggle('selected', +i.dataset.week === k));
    $('#weekDetail').innerHTML = `<strong>${WEEKS[k][0]} Semana ${k} · ${WEEKS[k][1]}</strong><br>` + WEEKS[k][3];
  };
  for (let k = 20; k <= 40; k++) {
    const it = document.createElement('div');
    it.className = 'week-item' + (k < w ? ' passed' : '') + (k === w ? ' active' : '');
    it.dataset.week = k;
    it.innerHTML = `<span class="w-num">${k}</span><span class="w-label">${k === w ? 'Hoy' : k === 40 ? 'Nacer' : k === 20 ? 'Inicio' : '&nbsp;'}</span>`;
    it.onclick = () => show(k);
    box.appendChild(it);
  }
  show(w);
  const act = $('.week-item.active', box);
  if (act) {
    setTimeout(() => {
      box.scrollTo({ left: act.offsetLeft - box.clientWidth / 2 + act.offsetWidth / 2, behavior: 'smooth' });
    }, 400);
  }

  let busy = false;
  let last = '';
  const fact = async () => {
    if (busy) return;
    busy = true;
    $('#aiNextBtn').disabled = true;
    const t = await ai(`Bebé de ${w} semanas de gestación. Escribe UN dato curioso, tierno y original (máximo 20 palabras). No repitas esto: "${last}".`, { max: 70 })
      || pick(WEEKS[w].slice(3).filter(x => x !== last).concat(WEEKS[w][3]));
    last = t;
    await typeInto($('#aiMessage'), t);
    busy = false;
    $('#aiNextBtn').disabled = false;
  };
  fact();
  $('#aiNextBtn').onclick = fact;
  setInterval(fact, 40000);

  $('#letterBtn').onclick = async () => {
    const b = $('#letterBtn');
    const box2 = $('#letterBox');
    b.disabled = true;
    b.textContent = 'Escribiendo…';
    const n = me() || 'invitado';
    const t = await ai(`Escribe una carta corta de unas 55 palabras en primera persona de un bebé de ${w} semanas, dirigida a ${n}, que viene al baby shower de sus papás ${CFG.PARENTS}. Tierna, con humor suave y una petición graciosa. Empieza con "Querido/a ${n},".`, { max: 170 })
      || `Querido/a ${n}, desde aquí dentro te escucho y me da pataditas de alegría. Dicen que traerás cariño y pastel; yo solo pido abrazos para mis papás. Nos vemos pronto.`;
    box2.hidden = false;
    await typeInto(box2, t, 18);
    b.disabled = false;
    b.textContent = 'Otra carta ✉️';
  };

  const z = zodiac(CFG.DUE_DATE);
  $('#zodiacLine').innerHTML = `Si nace en la fecha prevista, será <b>${z[0]} ${z[1]}</b>`;
  $('#horoBtn').onclick = async () => {
    const b = $('#horoBtn');
    const box3 = $('#horoBox');
    b.disabled = true;
    b.textContent = 'Consultando a las estrellas…';
    const t = await ai(`Escribe un horóscopo gracioso y tierno (máximo 35 palabras) para un bebé ${z[0]}: personalidad, talento oculto y una predicción divertida.`, { max: 110 })
      || `Un ${z[0]} lleno de carácter: llegará con opiniones firmes, pocas horas de sueño y el talento de derretir corazones con una sonrisa.`;
    box3.hidden = false;
    await typeInto(box3, t, 18);
    b.disabled = false;
    b.textContent = 'Otra lectura 🔮';
  };
}

const GOALS = [10, 50, 100, 250, 500, 1000];

function initKicks() {
  const bump = $('#bump');
  const foot = $('#bumpFoot');
  const kick = e => {
    pending.kick++;
    foot.classList.remove('go');
    void foot.offsetWidth;
    foot.classList.add('go');
    bump.classList.add('pulse');
    setTimeout(() => bump.classList.remove('pulse'), 250);
    navigator.vibrate?.(30);
    const t = doc.kicks + pending.kick;
    renderKicks();
    $('#kickMsg').textContent = pick(['¡Patadita!', '¡Eso fue un golazo!', '¡Qué fuerza!', '¡Hola, mami!', '¡Otra más!', '¡Futuro futbolista (o bailarín/a)!']);
    if (GOALS.includes(t)) {
      cannons(PASTELS);
      toast(`🎉 ¡${t} pataditas entre todos!`);
    }
    const r = bump.getBoundingClientRect();
    const f = document.createElement('span');
    f.className = 'float-txt';
    f.textContent = '+1';
    f.style.cssText = `left:${e?.clientX ?? r.left + r.width / 2}px;top:${e?.clientY ?? r.top + 40}px`;
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 900);
  };
  bump.onclick = kick;
  bump.onkeydown = e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); kick(); }
  };
}

function renderKicks() {
  const el = $('#kickNum');
  if (el) {
    const t = doc.kicks + pending.kick;
    el.textContent = t.toLocaleString('es');
    $('#kickGoals').innerHTML = GOALS.map(g =>
      `<span class="goal ${t >= g ? 'done' : ''}">${t >= g ? '✔' : '○'} ${g}</span>`
    ).join('');
  }
  renderPops();
}

const AGENDA = [
  ['16:00', '🥂', 'Bienvenida y cóctel pastel'],
  ['16:30', '🎲', 'Juegos y bingo'],
  ['17:15', '🍰', 'Brindis y pastel'],
  ['17:45', '📸', 'Fotos y mensajes para el bebé'],
  ['18:00', '💥', '¡LA GRAN REVELACIÓN!'],
  ['18:30', '🎈', 'Fiesta de globos y música']
];

function initParty() {
  $('#placeName').textContent = CFG.PLACE.name;
  $('#placeAddr').textContent = CFG.PLACE.address;
  $('#mapLink').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(CFG.PLACE.mapsQuery);
  $('#agenda').innerHTML = AGENDA.map(a =>
    `<div class="ag"><b>${a[0]}</b><span>${a[1]}</span><p>${esc(a[2])}</p></div>`
  ).join('');
  $('#calendarBtn').onclick = () => {
    const s = new Date(CFG.EVENT_DATE);
    const e = new Date(s.getTime() + 4 * 36e5);
    const f = d => d.toISOString().replace(/[-:]|\.\d{3}/g, '');
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BabyShower//ES', 'BEGIN:VEVENT',
      `UID:babyshower-${f(s)}@invitacion`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(s)}`, `DTEND:${f(e)}`,
      `SUMMARY:Baby Shower & Gender Reveal de ${CFG.PARENTS}`,
      'DESCRIPTION:¿Niño o niña? Código de vestimenta pastel.',
      `LOCATION:${CFG.PLACE.name}`, 'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY',
      'DESCRIPTION:Mañana es el gran día', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = 'baby-shower.ics';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  loadWeather();
}

async function loadWeather() {
  if (CFG.PLACE.lat == null || CFG.PLACE.lon == null) return;
  const day = CFG.EVENT_DATE.slice(0, 10);
  const days = (eventTime() - Date.now()) / 864e5;
  if (days > 15 || days < -1) return;
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${CFG.PLACE.lat}&longitude=${CFG.PLACE.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&start_date=${day}&end_date=${day}`;
    const d = (await (await fetch(u)).json()).daily;
    const c = d.weather_code[0];
    const [ico, txt] =
      c === 0 ? ['☀️', 'Soleado'] :
      c <= 3 ? ['⛅', 'Parcialmente nublado'] :
      c <= 48 ? ['☁️', 'Nublado'] :
      c <= 67 ? ['🌧️', 'Lluvia'] :
      c <= 82 ? ['🌦️', 'Chubascos'] : ['⛈️', 'Tormenta'];
    $('#weatherIcon').textContent = ico;
    $('#weatherText').innerHTML = `${txt}<br>${Math.round(d.temperature_2m_min[0])}° – ${Math.round(d.temperature_2m_max[0])}°C · 💧${d.precipitation_probability_max[0]}%`;
  } catch (error) {
    console.warn('Clima no disponible:', error);
  }
}

const LOCAL_NAMES = {
  niño: ['Mateo', 'Santiago', 'Thiago', 'Emilio', 'Leonardo', 'Gael', 'Lucas', 'Adrián'],
  niña: ['Valentina', 'Isabella', 'Amelia', 'Luciana', 'Mía', 'Renata', 'Aitana', 'Emma'],
  unisex: ['Alex', 'Noa', 'Sasha', 'Ariel', 'Andrea', 'Dani', 'Eli', 'Sol']
};

const BINGO = [
  'Alguien llora de emoción', 'Foto grupal', 'Brindis por el bebé', 'Alguien apuesta mal',
  'Chiste de pañales', 'Abrazo a los papás', 'Suena canción infantil', 'Alguien dice “es niño”',
  'Alguien dice “es niña”', 'Selfie con globos', 'Preguntan el nombre', 'Aplausos',
  'Alguien se come 2 pasteles', 'Un consejo de crianza'
];

function initGames() {
  $$('.vote-btn').forEach(b => {
    b.onclick = async () => {
      if (ls.get('babyMyVote')) return;
      const r = await S.op({ t: 'vote', vote: b.dataset.vote, name: me() });
      if (r.ok) {
        ls.set('babyMyVote', b.dataset.vote);
        doc = S.doc;
        renderVotes();
        fire(b.getBoundingClientRect().x + 60, b.getBoundingClientRect().y, 40,
          b.dataset.vote === 'niño' ? ['#bde0fe', '#6fb3ea', '#fff'] : ['#f8c8dc', '#ee93b9', '#fff']);
        note($('#voteNote'), `¡Apostaste por ${b.dataset.vote === 'niño' ? 'niño 💙' : 'niña 💗'}! Lo sabremos el gran día.`, 'ok');
      } else {
        note($('#voteNote'), r.error || 'No se pudo votar', 'err');
      }
    };
  });

  $('#nameForm').onsubmit = async e => {
    e.preventDefault();
    const v = $('#nameInput').value;
    const r = await S.op({ t: 'nameAdd', name: v, by: me() });
    if (r.ok) {
      doc = S.doc;
      $('#nameInput').value = '';
      renderNames();
      toast('¡Nombre añadido! 🍼');
    } else {
      toast(r.error || 'No se pudo añadir');
    }
  };

  $$('#aiKind .chip').forEach(c => {
    c.onclick = async () => {
      const kind = c.dataset.kind;
      const out = $('#aiNames');
      out.innerHTML = '<small class="muted">Pensando…</small>';
      const t = await ai(`Dame 6 nombres de bebé ${kind === 'unisex' ? 'unisex' : kind === 'niño' ? 'de niño' : 'de niña'} en español, bonitos y poco repetidos. Responde SOLO los nombres separados por comas.`, { max: 50 });
      let names = (t || '').split(/[,\n]/).map(s => s.replace(/^[\d.\-\s]+|[.\s]+$/g, '').trim())
        .filter(s => s && s.length <= 20 && s.split(' ').length <= 2).slice(0, 6);
      if (!names.length) names = LOCAL_NAMES[kind].slice().sort(() => Math.random() - .5).slice(0, 6);
      out.innerHTML = '<small class="muted">Toca para sugerir:</small>';
      names.forEach(n => {
        const b = document.createElement('button');
        b.className = 'chip name';
        b.textContent = '+ ' + n;
        b.onclick = async () => {
          const r = await S.op({ t: 'nameAdd', name: n, by: me() });
          if (r.ok) {
            doc = S.doc;
            renderNames();
            b.remove();
          }
        };
        out.appendChild(b);
      });
    };
  });

  const g = ls.json('babyGuess', null);
  if (g) {
    $('#gDate').value = g.date;
    $('#gWeight').value = g.weight;
    $('#gLen').value = g.length;
  }
  $('#gWeight').oninput = e => { $('#gWeightV').textContent = (+e.target.value).toFixed(1); };
  $('#gLen').oninput = e => { $('#gLenV').textContent = e.target.value; };
  $('#gWeightV').textContent = (+$('#gWeight').value).toFixed(1);
  $('#gLenV').textContent = $('#gLen').value;

  $('#guessForm').onsubmit = async e => {
    e.preventDefault();
    const p = { t: 'guess', name: me() || 'Anónimo', date: $('#gDate').value, weight: $('#gWeight').value, length: $('#gLen').value };
    const r = await S.op(p);
    if (r.ok) {
      ls.set('babyGuess', JSON.stringify(p));
      doc = S.doc;
      renderGuesses();
      toast('🔮 Predicción guardada');
    } else {
      toast(r.error);
    }
  };
  initBingo();
}

function renderVotes() {
  const v = doc.votes;
  const t = (v.niño + v.niña) || 1;
  const mine = ls.get('babyMyVote');
  $('#vBoy').style.width = v.niño / t * 100 + '%';
  $('#vGirl').style.width = v.niña / t * 100 + '%';
  $('#vBoyN').textContent = v.niño;
  $('#vGirlN').textContent = v.niña;
  $$('.vote-btn').forEach(b => {
    b.disabled = !!mine;
    b.classList.toggle('mine', b.dataset.vote === mine);
  });
}

function renderNames() {
  const list = Object.entries(doc.names).map(([k, n]) => ({ k, ...n })).sort((a, b) => b.votes - a.votes).slice(0, 10);
  const mine = ls.json('babyNameVotes', []);
  const ol = $('#nameBoard');
  if (!ol) return;
  if (!list.length) {
    ol.innerHTML = '<li class="muted">Aún no hay nombres sugeridos.</li>';
    return;
  }
  ol.innerHTML = list.map((n, i) =>
    `<li><span class="rk">${['🥇', '🥈', '🥉'][i] || i + 1}</span><b>${esc(n.name)}</b><small>por ${esc(n.by)}</small><span class="vv">${n.votes}</span><button class="up" data-k="${esc(n.k)}" ${mine.includes(n.k) ? 'disabled' : ''}>👍</button></li>`
  ).join('');
  $$('.up', ol).forEach(b => {
    b.onclick = async () => {
      const r = await S.op({ t: 'nameVote', name: b.dataset.k });
      if (r.ok) {
        mine.push(b.dataset.k);
        ls.set('babyNameVotes', JSON.stringify(mine));
        doc = S.doc;
        renderNames();
      }
    };
  });
}

function renderGuesses() {
  const g = doc.guesses;
  const el = $('#guessStats');
  if (!el) return;
  if (!g.length) {
    el.innerHTML = '<p class="muted">Sé el primero en apostar 🎯</p>';
    return;
  }
  const avg = k => g.reduce((a, x) => a + (+x[k]), 0) / g.length;
  const mean = g.reduce((a, x) => a + new Date(x.date).getTime(), 0) / g.length;
  el.innerHTML = `<p><b>${g.length}</b> predicciones · la media dice:</p><div class="stats3"><div><b>${new Date(mean).toLocaleDateString('es', { day: 'numeric', month: 'short' })}</b><small>fecha</small></div><div><b>${avg('weight').toFixed(2)} kg</b><small>peso</small></div><div><b>${avg('length').toFixed(0)} cm</b><small>talla</small></div></div>`;
}

function initBingo() {
  let card = ls.json('babyBingo', null);
  const newCard = () => {
    card = {
      items: BINGO.slice().sort(() => Math.random() - .5).slice(0, 9),
      marks: [],
      won: false
    };
    ls.set('babyBingo', JSON.stringify(card));
    draw();
  };
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  function draw() {
    $('#bingo').innerHTML = card.items.map((t, i) =>
      `<button class="bcell ${card.marks.includes(i) ? 'on' : ''}" data-i="${i}">${esc(t)}</button>`
    ).join('');
    $$('.bcell').forEach(c => {
      c.onclick = () => {
        const i = +c.dataset.i;
        card.marks = card.marks.includes(i) ? card.marks.filter(x => x !== i) : [...card.marks, i];
        const win = lines.some(l => l.every(x => card.marks.includes(x)));
        if (win && !card.won) {
          card.won = true;
          cannons(PASTELS);
          toast('🏆 ¡BINGO! Eres oficialmente el/la invitado/a más atento/a');
        }
        if (!win) card.won = false;
        ls.set('babyBingo', JSON.stringify(card));
        draw();
      };
    });
  }
  $('#bingoReset').onclick = newCard;
  card ? draw() : newCard();
}

const GIFTS = [
  { id: 'panales-rn', e: '🧷', t: 'Pañales RN', max: 6 },
  { id: 'panales-1', e: '🧷', t: 'Pañales talla 1', max: 6 },
  { id: 'panales-2', e: '🧷', t: 'Pañales talla 2', max: 4 },
  { id: 'panitos', e: '🧻', t: 'Pañitos húmedos', max: 8 },
  { id: 'mantitas', e: '🧶', t: 'Mantitas', max: 3 },
  { id: 'bodys', e: '👕', t: 'Bodys 0–3 meses', max: 6 },
  { id: 'gorros', e: '🧢', t: 'Gorritos y medias', max: 4 },
  { id: 'biberones', e: '🍼', t: 'Biberones', max: 2 },
  { id: 'crema', e: '🧴', t: 'Cremas y jabón de bebé', max: 3 }
];

function initGifts() {
  $('#giftGrid').onclick = async e => {
    const b = e.target.closest('button[data-id]');
    if (!b) return;
    if (!me()) {
      $('#nameModal').classList.remove('hidden');
      return toast('Dinos tu nombre para reservar 😊');
    }
    const g = GIFTS.find(x => x.id === b.dataset.id);
    if (!g) return;
    const r = await S.op({ t: 'claim', item: g.id, name: me(), max: g.max });
    if (r.ok) {
      doc = S.doc;
      renderGifts();
      fire(b.getBoundingClientRect().x + 40, b.getBoundingClientRect().y, 40);
      toast(`¡Gracias! Reservaste ${g.t} 🎁`);
    } else {
      toast(r.error);
    }
  };
}

function renderGifts() {
  $('#giftGrid').innerHTML = GIFTS.map(g => {
    const who = doc.gifts[g.id] || [];
    const full = who.length >= g.max;
    const mine = who.includes(me());
    return `
      <div class="gift-card card">
        <div class="emoji">${g.e}</div>
        <h3>${g.t}</h3>
        <div class="dots">${Array.from({ length: g.max }, (_, i) => `<i class="${i < who.length ? 'on' : ''}"></i>`).join('')}</div>
        <small class="muted">${who.length}/${g.max} reservados${who.length ? ' · ' + who.map(esc).join(', ') : ''}</small>
        <button class="btn ${full || mine ? 'btn-ghost' : 'btn-primary'} btn-sm" data-id="${g.id}" ${full || mine ? 'disabled' : ''}>
          ${mine ? '✔ Lo llevas tú' : full ? 'Completo 💕' : 'Yo lo llevo'}
        </button>
      </div>`;
  }).join('');
}

const PHOTOS = [
  ['https://i.ibb.co/5X8s4KZD/foto-1.jpg', 'La gran noticia'],
  ['https://i.ibb.co/ksP110v7/foto-2.jpg', 'Esperando con amor'],
  ['https://i.ibb.co/35NGhy7M/foto3.jpg', 'Juntos en el camino']
];

function initPhotos() {
  const lb = $('#lightbox');
  $('#photosGrid').innerHTML = PHOTOS.map(p =>
    `<figure class="photo-card reveal"><img src="${p[0]}" alt="${esc(p[1])}" loading="lazy" onerror="this.removeAttribute('src')"><figcaption>${esc(p[1])}</figcaption></figure>`
  ).join('');
  $$('.photo-card').forEach(c => {
    c.onclick = () => {
      const img = c.querySelector('img');
      const s = img?.src;
      if (s && lb) {
        lb.querySelector('img').src = s;
        lb.hidden = false;
      }
    };
  });
  initReveal();
  if (lb) {
    lb.onclick = () => { lb.hidden = true; };
    addEventListener('keydown', e => { if (e.key === 'Escape') lb.hidden = true; });
  }
}

function initBooth() {
  const c = $('#boothCanvas');
  if (!c) return;
  const x = c.getContext('2d');
  let img = null;
  let theme = 'rosa';
  const T = {
    rosa: ['#f8c8dc', '#ee93b9'],
    celeste: ['#bde0fe', '#6fb3ea'],
    menta: ['#c9f0dd', '#6cc9a0'],
    lila: ['#e4d4f4', '#b18be0']
  };

  function draw() {
    const W = c.width, H = c.height;
    const [a, b] = T[theme];
    const g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, a); g.addColorStop(1, b);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    const px = 40, py = 110, pw = W - 80, ph = H - 250;
    x.save();
    x.beginPath(); x.roundRect(px, py, pw, ph, 36); x.clip();
    if (img) {
      const r = Math.max(pw / img.width, ph / img.height);
      const w = img.width * r, h = img.height * r;
      x.drawImage(img, px + (pw - w) / 2, py + (ph - h) / 2, w, h);
    } else {
      x.fillStyle = '#fff'; x.fillRect(px, py, pw, ph);
      x.fillStyle = '#8f8198'; x.font = '600 30px Quicksand, sans-serif';
      x.textAlign = 'center'; x.fillText('📷 Elige una foto', W / 2, py + ph / 2);
    }
    x.restore();
    x.lineWidth = 8; x.strokeStyle = '#fff';
    x.beginPath(); x.roundRect(px, py, pw, ph, 36); x.stroke();
    x.textAlign = 'center'; x.fillStyle = '#fff';
    x.shadowColor = 'rgba(90,60,110,.35)'; x.shadowBlur = 8;
    x.font = '700 54px "Dancing Script", cursive'; x.fillText('Baby Shower', W / 2, 78);
    x.font = '700 40px "Dancing Script", cursive'; x.fillText(CFG.PARENTS, W / 2, H - 120);
    x.font = '600 26px Quicksand, sans-serif';
    x.fillText((me() ? me() + ' · ' : '') + '17 · 11 · 2026', W / 2, H - 70);
    x.shadowBlur = 0; x.font = '56px serif';
    [['🎈', 70, 150], ['🧸', W - 70, 175], ['⭐', 80, py + ph - 20], ['🍼', W - 80, py + ph - 10], ['💙', W - 60, 70], ['💗', 60, 60]]
      .forEach(s => x.fillText(s[0], s[1], s[2]));
  }

  $('#boothFile').onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast('Selecciona una imagen válida.'); return; }
    const i = new Image();
    i.onload = () => {
      img = i; draw();
      $('#boothSave').disabled = false;
      $('#boothShare').disabled = false;
      fire(innerWidth / 2, innerHeight / 2, 40);
    };
    i.src = URL.createObjectURL(f);
  };

  $$('#frames .chip').forEach(b => {
    b.onclick = () => {
      theme = b.dataset.f;
      $$('#frames .chip').forEach(k => k.classList.toggle('on', k === b));
      draw();
    };
  });

  $('#boothSave').onclick = () => {
    c.toBlob(bl => {
      if (!bl) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(bl);
      a.download = 'baby-shower-foto.png';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  };

  if (navigator.canShare) {
    $('#boothShare').hidden = false;
    $('#boothShare').onclick = () => {
      c.toBlob(async bl => {
        if (!bl) return;
        const f = new File([bl], 'baby-shower.png', { type: 'image/png' });
        try {
          if (navigator.canShare({ files: [f] })) {
            await navigator.share({ files: [f], title: 'Baby Shower' });
          }
        } catch {}
      });
    };
  }
  draw();
  document.fonts?.ready.then(draw);
}

let unlocked = false;
function isUnlocked() { return Date.now() >= eventTime() || demo; }

function unlockReveal() {
  if (unlocked) return;
  unlocked = true;
  const btn = $('#revealBtn');
  if (btn) { btn.disabled = false; btn.textContent = 'Abrir el secreto'; }
  const message = $('#lockMessage');
  if (message) {
    message.textContent = demo && Date.now() < eventTime() ? 'Modo demo: ¡puedes abrirlo!' : '¡Ya puedes revelar el secreto!';
  }
}

async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

async function resolveGender() {
  if (!CFG.GENDER_SEAL) return null;
  try {
    for (const g of ['niño', 'niña']) {
      if (await sha256('lillan&cristian:' + g) === CFG.GENDER_SEAL) return g;
    }
  } catch (error) { console.warn(error); }
  return null;
}

function initRevealBox() {
  if (demo) $('#demoHint').hidden = false;
  $('#revealBtn').onclick = async () => {
    if (!isUnlocked()) return;
    const btn = $('#revealBtn');
    btn.disabled = true;
    const gender = await resolveGender();
    if (!gender) {
      btn.disabled = false;
      return toast('El secreto todavía no está configurado. Configura GENDER_SEAL cuando tengas el resultado.');
    }
    const front = $('#mysteryFront');
    const c = $('#count321');
    $('#giftIcon').classList.add('shake');
    await sleep(900);
    front.style.display = 'none';
    c.hidden = false;
    for (const n of ['3', '2', '1']) {
      c.textContent = n;
      c.classList.remove('beat');
      void c.offsetWidth;
      c.classList.add('beat');
      navigator.vibrate?.(60);
      await sleep(900);
    }
    c.hidden = true;
    const girl = gender === 'niña';
    const cols = girl ? ['#f8c8dc', '#ee93b9', '#fff', '#fff1b8', '#e4d4f4'] : ['#bde0fe', '#6fb3ea', '#fff', '#fff1b8', '#c9f0dd'];
    const res = $('#mysteryResult');
    res.classList.add('show', girl ? 'girl' : 'boy');
    $('#genderEmoji').textContent = girl ? '💗' : '💙';
    $('#genderText').textContent = girl ? '¡Es una Niña!' : '¡Es un Niño!';
    $('#resultMsg').textContent = `¡Felicidades a ${CFG.PARENTS}! Llegó ${girl ? 'una princesa 👑' : 'un príncipe 🤴'}.`;
    const v = doc.votes;
    const tot = v.niño + v.niña;
    const ok = girl ? v.niña : v.niño;
    if (tot) $('#resultStat').textContent = `${Math.round(ok / tot * 100)}% de los invitados acertó (${ok} de ${tot}) 🎯`;
    cannons(cols);
    setTimeout(() => {
      emojiRain(girl ? ['💗', '🎀', '👑', '🌸', '🧸'] : ['💙', '⭐', '🤴', '🚀', '🧸'], 45);
    }, 600);
    navigator.vibrate?.([100, 50, 100, 50, 200]);
  };
}

function renderMessages() {
  const list = doc.messages;
  const wall = $('#messagesWall');
  const empty = $('#noMessages');
  if (!wall || !empty) return;
  $$('.message-item', wall).forEach(e => e.remove());
  if (!list.length) {
    empty.style.display = 'block';
    empty.textContent = 'Aún no hay mensajes… sé el primero 💕';
    return;
  }
  empty.style.display = 'none';
  list.slice(-100).reverse().forEach(m => {
    const d = document.createElement('div');
    d.className = 'message-item';
    const when = new Date(m.date);
    const ds = isNaN(when) ? esc(m.date) : when.toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    d.innerHTML = `<div class="msg-author">${esc(m.name)}${m.ai ? ' <span class="ai-tag" title="Redactado con ayuda de la IA">✨ IA</span>' : ''}</div><div class="msg-text">${esc(m.text)}</div><div class="msg-date">${ds}</div>`;
    wall.appendChild(d);
  });
}

function initMessages() {
  let kind = 'muro';
  let lastGen = '';
  let aiFlag = false;
  $$('#msgKind button').forEach(b => {
    b.onclick = () => {
      kind = b.dataset.k;
      $$('#msgKind button').forEach(x => x.classList.toggle('on', x === b));
      $('#kindNote').textContent = kind === 'capsula'
        ? 'Una carta para que Lillan y Cristian se la entreguen al bebé cuando cumpla 18 años. No aparece en el muro.'
        : 'Un mensaje para todos los invitados.';
    };
  });
  const ta = $('#msgText');
  ta.oninput = () => {
    $('#msgCount').textContent = `${ta.value.length}/280`;
    aiFlag = aiFlag && ta.value === lastGen;
  };
  $$('.ai-helper .chip').forEach(c => {
    c.onclick = async () => {
      const tone = c.dataset.tone;
      const n = $('#msgName').value.trim() || me() || 'un invitado';
      c.disabled = true;
      ta.value = '';
      ta.placeholder = 'La IA está escribiendo… ✨';
      const t = await ai(`Escribe un mensaje ${tone === 'corto' ? 'muy corto y cariñoso (máximo 15 palabras)' : tone + ' (máximo 30 palabras)'} para los futuros papás Lillan y Cristian, escrito por ${n}. ${kind === 'capsula' ? 'Es una carta para que el bebé la lea a los 18 años.' : 'Es para el muro del baby shower.'} Hazlo único, no uses frases hechas.`, { max: 110 });
      c.disabled = false;
      ta.placeholder = 'Escríbelo tú… o pídele ayuda a la IA ✨';
      if (!t) return toast('La IA no está disponible ahora. ¡Escríbelo tú! 💕');
      lastGen = t.slice(0, 280);
      aiFlag = true;
      await typeInto(ta, lastGen, 14);
      ta.value = lastGen;
      $('#msgCount').textContent = `${ta.value.length}/280`;
    };
  });
  $('#messageForm').onsubmit = async e => {
    e.preventDefault();
    const name = $('#msgName').value.trim();
    const text = ta.value.trim();
    const btn = $('#msgSubmitBtn');
    if (!name || !text) return;
    if (text.length > 280) return note($('#msgNote'), 'Máximo 280 caracteres.', 'err');
    btn.disabled = true;
    const r = await S.op({ t: 'msg', name, text, kind, ai: aiFlag });
    btn.disabled = false;
    if (!r.ok) return note($('#msgNote'), r.error || 'No se pudo publicar', 'err');
    doc = S.doc;
    renderMessages();
    fire(innerWidth / 2, innerHeight * .6, 50);
    note($('#msgNote'), kind === 'capsula' ? '¡Cápsula guardada! Se abrirá en 18 años ⏳' : '¡Mensaje publicado! Todos lo verán 💕', 'ok');
    ta.value = '';
    aiFlag = false;
    lastGen = '';
    $('#msgCount').textContent = '0/280';
    const rep = $('#babyReply');
    rep.hidden = false;
    rep.textContent = '👶 …';
    const t = await ai(`Responde como el bebé (${getWeek()} semanas, aún en la pancita) en UNA frase tierna y graciosa (máximo 18 palabras) al mensaje de ${name}: "${text}"`, { max: 60 })
      || pick(['¡Di una patadita de agradecimiento!', 'Qué bonito… me dio hipo de la emoción.', 'Te escucho desde aquí dentro. ¡Gracias!']);
    await typeInto(rep, '👶 ' + t, 20);
    setTimeout(() => { rep.hidden = true; }, 12000);
  };
}

function renderRsvpCount() {
  const yes = (doc.rsvps || []).filter(r => r.attend === 'si');
  $('#rsvpCount').textContent = yes.length;
  $('#rsvpPeople').textContent = yes.reduce((a, r) => a + (Number(r.guests) || 1), 0);
}

function renderConfirmedGuests(doc) {
  const guestsList = document.getElementById('guestsList');
  if (!guestsList) return;
  const invitados = Array.isArray(doc.rsvpFamilies) ? doc.rsvpFamilies : [];
  if (invitados.length === 0) {
    guestsList.innerHTML = `<p class="no-guests">Aún no hay invitados confirmados 💌</p>`;
    return;
  }
  guestsList.innerHTML = invitados.map(guest => {
    const nombre = esc(guest.name || 'Invitado/a');
    const cantidad = Number(guest.guests) || 1;
    const mensaje = guest.message
      ? `<p class="guest-message">💌 ${esc(guest.message)}</p>`
      : '';
    return `
      <div class="confirmed-guest">
        <div class="guest-avatar">👤</div>
        <div class="guest-info">
          <h4>${nombre}</h4>
          <span class="guest-people">👥 ${cantidad} ${cantidad === 1 ? 'persona' : 'personas'}</span>
          ${mensaje}
        </div>
      </div>`;
  }).join('');
}

function initRsvp() {
  $('#rsvpForm').onsubmit = async e => {
    e.preventDefault();
    const p = {
      t: 'rsvp',
      name: $('#guestName').value.trim(),
      guests: $('#guestCount').value,
      message: $('#guestMsg').value.trim(),
      attend: $('input[name="attend"]:checked')?.value || 'si'
    };
    if (!p.name) return;
    const btn = $('#rsvpSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Enviando...';
    const r = await S.op(p);
    btn.disabled = false;
    btn.textContent = 'Enviar confirmación';
    if (!r.ok) return note($('#formNote'), r.error || 'No se pudo enviar', 'err');
    doc = S.doc;
    renderRsvpCount();
    renderConfirmedGuests(doc);
    if (p.attend === 'si') cannons(PASTELS);
    note($('#formNote'), `¡Gracias ${p.name}! Tu confirmación quedó registrada 💕`, 'ok', 8000);
    if (CFG.WHATSAPP_TO) {
      const w = $('#rsvpWa');
      w.hidden = false;
      w.href = `https://wa.me/${CFG.WHATSAPP_TO}?text=` + encodeURIComponent(
        `🎀 Baby Shower: ${p.name} ${p.attend === 'si' ? 'SÍ asistirá' : 'NO podrá asistir'} (${p.guests} persona/s). ${p.message}`
      );
    }
  };
}

function initAudio() {
  let ac, musicT, heartT;
  let mi = 0, musicOn = false, heartOn = false;
  const ctx = () => ac || (ac = new (window.AudioContext || window.webkitAudioContext)());
  const tone = (f, t, dur, vol, type = 'sine') => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + .01);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(ac.destination);
    o.start(t); o.stop(t + dur + .05);
  };
  const F = { C: 523.25, D: 587.33, E: 659.25, F: 698.46, G: 783.99, A: 880 };
  const song = 'C C G G A A G:2 F F E E D D C:2 G G F F E E D:2 G G F F E E D:2 C C G G A A G:2 F F E E D D C:2'
    .split(' ').map(s => { const [n, d] = s.split(':'); return [F[n], +(d || 1)]; });
  let wait = 0;
  const step = () => {
    if (wait-- > 0) return;
    const [f, d] = song[mi++ % song.length];
    wait = d - 1;
    const t = ac.currentTime + .02;
    tone(f, t, 1.4, .1);
    tone(f * 2, t, .8, .035, 'triangle');
  };
  $('#musicBtn').onclick = () => {
    ctx(); ac.resume();
    musicOn = !musicOn;
    $('#musicBtn').setAttribute('aria-pressed', musicOn);
    $('#musicBtn').classList.toggle('on', musicOn);
    clearInterval(musicT);
    if (musicOn) {
      mi = 0; wait = 0; step();
      musicT = setInterval(step, 480);
      toast('🎵 Música de cuna');
    }
  };
  const thump = t => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(40, t + .14);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(.6, t + .015);
    g.gain.exponentialRampToValueAtTime(.0001, t + .2);
    o.connect(g).connect(ac.destination);
    o.start(t); o.stop(t + .25);
  };
  const BPM = 150;
  const period = 60000 / BPM;
  $('#heartBtn').onclick = () => {
    ctx(); ac.resume();
    heartOn = !heartOn;
    $('#heartBtn').setAttribute('aria-pressed', heartOn);
    $('#heartBtn').classList.toggle('on', heartOn);
    $('#babyBubble').classList.toggle('beat', heartOn);
    $('#babyBubble').style.setProperty('--bpm', period + 'ms');
    clearInterval(heartT);
    if (heartOn) {
      const b = () => { const t = ac.currentTime + .02; thump(t); thump(t + .2); };
      b();
      heartT = setInterval(b, period);
      toast('💓 Latido del bebé');
    }
  };
}

function initShare() {
  const url = location.href.split('?')[0];
  const text = `🎀 ¡Estás invitado/a al Baby Shower & Gender Reveal de ${CFG.PARENTS}!\n\n📅 17 de noviembre de 2026\n🕓 16:00\n📍 ${CFG.PLACE.name}\n\n¡Acompáñanos a descubrir el gran secreto! 💗💙\n\n` + url;
  const shareBtn = $('#shareBtn');
  const waShare = $('#waShare');
  if (waShare) {
    waShare.href = 'https://wa.me/?text=' + encodeURIComponent(text);
    waShare.target = '_blank';
    waShare.rel = 'noopener noreferrer';
  }
  if (shareBtn) {
    shareBtn.onclick = async () => {
      try {
        if (navigator.share) {
          await navigator.share({ title: `Baby Shower de ${CFG.PARENTS}`, text, url });
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          toast('¡Invitación copiada para compartir! 💕');
        } else {
          toast('Utiliza el botón de WhatsApp para compartir.');
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.warn('No se pudo compartir:', error);
          toast('No se pudo compartir la invitación.');
        }
      }
    };
  }
}