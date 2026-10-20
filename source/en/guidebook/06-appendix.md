# Appendix — Reference

Keep this appendix open during labs. It collects the vocabulary, commands, checklists, and resources from the whole week.

## A. Glossary

| Term (EN) | Arabic | Meaning |
|---|---|---|
| Agent | وكيل ذكي | A program that uses an LLM in a loop, calling tools to reach a goal |
| Agent loop | حلقة الوكيل | Think, call a tool, observe the result, repeat until done |
| API Resource | مورد واجهة البرمجة | Laravel class that shapes a model into JSON output |
| Artisan | أداة Artisan | Laravel's command-line tool |
| Authentication | المصادقة | Proving who you are (Sanctum token) |
| Authorization | التفويض / الصلاحيات | Deciding if you are allowed to do something (Policies) |
| Cache | ذاكرة التخزين المؤقت | Stored results reused to avoid repeated work |
| Cache invalidation | إبطال الذاكرة المؤقتة | Removing or refreshing cached data when the source changes |
| CLAUDE.md | ملف CLAUDE.md | Project instructions loaded into Claude Code's context |
| Context window | نافذة السياق | Everything the model can see in one request |
| Eager loading | التحميل المسبق | Loading related models in advance to avoid N+1 queries |
| Eloquent | Eloquent | Laravel's ORM |
| Embedding | التضمين المتجهي | A list of numbers representing the meaning of text |
| Enum | تعداد | A type with a fixed set of named values |
| Eval | تقييم | A test of real model behaviour against a golden dataset |
| Event / Listener | حدث / مستمع | An announcement that something happened, and the code that reacts |
| Factory | مصنع بيانات | Generates fake model data for tests |
| Feature test | اختبار ميزة | A test that sends HTTP requests into the app |
| Foreign key | مفتاح أجنبي | A column that must reference a row in another table |
| FormRequest | طلب نموذج | Laravel class for validating request input |
| Full-text search | البحث في النص الكامل | Searching documents by words, with ranking |
| Guardrail | ضابط حماية | A check that limits what an AI feature can do |
| Hallucination | الهلوسة | Confident model output that is false |
| Horizon | Horizon | Laravel's Redis queue dashboard and worker manager |
| Human in the loop | الإنسان ضمن الحلقة | A human must approve before an action happens |
| Idempotency | عدم التأثر بالتكرار | Repeating a request has the same effect as doing it once |
| Index | فهرس | A database structure that speeds up lookups |
| Job | مهمة | A unit of work run by a background worker |
| LLM | نموذج لغوي كبير | Large language model |
| Load test | اختبار الحمل | Measuring behaviour under many simultaneous requests |
| Mass assignment | الإسناد الجماعي | Filling many model fields from an array at once |
| MCP | بروتوكول سياق النموذج | Model Context Protocol: a standard for giving agents extra tools |
| Middleware | البرمجية الوسيطة | Code that runs before or after every request in a group |
| Migration | ترحيل قاعدة البيانات | Version-controlled database schema change |
| Model routing | توجيه النماذج | Sending each task to the cheapest model that can do it |
| N+1 query | مشكلة الاستعلامات N+1 | One query plus one extra query per row |
| ORM | ربط الكائنات بالعلاقات | Maps database rows to objects |
| p95 latency | زمن الاستجابة p95 | 95% of requests are faster than this value |
| Pagination | ترقيم الصفحات | Returning results in pages |
| Policy | سياسة التفويض | Laravel class holding authorization rules for a model |
| Prompt | موجّه / تعليمة | The input text given to a model |
| Prompt injection | حقن التعليمات | Input that tries to override the model's instructions |
| Queue | طابور المهام | A list of jobs waiting to be processed in the background |
| RAG | التوليد المعزز بالاسترجاع | Retrieval-augmented generation: search your data, then answer from it |
| Race condition | حالة السباق | A bug that depends on the timing of concurrent operations |
| Rate limiting | تحديد معدل الطلبات | Limiting how many requests a client can make per time window |
| Row lock | قفل الصف | Prevents other transactions from changing a row until commit |
| Sanctum | Sanctum | Laravel package for API token authentication |
| Seeder | مُعبّئ البيانات | Fills the database with starting data |
| Service container | حاوية الخدمات | Laravel's dependency injection system |
| Structured output | المخرجات المهيكلة | Model output that follows a JSON schema |
| System prompt | تعليمات النظام | Standing instructions that define the model's role and rules |
| TDD | التطوير الموجّه بالاختبارات | Test-driven development: red, green, refactor |
| Temperature | درجة العشوائية | Controls randomness of model output |
| Token | رمز (توكن) | A small chunk of text the model reads and writes |
| Tool calling | استدعاء الأدوات | The model asks your code to run a function |
| Transaction | معاملة | A group of database changes that succeed or fail together |
| Unique constraint | قيد التفرد | The database rejects duplicate values in a column |

