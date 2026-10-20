# Day 1 — Working With AI Agents

Today you meet both of your main tools: the AI coding agent you will work with all week, and the Laravel framework you will build in. By the end of the day the Shahna database exists, filled with Libyan cities, carriers, and trucks, and you have written your first plan file and your first test with an agent at your side.

## Learning objectives

By the end of Day 1 you should be able to:

- Explain in plain words how an LLM coding agent works: the model, the context window, the tools, and the loop.
- Explain why agents hallucinate and name three ways to reduce it.
- Set up Claude Code with Laravel Boost and write a useful `CLAUDE.md`.
- Use the **Explore → Plan → Implement → Verify** loop on a real task.
- Describe the Laravel request lifecycle and the roles of routes, controllers, models, migrations, artisan, and the service container.
- Create Eloquent models, migrations, factories, seeders, and a PHP enum.
- Read an AI-generated diff critically and decide what to keep.

## Session A: How agents work, and a tour of Laravel

### What is an LLM?

A large language model (LLM) is a program trained on a very large amount of text to do one thing: given some text, predict what text comes next. Everything else — answering questions, writing code, calling tools — is built on top of that one ability.

Three ideas matter for daily work:

**Tokens.** Models do not read characters or words. They read *tokens*, small chunks of text. A short English word is often one token; a long word or a piece of code may be several. Arabic text usually uses more tokens per word than English. Tokens matter because you pay per token and because every model has a maximum number of tokens it can handle at once.

**The context window.** This is everything the model can "see" in a single request: the system instructions, the conversation so far, files that were read, tool results, and your latest message. The model has no other memory. If something is not in the context window, the model does not know it — unless it was in its training data, which may be outdated or wrong for your project.

**Next-token prediction is probabilistic.** The model picks likely continuations. Most of the time, likely is also correct. Sometimes likely is just *plausible*.

### Why agents hallucinate

A hallucination is output that looks confident and correct but is false: a method that does not exist, a config key that was renamed two versions ago, a test that "passes" but asserts nothing.

It happens because the model is completing a pattern. If many libraries have a method called `->withTimeout()`, the model may "predict" that your library has it too. The model has no built-in sense of "I don't know".

| Cause | Example | How to reduce it |
|---|---|---|
| Missing context | Agent guesses your table columns | Let it read the schema (Boost `database-schema` tool) |
| Outdated training data | Uses Laravel 8 style `Kernel.php` middleware | Point it at version-specific docs (Boost `search-docs`) |
| Pattern completion | Invents a plausible package method | Ask it to show where the method is defined in `vendor/` |
| No feedback | Claims code works without running it | Make it run `php artisan test` and show the output |

The general rule: **ground the agent in facts from your project, and close the loop with something that can fail** (a test, a command, a query).

### What "agentic" means

A plain chatbot answers once. An **agent** works in a loop:

```text
          ┌──────────────────────────────────────────┐
          │                                          │
 goal ──> │  1. think: what should I do next?        │
          │  2. act: call a tool (read file, run     │
          │     command, search docs, edit file)     │
          │  3. observe: read the tool's result      │
          │                                          │
          └──────────── repeat until done ───────────┘
                              │
                              v
                        final answer
```

The model itself never touches your computer. It *asks* for a tool call ("read file `app/Models/Shipment.php`"), the agent program (Claude Code) runs it, and the result goes back into the context window. Then the model decides the next step.

This same loop is what you will build *into* Shahna on Day 4. The Shahna Assistant will think, call tools like `get_quote` or `track_shipment`, observe the results, and answer. Pay attention to how Claude Code behaves today; you are studying the design you will implement later.

### Anatomy of Claude Code

Claude Code is a command-line agent. You start it in your project folder:

```bash
cd shahna-api
claude
```

Its main parts:

| Part | What it does | Why you care |
|---|---|---|
| **Model** | The LLM doing the reasoning | Quality and cost depend on it |
| **Tools** | Read files, edit files, search, run shell commands, fetch web pages | This is how it acts on your project |
| **Permissions** | Rules for which tools need your approval | You stay in control of side effects |
| **`CLAUDE.md`** | A file in your repo loaded into context at the start of every session | Your project conventions, always present |
| **MCP servers** | Extra tools from outside programs (Model Context Protocol) | Boost plugs in here |
| **Slash commands** | Built-in commands like `/clear`, `/compact`, `/mcp` | Manage the session |

