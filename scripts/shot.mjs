#!/usr/bin/env node
/**
 * Visual-QA capture with true device emulation (headless Edge/Chrome + DevTools Protocol).
 * Unlike `--window-size`, this honours narrow widths (390 / 360px) and captures the full page.
 *
 *   node scripts/shot.mjs <outDir> <baseUrl> <widths comma-separated> <route> [route…]
 *   node scripts/shot.mjs .qa/after http://localhost:3100 1440,390 / /app /app/trust
 *
 * Set BROWSER to override the browser binary. Requires Node ≥ 22 (global WebSocket).
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const [outDir, base, widthsArg, ...routes] = process.argv.slice(2);
if (!outDir || !base || !widthsArg || routes.length === 0) {
  console.error("usage: node scripts/shot.mjs <outDir> <baseUrl> <w1,w2> <route…>");
  process.exit(1);
}
const widths = widthsArg.split(",").map(Number);
const BROWSER =
  process.env.BROWSER ??
  ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
if (!BROWSER) throw new Error("No Edge/Chrome found; set BROWSER");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(outDir, { recursive: true });
const profile = join(tmpdir(), `hx-shot-${process.pid}`);
const browser = spawn(BROWSER, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], {
  stdio: "ignore",
});

let port;
for (let i = 0; i < 100 && !port; i++) {
  await sleep(100);
  const f = join(profile, "DevToolsActivePort");
  if (existsSync(f)) port = readFileSync(f, "utf8").split("\n")[0].trim();
}
if (!port) throw new Error("browser did not expose a DevTools port");

const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
const listeners = [];
ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
  } else if (msg.method) listeners.forEach((l) => l(msg));
});
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const n = ++id;
    pending.set(n, { res, rej });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const waitFor = (method, timeout = 30000) =>
  new Promise((res) => {
    const t = setTimeout(res, timeout);
    listeners.push((m) => m.method === method && (clearTimeout(t), res(m)));
  });

await send("Page.enable");
for (const w of widths) {
  for (const route of routes) {
    const name = `${route.replace(/^\//, "").replace(/\//g, "_") || "home"}@${w}.png`;
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 768 });
    const loaded = waitFor("Page.loadEventFired");
    await send("Page.navigate", { url: base + route });
    await loaded;
    await sleep(2500); // hydration + client data
    const { result } = await send("Runtime.evaluate", { expression: `Math.max(document.documentElement.scrollHeight, ...[...document.querySelectorAll("main")].map((m) => m.scrollHeight + m.getBoundingClientRect().top + 80))`, returnByValue: true });
    const height = Math.min(Math.max(900, result.value), 16000);
    // Grow the viewport to the full page so every scroll-reveal section is in view, then settle.
    await send("Emulation.setDeviceMetricsOverride", { width: w, height, deviceScaleFactor: 1, mobile: w < 768 });
    await sleep(1200);
    const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync(resolve(outDir, name), Buffer.from(data, "base64"));
    console.log(`captured ${name} (${w}×${height})`);
  }
}
ws.close();
browser.kill();
await sleep(300);
try {
  rmSync(profile, { recursive: true, force: true });
} catch {}
