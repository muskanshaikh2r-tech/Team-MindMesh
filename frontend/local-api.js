/* Standalone mode: the same routing engine as the Python backend, running in the browser.
   Used automatically when no backend is reachable (e.g. you open standalone.html directly).
   Everything is simulated and stored in localStorage (or memory if storage is blocked). */
(function () {
  'use strict';
  const mem = {};
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? (k in mem ? mem[k] : d) : JSON.parse(v); } catch { return k in mem ? mem[k] : d; } },
    set(k, v) { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const fail = (status, message) => Object.assign(new Error(message), { status });
  const sleep = (t) => new Promise((r) => setTimeout(r, t));
  const TIME_SCALE = 0.15, OTP_TTL = 180, MAX_ATTEMPTS = 3;

  /* ---------- registry ---------- */
  const ALL = ['general', 'summarization', 'coding', 'reasoning'];
  const MODELS = [
    { id: 'model-a', name: 'Model A', tagline: 'Fast & Affordable', tasks: ['general', 'summarization'], cost_in: 0.001, cost_out: 0.002, latency_ms: 200, capability: 2, context_tokens: 4000, availability: 0.99, status: 'available', specialties: [], badges: ['Fast', 'Low Cost'], failure_rate: 0.01 },
    { id: 'model-b', name: 'Model B', tagline: 'Balanced Performance', tasks: ALL, cost_in: 0.003, cost_out: 0.006, latency_ms: 700, capability: 4, context_tokens: 8000, availability: 0.98, status: 'available', specialties: ['coding'], badges: ['Balanced'], failure_rate: 0.02 },
    { id: 'model-c', name: 'Model C', tagline: 'Highest Quality', tasks: ALL, cost_in: 0.010, cost_out: 0.020, latency_ms: 1500, capability: 5, context_tokens: 32000, availability: 0.98, status: 'available', specialties: ['reasoning'], badges: ['Best Quality', 'High Cost'], failure_rate: 0.02 },
    { id: 'model-d', name: 'Model D', tagline: 'Specialized Model', tasks: ['coding'], cost_in: 0.005, cost_out: 0.010, latency_ms: 1800, capability: 3, context_tokens: 16000, availability: 0.95, status: 'available', specialties: ['coding'], badges: ['High Latency'], failure_rate: 0.05 },
    { id: 'model-e', name: 'Model E', tagline: 'Experimental', tasks: ['general', 'summarization', 'reasoning'], cost_in: 0.002, cost_out: 0.004, latency_ms: 1200, capability: 3, context_tokens: 16000, availability: 0.60, status: 'limited', specialties: [], badges: ['Limited Availability'], failure_rate: 0.30 },
  ];
  let overrides = store.get('vx_overrides', {});

  function effective(extra) {
    const merged = JSON.parse(JSON.stringify(overrides));
    for (const [k, v] of Object.entries(extra || {})) merged[k] = Object.assign(merged[k] || {}, v);
    const out = MODELS.map((m0) => {
      const m = JSON.parse(JSON.stringify(m0)), ov = merged[m.id] || {};
      if (ov.unavailable) { m.status = 'unavailable'; m.badges = m.badges.filter((b) => b !== 'Limited Availability').concat('Unavailable'); }
      if (ov.latency_ms) { m.latency_ms = ov.latency_ms; m.badges = m.badges.filter((b) => b !== 'Fast' && b !== 'High Latency').concat('High Latency'); }
      return m;
    });
    return [out, merged];
  }

  /* ---------- analyzer ---------- */
  const KW = {
    coding: ['code', 'function', 'c++', 'cpp', 'python', 'java', 'javascript', 'typescript', 'bug', 'debug', 'compile', 'algorithm', 'sql', 'regex', 'class', 'pointer', 'api', 'script', 'stack trace', 'exception', 'recursion', '```', 'def', '#include', 'react', 'html', 'css', 'rust', 'golang'],
    summarization: ['summarize', 'summarise', 'summary', 'tl;dr', 'tldr', 'shorten', 'key points', 'condense', 'brief overview', 'recap'],
    reasoning: ['prove', 'why does', 'why is', 'analyze', 'analyse', 'compare', 'trade-off', 'tradeoff', 'step by step', 'derive', 'evaluate', 'design a', 'optimize', 'strategy', 'calculate', 'pros and cons', 'implications', 'reason about', 'puzzle', 'logic'],
  };
  const PRIORITY = ['coding', 'summarization', 'reasoning', 'general'];
  const MINCAP = { general: 1, summarization: 2, coding: 3, reasoning: 4 };
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const has = (t, k) => new RegExp('(?<![\\w])' + esc(k.trim()) + '(?![\\w])').test(t);
  function analyze(prompt) {
    const t = prompt.toLowerCase();
    const scores = {}; for (const c of Object.keys(KW)) scores[c] = KW[c].filter((k) => has(t, k)).length;
    const best = Math.max(...Object.values(scores));
    let category = 'general'; if (best > 0) category = PRIORITY.find((c) => scores[c] === best);
    const signals = Object.entries(scores).filter(([, n]) => n).map(([c, n]) => `${c}: ${n} keyword match(es)`);
    const words = (prompt.match(/\w+/g) || []).length;
    let cx = 1; if (words > 40) cx++; if (words > 150) cx++; if (category === 'coding' || category === 'reasoning') cx++; if (scores.reasoning >= 2) cx++; cx = Math.min(cx, 5);
    const inTok = Math.max(1, Math.round(prompt.length / 4));
    return { category, complexity: cx, min_capability: MINCAP[category], input_tokens: inTok, est_output_tokens: 300 + 100 * cx, signals: signals.length ? signals : ['no specialised keywords: default route'] };
  }

  /* ---------- routing ---------- */
  const W = { low_cost: [0.5, 0.2, 0.2, 0.1], balanced: [0.3, 0.25, 0.3, 0.15], high_quality: [0.1, 0.15, 0.65, 0.1] };
  const BL = { low_cost: 'Low Cost', balanced: 'Balanced', high_quality: 'High Quality' };
  const estCost = (m, i, o) => Math.round((i / 1000 * m.cost_in + o / 1000 * m.cost_out) * 1e6) / 1e6;
  function evaluate(models, a, p) {
    const w = W[p.budget] || W.balanced, need = Math.max(p.min_capability, a.min_capability);
    const maxC = Math.max(...models.map((m) => m.cost_in + m.cost_out)) || 1, maxL = Math.max(...models.map((m) => m.latency_ms)) || 1;
    const cands = models.map((m) => {
      const why = [];
      if (m.status === 'unavailable') why.push('Currently unavailable'); else if (m.status !== 'available') why.push('Limited availability');
      if (!m.tasks.includes(a.category)) why.push(`Not configured for ${a.category} tasks`);
      if (m.capability < need) why.push(`Capability ${m.capability}/5 is below the required ${need}/5`);
      if (m.latency_ms > p.max_latency_ms) why.push(`Latency ${m.latency_ms} ms exceeds your ${p.max_latency_ms} ms limit`);
      if (m.context_tokens < p.context_tokens) why.push(`Context ${Math.floor(m.context_tokens / 1000)}K is below the requested ${Math.floor(p.context_tokens / 1000)}K`);
      if (m.context_tokens < a.input_tokens) why.push('Prompt does not fit in the context window');
      const c = { model: m, eligible: !why.length, score: 0, est_cost: estCost(m, a.input_tokens, a.est_output_tokens), reasons_rejected: why };
      if (c.eligible) {
        const s = w[0] * (1 - (m.cost_in + m.cost_out) / maxC) + w[1] * (1 - m.latency_ms / maxL) + w[2] * (m.capability / 5) + w[3] * m.availability + (m.specialties.includes(a.category) ? 0.08 : 0);
        c.score = Math.round(s * 1e4) / 1e4;
      }
      return c;
    });
    const ranked = cands.filter((c) => c.eligible).sort((x, y) => y.score - x.score || x.est_cost - y.est_cost);
    return [ranked, cands, need];
  }
  const fmtLat = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + 's' : n + ' ms');
  function explain(c, a, p, need, n) {
    const m = c.model;
    const r = [`Meets your quality requirement (${m.capability}/5, needed ${need}/5)`,
      `Fits your ${BL[p.budget] || p.budget} budget preference (about $${c.est_cost.toFixed(4)} for this request)`,
      `Latency is under ${p.max_latency_ms / 1000}s (${fmtLat(m.latency_ms)})`,
      `Context length (${Math.floor(m.context_tokens / 1000)}K) is sufficient for ${Math.floor(p.context_tokens / 1000)}K tokens`];
    if (m.tasks.includes(a.category)) r.push(`Supports ${a.category} tasks` + (m.specialties.includes(a.category) ? ' (specialty)' : ''));
    r.push(`Highest routing score (${c.score}) among ${n} eligible model(s)`);
    return r;
  }

  /* ---------- mock execution ---------- */
  const POINTERS = 'A pointer is a variable that stores a memory address. Declare one with `int* p;` and point it at a variable using the address-of operator: `int x = 5; int* p = &x;`. Dereference with `*p` to read or write the value at that address (`*p = 10;` changes x). Pointers enable dynamic memory (`new`/`delete`), arrays, and passing large data without copying. Prefer smart pointers (`std::unique_ptr`, `std::shared_ptr`) in modern C++ and never dereference `nullptr`.';
  const TPL = {
    general: (p) => `Here is a concise answer to your question: ${p}`,
    summarization: (p) => `Summary: the text centres on ${p}. Key points are extracted and condensed.`,
    coding: (p) => `Here is a code-oriented answer for: ${p}\n\n\`\`\`\n// simulated solution skeleton\n\`\`\``,
    reasoning: (p) => `Let's reason step by step about: ${p}\n1. Define the problem.\n2. Compare the options.\n3. Conclude.`,
  };
  async function invoke(m, prompt, category, ov) {
    if (ov.fail) throw new Error(`${m.name} is not responding`);
    const base = ov.latency_ms || m.latency_ms, sim = Math.round(base * (0.9 + Math.random() * 0.2));
    if (sim > 5000) { await sleep(5000 * TIME_SCALE); throw new Error(`${m.name} timed out after 5000 ms`); }
    await sleep(sim * TIME_SCALE);
    if (Math.random() < m.failure_rate) throw new Error(`${m.name} returned a transient error`);
    const lp = prompt.toLowerCase();
    let body = lp.includes('pointer') && (lp.includes('c++') || lp.includes('cpp')) ? POINTERS : (TPL[category] || TPL.general)(`"${prompt.trim().replace(/\n/g, ' ').slice(0, 140)}"`);
    if (m.capability >= 5) body += '\n\n(Extended detail: edge cases, trade-offs and examples included.)';
    return { text: `${body}\n\n[Simulated response from ${m.name}: mock output, not a real LLM.]`, latency_ms: sim };
  }

  async function routeRequest(userId, prompt, prefs, scenario, record) {
    const a = analyze(prompt), [models, ov] = effective(scenario), [ranked, cands, need] = evaluate(models, a, prefs);
    const res = {
      prompt, category: a.category, complexity: a.complexity, input_tokens: a.input_tokens, signals: a.signals, preferences: { ...prefs },
      required_capability: need,
      candidates: cands.map((c) => ({ ...c.model, eligible: c.eligible, score: c.score, est_cost_usd: c.est_cost, reasons_rejected: c.reasons_rejected })),
      eligible_count: ranked.length, rejected_count: cands.length - ranked.length,
      selected_model: null, response: null, fallback_used: false, attempts: [], reasons: [], explanation: '', estimated: null, actual_latency_ms: 0, simulated: true,
    };
    if (!ranked.length) {
      res.status = 'no_eligible_model';
      res.message = 'No model meets all of your requirements. Try a higher latency limit, a lower minimum capability or a smaller context length.';
      res.explanation = res.message;
    } else {
      let used = null, resp = null;
      for (const c of ranked.slice(0, MAX_ATTEMPTS)) {
        const t0 = performance.now();
        try {
          resp = await invoke(c.model, prompt, a.category, ov[c.model.id] || {});
          res.attempts.push({ model_id: c.model.id, model: c.model.name, outcome: 'success', error: null, latency_ms: resp.latency_ms });
          used = c; break;
        } catch (e) { res.attempts.push({ model_id: c.model.id, model: c.model.name, outcome: 'failed', error: e.message, latency_ms: Math.round(performance.now() - t0) }); }
      }
      if (!used) {
        res.status = 'failed';
        res.message = `All eligible models failed (${res.attempts.map((x) => x.model).join(', ')}). No further fallback is permitted.`;
        res.explanation = res.message;
      } else {
        res.status = 'success'; res.selected_model = used.model; res.response = resp.text; res.actual_latency_ms = resp.latency_ms;
        res.fallback_used = used !== ranked[0];
        const reasons = explain(used, a, prefs, need, ranked.length);
        if (res.fallback_used) reasons.unshift(`Fallback: ${ranked[0].model.name} failed, so ${used.model.name} took over`);
        res.reasons = reasons;
        res.estimated = { cost_usd: used.est_cost, latency_ms: used.model.latency_ms, quality: `${used.model.capability}/5` };
        res.explanation = `I selected ${used.model.name} for this ${a.category} request. ` + reasons.slice(0, 4).map((r) => r + '.').join(' ');
        res.message = `Routing completed. Selected model: ${used.model.name}.`;
      }
    }
    if (record) {
      const h = store.get('vx_history', []), id = (h.at(-1)?.id || 0) + 1;
      h.push({ id, user_id: userId, prompt, category: a.category, selected_model: res.selected_model?.name || null, status: res.status, fallback_used: res.fallback_used ? 1 : 0, est_cost: res.estimated?.cost_usd || 0, latency_ms: res.actual_latency_ms, reason: res.reasons.slice(0, 3).join('; ') || res.message, created_at: Date.now() / 1000 });
      store.set('vx_history', h.slice(-500)); res.id = id;
    }
    return res;
  }
  async function simulate(prompt, prefs, scenario) {
    const before = await routeRequest(null, prompt, prefs, null, false), after = await routeRequest(null, prompt, prefs, scenario, false), notes = [];
    for (const [mid, ov] of Object.entries(scenario)) {
      const n = MODELS.find((m) => m.id === mid).name;
      if (ov.unavailable) notes.push(`${n} is now unavailable.`);
      if (ov.latency_ms) notes.push(`${n} is now slower (${ov.latency_ms / 1000}s).`);
      if (ov.fail) notes.push(`${n} now fails on every call.`);
    }
    const b = before.selected_model?.name || null, s = after.selected_model?.name || null;
    if (!s) notes.push('No eligible model remains under these conditions.');
    else if (s !== b) notes.push(b ? `System selected ${s} as fallback.` : `System selected ${s}.`);
    else notes.push(`No change: ${s} is still the best choice.`);
    return { before, after, message: notes.join(' '), changed: b !== s };
  }

  /* ---------- auth ---------- */
  async function hashPw(pw, salt) {
    const data = new TextEncoder().encode(salt + ':' + pw);
    if (window.crypto?.subtle) { const d = await crypto.subtle.digest('SHA-256', data); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
    let h = 5381; for (const b of data) h = ((h << 5) + h + b) >>> 0; return String(h);
  }
  const rnd = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
  const users = () => store.get('vx_users', []);
  const pub = (u) => ({ id: u.id, name: u.name, email: u.email });
  async function ensureDemo() {
    if (users().some((u) => u.email === 'demo@vortexa.ai')) return;
    const salt = 'demo'; store.set('vx_users', users().concat({ id: 1, name: 'Demo User', email: 'demo@vortexa.ai', salt, hash: await hashPw('demo1234', salt), verified: true }));
  }
  function newSession(uid) { const t = Array.from({ length: 4 }, () => rnd(1e9).toString(36)).join(''); const s = store.get('vx_sessions', {}); s[t] = uid; store.set('vx_sessions', s); return t; }
  function issueOtp(email) {
    const code = String(rnd(1e6)).padStart(6, '0'), o = store.get('vx_otps', {});
    o[email] = { code, expires: Date.now() + OTP_TTL * 1000, attempts: 0 }; store.set('vx_otps', o); return code;
  }
  function userFromToken(tok) { const uid = store.get('vx_sessions', {})[tok]; const u = users().find((x) => x.id === uid); return u ? pub(u) : null; }

  const toEngine = (p) => ({ budget: p?.budget || 'low_cost', max_latency_ms: Number(p?.max_latency_ms) || 1000, min_capability: Number(p?.min_capability) || 1, context_tokens: Number(p?.context_tokens) || 8000 });

  function analytics(uid) {
    const h = store.get('vx_history', []).filter((x) => x.user_id === uid), now = Date.now() / 1000, buckets = Array(24).fill(0);
    for (const x of h) { const i = 23 - Math.floor((now - x.created_at) / 3600); if (i >= 0 && i < 24) buckets[i]++; }
    const ok = h.filter((x) => x.status === 'success'), usage = {};
    ok.forEach((x) => (usage[x.selected_model] = (usage[x.selected_model] || 0) + 1));
    return {
      total_requests: h.length, total_cost_usd: Math.round(h.reduce((s, x) => s + x.est_cost, 0) * 1e6) / 1e6,
      avg_latency_ms: ok.length ? Math.round(ok.reduce((s, x) => s + x.latency_ms, 0) / ok.length) : 0,
      success_rate: h.length ? Math.round((1000 * ok.length) / h.length) / 10 : 0, fallbacks: h.reduce((s, x) => s + x.fallback_used, 0),
      model_usage: Object.entries(usage).sort((a, b) => b[1] - a[1]).map(([model, count]) => ({ model, count })), requests_over_time: buckets, window_hours: 24,
    };
  }

  window.localApi = async function (path, { method = 'GET', body, token } = {}) {
    const [route, query] = path.split('?'), M = method.toUpperCase();
    await ensureDemo();
    const needUser = () => { const u = userFromToken(token); if (!u) throw fail(401, 'Your session expired. Log in again.'); return u; };

    if (route === '/models' && M === 'GET') { const [m] = effective(); return { models: m, overrides }; }
    if (route === '/auth/signup') {
      const name = (body.name || '').trim(), email = (body.email || '').trim().toLowerCase();
      if (!name) throw fail(400, 'Enter your name.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw fail(400, 'Enter a valid email address.');
      if ((body.password || '').length < 8) throw fail(400, 'Password must be at least 8 characters.');
      const us = users(), ex = us.find((u) => u.email === email);
      if (ex && ex.verified) throw fail(409, 'An account with this email already exists. Log in instead.');
      const salt = String(rnd(1e9)), hash = await hashPw(body.password, salt);
      if (ex) Object.assign(ex, { name, salt, hash }); else us.push({ id: (us.at(-1)?.id || 0) + 1, name, email, salt, hash, verified: false });
      store.set('vx_users', us); return { email, otp_ttl_seconds: OTP_TTL, dev_otp: issueOtp(email) };
    }
    if (route === '/auth/resend-otp') {
      const email = (body.email || '').trim().toLowerCase(); if (!users().some((u) => u.email === email)) throw fail(404, 'No account found for this email.');
      return { otp_ttl_seconds: OTP_TTL, dev_otp: issueOtp(email) };
    }
    if (route === '/auth/verify-otp') {
      const email = (body.email || '').trim().toLowerCase(), o = store.get('vx_otps', {}), r = o[email];
      if (!r) throw fail(400, 'No code was requested for this email. Request a new one.');
      if (r.expires < Date.now()) throw fail(400, 'This code has expired. Request a new one.');
      if (r.attempts >= 5) throw fail(429, 'Too many wrong attempts. Request a new code.');
      if (r.code !== String(body.otp).trim()) { r.attempts++; store.set('vx_otps', o); throw fail(400, 'That code is incorrect.'); }
      const us = users(), u = us.find((x) => x.email === email); u.verified = true; store.set('vx_users', us); delete o[email]; store.set('vx_otps', o);
      return { token: newSession(u.id), user: pub(u) };
    }
    if (route === '/auth/login') {
      const email = (body.email || '').trim().toLowerCase(), u = users().find((x) => x.email === email);
      if (!u || (await hashPw(body.password || '', u.salt)) !== u.hash) throw fail(401, 'Email or password is incorrect.');
      if (!u.verified) throw fail(403, 'Verify your email first. We can send a new code.');
      return { token: newSession(u.id), user: pub(u) };
    }
    if (route === '/auth/me') return needUser();
    if (route === '/auth/logout') { const s = store.get('vx_sessions', {}); delete s[token]; store.set('vx_sessions', s); return { ok: true }; }

    const user = needUser();
    if (route === '/route' && M === 'POST') {
      const prompt = (body.prompt || '').trim(); if (!prompt || prompt.length > 1000) throw fail(422, 'Enter a question (up to 1000 characters).');
      return routeRequest(user.id, prompt, toEngine(body.preferences), null, true);
    }
    if (route === '/simulate' && M === 'POST') {
      const sc = {};
      for (const it of body.scenario || []) { const o = (sc[it.model_id] = sc[it.model_id] || {}); if (it.mode === 'unavailable') o.unavailable = true; else if (it.mode === 'slow') o.latency_ms = 2500; else if (it.mode === 'fail') o.fail = true; }
      return simulate((body.prompt || '').trim(), toEngine(body.preferences), sc);
    }
    if (route === '/simulate-failure' && M === 'POST') {
      if (body.mode === 'clear' && !body.model_id) overrides = {};
      else { const o = (overrides[body.model_id] = overrides[body.model_id] || {}); if (body.mode === 'fail') o.fail = true; else if (body.mode === 'unavailable') o.unavailable = true; else if (body.mode === 'slow') o.latency_ms = 2500; else delete overrides[body.model_id]; }
      store.set('vx_overrides', overrides); return { overrides };
    }
    if (route === '/history' && M === 'GET') { const lim = Number(new URLSearchParams(query || '').get('limit')) || 50; return { history: store.get('vx_history', []).filter((x) => x.user_id === user.id).reverse().slice(0, lim) }; }
    if (route === '/history' && M === 'DELETE') { store.set('vx_history', store.get('vx_history', []).filter((x) => x.user_id !== user.id)); return { ok: true }; }
    if (route === '/analytics') return analytics(user.id);
    throw fail(404, 'Not found.');
  };
})();
