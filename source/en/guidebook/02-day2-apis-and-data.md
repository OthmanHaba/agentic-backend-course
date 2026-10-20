# Day 2 — APIs and Data, Done Right

Yesterday you built the database. Today you put an API in front of it: customers register, get quotes, book shipments, track them, and cancel them. You will write tests before code, with the agent writing many of those tests, and you will learn to review AI-written code with a checklist instead of a feeling.

## Learning objectives

By the end of Day 2 you should be able to:

- Design REST resources with correct methods, paths, and status codes.
- Validate input at the boundary with FormRequests and avoid mass-assignment bugs.
- Explain the difference between authentication and authorization, and implement both with Sanctum and Policies.
- Model data safely in PostgreSQL: keys, foreign keys, unique and check constraints, indexes, and decimals for money.
- Handle money and time correctly.
- Run a red → green → refactor loop with an agent, tests first.
- Review AI-generated code with a written checklist.

## Session A: Designing the API

### REST in practice

REST is a style for HTTP APIs built around **resources** (nouns) and **methods** (verbs). The Shahna API:

| Method | Path | What it does |
|---|---|---|
| POST | `/api/auth/register` | Create a user, return a token |
| POST | `/api/auth/login` | Return a token |
| GET | `/api/cities` | List cities |
| POST | `/api/quotes` | Create a price quote |
| POST | `/api/shipments` | Book a shipment from a quote |
| GET | `/api/shipments` | List my shipments (paginated) |
| GET | `/api/shipments/{reference}` | Show one shipment |
| POST | `/api/shipments/{reference}/cancel` | Cancel a shipment |
| GET | `/api/shipments/{reference}/tracking` | The event timeline |

Some design choices worth noticing:

- **Plural nouns** for collections: `/shipments`, not `/getShipments`.
- **Public identifiers.** We use `reference` (like `SHN-7KQ2XA`) in URLs, not the database `id`. Internal IDs leak information (how many shipments you have) and are easy to guess.
- **Actions as sub-resources.** Cancelling is not a simple field update; it has rules. `POST /shipments/{reference}/cancel` makes the intent explicit, and it is easy to authorize and log.

### Status codes

