# Agentic Backend Engineering — Course Spec (source of truth)

Every deliverable (curriculum, guide book, labs, slides, starter repo) MUST match this file.
Names, endpoints, class names, and tags here are canonical. Do not invent alternatives.

## 1. Identity

- **Course title (EN):** Agentic Backend Engineering — Build Scalable Backends With and For AI Agents
- **Course title (AR):** هندسة الواجهات الخلفية بالوكلاء الذكيين — بناء أنظمة خلفية قابلة للتوسع بالذكاء الاصطناعي ومن أجله
- **Provider:** NAQLA Training Center (مركز نقلة للتدريب), Tripoli, Libya · naqlaa.ly · contact@naqlaa.ly
- **Duration:** 5 days, in person, 09:00–16:00 (6 teaching hours/day, ~40% lecture / ~60% hands-on)
- **Audience:** interns and junior engineers entering backend or deepening backend skills. Assume basic programming (any language), basic Git, basic SQL. Do NOT assume prior PHP/Laravel.
- **Prerequisites to install before Day 1:** Docker Desktop, Git, VS Code (or PhpStorm), Node 20+, Claude Code CLI, an Anthropic API key (provided per student).
- **Two pillars, both every day:**
  1. **Building WITH agents** — using AI coding agents (Claude Code + Laravel Boost MCP) to plan, write, test, review backend code. The student is the engineer; the agent is a fast pair. Verify everything.
  2. **Building agents INTO the backend** — LLM features in production: structured output, tool calling, agent loops, retrieval, queues, guardrails, evals, cost control.

## 2. Brand (NAQLA Brand Guide v1.0)

- Colors: Brand Orange `#FF5723` (headlines, accents, logo) · Rich Black `#272827` (premium/dark backgrounds, body text) · Warm White `#E8E2D9` (content backgrounds). Ratio 60/30/10. Neutrals seen in guide: `#3A3B3A`, `#6B7280`, `#9CA3AF`, `#D0CBC0`. Orange overlay on photos: rgba(255,87,35,0.15).
- English: headings **Playfair Display**, body **Inter**. Arabic: headings **Shamel** (commercial, not bundled → fallback **Tajawal ExtraBold**), body **Tajawal**. Code: JetBrains Mono.
- Logo files: `brand/images/logo-full.png` (icon + NAQLA, orange on transparent), `logo-icon.png`, `logo-wordmark.png`. Patterns: `brand/images/pattern-1.png`, `pattern-2.png` (orange geometric cubes on warm white).
- Logo rules: never stretch, recolor, rotate, add effects, or place on busy backgrounds. Clear space = height of "N". Min 80px digital full lockup.
- Footer convention: `NAQLA TRAINING CENTER · <section number>` + page number.
- Section numbering style: large orange two-digit numbers "01", "02"… with bilingual titles (English + Arabic) on section dividers, as in the brand guide.

## 3. The running project: Shahna Logistics (شحنة)

Fictional Libyan freight company. Customers book truck shipments between Libyan cities.
Repository name: `shahna-api`. One Laravel API, grown each day.

### Stack (canonical)
Laravel 12 · PHP 8.3+ · PostgreSQL 16 · Redis 7 · Laravel Sail (Docker) · Laravel Sanctum (API tokens) · Pest (tests) · Laravel Horizon (queues) · Prism (`prism-php/prism`, Anthropic provider) · Laravel Boost (MCP for coding agents) · Claude Code · k6 (load testing).
LLM models: `claude-sonnet-5-5` (agent), `claude-haiku-5-5` (cheap classification / routing). Configured via `config/shahna.php` → env `SHAHNA_AGENT_MODEL`, `SHAHNA_FAST_MODEL`.
Retrieval (Day 4): PostgreSQL full-text search (`tsvector`) over policy documents — no extra API key needed. Stretch: pgvector + embeddings.

