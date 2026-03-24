import { useEffect, useRef, useCallback } from "react";

const N = 52;

const LABELS = [
  "LABOR: A-", "CO₂: LOW", "NON-GMO", "FAIR TRADE", "LOBBY: $2.1M",
  "SUPPLY CHAIN", "RECALL: 0", "TAX: ONSHORE", "EPA: CLEAN",
  "DIVERSITY: A", "ORGANIC", "WORKER PAY: B+", "PACKAGING: C",
];

const COL = {
  bracket: "rgba(120,150,180,0.28)",
  bracketScan: "#3b8beb",
  bracketDone: "#00e676",
  barDim: "rgba(160,180,200,0.07)",
  barLit: "rgba(215,230,245,0.8)",
  scanLine: "#3b8beb",
  good: "#00e676",
  mid: "#ffb300",
  bad: "#ff5252",
};

function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function hex2rgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function gc(g: string) {
  return g === "good" ? COL.good : g === "mid" ? COL.mid : COL.bad;
}

function rGrade(i: number) {
  const r = Math.random();
  if (i < 17) return r < 0.6 ? "good" : r < 0.85 ? "mid" : "bad";
  if (i < 35) return r < 0.2 ? "good" : r < 0.6 ? "mid" : "bad";
  return r < 0.08 ? "good" : r < 0.3 ? "mid" : "bad";
}

interface Bar {
  w: number;
  gap: number;
  h: number;
  g: string;
}

interface Particle {
  x: number;
  y: number;
  text: string;
  color: string;
  vx: number;
  vy: number;
  maxLife: number;
  born: number;
}

function genBars(): Bar[] {
  const bars: Bar[] = [];
  for (let i = 0; i < N; i++) {
    const wide = Math.random() > 0.5;
    bars.push({
      w: wide ? 2.6 + Math.random() * 2.4 : 1.2 + Math.random() * 1.6,
      gap: 0.8 + Math.random() * 1.8,
      h: 0.78 + Math.random() * 0.22,
      g: rGrade(i),
    });
  }
  return bars;
}

function totalWidth(bars: Bar[]) {
  return bars.reduce((s, b) => s + b.w + b.gap, 0);
}

function drawBrackets(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  col: string, lw = 2.2
) {
  const L = 28, r = 4;
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";

  const corners: [number, number, number, number][] = [
    [x, y, 1, 1], [x + w, y, -1, 1],
    [x, y + h, 1, -1], [x + w, y + h, -1, -1],
  ];
  corners.forEach(([cx, cy, dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(cx + dx * L, cy);
    ctx.lineTo(cx + dx * r, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy + dy * r);
    ctx.lineTo(cx, cy + dy * L);
    ctx.stroke();
  });
}

function drawCamera(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, a: number) {
  ctx.strokeStyle = `rgba(140,165,190,${a})`;
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const bw = s, bh = s * 0.65, bx = cx - bw / 2, by = cy - bh / 2 + 3;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, by + bh / 2, s * 0.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, by + bh / 2, s * 0.06, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 6, by);
  ctx.lineTo(cx - 4, by - 5);
  ctx.lineTo(cx + 4, by - 5);
  ctx.lineTo(cx + 6, by);
  ctx.stroke();
}