**Permissions** deserve attention. By default Claude Code asks before editing files or running commands. You can approve once, approve for the session, or deny. When it asks to run a command, *read the command*. Approving `sail artisan migrate:fresh --seed` on your local database is fine. Approving something you do not understand is not.

**Plan mode** is a mode where the agent can read and think but not edit. You can switch modes with Shift+Tab. Use it for exploration and planning.

**`CLAUDE.md`** is the most underrated feature. It is plain Markdown that tells the agent how your project works. The `day1-start` tag already has one. A good `CLAUDE.md` is short and specific:

```text
# Shahna API — conventions

- Laravel 12, PHP 8.3, PostgreSQL 16. Run everything through Sail: `sail artisan ...`.
- Tests: Pest. Run `sail artisan test` before saying a task is done.
- Money: decimal(10,2) columns, LYD. Never use float for money.
- Enums live in app/Enums and are backed string enums.
- Business logic goes in app/Services, not controllers.
- Plans go in docs/plans/. Read docs/requirements.md for the product brief.
- Do not add packages without asking.
```

::: tip
When the agent makes the same mistake twice, add a line to `CLAUDE.md`. That file is how you teach the agent your project once instead of every session.
:::

### Laravel Boost

Laravel Boost is an MCP server built for Laravel projects. The package is already in `composer.json` at `day1-start`; you install it into your project with `sail artisan boost:install` (choose Claude Code), which writes `.mcp.json` so Claude Code starts the server with `php artisan boost:mcp`. It gives Claude Code tools that read *your* application, not the internet's average Laravel app. Among them:

| Boost tool | What it gives the agent |
|---|---|
| `search-docs` | Documentation search matched to the package versions you have installed |
| `database-schema` | Your real tables, columns, and indexes |
| `database-query` | Run a read query against your database |
| `tinker` | Execute PHP inside your app (like `php artisan tinker`) |
| `last-error` | The most recent exception from your logs |
| `read-log-entries` | Recent log lines |

Boost also installs Laravel-specific guidelines for the agent. You can check that the server is connected by typing `/mcp` inside Claude Code and looking for `laravel-boost`.

::: warning
The exact list of Boost tools can change between Boost versions. Run `/mcp` to see what your installation provides.
:::

### A tour of Laravel

Laravel is a PHP web framework. You will mostly build a JSON API, so we focus on the backend parts.

**PHP in 60 seconds.** Variables start with `$`. Statements end with `;`. Classes live in namespaces that match folders (`App\Models\Shipment` is in `app/Models/Shipment.php`). `->` calls a method on an object; `::` calls a static method or reads a constant. Arrays use `[]` and can be lists or key-value maps: `['name' => 'Tripoli']`. PHP 8 has types, enums, named arguments, and `match` expressions — you will see all of them.

**The request lifecycle.** When a request like `GET /api/cities` arrives:

```text
HTTP request
   │
   v
public/index.php           entry point, boots the app (bootstrap/app.php)
   │
   v
Middleware                 auth, rate limiting, JSON handling...
   │
   v
Router (routes/api.php)    matches method + path to a controller action
   │
   v
Controller                 thin: validate, call a service, return a resource
   │
   v
Service / Model            business logic, Eloquent queries
   │
   v
Response (JSON)            back out through middleware to the client
```

**Routes** map URLs to code:

```php
// routes/api.php
use App\Http\Controllers\Api\CityController;
use Illuminate\Support\Facades\Route;

Route::get('/cities', [CityController::class, 'index']);
```

Routes in `routes/api.php` automatically get the `/api` prefix.

**MVC.** Laravel follows Model–View–Controller. In an API, the "view" is the JSON response, usually shaped by an *API Resource* (Day 2). Models talk to the database. Controllers connect requests to models and services.

**Eloquent** is Laravel's ORM: each database table has a model class, and each row becomes an object.

```php
$tripoli = City::where('code', 'TIP')->first();
$tripoli->name_ar;                      // "طرابلس"
$vans = Vehicle::where('type', 'van')->where('status', 'available')->get();
```

**Migrations** are version-controlled database changes, written in PHP. You never edit the database by hand.

