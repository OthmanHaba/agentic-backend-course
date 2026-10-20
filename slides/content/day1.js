// Day 1 — Working With AI Agents. Slide types are defined in ../build.js.
module.exports = {
  title: "Working With AI Agents",
  ar: "العمل مع الوكلاء الذكيين",
  coverNotes: "Welcome everyone. This week we build Shahna, a Libyan freight booking API, in Laravel, and we build it with an AI coding agent as our pair. Two pillars every day: building WITH agents, and building agents INTO the backend. Today is pillar one: how coding agents work and how to drive one safely.",
  objectives: [
    "Explain how an LLM coding agent works: **context window**, **tools**, **loop**",
    "Set up **Claude Code** + **Laravel Boost** and write a useful `CLAUDE.md`",
    "Use the **Explore → Plan → Implement → Verify** loop on real work",
    "Navigate Laravel: routing, MVC, Eloquent, migrations, artisan, container",
    "Model a domain with migrations, factories, seeders and enums",
    "Read and critique AI-generated code before you accept it",
  ],
  body: [
    // ---------------- Session A ----------------
    {
      type: "divider", num: "01", kicker: "Session A · 09:30–10:45", section: "Session A",
      title: "How coding agents **work**", ar: "كيف تعمل وكلاء البرمجة",
      topics: ["LLMs & tokens", "Context windows", "Hallucination", "The agent loop", "Claude Code", "Laravel Boost", "Request lifecycle"],
      notes: "Session A is about mental models. By 10:45 everyone should be able to explain what happens between typing a prompt into Claude Code and seeing a file change on disk, and how a Laravel request flows.",
    },
    {
      type: "bullets", title: "What an LLM actually does", ar: "ماذا يفعل النموذج اللغوي فعلاً",
      bullets: [
        "Predicts the **next token**, one at a time, from everything in its context",
        "Trained on huge amounts of text and code, so it is good at **patterns**",
        "Has **no memory** between calls: the context window is all it knows",
        "Has **no access** to your machine unless it is given tools",
        "Is **probabilistic**: the same prompt can give different answers",
      ],
      side: { kicker: "Key idea", big: "Autocomplete, at scale", bigSize: 34, text: "Fluent is not the same as correct. The model writes what is **likely**, so your job is to check what is **true**." },
      notes: "Demystify the model. It is a next-token predictor, a very good one. Everything it 'knows' about your project comes from what is in the context window right now. Ask: if it has no memory, how does Claude Code remember our conventions? Answer: we put them in CLAUDE.md, which is loaded into context every session.",
    },
    {
      type: "stats", title: "Tokens, context and cost", ar: "الرموز والسياق والتكلفة",
      stats: [
        { n: "≈ 4", l: "characters per English token. Arabic text usually needs **more** tokens for the same meaning." },
        { n: "1 window", size: 44, l: "System prompt, your message, files read, tool output and the answer all share **one** context window." },
        { n: "In + Out", size: 44, l: "You pay for input **and** output tokens on every turn. Big files read again and again add up." },
      ],
      caption: "Rule of thumb: keep the context focused. Less noise in → better code out.",
      notes: "Give concrete intuition. A 300-line PHP file is a few thousand tokens. When the agent reads ten files plus test output, the window fills quickly, and older details can get pushed out or summarized. That is why focused prompts and small tasks work better. Mention cost now; on Day 5 we will log real token counts per LLM call.",
    },
    {
      type: "bullets", title: "Why agents hallucinate", ar: "لماذا تهلوس الوكلاء",
      bullets: [
        "The answer is **plausible**, not looked up: it fills gaps with likely text",
        "Package APIs change: it may remember **an older version** of Laravel or Prism",
        "Missing context: it **guesses** your table names, routes and config",
        "It is eager to finish: it may say tests pass **without running them**",
        "Fix: give it ground truth (files, docs, Boost) and make it **verify**",
      ],
      side: { kicker: "House rule", big: "Verify everything", bigSize: 36, text: "Run the tests. Read the diff. Open the docs. Trust evidence, not confidence." },
      notes: "Hallucination is not lying, it is pattern completion without ground truth. Typical Laravel examples: a method that does not exist on the query builder, an outdated config key, a Pest helper from a plugin we do not have. The cure is grounding: let it read the actual code, use Boost's version-matched docs search, and always ask for proof such as test output.",
    },
    {
      type: "cycle", title: "The agent loop", ar: "حلقة عمل الوكيل",
      center: "LLM + tools",
      steps: [
        { h: "Think", d: "decide next step" },
        { h: "Act", d: "call a tool" },
        { h: "Observe", d: "read the result" },
        { h: "Repeat or stop", d: "goal met?" },
      ],
      bullets: [
        "A **chatbot** answers once. An **agent** loops: think, act, observe",
        "Tools are how it touches the world: read file, edit, run `php artisan test`",
        "Each tool result goes **back into the context** for the next step",
        "It stops when the goal is met, it needs you, or it hits a limit",
      ],
      notes: "This is the single most important diagram of the week. We will see it again on Day 4, when we build our own agent loop inside Laravel with Prism. Walk the loop with an example: 'add a cities migration'. Think: I need to see existing migrations. Act: list files. Observe: folder contents. Think: write the file. Act: edit. Observe: success. Think: run migrate. And so on.",
    },
    {
      type: "cards", title: "Anatomy of Claude Code", ar: "مكونات Claude Code",
      cards: [
        { h: "Tools", d: "Read, Edit, Write, Bash, Grep/Glob search, web fetch. Every action on your machine is a **tool call** you can see." },
        { h: "Permissions", d: "You approve edits and commands, or allow-list safe ones. Never auto-approve `rm`, `git push` or production access." },
        { h: "CLAUDE.md", d: "Project memory loaded every session: stack, conventions, commands, do and do-not rules." },
        { h: "MCP servers", d: "Plug-in tool servers. **Laravel Boost** gives the agent your routes, schema, logs and version-matched docs." },
      ],
      notes: "Show these live in the terminal after the slide. Point at a tool call in the transcript and the permission prompt. Stress permissions: you are responsible for every command the agent runs on your machine. Plan mode (shift+tab) is a great default for exploration because it cannot edit files.",
    },
    {
      type: "code", title: "CLAUDE.md: the project's memory", ar: "ملف CLAUDE.md ذاكرة المشروع", file: "shahna-api/CLAUDE.md", lang: "md",
      code: `# Shahna API — conventions for coding agents

## Commands
| Run all tests | \`./vendor/bin/sail artisan test\` |
| Migrate + seed | \`./vendor/bin/sail artisan migrate:fresh --seed\` |

## Testing rules
- Every change ships with a Pest test. Write the failing test first.
- \`php artisan test\` must pass before you say a task is done. Show the output.
- Never call a real LLM in tests. Use \`Prism::fake([...])\`.

## Code style
- Money is \`decimal(10,2)\` in the database. Never use floats for stored money.
- Use enums (\`app/Enums\`) for fixed sets of values; never compare raw strings.
- No new Composer packages without asking first.

## How to work in this repo
Explore → Plan (\`docs/plans/\`) → Implement in small steps → Verify.`,
      points: [
        "Short and specific beats long and vague",
        "Put **commands** in it so the agent can verify itself",
        "Encode the rules you keep repeating in review",
        "Commit it: the whole team shares the same agent behaviour",
      ],
      notes: "This is an excerpt of the CLAUDE.md shipped in the day1-start tag; open the full file in the repo. Read two rules aloud and ask why they matter: money as decimals avoids rounding bugs; enums avoid typos in status strings. Every time you correct the agent twice for the same thing, add a line here.",
    },
    {
      type: "diagram", title: "Laravel Boost: ground truth for the agent", ar: "لارافيل بوست: حقائق المشروع للوكيل",
      nodes: [
        { id: "you", x: 0, y: 1.55, w: 2.0, h: 1.0, label: "You", sub: "prompt + review", style: "card" },
        { id: "cc", x: 3.0, y: 1.55, w: 2.4, h: 1.0, label: "Claude Code", sub: "agent loop", style: "orange" },
        { id: "boost", x: 6.4, y: 1.55, w: 2.4, h: 1.0, label: "Boost MCP", sub: "php artisan boost:mcp", style: "dark" },
        { id: "docs", x: 9.7, y: 0.05, w: 2.43, h: 0.82, label: "Docs search", sub: "version-matched", style: "light", fontSize: 14 },
        { id: "schema", x: 9.7, y: 1.05, w: 2.43, h: 0.82, label: "Database schema", sub: "tables, columns", style: "light", fontSize: 14 },
        { id: "routes", x: 9.7, y: 2.05, w: 2.43, h: 0.82, label: "Routes & config", sub: "artisan route:list", style: "light", fontSize: 14 },
        { id: "logs", x: 9.7, y: 3.05, w: 2.43, h: 0.82, label: "Logs & errors", sub: "last exception", style: "light", fontSize: 14 },
      ],
      edges: [
        { from: "you", to: "cc" },
        { from: "cc", to: "boost", label: "MCP tool call" },
        { from: "boost", to: "docs" }, { from: "boost", to: "schema" }, { from: "boost", to: "routes" }, { from: "boost", to: "logs" },
      ],
      caption: "Fewer guesses: the agent asks the app instead of inventing table names or outdated APIs.",
      notes: "MCP, the Model Context Protocol, is a standard way to plug tool servers into an agent. Boost is Laravel's MCP server: it exposes the real schema, routes, config, logs and a docs search that matches the exact package versions in composer.lock. Setup: run `sail artisan boost:install` and choose Claude Code; it registers the MCP server (`php artisan boost:mcp`, named laravel-boost). Check it with /mcp inside Claude Code. Demo: ask 'what columns does the users table have?' and watch it call Boost instead of guessing.",
    },
    {
      type: "prompt", title: "Ask your agent: explore first", mode: "plan mode",
      prompt: `Explore this Laravel project. Do not write any code yet.

1. Summarize the stack from composer.json and CLAUDE.md.
2. List the routes, migrations and models that exist today.
3. Read **docs/requirements.md** and list the domain entities it implies.
4. Tell me what is missing before we can book a shipment.

Answer in short bullet points and cite the files you read.`,
      why: [
        "**Plan mode**: it can read but not edit",
        "Numbered steps keep the loop focused",
        "\"Cite the files\" makes claims checkable",
        "Ends with a question you can verify against the brief",
      ],
      notes: "Run this exact prompt live on the day1-start tag. While it works, narrate the tool calls: Glob, Read, the Boost calls. Then check one claim together, for example open docs/requirements.md and confirm the entities. Students will run the same prompt at the start of Lab 1.",
    },
    {
      type: "cards", title: "Laravel in six building blocks", ar: "لارافيل في ست لبنات", cols: 3,
      cards: [
        { h: "Routing", d: "`routes/api.php` maps a method + URL to a controller action." },
        { h: "Controllers", d: "Thin classes that take a request and return a response." },
        { h: "Eloquent", d: "Models map tables to PHP objects, with relations and casts." },
        { h: "Migrations", d: "Versioned schema changes in PHP. The DB is code, reviewed like code." },
        { h: "Artisan", d: "The CLI: `make:model`, `migrate`, `test`, `tinker`, `route:list`." },
        { h: "Container", d: "Builds your classes and injects dependencies, e.g. a `PricingService`." },
      ],
      notes: "Many students have not used PHP or Laravel before. That is fine: these six ideas exist in every backend framework under different names. Map them to Express, Django or Spring if someone knows those. The service container is the least obvious; show a constructor that type-hints PricingService and Laravel provides it automatically.",
    },
    {
      type: "flow", title: "The request lifecycle", ar: "دورة حياة الطلب",
      steps: [
        { h: "HTTP request", d: "GET /api/cities" },
        { h: "public/index.php", d: "boots the app" },
        { h: "Middleware", d: "auth, throttle, JSON" },
        { h: "Router", d: "matches the route" },
        { h: "Controller", d: "calls models & services" },
        { h: "JSON response", d: "Resource → 200 OK" },
      ],
      highlight: 4,
      bullets: [
        "Middleware runs **before and after** the controller: the place for auth, rate limits, request IDs",
        "Keep controllers thin: business rules live in **services**, **enums** and **policies**",
      ],
      notes: "Trace one request end to end. Every request boots the framework, passes through the middleware stack, hits the router, runs a controller, and returns a response that goes back out through middleware. We will add middleware on Day 3 for idempotency keys and rate limits, so remember where it sits.",
    },
    {
      type: "code", title: "Your first route, end to end", ar: "أول مسار من البداية إلى النهاية", file: "routes/api.php · app/Http/Controllers/Api/CityController.php",
      code: `// routes/api.php
use App\\Http\\Controllers\\Api\\CityController;

Route::get('/cities', [CityController::class, 'index']);

// app/Http/Controllers/Api/CityController.php
class CityController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return CityResource::collection(City::orderBy('name_en')->get());
    }
}`,
      hl: [4],
      points: [
        "One line of routing, one controller method",
        "An **API Resource** decides which fields go out as JSON",
        "Preview of Day 2: this exact endpoint ships at `day2-end`",
        "Check it with `artisan route:list`",
      ],
      notes: "A preview so the lifecycle is concrete. Run artisan route:list to show the route registered. Do not build the full endpoint today: the cities endpoint is part of Day 2. Today we only need the City model and seeder that this code depends on.",
    },
    {
      type: "lab", part: 1, name: "Scaffold Shahna", ar: "المختبر الأول: تجهيز مشروع شحنة", time: "11:00–12:30", tag: "day1-end",
      goal: "Get the project running, explore it with Claude Code, and agree a domain plan **before** generating any code.",
      steps: [
        "`git checkout day1-start` then `./vendor/bin/sail up -d`",
        "Run `sail artisan test`: 2 tests, green baseline",
        "Start `claude` in plan mode and run the explore prompt",
        "Ask the agent to draft `docs/plans/day1-domain.md`",
        "Review the plan with your pair: fields, types, keys, enums",
        "Commit the plan. No models or migrations yet",
      ],
      done: "the plan lists every table (plus `role` on users) with column types, foreign keys and the `ShipmentStatus` transitions, and your pair has signed off.",
      notes: "Lab part 1 is deliberately about planning, not code. Walk the room and look at plans: are prices decimal(10,2)? Is quote_id unique on shipments? Are city codes listed? If a team finishes early, have them ask the agent to critique its own plan against docs/requirements.md.",
    },

    // ---------------- Session B ----------------
    {
      type: "divider", num: "02", kicker: "Session B · 13:30–14:15", section: "Session B",
      title: "Spec first, **then** code", ar: "المواصفات أولاً ثم الكود",
      topics: ["Explore → Plan → Implement → Verify", "Plan files", "Eloquent models", "Migrations & enums", "Reviewing a diff", "When not to use the agent"],
      notes: "Session B turns the plan into a schema. The theme: the agent is fastest when the thinking is already done. You own the design, it does the typing, and you review every line.",
    },
    {
      type: "flow", title: "Explore → Plan → Implement → Verify", ar: "استكشف ثم خطط ثم نفذ ثم تحقق",
      steps: [
        { h: "Explore", d: "read code, docs, brief" },
        { h: "Plan", d: "write docs/plans/*.md" },
        { h: "Implement", d: "small slice, one concern" },
        { h: "Verify", d: "tests, diff, run it" },
      ],
      highlight: 1, loop: "next slice: repeat the loop",
      bullets: ["Most bad AI code comes from **skipping Plan**. A plan is cheap to fix; a 20-file diff is not"],
      notes: "This is the workflow we use all week. Explore and Plan happen in plan mode. Implement happens in small slices: one migration, or one model with its factory. Verify means running tests and reading the diff yourself, not asking the agent whether it worked.",
    },
    {
      type: "code", title: "A plan file the agent can follow", ar: "ملف خطة يمكن للوكيل اتباعه", file: "docs/plans/day1-domain.md", lang: "md",
      code: `# Plan: Day 1 — Shahna domain model
## Goal
Database schema, Eloquent models, enums, factories and seed
data for the booking domain. No HTTP endpoints yet.

## Enums: UserRole, VehicleType, VehicleStatus, ShipmentStatus
## Tables
- cities: name_en, name_ar, code char(3) unique
- city_distances: from, to, km · unique (from, to)
- shipments: reference unique, QUOTE_ID UNIQUE, price decimal(10,2)

## Decisions
- Money is decimal(10,2), cast decimal:2, never float.
- role is NOT mass assignable: register cannot make itself admin.

## Out of scope today
Endpoints, pricing, authentication (Day 2).`,
      points: [
        "A **goal**, the **data**, the **decisions**, the **scope**",
        "Every table and decision is reviewable in minutes",
        "**Out of scope** stops over-scaffolding",
        "You edit the plan, then say: implement the enums only",
      ],
      notes: "This is an excerpt of the real docs/plans/day1-domain.md in the repo. Point out the decisions section: each line prevents a real bug. Then the 'out of scope' section: without it, agents love to also create controllers, policies and a frontend. The plan is a contract you can review in two minutes. When you implement, reference it: 'implement the enums from docs/plans/day1-domain.md, then stop'.",
    },
    {
      type: "diagram", title: "The Shahna domain", ar: "نموذج بيانات شحنة",
      nodes: [
        { id: "user", x: 0, y: 0.25, w: 2.2, h: 1.0, label: "User", sub: "role: customer|dispatcher|admin", style: "card", subSize: 10 },
        { id: "quote", x: 3.3, y: 0.25, w: 2.2, h: 1.0, label: "Quote", sub: "price_lyd · expires 15 min", style: "light", subSize: 11 },
        { id: "ship", x: 6.6, y: 0.25, w: 2.2, h: 1.0, label: "Shipment", sub: "SHN-XXXXXX · status", style: "orange", subSize: 11 },
        { id: "event", x: 9.93, y: 0.25, w: 2.2, h: 1.0, label: "ShipmentEvent", sub: "status · note · time", style: "light", subSize: 11 },
        { id: "city", x: 0, y: 2.75, w: 2.2, h: 1.0, label: "City", sub: "TIP BEN MRA SEB …", style: "light", subSize: 11 },
        { id: "dist", x: 3.3, y: 2.75, w: 2.2, h: 1.0, label: "CityDistance", sub: "from · to · km", style: "light", subSize: 11 },
        { id: "veh", x: 6.6, y: 2.75, w: 2.2, h: 1.0, label: "Vehicle", sub: "type · capacity · status", style: "dark", subSize: 11 },
        { id: "car", x: 9.93, y: 2.75, w: 2.2, h: 1.0, label: "Carrier", sub: "name · phone", style: "light", subSize: 11 },
      ],
      edges: [
        { from: "user", to: "quote", label: "has many" },
        { from: "quote", to: "ship", label: "1 : 1" },
        { from: "ship", to: "event", label: "has many" },
        { from: "city", to: "dist", label: "from / to" },
        { from: "ship", to: "veh", label: "assigned (nullable)" },
        { from: "car", to: "veh", label: "has many" },
      ],
      caption: "A quote can become **at most one** shipment: `shipments.quote_id` is UNIQUE in the database, not just in code.",
      notes: "Walk the model from the customer's point of view: a user asks for a quote, a quote becomes at most one shipment, the shipment gets events as it moves, and a vehicle from a carrier is assigned. Cities and distances feed pricing. Highlight the unique quote_id: it is our first defence against double booking, which comes back on Day 3.",
    },
    {
      type: "code", title: "Migrations: the schema is code", ar: "الترحيلات: المخطط شيفرة", file: "database/migrations/2026_01_05_000005_create_shipments_table.php",
      code: `Schema::create('shipments', function (Blueprint $table) {
    $table->id();
    $table->string('reference', 10)->unique();           // SHN-7K2Q9X
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->foreignId('quote_id')->unique()->constrained();
    $table->foreignId('vehicle_id')->nullable()->constrained();
    $table->foreignId('origin_city_id')->constrained('cities');
    $table->foreignId('destination_city_id')->constrained('cities');
    $table->unsignedInteger('weight_kg');
    $table->enum('vehicle_type', array_column(VehicleType::cases(), 'value'));
    $table->decimal('price_lyd', 10, 2);
    $table->enum('status', array_column(ShipmentStatus::cases(), 'value'))
        ->default(ShipmentStatus::Pending->value);
    $table->timestamp('pickup_at');
    $table->timestamps();

    $table->index(['user_id', 'created_at']);   // my shipments, newest
});`,
      hl: [5, 11], fontSize: 11,
      points: [
        "Review every migration the agent writes",
        "**Foreign keys** and **unique** constraints live in the DB",
        "Money: `decimal(10,2)`, never float",
        "Enum columns come from the PHP enums; index how you query: `(user_id, created_at)`",
      ],
      notes: "This is the line-by-line review we want students to do. Ask the room: what happens if two requests book the same quote? The unique constraint rejects the second insert. What if price were a float? 0.1 + 0.2 problems in invoices. A migration that is wrong in production is expensive to fix, so this is where you slow down.",
    },
    {
      type: "code", title: "Enums keep the rules in one place", ar: "التعدادات تجمع القواعد في مكان واحد", file: "app/Enums/ShipmentStatus.php",
      code: `enum ShipmentStatus: string
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
}`,
      hl: [11], fontSize: 10.5,
      points: [
        "Backed enum: stored as a string, typed in PHP",
        "Cast it on the model: `'status' => ShipmentStatus::class`",
        "Cancel only from pending, confirmed or assigned",
        "Delivered and cancelled are **final**; the `match` has no default, so a new case must be handled",
      ],
      notes: "The state machine from the spec, in about twenty lines. Ask students to find the cancellation rule. This method will be used by the cancel endpoint on Day 2 and by the agent's cancel tool on Day 4, so getting it right and tested today pays off all week.",
    },
    {
      type: "code", title: "Prove it with a Pest test", ar: "أثبت ذلك باختبار Pest", file: "tests/Unit/ShipmentStatusTest.php",
      code: `use App\\Enums\\ShipmentStatus;

it('allows cancelling before pickup', function (ShipmentStatus $from) {
    expect($from->canTransitionTo(ShipmentStatus::Cancelled))->toBeTrue();
})->with([ShipmentStatus::Pending, ShipmentStatus::Confirmed, ShipmentStatus::Assigned]);

it('forbids cancelling after pickup', function (ShipmentStatus $from) {
    expect($from->canTransitionTo(ShipmentStatus::Cancelled))->toBeFalse();
})->with([ShipmentStatus::PickedUp, ShipmentStatus::InTransit,
          ShipmentStatus::Delivered, ShipmentStatus::Cancelled]);

it('forbids skipping steps or going backwards', function ($from, $to) {
    expect($from->canTransitionTo($to))->toBeFalse();
})->with([
    [ShipmentStatus::Pending, ShipmentStatus::Assigned],
    [ShipmentStatus::Delivered, ShipmentStatus::Pending],
]);`,
      fontSize: 10.5,
      points: [
        "Tests are the **verify** step you can rerun forever",
        "Datasets (`->with()`) cover every case cheaply",
        "Ask the agent for the test **first**, then read it",
        "`sail artisan test --filter=ShipmentStatus`",
      ],
      notes: "This is from the real tests/Unit/ShipmentStatusTest.php (the file also has a happy-path test). Pest reads almost like English. Each ->with() dataset turns one test into several cases. Then break the enum on purpose, for example allow Delivered to Cancelled, run the test, and watch it fail. That red-to-green moment is the habit we want before tomorrow's TDD session.",
    },
    {
      type: "prompt", title: "Ask your agent: implement one step", mode: "auto-accept edits off",
      prompt: `Implement only the enums from **docs/plans/day1-domain.md**.

- Create the ShipmentStatus enum exactly as the plan describes.
- Write tests/Unit/ShipmentStatusTest.php first, using Pest datasets.
- Run \`sail artisan test --filter=ShipmentStatus\` and paste the output.
- Stop after the enums. Do not create models or migrations yet.`,
      why: [
        "Points at the plan: no re-explaining",
        "**One slice**, then stop",
        "Test first, then implementation",
        "Demands real test output as proof",
      ],
      notes: "The implement prompt pattern for the whole week: reference the plan, one step, tests, proof, stop. Keep auto-accept off for today so students see and approve each edit. If the agent says 'tests pass' without output, send it back.",
    },
    {
      type: "compare", title: "Reviewing an AI diff", ar: "مراجعة تعديلات الذكاء الاصطناعي",
      left: { h: "Skim and accept", items: ["\"Looks right\" after reading the summary", "Trust \"all tests pass\"", "Accept new packages and files you did not ask for", "Merge a 900-line diff in one go"] },
      right: { h: "Review like an engineer", items: ["Read `git diff` file by file", "Run the tests **yourself**", "Question every new dependency and file", "Check names against the plan and `docs/requirements.md`", "Small commits you can revert"] },
      notes: "Do a live review of a deliberately flawed diff: a migration missing the unique on quote_id, and a float price. Let students find the issues. The right column is the checklist they apply in the afternoon lab, and it grows into the AI code review checklist on Day 2.",
    },
    {
      type: "cards", title: "When NOT to use the agent", ar: "متى لا تستخدم الوكيل", cols: 2,
      cards: [
        { h: "You cannot judge the output", d: "If you could not review it, you cannot own it. Learn the concept first, then delegate." },
        { h: "Secrets and production", d: "Never paste API keys, customer data or production credentials into a prompt." },
        { h: "A one-line change", d: "Faster to type than to explain. Use the agent for leverage, not for everything." },
        { h: "Decisions that need people", d: "Pricing rules, legal policy, security trade-offs: the agent can inform, not decide." },
      ],
      notes: "Balance the excitement. The agent multiplies what you already understand. For interns especially: if you cannot explain the code it wrote, ask it to explain, read the docs, then decide. Never put real secrets in prompts; use .env and keep it out of git.",
    },
    {
      type: "pitfalls",
      items: [
        { p: "Agent invents a package API that does not exist", fix: "Ground it: Boost docs search, read `vendor/` source, run the code" },
        { p: "Over-scaffolding: controllers, policies and UI you never asked for", fix: "Plan with an **out of scope** list; one step per prompt" },
        { p: "Skipping the migration review", fix: "Read every column, key and index before `migrate`; check money and uniques" },
      ],
      notes: "These are the three pitfalls we see most on Day 1. All three are fixed by the same habit: smaller steps and real verification. Ask students to note one example of each they hit during the afternoon lab; we review them in tomorrow's standup.",
    },
    {
      type: "statement",
      text: "The agent is a fast pair.\n**You** are the engineer.",
      ar: "الوكيل شريك سريع، وأنت المهندس المسؤول",
      sub: "Everything you merge, you own.",
      notes: "Pause on this before the lab. Accountability does not move to the tool. In the capstone rubric on Day 5, 'explains AI usage honestly' is a scored criterion.",
    },
    {
      type: "lab", part: 2, name: "Scaffold Shahna", ar: "المختبر الأول: توليد النماذج والبيانات", time: "14:15–15:45", tag: "day1-end",
      goal: "Turn the approved plan into enums, migrations, models, factories and a seeder, one reviewed step at a time.",
      steps: [
        "Enums first: `ShipmentStatus` + Pest test (red, then green)",
        "Migrations + models + factories for all 7 tables",
        "Review each migration diff before `sail artisan migrate`",
        "Seeder: 8 cities (TIP, BEN, MRA, SEB, ZAW, TOB, SRT, GHA), distances, 4 carriers, 64 vehicles, 3 demo users",
        "`sail artisan migrate:fresh --seed` and `sail artisan test`",
        "Commit, then compare with `git diff day1-end`",
      ],
      done: "tests are green (23 at `day1-end`), the seeder loads 8 cities with 56 distance rows, and your schema matches the tag.",
      notes: "Teams that fall behind can check out day1-end at 15:40 so everyone starts tomorrow from the same place. Spot-check: city codes, unique pair on city_distances, decimal prices, the enum cast on Shipment. Collect pitfall examples for tomorrow's standup.",
    },
  ],
  recap: {
    points: [
      "An LLM predicts tokens; an **agent** loops through tools until done",
      "Context is everything: `CLAUDE.md`, Boost and focused prompts",
      "**Explore → Plan → Implement → Verify**, in small slices",
      "Laravel: routes → middleware → controller → Eloquent → JSON",
      "The schema is code: review keys, uniques and money types",
      "If you cannot review it, you cannot merge it",
    ],
    question: "The agent says \"all tests pass\". What do you do first?",
    options: ["Merge the branch", "Run `sail artisan test` yourself", "Ask the agent if it is sure", "Delete the tests"],
    notes: "Recap in two minutes, then hand out the exit ticket. The teaser answer is B: run the tests yourself. Asking the agent again is not verification.",
  },
  next: "**Tomorrow, Day 2:** APIs and data, done right. Quotes, bookings, auth and test-first with the agent. Start from `day1-end`.",
  closingNotes: "Thank everyone. Make sure every team has pushed and can check out day1-end. Tomorrow starts with a short quiz on today's material.",
};