export function ScannerIdleAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    bars: genBars(),
    phase: "idle" as string,
    t0: 0,
    litTo: -1,
    gradeTo: -1,
    flashA: 0,
    score: 0,
    bNum: "",
    particles: [] as Particle[],
    lastParticleT: 0,
    statusText: "System Ready for Ingestion",
    statusColor: "rgba(160,180,200,0.45)",
  });
  const rafRef = useRef(0);

  const reset = useCallback(() => {
    const s = stateRef.current;
    s.bars = genBars();
    s.litTo = -1;
    s.gradeTo = -1;
    s.score = Math.floor(Math.random() * 50 + 30);
    const d = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
    s.bNum = `${d[0]} ${d.slice(1, 6).join("")} ${d.slice(6, 11).join("")} ${d[11]}`;
    s.particles = [];
  }, []);

  const setPhase = useCallback((p: string) => {
    stateRef.current.phase = p;
    stateRef.current.t0 = performance.now();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    reset();
    setPhase("idle");

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (now: number) => {
      const s = stateRef.current;
      const r = canvas.getBoundingClientRect();
      const w = r.width;
      const h = r.height;
      const dt = now - s.t0;

      ctx.clearRect(0, 0, w, h);

      const pad = 24;
      const vX = pad, vY = pad, vW = w - pad * 2, vH = h - pad * 2;
      const bH = vH * 0.32;
      const tW = totalWidth(s.bars);
      const bX = (w - tW) / 2;
      const bY = (h - bH) / 2 - 4;

      // Draw bars
      let cx = bX;
      s.bars.forEach((bar, i) => {
        const barH = bH * bar.h;
        const barY = bY + (bH - barH);
        let col: string;
        if (i <= s.gradeTo) {
          col = gc(bar.g);
          ctx.shadowColor = gc(bar.g);
          ctx.shadowBlur = 6;
        } else if (i <= s.litTo) {
          col = COL.barLit;
          ctx.shadowColor = "rgba(200,220,240,0.15)";
          ctx.shadowBlur = 3;
        } else {
          col = COL.barDim;
          ctx.shadowBlur = 0;
        }
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.roundRect(cx, barY, bar.w, barH, 0.6);
        ctx.fill();
        ctx.shadowBlur = 0;
        cx += bar.w + bar.gap;
      });

      // Phases
      if (s.phase === "idle") {
        const breathe = 0.08 + Math.sin(now / 1000) * 0.04;
        drawCamera(ctx, w / 2, h / 2 - 4, 32, breathe);
        drawBrackets(ctx, vX, vY, vW, vH, COL.bracket);
        const ringA = 0.04 + Math.sin(now / 1200) * 0.03;
        ctx.strokeStyle = `rgba(59,139,235,${ringA})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2 - 4, 48 + Math.sin(now / 1000) * 4, 0, Math.PI * 2);
        ctx.stroke();
        if (dt > 1300) setPhase("scan");
      }

      if (s.phase === "scan") {
        const prog = Math.min(dt / 2200, 1);
        const ep = ease(prog);
        const sx = bX - 4 + ep * (tW + 8);

        let cx2 = bX;
        s.bars.forEach((bar, i) => {
          if (sx >= cx2 + bar.w * 0.4) s.litTo = Math.max(s.litTo, i);
          cx2 += bar.w + bar.gap;
        });

        const lH = bH + 56;
        const lY = bY - 28;

        const g1 = ctx.createLinearGradient(sx - 50, 0, sx + 50, 0);
        g1.addColorStop(0, "transparent");
        g1.addColorStop(0.5, "rgba(59,139,235,0.12)");
        g1.addColorStop(1, "transparent");
        ctx.fillStyle = g1;
        ctx.fillRect(sx - 50, lY, 100, lH);

        const g2 = ctx.createLinearGradient(sx - 20, 0, sx + 20, 0);
        g2.addColorStop(0, "transparent");
        g2.addColorStop(0.5, "rgba(59,139,235,0.28)");
        g2.addColorStop(1, "transparent");
        ctx.fillStyle = g2;
        ctx.fillRect(sx - 20, lY, 40, lH);

        ctx.fillStyle = COL.scanLine;
        ctx.shadowColor = COL.scanLine;
        ctx.shadowBlur = 12;
        ctx.fillRect(sx - 1, lY, 2.5, lH);
        ctx.shadowBlur = 0;

        ctx.fillStyle = COL.scanLine;
        ctx.fillRect(sx - 7, lY, 14, 2);
        ctx.fillRect(sx - 7, lY + lH - 2, 14, 2);

        drawBrackets(ctx, vX, vY, vW, vH, COL.bracketScan, 2.5);

        // Particles
        if (now - s.lastParticleT > 180 && prog > 0.1 && prog < 0.9) {
          s.lastParticleT = now;
          const label = LABELS[Math.floor(Math.random() * LABELS.length)];
          const py = bY + Math.random() * bH;
          const side = Math.random() > 0.5 ? 1 : -1;
          const px = sx + side * (20 + Math.random() * 20);
          const isGood = /A|LOW|CLEAN|FAIR|ORGANIC|0/.test(label);
          const isBad = /LOBBY|TAX|C$/.test(label);
          const col = isGood ? "rgba(0,230,118,1)" : isBad ? "rgba(255,82,82,1)" : "rgba(59,139,235,1)";
          s.particles.push({
            x: px, y: py, text: label, color: col,
            vx: (Math.random() - 0.5) * 40,
            vy: -Math.random() * 30 - 15,
            maxLife: 1600 + Math.random() * 600,
            born: now,
          });
        }

        if (prog >= 1) { s.flashA = 0.22; setPhase("reveal"); }
      }

      if (s.phase === "reveal") {
        const prog = Math.min(dt / 1100, 1);
        s.gradeTo = Math.floor(ease(prog) * (N - 1));
        drawBrackets(ctx, vX, vY, vW, vH, COL.bracketDone, 2.5);

        if (prog > 0.3) {
          const a = Math.min((prog - 0.3) / 0.35, 1);
          const sc = s.score >= 65 ? COL.good : s.score >= 45 ? COL.mid : COL.bad;
          ctx.font = '700 13px "SF Mono","Menlo","Courier New",monospace';
          ctx.textAlign = "center";
          ctx.fillStyle = hex2rgba(sc, a);
          ctx.shadowColor = sc;
          ctx.shadowBlur = 16 * a;
          ctx.fillText(`ETHICS SCORE: ${s.score} / 100`, w / 2, bY - 24);
          ctx.shadowBlur = 0;
        }
        if (prog > 0.15) {
          const a = Math.min((prog - 0.15) / 0.4, 1) * 0.5;
          ctx.font = '11px "SF Mono","Menlo","Courier New",monospace';
          ctx.textAlign = "center";
          ctx.fillStyle = `rgba(140,165,190,${a})`;
          ctx.fillText(s.bNum, w / 2, bY + bH + 24);
        }
        if (prog >= 1) setPhase("hold");
      }

      if (s.phase === "hold") {
        drawBrackets(ctx, vX, vY, vW, vH, COL.bracketDone, 2.5);
        const sc = s.score >= 65 ? COL.good : s.score >= 45 ? COL.mid : COL.bad;
        const pulse = 0.7 + Math.sin(dt / 600) * 0.3;
        ctx.font = '700 13px "SF Mono","Menlo","Courier New",monospace';
        ctx.textAlign = "center";
        ctx.fillStyle = hex2rgba(sc, pulse);
        ctx.shadowColor = sc;
        ctx.shadowBlur = 14 * pulse;
        ctx.fillText(`ETHICS SCORE: ${s.score} / 100`, w / 2, bY - 24);
        ctx.shadowBlur = 0;

        ctx.font = '11px "SF Mono","Menlo","Courier New",monospace';
        ctx.fillStyle = "rgba(140,165,190,0.45)";
        ctx.fillText(s.bNum, w / 2, bY + bH + 24);

        const labelData = [
          { t: 250, x: bX - 12, y: bY + bH * 0.3, text: "LABOR: A-", align: "right" as CanvasTextAlign, col: COL.good },
          { t: 550, x: bX + tW + 12, y: bY + bH * 0.45, text: "CO₂: LOW", align: "left" as CanvasTextAlign, col: COL.good },
          { t: 850, x: bX - 12, y: bY + bH * 0.65, text: "LOBBY: $2.1M", align: "right" as CanvasTextAlign, col: COL.mid },
          { t: 1100, x: bX + tW + 12, y: bY + bH * 0.75, text: "PACKAGING: C", align: "left" as CanvasTextAlign, col: COL.bad },
        ];
        labelData.forEach((l) => {
          if (dt > l.t) {
            const a = Math.min((dt - l.t) / 500, 1) * 0.55;
            const slide = (1 - ease(Math.min((dt - l.t) / 400, 1))) * (l.align === "right" ? -8 : 8);
            ctx.font = '600 9.5px "SF Mono","Menlo","Courier New",monospace';
            ctx.textAlign = l.align;
            ctx.fillStyle = hex2rgba(l.col, a);
            ctx.fillText(l.text, l.x + slide, l.y);
          }
        });
        if (dt > 2600) setPhase("fade");
      }

      if (s.phase === "fade") {
        const prog = Math.min(dt / 700, 1);
        // Use the background color from the theme
        ctx.fillStyle = `rgba(15,25,35,${ease(prog) * 0.97})`;
        ctx.fillRect(0, 0, w, h);
        drawBrackets(ctx, vX, vY, vW, vH, `rgba(0,230,118,${1 - prog})`);
        if (prog >= 1) { reset(); setPhase("idle"); }
      }

      // Flash
      if (s.flashA > 0) {
        ctx.fillStyle = `rgba(59,139,235,${s.flashA})`;
        ctx.fillRect(0, 0, w, h);
        s.flashA *= 0.8;
        if (s.flashA < 0.005) s.flashA = 0;
      }

      // Particles
      s.particles = s.particles.filter((p) => {
        const age = now - p.born;
        if (age > p.maxLife) return false;
        const t = age / p.maxLife;
        const a = t < 0.15 ? t / 0.15 : t > 0.5 ? Math.max(0, 1 - (t - 0.5) / 0.5) : 1;
        const ex = ease(Math.min(t * 1.5, 1));
        const px = p.x + p.vx * ex;
        const py = p.y + p.vy * ex;
        ctx.font = '600 9px "SF Mono","Menlo","Courier New",monospace';
        ctx.textAlign = "center";
        ctx.fillStyle = p.color.replace("1)", `${a * 0.7})`);
        ctx.fillText(p.text, px, py);
        return true;
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [reset, setPhase]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      aria-hidden="true"
    />
  );
}