**Artisan** is Laravel's command-line tool. Through Sail you run it as `sail artisan ...`. You will use `make:model`, `migrate`, `db:seed`, `test`, `tinker`, and `route:list` constantly.

**The service container** creates objects for you and passes in their dependencies. If a controller's constructor or method asks for a `PricingService`, Laravel builds one and hands it over. This is called *dependency injection*, and it is why your code stays easy to test: in a test, you can swap the real service for a fake.

```php
class QuoteController extends Controller
{
    public function store(StoreQuoteRequest $request, PricingService $pricing)
    {
        // Laravel created both $request and $pricing for us.
    }
}
```

## Session B: Spec first, then models

### Spec-first development

An agent is extremely fast at writing code. That speed is dangerous when nobody has decided *what* to build. Spec-first development means you write down the intent before any code:

1. **Requirements** (`docs/requirements.md`): what the product does, in business words. Already in the repo.
2. **Plan** (`docs/plans/day1-domain.md`): how you will build one piece — tables, columns, relationships, rules, tests, and the order of steps.
3. **Code**, produced in small steps that follow the plan.

The plan file is a contract between you and the agent. You review it *before* any code exists, when changes are cheap.

### The Explore → Plan → Implement → Verify loop

This is the working method for the whole course.

| Step | You do | The agent does | Output |
|---|---|---|---|
| **Explore** | Ask questions about the codebase | Reads files, schema, docs | Shared understanding |
| **Plan** | Review, push back, edit | Drafts a plan file | `docs/plans/*.md` you approved |
| **Implement** | Approve small steps, read diffs | Writes code step by step | Small, reviewable changes |
| **Verify** | Run and read the tests, try requests | Runs tests, fixes failures | Evidence it works |

Skipping Explore leads to code that ignores what already exists. Skipping Plan leads to over-scaffolding. Skipping Verify leads to confident bugs.

### A plan file that works

A good plan is short enough to review in five minutes and specific enough that two engineers would build the same thing from it.

```text
# Plan: Day 1 domain model

## Goal
Create the core tables and models for Shahna: City, CityDistance, Carrier,
Vehicle, Quote, Shipment, ShipmentEvent. Seed 8 Libyan cities.

## Tables
- cities: id, name_en, name_ar, code (char 3, unique)
- city_distances: id, from_city_id FK, to_city_id FK, km (unsigned int),
  unique(from_city_id, to_city_id)
- vehicles: id, carrier_id FK, plate (unique), type (van|box_truck|flatbed|reefer),
  capacity_kg, status (available|busy|maintenance), current_city_id FK
- quotes: ... price_lyd decimal(10,2), expires_at timestamp
- shipments: ... reference unique, quote_id unique FK, status, pickup_at
- shipment_events: shipment_id FK, status, note nullable, occurred_at

## Enums
- App\Enums\ShipmentStatus with canTransitionTo()
- App\Enums\VehicleType, App\Enums\VehicleStatus

## Steps
1. Enums + unit test for ShipmentStatus transitions (test first)
2. Migrations in dependency order; run migrate:fresh
3. Models with relationships and casts
4. Factories
5. Seeder: 8 cities, distances both directions, 4 carriers, 2 vehicles of every type in every city (64)

## Out of scope today
Controllers, routes, auth, pricing.
```

Notice the "Out of scope" section. It stops the agent from "helpfully" generating controllers you did not ask for.

### Migrations

Generate a model with its migration and factory in one command:

```bash
sail artisan make:model Vehicle -mf
```

A migration describes the table:

```php
// database/migrations/xxxx_create_carriers_and_vehicles_tables.php (vehicles part)
use App\Enums\VehicleStatus;
use App\Enums\VehicleType;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('carrier_id')->constrained()->cascadeOnDelete();
            $table->string('plate')->unique();
            $table->enum('type', array_column(VehicleType::cases(), 'value'));
            $table->unsignedInteger('capacity_kg');
            $table->enum('status', array_column(VehicleStatus::cases(), 'value'))
                ->default(VehicleStatus::Available->value);
            $table->foreignId('current_city_id')->constrained('cities');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicles');
    }
};
```

Things to check in every migration, especially AI-written ones:

- Foreign keys use `foreignId(...)->constrained()` so the database enforces them.
- Money is `decimal('price_lyd', 10, 2)`, never `float`.
- Columns that must be unique (`code`, `plate`, `reference`, `quote_id`) have `->unique()`.
- Migrations run in an order where referenced tables already exist.
- `down()` actually reverses `up()`.

Run them:

```bash
sail artisan migrate          # apply new migrations
sail artisan migrate:fresh --seed   # drop everything, rebuild, seed (local only!)
```

::: warning
`migrate:fresh` deletes all data. It is perfect on your laptop and a disaster in production. Read every command the agent proposes before approving it.
:::

### Enums: the shipment state machine

PHP 8.1+ has native enums. A *backed* enum maps each case to a string stored in the database.

```php
<?php

namespace App\Enums;

enum ShipmentStatus: string
{
    case Pending = 'pending';
    case Confirmed = 'confirmed';
    case Assigned = 'assigned';
    case PickedUp = 'picked_up';
    case InTransit = 'in_transit';
    case Delivered = 'delivered';
    case Cancelled = 'cancelled';

    public function canTransitionTo(self $next): bool
    {
        return in_array($next, match ($this) {
            self::Pending => [self::Confirmed, self::Cancelled],
            self::Confirmed => [self::Assigned, self::Cancelled],
            self::Assigned => [self::PickedUp, self::Cancelled],
            self::PickedUp => [self::InTransit],
            self::InTransit => [self::Delivered],
            self::Delivered, self::Cancelled => [],
        }, true);
    }
}
```

Why put the rules in the enum? Because then *every* path — the API, a dispatcher action, a queued job, and on Day 4 the AI agent's `cancel_shipment` tool — uses the same rule. One place to read, one place to test.

### Models, casts, and relationships

```php
<?php

namespace App\Models;

use App\Enums\ShipmentStatus;
use App\Enums\VehicleType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Shipment extends Model
{
    use HasFactory;

    protected $fillable = [
        'reference', 'user_id', 'quote_id', 'vehicle_id',
        'origin_city_id', 'destination_city_id',
        'weight_kg', 'vehicle_type', 'price_lyd', 'status', 'pickup_at',
    ];

    protected function casts(): array
    {
        return [
            'vehicle_type' => VehicleType::class,
            'status' => ShipmentStatus::class,
            'price_lyd' => 'decimal:2',
            'pickup_at' => 'datetime',
        ];
    }

    public function origin(): BelongsTo
    {
        return $this->belongsTo(City::class, 'origin_city_id');
    }

    public function destination(): BelongsTo
    {
        return $this->belongsTo(City::class, 'destination_city_id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(ShipmentEvent::class);
    }
}
```

The `casts()` method turns the database string `'in_transit'` into `ShipmentStatus::InTransit` when you read it, and back when you save. The `decimal:2` cast keeps money as a string like `"876.00"` instead of a float.

`$fillable` lists the columns allowed in mass assignment (`Shipment::create([...])`). You will learn on Day 2 why this matters for security.

### Factories and seeders

**Factories** create fake rows for tests:

```php
class VehicleFactory extends Factory
{
    public function definition(): array
    {
        return [
            'carrier_id' => Carrier::factory(),
            'plate' => fake()->unique()->numerify('5-#######'),
            'type' => fake()->randomElement(VehicleType::cases()),
            'capacity_kg' => fake()->randomElement([1500, 5000, 12000, 25000]),
            'status' => VehicleStatus::Available,
            'current_city_id' => City::factory(),
        ];
    }
}
```

**Seeders** fill the database with known starting data — our eight cities, distances, carriers, and vehicles:

```php
class CitySeeder extends Seeder
{
    public function run(): void
    {
        $cities = [
            ['code' => 'TIP', 'name_en' => 'Tripoli',  'name_ar' => 'طرابلس'],
            ['code' => 'BEN', 'name_en' => 'Benghazi', 'name_ar' => 'بنغازي'],
            ['code' => 'MRA', 'name_en' => 'Misrata',  'name_ar' => 'مصراتة'],
            // ... SEB, ZAW, TOB, SRT, GHA
        ];

        foreach ($cities as $city) {
            City::updateOrCreate(['code' => $city['code']], $city);
        }
    }
}
```

