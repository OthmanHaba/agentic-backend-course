# Day 3 — Making It Scale

The booking API works. Now imagine a holiday weekend: hundreds of customers booking at once, phones on weak mobile networks retrying requests, and dispatchers refreshing dashboards. Today you make Shahna fast, safe under concurrency, and observable — and you learn to make the agent prove its performance claims with numbers.

## Learning objectives

By the end of Day 3 you should be able to:

- Explain a simple scalability model: stateless app servers, horizontal scaling, and the database as the usual bottleneck.
- Find common bottlenecks: N+1 queries, missing indexes, slow work inside the request.
- Move slow work to queues using events, listeners, and jobs, managed by Horizon.
- Prevent double booking with idempotency keys, unique constraints, transactions, and row locks.
- Cache the right data with a clear invalidation plan.
- Rate limit per user.
- Make the system observable with structured logs and request IDs.
- Run a k6 load test, read the report, and compare before and after.
- Use an agent to profile and propose fixes, then verify its claims with measurements.

## Session A: Scale, queues, and race conditions

### A mental model for scaling

```text
                    ┌──────────────┐
  clients ────────> │ load balancer│
                    └──────┬───────┘
             ┌─────────────┼─────────────┐
             v             v             v
        ┌─────────┐   ┌─────────┐   ┌─────────┐
        │ app #1  │   │ app #2  │   │ app #3  │   stateless: add more when busy
        └────┬────┘   └────┬────┘   └────┬────┘
             └──────┬──────┴──────┬──────┘
                    v             v
              ┌──────────┐   ┌─────────┐      ┌──────────────┐
              │PostgreSQL│   │  Redis  │ <──> │ queue workers│
              └──────────┘   └─────────┘      └──────────────┘
               the usual       cache, queues,   slow work happens
               bottleneck      rate limits      here, not in requests
```

Three principles:

1. **Stateless app servers.** No important data stored in a server's memory or local disk between requests. Sessions, cache, and queues live in Redis; data lives in PostgreSQL. Then any server can handle any request, and you scale by adding servers (*horizontal scaling*).
2. **The database is usually the bottleneck.** You can add app servers easily; you cannot easily add primary databases. So: fewer queries, better queries, good indexes, short transactions, and caching for data that rarely changes.
3. **Do slow work outside the request.** A customer should not wait while you search for a truck or send an email. Put that work on a queue.

### Finding bottlenecks: the N+1 problem

The most common performance bug in ORMs. Consider `GET /shipments`:

```php
$shipments = $request->user()->shipments()->latest()->paginate(15);
// ShipmentResource reads $this->origin, $this->destination and $this->vehicle
```

This runs 1 query for the shipments (plus 1 count query for the paginator), then for *each* of the 15 shipments, 1 query for origin, 1 for destination, and 1 for vehicle: 47 queries. With a page size of 100, that is over 300. This is the N+1 pattern: 1 query plus N more.

The fix is **eager loading**:

```php
$shipments = $request->user()
    ->shipments()
    ->with(['origin', 'destination', 'vehicle'])
    ->latest()
    ->paginate(15);
```

Now the query count is fixed (shipments, count, and one query per relation) no matter the page size. The repository's `tests/Feature/PerformanceTest.php` proves it: it counts the queries for 2 shipments and for 12 shipments and expects the same number.

::: tip
Add this to `AppServiceProvider::boot()` in development so N+1 bugs fail loudly instead of silently:
`Model::preventLazyLoading(! app()->isProduction());`
:::

Other common bottlenecks:

| Symptom | Likely cause | Fix |
|---|---|---|
| Query count grows with page size | N+1 | `with()` eager loading |
| One query is slow on a big table | Missing index | Add an index; confirm with `EXPLAIN ANALYZE` |
| Endpoint slow but queries fast | Slow work in the request (email, HTTP call, LLM call) | Move to a queued job |
| Same data loaded every request | No caching | Cache with a clear invalidation rule |
| Errors only under load | Race conditions, connection limits | Locks, constraints, pool sizing |

### Queues, jobs, and events

A **job** is a unit of work that can run later in a background worker. An **event** announces that something happened. A **listener** reacts to an event, often by queuing jobs. This keeps the booking controller small: it books, announces, and returns.

```text
POST /shipments
   │  create shipment (in a transaction)
   │  ShipmentBooked::dispatch($shipment)   ◄── held until the transaction commits
   │  return 201  ◄── the customer gets an answer fast
   v
QueueBookingJobs listener ──> AssignVehicleJob            on queue "dispatch"
         └─> SendBookingConfirmationJob  on queue "notifications"
                     │
                     v
          Horizon workers pick them up from Redis
```