## B. Laravel and artisan cheat sheet

All commands run through Sail in this course: replace `php artisan` with `sail artisan`.

### Sail

```bash
./vendor/bin/sail up -d          # start containers in the background
./vendor/bin/sail down           # stop containers
sail shell                       # shell inside the app container
sail psql                        # PostgreSQL client
sail redis                       # Redis CLI
sail composer require vendor/pkg # add a package (ask first!)
```

### Make commands

```bash
sail artisan make:model Shipment -mf        # model + migration + factory
sail artisan make:migration add_index_to_shipments
sail artisan make:controller ShipmentController --api
sail artisan make:request StoreQuoteRequest
sail artisan make:resource ShipmentResource
sail artisan make:policy ShipmentPolicy --model=Shipment
sail artisan make:enum Enums/ShipmentStatus
sail artisan make:event ShipmentBooked
sail artisan make:listener QueueBookingJobs --event=ShipmentBooked
sail artisan make:job AssignVehicleJob
sail artisan make:middleware EnsureIdempotency
sail artisan make:seeder CitySeeder
sail artisan make:command AgentEvalCommand
sail artisan make:test ShipmentTest --pest
sail artisan make:test PricingServiceTest --pest --unit
```

### Database

```bash
sail artisan migrate                 # run new migrations
sail artisan migrate:status          # which migrations ran
sail artisan migrate:rollback        # undo the last batch
sail artisan migrate:fresh --seed    # drop all, migrate, seed (LOCAL ONLY)
sail artisan db:seed --class=CitySeeder
sail artisan tinker                  # interactive PHP inside the app
```

### Inspecting

```bash
sail artisan route:list --path=api   # all API routes
sail artisan about                   # app, environment, drivers
sail artisan config:show database    # resolved config values
sail artisan horizon                 # run queue workers (Day 3+)
sail artisan queue:failed            # list failed jobs
sail artisan pail                    # tail logs live
sail artisan boost:install           # set up Laravel Boost for Claude Code (MCP server: boost:mcp)
sail artisan agent:eval              # run tests/Evals/cases.json against the real model (Day 5, costs money)
sail artisan agent:costs --days=7    # LLM calls, tokens, cost per purpose and model (Day 5)
```

### Common code patterns

| Need | Code |
|---|---|
| Find or 404 | `Shipment::where('reference', $ref)->firstOrFail()` |
| Eager load | `->with(['origin', 'destination'])` |
| Scope to user | `$request->user()->shipments()` |
| Paginate | `->paginate(15)` |
| Transaction | `DB::transaction(function () { ... })` |
| Row lock | `->lockForUpdate()` inside a transaction |
| Authorize | `Gate::authorize('view', $shipment)` |
| Validated input | `$request->validated()` |
| Cache | `Cache::remember('key', now()->addHour(), fn () => ...)` |
| Dispatch job to queue | `AssignVehicleJob::dispatch($shipment)` (the job sets `$this->onQueue('dispatch')` in its constructor) |
| Log with context | `Log::info('event.name', ['key' => $value])` |
| Enum cast | `'status' => ShipmentStatus::class` in `casts()` |

## C. Pest cheat sheet

```bash
sail artisan test                          # all tests
sail artisan test --filter=PricingService  # matching tests only
sail artisan test --parallel               # faster on many cores
sail artisan test --coverage               # needs a coverage driver
```

### Structure