`updateOrCreate` makes the seeder safe to run twice. Distances should be seeded in both directions (TIP→BEN and BEN→TIP), or your pricing code must look up either order. Decide which in your plan.

### Your first test

Pest tests read almost like sentences:

```php
<?php

use App\Enums\ShipmentStatus;

it('allows cancelling a confirmed shipment', function () {
    expect(ShipmentStatus::Confirmed->canTransitionTo(ShipmentStatus::Cancelled))->toBeTrue();
});

it('does not allow cancelling after pickup', function () {
    expect(ShipmentStatus::PickedUp->canTransitionTo(ShipmentStatus::Cancelled))->toBeFalse();
});

it('does not allow skipping steps', function () {
    expect(ShipmentStatus::Pending->canTransitionTo(ShipmentStatus::Delivered))->toBeFalse();
});

it('treats delivered as final', function (ShipmentStatus $next) {
    expect(ShipmentStatus::Delivered->canTransitionTo($next))->toBeFalse();
})->with(ShipmentStatus::cases());
```

The last test uses a *dataset*: it runs once for every status. Run tests with:

```bash
sail artisan test
sail artisan test --filter=ShipmentStatus
```

### Reviewing a diff

After the agent edits files, review the changes the way a senior engineer would review a colleague's pull request:

```bash
git status            # which files changed?
git diff              # what changed in them?
git diff --stat       # how big is the change?
```

Ask yourself:

1. **Scope.** Did it change only what the plan asked for? New files you did not expect are a red flag.
2. **Correctness.** Do the column types, constraints, and enum values match the spec?
3. **Existence.** Does every method and class it uses actually exist? If unsure, search `vendor/` or ask Boost's `search-docs`.
4. **Tests.** Is there a test, and does it test the *behaviour* or just that code runs?
5. **Clarity.** Would you be able to explain this code to your team lead tomorrow?

Commit in small steps so a bad step is easy to undo:

```bash
git add -p                     # stage chunk by chunk, reading each one
git commit -m "Add ShipmentStatus enum with transition rules"
```

### When NOT to use the agent

The agent is not always the fastest path.

| Situation | Better choice |
|---|---|
| A one-line change you already know | Type it yourself |
| Learning a concept for the first time | Read the docs, write it by hand once, then use the agent |
| Secrets, credentials, production data | Keep them away from prompts |
| A decision that needs business context only you have | Decide first, then let the agent implement |
| You cannot judge if the output is right | Learn enough first, or pair with a human |

A useful test: *if the agent gave me a wrong answer here, would I notice?* If not, slow down.

## Building agents INTO the backend: a preview

Everything you learned this morning about Claude Code — model, context, tools, loop, permissions — is the blueprint for the Shahna Assistant. Compare:

| Claude Code (today) | Shahna Assistant (Day 4) |
|---|---|
| System prompt + `CLAUDE.md` | System prompt describing Shahna's rules |
| Tools: read, edit, bash, Boost | Tools: `get_quote`, `book_shipment`, `track_shipment`, `cancel_shipment`, `search_policies`, `escalate_to_human` |
| Asks permission before side effects | `book_shipment` requires `confirmed: true` after asking the customer |
| Loop until done | Loop with a maximum of 6 steps |
| Hallucinates without grounding | Grounded with `search_policies` over real policy documents |

The `ShipmentStatus::canTransitionTo()` rule you write today will protect the agent's `cancel_shipment` tool on Day 4. Good domain code is the best guardrail for AI features.

## How to work with your agent on this

Start every task by exploring, in plan mode, before any edits.

::: agent
Read CLAUDE.md and docs/requirements.md. Then use the database-schema tool to list the current tables. Summarize what exists and what the Shahna domain still needs. Do not edit any files.
:::

::: agent
Draft docs/plans/day1-domain.md for these models: City, CityDistance, Carrier, Vehicle, Quote, Shipment, ShipmentEvent. Use the field list in docs/requirements.md. For each table give columns, types, foreign keys, unique constraints, and indexes. Include an "Out of scope" section. Money must be decimal(10,2). Do not write any code yet.
:::

After you edit and approve the plan:

::: agent
Implement step 1 of docs/plans/day1-domain.md only: the ShipmentStatus enum in app/Enums with canTransitionTo(), and a Pest unit test covering every allowed and forbidden transition. Write the test first, run it to see it fail, then implement. Show me the test output.
:::

