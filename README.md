# Agentic Backend Engineering — NAQLA Training Center

A 5-day, in-person course for interns and junior backend engineers.
Students build **Shahna Logistics (شحنة)**, a Libyan freight-booking API in Laravel 12, with AI coding agents
(Claude Code + Laravel Boost), and then build an AI agent into it (Prism + Claude), ending with production hardening.

`SPEC.md` is the source of truth for every deliverable.

## Deliverables

| What | English | Arabic |
|---|---|---|
| Curriculum & instructor guide | `dist/en/curriculum.pdf` / `.docx` | `dist/ar/curriculum.pdf` / `.docx` |
| Student guide book | `dist/en/student-guidebook.pdf` / `.docx` | `dist/ar/student-guidebook.pdf` / `.docx` |
| Lab handouts (one per day) | `dist/en/lab1–5.pdf` / `.docx` | `dist/ar/lab1–5.pdf` / `.docx` |
| Lab manual (all labs combined) | `dist/en/lab-manual.pdf` | `dist/ar/lab-manual.pdf` |
| Slides (bilingual titles, English body) | `dist/slides/day1–5.pptx` | — |
| Starter repo | `shahna-api/` (git tags below) | — |

## Starter repo checkpoints

| Tag | Use | Tests |
|---|---|---|
| `day1-start` | Start of Day 1 | 2 |
| `day1-end` | Start of Day 2 | 23 |
| `day2-end` | Start of Day 3 | 56 |
| `day3-end` | Start of Day 4 | 80 |
| `day4-end` | Start of Day 5 | 104 |
| `day5-end` | Reference solution | 135 |

Students who fall behind run `git checkout dayN-end`. Tests use Prism fakes, so they need no API key.
Repo: https://github.com/OthmanHaba/shahna-api (private; make it public or add students before class). It is a git submodule here: clone this course with `git clone --recurse-submodules`.

## Rebuilding

```bash
bash build/build.sh          # every PDF + DOCX (en + ar); `bash build/build.sh en` for one language
cd slides && node build.js   # all decks; `node build.js 3` for Day 3 only
```

Edit the Markdown in `source/en` and `source/ar` (the Arabic files mirror the English ones), or the slide text in `slides/content/dayN.js`.

## Before delivery

- Install the fonts in `brand/fonts` on presenting laptops. The decks reference Playfair Display, Inter, Tajawal and JetBrains Mono by name.
- Arabic headings use Tajawal ExtraBold in place of Shamel, which is a commercial font and is not bundled. Swap it in `build/style.css` and `slides/build.js` once NAQLA licenses it.
- Run `php artisan agent:eval` once with a real `ANTHROPIC_API_KEY`. The agent has only been tested against fakes so far.
- Run the k6 load test (`load/booking.js`) once on Sail. Lab k6 numbers are illustrative.
- Check the model prices in `shahna-api/config/shahna.php` against anthropic.com/pricing in delivery week.
