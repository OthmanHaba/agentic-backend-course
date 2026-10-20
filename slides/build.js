// Builds dist/slides/dayN.pptx from content/dayN.js.
//   node build.js          -> all days
//   node build.js 1 3      -> only day1 and day3
const path = require("path");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require("./apply_theme.js");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "dist", "slides");
const IMG = {
  logo: path.join(__dirname, "assets", "logo-full-trim.png"), // 421x134, alpha-trimmed
  icon: path.join(__dirname, "assets", "logo-icon-trim.png"), // 91x134
  patLight: path.join(ROOT, "brand", "images", "pattern-1.png"),
  patDark: path.join(ROOT, "brand", "images", "pattern-2.png"),
};
const LOGO_RATIO = 421 / 134;
const ICON_RATIO = 91 / 134;

// Brand palette (SPEC section 2)
const O = "FF5723", K = "272827", WW = "E8E2D9", K2 = "3A3B3A", G = "6B7280", G2 = "9CA3AF", S = "D0CBC0", WH = "FFFFFF";
const CARD = "F6F3EE"; // a lighter step of warm white for cards
const F = { head: "Playfair Display", body: "Inter", ar: "Tajawal", arHead: "Tajawal ExtraBold", code: "JetBrains Mono" };

const THEME = {
  name: "NAQLA",
  headFontFace: F.head,
  bodyFontFace: F.body,
  colors: { dk1: K, lt1: WH, dk2: K2, lt2: WW, accent1: O, accent2: K2, accent3: G, accent4: G2, accent5: S, accent6: "FF8A65", hlink: O, folHlink: G },
};

const W = 13.333, H = 7.5, M = 0.6, CW = W - 2 * M, TOP = 1.85, BOT = 6.75;

const RHYTHM = [
  ["09:00", "09:30", "Recap & standup", "quiz"],
  ["09:30", "10:45", "Session A", "A"],
  ["10:45", "11:00", "Break", "break"],
  ["11:00", "12:30", "Lab part 1", "L1"],
  ["12:30", "13:30", "Lunch", "break"],
  ["13:30", "14:15", "Session B", "B"],
  ["14:15", "15:45", "Lab part 2", "L2"],
  ["15:45", "16:00", "Demos, retro, exit ticket", "exit"],
];

const shadow = () => ({ type: "outer", color: "000000", blur: 6, offset: 2, angle: 90, opacity: 0.12 });

