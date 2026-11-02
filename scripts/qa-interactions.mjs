#!/usr/bin/env node
/**
 * Browser-level interaction + accessibility QA for the HashX frontend (headless Edge/Chrome via DevTools Protocol).
 * Exercises real clicks/keys against a running build and prints PASS/FAIL per check. Non-zero exit on any FAIL.
 *
 *   node scripts/qa-interactions.mjs http://localhost:3200
 *
 * Checks: link targets, CTAs, tabs (click + arrow keys), accordions, mobile menu focus management, app navigation,
 * mode toggle, wallet menu, composer steps, approval gating, console errors, focus order + visible focus,
 * reduced motion, and a rendered-text contrast scan (approximate — not a substitute for axe or a screen-reader audit).
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const BASE = process.argv[2] ?? "http://localhost:3200";
const BROWSER =
  process.env.BROWSER ??
  ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = join(tmpdir(), `hx-qa-${process.pid}`);
const browser = spawn(BROWSER, ["--headless=new", "--disable-gpu", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
let port;
for (let i = 0; i < 100 && !port; i++) {
  await sleep(100);
  const f = join(profile, "DevToolsActivePort");
  if (existsSync(f)) port = readFileSync(f, "utf8").split("\n")[0].trim();
}
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let msgId = 0;
const pending = new Map();
const events = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? rej(new Error(m.error.message)) : res(m.result);
  } else if (m.method) events.push(m);
});
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const n = ++msgId;
    pending.set(n, { res, rej });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evaluate = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};
const viewport = (w, h = 900) => send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 });
const go = async (route) => {
  events.length = 0;
  await send("Page.navigate", { url: BASE + route });
  for (let i = 0; i < 150 && !events.some((e) => e.method === "Page.loadEventFired"); i++) await sleep(100);
  await sleep(1200);
};
const key = async (k, code = k, keyCode) => {
  const vk = keyCode ?? { Tab: 9, Escape: 27, ArrowRight: 39, ArrowLeft: 37, Home: 36, End: 35, Enter: 13 }[k];
  const text = k === "Enter" ? "\r" : undefined;
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk, text });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk });
  await sleep(120);
};
const consoleErrors = () =>
  events
    .filter((e) => (e.method === "Runtime.consoleAPICalled" && e.params.type === "error") || e.method === "Runtime.exceptionThrown")
    .map((e) => (e.params.exceptionDetails?.exception?.description || e.params.args?.map((a) => a.value ?? a.description).join(" ") || "").slice(0, 160));

await send("Page.enable");
await send("Runtime.enable");
await send("Browser.grantPermissions", { permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"], origin: BASE }).catch(() => {});

// ------------------------------------------------------------------ marketing
await viewport(1440);
await go("/");
check("home: no console errors", consoleErrors().length === 0, consoleErrors().join(" | "));
const anchors = await evaluate(`return [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href')).filter(h => h.length > 1 && !document.querySelector(h))`);
check("home: every #anchor link has a target", anchors.length === 0, anchors.join(", "));
const internal = await evaluate(`return [...new Set([...document.querySelectorAll('a[href^="/"]')].map(a => a.getAttribute('href')))]`);
const bad = [];
for (const h of internal) {
  const r = await fetch(BASE + h);
  if (r.status !== 200) bad.push(`${h} → ${r.status}`);
}
check(`home: ${internal.length} internal links return 200`, bad.length === 0, bad.join(", "));
const ext = await evaluate(`return [...document.querySelectorAll('a[href^="http"]')].map(a => ({ h: a.href, t: a.target, r: a.rel }))`);
check("home: external links open in new tab with rel", ext.every((l) => l.t === "_blank" && /noreferrer|noopener/.test(l.r)), `${ext.length} links`);
const ctas = await evaluate(`const f = t => [...document.querySelectorAll('a')].find(a => a.textContent.trim().startsWith(t))?.getAttribute('href'); return { launch: f('Launch App'), explore: f('Explore HashX'), how: f('See how it works'), open: f('Open HashX'), dev: f('Explore Developer Tools') }`);
check("home: CTA destinations", ctas.launch === "/app" && ctas.explore === "/app" && ctas.how === "#how-it-works" && ctas.open === "/app" && ctas.dev === "/app/developers", JSON.stringify(ctas));
const skip = await evaluate(`return document.querySelector('a[href="#main"]') && !!document.getElementById('main')`);
check("home: skip link targets <main>", skip);

// Trust circuit tabs
const circuit = `const tl = document.querySelector('[role=tablist][aria-label="Payment stage"]'); const tabs = [...tl.querySelectorAll('[role=tab]')];`;
await evaluate(`${circuit} tabs[1].click();`);
await sleep(250);
let s = await evaluate(`${circuit} const cap = document.querySelector('p[aria-live=polite]').textContent; return { sel: tabs.map(t => t.getAttribute('aria-selected')), cap, tabindex: tabs.map(t => t.tabIndex) }`);
check("circuit: click selects stage 2 and updates caption", s.sel[1] === "true" && s.cap.startsWith("Fulfillment verified") && s.tabindex.join() === "-1,0,-1", JSON.stringify(s.sel));
await evaluate(`${circuit} tabs[1].focus();`);
await key("ArrowRight");
s = await evaluate(`${circuit} const settle = [...document.querySelectorAll('div')].find(d => d.textContent.startsWith('Settlement') && d.textContent.includes('Receipt issued only'))?.textContent; return { sel: tabs.map(t => t.getAttribute('aria-selected')), focus: document.activeElement === tabs[2], settle }`);
check("circuit: ArrowRight moves selection + focus to stage 3", s.sel[2] === "true" && s.focus);
check("circuit: final stage never shows settlement complete", /Pending · awaiting on-chain confirmation/.test(s.settle || "") && !/Finalized|Settled|Complete/i.test(s.settle || ""), s.settle);
await key("ArrowRight");
s = await evaluate(`${circuit} return tabs.map(t => t.getAttribute('aria-selected'))`);
check("circuit: ArrowRight wraps to stage 1", s[0] === "true");

// Product preview tabs
const prev = `const tl = document.querySelector('[role=tablist][aria-label="Product preview"]'); const tabs = [...tl.querySelectorAll('[role=tab]')]; const panel = document.getElementById(tabs[0].getAttribute('aria-controls'));`;
const titles = [];
for (let i = 0; i < 4; i++) {
  await evaluate(`${prev} tabs[${i}].click();`);
  await sleep(300);
  titles.push(await evaluate(`${prev} return [tabs[${i}].getAttribute('aria-selected'), panel.querySelector('.text-\\\\[20px\\\\]')?.textContent, panel.getBoundingClientRect().height]`));
}
check("preview: each tab selects and swaps panel content", titles.every((t) => t[0] === "true") && new Set(titles.map((t) => t[1])).size === 4, titles.map((t) => t[1]).join(" | "));
const heights = titles.map((t) => Math.round(t[2]));
check("preview: panel height stable across tabs (desktop)", Math.max(...heights) - Math.min(...heights) <= 60, heights.join("/"));
await evaluate(`${prev} tabs[0].focus();`);
await key("End");
s = await evaluate(`${prev} return [tabs[3].getAttribute('aria-selected'), document.activeElement === tabs[3]]`);
check("preview: End key selects last tab", s[0] === "true" && s[1]);

// Security accordion
const sec = `const btns = [...document.querySelectorAll('#security li > button')];`;
s = await evaluate(`${sec} return btns.map(b => b.getAttribute('aria-expanded'))`);
check("security: first scenario open by default", s[0] === "true" && s.slice(1).every((x) => x === "false"));
await evaluate(`${sec} btns[1].click();`);
await sleep(350);
s = await evaluate(`${sec} const r = document.getElementById(btns[1].getAttribute('aria-controls')); const inner = r.firstElementChild; return { exp: btns.map(b => b.getAttribute('aria-expanded')), h: r.getBoundingClientRect().height, inert0: document.getElementById(btns[0].getAttribute('aria-controls')).firstElementChild.inert, inert1: inner.inert }`);
check("security: opening a row closes the other and un-inerts content", s.exp[1] === "true" && s.exp[0] === "false" && s.h > 40 && s.inert0 === true && s.inert1 === false, JSON.stringify(s));

// FAQ accordion via keyboard
const faq = `const btns = [...document.querySelectorAll('#faq h3 > button')];`;
await evaluate(`${faq} btns[2].focus();`);
await key("Enter");
await sleep(350);
s = await evaluate(`${faq} const r = document.getElementById(btns[2].getAttribute('aria-controls')); return [btns[2].getAttribute('aria-expanded'), Math.round(r.getBoundingClientRect().height), r.getAttribute('role')]`);
check("faq: Enter expands question with region role", s[0] === "true" && s[1] > 40 && s[2] === "region", JSON.stringify(s));
await key("Enter");
await sleep(350);
s = await evaluate(`${faq} return btns[2].getAttribute('aria-expanded')`);
check("faq: Enter collapses again", s === "false");

// Copy button
await evaluate(`[...document.querySelectorAll('#developers button')].find(b => /Copy/.test(b.textContent)).click();`);
await sleep(300);
s = await evaluate(`return [...document.querySelectorAll('#developers button')].some(b => /Copied/.test(b.textContent))`);
check("developers: copy button confirms", s);

// Focus order + visible focus (from top of page)
await go("/");
const focusLog = [];
for (let i = 0; i < 9; i++) {
  await key("Tab");
  focusLog.push(
    await evaluate(`const a = document.activeElement; const cs = getComputedStyle(a); return { t: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 28), visible: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 || /rgb/.test(cs.boxShadow) && cs.boxShadow !== 'none' }`)
  );
}
check("keyboard: skip link is first focus stop", /Skip to content/.test(focusLog[0].t), focusLog[0].t);
check("keyboard: every focus stop shows a visible focus indicator", focusLog.every((f) => f.visible), focusLog.map((f) => `${f.t}:${f.visible ? "✓" : "✗"}`).join(" → "));

// Mobile menu
await viewport(390, 844);
await go("/");
await evaluate(`document.querySelector('button[aria-controls=site-mobile-nav]').click();`);
await sleep(300);
s = await evaluate(`const b = document.querySelector('button[aria-controls=site-mobile-nav]'); const p = document.getElementById('site-mobile-nav'); return { exp: b.getAttribute('aria-expanded'), hidden: p.hidden, focusInPanel: p.contains(document.activeElement), overflow: document.body.style.overflow, label: b.getAttribute('aria-label') }`);
check("mobile menu: opens, moves focus into panel, locks scroll", s.exp === "true" && !s.hidden && s.focusInPanel && s.overflow === "hidden" && s.label === "Close menu", JSON.stringify(s));
await key("Escape");
await sleep(200);
s = await evaluate(`const b = document.querySelector('button[aria-controls=site-mobile-nav]'); return { exp: b.getAttribute('aria-expanded'), back: document.activeElement === b, overflow: document.body.style.overflow }`);
check("mobile menu: Escape closes and returns focus to toggle", s.exp === "false" && s.back && s.overflow === "", JSON.stringify(s));
const hscroll = await evaluate(`return document.documentElement.scrollWidth - window.innerWidth`);
check("mobile 390: no horizontal overflow on home", hscroll <= 0, `${hscroll}px`);
await viewport(360, 800);
await go("/");
check("mobile 360: no horizontal overflow on home", (await evaluate(`return document.documentElement.scrollWidth - window.innerWidth`)) <= 0);

// Reduced motion
await viewport(1440);
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
await go("/");
s = await evaluate(`const els = [...document.querySelectorAll('[data-reveal]')]; return { n: els.length, hidden: els.filter(e => getComputedStyle(e).opacity !== '1').length, dur: getComputedStyle(els[0]).transitionDuration, anim: getComputedStyle(document.querySelector('#hero-title')).animationDuration }`);
check("reduced motion: reveal content fully visible, transitions/animations neutralised", s.hidden === 0 && /^0\.0*1?m?s|^1e-05s|^0s/.test(s.dur) && parseFloat(s.anim) < 0.01, JSON.stringify(s));
await send("Emulation.setEmulatedMedia", { features: [] });

// Contrast scan (approximate: solid backgrounds only, alpha composited against ancestors)
const contrastScan = `
const parse = c => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
const lum = ({ r, g, b }) => { const f = v => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
const bgOf = el => { const stack = []; for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.backgroundImage !== 'none' && n !== document.body) return null; const c = parse(cs.backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; } } let base = { r: 255, g: 255, b: 255, a: 1 }; for (const c of stack.reverse()) base = over(c, base); return base; };
const fails = []; let checked = 0;
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
const seen = new Set();
while (walker.nextNode()) {
  const el = walker.currentNode.parentElement; if (!el || seen.has(el) || !walker.currentNode.textContent.trim()) continue; seen.add(el);
  const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
  const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.5 || el.closest('[aria-hidden=true],[inert],.sr-only,button:disabled,[disabled]')) continue;
  const fg = parse(cs.color), bg = bgOf(el); if (!fg || !bg) continue;
  const c = over(fg, bg); const L1 = lum(c), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 600; const large = size >= 24 || (size >= 18.66 && bold);
  checked++; if (ratio < (large ? 3 : 4.5)) fails.push(ratio.toFixed(2) + ' ' + Math.round(size) + 'px "' + walker.currentNode.textContent.trim().slice(0, 40) + '"');
}
return { checked, fails: [...new Set(fails)].slice(0, 12), count: fails.length };`;
for (const route of ["/", "/app", "/app/trust/inv-fake-fulfillment-scenario-b", "/app/approvals/pay-pending-appr-005", "/app/receipts/rcpt-golden-001"]) {
  await go(route);
  const c = await evaluate(contrastScan);
  check(`contrast ${route}: ${c.checked} text elements ≥ AA`, c.count === 0, c.fails.join("; "));
}

// ------------------------------------------------------------------ application
await send("Runtime.evaluate", { expression: "localStorage.clear()" });
const routes = ["/app", "/app/invoices", "/app/invoices/new", "/app/invoices/inv-pending-approval-05", "/app/trust", "/app/trust/inv-fake-fulfillment-scenario-b",
  "/app/approvals", "/app/approvals/pay-pending-appr-005", "/app/settlements", "/app/settlements/pay-golden-001", "/app/receipts", "/app/receipts/rcpt-golden-001",
  "/app/developers", "/app/demo", "/app/settings"];
for (const r of routes) {
  await go(r);
  const info = await evaluate(`return { h1: document.querySelector('main h1')?.textContent?.trim().slice(0, 40), legacy: [...document.querySelectorAll('[class]')].filter(e => /carbon-|signal-|mineral/.test(e.getAttribute('class'))).length, ov: document.documentElement.scrollWidth - innerWidth }`);
  const errs = consoleErrors();
  check(`route ${r}: renders, no console errors`, info.h1 && errs.length === 0 && info.legacy === 0 && info.ov <= 0, `h1="${info.h1}"${errs.length ? " errors: " + errs.join(" | ") : ""}`);
}
await go("/app");
const nav = await evaluate(`return [...document.querySelectorAll('aside nav[aria-label=Application] a')].map(a => [a.textContent.trim(), a.getAttribute('href'), a.getAttribute('aria-current')])`);
check("sidebar: 9 destinations, Overview marked current", nav.length === 9 && nav[0][2] === "page", nav.map((n) => n[1]).join(" "));
// Mode toggle
await evaluate(`[...document.querySelectorAll('[role=radiogroup][aria-label="Data mode"] [role=radio]')].find(b => b.textContent === 'Connected').click();`);
await sleep(1500);
s = await evaluate(`return { checked: [...document.querySelectorAll('[role=radio]')].map(b => b.textContent + ':' + b.getAttribute('aria-checked')).join(), gate: /Connect your wallet|Sign in with your wallet/.test(document.body.textContent), notice: /backend unreachable/i.test(document.body.textContent) }`);
check("mode toggle: Connected shows wallet gate (no backend here → outage notice)", /Connected:true/.test(s.checked) && s.gate, JSON.stringify(s));
await evaluate(`[...document.querySelectorAll('[role=radio]')].find(b => b.textContent === 'Demo').click();`);
await sleep(1200);
s = await evaluate(`return /Demo:true/.test([...document.querySelectorAll('[role=radio]')].map(b => b.textContent + ':' + b.getAttribute('aria-checked')).join())`);
check("mode toggle: back to Demo", s);
// Wallet menu
await evaluate(`document.querySelector('button[aria-haspopup=menu]').click();`);
await sleep(250);
s = await evaluate(`return !!document.querySelector('[role=menu]') && /Simulated/.test(document.querySelector('[role=menu]').textContent)`);
check("wallet menu: opens with simulated-wallet disclosure", s);
await key("Escape");
await sleep(150);
check("wallet menu: Escape closes", await evaluate(`return !document.querySelector('[role=menu]')`));
// Network select (demo: simulated switch)
s = await evaluate(`const sel = document.querySelector('header select'); return sel ? [...sel.options].map(o => o.textContent) : []`);
check("topbar: network selector lists public networks", s.length >= 3, s.join(", "));
// Composer
await go("/app/invoices/new");
const step1 = await evaluate(`return document.querySelector('main h2, main h3')?.textContent`);
await evaluate(`[...document.querySelectorAll('main button')].find(b => /^Continue/.test(b.textContent.trim())).click();`);
await sleep(400);
const step2 = await evaluate(`return [...document.querySelectorAll('main *')].find(e => /^Step 2 of 4/.test(e.textContent.trim()) && e.children.length === 0)?.textContent`);
check("composer: Continue advances to step 2", !!step2, `${step1} → ${step2}`);
// Approval gating
await go("/app/approvals/pay-pending-appr-005");
s = await evaluate(`const btn = [...document.querySelectorAll('main button')].find(b => /Approve terms/.test(b.textContent)); return btn ? btn.disabled : 'missing'`);
await evaluate(`document.querySelector('main input[type=checkbox]').click();`);
await sleep(200);
const after = await evaluate(`return [...document.querySelectorAll('main button')].find(b => /Approve terms/.test(b.textContent))?.disabled`);
check("approval: primary action disabled until recipient/amount acknowledged", s === true && after === false, `before=${s} after=${after}`);
// Trust check expansion
await go("/app/trust/inv-fake-fulfillment-scenario-b");
s = await evaluate(`const b = [...document.querySelectorAll('main button[aria-expanded]')].find(b => b.getAttribute('aria-expanded') === 'false' && /Pass/.test(b.textContent)); if (!b) return ['missing']; const before = b.getAttribute('aria-expanded'); b.click(); await new Promise(r => setTimeout(r, 200)); return [before, b.getAttribute('aria-expanded')]`);
check("trust: evidence check rows expand", s[0] === "false" && s[1] === "true", JSON.stringify(s));
// Receipt print (print dialog stubbed)
await go("/app/receipts/rcpt-golden-001");
s = await evaluate(`window.print = () => { window.__printed = true }; const b = [...document.querySelectorAll('button')].find(b => /Print/.test(b.textContent)); if (!b) return 'missing'; b.click(); return window.__printed === true`);
check("receipt: Print action invokes window.print", s === true, String(s));
// Demo scenario tabs
await go("/app/demo");
s = await evaluate(`const tabs = [...document.querySelectorAll('main [role=tab]')]; if (tabs.length < 4) return 'tabs=' + tabs.length; tabs[1].click(); await new Promise(r => setTimeout(r, 300)); return tabs[1].getAttribute('aria-selected') + ':' + /Fake fulfillment/.test(document.querySelector('main').textContent)`);
check("proof lab: scenario tabs switch", s === "true:true", String(s));
// Developers tabs
await go("/app/developers");
s = await evaluate(`const tabs = [...document.querySelectorAll('main [role=tab]')]; if (!tabs.length) return 'none'; const t = tabs[tabs.length - 1]; t.click(); await new Promise(r => setTimeout(r, 300)); return t.getAttribute('aria-selected')`);
check("developers: example tabs switch", s === "true", String(s));
// Mobile app drawer
await viewport(390, 844);
await go("/app");
await evaluate(`document.querySelector('button[aria-label="Open navigation"]').click();`);
await sleep(350);
s = await evaluate(`return !!document.querySelector('[role=dialog][aria-label=Navigation]')`);
await key("Escape");
await sleep(250);
const closed = await evaluate(`return !document.querySelector('[role=dialog][aria-label=Navigation]')`);
check("app mobile drawer: opens and closes on Escape", s && closed);
for (const r of ["/app", "/app/approvals/pay-pending-appr-005", "/app/trust/inv-fake-fulfillment-scenario-b", "/app/invoices/new"]) {
  await go(r);
  const ov = await evaluate(`return document.documentElement.scrollWidth - innerWidth`);
  check(`mobile 390 ${r}: no page-level horizontal overflow`, ov <= 0, `${ov}px`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
ws.close();
browser.kill();
await sleep(300);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
process.exit(failed.length ? 1 : 0);