### Domain model
| Model | Key fields |
|---|---|
| `User` | name, email, password, role enum `customer|dispatcher|admin` |
| `City` | name_en, name_ar, code (TIP, BEN, MRA, SEB, ZAW, TOB, SRT, GHA) |
| `CityDistance` | from_city_id, to_city_id, km |
| `Carrier` | name, phone |
| `Vehicle` | carrier_id, plate, type enum `van|box_truck|flatbed|reefer`, capacity_kg, status enum `available|busy|maintenance`, current_city_id |
| `Quote` | user_id, origin_city_id, destination_city_id, weight_kg, vehicle_type, price_lyd (decimal 10,2), expires_at (15 min) |
| `Shipment` | reference (`SHN-` + 6 uppercase alnum), user_id, quote_id (unique), vehicle_id nullable, origin/destination city ids, weight_kg, vehicle_type, price_lyd, status enum, pickup_at |
| `ShipmentEvent` | shipment_id, status, note, occurred_at |
| `IdempotencyKey` | key, user_id, request_hash, response_status, response_body, expires_at (Day 3) |
| `PolicyDocument` | slug, title, body, search_vector (tsvector) (Day 4) |
| `AgentConversation` / `AgentMessage` | user_id; conversation_id, role, content, tool_calls json (Day 4) |
| `LlmCall` | purpose, model, input_tokens, output_tokens, cost_usd, latency_ms, success (Day 5) |

Shipment status enum `App\Enums\ShipmentStatus`: `pending → confirmed → assigned → picked_up → in_transit → delivered`; `cancelled` allowed from pending/confirmed/assigned only. Transitions enforced in `ShipmentStatus::canTransitionTo()`.

Pricing (`App\Services\PricingService`): `price = (base 50 LYD + km × rate_per_km[vehicle_type] + weight_kg × 0.02) `, rate_per_km: van 0.8, box_truck 1.2, flatbed 1.5, reefer 1.9. Round to 2 decimals. Same city = 0 km.

### API (all under `/api`, JSON, Sanctum bearer tokens)
| Method | Path | Day | Notes |
|---|---|---|---|
| POST | `/auth/register`, `/auth/login` | 2 | returns token |
| GET | `/cities` | 2 | cached (Day 3) |
| POST | `/quotes` | 2 | FormRequest validation; returns quote |
| POST | `/shipments` | 2→3 | body `{quote_id, pickup_at}`; Day 3 requires `Idempotency-Key` header; rejects expired/used quote |
| GET | `/shipments` | 2 | paginated, own only; eager loading (Day 3) |
| GET | `/shipments/{reference}` | 2 | policy: owner or dispatcher |
| POST | `/shipments/{reference}/cancel` | 2 | enforces transitions |
| GET | `/shipments/{reference}/tracking` | 2 | events timeline |
| POST | `/dispatch/shipments/{reference}/assign` | 3 | dispatcher only, manual override |
| POST | `/agent/chat` | 4 | `{message, conversation_id?}` → `{conversation_id, reply, actions[]}`; rate limited (Day 5) |

API Resources: `QuoteResource`, `ShipmentResource`, `ShipmentEventResource`. Errors: Laravel default JSON shape.

### Async (Day 3)
- Event `ShipmentBooked` → listener queues `AssignVehicleJob` (finds available vehicle of right type & capacity in origin city, `lockForUpdate` inside a transaction, sets status `assigned`) and `SendBookingConfirmationJob` (log/mail driver).
- Horizon with queues `default`, `dispatch`, `notifications`, `ai`.
- Rate limiter `api` 60/min per user; `agent` 10/min per user.
- k6 script `load/booking.js`.

