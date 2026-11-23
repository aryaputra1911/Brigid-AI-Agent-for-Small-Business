const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { chromium } = require("playwright");

const FPS = 30;
const DURATION_SEC = 24;
const TOTAL_FRAMES = FPS * DURATION_SEC;
const WIDTH = 1920;
const HEIGHT = 1080;

const FRONTEND_DIR = path.resolve(__dirname, "..");
const MEDIA_DIR = path.join(FRONTEND_DIR, "public", "media");
const FRAMES_DIR = "/tmp/brigid-motion-frames";
const AUDIO_WAV = "/tmp/brigid-motion-sfx.wav";

function buildAudioWav(outPath) {
  const sampleRate = 44100;
  const totalSamples = Math.floor(sampleRate * DURATION_SEC);
  const samples = new Float32Array(totalSamples);

  function addTone(startSec, durSec, freqStart, freqEnd, amp, type = "sine") {
    const startIdx = Math.floor(startSec * sampleRate);
    const len = Math.floor(durSec * sampleRate);
    let phase = 0;
    for (let i = 0; i < len && startIdx + i < totalSamples; i++) {
      const p = i / len;
      const env = Math.sin(Math.PI * p) ** 1.4;
      const freq = freqStart + (freqEnd - freqStart) * p;
      phase += (2 * Math.PI * freq) / sampleRate;
      const val =
        type === "noise"
          ? (Math.random() * 2 - 1) * env * amp
          : Math.sin(phase) * env * amp;
      samples[startIdx + i] += val;
    }
  }

  // Subtle ambient pulse & scene transition whooshes (Zelios-style tactile SFX)
  for (const t of [3.3, 7.3, 12.3, 17.8, 21.3]) {
    addTone(t, 0.35, 160, 70, 0.09, "sine");
    addTone(t, 0.28, 400, 900, 0.035, "noise");
  }
  // Soft UI clicks on typing & button confirm
  for (const t of [8.2, 8.5, 8.8, 10.6, 15.1]) {
    addTone(t, 0.045, 920, 420, 0.07, "sine");
  }
  // Warm confirmation chord at 15.6s ("Executed") & outro lockup at 21.7s
  for (const base of [15.6, 21.7]) {
    addTone(base, 0.9, 329.63, 329.63, 0.055, "sine");
    addTone(base + 0.05, 0.85, 440.0, 440.0, 0.045, "sine");
    addTone(base + 0.1, 0.8, 659.25, 659.25, 0.035, "sine");
  }

  const dataBytes = totalSamples * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataBytes, 40);

  for (let i = 0; i < totalSamples; i++) {
    const clamped = Math.max(-0.95, Math.min(0.95, samples[i]));
    buf.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  fs.writeFileSync(outPath, buf);
}