Use the status code to say what happened. Clients (and, later, your AI agent's tools) depend on it.

| Code | Meaning | Shahna example |
|---|---|---|
| 200 OK | Success with body | `GET /shipments/SHN-7KQ2XA` |
| 201 Created | New resource created | `POST /quotes`, `POST /shipments` |
| 204 No Content | Success, nothing to return | (rare in this API) |
| 401 Unauthorized | Not authenticated (no or bad token) | Missing bearer token |
| 403 Forbidden | Authenticated but not allowed | Customer viewing someone else's shipment |
| 404 Not Found | Does not exist | Unknown reference |
| 409 Conflict | Request conflicts with current state | Same `Idempotency-Key` still being processed (Day 3) |
| 422 Unprocessable Content | Validation or business rule failed | `weight_kg` is negative; quote expired or already booked; cancelling a delivered shipment |
| 429 Too Many Requests | Rate limit hit | Day 3 |
| 500 Internal Server Error | Your bug | Never on purpose |

::: tip
For a customer looking at another customer's shipment, some teams return 404 instead of 403 so that attackers cannot even learn the reference exists. Both are defensible. Pick one, write it in `CLAUDE.md`, and test it.
:::

### API Resources: shaping the output

Never return a model directly. Models contain columns you may not want to expose and their shape changes when the database changes. An **API Resource** is a deliberate contract:

```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ShipmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'reference' => $this->reference,
            'status' => $this->status,                 // enum, serialized as "confirmed"
            'origin' => new CityResource($this->origin),
            'destination' => new CityResource($this->destination),
            'vehicle_type' => $this->vehicle_type,
            'vehicle' => $this->vehicle ? [
                'plate' => $this->vehicle->plate,
                'type' => $this->vehicle->type,
            ] : null,
            'weight_kg' => $this->weight_kg,
            'price_lyd' => $this->price_lyd,           // "876.00", a string
            'pickup_at' => $this->pickup_at,
            'created_at' => $this->created_at,
        ];
    }
}
```

`CityResource` (`id`, `code`, `name_en`, `name_ar`), `QuoteResource`, and `ShipmentEventResource` (`status`, `note`, `occurred_at`) follow the same pattern.

### Pagination

`GET /shipments` must not return ten thousand rows. Laravel's paginator does the work:

```php
public function index(Request $request)
{
    $shipments = $request->user()
        ->shipments()
        ->latest()
        ->paginate(15);

    return ShipmentResource::collection($shipments);
}
```

The response includes `data`, `links`, and `meta` (current page, total, and so on). Note the query starts from `$request->user()->shipments()`: the customer only ever sees their own shipments. Scoping the query is the first layer of authorization.

### Validation at the boundary

All input from outside is untrusted. Validate it where it enters, before it reaches business logic. In Laravel this is a **FormRequest**:

```php
<?php

namespace App\Http\Requests;

use App\Enums\VehicleType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreQuoteRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'origin_city_id' => ['required', 'integer', 'exists:cities,id'],
            'destination_city_id' => ['required', 'integer', 'exists:cities,id'],
            'vehicle_type' => ['required', Rule::enum(VehicleType::class)],
            'weight_kg' => ['required', 'integer', 'min:1', 'max:25000'],
        ];
    }
}
```

If validation fails, Laravel automatically returns 422 with a JSON body listing the errors. Your controller only runs with valid data, available through `$request->validated()`.

### Mass assignment

Mass assignment means filling a model from an array: `Shipment::create($data)`. The danger is filling it from *user input*:

```php
// DANGEROUS: the client can send "price_lyd": 1 or "status": "delivered"
Shipment::create($request->all());
```

Two defenses, use both:

1. Only pass validated data: `$request->validated()`.
2. Declare `$fillable` on the model, so unknown keys are ignored.

And for important fields like price, do not take them from the client at all. The price comes from the quote, which came from `PricingService`.

### Authentication vs authorization

| | Authentication | Authorization |
|---|---|---|
| Question | Who are you? | Are you allowed to do this? |
| Shahna tool | Sanctum bearer token | Policies (`ShipmentPolicy`) and query scoping |
| Failure code | 401 | 403 (or 404) |

**Sanctum** issues API tokens. In Laravel 12, `php artisan install:api` sets up Sanctum and `routes/api.php` (already done in the starter). The `User` model uses the `HasApiTokens` trait.

```php
public function login(LoginRequest $request)
{
    $user = User::where('email', $request->email)->first();

    if (! $user || ! Hash::check($request->password, $user->password)) {
        // 422 with errors.email, like any other invalid form field
        throw ValidationException::withMessages(['email' => 'The provided credentials are incorrect.']);
    }

    return response()->json([
        'token' => $user->createToken('api')->plainTextToken,
        'user' => $user->only('id', 'name', 'email', 'role'),
    ]);
}
```

Protected routes go inside the `auth:sanctum` middleware group:

```php
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/quotes', [QuoteController::class, 'store']);
    Route::get('/shipments', [ShipmentController::class, 'index']);
    Route::post('/shipments', [ShipmentController::class, 'store']);
    Route::get('/shipments/{shipment:reference}', [ShipmentController::class, 'show']);
    Route::post('/shipments/{shipment:reference}/cancel', [ShipmentController::class, 'cancel']);
    Route::get('/shipments/{shipment:reference}/tracking', [ShipmentController::class, 'tracking']);
});
```

`{shipment:reference}` tells Laravel to find the `Shipment` by its `reference` column (route model binding). If none exists, Laravel returns 404 for you.

**Policies** hold authorization rules for a model:

```php
<?php

namespace App\Policies;

use App\Models\Shipment;
use App\Models\User;

class ShipmentPolicy
{
    public function view(User $user, Shipment $shipment): bool
    {
        return $user->id === $shipment->user_id || $user->isStaff();
    }

    public function cancel(User $user, Shipment $shipment): bool
    {
        return $user->id === $shipment->user_id || $user->isStaff();
    }
}
```

Laravel finds `ShipmentPolicy` automatically by naming convention. In the controller:

```php
use Illuminate\Support\Facades\Gate;

public function show(Shipment $shipment)
{
    Gate::authorize('view', $shipment);   // throws 403 if not allowed

    return new ShipmentResource($shipment);
}
```

::: tip
The `User` model casts `role` to the `UserRole` enum, so `isStaff()` compares enum cases (`UserRole::Dispatcher`, `UserRole::Admin`), never raw strings.
:::

### Money and time

**Money.** Floating point numbers cannot represent most decimals exactly (`0.1 + 0.2` is not `0.3`). For money:

- Store as `decimal(10, 2)` in PostgreSQL.
- Cast as `decimal:2` in the model, which gives you a string.
- Compute carefully and round once, at the end, to 2 decimals.

**Time.** Store timestamps in UTC (Laravel's default `APP_TIMEZONE=UTC`). Convert to Libya time (`Africa/Tripoli`) only when displaying. Return ISO 8601 strings in the API (`2026-10-21T08:00:00+00:00`). For "the quote expires in 15 minutes", use `now()->addMinutes(15)` and compare with `$quote->expires_at->isPast()`.

## The core business logic: PricingService

Business rules live in services, not controllers. The pricing rule from the spec:

```text
price = 50 + km × rate_per_km[vehicle_type] + weight_kg × 0.02   (rounded to 2 decimals)
```

```php
<?php

namespace App\Services;

use App\Enums\VehicleType;
use App\Models\CityDistance;

class PricingService
{
    public const BASE_FEE_LYD = 50;

    public const RATE_PER_KG_LYD = 0.02;

    public const RATE_PER_KM_LYD = [
        'van' => 0.8,
        'box_truck' => 1.2,
        'flatbed' => 1.5,
        'reefer' => 1.9,
    ];

    public const QUOTE_TTL_MINUTES = 15;

    /**
     * Price in LYD as a "123.45" string, ready for a decimal column.
     */
    public function price(int $originCityId, int $destinationCityId, VehicleType $vehicleType, int $weightKg): string
    {
        $km = $this->distanceKm($originCityId, $destinationCityId);

        $price = self::BASE_FEE_LYD
            + $km * self::RATE_PER_KM_LYD[$vehicleType->value]
            + $weightKg * self::RATE_PER_KG_LYD;

        return number_format($price, 2, '.', '');
    }

    public function distanceKm(int $originCityId, int $destinationCityId): int
    {
        if ($originCityId === $destinationCityId) {
            return 0;
        }

        return CityDistance::where('from_city_id', $originCityId)
            ->where('to_city_id', $destinationCityId)
            ->valueOrFail('km');
    }

    // createQuote() stores a Quote with this price and expires_at = now + 15 minutes.
}
```

Worked example: a van carrying 500 kg from Tripoli to Benghazi (1,020 km in the seeder) costs `50 + 1020 × 0.8 + 500 × 0.02 = 50 + 816 + 10 = 876.00` LYD.

::: tip
This is the repository's version (Day 3 later wraps the distance lookup in `Cache::remember`). If yours differs in names, the rule and the test cases are what matter, but always read the repository's version after you write yours.
:::

## Session B: Tests first, with an agent

### The TDD loop

Test-Driven Development (TDD) is a short cycle:

```text
   ┌──────────┐      ┌──────────┐      ┌────────────┐
   │   RED    │ ───> │  GREEN   │ ───> │  REFACTOR  │ ──┐
   │ write a  │      │ simplest │      │ clean up,  │   │
   │ failing  │      │ code that│      │ tests stay │   │
   │ test     │      │ passes   │      │ green      │   │
   └──────────┘      └──────────┘      └────────────┘   │
        ^                                               │
        └───────────────────────────────────────────────┘
```

Why TDD is *more* valuable with an agent, not less:

- **Tests are the spec the agent can check itself against.** "Make these tests pass" is a much clearer instruction than "implement pricing".
- **Tests catch hallucinations.** An invented method fails immediately.
- **You review the tests first.** Tests are shorter and easier to judge than implementation. If the tests are right and green, most of the risk is gone.

The rule: **you approve the tests before the agent writes the implementation.** And watch out for the agent "fixing" a failing test by changing the test instead of the code.

### Unit tests for PricingService

```php
<?php

use App\Enums\VehicleType;
use App\Services\PricingService;
use Database\Seeders\CitySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// Pricing reads distances from the database, so these tests boot Laravel.
uses(TestCase::class, RefreshDatabase::class);

beforeEach(function () {
    $this->seed(CitySeeder::class);
    $this->pricing = new PricingService;
});

it('prices Tripoli to Misrata by box truck', function () {
    // 50 + 210 km × 1.2 + 1000 kg × 0.02 = 322
    expect($this->pricing->price(city('TIP')->id, city('MRA')->id, VehicleType::BoxTruck, 1000))->toBe('322.00');
});

it('uses the rate for each vehicle type', function (VehicleType $type, string $expected) {
    // Tripoli → Zawiya is 45 km, 500 kg adds 10 LYD
    expect($this->pricing->price(city('TIP')->id, city('ZAW')->id, $type, 500))->toBe($expected);
})->with([
    [VehicleType::Van, '96.00'],
    [VehicleType::BoxTruck, '114.00'],
    [VehicleType::Flatbed, '127.50'],
    [VehicleType::Reefer, '145.50'],
]);

it('treats the same city as zero km', function () {
    expect($this->pricing->price(city('BEN')->id, city('BEN')->id, VehicleType::Van, 100))->toBe('52.00');
});
```

These touch the database (cities and distances), so they need `RefreshDatabase`. `tests/Pest.php` applies `TestCase` and `RefreshDatabase` only to the `Feature` folder, so this file in `tests/Unit` opts in with `uses(...)`. The `city('TIP')` helper is defined in `tests/Pest.php`.

### Feature tests for the API

Feature tests send real HTTP requests to your app and check the response:

```php
<?php

use App\Models\Quote;
use App\Models\Shipment;
use App\Models\User;

it('books a shipment from a valid quote', function () {
    $user = User::factory()->create();
    $quote = Quote::factory()->for($user)->create(['expires_at' => now()->addMinutes(10)]);

    $this->actingAs($user)
        ->postJson('/api/shipments', [
            'quote_id' => $quote->id,
            'pickup_at' => now()->addDay()->toIso8601String(),
        ])
        ->assertCreated()
        ->assertJsonPath('data.price_lyd', $quote->price_lyd)
        ->assertJsonPath('data.status', 'confirmed');

    expect(Shipment::count())->toBe(1);
});

it('rejects an expired quote', function () {
    $user = User::factory()->create();
    $quote = Quote::factory()->for($user)->create(['expires_at' => now()->subMinute()]);

    $this->actingAs($user)
        ->postJson('/api/shipments', ['quote_id' => $quote->id, 'pickup_at' => now()->addDay()])
        ->assertStatus(422);
});

it('hides other customers shipments', function () {
    $shipment = Shipment::factory()->create();
    $stranger = User::factory()->create();

    $this->actingAs($stranger)
        ->getJson("/api/shipments/{$shipment->reference}")
        ->assertForbidden();
});
```

::: warning
`actingAs()` skips token checks to keep tests fast. Keep at least one test that sends a real `Authorization: Bearer ...` header to prove the auth middleware is wired correctly.
:::

### The test pyramid

```text
            /\
           /  \        few: end-to-end (real HTTP client, real services)
          /----\
         /      \      some: feature tests (HTTP into Laravel, real DB)
        /--------\
       /          \    many: unit tests (one class, fast, no HTTP)
      /------------\
```

Unit tests are fast and pinpoint failures. Feature tests prove the pieces work together. Aim for many unit tests on rules like `PricingService` and `ShipmentStatus`, and feature tests for every endpoint's happy path plus its important failures (401, 403, 404, 422). Today's target: at least 20 passing tests.

### Booking and cancelling: rules in code

The booking action must reject expired quotes and quotes already used. In the repository, `BookingService` does the whole booking in one transaction: it creates the shipment as `pending` (event "Booking received."), then immediately moves it to `confirmed` (event "Booking confirmed."). So the 201 response shows `confirmed`, and the tracking timeline starts with two events:

```json
{
  "data": [
    {"status": "pending", "note": "Booking received.", "occurred_at": "2026-10-21T08:00:00+00:00"},
    {"status": "confirmed", "note": "Booking confirmed.", "occurred_at": "2026-10-21T08:00:00+00:00"}
  ]
}
```

Every status change goes through `canTransitionTo()` and writes an event, so the timeline is a complete history. The cancel action must respect the same state machine.

```php
// ShipmentController
public function cancel(Shipment $shipment, BookingService $booking): ShipmentResource
{
    Gate::authorize('cancel', $shipment);

    return new ShipmentResource($booking->cancel($shipment));
}

// BookingService
public function cancel(Shipment $shipment): Shipment
{
    return DB::transaction(function () use ($shipment) {
        // Re-read under a lock: the status may have changed since this request loaded it.
        $shipment = Shipment::lockForUpdate()->findOrFail($shipment->id);

        $shipment->transitionTo(ShipmentStatus::Cancelled, 'Cancelled by customer.');

        return $shipment;
    });
}

// Shipment model
public function transitionTo(ShipmentStatus $next, ?string $note = null): void
{
    if (! $this->status->canTransitionTo($next)) {
        throw ValidationException::withMessages([
            'status' => "A {$this->status->value} shipment cannot move to {$next->value}.",
        ]);
    }

    $this->update(['status' => $next]);
    $this->events()->create(['status' => $next, 'note' => $note, 'occurred_at' => now()]);
}
```

An invalid cancel (for example a shipment that is already `in_transit` or `cancelled`) throws a `ValidationException`, so the client gets **422** with `errors.status`, e.g. `"A cancelled shipment cannot move to cancelled."`. The status change and the event row are written in one transaction: either both happen or neither does.

::: tip
The repository keeps both booking and cancelling in `BookingService`, so the API and the Day 4 agent tools call exactly the same code.
:::

### PostgreSQL: keys, constraints, indexes

Your application validates data. The **database** must also protect it, because it is the last line of defense — against bugs, against two requests arriving at once, and against code paths you forgot.

| Protection | Example in Shahna | What it prevents |
|---|---|---|
| Primary key | `id` on every table | Duplicate rows, ambiguous references |
| Foreign key | `shipments.user_id → users.id` | Shipments for users that don't exist |
| Unique | `shipments.quote_id`, `shipments.reference`, `cities.code` | One quote booked twice; duplicate references |
| Check | `weight_kg > 0`, `price_lyd >= 0` (an optional extra; the repository relies on unsigned columns and validation) | Impossible values, even from buggy code |
| Not null | `price_lyd`, `status` | Missing critical data |
| Index | `shipments(user_id, created_at)` | Slow "my shipments" queries |

The unique constraint on `quote_id` is the important one. If two booking requests for the same quote arrive at the same moment, application checks ("is this quote already used?") can both pass. The database unique constraint guarantees only one insert succeeds. You will build on this on Day 3.

Laravel's schema builder covers most of these. For a check constraint, use a raw statement in the migration:

```php
use Illuminate\Support\Facades\DB;

DB::statement('ALTER TABLE shipments ADD CONSTRAINT shipments_weight_positive CHECK (weight_kg > 0)');
```

**Indexes** make reads fast and writes slightly slower. Index the columns you filter and sort by. You can see if PostgreSQL uses an index with `EXPLAIN`:

```sql
EXPLAIN ANALYZE
SELECT * FROM shipments
WHERE user_id = 42
ORDER BY created_at DESC
LIMIT 20;
```

Look for `Index Scan` (good) versus `Seq Scan` over a large table (often bad).

### The AI code review checklist

Use this list on every AI-written change. It is also in the appendix.

| Area | Question |
|---|---|
| Scope | Does the change do only what was asked? Any surprise files? |
| Existence | Does every class, method, and config key exist in our installed versions? |
| Validation | Is all external input validated with a FormRequest? Any `$request->all()`? |
| Authorization | Is every read and write scoped to the user or checked by a policy? |
| Data integrity | Are related writes in a transaction? Do constraints back up the rules? |
| Money and time | Decimal for money? UTC for storage? |
| Errors | Correct status codes? No stack traces or secrets in responses? |
| Tests | Do tests check behaviour, including failures? Did any test get weakened to pass? |
| Performance | Queries in loops? Missing indexes? Unbounded lists? |
| Readability | Could you explain every line to a reviewer? |

## Building agents INTO the backend: why today matters

Today's API is tomorrow's toolbox. On Day 4, the Shahna Assistant's tools will call the same code:

| API endpoint (today) | Agent tool (Day 4) | Shared code |
|---|---|---|
| `POST /quotes` | `get_quote` | `PricingService` |
| `POST /shipments` | `book_shipment` | booking logic, quote checks |
| `GET /shipments/{reference}/tracking` | `track_shipment` | ownership scoping |
| `POST /shipments/{reference}/cancel` | `cancel_shipment` | `canTransitionTo()`, policy |

An LLM is an unusual client: it can send *anything*. The validation, authorization, constraints, and clear error messages you build today are exactly what keep an AI agent safe tomorrow. Clear error messages ("A delivered shipment cannot move to cancelled.") also help the model explain the situation to the customer.

## How to work with your agent on this

Tests first, always reviewed by you:

::: agent
Write Pest unit tests for App\Services\PricingService based on the pricing rule in docs/requirements.md. Cover: each vehicle type rate, same-city zero distance, weight cost, rounding to 2 decimals. Do NOT write the service yet. Run the tests and show me they fail for the right reason.
:::

After you approve the tests:

::: agent
Now implement PricingService so these tests pass. Do not modify the tests. If you believe a test is wrong, stop and explain why instead of changing it.
:::

For an endpoint:

::: agent
Plan the POST /api/shipments endpoint in docs/plans/day2-booking.md: FormRequest rules, policy checks, transaction boundaries, error cases with status codes (expired quote, used quote, someone else's quote), and the list of feature tests. No code yet.
:::

For review:

::: agent
Review the current git diff against this checklist: scope, existence of APIs, validation, authorization, transactions, money as decimal, status codes, test quality, N+1 queries. For each item say pass or fail with the file and line. Do not fix anything yet.
:::

Then fix the findings one at a time, rerunning tests after each.

## Common pitfalls

- **The agent edits the test to make it pass.** Say explicitly "do not modify the tests" and check `git diff tests/`.
- **Tests that assert nothing useful.** `assertOk()` alone proves very little. Check the JSON body and the database.
- **`$request->all()` into `create()`.** Classic mass assignment hole.
- **Price from the client.** The price must come from the quote, never the request body.
- **Authorization only in the controller `show` method.** List endpoints need scoping too, or customers see everyone's data.
- **Float money and local time.** Use decimals and UTC.
- **Missing database constraints** because "we validate in the app". Two concurrent requests will prove you wrong.
- **Returning models instead of resources.** You leak columns and couple clients to your schema.

## Key takeaways

- Design around resources and clear status codes. Use public references, not database IDs, in URLs.
- Validate at the boundary (FormRequest), assign only validated data, and never trust prices or statuses from the client.
- Authentication (Sanctum) answers "who"; authorization (Policies, scoped queries) answers "allowed?".
- The database enforces truth: foreign keys, unique constraints (especially `quote_id`), check constraints, and indexes.
- Money is decimal; time is UTC in storage.
- With an agent, tests come first and you review them first. Green tests you trust are your strongest defense against hallucinated code.
- Today's API logic becomes the agent's tools on Day 4.

## Self-check questions

1. What is the difference between 401 and 403? Give a Shahna example of each.
2. Why does the API use `reference` in URLs instead of `id`?
3. What two things together prevent mass-assignment bugs?
4. Why should the shipment price never come from the request body?
5. Calculate the price for a flatbed carrying 2,000 kg over 300 km.
6. Why is a unique constraint on `shipments.quote_id` needed even if the controller checks whether the quote was used?
7. Why is TDD especially useful when an agent writes the implementation?
8. What warning sign should you look for in `git diff tests/` after the agent says "all tests pass"?
9. Why are the status change and the event insert in the cancel action wrapped in a transaction?
10. Name two Day 4 agent tools and the Day 2 code they reuse.

### Answers

1. 401 means not authenticated (no or invalid token, e.g. calling `GET /api/shipments` without a bearer token). 403 means authenticated but not allowed (a customer requesting another customer's shipment).
2. References are not sequential, so they do not leak business volume and are hard to guess; they are also stable, meaningful identifiers for customers.
3. Passing only `$request->validated()` data, and declaring `$fillable` on the model. (Also: never accept sensitive fields like price or status from the client.)
4. The client could send any number. The trusted price is the one `PricingService` computed and stored on the quote.
5. `50 + 300 × 1.5 + 2000 × 0.02 = 50 + 450 + 40 = 540.00` LYD.
6. Two requests can arrive at the same time and both pass the application check before either inserts. Only the database constraint guarantees one succeeds and the other fails.
7. The tests are a precise spec the agent can check itself against, they catch invented APIs immediately, and you can review short tests more reliably than long implementations.
8. Changed or deleted assertions, weakened expectations, or tests marked skipped — signs the agent changed the test instead of fixing the code.
9. So both succeed or both fail; you never end up with a cancelled shipment without an event, or an event for a cancellation that did not happen.
10. `get_quote` reuses `PricingService`; `cancel_shipment` reuses `canTransitionTo()` and the cancel policy; `track_shipment` reuses ownership scoping; `book_shipment` reuses the booking logic and quote checks.