### The agent (Day 4–5): "Shahna Assistant"
Class `App\Agent\ShahnaAssistant` using Prism with tools in `App\Agent\Tools\`:
| Tool | Purpose |
|---|---|
| `get_quote` | wraps PricingService, creates Quote |
| `book_shipment` | creates shipment from a quote ONLY if user explicitly confirmed (the tool requires `confirmed: true`; system prompt requires asking first) |
| `track_shipment` | by reference, only the user's own shipments |
| `cancel_shipment` | same rules as API |
| `search_policies` | Postgres FTS over PolicyDocument (top 3 chunks) |
| `escalate_to_human` | creates a support ticket record / log, returns ticket id |

Max steps 6. Conversation history persisted. Day 4 also: `App\Agent\IntentClassifier` (Haiku, structured output: `{intent: quote|book|track|cancel|policy|other, language: ar|en}`) and `App\Agent\ShipmentEmailExtractor` (structured output from a free-text customer email into a quote request).
Day 5: tool-level authorization (tools receive the authenticated user; never trust IDs from the model), prompt-injection defense (policy docs treated as data, tool allow-list, output validation), `LlmCall` logging via a Prism wrapper `App\Agent\LlmGateway`, cost dashboard query, response caching for policy answers, model routing (Haiku classifies → Sonnet only when tools needed), timeout + retry + fallback message, eval command `php artisan agent:eval` reading `tests/Evals/cases.json` (≥15 cases, checks tool chosen + key facts), agent runs on `ai` queue for long tasks, Docker production build notes.

### Git tags in `shahna-api` (students `git checkout` to catch up)
`day1-start`, `day1-end`, `day2-end`, `day3-end`, `day4-end`, `day5-end`. Each `dayN-end` = start of day N+1. Each tag passes `php artisan test`. LLM-calling tests use Prism fakes (`Prism::fake()`), never the real API.

`day1-start` contains: fresh Laravel 12, Sail with pgsql + redis, Pest, Sanctum installed, Boost installed, a `CLAUDE.md` with project conventions, `docs/requirements.md` (the Shahna product brief), and an empty `docs/plans/` folder.

## 4. Day-by-day

Daily rhythm (same every day):
| Time | Block |
|---|---|
| 09:00–09:30 | Recap, standup, quiz from yesterday |
| 09:30–10:45 | Session A (lecture + live demo) |
| 10:45–11:00 | Break |
| 11:00–12:30 | Lab part 1 |
| 12:30–13:30 | Lunch |
| 13:30–14:15 | Session B (lecture + live demo) |
| 14:15–15:45 | Lab part 2 |
| 15:45–16:00 | Demos, retro, exit ticket |

### Day 1 — Working With AI Agents · العمل مع الوكلاء الذكيين
Objectives: explain how LLM coding agents work (context window, tools, loop); set up Claude Code + Boost; write a CLAUDE.md; use the Explore → Plan → Implement → Verify loop; Laravel fundamentals (routing, MVC, Eloquent, migrations, artisan, service container); read and critique AI-generated code.
- Session A: What is an LLM, tokens, context, why agents hallucinate; what "agentic" means; anatomy of Claude Code (tools, permissions, CLAUDE.md, MCP); Laravel Boost; Laravel tour (request lifecycle).
- Session B: Spec-first development; writing a plan file; Eloquent models, migrations, factories, seeders, enums; reviewing a diff; when NOT to use the agent.
- Lab 1 "Scaffold Shahna": run Sail; explore codebase with Claude Code; write `docs/plans/day1-domain.md` with the agent; generate migrations/models/factories/enums for City, CityDistance, Carrier, Vehicle, Quote, Shipment, ShipmentEvent; seeder with 8 Libyan cities + distances + carriers/vehicles; `ShipmentStatus` enum with `canTransitionTo` + Pest unit test. Checkpoint = `day1-end`.
- Pitfalls: agent inventing package APIs, over-scaffolding, skipping migrations review.

### Day 2 — APIs and Data, Done Right · واجهات البرمجة والبيانات بالطريقة الصحيحة
Objectives: design REST resources; validate at the boundary (FormRequests); authenticate (Sanctum) and authorize (Policies); model data in PostgreSQL (keys, constraints, indexes, decimals for money); test-first with Pest (feature tests); have the agent write tests first, then code; review AI code with a checklist.
- Session A: REST design, status codes, resources, pagination; validation & mass assignment; auth vs authz; money and time handling.
- Session B: TDD loop with an agent (red → green → refactor); test pyramid; PostgreSQL indexes & constraints (unique quote_id, FKs, check constraints); AI code review checklist.
- Lab 2 "The Booking API": PricingService (unit tests first), quotes endpoint, shipments CRUD subset, cancel, tracking, policies, API resources; ≥ 20 passing tests. Checkpoint `day2-end`.

### Day 3 — Making It Scale · بناء أنظمة قابلة للتوسع
Objectives: identify bottlenecks (N+1, missing indexes, sync work in requests); use queues/jobs/events with Horizon; cache correctly (what, where, invalidation); prevent double booking (idempotency keys, DB unique constraints, row locks/transactions); rate limit; observe (structured logs, Telescope/Pulse, request IDs); load-test with k6.
- Session A: Scalability mental model (stateless app servers, horizontal scaling, DB as bottleneck); queues & events; race conditions and idempotency.
- Session B: caching strategies; rate limiting; observability; reading a k6 report; using the agent to profile and propose fixes — and verifying its claims with numbers.
- Lab 3 "Ship it async": `ShipmentBooked` event + `AssignVehicleJob` with locking; Idempotency-Key middleware; cache cities/distances; fix seeded N+1 in `GET /shipments`; rate limits; k6 before/after comparison table. Checkpoint `day3-end`.

### Day 4 — AI Inside the Backend · الذكاء الاصطناعي داخل النظام الخلفي
Objectives: call an LLM from Laravel with Prism; get reliable structured output; design tools; build an agent loop with memory; ground answers with retrieval; test LLM code with fakes.
- Session A: LLM API basics (messages, system prompt, temperature, tokens, cost); structured output & schemas; tool calling explained step by step; designing good tools (narrow, typed, safe).
- Session B: agent loop and max steps; conversation memory; retrieval (RAG) with Postgres full-text search; when to use an agent vs a plain function; testing with `Prism::fake()`.
- Lab 4 "Shahna Assistant": IntentClassifier + ShipmentEmailExtractor (structured output); tools; ShahnaAssistant agent; `/api/agent/chat`; PolicyDocument seeder (cancellation, prohibited goods, insurance, delivery times, payment) + FTS search tool; tests with fakes; manual Arabic + English chat tests. Checkpoint `day4-end`.

### Day 5 — Agents in Production · الوكلاء في بيئة الإنتاج
Objectives: secure an agent (authorization inside tools, confirmation for side effects, prompt injection); control cost and latency (model routing, caching, token budgets, async on queues); measure quality with evals; trace and log every LLM call; deploy with Docker; present.
- Session A: threat model for LLM apps (OWASP LLM Top 10 highlights: prompt injection, insecure output handling, excessive agency, sensitive data disclosure); guardrails; human-in-the-loop.
- Session B: evals (golden datasets, assertions, regression); observability (LlmCall table, cost per conversation); reliability (timeouts, retries, fallbacks); production checklist; Docker build; career path.
- Lab 5 "Harden & Ship" (morning) + Capstone (afternoon): LlmGateway logging; tool authorization tests; injection test cases (malicious policy doc / user message); model routing; agent rate limit; `agent:eval` ≥ 15 cases; production Dockerfile; team capstone: each team picks one extension (WhatsApp-style webhook intake, dispatcher copilot that suggests assignments, Arabic voice-note transcript intake, delay-prediction notifier, admin cost dashboard) and demos in 5 min. Checkpoint `day5-end`.

## 5. Assessment
- Daily exit ticket (5 MCQ + 1 short answer) — answer keys in instructor guide.
- Lab checkpoints (tests green at tag) — 40%.
- Capstone demo & code review — 40% (rubric: works, tested, secure, scalable, explains AI usage honestly).
- Participation & daily quizzes — 20%.
- Certificate: NAQLA Certificate of Completion — Agentic Backend Engineering.

## 6. Language policy
- Two complete editions of every document: English (`en`) and Arabic (`ar`, RTL). Slides use bilingual titles (English title + Arabic subtitle, as in the brand guide) with English body.
- Code, commands, file names, identifiers stay in English in both editions. Arabic edition gives the English technical term in parentheses on first use, e.g. «طابور المهام (Queue)».
- Use Modern Standard Arabic, clear and friendly, not overly formal.

## 7. Output layout
```
SPEC.md                       this file
brand/                        logos, patterns, fonts
build/                        template.html, style.css, build.sh (md → html → pdf + docx)
source/en/curriculum.md       instructor-facing curriculum & teaching guide
source/en/guidebook/NN-*.md   student guide book chapters
source/en/labs/labN.md        lab handouts
source/ar/...                 Arabic mirror (same file names)
slides/                       build script + dayN.pptx
dist/en/*.pdf|*.docx, dist/ar/*.pdf|*.docx, dist/slides/*.pptx
shahna-api/                   starter repo with day tags
```