function buildHtml(logoSvg, outfit400Path, outfit500Path) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  @font-face {
    font-family: "Outfit";
    font-weight: 400;
    src: url("file://${outfit400Path}") format("woff2");
  }
  @font-face {
    font-family: "Outfit";
    font-weight: 500;
    src: url("file://${outfit500Path}") format("woff2");
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${WIDTH}px;
    height: ${HEIGHT}px;
    overflow: hidden;
    background: #07020a;
    color: #ffffff;
    font-family: "Outfit", Arial, sans-serif;
  }
  .stage {
    position: relative;
    width: ${WIDTH}px;
    height: ${HEIGHT}px;
    perspective: 1500px;
    overflow: hidden;
    background:
      radial-gradient(ellipse 80% 55% at 50% 0%, rgba(211, 231, 241, 0.10), transparent 70%),
      #07020a;
  }
  .scene {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transform-style: preserve-3d;
    opacity: 0;
    pointer-events: none;
  }
  .kicker {
    display: inline-block;
    font-size: 20px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #d3e7f1;
    margin-bottom: 18px;
  }
  .headline {
    font-size: 92px;
    font-weight: 500;
    line-height: 1.04;
    letter-spacing: -0.04em;
    color: #ffffff;
  }
  .sub {
    margin-top: 22px;
    font-size: 32px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.76);
    line-height: 1.4;
  }
  .card-3d {
    background: rgba(16, 9, 20, 0.92);
    border: 1px solid rgba(211, 231, 241, 0.24);
    border-radius: 24px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.24),
      0 36px 90px rgba(0, 0, 0, 0.65);
    transform-style: preserve-3d;
  }
  .glass-card {
    background:
      linear-gradient(165deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.03) 50%, rgba(211, 231, 241, 0.08) 100%),
      rgba(14, 10, 18, 0.72);
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 28px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.36),
      0 40px 100px rgba(0, 0, 0, 0.72);
  }
  .pill {
    display: inline-flex;
    align-items: center;
    padding: 8px 18px;
    border-radius: 999px;
    font-size: 18px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .pill-warn {
    background: rgba(120, 53, 15, 0.45);
    border: 1px solid rgba(251, 191, 36, 0.5);
    color: #fde68a;
  }
  .pill-ice {
    background: rgba(211, 231, 241, 0.16);
    border: 1px solid rgba(211, 231, 241, 0.42);
    color: #d3e7f1;
  }
  .pill-ok {
    background: rgba(20, 83, 45, 0.48);
    border: 1px solid rgba(74, 222, 128, 0.48);
    color: #bbf7d0;
  }
  .logo-wrap svg {
    width: 112px;
    height: 112px;
    display: block;
  }
  .cursor-dot {
    position: absolute;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: #d3e7f1;
    box-shadow: 0 0 0 8px rgba(211, 231, 241, 0.22);
    pointer-events: none;
  }
</style>
</head>
<body>
<div class="stage" id="stage">
  <!-- Scene 1: Problem / Friction -->
  <div class="scene" id="s1">
    <div style="width: 1460px; display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 72px; align-items: center;">
      <div id="s1-copy">
        <span class="kicker">Before Brigid</span>
        <div class="headline">Manual checks.<br/>Risky approvals.</div>
        <div class="sub">Unverified bank details hide inside everyday invoices.</div>
      </div>
      <div id="s1-cards" style="position: relative; height: 460px;">
        <div class="card-3d" id="s1-c1" style="position: absolute; top: 20px; left: 20px; width: 500px; padding: 34px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <span style="font-size:24px; font-weight:500;">INV-2026-001</span>
            <span class="pill pill-warn">Needs review</span>
          </div>
          <div style="font-size:22px; color:rgba(255,255,255,0.75);">Stated account differs from supplier record</div>
        </div>
        <div class="card-3d" id="s1-c2" style="position: absolute; top: 210px; left: 80px; width: 500px; padding: 34px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <span style="font-size:24px; font-weight:500;">Transfer 4,500,000 IDR</span>
            <span class="pill pill-warn">No mandate</span>
          </div>
          <div style="font-size:22px; color:rgba(255,255,255,0.75);">Waiting on owner confirmation</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Scene 2: Brand Reveal -->
  <div class="scene" id="s2">
    <div id="s2-inner" style="text-align: center; display: flex; flex-direction: column; align-items: center;">
      <div class="logo-wrap" style="margin-bottom: 28px;">${logoSvg}</div>
      <div class="headline" style="font-size: 120px; letter-spacing: -0.045em;">Brigid</div>
      <div class="sub" style="font-size: 36px; color: #d3e7f1;">Finance guardrails for small business.</div>
    </div>
  </div>

  <!-- Scene 3: Chat & Sentinel Screening -->
  <div class="scene" id="s3">
    <div style="width: 1460px; display: grid; grid-template-columns: 0.85fr 1.15fr; gap: 68px; align-items: center;">
      <div id="s3-copy">
        <span class="kicker">01 · Ask &amp; Screen</span>
        <div class="headline" style="font-size: 74px;">Plain language.<br/>Screened inputs.</div>
        <div class="sub">Every invoice text is screened before a payment is ever proposed.</div>
      </div>
      <div class="card-3d" id="s3-ui" style="padding: 40px;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:22px; border-bottom:1px solid rgba(255,255,255,0.14);">
          <span style="font-size:24px; font-weight:500;">Brigid Chat</span>
          <span class="pill pill-ice">Role: Bookkeeper</span>
        </div>
        <div style="margin-top: 28px; display:flex; flex-direction:column; gap:20px;">
          <div style="align-self:flex-end; background:#d3e7f1; color:#07020a; padding:20px 26px; border-radius:20px; font-size:24px; font-weight:500; max-width:85%;" id="s3-prompt">
            Pay invoice INV-2026-001 to PT Kopi Nusantara.
          </div>
          <div style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.16); padding:24px 28px; border-radius:20px;" id="s3-reply">
            <div style="display:flex; gap:12px; margin-bottom:14px;">
              <span class="pill pill-ok">Account verified •••• 4821</span>
              <span class="pill pill-ice">Sentinel clean</span>
            </div>
            <div style="font-size:23px; color:rgba(255,255,255,0.88); line-height:1.45;">
              Prepared payment proposal for 4,500,000 IDR. Sent to Owner for confirmation.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Scene 4: Ed25519 Approval Card -->
  <div class="scene" id="s4">
    <div style="width: 1460px; display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 72px; align-items: center;">
      <div class="glass-card" id="s4-card" style="padding: 46px; position: relative;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:28px;">
          <span class="kicker" style="margin:0;">Approval Request</span>
          <span class="pill pill-ice" id="s4-status">Pending Owner</span>
        </div>
        <div style="font-size:52px; font-weight:500; letter-spacing:-0.03em; margin-bottom:10px;">4,500,000 IDR</div>
        <div style="font-size:24px; color:rgba(255,255,255,0.75); margin-bottom:32px;">PT Kopi Nusantara · Registered •••• 4821</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:18px; padding:22px; border-radius:16px; background:rgba(7,2,10,0.55); border:1px solid rgba(255,255,255,0.14); margin-bottom:34px;">
          <div>
            <div style="font-size:15px; text-transform:uppercase; letter-spacing:0.08em; color:rgba(255,255,255,0.6);">Signature</div>
            <div style="font-size:21px; margin-top:4px;">Ed25519 single-use</div>
          </div>
          <div>
            <div style="font-size:15px; text-transform:uppercase; letter-spacing:0.08em; color:rgba(255,255,255,0.6);">Balance after</div>
            <div style="font-size:21px; margin-top:4px;">28,400,000 IDR</div>
          </div>
        </div>
        <div style="display:flex; gap:16px;">
          <div id="s4-confirm" style="flex:1; height:64px; border-radius:14px; background:#d3e7f1; color:#07020a; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:600;">
            Confirm payment
          </div>
          <div style="width:180px; height:64px; border-radius:14px; border:1px solid rgba(255,255,255,0.28); display:flex; align-items:center; justify-content:center; font-size:22px;">
            Decline
          </div>
        </div>
        <div class="cursor-dot" id="s4-cursor"></div>
      </div>
      <div id="s4-copy">
        <span class="kicker">02 · Guard &amp; Confirm</span>
        <div class="headline" style="font-size: 74px;">Owner holds<br/>the final key.</div>
        <div class="sub">Confirmation tokens never leave the server. Single-use, role-checked, and expiring.</div>
      </div>
    </div>
  </div>

  <!-- Scene 5: Mobile PWA & Liquid Glass Bottom Nav -->
  <div class="scene" id="s5">
    <div style="width: 1460px; display: grid; grid-template-columns: 0.9fr 1.1fr; gap: 72px; align-items: center;">
      <div id="s5-copy">
        <span class="kicker">03 · Mobile PWA</span>
        <div class="headline" style="font-size: 74px;">Invoices, cash,<br/>and approvals.</div>
        <div class="sub">Built for mobile with an installable PWA and swipeable Liquid Glass navigation.</div>
      </div>
      <div style="display:flex; justify-content:center;">
        <div class="card-3d" id="s5-phone" style="width: 410px; height: 740px; padding: 32px 24px; border-radius: 44px; position: relative; display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <div style="font-size:15px; letter-spacing:0.1em; text-transform:uppercase; color:#d3e7f1; margin-bottom:8px;">Ledger</div>
            <div style="font-size:36px; font-weight:500; margin-bottom:24px;">Invoices</div>
            <div style="display:flex; flex-direction:column; gap:14px;">
              <div style="padding:18px; border-radius:16px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.14);">
                <div style="display:flex; justify-content:space-between; font-size:20px; font-weight:500;">
                  <span>PT Kopi Nusantara</span><span>4.5M</span>
                </div>
                <div style="margin-top:8px;"><span class="pill pill-ok" style="font-size:13px; padding:4px 10px;">Paid</span></div>
              </div>
              <div style="padding:18px; border-radius:16px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.14);">
                <div style="display:flex; justify-content:space-between; font-size:20px; font-weight:500;">
                  <span>CV Kemasan Jaya</span><span>1.8M</span>
                </div>
                <div style="margin-top:8px;"><span class="pill pill-ice" style="font-size:13px; padding:4px 10px;">Open</span></div>
              </div>
            </div>
          </div>
          <div class="glass-card" id="s5-bnav" style="border-radius:999px; padding:12px 18px; display:flex; justify-content:space-between; font-size:15px; color:rgba(255,255,255,0.85);">
            <span>Chat</span>
            <span style="background:rgba(211,231,241,0.24); color:#fff; padding:4px 12px; border-radius:999px;">Invoices</span>
            <span>Cash</span>
            <span>Approvals</span>
            <span>Profile</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Scene 6: Outro Lockup -->
  <div class="scene" id="s6">
    <div id="s6-inner" style="text-align: center; display: flex; flex-direction: column; align-items: center;">
      <div class="logo-wrap" style="margin-bottom: 24px;">${logoSvg}</div>
      <div class="headline" style="font-size: 108px; letter-spacing: -0.04em;">Brigid</div>
      <div class="sub" style="font-size: 32px; color: #d3e7f1;">Controlled finance conversations.</div>
    </div>
  </div>