```php
beforeEach(function () {
    $this->user = User::factory()->create();
});

it('does something', function () {
    expect(1 + 1)->toBe(2);
});

test('also works with test()', function () {
    // ...
});

it('runs for each item', function (string $code) {
    expect(City::where('code', $code)->exists())->toBeTrue();
})->with(['TIP', 'BEN', 'MRA']);
```

### Expectations

| Expectation | Checks |
|---|---|
| `->toBe($x)` | Strict equality (`===`) |
| `->toEqual($x)` | Loose equality |
| `->toBeTrue()` / `->toBeFalse()` | Booleans |
| `->toBeNull()` | Null |
| `->toHaveCount(3)` | Count of array or collection |
| `->toHaveKey('error')` | Array key exists |
| `->toContain('SHN-')` | String or array contains |
| `->toBeInstanceOf(Shipment::class)` | Class |
| `->toThrow(Exception::class)` | Closure throws |
| `->not->toBe($x)` | Negation |
| `->and($other)->toBe(...)` | Chain another value |

### HTTP and database assertions

```php
$this->actingAs($user)
    ->postJson('/api/quotes', $payload)    // TIP → BEN, van, 500 kg
    ->assertCreated()                      // 201
    ->assertJsonPath('data.price_lyd', '876.00')
    ->assertJsonStructure(['data' => ['id', 'price_lyd', 'expires_at']]);

$this->getJson('/api/shipments')->assertUnauthorized();   // 401
$response->assertForbidden();                             // 403
$response->assertNotFound();                              // 404
$response->assertConflict();                              // 409
$response->assertUnprocessable();                         // 422
$response->assertJsonValidationErrors(['weight_kg']);
$response->assertTooManyRequests();                       // 429

$this->assertDatabaseHas('shipments', ['reference' => 'SHN-7KQ2XA']);
$this->assertDatabaseCount('shipments', 1);
```

### Fakes

```php
Queue::fake();
// ... book a shipment
Queue::assertPushed(AssignVehicleJob::class);

Event::fake([ShipmentBooked::class]);
Event::assertDispatched(ShipmentBooked::class);

Prism::fake([StructuredResponseFake::make()->withStructured(['intent' => 'track', 'language' => 'en'])]);
```

`Prism::fake()` replaces the whole model call; your tools do not run. Test tools directly.

## D. Claude Code cheat sheet

### Commands and keys

| Command or key | What it does |
|---|---|
| `claude` | Start an interactive session in the current folder |
| `claude -p "prompt"` | Run one prompt non-interactively and print the result |
| `claude --continue` | Continue the most recent conversation |
| `/init` | Generate a starting `CLAUDE.md` for the project |
| `/clear` | Clear the conversation (start fresh on a new task) |
| `/compact` | Summarize the conversation to free context |
| `/mcp` | Show connected MCP servers (check Boost here) |
| `/permissions` | View and edit tool permissions |
| `/help` | List commands |
| `@path/to/file` | Mention a file to include it in context |
| Shift+Tab | Cycle modes, including plan mode |
| Esc | Interrupt the agent |

Run `/help` in your installed version for the current list; commands are added over time.

### Prompt patterns

| Pattern | Template |
|---|---|
| **Explore first** | "Read X and Y. Explain how Z works today. Do not edit any files." |
| **Plan file** | "Draft `docs/plans/<name>.md` for [goal]: steps, files, tests, out of scope. No code yet." |
| **One step** | "Implement step 2 of `docs/plans/<name>.md` only." |
| **Tests first** | "Write failing Pest tests for [behaviour]. Run them and show the failure. Do not implement yet." |
| **Protect tests** | "Make these tests pass without modifying the tests. If a test is wrong, stop and explain." |
| **Ground in docs** | "Check with search-docs before using any API you are not sure exists. Cite the page." |
| **Prove existence** | "Show me the file in `vendor/` where this method is defined." |
| **Review mode** | "Review the git diff against this checklist. Report pass/fail per item with file and line. Do not fix." |
| **Explain** | "Explain this code line by line as if to a junior engineer. What could go wrong?" |
| **Measure, don't guess** | "Give me the exact command to measure this before and after. Do not estimate results." |
| **Attack it** | "Assume the model calling this tool is controlled by an attacker. What can it do?" |