// "**bold** plain `code`" -> pptxgenjs runs
// Newlines are turned into breakLine runs here: pptxgenjs splits a run containing "\n" and then
// starts a new paragraph for every following run of that line.
function rich(str, base = {}, acc = {}) {
  const lines = String(str).split("\n");
  if (lines.length > 1) {
    return lines.flatMap((ln, i) => {
      const r = rich(ln || "\u00A0", base, acc);
      if (i < lines.length - 1) r[r.length - 1].options.breakLine = true;
      return r;
    });
  }
  const out = [];
  for (const part of String(str).split(/(\*\*[^*]+\*\*|`[^`]+`)/)) {
    if (!part) continue;
    if (part.startsWith("**")) out.push({ text: part.slice(2, -2), options: { ...base, bold: true, ...(acc.bold || {}) } });
    else if (part.startsWith("`")) out.push({ text: part.slice(1, -1), options: { ...base, fontFace: F.code, color: acc.codeColor || base.color, ...(acc.code || {}) } });
    else out.push({ text: part, options: { ...base } });
  }
  return out;
}

// One paragraph per item; paragraph options live on the first run, breakLine on the last.
function paras(items, base, para, acc) {
  const runs = [];
  items.forEach((it, i) => {
    const r = rich(it, base, acc);
    r[0].options = { ...r[0].options, ...para };
    if (i < items.length - 1) r[r.length - 1].options.breakLine = true;
    runs.push(...r);
  });
  return runs;
}

function arText(s, text, o) {
  s.addText(text, { isTextBox: true, fontFace: F.ar, rtlMode: true, lang: "ar-LY", margin: 0, valign: "top", ...o });
}

// ---------- PHP-ish syntax colouring for code panels ----------
const KW = /^(function|fn|return|public|private|protected|readonly|static|class|enum|case|match|new|use|namespace|if|else|throw|foreach|as|const|extends|implements|try|catch|null|true|false|self|await|async|import|export|from|default|let|const|string|int|bool|float|array|void)$/;
function codeRuns(code, hlLines = [], lang = "php") {
  const lines = code.replace(/\n$/, "").split("\n");
  const runs = [];
  lines.forEach((line, i) => {
    const hl = hlLines.includes(i + 1);
    const lineRuns = [];
    const comment = line.match(/^(\s*)(\/\/|#|--|\*|\/\*)(.*)$/);
    if (lang === "md") lineRuns.push({ text: line || "\u00A0", options: /^#/.test(line) ? { color: O, bold: true } : { color: "E8E2D9" } });
    else if (comment) lineRuns.push({ text: line, options: { color: "8B8F97", italic: true } });
    else {
      for (const tok of line.split(/('[^']*'|"[^"]*"|\$[A-Za-z_]\w*|\b[A-Za-z_]\w*\b|\/\/.*$)/)) {
        if (!tok) continue;
        let color = hl ? "FFFFFF" : "E8E2D9";
        if (/^\/\//.test(tok)) color = "8B8F97";
        else if (/^['"]/.test(tok)) color = "FFB59C";
        else if (/^\$/.test(tok)) color = "F5C9A8";
        else if (KW.test(tok)) color = O;
        else if (/^[A-Z]/.test(tok)) color = "F2EDE6";
        lineRuns.push({ text: tok, options: { color, bold: hl && KW.test(tok) } });
      }
    }
    if (!lineRuns.length) lineRuns.push({ text: "\u00A0", options: {} });
    if (hl) lineRuns.forEach((r) => (r.options.highlight = "4A3A33"));
    if (i < lines.length - 1) lineRuns[lineRuns.length - 1].options.breakLine = true;
    runs.push(...lineRuns);
  });
  return runs;
}

function build(day) {
  const D = require(`./content/day${day}.js`);
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.theme = { headFontFace: F.head, bodyFontFace: F.body };
  pres.author = "NAQLA Training Center";
  pres.company = "NAQLA Training Center";
  pres.title = `Agentic Backend Engineering — Day ${day}: ${D.title}`;
  pres.subject = "Agentic Backend Engineering";
  pres.lang = "en-US";

  const NN = String(day).padStart(2, "0");
  const footer = (color) => ({ text: { text: `NAQLA TRAINING CENTER · ${NN}`, options: { x: M, y: 7.02, w: 6, h: 0.25, fontFace: F.body, fontSize: 9, color, charSpacing: 1, margin: 0 } } });
  const num = (color) => ({ x: W - M - 0.8, y: 7.02, w: 0.8, h: 0.25, fontFace: F.body, fontSize: 9, color, align: "right", margin: 0 });
  const titlePh = (color) => ({ placeholder: { options: { name: "title", type: "title", x: M, y: 0.42, w: CW, h: 0.7, fontFace: F.head, fontSize: 32, bold: true, color, align: "left", valign: "bottom", margin: 0 }, text: "" } });

  pres.defineSlideMaster({ title: "NQ Cover", background: { color: K }, objects: [] });
  pres.defineSlideMaster({ title: "NQ Dark", background: { color: K }, objects: [footer(G2)], slideNumber: num(G2) });
  pres.defineSlideMaster({ title: "NQ Dark Title", background: { color: K }, objects: [footer(G2), titlePh(WH)], slideNumber: num(G2) });
  pres.defineSlideMaster({ title: "NQ Light Title", background: { color: WW }, objects: [footer(G), titlePh(K)], slideNumber: num(G) });

  let section = "Opening";
  const add = (masterName) => pres.addSlide({ masterName, sectionTitle: section });
  const sectionStart = (title) => { section = title; pres.addSection({ title }); };
  const notes = (s, spec) => {
    if (!spec.notes) throw new Error(`Day ${day}: slide "${spec.title || spec.type}" has no speaker notes`);
    s.addNotes(spec.notes);
  };

  // Title + Arabic subtitle on light/dark title layouts
  const head = (s, spec, dark) => {
    s.addText(spec.title, { placeholder: "title" });
    if (spec.ar) arText(s, spec.ar, { x: M, y: 1.16, w: 9, h: 0.42, fontSize: 17, color: dark ? G2 : O, align: "left" });
  };

  // ---------- primitives ----------
  const STYLE = {
    orange: { fill: O, line: O, text: WH, sub: "FFE3D9" },
    dark: { fill: K, line: K, text: WH, sub: G2 },
    light: { fill: WH, line: S, text: K, sub: G },
    card: { fill: CARD, line: S, text: K, sub: G },
    ghost: { fill: null, line: G2, text: K, sub: G, dash: "dash" },
    darkcard: { fill: K2, line: K2, text: WH, sub: G2 },
  };
  function box(s, b) {
    const st = STYLE[b.style || "light"];
    const fs = b.fontSize || 15;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: b.x, y: b.y, w: b.w, h: b.h, rectRadius: 0.08,
      fill: st.fill ? { color: st.fill } : { type: "none" },
      line: { color: st.line, width: 1, dashType: st.dash || "solid" },
      shadow: b.style === "light" || b.style === "card" ? shadow() : undefined,
    });
    const runs = [{ text: b.label, options: { bold: true, fontSize: fs, color: st.text, breakLine: !!b.sub } }];
    if (b.sub) runs.push({ text: b.sub, options: { fontSize: b.subSize || Math.max(11, fs - 3), color: st.sub } });
    s.addText(runs, { x: b.x + 0.08, y: b.y + 0.04, w: b.w - 0.16, h: b.h - 0.08, align: "center", valign: "middle", fontFace: F.body, margin: 0.04, isTextBox: true, paraSpaceAfter: 2 });
  }
  function arrow(s, x1, y1, x2, y2, o = {}) {
    s.addShape(pres.shapes.LINE, {
      x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.max(Math.abs(x2 - x1), 0.001), h: Math.max(Math.abs(y2 - y1), 0.001),
      flipH: x2 < x1, flipV: y2 < y1,
      line: { color: o.color || G, width: o.width || 1.5, dashType: o.dashed ? "dash" : "solid", endArrowType: o.noHead ? undefined : "triangle" },
    });
    if (o.label) {
      const lx = (x1 + x2) / 2, ly = (y1 + y2) / 2;
      const horiz = Math.abs(x2 - x1) >= Math.abs(y2 - y1);
      s.addText(o.label, horiz
        ? { x: lx - 1.3, y: ly - 0.34, w: 2.6, h: 0.3, align: "center", valign: "bottom", fontSize: 11, color: o.labelColor || K2, fontFace: F.body, margin: 0, isTextBox: true }
        : { x: lx + 0.08, y: ly - 0.15, w: 2.2, h: 0.3, align: "left", valign: "middle", fontSize: 11, color: o.labelColor || K2, fontFace: F.body, margin: 0, isTextBox: true });
    }
  }
  function connect(s, a, b, o = {}) {
    const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
    const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
    const gapY = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
    if (gapX >= gapY) {
      const right = bx > ax;
      const y1 = o.fromY != null ? o.fromY : (gapY < 0 ? Math.max(a.y, b.y) / 2 + Math.min(a.y + a.h, b.y + b.h) / 2 : ay);
      const y2 = o.fromY != null ? o.fromY : (gapY < 0 ? y1 : by);
      arrow(s, right ? a.x + a.w : a.x, y1, right ? b.x : b.x + b.w, y2, o);
    } else {
      const down = by > ay;
      const x1 = gapX < 0 ? Math.max(a.x, b.x) / 2 + Math.min(a.x + a.w, b.x + b.w) / 2 : ax;
      const x2 = gapX < 0 ? x1 : bx;
      arrow(s, x1, down ? a.y + a.h : a.y, x2, down ? b.y : b.y + b.h, o);
    }
  }
  function badge(s, x, y, label, d = 0.5, fill = O, color = WH) {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill } });
    s.addText(String(label), { x, y, w: d, h: d, align: "center", valign: "middle", fontFace: F.body, bold: true, fontSize: d > 0.45 ? 14 : 11, color, margin: 0, isTextBox: true });
  }
  function bulletList(s, items, o) {
    const base = { fontFace: F.body, fontSize: o.fontSize || 18, color: o.color || K };
    s.addText(paras(items, base, { bullet: { indent: 18 }, paraSpaceAfter: o.space || 10 }, { codeColor: o.codeColor || (o.color === WH ? "FFB59C" : "C2410C") }),
      { x: o.x, y: o.y, w: o.w, h: o.h, valign: "top", margin: 0, isTextBox: true });
  }
  function caption(s, text, y = 6.3, color = K2) {
    s.addText(rich(text, { fontFace: F.body, fontSize: 14, color, italic: true }, { codeColor: "C2410C" }), { x: M, y, w: CW, h: 0.4, margin: 0, valign: "middle", isTextBox: true });
  }

  // ---------- slide types ----------
  const T = {};

  T.cover = () => {
    const s = add("NQ Cover");
    s.addImage({ path: IMG.patDark, x: 8.2, y: 0, w: W - 8.2, h: H, sizing: { type: "cover", w: W - 8.2, h: H }, altText: "NAQLA pattern" });
    const lh = 0.62; // logo height; clear space >= height of the N
    s.addImage({ path: IMG.logo, x: M, y: 0.6, w: lh * LOGO_RATIO, h: lh, altText: "NAQLA logo" });
    s.addText("AGENTIC BACKEND ENGINEERING", { x: M, y: 2.0, w: 7.2, h: 0.35, fontFace: F.body, fontSize: 13, bold: true, color: O, charSpacing: 3, margin: 0, isTextBox: true });
    s.addText([
      { text: `Day ${day}`, options: { color: O, breakLine: true } },
      { text: D.title, options: { color: WH } },
    ], { x: M, y: 2.45, w: 7.3, h: 2.1, fontFace: F.head, fontSize: D.title.length > 22 ? 36 : 44, bold: true, valign: "top", margin: 0, isTextBox: true, paraSpaceAfter: 0 });
    arText(s, D.ar, { x: M, y: 4.65, w: 7.3, h: 0.55, fontSize: 26, fontFace: F.arHead, color: S, align: "left" });
    s.addText("Build Scalable Backends With and For AI Agents", { x: M, y: 5.35, w: 7.3, h: 0.35, fontFace: F.body, fontSize: 15, color: G2, margin: 0, isTextBox: true });
    s.addText("NAQLA TRAINING CENTER  ·  Tripoli  ·  naqlaa.ly", { x: M, y: 6.75, w: 7.3, h: 0.3, fontFace: F.body, fontSize: 10, color: G2, charSpacing: 1, margin: 0, isTextBox: true });
    s.addNotes(D.coverNotes || `Welcome to Day ${day}: ${D.title}.`);
  };

  T.agenda = () => {
    const s = add("NQ Light Title");
    head(s, { title: "Today's rhythm", ar: "إيقاع اليوم" });
    const labels = {
      A: D.body.find((x) => x.type === "divider" && x.num === "01"),
      B: D.body.find((x) => x.type === "divider" && x.num === "02"),
      L1: D.body.find((x) => x.type === "lab" && x.part === 1),
      L2: D.body.find((x) => x.type === "lab" && x.part === 2),
    };
    const total = 16 * 60 - 9 * 60;
    const toMin = (t) => +t.slice(0, 2) * 60 + +t.slice(3);
    // proportional time bar
    let x = M;
    const barY = 1.95;
    RHYTHM.forEach(([a, b, , k]) => {
      const w = ((toMin(b) - toMin(a)) / total) * CW;
      const fill = k === "A" || k === "B" ? O : k === "L1" || k === "L2" ? K : k === "break" ? S : G2;
      s.addShape(pres.shapes.RECTANGLE, { x, y: barY, w: w - 0.03, h: 0.22, fill: { color: fill }, line: { color: fill } });
      x += w;
    });
    ["09:00", "12:00", "16:00"].forEach((t) => {
      const tx = M + ((toMin(t) - 540) / total) * CW;
      s.addText(t, { x: tx - 0.5, y: barY + 0.26, w: 1, h: 0.25, align: t === "09:00" ? "left" : t === "16:00" ? "right" : "center", fontSize: 10, color: G, fontFace: F.body, margin: 0, isTextBox: true, ...(t === "09:00" ? { x: tx } : t === "16:00" ? { x: tx - 1 } : {}) });
    });
    const cw = (CW - 3 * 0.3) / 4, ch = 1.85;
    RHYTHM.forEach(([a, b, name, k], i) => {
      const cx = M + (i % 4) * (cw + 0.3), cy = 2.85 + Math.floor(i / 4) * (ch + 0.3);
      const hot = k === "A" || k === "B", lab = k === "L1" || k === "L2";
      const fill = hot ? O : lab ? K : CARD;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: cy, w: cw, h: ch, rectRadius: 0.08, fill: { color: fill }, line: { color: hot ? O : lab ? K : S, width: 1 } });
      const tc = hot || lab ? WH : K, sc = hot ? "FFE3D9" : lab ? G2 : G;
      const detail = labels[k] ? (k[0] === "L" ? labels[k].name : labels[k].title.replace(/\*\*/g, "")) : k === "quiz" ? "Quiz on yesterday" : k === "exit" ? "Show, reflect, exit ticket" : "Recharge";
      s.addText([
        { text: `${a}–${b}`, options: { fontSize: 12, color: hot ? WH : O, bold: true, breakLine: true } },
        { text: name, options: { fontSize: 17, bold: true, color: tc, breakLine: true } },
        { text: detail, options: { fontSize: 13, color: sc } },
      ], { x: cx + 0.2, y: cy + 0.15, w: cw - 0.4, h: ch - 0.3, valign: "top", fontFace: F.body, margin: 0, paraSpaceAfter: 4, isTextBox: true });
    });
    s.addNotes(D.agendaNotes || "Walk through the day. Same rhythm every day: about 40% lecture, 60% hands-on. Orange blocks are lecture + live demo, dark blocks are lab time. Point out where the checkpoint tag lands at the end of the day.");
  };

  T.objectives = () => {
    const s = add("NQ Light Title");
    head(s, { title: "By the end of today you can", ar: "أهداف اليوم" });
    const items = D.objectives;
    const cols = items.length > 4 ? 3 : 2, rows = Math.ceil(items.length / cols);
    const gap = 0.3, cw = (CW - (cols - 1) * gap) / cols, ch = Math.min(2.2, (BOT - TOP - (rows - 1) * gap) / rows);
    items.forEach((t, i) => {
      const cx = M + (i % cols) * (cw + gap), cy = TOP + 0.1 + Math.floor(i / cols) * (ch + gap);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: cy, w: cw, h: ch, rectRadius: 0.08, fill: { color: CARD }, line: { color: S, width: 1 }, shadow: shadow() });
      s.addText(String(i + 1).padStart(2, "0"), { x: cx + 0.25, y: cy + 0.2, w: 1, h: 0.55, fontFace: F.head, fontSize: 28, bold: true, color: O, margin: 0, isTextBox: true });
      s.addText(rich(t, { fontFace: F.body, fontSize: 16, color: K }, { codeColor: "C2410C" }), { x: cx + 0.25, y: cy + 0.8, w: cw - 0.5, h: ch - 0.95, valign: "top", margin: 0, isTextBox: true });
    });
    s.addNotes(D.objectivesNotes || "Read the objectives aloud. Tell students the exit ticket at 15:45 checks exactly these.");
  };

  T.divider = (sp) => {
    sectionStart(sp.section || sp.kicker || sp.title);
    const s = add("NQ Dark");
    s.addText(sp.kicker.toUpperCase(), { x: M, y: 2.0, w: 7.6, h: 0.35, fontFace: F.body, fontSize: 13, bold: true, color: O, charSpacing: 3, margin: 0, isTextBox: true });
    s.addText(rich(sp.title, { fontFace: F.head, fontSize: 46, bold: true, color: WH }, { bold: { color: O } }), { x: M, y: 2.45, w: 8.2, h: 1.9, valign: "top", margin: 0, isTextBox: true });
    arText(s, sp.ar, { x: M, y: 4.4, w: 8, h: 0.6, fontSize: 28, color: G2, align: "left" });
    if (sp.topics) s.addText(sp.topics.join("   ·   "), { x: M, y: 5.6, w: 8.6, h: 0.6, fontFace: F.body, fontSize: 13, color: G2, valign: "top", margin: 0, isTextBox: true });
    s.addText(sp.num, { x: 8.9, y: 1.3, w: 3.9, h: 3.4, fontFace: F.head, fontSize: 210, bold: true, color: O, align: "right", valign: "middle", margin: 0, isTextBox: true });
    notes(s, sp);
  };

  T.bullets = (sp) => {
    const s = add("NQ Light Title");
    head(s, sp);
    const side = sp.side;
    const bw = side ? 7.2 : CW;
    bulletList(s, sp.bullets, { x: M, y: TOP + 0.15, w: bw, h: BOT - TOP - 0.15, fontSize: sp.fontSize || 19 });
    if (side) {
      const sx = M + bw + 0.5, sw = CW - bw - 0.5;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: sx, y: TOP + 0.1, w: sw, h: BOT - TOP - 0.3, rectRadius: 0.1, fill: { color: K }, line: { color: K } });
      s.addText((side.kicker || "KEY IDEA").toUpperCase(), { x: sx + 0.35, y: TOP + 0.4, w: sw - 0.7, h: 0.3, fontFace: F.body, fontSize: 11, bold: true, charSpacing: 3, color: G2, margin: 0, isTextBox: true });
      s.addText(side.big, { x: sx + 0.35, y: TOP + 0.8, w: sw - 0.7, h: 1.9, fontFace: F.head, fontSize: side.bigSize || 40, bold: true, color: O, valign: "top", margin: 0, isTextBox: true, fit: "none" });
      s.addText(rich(side.text, { fontFace: F.body, fontSize: 15, color: WW }, { codeColor: "FFB59C" }), { x: sx + 0.35, y: TOP + 2.8, w: sw - 0.7, h: BOT - TOP - 3.3, valign: "top", margin: 0, isTextBox: true });
    }
    notes(s, sp);
  };

  T.cards = (sp) => {
    const s = add("NQ Light Title");
    head(s, sp);
    const n = sp.cards.length, cols = sp.cols || (n === 4 ? 2 : Math.min(n, 3)), rows = Math.ceil(n / cols);
    const gap = 0.3, cw = (CW - (cols - 1) * gap) / cols;
    const top = TOP + 0.1, avail = (sp.caption ? 6.1 : BOT) - top;
    const ch = Math.min(rows === 1 ? 3.6 : 2.3, (avail - (rows - 1) * gap) / rows);
    sp.cards.forEach((c, i) => {
      const cx = M + (i % cols) * (cw + gap), cy = top + Math.floor(i / cols) * (ch + gap);
      const hot = sp.highlight === i;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: cy, w: cw, h: ch, rectRadius: 0.08, fill: { color: hot ? K : CARD }, line: { color: hot ? K : S, width: 1 }, shadow: shadow() });
      badge(s, cx + 0.25, cy + 0.25, c.badge || i + 1, 0.5, O);
      s.addText(c.h, { x: cx + 0.9, y: cy + 0.25, w: cw - 1.1, h: 0.5, fontFace: F.body, fontSize: 17, bold: true, color: hot ? WH : K, valign: "middle", margin: 0, isTextBox: true });
      s.addText(rich(c.d, { fontFace: F.body, fontSize: 14, color: hot ? WW : K2 }, { codeColor: hot ? "FFB59C" : "C2410C" }), { x: cx + 0.25, y: cy + 0.9, w: cw - 0.5, h: ch - 1.05, valign: "top", margin: 0, isTextBox: true });
    });
    if (sp.caption) caption(s, sp.caption);
    notes(s, sp);
  };

  T.stats = (sp) => {
    const s = add("NQ Light Title");
    head(s, sp);
    const n = sp.stats.length, gap = 0.3, cw = (CW - (n - 1) * gap) / n;
    sp.stats.forEach((st, i) => {
      const cx = M + i * (cw + gap), cy = TOP + 0.2, ch = 3.3;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: cy, w: cw, h: ch, rectRadius: 0.08, fill: { color: i === 0 ? K : CARD }, line: { color: i === 0 ? K : S }, shadow: shadow() });
      s.addText(st.n, { x: cx + 0.3, y: cy + 0.3, w: cw - 0.6, h: 1.3, fontFace: F.head, fontSize: st.size || 54, bold: true, color: O, valign: "middle", margin: 0, isTextBox: true });
      s.addText(rich(st.l, { fontFace: F.body, fontSize: 15, color: i === 0 ? WW : K2 }, { codeColor: i === 0 ? "FFB59C" : "C2410C" }), { x: cx + 0.3, y: cy + 1.7, w: cw - 0.6, h: 1.4, valign: "top", margin: 0, isTextBox: true });
    });
    if (sp.caption) caption(s, sp.caption, 5.9);
    notes(s, sp);
  };

  T.flow = (sp) => {
    const s = add("NQ Light Title");
    head(s, sp);
    const n = sp.steps.length, gap = n > 5 ? 0.35 : 0.5, bw = (CW - (n - 1) * gap) / n, bh = sp.boxH || 1.7;
    const by = sp.y || (sp.loop ? 2.3 : 2.5);
    const boxes = sp.steps.map((st, i) => ({ x: M + i * (bw + gap), y: by, w: bw, h: bh, label: st.h, sub: st.d, style: st.style || (i === (sp.highlight ?? -1) ? "orange" : "light"), fontSize: n > 5 ? 14 : 16, subSize: n > 5 ? 11 : 13 }));
    boxes.forEach((b) => box(s, b));
    for (let i = 0; i < n - 1; i++) connect(s, boxes[i], boxes[i + 1], { color: K2 });
    if (sp.loop) {
      const ly = by + bh + 0.45, a = boxes[n - 1], b = boxes[0];
      const ax = a.x + a.w / 2, bx = b.x + b.w / 2;
      arrow(s, ax, by + bh, ax, ly, { noHead: true, color: O, width: 2 });
      arrow(s, ax, ly, bx, ly, { noHead: true, color: O, width: 2 });
      arrow(s, bx, ly, bx, by + bh, { color: O, width: 2 });
      s.addText(sp.loop, { x: bx + 0.3, y: ly + 0.08, w: ax - bx - 0.6, h: 0.35, align: "center", fontFace: F.body, fontSize: 13, italic: true, color: O, margin: 0, isTextBox: true });
    }
    if (sp.bullets) bulletList(s, sp.bullets, { x: M, y: (sp.loop ? by + bh + 1.05 : by + bh + 0.5), w: CW, h: 1.6, fontSize: 16, space: 6 });
    if (sp.caption) caption(s, sp.caption);
    notes(s, sp);
  };

  // nodes/edges diagram: node coords are inches from the content origin (M, TOP)
  T.diagram = (sp) => {
    const s = add(sp.dark ? "NQ Dark Title" : "NQ Light Title");
    head(s, sp, sp.dark);
    const byId = {};
    (sp.zones || []).forEach((z) => {
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + z.x, y: TOP + z.y, w: z.w, h: z.h, rectRadius: 0.1, fill: z.fill ? { color: z.fill, transparency: z.transparency ?? 0 } : { type: "none" }, line: { color: z.line || G2, width: 1, dashType: z.dash === false ? "solid" : "dash" } });
      s.addText(z.label, { x: M + z.x + 0.15, y: TOP + z.y + 0.08, w: z.w - 0.3, h: 0.3, fontFace: F.body, fontSize: 11, bold: true, charSpacing: 2, color: z.color || G, margin: 0, isTextBox: true });
    });
    sp.nodes.forEach((nd) => {
      const b = { ...nd, x: M + nd.x, y: TOP + nd.y };
      byId[nd.id] = b;
      box(s, b);
    });
    (sp.edges || []).forEach((e) => connect(s, byId[e.from], byId[e.to], { color: e.color || (sp.dark ? G2 : K2), labelColor: sp.dark ? WW : K2, ...e }));
    if (sp.caption) caption(s, sp.caption, 6.3, sp.dark ? WW : K2);
    notes(s, sp);
  };

  T.cycle = (sp) => {
    const s = add("NQ Light Title");
    head(s, sp);
    const cx = M + 3.45, cy = TOP + 2.45, rx = 2.3, ry = 1.75, bw = 2.2, bh = 0.95;
    const n = sp.steps.length;
    s.addShape(pres.shapes.OVAL, { x: cx - 1.05, y: cy - 0.55, w: 2.1, h: 1.1, fill: { color: K }, line: { color: K } });
    s.addText(sp.center, { x: cx - 1.05, y: cy - 0.55, w: 2.1, h: 1.1, align: "center", valign: "middle", fontFace: F.body, fontSize: 14, bold: true, color: WH, margin: 0.05, isTextBox: true });
    const pts = sp.steps.map((st, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
      return { x: cx + rx * Math.cos(a) - bw / 2, y: cy + ry * Math.sin(a) - bh / 2, w: bw, h: bh, label: st.h, sub: st.d, style: i === 0 ? "orange" : "light", fontSize: 15, subSize: 11 };
    });
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
      // shorten the centre-to-centre line so it starts/ends outside the boxes
      const clip = (px, py, qx, qy, bb) => {
        const dx = qx - px, dy = qy - py;
        const t = Math.min(Math.abs(bb.w / 2 / (dx || 1e-6)), Math.abs(bb.h / 2 / (dy || 1e-6))) + 0.06 / Math.hypot(dx, dy);
        return [px + dx * t, py + dy * t];
      };
      const [x1, y1] = clip(ax, ay, bx, by, a), [x2, y2] = clip(bx, by, ax, ay, b);
      arrow(s, x1, y1, x2, y2, { color: O, width: 2 });
    }
    pts.forEach((p) => box(s, p));
    if (sp.bullets) bulletList(s, sp.bullets, { x: M + 7.25, y: TOP + 0.3, w: CW - 7.25, h: BOT - TOP - 0.3, fontSize: 16, space: 10 });
    notes(s, sp);
  };

  T.sequence = (sp) => {
    const s = add("NQ Light Title");
    head(s, sp);
    const n = sp.actors.length, aw = 2.1, step = (CW - aw) / (n - 1);
    const xs = sp.actors.map((_, i) => M + aw / 2 + i * step);
    const top = TOP + 0.05;
    const rowH = Math.min(0.52, (BOT - top - 0.75) / sp.msgs.length);
    const lifeEnd = top + 0.75 + rowH * sp.msgs.length + 0.05;
    sp.actors.forEach((a, i) => {
      s.addShape(pres.shapes.LINE, { x: xs[i], y: top + 0.55, w: 0.001, h: lifeEnd - top - 0.55, line: { color: G2, width: 1, dashType: "dash" } });
      box(s, { x: xs[i] - aw / 2, y: top, w: aw, h: 0.55, label: a, style: i === (sp.highlight ?? 1) ? "orange" : "dark", fontSize: 14 });
    });
    sp.msgs.forEach((m, j) => {
      const y = top + 0.75 + rowH * (j + 0.6);
      const x1 = xs[m.from], x2 = xs[m.to];
      if (m.from === m.to) {
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x1 - 0.06, y: y - 0.22, w: 0.12, h: 0.3, rectRadius: 0.02, fill: { color: O }, line: { color: O } });
        s.addText(rich(m.label, { fontFace: F.body, fontSize: 12, color: K }, { codeColor: "C2410C" }), { x: x1 + 0.15, y: y - 0.3, w: step - 0.3, h: 0.4, valign: "middle", margin: 0, isTextBox: true });
        return;
      }
      arrow(s, x1 + (x2 > x1 ? 0.04 : -0.04), y, x2 + (x2 > x1 ? -0.04 : 0.04), y, { color: m.reply ? G : K, dashed: !!m.reply, width: 1.5 });
      s.addText(rich(m.label, { fontFace: F.body, fontSize: 12, color: m.reply ? G : K }, { codeColor: "C2410C" }), { x: Math.min(x1, x2) + 0.1, y: y - 0.32, w: Math.abs(x2 - x1) - 0.2, h: 0.3, align: "center", valign: "bottom", margin: 0, isTextBox: true });
    });
    if (sp.caption) caption(s, sp.caption, 6.35);
    notes(s, sp);
  };

  T.code = (sp) => {
    const s = add("NQ Light Title");
    head(s, sp);
    const lines = sp.code.replace(/\n$/, "").split("\n").length;
    const fs = sp.fontSize || (lines > 16 ? 11 : 12);
    const pw = sp.points ? 8.0 : CW, ph = BOT - TOP - 0.05;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: TOP, w: pw, h: ph, rectRadius: 0.08, fill: { color: K }, line: { color: K } });
    s.addText(sp.file, { x: M + 0.3, y: TOP + 0.15, w: pw - 0.6, h: 0.3, fontFace: F.code, fontSize: 11, color: O, margin: 0, isTextBox: true });
    s.addShape(pres.shapes.LINE, { x: M + 0.3, y: TOP + 0.55, w: pw - 0.6, h: 0, line: { color: K2, width: 1 } });
    s.addText(codeRuns(sp.code, sp.hl, sp.lang), { x: M + 0.3, y: TOP + 0.7, w: pw - 0.5, h: ph - 0.85, fontFace: F.code, fontSize: fs, valign: "top", margin: 0, isTextBox: true, lineSpacingMultiple: 1.05, fit: "none" });
    if (sp.points) bulletList(s, sp.points, { x: M + pw + 0.45, y: TOP + 0.1, w: CW - pw - 0.45, h: ph - 0.1, fontSize: 15, space: 10 });
    notes(s, sp);
  };

  T.prompt = (sp) => {
    const s = add("NQ Dark Title");
    head(s, { title: sp.title || "Ask your agent", ar: sp.ar || "اسأل وكيلك" }, true);
    const pw = 8.0, ph = BOT - TOP - 0.05;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: TOP, w: pw, h: ph, rectRadius: 0.08, fill: { color: K2 }, line: { color: "4A4B4A" } });
    s.addText([{ text: "claude ", options: { color: O, bold: true } }, { text: "›  " + (sp.mode || "plan mode"), options: { color: G2 } }], { x: M + 0.3, y: TOP + 0.18, w: pw - 0.6, h: 0.3, fontFace: F.code, fontSize: 12, margin: 0, isTextBox: true });
    s.addText(rich(sp.prompt.trim(), { fontFace: F.code, fontSize: sp.fontSize || 14, color: WH }, { codeColor: "FFB59C", bold: { color: O } }), { x: M + 0.3, y: TOP + 0.65, w: pw - 0.6, h: ph - 0.85, valign: "top", margin: 0, isTextBox: true, paraSpaceAfter: 6 });
    s.addText("WHY THIS WORKS", { x: M + pw + 0.45, y: TOP + 0.1, w: CW - pw - 0.45, h: 0.3, fontFace: F.body, fontSize: 11, bold: true, charSpacing: 3, color: O, margin: 0, isTextBox: true });
    bulletList(s, sp.why, { x: M + pw + 0.45, y: TOP + 0.55, w: CW - pw - 0.45, h: ph - 0.6, fontSize: 15, color: WH, space: 10 });
    notes(s, sp);
  };

  T.compare = (sp) => {
    const s = add("NQ Light Title");
    head(s, sp);
    const most = Math.max(sp.left.items.length, sp.right.items.length);
    const cw = (CW - 0.4) / 2, ch = Math.min((sp.caption ? 6.1 : BOT) - TOP - 0.1, 1.5 + most * 0.62);
    [sp.left, sp.right].forEach((col, i) => {
      const cx = M + i * (cw + 0.4), dark = i === 1;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: TOP + 0.05, w: cw, h: ch, rectRadius: 0.08, fill: { color: dark ? K : CARD }, line: { color: dark ? K : S }, shadow: shadow() });
      s.addText(col.h, { x: cx + 0.35, y: TOP + 0.3, w: cw - 0.7, h: 0.45, fontFace: F.head, fontSize: 22, bold: true, color: dark ? O : K, margin: 0, isTextBox: true });
      bulletList(s, col.items, { x: cx + 0.35, y: TOP + 0.95, w: cw - 0.7, h: ch - 1.1, fontSize: 16, color: dark ? WH : K, space: 8 });
    });
    if (sp.caption) caption(s, sp.caption);
    notes(s, sp);
  };

  T.pitfalls = (sp) => {
    const s = add("NQ Light Title");
    head(s, { title: sp.title || "Pitfalls to watch", ar: sp.ar || "أخطاء شائعة" });
    const n = sp.items.length, gap = 0.22, rh = Math.min(1.25, (BOT - TOP - 0.45 - (n - 1) * gap) / n);
    const lw = 5.6;
    s.addText("PITFALL", { x: M + 0.75, y: TOP, w: 3, h: 0.3, fontFace: F.body, fontSize: 11, bold: true, charSpacing: 3, color: G, margin: 0, isTextBox: true });
    s.addText("DO THIS INSTEAD", { x: M + lw + 0.5, y: TOP, w: 4, h: 0.3, fontFace: F.body, fontSize: 11, bold: true, charSpacing: 3, color: O, margin: 0, isTextBox: true });
    sp.items.forEach((it, i) => {
      const y = TOP + 0.4 + i * (rh + gap);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y, w: CW, h: rh, rectRadius: 0.08, fill: { color: CARD }, line: { color: S }, shadow: shadow() });
      badge(s, M + 0.2, y + rh / 2 - 0.2, "✕", 0.4, K, WH);
      s.addText(rich(it.p, { fontFace: F.body, fontSize: 15, bold: true, color: K }, { codeColor: "C2410C" }), { x: M + 0.75, y: y + 0.08, w: lw - 0.9, h: rh - 0.16, valign: "middle", margin: 0, isTextBox: true });
      badge(s, M + lw - 0.05, y + rh / 2 - 0.2, "✓", 0.4, O, WH);
      s.addText(rich(it.fix, { fontFace: F.body, fontSize: 15, color: K2 }, { codeColor: "C2410C" }), { x: M + lw + 0.5, y: y + 0.08, w: CW - lw - 0.7, h: rh - 0.16, valign: "middle", margin: 0, isTextBox: true });
    });
    notes(s, sp);
  };

  T.table = (sp) => {
    const s = add("NQ Light Title");
    head(s, sp);
    const fs = sp.fontSize || 14;
    const rows = [sp.head.map((h) => ({ text: h, options: { bold: true, color: WH, fill: { color: K }, fontSize: fs } }))];
    sp.rows.forEach((r, i) => rows.push(r.map((c, j) => ({ text: rich(c, { fontSize: fs, color: K, bold: j === 0 && sp.boldFirst !== false }, { codeColor: "C2410C" }), options: { fill: { color: i % 2 ? CARD : WH } } }))));
    s.addTable(rows, { x: M, y: TOP + 0.05, w: CW, colW: sp.colW, fontFace: F.body, fontSize: fs, border: { type: "solid", pt: 0.75, color: S }, margin: [5, 8, 5, 8], valign: "middle", autoPage: false });
    if (sp.caption) caption(s, sp.caption, 6.3);
    notes(s, sp);
  };

  T.statement = (sp) => {
    const s = add("NQ Dark");
    s.addImage({ path: IMG.icon, x: M, y: 1.0, w: 0.55 * ICON_RATIO, h: 0.55, altText: "NAQLA icon" });
    s.addText(rich(sp.text, { fontFace: F.head, fontSize: sp.fontSize || 40, bold: true, color: WH }, { bold: { color: O } }), { x: M, y: 2.0, w: 11, h: 3.0, valign: "middle", margin: 0, isTextBox: true });
    if (sp.ar) arText(s, sp.ar, { x: M, y: 5.15, w: 11, h: 0.55, fontSize: 22, color: G2, align: "left" });
    if (sp.sub) s.addText(rich(sp.sub, { fontFace: F.body, fontSize: 16, color: G2 }, { codeColor: "FFB59C" }), { x: M, y: 5.85, w: 11, h: 0.5, margin: 0, isTextBox: true });
    notes(s, sp);
  };

  T.lab = (sp) => {
    sectionStart(`Lab ${day}.${sp.part}`);
    const s = add("NQ Light Title");
    head(s, { title: `Lab briefing — ${sp.name}`, ar: sp.ar });
    const lw = 4.1, lh = BOT - TOP - 0.05;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: TOP, w: lw, h: lh, rectRadius: 0.08, fill: { color: K }, line: { color: K } });
    s.addText(`LAB ${day} · PART ${sp.part}`, { x: M + 0.35, y: TOP + 0.35, w: lw - 0.7, h: 0.3, fontFace: F.body, fontSize: 12, bold: true, charSpacing: 3, color: O, margin: 0, isTextBox: true });
    s.addText(sp.name, { x: M + 0.35, y: TOP + 0.75, w: lw - 0.7, h: 1.1, fontFace: F.head, fontSize: 28, bold: true, color: WH, valign: "top", margin: 0, isTextBox: true });
    s.addText(rich(sp.goal, { fontFace: F.body, fontSize: 14, color: WW }, { codeColor: "FFB59C" }), { x: M + 0.35, y: TOP + 1.95, w: lw - 0.7, h: 1.4, valign: "top", margin: 0, isTextBox: true });
    s.addText([
      { text: "TIME  ", options: { color: G2, bold: true } }, { text: sp.time, options: { color: WH, breakLine: true } },
      { text: "HANDOUT  ", options: { color: G2, bold: true } }, { text: `labs/lab${day}.md`, options: { color: WH, fontFace: F.code, breakLine: true } },
      { text: "CHECKPOINT  ", options: { color: G2, bold: true } }, { text: sp.tag, options: { color: O, fontFace: F.code, bold: true } },
    ], { x: M + 0.35, y: TOP + lh - 1.35, w: lw - 0.7, h: 1.1, fontFace: F.body, fontSize: 12, valign: "bottom", margin: 0, paraSpaceAfter: 5, isTextBox: true });
    const rx = M + lw + 0.5, rw = CW - lw - 0.5;
    s.addText("STEPS", { x: rx, y: TOP + 0.05, w: 3, h: 0.3, fontFace: F.body, fontSize: 11, bold: true, charSpacing: 3, color: O, margin: 0, isTextBox: true });
    const n = sp.steps.length, perLine = Math.floor(((rw - 0.55) * 72) / 7.5); // ~chars per line at 15pt
    // code spans render in a wider mono font, so they count ~1.2x
    const est = (st) => st.replace(/\*\*/g, "").replace(/`([^`]*)`/g, (_, c) => c + c.slice(0, Math.ceil(c.length * 0.2))).length;
    let rowHs = sp.steps.map((st) => 0.3 + 0.25 * Math.ceil(est(st) / perLine));
    const avail = BOT - TOP - 0.45 - 0.1 - 0.75, used = rowHs.reduce((a, b) => a + b, 0); // keep >= 0.75" for DONE WHEN
    if (used > avail) rowHs = rowHs.map((h) => (h * avail) / used);
    let y = TOP + 0.45;
    sp.steps.forEach((st, i) => {
      badge(s, rx, y + 0.02, i + 1, 0.36, i === n - 1 ? K : O);
      s.addText(rich(st, { fontFace: F.body, fontSize: 15, color: K }, { codeColor: "C2410C" }), { x: rx + 0.55, y, w: rw - 0.55, h: rowHs[i], valign: "top", margin: 0, isTextBox: true });
      y += rowHs[i];
    });
    const dy = y + 0.1;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: rx, y: dy, w: rw, h: BOT - dy - 0.05, rectRadius: 0.08, fill: { color: CARD }, line: { color: S } });
    s.addText([{ text: "DONE WHEN  ", options: { bold: true, color: O, charSpacing: 2 } }, ...rich(sp.done, { color: K }, { codeColor: "C2410C" })], { x: rx + 0.25, y: dy + 0.05, w: rw - 0.5, h: BOT - dy - 0.15, fontFace: F.body, fontSize: 14, valign: "middle", margin: 0, isTextBox: true });
    notes(s, sp);
  };

  T.recap = () => {
    sectionStart("Wrap-up");
    const R = D.recap;
    const s = add("NQ Light Title");
    head(s, { title: "Recap", ar: "خلاصة اليوم" });
    const lw = 6.6;
    R.points.forEach((p, i) => {
      const y = TOP + 0.1 + i * 0.8;
      badge(s, M, y + 0.03, "✓", 0.4, O);
      s.addText(rich(p, { fontFace: F.body, fontSize: 16, color: K }, { codeColor: "C2410C" }), { x: M + 0.6, y, w: lw - 0.6, h: 0.7, valign: "top", margin: 0, isTextBox: true });
    });
    const rx = M + lw + 0.4, rw = CW - lw - 0.4, rh = BOT - TOP - 0.05;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: rx, y: TOP, w: rw, h: rh, rectRadius: 0.08, fill: { color: K }, line: { color: K } });
    s.addText("EXIT TICKET TEASER · 15:45", { x: rx + 0.35, y: TOP + 0.3, w: rw - 0.7, h: 0.3, fontFace: F.body, fontSize: 11, bold: true, charSpacing: 3, color: O, margin: 0, isTextBox: true });
    s.addText(rich(R.question, { fontFace: F.body, fontSize: 17, bold: true, color: WH }, { codeColor: "FFB59C" }), { x: rx + 0.35, y: TOP + 0.75, w: rw - 0.7, h: 1.2, valign: "top", margin: 0, isTextBox: true });
    R.options.forEach((o, i) => {
      const y = TOP + 2.05 + i * 0.62;
      badge(s, rx + 0.35, y, "ABCD"[i], 0.4, K2, WH);
      s.addText(rich(o, { fontFace: F.body, fontSize: 14, color: WW }, { codeColor: "FFB59C" }), { x: rx + 0.9, y: y - 0.05, w: rw - 1.25, h: 0.5, valign: "middle", margin: 0, isTextBox: true });
    });
    s.addText("5 MCQ + 1 short answer · answer key with your instructor", { x: rx + 0.35, y: TOP + rh - 0.55, w: rw - 0.7, h: 0.3, fontFace: F.body, fontSize: 11, color: G2, margin: 0, isTextBox: true });
    s.addNotes(R.notes);
  };

  T.closing = () => {
    const s = add("NQ Cover");
    s.addImage({ path: IMG.patDark, x: 8.2, y: 0, w: W - 8.2, h: H, sizing: { type: "cover", w: W - 8.2, h: H }, altText: "NAQLA pattern" });
    const lh = 0.62;
    s.addImage({ path: IMG.logo, x: M, y: 0.6, w: lh * LOGO_RATIO, h: lh, altText: "NAQLA logo" });
    s.addText([{ text: "Thank you", options: { color: WH, breakLine: true } }, { text: `Day ${day} done.`, options: { color: O } }], { x: M, y: 2.0, w: 7.3, h: 1.9, fontFace: F.head, fontSize: 48, bold: true, valign: "top", margin: 0, isTextBox: true });
    arText(s, "شكراً لكم", { x: M, y: 3.95, w: 7.3, h: 0.6, fontSize: 28, fontFace: F.arHead, color: S, align: "left" });
    s.addText(rich(D.next, { fontFace: F.body, fontSize: 17, color: WW }, { codeColor: "FFB59C", bold: { color: O } }), { x: M, y: 4.8, w: 7.3, h: 1.0, valign: "top", margin: 0, isTextBox: true });
    s.addText("NAQLA TRAINING CENTER  ·  naqlaa.ly  ·  contact@naqlaa.ly", { x: M, y: 6.75, w: 7.3, h: 0.3, fontFace: F.body, fontSize: 10, color: G2, charSpacing: 1, margin: 0, isTextBox: true });
    s.addNotes(D.closingNotes || "Close the day. Remind students to push their branch and that tomorrow starts from the checkpoint tag.");
  };

  // ---------- assemble ----------
  pres.addSection({ title: "Opening" });
  T.cover();
  T.agenda();
  T.objectives();
  for (const sp of D.body) {
    if (!T[sp.type]) throw new Error(`Day ${day}: unknown slide type ${sp.type}`);
    T[sp.type](sp);
  }
  T.recap();
  T.closing();
  return pres;
}

(async () => {
  const days = process.argv.slice(2).map(Number);
  for (const day of days.length ? days : [1, 2, 3, 4, 5]) {
    const pres = build(day);
    const file = path.join(OUT, `day${day}.pptx`);
    await pres.writeFile({ fileName: file });
    await applyTheme(file, THEME);
    console.log(`${file}  (${pres.slides.length} slides)`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