</div>

<script>
  const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const easeInOut = (t) => {
    const x = clamp(t);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  };
  const seg = (t, a, b) => clamp((t - a) / (b - a));

  window.renderAt = function(t) {
    // Helper for scene fade in/out
    const sceneVis = (id, start, end) => {
      const el = document.getElementById(id);
      const enter = easeOut(seg(t, start, start + 0.45));
      const exit = 1 - easeInOut(seg(t, end - 0.4, end));
      const op = t < start || t > end ? 0 : Math.min(enter, exit);
      el.style.opacity = String(op);
      return { el, enter, exit, local: t - start };
    };

    // Scene 1: 0 - 3.5s
    const s1 = sceneVis("s1", 0, 3.5);
    if (s1.el.style.opacity !== "0") {
      const p = easeOut(seg(t, 0, 1.0));
      const zoomOut = easeInOut(seg(t, 3.0, 3.5));
      document.getElementById("s1-copy").style.transform =
        \`translate3d(\${(1 - p) * -40}px, 0, \${zoomOut * 260}px)\`;
      document.getElementById("s1-c1").style.transform =
        \`rotateY(\${-14 + p * 4}deg) rotateX(6deg) translate3d(0, \${(1 - p) * 35}px, \${zoomOut * 380}px)\`;
      document.getElementById("s1-c2").style.transform =
        \`rotateY(\${-10 + p * 4}deg) rotateX(4deg) translate3d(0, \${(1 - easeOut(seg(t, 0.25, 1.25))) * 45}px, \${zoomOut * 300}px)\`;
    }

    // Scene 2: 3.4 - 7.5s
    const s2 = sceneVis("s2", 3.4, 7.5);
    if (s2.el.style.opacity !== "0") {
      const p = easeOut(seg(t, 3.4, 4.4));
      const z = easeInOut(seg(t, 7.0, 7.5));
      document.getElementById("s2-inner").style.transform =
        \`scale(\${0.86 + p * 0.14 + z * 0.35}) translateZ(\${z * 260}px)\`;
    }

    // Scene 3: 7.4 - 12.5s
    const s3 = sceneVis("s3", 7.4, 12.5);
    if (s3.el.style.opacity !== "0") {
      const p = easeOut(seg(t, 7.4, 8.3));
      const replyP = easeOut(seg(t, 9.6, 10.6));
      const sway = Math.sin((t - 7.4) * 0.9) * 2.5;
      document.getElementById("s3-ui").style.transform =
        \`rotateY(\${-12 + sway}deg) rotateX(5deg) translate3d(\${(1 - p) * 60}px, 0, 0)\`;
      document.getElementById("s3-reply").style.opacity = String(replyP);
      document.getElementById("s3-reply").style.transform =
        \`translateY(\${(1 - replyP) * 24}px)\`;
    }

    // Scene 4: 12.4 - 18.0s
    const s4 = sceneVis("s4", 12.4, 18.0);
    if (s4.el.style.opacity !== "0") {
      const p = easeOut(seg(t, 12.4, 13.3));
      const clickP = seg(t, 14.2, 15.2);
      const confirmed = t >= 15.4;
      document.getElementById("s4-card").style.transform =
        \`rotateY(\${10 - p * 4}deg) rotateX(4deg) translate3d(\${(1 - p) * -50}px, 0, 0)\`;
      const cursor = document.getElementById("s4-cursor");
      const cx = 340 - easeInOut(clickP) * 150;
      const cy = 440 - easeInOut(clickP) * 76;
      cursor.style.left = cx + "px";
      cursor.style.top = cy + "px";
      cursor.style.opacity = t < 15.7 ? String(easeOut(seg(t, 13.8, 14.3))) : "0";
      cursor.style.transform = t >= 15.1 && t <= 15.4 ? "scale(0.75)" : "scale(1)";

      const statusEl = document.getElementById("s4-status");
      const btnEl = document.getElementById("s4-confirm");
      if (confirmed) {
        statusEl.textContent = "Executed";
        statusEl.className = "pill pill-ok";
        btnEl.textContent = "Confirmed";
        btnEl.style.background = "#bbf7d0";
      } else {
        statusEl.textContent = "Pending Owner";
        statusEl.className = "pill pill-ice";
        btnEl.textContent = "Confirm payment";
        btnEl.style.background = "#d3e7f1";
      }
    }

    // Scene 5: 17.9 - 21.5s
    const s5 = sceneVis("s5", 17.9, 21.5);
    if (s5.el.style.opacity !== "0") {
      const p = easeOut(seg(t, 17.9, 18.8));
      const swipeP = easeInOut(seg(t, 19.7, 20.5));
      document.getElementById("s5-phone").style.transform =
        \`rotateY(\${-14 + p * 6}deg) rotateX(4deg) translateY(\${(1 - p) * 50}px)\`;
      document.getElementById("s5-bnav").style.transform =
        \`translateX(\${swipeP * 90}px)\`;
      document.getElementById("s5-bnav").style.opacity = String(1 - swipeP * 0.55);
    }

    // Scene 6: 21.4 - 24.0s
    const s6 = sceneVis("s6", 21.4, 24.0);
    if (s6.el.style.opacity !== "0") {
      const p = easeOut(seg(t, 21.4, 22.3));
      document.getElementById("s6-inner").style.transform =
        \`scale(\${0.92 + p * 0.08})\`;
    }
  };
</script>
</body>
</html>`;
}

async function main() {
  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  fs.mkdirSync(FRAMES_DIR, { recursive: true });

  const logoSvg = fs.readFileSync(
    path.join(FRONTEND_DIR, "public", "brand", "brigid.svg"),
    "utf8",
  );
  const outfit400 = path.join(
    FRONTEND_DIR,
    "node_modules",
    "@fontsource",
    "outfit",
    "files",
    "outfit-latin-400-normal.woff2",
  );
  const outfit500 = path.join(
    FRONTEND_DIR,
    "node_modules",
    "@fontsource",
    "outfit",
    "files",
    "outfit-latin-500-normal.woff2",
  );

  const htmlPath = "/tmp/brigid-motion.html";
  fs.writeFileSync(htmlPath, buildHtml(logoSvg, outfit400, outfit500));
  buildAudioWav(AUDIO_WAV);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 1,
    });
    await page.goto(`file://${htmlPath}`, { waitUntil: "load" });

    for (let f = 0; f < TOTAL_FRAMES; f++) {
      const t = f / FPS;
      await page.evaluate((time) => window.renderAt(time), t);
      const framePath = path.join(
        FRAMES_DIR,
        `frame-${String(f).padStart(4, "0")}.png`,
      );
      await page.screenshot({ path: framePath });
    }
  } finally {
    await browser.close();
  }

  // 1080p master with tactile SFX
  const masterOut = path.join(MEDIA_DIR, "brigid-motion-1080p.mp4");
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-framerate",
      String(FPS),
      "-i",
      path.join(FRAMES_DIR, "frame-%04d.png"),
      "-i",
      AUDIO_WAV,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "20",
      "-preset",
      "medium",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      masterOut,
    ],
    { stdio: "inherit" },
  );

  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  fs.rmSync(AUDIO_WAV, { force: true });
  fs.rmSync(htmlPath, { force: true });
  console.log("Generated:", masterOut);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