The event:

```php
<?php

namespace App\Events;

use App\Models\Shipment;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

// Dispatched only after the booking transaction commits, so workers never see a half-saved shipment.
class ShipmentBooked implements ShouldDispatchAfterCommit
{
    use Dispatchable, SerializesModels;

    public function __construct(public Shipment $shipment) {}
}
```

The listener `App\Listeners\QueueBookingJobs` (Laravel discovers listeners in `app/Listeners` automatically by the type of the `handle` argument). Each job picks its own queue in its constructor (`$this->onQueue('dispatch')` and `$this->onQueue('notifications')`):

```php
public function handle(ShipmentBooked $event): void
{
    AssignVehicleJob::dispatch($event->shipment);
    SendBookingConfirmationJob::dispatch($event->shipment);
}
```

::: warning
`BookingService::book()` dispatches `ShipmentBooked` *inside* its database transaction. A normal event would run the listener immediately, and a fast worker could pick up `AssignVehicleJob` before the transaction commits, so it would not find the shipment (or the transaction might still roll back). Implementing `ShouldDispatchAfterCommit` tells Laravel to hold the event until the transaction commits, and to drop it if the transaction rolls back.
:::

**Horizon** manages Redis queue workers and gives you a dashboard at `/horizon`. Shahna uses four queues:

| Queue | Work | Why separate |
|---|---|---|
| `default` | Miscellaneous | — |
| `dispatch` | Vehicle assignment | Business-critical, must not wait behind emails |
| `notifications` | Emails, messages | Can be slower; external services fail sometimes |
| `ai` | Long LLM tasks (Day 5) | Slow and expensive; isolate so it cannot block bookings |

Run Horizon in Sail with `sail artisan horizon`. Queues are configured per supervisor in `config/horizon.php`.

Jobs should be written so they can **safely run more than once**, because queues guarantee *at least once* delivery, not exactly once. A job may be retried after a timeout even if the first attempt partly succeeded.

### Race conditions

A race condition happens when the result depends on the timing of concurrent operations. Two dispatch jobs running at the same moment:

```text
 Job A (shipment 1)                 Job B (shipment 2)
 SELECT available van in TIP  ──>  van #7
                                    SELECT available van in TIP  ──> van #7
 UPDATE van #7 busy, assign
                                    UPDATE van #7 busy, assign
 Result: one van, two shipments.
```

The fix is to **lock the row** inside a transaction, so the second job waits until the first commits and then sees the van is busy:

```php
<?php

namespace App\Jobs;

use App\Enums\ShipmentStatus;
use App\Enums\VehicleStatus;
use App\Models\Shipment;
use App\Models\Vehicle;
use App\Services\BookingService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AssignVehicleJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public Shipment $shipment)
    {
        $this->onQueue('dispatch');
    }

    public function handle(BookingService $booking): void
    {
        DB::transaction(function () use ($booking) {
            // Re-read under a lock: another worker or a dispatcher may have changed it.
            $shipment = Shipment::lockForUpdate()->find($this->shipment->id);

            if ($shipment->status !== ShipmentStatus::Confirmed) {
                return; // already assigned or cancelled: safe to run twice
            }

            // Lock the vehicle row too, so two jobs cannot grab the same truck.
            $vehicle = Vehicle::where('status', VehicleStatus::Available)
                ->where('type', $shipment->vehicle_type)
                ->where('current_city_id', $shipment->origin_city_id)
                ->where('capacity_kg', '>=', $shipment->weight_kg)
                ->orderBy('capacity_kg')       // smallest truck that fits
                ->lockForUpdate()
                ->first();

            if (! $vehicle) {
                Log::warning('No vehicle available, waiting for a dispatcher.', ['shipment' => $shipment->reference]);

                return;
            }

            $booking->assign($shipment, $vehicle, "Vehicle {$vehicle->plate} assigned.");
        });
    }
}
```

`lockForUpdate()` adds `FOR UPDATE` to the SQL. Other transactions trying to lock the same row wait until this one finishes. Keep locked transactions short.

Notice the **re-fetch under lock**. `$this->shipment` is the copy that was serialized when the job was queued; by the time a worker runs it, a dispatcher may have assigned a truck or the customer may have cancelled. So the job reads the row again with `lockForUpdate()` and checks the status on *that* fresh copy. Checking the old in-memory copy would be a race. `BookingService::cancel()` and `BookingService::assign()` follow the same pattern: `Shipment::lockForUpdate()->findOrFail($shipment->id)` first, then the rules.

