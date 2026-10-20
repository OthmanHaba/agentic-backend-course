---
title: "Agentic Backend Engineering"
subtitle: "Student Guide Book"
doc_type: "Student Guide Book"
lang: en
provider: "NAQLA Training Center"
---

# Welcome to Agentic Backend Engineering

Welcome. For the next five days you will build a real backend API, from an empty Laravel project to a deployed service with an AI assistant inside it. You will do it the way many professional teams now work: with an AI coding agent sitting next to you as a fast, tireless, and sometimes wrong pair programmer.

This course is run by NAQLA Training Center in Tripoli, Libya. It is written for interns and junior engineers. We assume you can program in at least one language, you know the basics of Git (clone, commit, branch), and you can write a simple SQL `SELECT`. We do **not** assume you have used PHP or Laravel before. Everything you need is explained in this book or in the labs.

## The two pillars

Every day of the course has two threads running through it. Keep both in mind.

| Pillar | What it means | Example from the course |
|---|---|---|
| **Building WITH agents** | You use an AI coding agent (Claude Code, connected to your project through Laravel Boost) to explore, plan, write, test, and review code. You are the engineer. The agent is a fast pair. You verify everything. | Asking Claude Code to write Pest tests for `PricingService` before the code exists, then reading every line it produces. |
| **Building agents INTO the backend** | You ship features where your own backend calls a large language model (LLM): structured output, tool calling, agent loops, retrieval, guardrails, evaluations, and cost control. | The Shahna Assistant at `POST /api/agent/chat`, which can quote prices, track shipments, and answer policy questions in Arabic or English. |

The first pillar makes you faster. The second pillar is a new kind of backend work. A good engineer in 2026 needs both, and the two support each other: once you understand how an agent like Claude Code works internally, building one into your own product becomes much less mysterious.

## How to use this book

This guide book is your reference for the week and after it. It is not the lab handout. The labs (given separately) tell you exactly what to build step by step. This book explains *why*, gives you the concepts and vocabulary, and shows working code you can compare against.

Each day chapter follows the same structure:

1. **Learning objectives** — what you should be able to do by the end of the day.
2. **Concept sections** — matching the morning (Session A) and afternoon (Session B) lectures.
3. **How to work with your agent on this** — concrete prompts that work well for the day's tasks.
4. **Common pitfalls** — mistakes we see every time we teach this.
5. **Key takeaways** — a short summary you can reread before the next day.
6. **Self-check questions** — answers are at the end of each chapter. Try them first.

Throughout the book you will see boxed notes:

::: tip
A tip is a shortcut, a good habit, or a clarification worth remembering.
:::

::: warning
A warning marks something that commonly breaks, loses data, or creates a security hole.
:::

::: agent
An "Ask your agent" box contains a prompt you can paste into Claude Code. Adapt it to your situation. Never paste a prompt and accept the output without reading it.
:::

::: checkpoint
A checkpoint tells you what should be true before you move on: tests passing, a command working, a Git tag reached.
:::

**Code in this book** uses the exact names used in the course repository `shahna-api` (for example `App\Services\PricingService` and `App\Enums\ShipmentStatus`). Snippets are trimmed to show the idea; the repository is the full version. Where a library API might change between versions, we say so and tell you where to check.

## Course map

The day runs 09:00 to 16:00, about 40% lecture and demo, 60% hands-on.

| Day | Title | Building WITH agents | Building agents INTO the backend | Checkpoint |
|---|---|---|---|---|
| 1 | Working With AI Agents | How coding agents work; Claude Code + Boost; CLAUDE.md; Explore, Plan, Implement, Verify | What an LLM is, tokens, context, hallucination; what "agentic" means | `day1-end` |
| 2 | APIs and Data, Done Right | Tests first with an agent; AI code review checklist | Designing clean APIs that tools will later call | `day2-end` |
| 3 | Making It Scale | Profiling with an agent and verifying its claims with numbers | Queues (including the future `ai` queue), rate limits, idempotency | `day3-end` |
| 4 | AI Inside the Backend | Agent-assisted tool design and testing with fakes | Prism, structured output, tools, agent loop, memory, retrieval | `day4-end` |
| 5 | Agents in Production | Agent-assisted security review and evals | Guardrails, prompt injection defense, cost, observability, evals, Docker | `day5-end` |

The daily rhythm:

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

## The project: Shahna Logistics

Shahna (شحنة, "shipment") is a fictional Libyan freight company. Customers book truck shipments between Libyan cities. You are joining the backend team. Your job this week is to build `shahna-api`, a single Laravel API that grows a little every day.

### The business in one paragraph

A customer asks for a price to move goods (say 500 kg of furniture) from Tripoli to Benghazi in a box truck. Shahna returns a **quote** that is valid for 15 minutes. If the customer accepts, they **book a shipment** from that quote with a pickup time. The system **assigns a vehicle** from a carrier that has a free truck of the right type and capacity in the origin city. The shipment then moves through statuses until it is delivered. Customers can **track** their shipment and **cancel** it while it is still early in the process. Dispatchers can override assignments. By Day 4, customers can also chat with the **Shahna Assistant** in Arabic or English to do all of this.

### Cities

Shahna serves eight cities, each with a three-letter code:

