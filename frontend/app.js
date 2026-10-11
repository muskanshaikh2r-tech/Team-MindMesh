/* VORTEXA 3.0 frontend: vanilla JS single-page app (no build step). */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const usd = (n, d = 4) => '$' + Number(n || 0).toFixed(d);
const ms = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + 's' : Math.round(n) + 'ms');

const DEFAULT_PREFS = { budget: 'low_cost', max_latency_ms: 1000, min_capability: 4, context_tokens: 8000 };
const LAB_PREFS = { budget: 'balanced', max_latency_ms: 2000, min_capability: 3, context_tokens: 4000 };
const state = {
  token: localStorage.getItem('vx_token'),
  user: null, models: [], health: { tts: 'browser' },
  prefs: JSON.parse(localStorage.getItem('vx_prefs') || 'null') || { ...DEFAULT_PREFS },
  labPrefs: { ...LAB_PREFS },
  last: null, filter: 'all', draft: '', pendingEmail: '', devOtp: null, otpDeadline: 0,
  voiceTab: false, labResult: null,
};
let timer = null, audio = null;

const LOGO = `<svg width="44" height="44" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6a4cff"/><stop offset="1" stop-color="#18b8ff"/></linearGradient></defs><circle cx="24" cy="24" r="21" fill="none" stroke="url(#lg)" stroke-width="3" stroke-dasharray="90 40"/><circle cx="24" cy="24" r="14" fill="none" stroke="url(#lg)" stroke-width="3" stroke-dasharray="50 40" transform="rotate(120 24 24)"/><circle cx="24" cy="24" r="6" fill="url(#lg)"/></svg>`;

function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'show' + (err ? ' err' : '');
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = ''), 3800);
}

async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && state.token) headers.Authorization = 'Bearer ' + state.token;
  let res;
  try { res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw Object.assign(new Error('Cannot reach the server. Is the backend running?'), { status: 0 }); }
  if (res.status === 401 && auth) { logout(false); throw Object.assign(new Error('Your session expired. Log in again.'), { status: 401 }); }
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.blob();
  if (!res.ok) {
    let msg = typeof data?.detail === 'string' ? data.detail : 'Check your input and try again.';
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return data;
}

function logout(call = true) {
  if (call && state.token) api('/auth/logout', { method: 'POST' }).catch(() => {});
  state.token = null; state.user = null; localStorage.removeItem('vx_token');
  if (location.hash !== '#/login') location.hash = '#/login';
}

/* ---------- shared pieces ---------- */
function brand(small = true) {
  return `<div class="brand">${LOGO}<div><b>VORTEXA <i>3.0</i></b>${small ? '<small>ModelRouter × ElevenLabs</small>' : ''}</div></div>`;
}
function passwordField(id, label, ph) {
  return `<label class="field"><span>${label}</span><div class="input"><span class="ico">🔒</span><input id="${id}" type="password" placeholder="${ph}" autocomplete="off"><button type="button" class="eye" data-eye="${id}" aria-label="Show or hide password">👁</button></div></label>`;
}
function bindEyes() { $$('[data-eye]').forEach((b) => (b.onclick = () => { const i = $('#' + b.dataset.eye); i.type = i.type === 'password' ? 'text' : 'password'; })); }

const NAV = [['home', '⌂', 'Home'], ['playground', '◈', 'Playground'], ['flow', '⇄', 'Routing Flow'], ['lab', '⚗', 'Model Lab'], ['analytics', '▤', 'Analytics'], ['settings', '⚙', 'Settings']];
function shell(active, inner, topExtra = '') {
  const u = state.user || { name: '?', email: '' };
  return `<div class="shell"><aside class="side">${brand()}
    <div class="me"><div class="avatar">${esc(u.name[0]?.toUpperCase())}</div><div><b>${esc(u.name)}</b><small>${esc(u.email)}</small></div></div>
    <nav class="nav">${NAV.map(([k, g, l]) => `<a href="#/${k}" class="${k === active ? 'on' : ''}"><span class="g">${g}</span>${l}</a>`).join('')}</nav>
    <div class="spacer"></div><nav class="nav"><a href="#/login" id="logout"><span class="g">⎋</span>Log Out</a></nav></aside>
    <main class="main"><div class="topbar">${topExtra}<button class="pill" id="va">🎙 Voice Assistant</button></div>${inner}</main></div>`;
}
function bindShell() {
  const lo = $('#logout'); if (lo) lo.onclick = (e) => { e.preventDefault(); logout(); };
  const va = $('#va'); if (va) va.onclick = () => { state.voiceTab = true; location.hash = '#/playground'; };
}