When the job finds a vehicle, `BookingService::assign()` marks the vehicle `busy`, moves the shipment from `confirmed` to `assigned`, and writes an event such as "Vehicle 5-1000 assigned." When no suitable vehicle is free, the job logs a warning, the shipment stays `confirmed`, and a dispatcher can assign one by hand.

The manual override endpoint `POST /api/dispatch/shipments/{reference}/assign` (body `{"vehicle_id": 12}`, dispatcher or admin only, via `ShipmentPolicy::assign`) accepts shipments that are `confirmed` or already `assigned` (to reassign, freeing the previous truck). It calls the same `BookingService::assign()`, which locks both the shipment and the vehicle rows and re-checks them, because a dispatcher and the job can act at the same time.

### Idempotency: the double-booking problem

A customer in Sebha taps "Book" on a weak 3G connection. The request reaches the server and the shipment is created, but the response is lost. The app retries. Without protection, the customer now has two shipments.

An **idempotent** operation gives the same result no matter how many times it is repeated. `GET` and `PUT` are naturally idempotent; `POST` is not. We make `POST /shipments` idempotent with an `Idempotency-Key` header:

```http
POST /api/shipments HTTP/1.1
Authorization: Bearer 12|abc...
Idempotency-Key: 6f1c2a9e-7b1d-4c55-9f0e-2b8e8c1d4a10
Content-Type: application/json

{"quote_id": 381, "pickup_at": "2026-10-22T07:00:00Z"}
```

The client generates a unique key (a UUID) per *intended* booking and reuses it on retries. The server:

```text
 key seen before for this user?
   ├─ no  ──> claim the key (store key + request hash, no response yet),
   │          process the request, store the status and body, return the response
   └─ yes ──> same request hash?
               ├─ no  ──> 422: key already used for a different request
               └─ yes ──> response stored yet?
                           ├─ yes ──> replay it, with header Idempotent-Replayed: true
                           └─ no  ──> 409: still being processed
```

The repository's middleware is `App\Http\Middleware\EnsureIdempotency`, registered in `bootstrap/app.php` under the alias `idempotent` and applied with `Route::post('/shipments', ...)->middleware('idempotent')`. The core of it:

```php
public const IN_FLIGHT_TIMEOUT_SECONDS = 60;

public function handle(Request $request, Closure $next): Response
{
    $key = $request->header('Idempotency-Key');

    if (! $key || strlen($key) > 255) {
        return response()->json(['message' => 'The Idempotency-Key header is required.'], 400);
    }

    $hash = hash('sha256', $request->method().$request->path().$request->getContent());

    $record = $this->claim($request->user()->id, $key, $hash);

    if (! $record->wasRecentlyCreated) {
        if ($record->request_hash !== $hash) {
            return response()->json(['message' => 'This Idempotency-Key was already used for a different request.'], 422);
        }

        if ($record->response_status === null) {
            return response()->json(['message' => 'A request with this Idempotency-Key is still being processed.'], 409);
        }

        return response($record->response_body, $record->response_status)
            ->header('Content-Type', 'application/json')
            ->header('Idempotent-Replayed', 'true');
    }

    $response = $next($request);

    if ($response->getStatusCode() >= 500) {
        // Server errors are not final: let the client retry with the same key.
        $record->delete();
    } else {
        $record->update([
            'response_status' => $response->getStatusCode(),
            'response_body' => $response->getContent(),
        ]);
    }

    return $response;
}

private function claim(int $userId, string $key, string $hash): IdempotencyKey
{
    $attributes = ['user_id' => $userId, 'key' => $key];
    $values = ['request_hash' => $hash, 'expires_at' => now()->addDay()];

    $record = IdempotencyKey::createOrFirst($attributes, $values);

    // An expired key, or a request that started over a minute ago and never finished
    // (the worker crashed), is treated as if it did not exist.
    $abandoned = $record->response_status === null
        && $record->updated_at->lt(now()->subSeconds(self::IN_FLIGHT_TIMEOUT_SECONDS));

    if (! $record->wasRecentlyCreated && ($record->expires_at->isPast() || $abandoned)) {
        $record->delete();
        $record = IdempotencyKey::createOrFirst($attributes, $values);
    }

    return $record;
}
```

Key details:

- **Claim first, then process.** The key row is inserted *before* the booking runs. `createOrFirst` relies on the unique index on `(user_id, key)`: if two identical requests arrive at the same moment, only one insert wins; the other gets the existing row and answers **409** while the first is still working.
- **In-flight timeout.** If a worker crashed after claiming a key, the row would block that key forever. A claim with no response that is older than `IN_FLIGHT_TIMEOUT_SECONDS` (60 seconds) is treated as abandoned and can be claimed again.
- **Only final answers are stored.** 2xx and 4xx responses are saved and replayed; a 5xx deletes the row so the client can retry with the same key.
- **Expiry.** Keys live for one day (`expires_at`). `IdempotencyKey` is `MassPrunable`, and the scheduled `model:prune` command deletes expired rows daily.

| Situation | Response |
|---|---|
| No `Idempotency-Key` header | 400 |
| New key | Normal response (201), stored |
| Same key, same body, finished | Stored status and body, plus `Idempotent-Replayed: true` |
| Same key, same body, still running | 409 |
| Same key, different body | 422 |

::: warning
Defense in depth still matters: the unique `quote_id` on shipments and the locked quote read in `BookingService::book()` stop two *different* keys from booking the same quote (the second gets 422 "This quote has already been booked.").
:::

### Layers of protection against double booking

| Layer | Protects against |
|---|---|
| Idempotency key | Client retries of the same request |
| Unique `shipments.quote_id` | Two different requests booking the same quote |
| Transaction | Half-written bookings |
| `ShouldDispatchAfterCommit` on `ShipmentBooked` | Jobs running before the booking is committed |
| `lockForUpdate` | Two workers assigning the same vehicle |
| Status check on the re-fetched, locked row | Assigning a cancelled shipment |

## Session B: Cache, limits, observability, and load

### Caching

A cache stores the result of expensive work so you can reuse it. The hard part is not storing; it is knowing when the stored value is **stale**.

Ask three questions for anything you cache:

1. **How often does it change?** Cities: almost never. Vehicle availability: every minute.
2. **What happens if it is stale?** A stale city list: harmless. A stale price: you charge the wrong amount.
3. **How will it be invalidated?** Time-based (TTL), event-based (clear on change), or both.

Cities and distances are perfect candidates:

```php
public function index()
{
    $cities = Cache::remember(City::CACHE_KEY, now()->addDay(), fn () => City::orderBy('name_en')->get());

    return CityResource::collection($cities);
}
```

And invalidate when cities change. The repository does it with model events in `City`, where `CACHE_KEY` is `'cities'`:

```php
protected static function booted(): void
{
    static::saved(fn () => Cache::forget(self::CACHE_KEY));
    static::deleted(fn () => Cache::forget(self::CACHE_KEY));
}
```

`PricingService::distanceKm()` also caches each road distance for a week under `distance:{originCityId}:{destinationCityId}`, because distances never change.

What *not* to cache: vehicle availability during assignment (it must be locked and fresh), anything per-user under a shared key (data leaks between users), and prices without including every input in the cache key.

::: tip
Name cache keys with a prefix and the inputs, like `distance:1:2`. When a bug appears, you can find and delete exactly the right key.
:::

### Rate limiting

Rate limits protect your service from abuse, buggy clients, and expensive bursts. By the end of the course Shahna defines two limiters, keyed per user: `api` today, and `agent` on Day 5:

```php
// app/Providers/AppServiceProvider.php
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

public function boot(): void
{
    RateLimiter::for('api', function (Request $request) {
        return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
    });

    // Added on Day 5: every agent message costs money.
    RateLimiter::for('agent', function (Request $request) {
        return Limit::perMinute(10)->by($request->user()?->id ?: $request->ip());
    });
}
```

Apply them with the `throttle` middleware. The `api` limiter is applied to every route in `routes/api.php` from `bootstrap/app.php`; the agent route adds its own:

```php
// bootstrap/app.php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->prepend(AssignRequestId::class);
    $middleware->throttleApi();                                   // throttle:api on the api group
    $middleware->alias(['idempotent' => EnsureIdempotency::class]);
})

// routes/api.php, inside the auth:sanctum group (Day 5)
Route::post('/agent/chat', AgentChatController::class)->middleware('throttle:agent');
```

When the limit is hit, Laravel returns 429 with a `Retry-After` header. The `agent` limiter is stricter because every chat message costs real money in LLM tokens.

### Observability

When something goes wrong at 2 a.m., you need to answer: *what happened, to which request, and why?* Three tools:

**Structured logs.** Log events with context as key-value data, not sentences glued together:

```php
Log::info('vehicle.assigned', [
    'shipment' => $shipment->reference,
    'vehicle_id' => $vehicle->id,
    'origin' => $shipment->origin_city_id,
]);
```

Structured logs can be searched and counted: "how many `vehicle.assigned` events per hour?"

**Request IDs.** Give every request an ID, return it in a response header, and attach it to every log line. The repository's `App\Http\Middleware\AssignRequestId` (prepended to every request in `bootstrap/app.php`) uses `Log::shareContext()`, which adds the ID to every log line written during the request:

```php
public function handle(Request $request, Closure $next): Response
{
    $requestId = $request->header('X-Request-Id') ?: (string) Str::uuid();

    Log::shareContext(['request_id' => $requestId]);

    $response = $next($request);
    $response->headers->set('X-Request-Id', $requestId);

    return $response;
}
```

Now a customer complaint with a request ID leads you straight to every log line for that request. To carry the ID into queued jobs as well, Laravel's `Context` facade (`Context::add('request_id', $requestId)`) is passed along to jobs dispatched during the request; that is a good stretch exercise.

**Dashboards.** Laravel offers two first-party tools:

| Tool | Best for |
|---|---|
| Telescope | Local debugging: every request, query, job, exception, in detail |
| Pulse | Production overview: slow requests, slow queries, slow jobs, busy users |

Horizon adds queue metrics: throughput, wait time, failed jobs.

### Load testing with k6

k6 is a load-testing tool where you write scenarios in JavaScript. A minimal script that only lists shipments looks like this (save it as your own file, for example `load/list.js`):

```js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 20,            // 20 virtual users
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95% of requests under 500 ms
    http_req_failed: ['rate<0.01'],     // under 1% errors
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost/api';
const TOKEN = __ENV.TOKEN;

export default function () {
  const params = { headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' } };

  const res = http.get(`${BASE}/shipments`, params);
  check(res, { 'status is 200': (r) => r.status === 200 });

  sleep(1);
}
```

Run it with `k6 run -e TOKEN=your-token load/list.js`.

The repository's real script, `load/booking.js`, is more complete: each virtual user registers its own account, then loops quote → book (with a fresh `Idempotency-Key`) → list. It ramps up to `VUS` users (default 20), holds for a minute, and checks `http_req_failed` under 1%, p95 under 300 ms for the list request and under 500 ms for the booking request:

```bash
k6 run load/booking.js                                          # BASE_URL defaults to http://localhost
k6 run -e BASE_URL=http://localhost -e VUS=50 load/booking.js
```

### Reading a k6 report

The summary prints many lines. Focus on these:

| Metric | What it tells you |
|---|---|
| `http_req_duration` avg, p(90), p(95) | How long requests take. The percentiles matter more than the average |
| `http_req_failed` | Share of failed requests |
| `http_reqs` | Total requests and requests per second (throughput) |
| `checks` | Share of your `check()` assertions that passed |
| Threshold results | Pass or fail against your goals |

**Why percentiles?** If 95 requests take 100 ms and 5 take 4 seconds, the average looks fine (about 300 ms) but 1 in 20 customers waits 4 seconds. p95 shows that pain.

Record before and after in a table. This is part of your lab deliverable:

| Scenario | p95 before | p95 after | Requests/sec before | after | Change made |
|---|---|---|---|---|---|
| `GET /shipments` (20 VUs) | your number | your number | | | eager loading |
| `GET /cities` (20 VUs) | | | | | cache |

::: warning
Load-test numbers on a laptop are noisy. Run each scenario at least twice, keep everything else the same, and compare relative change, not absolute numbers. Never load-test a system you do not own.
:::

## Building agents INTO the backend: why scale matters for AI

Everything today becomes more important when an LLM is involved:

| Concept | Why it matters for the Shahna Assistant |
|---|---|
| Slow work off the request | An LLM call can take several seconds; long agent tasks run on the `ai` queue (Day 5) |
| Rate limiting | Every chat message costs money; the `agent` limiter is 10/min per user |
| Idempotency | An agent loop may retry a tool; `book_shipment` must not create duplicates |
| Caching | Answers to common policy questions can be cached (Day 5) |
| Observability | Every LLM call will be logged with tokens, cost, and latency (`LlmCall`, Day 5) |
| Locks and constraints | The agent's `book_shipment` tool hits the same database rules as the API |

An AI agent is just another client of your backend — a fast, persistent, and sometimes confused one. A backend that is safe under concurrency and retries is a backend that is safe for agents.

