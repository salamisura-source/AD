const KEY = 'ad.produzione.v1';
const BADGE_KEY = 'ad.badge';
const AUTO_KEY = 'ad.autodownload';
const HINT_KEY = 'ad.hintDismissed';
const LEGACY_KEY = 'ad.legacyImported';
const DRAFT_KEY = 'ad.draft';

const STEPS = [
  { key: 'commessa', list: 'commesse', label: 'Commessa', title: 'Scegli la commessa' },
  { key: 'prodotto', list: 'prodotti', label: 'Prodotto', title: 'Scegli il prodotto' },
  { key: 'fase', list: 'fasi', label: 'Fase', title: 'Scegli la fase' },
  { key: 'colore', list: 'colori', label: 'Colore', title: 'Scegli il colore' }
];

const COLS = [
  ['date', 'Data'],
  ['time', 'Ora'],
  ['operatore', 'Operatore'],
  ['commessa', 'Commessa'],
  ['prodotto', 'Prodotto'],
  ['fase', 'Fase'],
  ['colore', 'Colore'],
  ['qty', 'Pezzi'],
  ['scrap', 'Scarti']
];

const NAMED_COLORS = {
  rosso: '#d64545', blu: '#2f6fe0', verde: '#1f9d55', giallo: '#e2b31c', nero: '#1c1c1c',
  marrone: '#8a5a2b', sabbia: '#d2b48c', cuoio: '#a97449', bianco: '#f7f7f7', grigio: '#8d97a3',
  grey: '#8d97a3', gray: '#8d97a3', arancio: '#ef8a2a', arancione: '#ef8a2a', rosa: '#e57aa6',
  viola: '#7a5af0', beige: '#e6d3b3', oro: '#d4a017', argento: '#c0c6ce', celeste: '#7ec8e3',
  bordeaux: '#7a1f2b', trasparente: '#dfe7ee'
};

const emptyCfg = () => ({
  commesse: [], prodotti: [], fasi: [], colori: [], pezzi: [], scarti: [], operatori: []
});

function parseDelimited(text) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const first = src.split(/\r?\n/, 1)[0] || '';
  const delim = first.split(';').length > first.split(',').length ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((value) => String(value).trim()));
}

function rowsToCfg(rows) {
  const cfg = emptyCfg();
  if (!rows || !rows.length) return cfg;
  const header = rows[0].map((value) => String(value || '').trim().toLowerCase());
  const names = ['commessa', 'prodotto', 'fase', 'colore', 'pezzi', 'scarti', 'operatore'];
  const index = {};
  names.forEach((name, position) => {
    const found = header.indexOf(name);
    index[name] = found >= 0 ? found : position;
  });
  const hasHeader = names.some((name) => header.includes(name));
  const body = hasHeader ? rows.slice(1) : rows;
  const seen = Object.fromEntries(names.map((name) => [name, new Set()]));
  const buckets = {
    commessa: cfg.commesse,
    prodotto: cfg.prodotti,
    fase: cfg.fasi,
    colore: cfg.colori,
    pezzi: cfg.pezzi,
    scarti: cfg.scarti,
    operatore: cfg.operatori
  };
  body.forEach((record) => {
    names.forEach((name) => {
      const raw = record[index[name]];
      if (raw === undefined || raw === null) return;
      const value = String(raw).trim();
      if (!value || seen[name].has(value)) return;
      if (name === 'pezzi' || name === 'scarti') {
        const number = Number(value.replace(',', '.'));
        if (!Number.isFinite(number)) return;
        seen[name].add(value);
        buckets[name].push(number);
        return;
      }
      seen[name].add(value);
      buckets[name].push(value);
    });
  });
  return cfg;
}

function colorOf(name) {
  const key = String(name || '').trim().toLowerCase();
  if (NAMED_COLORS[key]) return NAMED_COLORS[key];
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 58% 46%)`;
}

function todayKey(date = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${z(date.getMonth() + 1)}-${z(date.getDate())}`;
}

function nowTime(date = new Date()) {
  return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function clockText(date = new Date()) {
  return date.toLocaleDateString('it-IT') + ' · ' + nowTime(date);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function loadRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((row) => row && typeof row === 'object') : [];
  } catch {
    return [];
  }
}