A good prompt has **context** (files, plan), **one task**, **constraints** (what not to touch), and **verification** (which command proves it works).

## E. AI code review checklist

Use on every AI-written change before you commit.

| # | Area | Question |
|---|---|---|
| 1 | Scope | Does the diff do only what was asked? Any unexpected files or packages? |
| 2 | Existence | Does every class, method, config key, and artisan command exist in our installed versions? |
| 3 | Validation | Is all external input validated (FormRequest or Validator)? No `$request->all()` into models? |
| 4 | Authorization | Is every read and write scoped to the user or checked by a policy? Tools get the user from code? |
| 5 | Data integrity | Related writes in a transaction? Constraints in the database back up the rules? |
| 6 | Concurrency | Could two requests or jobs run this at once? Locks, unique constraints, idempotency? |
| 7 | Money and time | Decimal for money? UTC for storage? ISO 8601 in the API? |
| 8 | Errors | Correct status codes? No stack traces, secrets, or internal IDs in responses? |
| 9 | Performance | Queries in loops (N+1)? Missing indexes? Unbounded result sets? Slow work in the request? |
| 10 | LLM safety | Model output validated? IDs from the model loaded through the user? Side effects confirmed? |
| 11 | Tests | Do tests check behaviour, including failure cases? Were any tests weakened, skipped, or deleted? |
| 12 | No real API calls in tests | LLM tests use `Prism::fake()`? |
| 13 | Readability | Can you explain every line? Does it follow `CLAUDE.md` conventions? |
| 14 | Secrets | No keys, tokens, or `.env` contents in the diff? |

## F. HTTP status codes used in Shahna

| Code | Name | When |
|---|---|---|
| 200 | OK | Successful read or action with a body |
| 201 | Created | Quote or shipment created |
| 400 | Bad Request | Missing (or longer than 255 characters) `Idempotency-Key` header on `POST /api/shipments` |
| 401 | Unauthorized | No or invalid token |
| 403 | Forbidden | Authenticated but not allowed (wrong owner, wrong role) |
| 404 | Not Found | Unknown reference, another user's `conversation_id`, or unknown route |
| 409 | Conflict | A request with the same `Idempotency-Key` is still being processed |
| 422 | Unprocessable Content | Validation failed; invalid status change (e.g. cancelling a cancelled or picked-up shipment); quote expired or already booked; idempotency key reused with a different body |
| 429 | Too Many Requests | Rate limit exceeded; see `Retry-After` |
| 500 | Internal Server Error | Unhandled bug |
| 503 | Service Unavailable | Dependency down or maintenance mode |

## G. Further reading

Official documentation:

- Laravel 12 documentation — laravel.com/docs/12.x
- Pest documentation — pestphp.com/docs
- Prism documentation — prismphp.com
- Laravel Boost — github.com/laravel/boost
- Laravel Horizon, Sanctum, Pulse, Telescope — sections of the Laravel documentation
- PostgreSQL documentation, especially "Full Text Search" and "Indexes" — postgresql.org/docs/16
- k6 documentation — grafana.com/docs/k6
- Claude Code documentation — docs.anthropic.com (Claude Code section)
- Anthropic API documentation: messages, tool use, structured outputs — docs.anthropic.com
- PHP manual — php.net/manual

Security:

- OWASP Top 10 for Large Language Model Applications — genai.owasp.org
- OWASP API Security Top 10 — owasp.org/API-Security

Articles and guides:

- Anthropic, "Building effective agents" — anthropic.com/research/building-effective-agents
- Anthropic, "Claude Code: Best practices for agentic coding" — anthropic.com/engineering
- Simon Willison's writing on prompt injection — simonwillison.net (tag: prompt-injection)
- Stripe, "Designing robust and predictable APIs with idempotency" — stripe.com/blog/idempotency

Books:

- Martin Kleppmann, *Designing Data-Intensive Applications* (O'Reilly)
- Kent Beck, *Test-Driven Development: By Example* (Addison-Wesley)
- Chip Huyen, *AI Engineering* (O'Reilly)