## How to work with your agent on this

Agents are good at spotting patterns like N+1. They are also good at confidently claiming improvements that did not happen. Use them to *find* and *propose*; use measurements to *decide*.

::: agent
Use the database-query tool and the code in ShipmentController@index and ShipmentResource to find N+1 queries in GET /api/shipments. Tell me how many queries run for a page of 20 shipments and why. Do not change code yet.
:::

::: agent
Write a Pest test that fails if GET /api/shipments runs more than 5 queries for 20 shipments. Use DB::enableQueryLog() or an equivalent you can confirm exists in Laravel 12. Then fix the N+1 and show the test passing.
:::

::: agent
Implement the AssignVehicleJob described in docs/plans/day3-async.md. Use a transaction with lockForUpdate on both the shipment and the vehicle. The job must be safe to run twice. Write a test that runs the job twice and asserts exactly one vehicle is busy and one assigned event exists.
:::

To verify performance claims:

::: agent
You said caching cities makes GET /api/cities faster. Give me the exact k6 command to measure it before and after, and the metric I should compare. Do not estimate the improvement; I will run it.
:::

## Common pitfalls

- **Accepting "this is now 10x faster" without a measurement.** The agent cannot measure your laptop. You can.
- **Dispatching jobs inside a transaction** and having workers run before the commit.
- **Jobs that are not safe to retry.** Always check current state at the start of a job.
- **Long transactions holding locks** while calling slow services (emails, HTTP, LLMs). Lock, change, commit, then do slow work.
- **Caching per-user data under a shared key.** One customer sees another customer's data.
- **Forgetting invalidation.** A cache with no invalidation plan is a future bug.
- **Rate limiting by IP only.** Many users behind one mobile carrier share IPs. Key by user ID when authenticated.
- **Load testing once.** Single runs are noise.

## Key takeaways

- Keep app servers stateless; scale them horizontally; protect the database.
- Find N+1 with query counts and fix with eager loading. Confirm slow queries with `EXPLAIN ANALYZE`.
- Move slow work to queues via events and jobs; separate queues by priority; write jobs that are safe to run twice.
- Prevent double booking with layers: idempotency keys, unique constraints, transactions, and row locks.
- Cache what changes rarely and is safe to be stale; always have an invalidation plan.
- Rate limit per user; the agent endpoint gets a stricter limit.
- Observe with structured logs, request IDs, and dashboards.
- Measure with k6 and percentiles. The agent proposes; numbers decide.

## Self-check questions

1. What does "stateless app server" mean, and why does it make horizontal scaling easy?
2. A page of 50 shipments shows origin and destination city names. How many queries run with and without eager loading?
3. Why should `SendBookingConfirmationJob` not run inside the booking request?
4. Why must queued jobs be safe to run more than once?
5. Explain how `lockForUpdate()` prevents two jobs from assigning the same vehicle.
6. A client retries `POST /shipments` with the same `Idempotency-Key` and the same body. What should the server return?
7. Same key, different body. What should happen and why?
8. Give one thing that is good to cache in Shahna and one that is dangerous to cache.
9. Why is p95 latency more useful than average latency?
10. The agent claims a change made an endpoint "much faster". What do you do?

### Answers

1. The server keeps no important state between requests; sessions, cache, and data live in Redis and PostgreSQL. Any server can handle any request, so you add servers behind a load balancer to handle more traffic.
2. Without eager loading: 1 + 50 + 50 = 101 queries. With `with(['origin', 'destination'])`: 3 queries.
3. Sending email depends on an external service that can be slow or fail; the customer should not wait for it or see an error because of it.
4. Queues deliver at least once; a job can be retried after a timeout or crash even if it partly ran.
5. It locks the selected vehicle row inside a transaction. A second transaction trying to lock the same row waits until the first commits, then sees the vehicle is already busy and skips it.
6. The stored response from the first request (same status and body, plus the `Idempotent-Replayed: true` header), without creating a new shipment. If the first request is still running, it gets 409 instead.
7. Reject it (422 in our design), because reusing a key for a different request is a client bug and returning the old response would be misleading.
8. Good: the city list or distances (rarely change, harmless if briefly stale). Dangerous: vehicle availability during assignment, or per-user data under a shared key.
9. The average hides slow outliers; p95 shows the experience of the slowest 5% of requests, which real customers feel.
10. Ask for the exact measurement method, run a before/after k6 test yourself (at least twice), and accept the claim only if the numbers support it.