function inList(value, list) {
  const text = String(value ?? '').trim();
  if (!text) return false;
  if (list.includes(text)) return true;
  if (/^\d+$/.test(text)) {
    const number = String(Number(text));
    return list.some((item) => /^\d+$/.test(String(item).trim()) && String(Number(item)) === number);
  }
  return false;
}

function canonical(value, list) {
  const text = String(value ?? '').trim();
  if (list.includes(text)) return text;
  if (/^\d+$/.test(text)) {
    const number = String(Number(text));
    const hit = list.find((item) => /^\d+$/.test(String(item).trim()) && String(Number(item)) === number);
    if (hit) return String(hit).trim();
  }
  return text;
}

function chipValues(list, fallback) {
  const numbers = [...new Set((list || []).filter((n) => Number.isFinite(n)))].sort((a, b) => a - b);
  if (!numbers.length) return fallback;
  return numbers.slice(0, 16);
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toExcelHtml(rows, title) {
  const head = COLS.map((col) => `<th>${col[1]}</th>`).join('');
  const body = rows.map((row) => '<tr>' + COLS.map((col) => `<td>${esc(row[col[0]])}</td>`).join('') + '</tr>').join('');
  return `<html><head><meta charset="UTF-8"></head><body><h2>${esc(title)}</h2><table border="1"><tr>${head}</tr>${body}</table></body></html>`;
}

function toCsv(rows) {
  const sep = ';';
  const lines = [COLS.map((col) => col[1]).join(sep)];
  rows.forEach((row) => {
    lines.push(COLS.map((col) => {
      let value = String(row[col[0]] ?? '');
      if (value.includes(sep) || value.includes('"') || value.includes('\n')) {
        value = '"' + value.replace(/"/g, '""') + '"';
      }
      return value;
    }).join(sep));
  });
  return '\uFEFF' + lines.join('\r\n');
}

function norm(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseDelimited, rowsToCfg, colorOf, todayKey, toCsv, inList, canonical };
}

function boot() {
  const $ = (id) => document.getElementById(id);
  const toastEl = $('toast');
  const modal = $('modal');
  let toastTimer = 0;
  let modalResolve = null;
  let cfg = emptyCfg();
  let sourceLabel = '';
  let level = 0;
  let pick = { commessa: '', prodotto: '', fase: '', colore: '' };
  let qty = 1;
  let scrap = 0;
  let query = '';
  let records = loadRecords();
  let badge = localStorage.getItem(BADGE_KEY) || '';
  let autoDownload = localStorage.getItem(AUTO_KEY) !== '0';
  let saveFolder = null;
  let historyOn = false;
  let historyScope = 'today';
  let historyQuery = '';
  let saving = false;

  importLegacy();
  restoreDraft();

  function toast(text, kind = '') {
    toastEl.textContent = text;
    toastEl.className = 'toast' + (kind ? ' ' + kind : '');
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3600);
  }

  function vibrate(pattern) {
    try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
  }

  function closeModal(value = null) {
    modal.hidden = true;
    modal.replaceChildren();
    const resolve = modalResolve;
    modalResolve = null;
    if (resolve) resolve(value);
  }

  function openSheet(build) {
    return new Promise((resolve) => {
      if (modalResolve) closeModal(null);
      modalResolve = resolve;
      modal.hidden = false;
      modal.replaceChildren();
      const sheet = document.createElement('div');
      sheet.className = 'sheet';
      sheet.setAttribute('role', 'dialog');
      sheet.setAttribute('aria-modal', 'true');
      modal.append(sheet);
      build(sheet, (value) => closeModal(value));
      const focus = sheet.querySelector('button, input');
      focus?.focus();
    });
  }

  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal(null);
  });

  function askConfirm(message, okLabel) {
    return openSheet((sheet, done) => {
      const title = document.createElement('h2');
      title.textContent = 'Conferma';
      const text = document.createElement('p');
      text.textContent = message;
      const row = document.createElement('div');
      row.className = 'actions';
      const cancel = button('Annulla', 'action ghost', () => done(false));
      const ok = button(okLabel || 'Conferma', 'action danger', () => done(true));
      row.append(cancel, ok);
      sheet.append(title, text, row);
    });
  }

  function askNumber({ title, value, maxLen, validate }) {
    return openSheet((sheet, done) => {
      let current = String(value ?? '');
      const heading = document.createElement('h2');
      heading.textContent = title;
      const display = document.createElement('div');
      display.className = 'pad-display';
      const status = document.createElement('div');
      status.className = 'pad-status';
      const pad = document.createElement('div');
      pad.className = 'pad';
      const paint = () => {
        display.textContent = current || '—';
        const result = validate ? validate(current) : { ok: true, text: '' };
        status.textContent = result.text || '';
        status.className = 'pad-status' + (result.ok ? ' good' : current ? ' bad' : '');
      };
      const push = (digit) => {
        if (current.length >= maxLen) return;
        current += digit;
        paint();
      };
      '123456789'.split('').forEach((digit) => pad.append(button(digit, '', () => push(digit))));
      pad.append(button('C', 'muted', () => { current = ''; paint(); }));
      pad.append(button('0', '', () => push('0')));
      pad.append(button('⌫', 'muted', () => { current = current.slice(0, -1); paint(); }));
      const row = document.createElement('div');
      row.className = 'actions';
      row.style.marginTop = '12px';
      row.append(
        button('Annulla', 'action ghost', () => done(null)),
        button('OK', 'action primary', () => done(current))
      );
      sheet.append(heading, display, status, pad, row);
      paint();
    });
  }

  function button(label, className, onClick) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = className || '';
    node.textContent = label;
    node.addEventListener('click', onClick);
    return node;
  }

  function importLegacy() {
    if (localStorage.getItem(LEGACY_KEY)) return;
    try {
      const old = JSON.parse(localStorage.getItem('prod') || '[]');
      if (Array.isArray(old) && old.length) {
        const known = new Set(records.map((row) => [row.date, row.time, row.operatore, row.commessa, row.prodotto, row.fase, row.colore, row.qty, row.scrap].join('|')));
        old.forEach((row) => {
          if (!row || typeof row !== 'object') return;
          const signature = [row.date, row.time, row.operatore, row.commessa, row.prodotto, row.fase, row.colore, row.qty, row.scrap].join('|');
          if (known.has(signature)) return;
          records.push({ ...row, id: row.id || uid(), qty: Number(row.qty) || 0, scrap: Number(row.scrap) || 0 });
        });
        persist();
      }
    } catch { /* ignore broken legacy data */ }
    localStorage.setItem(LEGACY_KEY, '1');
  }

  function persist() {
    localStorage.setItem(KEY, JSON.stringify(records));
  }

  function saveDraft() {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ level, pick, qty, scrap, query }));
  }

  function restoreDraft() {
    try {
      const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
      if (!draft) return;
      level = Number(draft.level) || 0;
      pick = { ...pick, ...(draft.pick || {}) };
      qty = Number.isFinite(draft.qty) ? draft.qty : 1;
      scrap = Number.isFinite(draft.scrap) ? draft.scrap : 0;
      query = draft.query || '';
    } catch { /* ignore */ }
  }

  function sanitizeDraft() {
    STEPS.forEach((step, index) => {
      if (pick[step.key] && !(cfg[step.list] || []).includes(pick[step.key])) {
        pick[step.key] = '';
        level = Math.min(level, index);
      }
    });
    if (level > 4) level = 0;
    if (level === 4 && !pick.colore) level = 3;
  }

  function applyCfg(next, label) {
    cfg = next;
    sourceLabel = label;
    sanitizeDraft();
    renderDataLine();
    render();
  }

  async function loadRemote() {
    const response = await fetch('produzione_dipendenze.csv', { cache: 'no-store' });
    if (!response.ok) throw new Error('File elenchi non trovato (' + response.status + ')');
    applyCfg(rowsToCfg(parseDelimited(await response.text())), 'produzione_dipendenze.csv');
  }

  async function loadFile(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.csv') || name.endsWith('.txt')) {
      applyCfg(rowsToCfg(parseDelimited(await file.text())), file.name + ' (file locale)');
      toast('Elenchi caricati da ' + file.name, 'ok');
      return;
    }
    if (!window.XLSX) {
      toast('Lettura Excel non disponibile. Esporta il foglio in CSV.');
      return;
    }
    const book = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheet = book.Sheets[book.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
    applyCfg(rowsToCfg(rows), file.name + ' (file locale)');
    toast('Elenchi caricati da ' + file.name, 'ok');
  }

  function renderDataLine() {
    const counts = cfg.commesse.length
      ? `${cfg.commesse.length} commesse · ${cfg.prodotti.length} prodotti · ${cfg.fasi.length} fasi · ${cfg.colori.length} colori · ${cfg.operatori.length} operatori`
      : 'Elenchi non caricati';
    $('dataLine').textContent = sourceLabel ? counts + ' · ' + sourceLabel : counts;
  }

  function renderBadge() {
    const node = $('badgeBtn');
    const known = badge && inList(badge, cfg.operatori);
    node.textContent = badge ? 'Badge ' + badge : 'Badge';
    node.className = 'badge-btn' + (badge ? (known || !cfg.operatori.length ? ' known' : '') : ' missing');
    node.title = badge
      ? (known ? 'Operatore presente in elenco' : 'Numero non presente in elenco')
      : 'Inserisci il numero badge';
  }

  function renderChoices() {
    const box = $('choices');
    box.replaceChildren();
    STEPS.forEach((step) => {
      const item = document.createElement('div');
      const label = document.createElement('span');
      label.textContent = step.label + ' ';
      const strong = document.createElement('strong');
      strong.textContent = pick[step.key] || '—';
      item.append(label, strong);
      box.append(item);
    });
  }

  function canGoto(index) {
    if (index <= level) return true;
    return STEPS.slice(0, index).every((step) => pick[step.key]);
  }

  function renderProgress() {
    const box = $('progress');
    box.replaceChildren();
    STEPS.forEach((step, index) => {
      const node = document.createElement('button');
      node.type = 'button';
      node.className = 'step' + (index === level ? ' active' : '') + (pick[step.key] && index !== level ? ' done' : '');
      node.textContent = (index + 1) + ' ' + step.label;
      node.disabled = !canGoto(index);
      node.addEventListener('click', () => {
        if (!canGoto(index)) return;
        level = index;
        saveDraft();
        render();
      });
      box.append(node);
    });
  }

  function renderActions() {
    const box = $('actions');
    box.replaceChildren();
    const back = button('← Indietro', 'action', () => goBack());
    back.disabled = level === 0;
    const reset = button('Nuova registrazione', 'action ghost', () => resetAll(true));
    box.append(back, reset);
    if (level === 4) {
      const cancel = button('Annulla', 'action danger', () => resetAll(false));
      const edit = button('← Modifica', 'action ghost', () => goBack());
      const saveBtn = button('REGISTRA PRODUZIONE', 'action primary', () => saveRecord());
      box.replaceChildren(cancel, edit, saveBtn);
    }
  }

  function visibleValues(step) {
    const values = cfg[step.list] || [];
    const needle = norm(query);
    if (!needle) return values;
    return values.filter((value) => norm(value).includes(needle));
  }

  function choose(value) {
    const step = STEPS[level];
    if (!step) return;
    pick[step.key] = value;
    vibrate(12);
    if (level < 3) level += 1;
    else level = 4;
    query = '';
    saveDraft();
    render();
  }

  function renderStage() {
    const stage = $('stage');
    stage.replaceChildren();
    if (!cfg.commesse.length && level < 4) {
      const title = document.createElement('h2');
      title.className = 'title';
      title.textContent = 'Elenchi non disponibili';
      const note = document.createElement('div');
      note.className = 'empty';
      note.textContent = 'Non riesco a leggere produzione_dipendenze.csv. Usa Menu → Carica file Excel o CSV, oppure ricarica gli elenchi.';
      const reload = button('Ricarica elenchi', 'action', () => reloadLists());
      reload.style.marginTop = '12px';
      stage.append(title, note, reload);
      return;
    }
    if (level < 4) {
      const step = STEPS[level];
      const title = document.createElement('h2');
      title.className = 'title';
      title.textContent = step.title;
      const search = document.createElement('input');
      search.className = 'search';
      search.type = 'search';
      search.placeholder = 'Cerca…';
      search.autocomplete = 'off';
      search.value = query;
      search.addEventListener('input', () => {
        query = search.value;
        saveDraft();
        paintGrid();
      });
      search.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          const values = visibleValues(step);
          if (values.length === 1) choose(values[0]);
        }
      });
      const grid = document.createElement('div');
      grid.className = 'grid';
      grid.id = 'grid';
      stage.append(title, search, grid);
      paintGrid();
      return;
    }
    renderDone(stage);
  }

  function paintGrid() {
    const grid = document.getElementById('grid');
    if (!grid) return;
    const step = STEPS[level];
    grid.replaceChildren();
    const values = visibleValues(step);
    if (!values.length) {
      const note = document.createElement('div');
      note.className = 'empty';
      note.textContent = query ? 'Nessuna voce corrisponde alla ricerca.' : 'Nessun valore in questa colonna.';
      grid.append(note);
      return;
    }
    values.forEach((value) => {
      const node = document.createElement('button');
      node.type = 'button';
      node.className = 'tile' + (value.length > 14 ? ' long' : '') + (pick[step.key] === value ? ' selected' : '');
      if (step.key === 'colore') {
        node.classList.add('color');
        const swatch = document.createElement('span');
        swatch.className = 'swatch';
        swatch.style.background = colorOf(value);
        node.append(swatch);
      }
      node.append(document.createTextNode(value));
      node.addEventListener('click', () => choose(value));
      grid.append(node);
    });
  }

  function setQty(next) {
    qty = Math.max(0, Math.min(9999, next));
    saveDraft();
    renderStage();
  }

  function setScrap(next) {
    scrap = Math.max(0, Math.min(9999, next));
    saveDraft();
    renderStage();
  }

  function qtyBox(title, value, list, fallback, onChange) {
    const box = document.createElement('div');
    box.className = 'qtybox';
    const heading = document.createElement('h3');
    heading.textContent = title;
    const num = document.createElement('button');
    num.type = 'button';
    num.className = 'qty-num';
    num.textContent = String(value);
    num.addEventListener('click', async () => {
      const typed = await askNumber({
        title,
        value: String(value),
        maxLen: 4,
        validate: (current) => ({ ok: current === '' || /^\d+$/.test(current), text: 'Tocca il numero per la tastiera' })
      });
      if (typed == null) return;
      onChange(typed === '' ? 0 : Number(typed));
    });
    const stepper = document.createElement('div');
    stepper.className = 'stepper';
    stepper.append(
      button('−', '', () => onChange(value - 1)),
      button('+', '', () => onChange(value + 1))
    );
    const chips = document.createElement('div');
    chips.className = 'chips';
    chipValues(list, fallback).forEach((n) => {
      const chip = button(String(n), n === value ? 'on' : '', () => onChange(n));
      chips.append(chip);
    });
    box.append(heading, num, stepper, chips);
    return box;
  }

  function renderDone(stage) {
    const title = document.createElement('h2');
    title.className = 'title';
    title.textContent = 'Controlla e registra';
    const row = document.createElement('div');
    row.className = 'qty-row';
    row.append(
      qtyBox('Pezzi', qty, cfg.pezzi, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20], setQty),
      qtyBox('Scarti', scrap, cfg.scarti, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], setScrap)
    );
    const list = document.createElement('ul');
    list.className = 'summary';
    const lines = [
      ['Operatore', badge || 'manca il badge'],
      ['Commessa', pick.commessa],
      ['Prodotto', pick.prodotto],
      ['Fase', pick.fase],
      ['Colore', pick.colore],
      ['Ora', clockText()]
    ];
    lines.forEach(([label, value]) => {
      const item = document.createElement('li');
      const span = document.createElement('span');
      span.textContent = label;
      const strong = document.createElement('strong');
      strong.textContent = value || '—';
      if (label === 'Ora') strong.id = 'liveTime';
      if (label === 'Colore' && value) {
        const swatch = document.createElement('span');
        swatch.className = 'swatch';
        swatch.style.background = colorOf(value);
        swatch.style.display = 'inline-block';
        swatch.style.verticalAlign = 'middle';
        swatch.style.marginRight = '8px';
        strong.prepend(swatch);
      }
      item.append(span, strong);
      list.append(item);
    });
    stage.append(title, row, list);
    if (scrap > qty) {
      const note = document.createElement('p');
      note.className = 'warn-note';
      note.textContent = 'Gli scarti sono più dei pezzi. Controlla prima di registrare.';
      stage.append(note);
    }
  }

  function render() {
    renderBadge();
    renderProgress();
    renderChoices();
    renderStage();
    renderActions();
    renderBanner();
    if (historyOn) renderHistory();
  }

  function renderBanner() {
    const banner = $('banner');
    if (localStorage.getItem(HINT_KEY) || !cfg.commesse.length) {
      banner.hidden = true;
      return;
    }
    banner.hidden = false;
    banner.replaceChildren();
    const text = document.createElement('span');
    text.textContent = 'Le registrazioni restano su questo dispositivo. A ogni registrazione viene anche scaricato il riepilogo Excel della giornata: si può disattivare dal Menu.';
    const close = button('OK', '', () => {
      localStorage.setItem(HINT_KEY, '1');
      banner.hidden = true;
    });
    banner.append(text, close);
  }

  function goBack() {
    if (!level) return;
    level -= 1;
    query = '';
    saveDraft();
    render();
  }

  async function resetAll(ask) {
    const dirty = pick.commessa || pick.prodotto || pick.fase || pick.colore;
    if (ask && dirty) {
      const ok = await askConfirm('Azzerare la registrazione in corso?', 'Azzera');
      if (!ok) return;
    }
    level = 0;
    pick = { commessa: '', prodotto: '', fase: '', colore: '' };
    qty = 1;
    scrap = 0;
    query = '';
    saveDraft();
    render();
  }

  async function ensureBadge() {
    if (badge) return true;
    const typed = await askNumber({
      title: 'Badge operatore',
      value: '',
      maxLen: 6,
      validate: (current) => {
        if (!current) return { ok: false, text: 'Inserisci il numero' };
        if (!cfg.operatori.length) return { ok: true, text: '' };
        return inList(current, cfg.operatori)
          ? { ok: true, text: 'Presente in elenco' }
          : { ok: false, text: 'Non è in elenco: puoi comunque confermare' };
      }
    });
    if (!typed) return false;
    badge = canonical(typed, cfg.operatori);
    localStorage.setItem(BADGE_KEY, badge);
    renderBadge();
    return true;
  }

  async function changeBadge() {
    const typed = await askNumber({
      title: 'Badge operatore',
      value: badge,
      maxLen: 6,
      validate: (current) => {
        if (!current) return { ok: false, text: 'Il badge è obbligatorio per registrare' };
        if (!cfg.operatori.length) return { ok: true, text: '' };
        return inList(current, cfg.operatori)
          ? { ok: true, text: 'Presente in elenco' }
          : { ok: false, text: 'Non è in elenco: puoi comunque confermare' };
      }
    });
    if (typed == null) return;
    badge = typed ? canonical(typed, cfg.operatori) : '';
    if (badge) localStorage.setItem(BADGE_KEY, badge);
    else localStorage.removeItem(BADGE_KEY);
    renderBadge();
    if (level === 4) renderStage();
  }

  function dayRecords(day) {
    return records.filter((row) => row.date === day);
  }

  async function writeFile(name, content, mime) {
    const blob = new Blob([content], { type: mime });
    if (saveFolder) {
      const handle = await saveFolder.getFileHandle(name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return 'folder';
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1500);
    return 'download';
  }

  async function exportRows(rows, stem) {
    if (!rows.length) {
      toast('Niente da esportare');
      return;
    }
    const csvName = stem + '.csv';
    await writeFile(csvName, toCsv(rows), 'text/csv;charset=utf-8');
    toast(saveFolder ? 'File salvato nella cartella' : 'File scaricato: ' + csvName, 'ok');
  }

  async function saveRecord() {
    if (saving) return;
    saving = true;
    try {
    if (!(await ensureBadge())) return;
    if (!pick.commessa || !pick.prodotto || !pick.fase || !pick.colore) {
      toast('Completa commessa, prodotto, fase e colore');
      return;
    }
    const now = new Date();
    const record = {
      id: uid(),
      date: todayKey(now),
      time: nowTime(now),
      operatore: badge,
      commessa: pick.commessa,
      prodotto: pick.prodotto,
      fase: pick.fase,
      colore: pick.colore,
      qty,
      scrap
    };
    records.push(record);
    try { persist(); }
    catch {
      records.pop();
      toast('Memoria del browser piena. Esporta e svuota lo storico.');
      return;
    }
    vibrate([18, 30, 18]);
    let where = 'su questo dispositivo';
    if (saveFolder || autoDownload) {
      try {
        const mode = await writeFile(
          'riepilogo_produzione_' + record.date + '.xls',
          toExcelHtml(dayRecords(record.date), 'Riepilogo produzione ' + record.date),
          'application/vnd.ms-excel'
        );
        where = mode === 'folder' ? 'nella cartella scelta' : 'e scaricato il riepilogo Excel';
      } catch {
        where = 'sul dispositivo, ma il file Excel non è stato scritto';
      }
    }
    toast('Registrato ' + qty + ' pezzi' + (scrap ? ', ' + scrap + ' scarti' : '') + ' · ' + where, 'ok');
    level = 0;
    pick = { commessa: '', prodotto: '', fase: '', colore: '' };
    qty = 1;
    scrap = 0;
    query = '';
    saveDraft();
    render();
    } finally {
      saving = false;
    }
  }

  function filteredHistory() {
    const needle = norm(historyQuery);
    return records.filter((row) => {
      if (historyScope === 'today' && row.date !== todayKey()) return false;
      if (!needle) return true;
      return norm([row.operatore, row.commessa, row.prodotto, row.fase, row.colore, row.date, row.time].join(' ')).includes(needle);
    }).slice().reverse();
  }

  function renderHistory() {
    const rows = filteredHistory();
    const pezzi = rows.reduce((sum, row) => sum + (Number(row.qty) || 0), 0);
    const scarti = rows.reduce((sum, row) => sum + (Number(row.scrap) || 0), 0);
    const stats = $('historyStats');
    stats.replaceChildren();
    [['Registrazioni', rows.length], ['Pezzi', pezzi], ['Scarti', scarti]].forEach(([label, value]) => {
      const card = document.createElement('div');
      card.className = 'stat';
      const strong = document.createElement('b');
      strong.textContent = String(value);
      const span = document.createElement('span');
      span.textContent = label;
      card.append(strong, span);
      stats.append(card);
    });
    const groups = $('historyGroups');
    groups.replaceChildren();
    const byJob = new Map();
    rows.forEach((row) => {
      const key = row.commessa || '—';
      const current = byJob.get(key) || 0;
      byJob.set(key, current + (Number(row.qty) || 0));
    });
    [...byJob.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([name, total]) => {
      const chip = document.createElement('span');
      chip.textContent = name + ' · ' + total + ' pz';
      groups.append(chip);
    });
    const body = $('historyRows');
    body.replaceChildren();
    if (!rows.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 10;
      td.textContent = 'Nessuna registrazione' + (historyScope === 'today' ? ' oggi' : '') + ' su questo dispositivo.';
      tr.append(td);
      body.append(tr);
    }
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      COLS.forEach((col) => {
        const td = document.createElement('td');
        td.textContent = String(row[col[0]] ?? '');
        tr.append(td);
      });
      const td = document.createElement('td');
      td.append(button('Elimina', 'del', () => removeRecord(row.id)));
      tr.append(td);
      body.append(tr);
    });
    $('scopeToday').classList.toggle('on', historyScope === 'today');
    $('scopeAll').classList.toggle('on', historyScope === 'all');
  }

  async function removeRecord(id) {
    const row = records.find((item) => item.id === id);
    if (!row) return;
    const ok = await askConfirm('Eliminare la registrazione delle ' + (row.time || '') + '?', 'Elimina');
    if (!ok) return;
    records = records.filter((item) => item.id !== id);
    persist();
    renderHistory();
    toast('Registrazione eliminata', 'warn');
  }

  function showHistory(on) {
    historyOn = on;
    $('wizard').hidden = on;
    $('history').hidden = !on;
    $('historyBtn').textContent = on ? 'Registra' : 'Storico';
    if (on) renderHistory();
  }

  async function reloadLists() {
    try {
      await loadRemote();
      toast('Elenchi aggiornati', 'ok');
    } catch (error) {
      toast(error.message || 'Impossibile ricaricare gli elenchi');
    }
  }

  async function selectFolder() {
    if (!window.showDirectoryPicker) {
      toast('Questo browser non può scrivere in una cartella. I file verranno scaricati.');
      return;
    }
    try {
      saveFolder = await showDirectoryPicker({ mode: 'readwrite' });
      toast('Cartella di salvataggio collegata', 'ok');
    } catch { /* user cancelled */ }
  }

  function openMenu() {
    openSheet((sheet, done) => {
      const title = document.createElement('h2');
      title.textContent = 'Menu';
      const info = document.createElement('p');
      info.textContent = sourceLabel
        ? 'Elenchi: ' + sourceLabel + '. ' + cfg.commesse.length + ' commesse, ' + cfg.operatori.length + ' operatori.'
        : 'Elenchi non caricati.';
      const stack = document.createElement('div');
      stack.className = 'stack';
      stack.append(
        button('Schermo intero', 'action', () => {
          if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => toast('Schermo intero non disponibile'));
          else document.exitFullscreen?.();
        }),
        button('Ricarica elenchi da GitHub', 'action', () => { reloadLists(); done(null); }),
        button('Carica file Excel o CSV', 'action', () => { $('fileInput').click(); done(null); }),
        button(saveFolder ? 'Cartella collegata' : 'Seleziona cartella di salvataggio', 'action', () => selectFolder())
      );
      const line = document.createElement('label');
      line.className = 'checkline';
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = autoDownload;
      check.addEventListener('change', () => {
        autoDownload = check.checked;
        localStorage.setItem(AUTO_KEY, autoDownload ? '1' : '0');
      });
      line.append(check, document.createTextNode('Scarica il riepilogo Excel a ogni registrazione'));
      const note = document.createElement('p');
      note.textContent = 'Senza una cartella collegata il browser scarica riepilogo_produzione_DATA.xls. Le registrazioni restano comunque nello storico di questo dispositivo.';
      const close = button('Chiudi', 'action ghost', () => done(null));
      sheet.append(title, info, stack, line, note, close);
    });
  }

  function tick() {
    const text = clockText();
    $('clock').textContent = text;
    const live = document.getElementById('liveTime');
    if (live) live.textContent = text;
    $('net').classList.toggle('off', !navigator.onLine);
    $('net').title = navigator.onLine ? 'Online' : 'Offline: si usano gli elenchi già scaricati';
  }

  $('badgeBtn').addEventListener('click', changeBadge);
  $('historyBtn').addEventListener('click', () => showHistory(!historyOn));
  $('menuBtn').addEventListener('click', openMenu);
  $('closeHistory').addEventListener('click', () => showHistory(false));
  $('scopeToday').addEventListener('click', () => { historyScope = 'today'; renderHistory(); });
  $('scopeAll').addEventListener('click', () => { historyScope = 'all'; renderHistory(); });
  $('historySearch').addEventListener('input', (event) => { historyQuery = event.target.value; renderHistory(); });
  $('exportToday').addEventListener('click', () => exportRows(dayRecords(todayKey()), 'riepilogo_produzione_' + todayKey()));
  $('exportAll').addEventListener('click', () => exportRows(records.slice(), 'produzione_completa'));
  $('clearHistory').addEventListener('click', async () => {
    if (!records.length) return;
    const ok = await askConfirm('Cancellare ' + records.length + ' registrazioni da questo dispositivo? I file già scaricati non vengono toccati.', 'Svuota');
    if (!ok) return;
    records = [];
    persist();
    renderHistory();
    toast('Storico svuotato', 'warn');
  });
  $('fileInput').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try { await loadFile(file); }
    catch (error) { toast(error.message || 'File non leggibile'); }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!modal.hidden) closeModal(null);
    else if (historyOn) showHistory(false);
    else goBack();
  });
  window.addEventListener('online', tick);
  window.addEventListener('offline', tick);
  setInterval(tick, 1000);
  tick();
  render();
  loadRemote().catch((error) => {
    renderDataLine();
    render();
    toast(error.message || 'Elenchi non caricati');
  });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}
