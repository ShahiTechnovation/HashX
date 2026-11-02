#!/usr/bin/env node
/**
 * Field-style Core Web Vitals probe (LCP, CLS, FCP) using headless Edge/Chrome via DevTools Protocol.
 * Emulates a mid-range phone: 390px, 4× CPU slowdown, ~1.6 Mbps / 150ms RTT. Not a Lighthouse score.
 *
 *   node scripts/perf.mjs http://localhost:3200 / /app
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const [base, ...routes] = process.argv.slice(2);
const BROWSER =
  process.env.BROWSER ??
  ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = join(tmpdir(), `hx-perf-${process.pid}`);
const browser = spawn(BROWSER, ["--headless=new", "--disable-gpu", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
let port;
for (let i = 0; i < 100 && !port; i++) {
  await sleep(100);
  const f = join(profile, "DevToolsActivePort");
  if (existsSync(f)) port = readFileSync(f, "utf8").split("\n")[0].trim();
}

const OBSERVE = `(() => {
  window.__vitals = { lcp: 0, cls: 0, fcp: 0 };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__vitals.lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__vitals.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === "first-contentful-paint") window.__vitals.fcp = e.startTime; }).observe({ type: "paint", buffered: true });
})();`;

for (const route of routes) {
  const results = [];
  for (let run = 0; run < 3; run++) {
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener("open", r, { once: true }));
    let id = 0;
    const pending = new Map();
    const events = [];
    ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) (pending.get(m.id)(m.result), pending.delete(m.id));
      else if (m.method) events.push(m.method);
    });
    const send = (method, params = {}) => new Promise((res) => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });

    await send("Page.enable");
    await send("Network.enable");
    await send("Network.setCacheDisabled", { cacheDisabled: true });
    await send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send("Page.addScriptToEvaluateOnNewDocument", { source: OBSERVE });
    await send("Page.navigate", { url: base + route });
    for (let i = 0; i < 200 && !events.includes("Page.loadEventFired"); i++) await sleep(100);
    await sleep(3000);
    const { result } = await send("Runtime.evaluate", { expression: "JSON.stringify(window.__vitals)", returnByValue: true });
    results.push(JSON.parse(result.value));
    ws.close();
    await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);
  }
  const med = (k) => results.map((r) => r[k]).sort((a, b) => a - b)[1];
  console.log(`${route}  LCP ${Math.round(med("lcp"))}ms  FCP ${Math.round(med("fcp"))}ms  CLS ${med("cls").toFixed(3)}  (median of 3)`);
}
browser.kill();
await sleep(300);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