| Code | City (EN) | City (AR) |
|---|---|---|
| TIP | Tripoli | طرابلس |
| BEN | Benghazi | بنغازي |
| MRA | Misrata | مصراتة |
| SEB | Sebha | سبها |
| ZAW | Zawiya | الزاوية |
| TOB | Tobruk | طبرق |
| SRT | Sirte | سرت |
| GHA | Ghat | غات |

### Pricing rule

```text
price_lyd = 50 + (km × rate_per_km[vehicle_type]) + (weight_kg × 0.02)
```

| Vehicle type | Rate per km (LYD) |
|---|---|
| `van` | 0.8 |
| `box_truck` | 1.2 |
| `flatbed` | 1.5 |
| `reefer` | 1.9 |

The base fee is 50 LYD. The result is rounded to 2 decimal places. A shipment within the same city counts as 0 km.

### Shipment lifecycle

```text
pending ──> confirmed ──> assigned ──> picked_up ──> in_transit ──> delivered
   │            │             │
   └────────────┴─────────────┴──────> cancelled
```

Cancellation is allowed only from `pending`, `confirmed`, or `assigned`. Once the goods are picked up, the shipment cannot be cancelled through the API.

### The stack

| Piece | Role |
|---|---|
| Laravel 12, PHP 8.3+ | The web framework and language |
| PostgreSQL 16 | Main database |
| Redis 7 | Cache, queues, rate limiting |
| Laravel Sail | Runs everything in Docker with one command |
| Laravel Sanctum | API token authentication |
| Pest | Testing framework |
| Laravel Horizon | Queue dashboard and worker manager |
| Prism (`prism-php/prism`) | Calls LLMs (Anthropic provider) from Laravel |
| Laravel Boost | MCP server that gives your coding agent deep knowledge of your Laravel app |
| Claude Code | The AI coding agent you work with |
| k6 | Load testing |

The assistant uses two models, configured in `config/shahna.php` through environment variables:

| Env variable | Default | Used for |
|---|---|---|
| `SHAHNA_AGENT_MODEL` | `claude-sonnet-5-5` | The agent that reasons and calls tools |
| `SHAHNA_FAST_MODEL` | `claude-haiku-5-5` | Cheap, fast classification and routing |

### Catching up with Git tags

If you fall behind, you never stay behind. The repository has a Git tag at the end of every day:

```bash
git fetch --tags
git checkout day2-end        # the finished state of Day 2 = the start of Day 3
git switch -c my-day3        # create your own branch from there
```

Tags: `day1-start`, `day1-end`, `day2-end`, `day3-end`, `day4-end`, `day5-end`. Every tag passes `php artisan test` (2, 23, 56, 80, 104, and 135 tests).

## Setup checklist

Complete this **before Day 1**. Setup problems eat lab time.

| Item | How to check | Notes |
|---|---|---|
| Docker Desktop installed and running | `docker info` prints server details | Give Docker at least 4 GB of memory |
| Git | `git --version` | Configure `user.name` and `user.email` |
| VS Code or PhpStorm | Opens the project folder | VS Code: install the "PHP Intelephense" extension |
| Node 20 or newer | `node --version` shows v20+ | Needed by Claude Code and by Laravel's front-end tooling |
| Claude Code CLI | `claude --version` | Install from the official Anthropic docs |
| Anthropic API key | Provided by the instructor on Day 1 | Never commit it. It goes in `.env` only |
| Repository cloned | `git clone https://github.com/OthmanHaba/shahna-api.git` | The instructor shares the URL |
| Containers start | `./vendor/bin/sail up -d` then `./vendor/bin/sail artisan test` | First run downloads images; do this on good internet |

::: tip
Add a shell alias so you can type `sail` instead of `./vendor/bin/sail`:
`alias sail='sh $([ -f sail ] && echo sail || echo vendor/bin/sail)'`
:::

::: warning
Your API key is a password that costs money. Keep it in `.env`, which is in `.gitignore`. If you ever paste it into a commit, a chat, or a screenshot, tell the instructor so it can be rotated.
:::

::: checkpoint
You are ready when `sail artisan test` prints a green result and `claude` opens inside the `shahna-api` folder.
:::

## Code of conduct for AI use

AI agents are allowed and expected in this course. They are a tool, not an author. These rules apply in the labs, in the capstone, and in your job afterwards.

1. **You own every line you commit.** If the agent wrote it and it is wrong, it is your bug. "The AI did it" is never an explanation in a code review.
2. **Read before you accept.** Read every diff. If you do not understand a line, ask the agent to explain it, then check the explanation against the documentation.
3. **Verify with evidence.** Tests, a running request, a query plan, a load test result. "The agent said it works" is not evidence.
4. **Do not paste secrets.** No API keys, passwords, or real customer data into prompts.
5. **Be honest about AI use.** In your capstone demo you will explain what the agent did and what you did. Honesty is part of the grade.
6. **Stay in control of side effects.** Do not let an agent run destructive commands (dropping databases, force-pushing, deleting files) without you reading the command first.
7. **Learn, do not just copy.** If the agent solves something you could not have solved, take five minutes to understand the solution. That is how you grow.

These rules are not about distrust. They are what makes you a professional who uses powerful tools well.

Let's build.