::: agent
Before using any Laravel method you are not sure exists in Laravel 12, check it with search-docs and tell me which doc page confirmed it.
:::

When you suspect a hallucination:

::: agent
Where exactly is the method you just used defined? Show me the file path in vendor/ and the method signature. If you cannot find it, say so.
:::

Good prompts have four parts: **context** (which files or plan), **task** (one step), **constraints** (what not to do), and **verification** (how to prove it works).

## Common pitfalls

- **The agent invents package APIs.** It writes a method that "should" exist. Defense: ask for the source location, use `search-docs`, run the code.
- **Over-scaffolding.** You ask for a model and get a model, controller, policy, request, resource, and five tests you did not want. Defense: an "Out of scope" section in the plan and the phrase "only this step" in prompts.
- **Skipping the migration review.** A missing `unique()` today becomes a double-booking bug on Day 3. Read every migration line by line.
- **Float money.** `$table->float('price_lyd')` looks harmless and creates rounding errors. Always `decimal(10, 2)`.
- **One giant commit.** If the agent's tenth change breaks something, you cannot easily go back. Commit after each green step.
- **Accepting commands blindly.** Approving a command you have not read is how databases get dropped.
- **Long, messy sessions.** After a big task, the context fills with old details. Use `/clear` when you switch tasks so the agent focuses on the new one.

## Key takeaways

- An LLM predicts the next token. An agent wraps that in a loop of think → act (tools) → observe.
- The model only knows what is in its context window. Ground it with your files, schema, and version-specific docs.
- `CLAUDE.md` and Boost make the agent know *your* project. Permissions keep you in control.
- Work in the loop: Explore → Plan → Implement → Verify. The plan file is reviewed before code exists.
- Laravel: routes → middleware → controller → service/model → response. Eloquent models, migrations, factories, seeders, artisan, and the service container are your daily tools.
- Put business rules in one place, like `ShipmentStatus::canTransitionTo()`, so every caller — human or AI — follows them.
- You own every line you commit.

## Self-check questions

1. What is a context window, and what happens to information that is not in it?
2. Give two causes of hallucination and one practical defense for each.
3. Describe the agent loop in three steps.
4. What is the difference between Claude Code's built-in tools and tools provided through MCP? Give an example of each.
5. Why does the course put the transition rules inside the `ShipmentStatus` enum instead of in a controller?
6. What should you check in every AI-written migration? Name four things.
7. What does `protected function casts()` do for the `status` column?
8. Name two situations where you should not use the agent.
9. What is the purpose of the "Out of scope" section in a plan file?
10. Why is `migrate:fresh --seed` fine on your laptop but dangerous elsewhere?

### Answers

1. The context window is everything the model can see in one request: system instructions, conversation, file contents, tool results. Information not in it is unknown to the model, except for whatever it learned in training, which may be outdated or wrong for your project.
2. Missing context (defense: let it read the schema or files via tools); outdated training data (defense: version-specific docs through Boost `search-docs`); pattern completion inventing APIs (defense: ask for the source location in `vendor/`); no feedback (defense: require running tests and showing output). Any two are fine.
3. Think about the next step, act by calling a tool, observe the result; repeat until the goal is met.
4. Built-in tools ship with Claude Code, such as reading or editing files and running shell commands. MCP tools come from external servers using the Model Context Protocol, such as Boost's `database-schema` or `search-docs`.
5. So every code path — API, dispatcher, queued job, and the AI agent's tools — uses the same rule, and it is tested in one place.
6. Foreign keys are constrained; money is decimal not float; unique columns have unique constraints; tables are created in dependency order; `down()` reverses `up()`; useful indexes exist.
7. It converts the stored string (for example `'in_transit'`) into the `ShipmentStatus` enum case when reading, and back to the string when saving.
8. Examples: one-line changes you already know; learning a concept for the first time; anything involving secrets or production data; decisions that need business context only you have; when you cannot judge whether the output is correct.
9. It sets limits so the agent does not generate extra code (controllers, routes, packages) that nobody asked for and nobody reviewed.
10. It drops every table and recreates them. Locally the data is disposable test data; on a shared or production database it destroys real data.
