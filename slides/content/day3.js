// Day 3 — Making It Scale. Slide types are defined in ../build.js.
module.exports = {
  title: "Making It Scale",
  ar: "بناء أنظمة قابلة للتوسع",
  coverNotes: "Welcome to Day 3. Yesterday we built a correct booking API. Today we make it survive real traffic: many users, slow work, retries and double taps. The rule for the whole day: measure before and after. Every claim, yours or the agent's, needs a number.",
  objectives: [
    "Find the usual bottlenecks: **N+1**, missing indexes, sync work in requests",
    "Move slow work to **queues**, **jobs** and **events** with Horizon",
    "**Cache** correctly: what, where, for how long, and how to invalidate",
    "Prevent double booking: **idempotency keys**, unique constraints, row locks",
    "**Rate limit** and **observe**: structured logs, request IDs, query counts, Horizon",
    "Load-test with **k6** and verify the agent's claims with numbers",
  ],
  body: [
    // ---------------- Session A ----------------
    {
      type: "divider", num: "01", kicker: "Session A · 09:30–10:45", section: "Session A",
      title: "Scale is a **design** choice", ar: "التوسع قرار تصميمي",
      topics: ["Stateless servers", "Horizontal scaling", "The database bottleneck", "Queues & events", "Race conditions", "Idempotency"],
      notes: "Session A is about architecture and correctness under load. Scaling is not only 'faster code'; it is where state lives, what runs in the request, and what happens when two requests arrive at the same moment.",
    },
    {
      type: "bullets", title: "The scalability mental model", ar: "النموذج الذهني للتوسع",
      bullets: [
        "App servers are **stateless**: any request can go to any server",
        "Scale **out** by adding servers behind a load balancer",
        "Shared state lives in **PostgreSQL** and **Redis**, never in server memory",
        "The **database** is usually the first bottleneck, not PHP",
        "Slow or unreliable work leaves the request and goes to a **queue**",
      ],
      side: { kicker: "Key idea", big: "Stateless app, shared state", bigSize: 32, text: "If a server dies mid-request, nothing is lost: the next server picks up from **Postgres** and **Redis**." },
      notes: "Ask: where does a Laravel session live by default? In files on one server, which breaks with two servers. That is why Shahna uses Sanctum tokens, Redis for cache and queues, and Postgres as the source of truth. Once the app is stateless, scaling the web tier is easy; the database is what you must protect.",
    },
    {
      type: "diagram", title: "Horizontal scaling", ar: "التوسع الأفقي",
      zones: [{ x: 5.25, y: 0.0, w: 2.7, h: 3.75, label: "STATELESS · ADD MORE" }],
      nodes: [
        { id: "cli", x: 0, y: 1.5, w: 1.8, h: 1.0, label: "Clients", sub: "mobile · web · k6", style: "card" },
        { id: "lb", x: 2.5, y: 1.5, w: 2.0, h: 1.0, label: "Load balancer", sub: "spreads requests", style: "orange" },
        { id: "a1", x: 5.45, y: 0.45, w: 2.3, h: 0.85, label: "App server 1", sub: "Laravel", style: "light", fontSize: 14 },
        { id: "a2", x: 5.45, y: 1.58, w: 2.3, h: 0.85, label: "App server 2", sub: "Laravel", style: "light", fontSize: 14 },
        { id: "a3", x: 5.45, y: 2.71, w: 2.3, h: 0.85, label: "App server N", sub: "Laravel", style: "light", fontSize: 14 },
        { id: "pg", x: 9.0, y: 0.55, w: 3.13, h: 1.1, label: "PostgreSQL 16", sub: "source of truth", style: "dark" },
        { id: "rd", x: 9.0, y: 2.3, w: 3.13, h: 1.1, label: "Redis 7", sub: "cache · queues · rate limits", style: "dark" },
      ],
      edges: [
        { from: "cli", to: "lb" },
        { from: "lb", to: "a1" }, { from: "lb", to: "a2" }, { from: "lb", to: "a3" },
        { from: "a1", to: "pg" }, { from: "a2", to: "pg" }, { from: "a2", to: "rd" }, { from: "a3", to: "rd" },
      ],
      caption: "Adding app servers is cheap. Every one of them talks to the **same** database, so that is where load piles up.",
      notes: "Walk left to right. The load balancer can send a user's next request to any server, so nothing user-specific may live on a server's disk or memory. Then point at the right side: ten app servers means ten times the connections and queries hitting one Postgres. That is why the rest of the morning is about doing less work per request.",
    },
    {
      type: "cards", title: "Where Shahna slows down", ar: "أين يتباطأ نظام شحنة", cols: 2,
      cards: [
        { h: "N+1 queries", d: "`GET /shipments` loads a page of 15, then 3 extra queries **per row** for origin, destination and vehicle." },
        { h: "Missing indexes", d: "Finding a free truck filters `vehicles` by city, type and status: without an index, a full scan per booking." },
        { h: "Sync work in the request", d: "Assigning a vehicle and sending the confirmation while the customer waits." },
        { h: "Race conditions", d: "A double tap books the **same quote** twice; two workers grab the **same truck**." },
      ],
      notes: "All four exist in the day2-end code, and today's lab fixes them: eager loading, a vehicles index on (current_city_id, type, status), queued jobs, and locks plus idempotency keys. Three are speed problems, the fourth is a correctness problem that only appears under concurrency, which is why tests on a laptop rarely catch it.",
    },
    {
      type: "compare", title: "Booking: sync vs async", ar: "الحجز: متزامن أم غير متزامن",
      left: { h: "Everything in the request", items: ["Insert shipment, find a vehicle, send email", "Customer waits for all of it", "Mail server down → booking fails", "No retries, no visibility"] },
      right: { h: "Return fast, work on queues", items: ["Insert shipment, fire `ShipmentBooked`", "Respond **201** with status `confirmed`", "Vehicle assignment on the `dispatch` queue", "Email on the `notifications` queue", "Retries and a Horizon dashboard"] },
      notes: "The customer only needs to know the booking is recorded. Everything else can happen a second later on a worker. Ask: what is the shipment status right after the 201? Confirmed: the tracking timeline already shows 'Booking received.' then 'Booking confirmed.'. When AssignVehicleJob finishes, it moves to assigned with an event like 'Vehicle 5-1000 assigned.'.",
    },
    {
      type: "diagram", title: "Queues, events and workers", ar: "الطوابير والأحداث والعمّال",
      zones: [{ x: 7.85, y: 0.0, w: 2.2, h: 4.0, label: "REDIS QUEUES" }],
      nodes: [
        { id: "req", x: 0, y: 1.45, w: 1.9, h: 1.1, label: "POST /shipments", sub: "201, fast", style: "card", fontSize: 14 },
        { id: "evt", x: 2.55, y: 1.45, w: 2.0, h: 1.1, label: "ShipmentBooked", sub: "event", style: "orange", fontSize: 14 },
        { id: "lst", x: 5.2, y: 1.45, w: 2.1, h: 1.1, label: "QueueBookingJobs", sub: "listener", style: "light", fontSize: 13 },
        { id: "qd", x: 8.05, y: 0.45, w: 1.8, h: 0.62, label: "dispatch", style: "dark", fontSize: 13 },
        { id: "qn", x: 8.05, y: 1.3, w: 1.8, h: 0.62, label: "notifications", style: "dark", fontSize: 13 },
        { id: "qx", x: 8.05, y: 2.15, w: 1.8, h: 0.62, label: "default", style: "dark", fontSize: 13 },
        { id: "qa", x: 8.05, y: 3.0, w: 1.8, h: 0.62, label: "ai", style: "dark", fontSize: 13 },
        { id: "hz", x: 10.5, y: 0.45, w: 1.63, h: 2.32, label: "supervisor-1", sub: "Horizon · auto-balanced · 3 tries", style: "orange", fontSize: 13 },
        { id: "hza", x: 10.5, y: 3.0, w: 1.63, h: 0.62, label: "supervisor-ai", sub: "timeout 180 s", style: "orange", fontSize: 12, subSize: 10 },
      ],
      edges: [
        { from: "req", to: "evt" }, { from: "evt", to: "lst" },
        { from: "lst", to: "qd" }, { from: "lst", to: "qn" },
        { from: "qd", to: "hz" }, { from: "qn", to: "hz" }, { from: "qx", to: "hz" }, { from: "qa", to: "hza" },
      ],
      caption: "`AssignVehicleJob` → **dispatch** · `SendBookingConfirmationJob` → **notifications** · **ai** is for agent work on Day 4–5",
      notes: "BookingService::book fires one event and the controller returns. The QueueBookingJobs listener turns the event into jobs; each job picks its own queue in its constructor. In config/horizon.php, supervisor-1 works dispatch, notifications and default with auto-balancing, and supervisor-ai has its own worker with a 180-second timeout, so slow LLM calls on Day 4 and 5 never block truck assignment. Show the Horizon dashboard live after this slide.",
    },
    {
      type: "code", title: "Events decouple the request", ar: "الأحداث تفصل العمل عن الطلب", file: "app/Events/ShipmentBooked.php · app/Listeners/QueueBookingJobs.php", fontSize: 11,
      code: `class ShipmentBooked implements ShouldDispatchAfterCommit
{
    use Dispatchable, SerializesModels;

    public function __construct(public Shipment $shipment) {}
}

class QueueBookingJobs
{
    public function handle(ShipmentBooked $event): void
    {
        AssignVehicleJob::dispatch($event->shipment);           // 'dispatch'
        SendBookingConfirmationJob::dispatch($event->shipment); // 'notifications'
    }
}

// BookingService::book(), inside the transaction:
ShipmentBooked::dispatch($shipment);

// Each job picks its queue in its constructor:
// $this->onQueue('dispatch');`,
      hl: [1, 18],
      points: [
        "The service does not know which jobs exist",
        "New side effect later? Add a listener, not an `if`",
        "Jobs get the model by ID, re-fetched fresh on the worker",
        "`ShouldDispatchAfterCommit`: fired only once the booking commits",
      ],
      notes: "SerializesModels stores only the shipment ID in the queue payload and reloads it on the worker, so the job sees current data. The event is dispatched inside BookingService's transaction, but ShouldDispatchAfterCommit holds it until the commit: if the transaction rolls back, no worker ever looks for a shipment that never existed.",
    },
    {
      type: "code", title: "AssignVehicleJob: lock, then assign", ar: "مهمة تعيين المركبة: اقفل ثم عيّن", file: "app/Jobs/AssignVehicleJob.php", fontSize: 10.5,
      code: `public function handle(BookingService $booking): void
{
    DB::transaction(function () use ($booking) {
        $shipment = Shipment::lockForUpdate()->find($this->shipment->id);
        if ($shipment->status !== ShipmentStatus::Confirmed) {
            return;                       // already handled: safe to retry
        }

        $vehicle = Vehicle::where('status', VehicleStatus::Available)
            ->where('type', $shipment->vehicle_type)
            ->where('current_city_id', $shipment->origin_city_id)
            ->where('capacity_kg', '>=', $shipment->weight_kg)
            ->orderBy('capacity_kg')
            ->lockForUpdate()             // SELECT ... FOR UPDATE
            ->first();
        if (! $vehicle) {
            Log::warning('No vehicle available, waiting for a dispatcher.');
            return;
        }

        $booking->assign($shipment, $vehicle, "Vehicle {$vehicle->plate} assigned.");
    });
}`,
      hl: [4, 14],
      points: [
        "Two workers, one free truck: the lock makes the second **wait**",
        "Status check first: a retried job does nothing twice",
        "Smallest truck that fits: `orderBy('capacity_kg')`",
        "No vehicle? Log it; a dispatcher assigns one manually",
      ],
      notes: "Without lockForUpdate, two workers can both read the same available truck and both assign it. The row lock serializes them: the second worker blocks until the first commits, then sees the truck is busy. BookingService::assign locks both rows again and re-checks them, because the dispatcher override POST /api/dispatch/shipments/{reference}/assign uses the same method. If no truck fits, the shipment stays confirmed and a dispatcher assigns one. Stretch idea for strong teams: skipLocked() so workers pick different trucks instead of waiting.",
    },
    {
      type: "sequence", title: "The double-booking race", ar: "سباق الحجز المزدوج",
      actors: ["Phone (double tap)", "Request A", "PostgreSQL", "Request B"], highlight: 2,
      msgs: [
        { from: 0, to: 1, label: "POST /shipments · quote 42" },
        { from: 0, to: 3, label: "POST /shipments · quote 42 (again)" },
        { from: 1, to: 2, label: "is quote 42 used? → no" },
        { from: 3, to: 2, label: "is quote 42 used? → no" },
        { from: 1, to: 2, label: "INSERT shipment ✓" },
        { from: 3, to: 2, label: "INSERT shipment ✓" },
        { from: 2, to: 2, label: "two shipments, one quote, one customer charged twice" },
      ],
      caption: "Naive check-then-insert is **not atomic**. Both checks pass before either insert happens.",
      notes: "Act this out with two volunteers. Each asks the database 'is this quote used?', both hear 'no', both insert. Any code of the shape 'if not exists then create' has this race. On a slow mobile network, double taps and automatic retries make it common, not rare. In Shahna, BookingService::book closes the gap: it locks the quote row with lockForUpdate inside a transaction, so request B waits, then sees the shipment and gets a 422 'This quote has already been booked.'. The UNIQUE on quote_id is the backstop.",
    },
    {
      type: "cards", title: "Three layers against double booking", ar: "ثلاث طبقات ضد الحجز المزدوج",
      cards: [
        { h: "Database constraint", d: "`UNIQUE(quote_id)` on shipments. The last line of defence: the second insert **fails**, always." },
        { h: "Idempotency key", d: "The client sends `Idempotency-Key`. A retry gets the **same** 201 again, not a 422 or a duplicate." },
        { h: "Row locks", d: "`lockForUpdate()` inside a transaction: the **quote** row while booking, **vehicle** rows while assigning." },
      ],
      highlight: 1,
      caption: "Constraints keep data correct. Idempotency keeps the **client experience** correct.",
      notes: "The unique constraint and the quote lock already stop the duplicate shipment, but without idempotency the retry gets a 422 'This quote has already been booked.' even though the customer's booking succeeded. Idempotency turns that into a clean replay of the first 201. Locks protect shared rows that many requests compete for: the quote during booking and trucks during assignment.",
    },
    {
      type: "flow", title: "Idempotency-Key, step by step", ar: "مفتاح عدم التكرار خطوة بخطوة",
      steps: [
        { h: "Client", d: "sends a UUID in Idempotency-Key" },
        { h: "Claim", d: "createOrFirst on (user_id, key)" },
        { h: "Seen it?", d: "replay stored status + body" },
        { h: "New key", d: "run the controller" },
        { h: "Store", d: "status + body · expires in 1 day" },
      ],
      highlight: 2,
      bullets: [
        "Missing key → `400` · same key, **different body** → `422` · first call still running → `409`",
        "Replays carry `Idempotent-Replayed: true` · a `5xx` deletes the key so the client can retry",
      ],
      notes: "The client generates one UUID per booking attempt and reuses it on every retry of that attempt. The server stores the first response and replays it. We hash method, path and body so a client cannot reuse a key for a different booking. Two simultaneous first requests are caught by the unique (user_id, key) index: createOrFirst gives the second one the existing row, which has no response yet, so it gets a 409. A record stuck in flight for over 60 seconds is treated as abandoned and reclaimed.",
    },
    {
      type: "code", title: "The Idempotency-Key middleware", ar: "وسيط مفتاح عدم التكرار", file: "app/Http/Middleware/EnsureIdempotency.php", fontSize: 10,
      code: `$key = $request->header('Idempotency-Key');
if (! $key || strlen($key) > 255) {
    return response()->json(['message' => '...is required.'], 400);
}
$hash = hash('sha256', $request->method().$request->path().$request->getContent());
$record = $this->claim($request->user()->id, $key, $hash);   // createOrFirst

if (! $record->wasRecentlyCreated) {
    if ($record->request_hash !== $hash) return response()->json([...], 422);
    if ($record->response_status === null) return response()->json([...], 409);

    return response($record->response_body, $record->response_status)
        ->header('Content-Type', 'application/json')
        ->header('Idempotent-Replayed', 'true');
}

$response = $next($request);
$response->getStatusCode() >= 500
    ? $record->delete()                        // let the client retry
    : $record->update(['response_status' => $response->getStatusCode(),
                       'response_body' => $response->getContent()]);
return $response;`,
      hl: [6, 14],
      points: [
        "Scoped per **user**: keys never leak across accounts",
        "Replays the stored response, flagged `Idempotent-Replayed`",
        "Keys expire after 1 day; `model:prune` runs daily",
        "Alias `idempotent`, applied only to `POST /shipments`",
      ],
      notes: "Read it top to bottom: require the key, claim it, and either replay, reject, or run the request and store the result. The claim uses createOrFirst on the unique (user_id, key) index, so if two first requests race, exactly one creates the row; the other sees a row with no response yet and gets a 409. 4xx responses such as a 422 are stored and replayed too, because they are final; only 5xx deletes the key. IdempotencyKey uses MassPrunable, and routes/console.php schedules model:prune daily.",
    },
    {
      type: "prompt", title: "Ask your agent: find the race", mode: "plan mode",
      prompt: `Read BookingService::book() and AssignVehicleJob.

1. Two requests with the same quote_id arrive at once. Walk through what each one does, step by step.
2. Do the same for two workers and one available vehicle.
3. For each race, propose a fix at the **database**, **app** and **HTTP** level, and say which one is the real guarantee.
4. Write a failing Pest test for the first race. Do not fix it yet.`,
      why: [
        "Forces step-by-step reasoning about **concurrency**",
        "Asks for layered fixes, then a judgement",
        "Failing test **first** proves the bug exists",
        "Plan mode: no edits until you agree",
      ],
      notes: "Agents are good at listing race conditions when asked directly, and bad at noticing them unprompted. Check its answer: the real guarantee is the database constraint and the row lock, not an if-statement in PHP. Testing true concurrency in Pest is hard; accept a test that replays the same Idempotency-Key and asserts one shipment.",
    },
    {
      type: "lab", part: 1, name: "Ship it async", ar: "المختبر الثالث: المعالجة غير المتزامنة", time: "11:00–12:30", tag: "day3-end",
      goal: "Move slow work to queues and make booking safe to retry, with tests that prove it.",
      steps: [
        "Check out `day2-end`, start Sail and `sail artisan horizon`",
        "Plan `docs/plans/day3-async.md` with the agent in plan mode",
        "`ShipmentBooked` + `QueueBookingJobs`; `AssignVehicleJob` with a lock",
        "`SendBookingConfirmationJob` on `notifications`",
        "`idempotency_keys` migration + `EnsureIdempotency` middleware",
        "Pest: `Queue::fake()`; replayed key → same shipment",
      ],
      done: "no key → `400`, same key twice → one shipment and `Idempotent-Replayed: true`, Horizon shows jobs on both queues.",
      notes: "Check that Horizon is running in every team; a missing worker is the most common reason for 'my job never ran'. Check the event implements ShouldDispatchAfterCommit, so it only fires once the booking commits. Strong teams can add skipLocked() and a test for no available vehicle. The day3-end tag has 80 passing tests.",
    },

    // ---------------- Session B ----------------
    {
      type: "divider", num: "02", kicker: "Session B · 13:30–14:15", section: "Session B",
      title: "Measure, **then** optimise", ar: "قِس أولاً ثم حسِّن",
      topics: ["Caching strategies", "Rate limiting", "Observability", "k6 reports", "Agent as profiler", "Verify with numbers"],
      notes: "Session B is about evidence. Caching, rate limits and logs are tools, but the habit we want is: take a baseline, change one thing, measure again. That applies doubly when the agent proposes the change.",
    },
    {
      type: "table", title: "What to cache, and for how long", ar: "ماذا نخزّن مؤقتاً ولأي مدة",
      head: ["Data", "Cache?", "Where / TTL", "Invalidate when"],
      colW: [2.9, 1.6, 3.2, 4.43], fontSize: 16,
      rows: [
        ["Cities list", "Yes", "Redis · 1 day", "any city saved or deleted → `Cache::forget`"],
        ["City distances", "Yes", "Redis · 1 week, per pair", "road distances never change"],
        ["Quote price", "No", "computed per request", "cheap and must be exact"],
        ["My shipments list", "No", "personal, changes often", "stale data confuses users"],
        ["Policy answers (Day 5)", "Yes", "Redis · 24 h", "TTL; prompt version in the key"],
      ],
      caption: "Cache data that is **read often, changes rarely, and is the same for everyone**.",
      notes: "Go row by row and ask the room before revealing the answer. The dangerous one is personal data: cache a user's shipments under a shared key and one customer sees another's bookings. If you do cache per user, the user ID must be in the key. Every cache needs an invalidation story before it ships.",
    },
    {
      type: "code", title: "Cache::remember, with an exit plan", ar: "التخزين المؤقت مع خطة إبطال", file: "Api/CityController.php · Models/City.php · Services/PricingService.php", fontSize: 11,
      code: `// CityController::index()
$cities = Cache::remember(City::CACHE_KEY, now()->addDay(),
    fn () => City::orderBy('name_en')->get());
return CityResource::collection($cities);

// City::booted(): any change clears the cache
static::saved(fn () => Cache::forget(self::CACHE_KEY));
static::deleted(fn () => Cache::forget(self::CACHE_KEY));

// PricingService::distanceKm()
if ($originCityId === $destinationCityId) {
    return 0;
}
return Cache::remember("distance:{$originCityId}:{$destinationCityId}",
    now()->addWeek(),
    fn () => CityDistance::where('from_city_id', $originCityId)
        ->where('to_city_id', $destinationCityId)
        ->valueOrFail('km'));`,
      hl: [2, 7],
      points: [
        "One constant for the key: `City::CACHE_KEY`",
        "Invalidate where the data **changes**: model events",
        "Same city = 0 km, never a cache entry",
        "A test proves the 2nd `/cities` call runs **0** queries",
      ],
      notes: "Cache::remember reads, and on a miss runs the closure and stores the result. The invalidation lives on the model, so any code path that saves or deletes a city clears the cache, including seeders and tinker. Distances get a week because roads do not move. PerformanceTest checks both: the second GET /api/cities runs zero queries, and renaming a city shows up immediately.",
    },
    {
      type: "code", title: "Fixing the N+1 in GET /shipments", ar: "إصلاح مشكلة N+1 في قائمة الشحنات", file: "app/Http/Controllers/Api/ShipmentController.php · tests/Feature/PerformanceTest.php", fontSize: 11,
      code: `// Before (day2-end): + 3 queries for every row on the page
$shipments = $request->user()->shipments()->latest()->paginate(15);

// After (day3-end): the same count for 2 rows or 15
$shipments = $request->user()->shipments()
    ->with(['origin', 'destination', 'vehicle'])
    ->latest()
    ->paginate(15);

return ShipmentResource::collection($shipments);

// The test that keeps it fixed
$few  = countQueries(fn () => $this->getJson('/api/shipments'));
Shipment::factory()->count(10)->for($user)->create();
$many = countQueries(fn () => $this->getJson('/api/shipments'));
expect($many)->toBe($few);`,
      hl: [6, 16],
      points: [
        "The resource touches 3 relations per row: that is the N",
        "`with()` loads each relation in **one** query",
        "The test counts queries with `DB::enableQueryLog()`",
        "More rows, same number of queries: no N+1",
      ],
      notes: "Run the query count on the day2-end version: every extra shipment adds three queries. Then add with() and the count stays flat. N+1 is the most common performance bug in ORMs, and agents both create and fix it. The PerformanceTest guard fails if anyone reintroduces it. Telescope shows the same thing visually if you choose to install it; it is not part of the repo.",
    },
    {
      type: "code", title: "Rate limits: 60 requests a minute", ar: "تحديد المعدل: ٦٠ طلباً في الدقيقة", file: "app/Providers/AppServiceProvider.php · bootstrap/app.php", fontSize: 11,
      code: `// AppServiceProvider::boot()
RateLimiter::for('api', function (Request $request) {
    return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
});

// bootstrap/app.php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->prepend(AssignRequestId::class);
    $middleware->throttleApi();          // 'api' limiter on every /api route
    $middleware->alias(['idempotent' => EnsureIdempotency::class]);
})

// Day 5 adds RateLimiter::for('agent', ...) at 10/min
// and ->middleware('throttle:agent') on POST /agent/chat`,
      hl: [3, 9],
      points: [
        "Limit **per user**, fall back to IP for guests",
        "Request 61 in a minute → `429` + `Retry-After`",
        "Counters live in Redis, shared by all servers",
        "Day 5: a lower `agent` limit, because LLM calls cost money",
      ],
      notes: "Rate limits protect the database and, from Day 4, the LLM bill. Counters must be in Redis so the limit holds across all app servers. throttleApi() applies the api limiter to every API route. Demo with a quick loop of curl requests and show the 429 and Retry-After header; PerformanceTest asserts that request 61 gets a 429. The k6 script registers one account per virtual user and sleeps between iterations, so the test itself stays under the limit.",
    },
    {
      type: "cards", title: "Observability: see what production does", ar: "المراقبة: انظر ماذا يحدث في الإنتاج", cols: 2,
      cards: [
        { h: "Structured logs", d: "`Log::warning('No vehicle available...', ['shipment' => $ref])`: a fixed message plus fields you can search." },
        { h: "Request IDs", d: "`AssignRequestId` reads or creates `X-Request-Id`, calls `Log::shareContext()` and returns the header." },
        { h: "Query counts", d: "`DB::enableQueryLog()` in `PerformanceTest`. Your N+1 detector, run on every test run." },
        { h: "Horizon", d: "Queue throughput, wait times, retries and failed jobs; metrics from `horizon:snapshot` every 5 min." },
      ],
      notes: "Logs are only useful if you can search them. Use a stable message and context fields instead of interpolated sentences. The request ID ties together every log line for one request, and the client can send its own X-Request-Id to correlate with its logs. Telescope and Pulse are good optional add-ons, Telescope locally and Pulse in production; they are not installed in the repo.",
    },
    {
      type: "code", title: "A k6 load test for booking", ar: "اختبار حمل للحجز باستخدام k6", file: "load/booking.js", fontSize: 10,
      code: `export const options = {
  stages: [
    { duration: '20s', target: Number(__ENV.VUS || 20) }, // ramp up
    { duration: '1m', target: Number(__ENV.VUS || 20) },  // hold
    { duration: '10s', target: 0 },                       // ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:list}': ['p(95)<300'],
    'http_req_duration{name:book}': ['p(95)<500'],
  },
};

export default function (data) {
  if (!token) token = register();      // one account per virtual user
  const quote = http.post(\`\${BASE_URL}/api/quotes\`, ...);
  const params = json(token);
  params.headers['Idempotency-Key'] = uuidv4();
  params.tags = { name: 'book' };
  http.post(\`\${BASE_URL}/api/shipments\`, ..., params);
  http.get(\`\${BASE_URL}/api/shipments\`, { ...json(token), tags: { name: 'list' } });
  sleep(3);                            // stays under 60 requests/minute
}`,
      hl: [9, 18],
      points: [
        "Ramp to `VUS` users (default 20), hold for a minute",
        "**Thresholds**: < 1% failed, list p95 < 300 ms, book p95 < 500 ms",
        "Own account per user, a fresh key per booking",
        "`k6 run -e VUS=50 load/booking.js`",
      ],
      notes: "Walk through the stages and thresholds. Each virtual user registers its own account once, then loops: quote, book with a fresh Idempotency-Key, list its shipments, sleep three seconds. Tags give separate p95 numbers for the list and book requests. Because every virtual user has its own account and sleeps, the per-user 60-per-minute limit is not hit by the test itself. BASE_URL defaults to http://localhost.",
    },
    {
      type: "stats", title: "Reading a k6 report", ar: "قراءة تقرير k6",
      stats: [
        { n: "p95", l: "95% of requests were faster than this. Watch it, not the **average**, which hides slow users." },
        { n: "req/s", l: "Throughput the system **sustained** at a given number of virtual users." },
        { n: "failed", size: 48, l: "`http_req_failed` rate. 429s and 500s land here: a fast error is still an error." },
      ],
      caption: "Same machine, same data, same script, at least 3 runs. Otherwise the comparison means nothing.",
      notes: "Show a real k6 summary on screen and find these three lines together. Explain percentiles with a queue at a bakery: the average wait looks fine while one in twenty people waits five minutes. Noise is large on laptops, so repeat runs and compare medians of runs.",
    },
    {
      type: "table", title: "Before and after: an example run", ar: "قبل وبعد: مثال من تشغيل فعلي",
      head: ["Metric", "day2-end", "day3-end", "What changed"],
      colW: [3.9, 1.7, 1.7, 4.83], fontSize: 16,
      rows: [
        ["GET /shipments p95", "840 ms", "120 ms", "eager loading"],
        ["Queries per list request", "+3 per row", "fixed", "N+1 removed"],
        ["POST /shipments p95", "1.9 s", "180 ms", "assignment + email moved to queues"],
        ["Retried booking", "422 already booked", "same 201, replayed", "idempotency key"],
        ["Error rate at 50 VUs", "4.2%", "0.3%", "fewer slow requests timing out"],
      ],
      caption: "Instructor laptop numbers, for illustration. Your table must contain **your** measurements.",
      notes: "This is the table students fill in during Lab part 2. Be clear these are example numbers from an instructor run; the point is the shape. Some rows will not improve on their machine, and that is fine to report. Honest numbers beat impressive ones.",
    },
    {
      type: "prompt", title: "Ask your agent: profile, then prove it", mode: "default mode",
      prompt: `GET /api/shipments is slow under load.

1. Count the queries for one request (DB::enableQueryLog, like PerformanceTest) and show me the raw numbers.
2. Propose at most 3 fixes, ranked by expected impact.
3. Implement **only the top one**.
4. Re-run \`k6 run load/booking.js\` and give me p95 before and after in a table.
5. If the number did not improve, say so. Do not guess.`,
      why: [
        "Evidence **before** a fix, not after",
        "One change at a time, so the cause is clear",
        "Same script before and after",
        "Explicit permission to report no gain",
      ],
      notes: "The last line matters. Agents tend to report success. By asking for raw numbers and allowing 'it did not help', you get honest output. Check its numbers yourself by re-running k6. If its claimed improvement does not reproduce, that is the lesson of the day.",
    },
    {
      type: "compare", title: "Agent claims vs evidence", ar: "ادعاءات الوكيل مقابل الدليل",
      left: { h: "Claims", items: ["\"This should be much faster\"", "\"I added an index, it is fixed\"", "\"Caching will solve it\"", "\"No N+1 queries remain\""] },
      right: { h: "Evidence", items: ["p95 before and after, same k6 script", "`EXPLAIN ANALYZE` shows an index scan", "Hit rate and a tested invalidation path", "A query-count test that stays flat", "Three runs on the same machine"] },
      notes: "Hold up each claim and ask what evidence would convince you. Teach EXPLAIN ANALYZE briefly: run it in psql on the shipments query and point at Seq Scan versus Index Scan. The right column is the checklist for the lab report.",
    },
    {
      type: "pitfalls",
      items: [
        { p: "Personal data cached under a shared key", fix: "Cache only shared data, or put the user ID **in the key**" },
        { p: "Jobs that are not safe to retry: a retry assigns twice", fix: "Check status first; make every job **idempotent**" },
        { p: "`lockForUpdate()` outside a transaction", fix: "Wrap read + update in `DB::transaction()`" },
        { p: "Dispatching a job before the insert is committed", fix: "`ShouldDispatchAfterCommit` on the event; test with real workers" },
      ],
      notes: "All four appear in agent-written code regularly. Retries are the subtle one: queues deliver at least once, so a job can run twice. That is why AssignVehicleJob re-reads the shipment under a lock and returns unless it is still confirmed. Ask teams to check their own job for this during the lab.",
    },
    {
      type: "statement",
      text: "If you did not **measure** it,\nyou did not **fix** it.",
      ar: "ما لم تقِسه، فأنت لم تُصلحه",
      sub: "Baseline, one change, measure again.",
      notes: "Pause here before the lab. Every performance change in the lab report needs a before and after number, including the ones the agent made.",
    },
    {
      type: "lab", part: 2, name: "Ship it async", ar: "المختبر الثالث: القياس والتحسين", time: "14:15–15:45", tag: "day3-end",
      goal: "Take a baseline, fix the slow paths one at a time, and prove each fix with k6 numbers.",
      steps: [
        "Baseline: `k6 run load/booking.js`, save the summary",
        "Cache cities and distances with `Cache::remember`; clear on change",
        "Fix the N+1 in `GET /shipments`; add a query-count test",
        "Add the `api` 60/min limiter and `X-Request-Id`; test the `429`",
        "Re-run k6 and fill the before/after table with your numbers",
        "Commit, then compare with `git diff day3-end`",
      ],
      done: "real before/after numbers, a flat query count for the list, 80 tests green.",
      notes: "Insist on the baseline first; teams that skip it cannot show improvement. If k6 shows 429s, check the script still registers one account per virtual user and sleeps between iterations. The agent limiter is not today: it arrives on Day 5. Teams behind at 15:40 check out day3-end so tomorrow starts clean. Collect one surprising number per team for the standup.",
    },
  ],
  recap: {
    points: [
      "Stateless app servers scale out; the **database** is the bottleneck",
      "Slow work goes to **queues**; Horizon runs and watches the workers",
      "Double booking: unique constraint + **idempotency key** + row locks",
      "Cache shared, rarely-changing data, with a clear invalidation path",
      "Rate limit per user; log with request IDs; count queries in tests",
      "No number, no fix: verify every claim with k6",
    ],
    question: "A client retries `POST /shipments` with the same Idempotency-Key. What should it get?",
    options: ["A second shipment", "`409 Conflict` every time", "The same response as the first call", "`500` from the unique constraint"],
    notes: "Recap, then the exit ticket. Teaser answer is C: the stored first response is replayed, with the header Idempotent-Replayed: true. A 409 only happens while the first request is still being processed, not every time. Without the key, the retry would get a 422 'already booked', not a 500, because BookingService locks the quote and checks first.",
  },
  next: "**Tomorrow, Day 4:** AI inside the backend. Prism, structured output, tools and the Shahna Assistant. Start from `day3-end`.",
  closingNotes: "Thank everyone. Make sure Horizon and k6 work for every team, and that everyone can check out day3-end. Tomorrow the Shahna Assistant arrives; the ai queue we configured today serves it, and its own rate limiter comes on Day 5.",
};
