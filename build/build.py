#!/usr/bin/env python3
"""NAQLA doc pipeline: source/<lang>/**.md -> dist/<lang>/*.pdf + *.docx (pandoc + headless Chrome)."""
import os, re, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
B = ROOT / "build"
TMP = B / f".tmp-{os.getpid()}"  # per-process so parallel builds do not collide
CHROME = os.environ.get("CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
SAMPLE = os.environ.get("SAMPLE") in ("1", "only")
ONLY = os.environ.get("SAMPLE") == "only"  # build just the _ fixtures

COURSE = {
    "en": "Agentic Backend Engineering — Build Scalable Backends With and For AI Agents",
    "ar": "هندسة الواجهات الخلفية بالوكلاء الذكيين — بناء أنظمة خلفية قابلة للتوسع بالذكاء الاصطناعي ومن أجله",
}
FOOTER = {"en": "NAQLA TRAINING CENTER · {}", "ar": "مركز نقلة للتدريب · NAQLA TRAINING CENTER"}
TOC_TITLE = {"en": "Contents", "ar": "المحتويات"}
VERSION = "1.0 · 2026"
GUIDEBOOK = {"en": "Student Guide Book", "ar": "دليل المتدرب"}
LABMANUAL = {"en": "Lab Manual", "ar": "دليل المختبرات"}
CURRICULUM = {"en": "Instructor Curriculum", "ar": "المنهج التدريبي للمدرّب"}


def split_fm(text):
    """Return (dict of simple `key: value` frontmatter, body)."""
    m = re.match(r"---\s*\n(.*?)\n(?:---|\.\.\.)\s*\n", text, re.S)
    if not m:
        return {}, text
    fm = {}
    for line in m.group(1).splitlines():
        k, sep, v = line.partition(":")
        if sep and re.fullmatch(r"\w+", k.strip()):
            fm[k.strip()] = v.strip().strip("\"'")
    return fm, text[m.end():]


def first_h1(body):
    m = re.search(r"^# +(.+?)\s*(?:\{.*\})?$", body, re.M)
    return m.group(1) if m else None


def natkey(p):
    return [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", p.name)]


def md_files(d):
    return sorted((p for p in d.glob("*.md") if (SAMPLE or not p.name.startswith("_")) and (not ONLY or p.name.startswith("_"))), key=natkey)


def run(cmd, **kw):
    subprocess.run(cmd, check=True, **kw)


def render(lang, name, files, meta, book, toc):
    """Concatenate files (frontmatter stripped), then produce pdf + docx."""
    texts = [split_fm(f.read_text(encoding="utf8"))[1].strip() for f in files]
    TMP.mkdir(exist_ok=True)
    src = TMP / f"{lang}-{name}.md"
    src.write_text("\n\n".join(texts) + "\n", encoding="utf8")
    out = ROOT / "dist" / lang
    out.mkdir(parents=True, exist_ok=True)
    rtl = lang == "ar"
    footer = FOOTER[lang].format(meta["doc_type"]).replace("\\", "\\\\").replace('"', '\\"')
    md = {"lang": lang, "dir": "rtl" if rtl else "ltr", "pagetitle": meta["title"], "doc_type": meta["doc_type"],
          "title": meta["title"], "version": VERSION, "footer": footer,
          "bodyclass": "book" if book else "single", "toc-title": TOC_TITLE[lang]}
    if rtl:
        md["rtl"] = "true"
    if meta.get("subtitle"):
        md["subtitle"] = meta["subtitle"]
    if COURSE[lang] not in (meta["title"], meta.get("subtitle")):
        md["course"] = COURSE[lang]
    margs = [a for k, v in md.items() for a in ("-M", f"{k}={v}")]
    common = ["pandoc", str(src), "-f", "markdown+smart", "--resource-path", str(files[0].parent), *margs,
              "--lua-filter", str(B / "callouts.lua")]
    tocargs = ["--toc", "--toc-depth=2"] if toc else []
    page = TMP / f"{lang}-{name}.html"
    run(common + ["-t", "html5", "-s", "--template", str(B / "template.html"), "--syntax-highlighting",
                  str(B / "code.theme"), "--wrap=none", "-o", str(page)] + tocargs)
    run([CHROME, "--headless=new", "--disable-gpu", f"--user-data-dir={TMP / 'chrome'}", "--no-pdf-header-footer", "--allow-file-access-from-files",
         f"--print-to-pdf={out / (name + '.pdf')}", "--virtual-time-budget=10000", page.as_uri()],
        stderr=subprocess.DEVNULL, timeout=180)
    run(common + ["-o", str(out / f"{name}.docx"), "--reference-doc", str(B / f"reference-{lang}.docx")] + tocargs)
    print(f"  {lang}/{name}: pdf+docx")


def build_lang(lang):
    sd = ROOT / "source" / lang
    if not sd.is_dir():
        return
    gb = md_files(sd / "guidebook") if (sd / "guidebook").is_dir() else []
    if gb:
        render(lang, "student-guidebook", gb,
               {"title": GUIDEBOOK[lang], "doc_type": GUIDEBOOK[lang], "subtitle": COURSE[lang]}, True, True)
    labs = md_files(sd / "labs") if (sd / "labs").is_dir() else []
    for f in labs:
        fm, body = split_fm(f.read_text(encoding="utf8"))
        m = re.search(r"(\d+)", f.stem)
        dt = fm.get("doc_type") or (("Lab " if lang == "en" else "المختبر ") + m.group(1) if m else "Lab")
        render(lang, f.stem, [f], {"title": fm.get("title") or first_h1(body) or f.stem, "doc_type": dt,
                                   "subtitle": fm.get("subtitle")}, False, False)
    if labs:
        render(lang, "lab-manual", labs,
               {"title": LABMANUAL[lang], "doc_type": LABMANUAL[lang], "subtitle": COURSE[lang]}, True, True)
    for f in md_files(sd):
        fm, body = split_fm(f.read_text(encoding="utf8"))
        is_cur = f.stem == "curriculum"
        dt = fm.get("doc_type") or (CURRICULUM[lang] if is_cur else "Document")
        toc = fm.get("toc", "true" if is_cur else "false") == "true"
        render(lang, f.stem, [f], {"title": fm.get("title") or first_h1(body) or f.stem, "doc_type": dt,
                                   "subtitle": fm.get("subtitle")}, toc, toc)


def main():
    for l in sys.argv[1:] or ["en", "ar"]:
        ref = B / f"reference-{l}.docx"
        if not ref.exists():
            run(["python3", str(B / "make_reference_docx.py"), l], cwd=ROOT)
        build_lang(l)
    shutil.rmtree(TMP, ignore_errors=True)
    print("done")


if __name__ == "__main__":
    main()