/* preferences controls */
const OPT = {
  budget: [['low_cost', 'Low Cost'], ['balanced', 'Balanced'], ['high_quality', 'High Quality']],
  max_latency_ms: [500, 1000, 2000, 3000, 5000].map((v) => [v, `${v / 1000}s (${v}ms)`]),
  min_capability: [[1, 'Any (1/5)'], [2, 'Basic (2/5)'], [3, 'Medium (3/5)'], [4, 'High (4/5)'], [5, 'Highest (5/5)']],
  context_tokens: [2000, 4000, 8000, 16000, 32000].map((v) => [v, `${v / 1000}K tokens`]),
};
const PLABEL = { budget: '💰 Budget Preference', max_latency_ms: '⏱ Max Latency', min_capability: '★ Min. Capability', context_tokens: '▭ Context Length' };
function prefsHtml(p, pre) {
  return `<div class="prefs">${Object.keys(OPT).map((k) => `<div class="pref"><label for="${pre}${k}">${PLABEL[k]}</label><select id="${pre}${k}">${OPT[k].map(([v, l]) => `<option value="${v}" ${String(p[k]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`).join('')}</div>`;
}
function bindPrefs(p, pre, persist) {
  Object.keys(OPT).forEach((k) => { const s = $('#' + pre + k); if (s) s.onchange = () => { p[k] = k === 'budget' ? s.value : Number(s.value); if (persist) localStorage.setItem('vx_prefs', JSON.stringify(p)); }; });
}

/* voice input */
function startVoice(input, btn) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast('Voice input needs Chrome or Edge. Type your question instead.', true);
  if (btn.classList.contains('live') && startVoice.rec) { startVoice.rec.stop(); return; }
  const rec = new SR(); startVoice.rec = rec; rec.lang = navigator.language || 'en-US'; rec.interimResults = true;
  rec.onstart = () => btn.classList.add('live');
  rec.onend = () => btn.classList.remove('live');
  rec.onerror = (e) => toast(e.error === 'not-allowed' ? 'Allow microphone access to use voice input.' : 'Voice input stopped: ' + e.error, true);
  rec.onresult = (e) => { input.value = [...e.results].map((r) => r[0].transcript).join(' ').slice(0, 1000); input.dispatchEvent(new Event('input')); };
  rec.start();
}

/* ask box shared by Home + Playground */
function askHtml(placeholder) {
  return `<div class="askbox"><button class="mic" id="mic" aria-label="Speak your question">🎙</button>
    <textarea id="q" rows="1" maxlength="1000" placeholder="${placeholder}">${esc(state.draft)}</textarea><span class="count" id="cnt">0/1000</span>
    <button class="mic" id="go-mini" aria-label="Route">➤</button></div>`;
}
function bindAsk() {
  const q = $('#q'), cnt = $('#cnt');
  const upd = () => { state.draft = q.value; cnt.textContent = `${q.value.length}/1000`; q.style.height = 'auto'; q.style.height = Math.min(q.scrollHeight, 140) + 'px'; };
  q.oninput = upd; upd();
  $('#mic').onclick = () => startVoice(q, $('#mic'));
  const go = async () => {
    const prompt = q.value.trim();
    if (!prompt) return toast('Type or speak a question first.', true);
    $$('#go,#go-mini').forEach((b) => (b.disabled = true)); const g = $('#go'); if (g) g.textContent = 'Routing…';
    try { state.last = await api('/route', { method: 'POST', body: { prompt, preferences: state.prefs } }); state.filter = 'all'; location.hash = '#/flow'; }
    catch (e) { toast(e.message, true); $$('#go,#go-mini').forEach((b) => (b.disabled = false)); if (g) g.textContent = 'Route My Question  →'; }
  };
  $('#go').onclick = go; $('#go-mini').onclick = go;
  q.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } };
}

/* ---------- auth views ---------- */
function authFrame(form, signup = false) {
  const feats = [['⚙', 'Intelligent Model Selection'], ['⏱', 'Cost & Latency Optimization'], ['🎙', 'Voice Powered AI'], ['▤', 'Real-time Analytics']];
  return `<div class="auth"><div class="auth-card"><div class="auth-brand">${brand()}<p class="tagline">Smarter Routing. Better AI. Your Voice.</p>
    <div class="features">${feats.map(([i, t]) => `<div><span class="fi">${i}</span>${t}</div>`).join('')}</div></div>
    <div class="auth-form">${form}</div></div></div>`;
}
function viewLogin() {
  return [authFrame(`<h2>Welcome Back</h2><p class="sub">Sign in to continue to your account</p>
    <div class="tabs"><button class="on">Login</button><button id="t-signup">Sign Up</button></div>
    <label class="field"><span>Email ID</span><div class="input"><span class="ico">✉</span><input id="email" type="email" placeholder="you@example.com" autocomplete="username"></div></label>
    ${passwordField('pw', 'Password', 'Enter your password')}
    <div class="row-end"><button class="link" id="forgot">Forgot Password?</button></div>
    <button class="btn block" id="go">Login</button>
    <div class="or">OR</div><button class="btn ghost block" id="google">G&nbsp; Continue with Google</button>
    <p class="center muted" style="margin-top:16px">Don't have an account? <a class="link" href="#/signup">Sign Up</a></p>
    <p class="center dim" style="margin-top:8px;font-size:12px">Demo account: demo@vortexa.ai / demo1234</p>`), () => {
    bindEyes();
    $('#t-signup').onclick = () => (location.hash = '#/signup');
    $('#forgot').onclick = () => toast('Password reset is not part of this prototype yet.');
    $('#google').onclick = () => toast('Google sign-in needs an OAuth client ID. Not configured in this build.');
    const go = async () => {
      const email = $('#email').value.trim(), password = $('#pw').value;
      if (!email || !password) return toast('Enter your email and password.', true);
      $('#go').disabled = true;
      try {
        const r = await api('/auth/login', { method: 'POST', body: { email, password }, auth: false });
        state.token = r.token; state.user = r.user; localStorage.setItem('vx_token', r.token); location.hash = '#/home';
      } catch (e) {
        $('#go').disabled = false; toast(e.message, true);
        if (e.status === 403) { state.pendingEmail = email.toLowerCase(); try { const r = await api('/auth/resend-otp', { method: 'POST', body: { email }, auth: false }); startOtp(r); location.hash = '#/verify'; } catch {} }
      }
    };
    $('#go').onclick = go; $('#pw').onkeydown = (e) => e.key === 'Enter' && go();
  }];
}
function viewSignup() {
  return [authFrame(`<h2>Create Your Account</h2><p class="sub">Join VORTEXA and start exploring AI routing</p>
    <label class="field"><span>Full Name</span><div class="input"><span class="ico">👤</span><input id="name" placeholder="Enter your name" autocomplete="name"></div></label>
    <label class="field"><span>Email ID</span><div class="input"><span class="ico">✉</span><input id="email" type="email" placeholder="you@example.com" autocomplete="email"></div></label>
    ${passwordField('pw', 'Password', 'Create a strong password (8+ characters)')}
    ${passwordField('pw2', 'Confirm Password', 'Re-enter your password')}
    <button class="btn block" id="go">Sign Up</button>
    <p class="center muted" style="margin-top:16px">Already have an account? <a class="link" href="#/login">Login</a></p>`, true), () => {
    bindEyes();
    const go = async () => {
      const name = $('#name').value.trim(), email = $('#email').value.trim(), pw = $('#pw').value;
      if (!name || !email) return toast('Enter your name and email.', true);
      if (pw.length < 8) return toast('Password must be at least 8 characters.', true);
      if (pw !== $('#pw2').value) return toast('Passwords do not match.', true);
      $('#go').disabled = true;
      try { const r = await api('/auth/signup', { method: 'POST', body: { name, email, password: pw }, auth: false }); state.pendingEmail = r.email; startOtp(r); location.hash = '#/verify'; }
      catch (e) { $('#go').disabled = false; toast(e.message, true); }
    };
    $('#go').onclick = go;
  }];
}
function startOtp(r) { state.otpDeadline = Date.now() + (r.otp_ttl_seconds || 180) * 1000; state.devOtp = r.dev_otp || null; }
function viewVerify() {
  if (!state.pendingEmail) { location.hash = '#/login'; return ['', null]; }
  return [`<div class="auth"><div class="verify-card"><div class="mail">✉</div><h2>Verify Your Email</h2>
    <p class="muted" style="margin-top:6px">We've sent a 6-digit OTP to<br><b style="color:var(--text)">${esc(state.pendingEmail)}</b></p>
    <div class="otp">${[0, 1, 2, 3, 4, 5].map((i) => `<input inputmode="numeric" maxlength="1" data-i="${i}" aria-label="Digit ${i + 1}">`).join('')}</div>
    <p class="muted" style="font-size:12.5px">Code will expire in <b id="otp-t">--:--</b></p>
    ${state.devOtp ? `<div class="devhint">Dev mode: no email server is set, so your code is <b>${state.devOtp}</b>.</div>` : ''}
    <button class="btn block" id="go" style="margin-top:14px">Verify OTP</button>
    <p class="muted" style="margin:16px 0 8px">Didn't receive the code? <button class="link" id="resend">Resend OTP</button></p>
    <a class="link" href="#/login">← Back to Login</a></div></div>`, () => {
    const ins = $$('.otp input'); ins[0].focus();
    ins.forEach((el, i) => {
      el.oninput = () => { el.value = el.value.replace(/\D/g, ''); if (el.value && ins[i + 1]) ins[i + 1].focus(); };
      el.onkeydown = (e) => { if (e.key === 'Backspace' && !el.value && ins[i - 1]) ins[i - 1].focus(); if (e.key === 'Enter') go(); };
      el.onpaste = (e) => { const d = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6); if (d) { e.preventDefault(); [...d].forEach((c, j) => (ins[j].value = c)); ins[Math.min(d.length, 5)].focus(); } };
    });
    const tick = () => { const s = Math.max(0, Math.round((state.otpDeadline - Date.now()) / 1000)); const t = $('#otp-t'); if (t) t.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
    tick(); timer = setInterval(tick, 1000);
    async function go() {
      const otp = ins.map((i) => i.value).join('');
      if (otp.length !== 6) return toast('Enter all 6 digits.', true);
      try { const r = await api('/auth/verify-otp', { method: 'POST', body: { email: state.pendingEmail, otp }, auth: false }); state.token = r.token; state.user = r.user; localStorage.setItem('vx_token', r.token); state.pendingEmail = ''; toast('Email verified. Welcome!'); location.hash = '#/home'; }
      catch (e) { toast(e.message, true); }
    }
    $('#go').onclick = go;
    $('#resend').onclick = async () => { try { const r = await api('/auth/resend-otp', { method: 'POST', body: { email: state.pendingEmail }, auth: false }); startOtp(r); toast('A new code has been sent.'); render(); } catch (e) { toast(e.message, true); } };
  }];
}

/* ---------- main views ---------- */
function viewHome() {
  return [shell('home', `<h1>Welcome back, ${esc(state.user.name.split(' ')[0])}! 👋</h1>
    <p class="lead">Ask your question, set your preferences, and let ModelRouter find the best model for you.</p>
    ${askHtml('Type your question or speak…')}${prefsHtml(state.prefs, 'p-')}
    <button class="btn block" id="go">Route My Question &nbsp;→</button>`), () => { bindShell(); bindAsk(); bindPrefs(state.prefs, 'p-', true); }];
}
function viewPlayground() {
  const v = state.voiceTab;
  return [shell('playground', `<div class="headrow"><div><h1>AI Request Playground</h1><p class="muted">Ask your question, set your preferences, and let ModelRouter find the best model for you.</p></div>
    <div class="seg"><button id="tab-t" class="${v ? '' : 'on'}">Text Input</button><button id="tab-v" class="${v ? 'on' : ''}">Voice Input</button></div></div>
    ${askHtml('Explain pointers in C++')}
    <h3 style="margin:18px 0 0">Set Your Preferences</h3>${prefsHtml(state.prefs, 'p-')}
    <button class="btn block" id="go">Route My Question &nbsp;→</button>`), () => {
    bindShell(); bindAsk(); bindPrefs(state.prefs, 'p-', true);
    $('#tab-t').onclick = () => { state.voiceTab = false; render(); };
    $('#tab-v').onclick = () => { state.voiceTab = true; render(); };
    if (v) { state.voiceTab = false; setTimeout(() => $('#mic').click(), 150); }
  }];
}

function modelCard(c, selId) {
  const sel = c.id === selId, rej = !c.eligible;
  const tag = rej ? '<span class="tag bad">Rejected</span>' : '<span class="tag ok">Eligible</span>';
  const badges = (c.badges || []).map((b) => `<span class="tag ${/High|Limited|Unavail/.test(b) ? 'warn' : ''}">${esc(b)}</span>`).join('') + (sel ? '<span class="tag ok">Recommended</span>' : '');
  return `<div class="mcard ${sel ? 'sel' : ''} ${rej ? 'rej' : ''}"><div class="mhead"><div><b>${esc(c.name)}</b><small>${esc(c.tagline)}</small></div>${tag}</div>
    <div class="kv"><div>Cost (in/out)<b>${usd(c.cost_in, 3)} / ${usd(c.cost_out, 3)}</b></div><div>Latency (avg)<b>${ms(c.latency_ms)}</b></div><div>Capability<b>${c.capability}/5</b></div><div>Context Length<b>${c.context_tokens / 1000}K</b></div></div>
    <div class="tags">${badges}</div><button class="btn ghost small block" data-more>View Details</button>
    <div class="details"><div>Score: <b>${c.eligible ? c.score : 'n/a'}</b> · Est. cost for this request: <b>${usd(c.est_cost_usd, 5)}</b></div>
    <div>Tasks: ${c.tasks.map(esc).join(', ')} · Reliability: ${Math.round(c.availability * 100)}%</div>
    ${rej ? `<div style="margin-top:6px">Why rejected:</div><ul>${c.reasons_rejected.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}</div></div>`;
}
function viewFlow() {
  const r = state.last;
  if (!r) return [shell('flow', `<div class="card empty"><h2>No routing yet</h2><p>Ask a question and the model comparison will appear here.</p><a class="btn" href="#/playground">Open Playground</a></div>`), bindShell];
  const selId = r.selected_model?.id;
  const list = r.candidates.filter((c) => state.filter === 'all' || (state.filter === 'eligible' ? c.eligible : !c.eligible));
  const ok = r.status === 'success';
  const tabs = [['all', `All Models`], ['eligible', `Eligible (${r.eligible_count})`], ['rejected', `Rejected (${r.rejected_count})`]];
  const att = r.attempts.length > 1 || r.fallback_used ? `<div class="attempts"><b>Attempts</b>${r.attempts.map((a) => `<div><span class="tag ${a.outcome === 'success' ? 'ok' : 'bad'}">${a.outcome}</span>${esc(a.model)}${a.error ? ' · ' + esc(a.error) : ''}</div>`).join('')}</div>` : '';
  const est = r.estimated;
  return [shell('flow', `<div class="headrow"><div><h1>Model Comparison</h1><p class="muted">Request type: <b>${esc(r.category)}</b> · requires capability ${r.required_capability}/5 · "${esc(r.prompt.slice(0, 80))}"</p></div>
    <div class="seg" id="filters">${tabs.map(([k, l]) => `<button data-f="${k}" class="${state.filter === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="cards">${list.map((c) => modelCard(c, selId)).join('') || '<p class="muted">Nothing in this filter.</p>'}</div>
    <div class="grid2"><div class="card"><div class="status ${ok ? '' : 'bad'}"><div class="dot">${ok ? '✓' : '!'}</div><div><b style="font-size:16px">${ok ? 'Routing Completed!' : r.status === 'failed' ? 'All models failed' : 'No eligible model'}</b>
      <div class="muted">${ok ? `Selected Model: <b style="color:var(--text)">${esc(r.selected_model.name)}</b>${r.fallback_used ? ' (fallback)' : ''}` : esc(r.message)}</div></div></div>
      ${est ? `<div class="stats3"><div class="stat"><small>Estimated Cost</small><b>${usd(est.cost_usd, 5)}</b></div><div class="stat"><small>Estimated Latency</small><b>${ms(est.latency_ms)}</b></div><div class="stat"><small>Estimated Quality</small><b>${est.quality}</b></div></div>` : ''}
      ${att}${ok ? `<h3 style="margin-top:14px">Response <span class="tag warn">simulated</span></h3><div class="resp">${esc(r.response)}</div>` : ''}</div>
    <div class="card"><h3>Why this model?</h3>${r.reasons.length ? `<ul class="checks">${r.reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p class="muted">${esc(r.message)}</p>`}
      <div class="player"><button class="play" id="play" aria-label="Play explanation">▶</button><div class="wave" id="wave">${Array.from({ length: 28 }, (_, i) => `<span style="animation-delay:${(i % 9) * 0.1}s;height:${20 + ((i * 37) % 70)}%"></span>`).join('')}</div><span class="muted" style="font-size:12px">Listen to Explanation</span></div></div></div>`),
  () => {
    bindShell();
    $$('#filters button').forEach((b) => (b.onclick = () => { state.filter = b.dataset.f; render(); }));
    $$('[data-more]').forEach((b) => (b.onclick = () => b.closest('.mcard').classList.toggle('open')));
    $('#play').onclick = () => playExplanation(r.explanation);
  }];
}

async function playExplanation(text) {
  const wave = $('#wave'), btn = $('#play');
  const stop = () => { wave?.classList.remove('playing'); if (btn) btn.textContent = '▶'; };
  if (audio) { audio.pause(); audio = null; stop(); return; }
  if ('speechSynthesis' in window && speechSynthesis.speaking) { speechSynthesis.cancel(); stop(); return; }
  wave.classList.add('playing'); btn.textContent = '■';
  try {
    if (state.health.tts === 'elevenlabs') {
      const blob = await api('/tts', { method: 'POST', body: { text } });
      audio = new Audio(URL.createObjectURL(blob)); audio.onended = () => { audio = null; stop(); }; await audio.play(); return;
    }
  } catch (e) { toast('ElevenLabs unavailable, using the browser voice.', true); }
  if (!('speechSynthesis' in window)) { stop(); return toast('This browser cannot play speech.', true); }
  const u = new SpeechSynthesisUtterance(text); u.onend = stop; u.onerror = stop; speechSynthesis.speak(u);
}

function viewLab() {
  const opts = (sel) => state.models.map((m) => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
  const L = state.labResult;
  const row = (m) => `<tr><td>${m.label}</td><td>${m.r.selected_model ? esc(m.r.selected_model.name) : '<span class="tag bad">none</span>'}</td><td>${m.r.estimated ? usd(m.r.estimated.cost_usd, 5) : '–'}</td><td>${m.r.estimated ? ms(m.r.estimated.latency_ms) : '–'}</td><td>${m.r.fallback_used ? 'Yes' : 'No'}</td></tr>`;
  return [shell('lab', `<h1>What If? Simulation Lab</h1><p class="lead">Try different scenarios and see how routing adapts. Simulations are not saved to your history.</p>
    <div class="card"><label class="field"><span>Question to route</span><div class="input"><input id="lq" value="${esc(state.draft || 'Explain pointers in C++')}" maxlength="1000"></div></label>
    ${prefsHtml(state.labPrefs, 'l-')}
    <div class="scn"><div>1. Make a model unavailable</div><select id="s1m">${opts('model-b')}</select><label class="sw"><input type="checkbox" id="s1" checked><i></i></label></div>
    <div class="scn"><div>2. Simulate high latency (2.5s)</div><select id="s2m">${opts('model-b')}</select><label class="sw"><input type="checkbox" id="s2"><i></i></label></div>
    <button class="btn block" id="run" style="margin-top:16px">Run Simulation</button>
    ${L ? `<div class="result-banner"><span style="font-size:20px">ⓘ</span><div><b>Simulation Result</b><div>${esc(L.message)}</div></div></div>
      <div class="tablewrap" style="margin-top:12px"><table><tr><th></th><th>Selected model</th><th>Est. cost</th><th>Est. latency</th><th>Fallback used</th></tr>${row({ label: 'Normal conditions', r: L.before })}${row({ label: 'With your scenario', r: L.after })}</table></div>` : ''}</div>
    <div class="card" style="margin-top:16px"><h3>Live failure injection <span class="tag warn">dev only</span></h3><p class="muted" style="margin-bottom:12px">Makes a model fail on every real call, so the router has to use its fallback. Applies to your next routed questions until cleared.</p>
    <div class="scn" style="border:0"><select id="fm">${opts('model-b')}</select><div></div><div style="display:flex;gap:8px"><button class="btn small" id="finj">Make it fail</button><button class="btn ghost small" id="fclr">Clear all</button></div></div></div>`),
  () => {
    bindShell(); bindPrefs(state.labPrefs, 'l-', false);
    $('#run').onclick = async () => {
      const scenario = [];
      if ($('#s1').checked) scenario.push({ model_id: $('#s1m').value, mode: 'unavailable' });
      if ($('#s2').checked) scenario.push({ model_id: $('#s2m').value, mode: 'slow' });
      const prompt = $('#lq').value.trim(); if (!prompt) return toast('Enter a question first.', true);
      state.draft = prompt; $('#run').disabled = true; $('#run').textContent = 'Running…';
      try { state.labResult = await api('/simulate', { method: 'POST', body: { prompt, preferences: state.labPrefs, scenario } }); render(); }
      catch (e) { toast(e.message, true); $('#run').disabled = false; $('#run').textContent = 'Run Simulation'; }
    };
    $('#finj').onclick = async () => { try { await api('/simulate-failure', { method: 'POST', body: { model_id: $('#fm').value, mode: 'fail' } }); toast($('#fm').selectedOptions[0].text + ' will now fail on every call.'); } catch (e) { toast(e.message, true); } };
    $('#fclr').onclick = async () => { try { await api('/simulate-failure', { method: 'POST', body: { mode: 'clear' } }); toast('All injected failures cleared.'); } catch (e) { toast(e.message, true); } };
  }];
}

function lineChart(vals) {
  const W = 560, H = 160, P = 24, max = Math.max(1, ...vals);
  const pts = vals.map((v, i) => [P + (i * (W - 2 * P)) / (vals.length - 1), H - P - (v / max) * (H - 2 * P)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H + 14}" role="img" aria-label="Requests over the last 24 hours"><defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#18b8ff" stop-opacity=".35"/><stop offset="1" stop-color="#18b8ff" stop-opacity="0"/></linearGradient></defs>
    ${[0, 1, 2, 3].map((i) => `<line x1="${P}" x2="${W - P}" y1="${P + (i * (H - 2 * P)) / 3}" y2="${P + (i * (H - 2 * P)) / 3}" stroke="#5e80ff33"/>`).join('')}
    <path d="${d} L${pts.at(-1)[0]} ${H - P} L${P} ${H - P} Z" fill="url(#ar)"/><path d="${d}" fill="none" stroke="#18b8ff" stroke-width="2.2"/>
    <text x="${P}" y="${H + 10}" fill="#8fa2d4" font-size="10">24h ago</text><text x="${W - P}" y="${H + 10}" fill="#8fa2d4" font-size="10" text-anchor="end">now</text><text x="${P - 4}" y="${P + 3}" fill="#8fa2d4" font-size="10" text-anchor="end">${max}</text></svg>`;
}
async function viewAnalytics() {
  let a, h;
  try { [a, h] = await Promise.all([api('/analytics'), api('/history?limit=25')]); } catch (e) { toast(e.message, true); a = { total_requests: 0, total_cost_usd: 0, avg_latency_ms: 0, success_rate: 0, model_usage: [], requests_over_time: Array(24).fill(0), fallbacks: 0 }; h = { history: [] }; }
  const top = Math.max(1, ...a.model_usage.map((u) => u.count));
  return [shell('analytics', `<h1>Analytics</h1><p class="lead">How your requests were routed.</p>
    <div class="kpis"><div class="card kpi"><small>Total Requests</small><b>${a.total_requests}</b></div><div class="card kpi"><small>Total Est. Cost</small><b>${usd(a.total_cost_usd, 4)}</b></div><div class="card kpi"><small>Avg. Latency</small><b>${a.avg_latency_ms}ms</b></div><div class="card kpi"><small>Success Rate</small><b>${a.success_rate}%</b></div></div>
    <div class="grid2" style="margin-top:0"><div class="card"><h3>Requests over time (last 24h)</h3>${lineChart(a.requests_over_time)}</div>
    <div class="card"><h3>Model usage</h3>${a.model_usage.length ? `<div class="bars">${a.model_usage.map((u) => `<div class="b"><span>${esc(u.model)}</span><div class="track"><i style="width:${(u.count / top) * 100}%"></i></div><span>${u.count}</span></div>`).join('')}</div>` : '<p class="muted">No successful requests yet.</p>'}<p class="muted" style="margin-top:14px">Fallbacks used: <b>${a.fallbacks}</b></p></div></div>
    <div class="card" style="margin-top:16px"><div class="headrow" style="margin:0 0 8px"><h3>Routing history</h3><button class="btn ghost small" id="clr">Clear history</button></div>
    ${h.history.length ? `<div class="tablewrap"><table><tr><th>Time</th><th>Prompt</th><th>Type</th><th>Model</th><th>Status</th><th>Why</th></tr>${h.history.map((x) => `<tr><td>${new Date(x.created_at * 1000).toLocaleString()}</td><td>${esc(x.prompt.slice(0, 60))}</td><td>${esc(x.category)}</td><td>${esc(x.selected_model || '–')}${x.fallback_used ? ' <span class="tag warn">fallback</span>' : ''}</td><td><span class="tag ${x.status === 'success' ? 'ok' : 'bad'}">${esc(x.status)}</span></td><td class="muted">${esc((x.reason || '').slice(0, 90))}</td></tr>`).join('')}</table></div>` : '<p class="muted">Nothing yet. Route a question to see it here.</p>'}</div>`),
  () => { bindShell(); const c = $('#clr'); if (c) c.onclick = async () => { await api('/history', { method: 'DELETE' }); toast('History cleared.'); render(); }; }];
}

function viewSettings() {
  const el = state.health.tts === 'elevenlabs';
  return [shell('settings', `<h1>Settings</h1><p class="lead">Account and voice options.</p>
    <div class="card" style="margin-bottom:14px"><h3>Account</h3><div class="kv"><div>Name<b>${esc(state.user.name)}</b></div><div>Email<b>${esc(state.user.email)}</b></div></div></div>
    <div class="card" style="margin-bottom:14px"><h3>Voice</h3><p class="muted">Explanation voice: <span class="tag ${el ? 'ok' : 'warn'}">${el ? 'ElevenLabs' : 'Browser voice'}</span></p>${el ? '' : '<p class="muted" style="margin-top:8px">Set <code>ELEVENLABS_API_KEY</code> on the server to use ElevenLabs voices.</p>'}</div>
    <div class="card"><h3>Routing defaults</h3><button class="btn ghost small" id="reset">Reset preferences</button></div>`),
  () => { bindShell(); $('#reset').onclick = () => { state.prefs = { ...DEFAULT_PREFS }; localStorage.setItem('vx_prefs', JSON.stringify(state.prefs)); toast('Preferences reset.'); }; }];
}

/* ---------- router ---------- */
const VIEWS = { login: viewLogin, signup: viewSignup, verify: viewVerify, home: viewHome, playground: viewPlayground, flow: viewFlow, lab: viewLab, analytics: viewAnalytics, settings: viewSettings };
const PUBLIC = ['login', 'signup', 'verify'];
async function render() {
  clearInterval(timer);
  if (audio) { audio.pause(); audio = null; } if ('speechSynthesis' in window) speechSynthesis.cancel();
  let name = (location.hash || '').replace(/^#\//, '').split('?')[0];
  if (!VIEWS[name]) name = state.token ? 'home' : 'login';
  if (!PUBLIC.includes(name) && !state.token) return (location.hash = '#/login');
  if (state.token && !state.user) { try { state.user = await api('/auth/me'); } catch { return; } }
  if (state.token && PUBLIC.includes(name) && name !== 'verify') return (location.hash = '#/home');
  if (state.token && !state.models.length) { try { state.models = (await api('/models', { auth: false })).models; } catch {} }
  const [html, bind] = await VIEWS[name]();
  if (name !== (location.hash || '').replace(/^#\//, '').split('?')[0] && html === '') return;
  $('#app').innerHTML = html; if (bind) bind();
}
window.addEventListener('hashchange', render);
(async () => { try { state.health = await api('/health', { auth: false }); } catch {} render(); })();
