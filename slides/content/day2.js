// Day 2 — APIs and Data, Done Right. Slide types are defined in ../build.js.
module.exports = {
  title: "APIs and Data, Done Right",
  ar: "واجهات البرمجة والبيانات بالطريقة الصحيحة",
  coverNotes: "Welcome back. Yesterday we built the Shahna domain: tables, models, enums and a seeder. Today it becomes a real API that customers can use: quotes, bookings, auth and authorization, all driven by tests. We also make the agent write tests first, and we review its code with a checklist.",
  objectives: [
    "Design **REST resources** with the right status codes and response shapes",
    "Validate at the boundary with **FormRequests**; stop mass assignment",
    "Authenticate with **Sanctum** and authorize with **Policies**",
    "Model data in PostgreSQL: keys, constraints, indexes, **decimals for money**",
    "Work test-first with **Pest**: the agent writes the test, then the code",
    "Review AI code with a **checklist**, not a feeling",
  ],
  body: [
    // ---------------- Session A ----------------
    {
      type: "divider", num: "01", kicker: "Session A · 09:30–10:45", section: "Session A",
      title: "Resources, rules and **boundaries**", ar: "الموارد والقواعد والحدود",
      topics: ["REST design", "Status codes", "API Resources", "Pagination", "Validation", "Mass assignment", "Auth vs authz", "Money & time"],
      notes: "Session A is API design. The big idea: the HTTP boundary is where untrusted input enters our system, so we decide carefully what we accept, who may do what, and what shape we send back.",
    },
    {
      type: "bullets", title: "REST: resources, not actions", ar: "REST: موارد لا أفعال",
      bullets: [
        "URLs name **things**: `/quotes`, `/shipments/{reference}`",
        "HTTP methods are the verbs: **GET** reads, **POST** creates or triggers",
        "State changes that are not plain CRUD get a sub-resource: `/shipments/{ref}/cancel`",
        "Use the public **reference** (`SHN-7K2Q9X`) in URLs, not the database id",
        "JSON in, JSON out; one consistent shape for data and errors",
      ],
      side: { kicker: "Key idea", big: "Nouns in the URL, verbs in the method", bigSize: 28, text: "A client developer should guess your next endpoint **before** reading the docs." },
      notes: "Walk the Shahna API table from the spec. Ask: why use the reference in the URL instead of id 42? Sequential ids leak how many shipments we have and invite guessing. Cancel is a POST to a sub-resource because it is a state transition with rules, not an arbitrary update.",
    },
    {
      type: "table", title: "Status codes that tell the truth", ar: "رموز حالة تقول الحقيقة",
      head: ["Code", "Meaning", "Shahna example"],
      colW: [1.3, 3.0, 7.83],
      rows: [
        ["200", "OK", "`GET /api/shipments/SHN-7K2Q9X` returns the shipment"],
        ["201", "Created", "`POST /api/quotes` returns the new quote"],
        ["401", "Unauthenticated", "Missing or invalid bearer token"],
        ["403", "Forbidden", "A customer opens someone else's shipment"],
        ["404", "Not Found", "Unknown reference"],
        ["422", "Unprocessable", "Bad input (`weight_kg`), expired or booked quote (`quote_id`), invalid cancel (`status`)"],
        ["409", "Conflict", "Day 3: the same `Idempotency-Key` is still in flight"],
        ["429", "Too Many Requests", "Rate limit hit (Day 3)"],
      ],
      caption: "Clients and tests depend on these codes. `200` with `{\"error\": …}` inside is a bug.",
      notes: "Each row is a test we will write today. Discuss 403 versus 404 for someone else's shipment: returning 404 hides that the reference exists, which is a valid choice; we use 403 via the policy to keep it simple, and mention the trade-off. Note that Shahna uses 422 for every business-rule rejection today: an expired or already-booked quote is a validation error on quote_id, and an invalid cancel is a validation error on status, both in Laravel's default JSON error shape. The only 409 in the project arrives on Day 3, when a request with the same Idempotency-Key is still being processed.",
    },
    {
      type: "code", title: "Routes: one group, one guard", ar: "المسارات: مجموعة واحدة وحارس واحد", file: "routes/api.php",
      code: `Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);

Route::get('/cities', [CityController::class, 'index']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/quotes', [QuoteController::class, 'store']);

    Route::get('/shipments', [ShipmentController::class, 'index']);
    Route::post('/shipments', [ShipmentController::class, 'store']);
    Route::get('/shipments/{shipment:reference}', [ShipmentController::class, 'show']);
    Route::post('/shipments/{shipment:reference}/cancel', [ShipmentController::class, 'cancel']);
    Route::get('/shipments/{shipment:reference}/tracking', [ShipmentController::class, 'tracking']);
});`,
      hl: [6],
      fontSize: 12,
      notes: "Points: auth:sanctum protects everything except register, login and the public cities list; {shipment:reference} binds by the public reference; a missing shipment is a 404 for free; check with sail artisan route:list --path=api. Every route the spec lists for Day 2, in fifteen lines. Route model binding with :reference means the controller receives a Shipment model already loaded, or Laravel returns 404. Ask the agent to generate this from the spec table, then compare it line by line against the spec.",
    },
    {
      type: "code", title: "API Resources shape the response", ar: "موارد API تحدد شكل الاستجابة", file: "app/Http/Resources/QuoteResource.php",
      code: `class QuoteResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'origin' => new CityResource($this->origin),
            'destination' => new CityResource($this->destination),
            'vehicle_type' => $this->vehicle_type,
            'weight_kg' => $this->weight_kg,
            'price_lyd' => $this->price_lyd,   // "322.00" as a string
            'expires_at' => $this->expires_at,
        ];
    }
}`,
      hl: [11],
      points: [
        "A **whitelist** of fields: nothing leaks by accident",
        "Wrapped in `data`; collections get pagination `links` and `meta`",
        "New model → **201** automatically",
        "Money as a string keeps every decimal exact",
      ],
      notes: "Never return Eloquent models directly from an API: a new column such as an internal note would leak the day someone adds it. Resources are the contract, and they nest: origin and destination are CityResources with id, code, name_en and name_ar. Show ShipmentResource::collection($request->user()->shipments()->latest()->paginate(15)) and the links and meta block it produces.",
    },
    {
      type: "code", title: "Validate at the boundary", ar: "التحقق عند الحدود", file: "app/Http/Requests/StoreQuoteRequest.php",
      code: `class StoreQuoteRequest extends FormRequest
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

// app/Http/Controllers/Api/QuoteController.php
public function store(StoreQuoteRequest $request, PricingService $pricing)
{
    $quote = $pricing->createQuote($request->user(),
        $request->integer('origin_city_id'), $request->integer('destination_city_id'),
        $request->enum('vehicle_type', VehicleType::class), $request->integer('weight_kg'));

    return new QuoteResource($quote);
}`,
      hl: [15],
      fontSize: 10.5,
      notes: "Points: invalid input never reaches the controller, the client gets 422 with errors; Rule::enum ties validation to the VehicleType enum; weight is capped at 25000 kg; the controller reads typed, validated values, never all(); price and expiry are computed on the server. Type-hint the FormRequest and Laravel validates before your method runs. The controller is three lines: validated data in, service call, resource out. The service, injected by the container, owns the business rule. Point out that the client never sends a price.",
    },
    {
      type: "compare", title: "Mass assignment: who decides the fields?", ar: "الإسناد الجماعي: من يحدد الحقول؟",
      left: { h: "Trust the request", items: ["`Quote::create($request->all())`", "Client sends `price_lyd: 0.01`", "Client sends another customer's `user_id`", "`$guarded = []` on every model"] },
      right: { h: "Trust validated data only", items: ["`$request->validated()`, nothing else", "Server sets `user_id`, `price_lyd`, `expires_at`", "Explicit `$fillable` on models", "A rule for **every** accepted field"] },
      notes: "Demo the attack: post a quote with price_lyd 0.01 to a controller that uses request all. Then fix it. Agents often write $request->all() or unguard models because it is shorter, so this is a top item on our review checklist. Real example from Shahna: role is deliberately not in User's $fillable, so AuthController::register sets $user->role = UserRole::Customer explicitly. A client cannot register itself as an admin, and the register response returns role customer.",
    },
    {
      type: "diagram", title: "Authentication vs authorization", ar: "المصادقة مقابل التفويض",
      nodes: [
        { id: "req", x: 0, y: 0.6, w: 1.75, h: 1.1, label: "Request", sub: "Bearer token", style: "card", fontSize: 14 },
        { id: "auth", x: 2.08, y: 0.6, w: 1.75, h: 1.1, label: "auth:sanctum", sub: "who are you?", style: "dark", fontSize: 14 },
        { id: "val", x: 4.16, y: 0.6, w: 1.75, h: 1.1, label: "FormRequest", sub: "is input valid?", style: "light", fontSize: 14 },
        { id: "pol", x: 6.24, y: 0.6, w: 1.75, h: 1.1, label: "Policy", sub: "may you do it?", style: "orange", fontSize: 14 },
        { id: "ctl", x: 8.32, y: 0.6, w: 1.75, h: 1.1, label: "Controller", sub: "do the work", style: "light", fontSize: 14 },
        { id: "res", x: 10.38, y: 0.6, w: 1.75, h: 1.1, label: "Resource", sub: "200 / 201", style: "light", fontSize: 14 },
        { id: "e401", x: 2.08, y: 2.75, w: 1.75, h: 0.8, label: "401", sub: "Unauthenticated", style: "ghost", fontSize: 16 },
        { id: "e422", x: 4.16, y: 2.75, w: 1.75, h: 0.8, label: "422", sub: "Validation errors", style: "ghost", fontSize: 16 },
        { id: "e403", x: 6.24, y: 2.75, w: 1.75, h: 0.8, label: "403", sub: "Forbidden", style: "ghost", fontSize: 16 },
      ],
      edges: [
        { from: "req", to: "auth" }, { from: "auth", to: "val" }, { from: "val", to: "pol" }, { from: "pol", to: "ctl" }, { from: "ctl", to: "res" },
        { from: "auth", to: "e401", label: "no token", dashed: true },
        { from: "val", to: "e422", label: "invalid", dashed: true },
        { from: "pol", to: "e403", label: "not allowed", dashed: true },
      ],
      caption: "**Authentication** proves identity. **Authorization** decides permission, per action, per record.",
      notes: "Trace three failing requests: no token stops at Sanctum with 401; a negative weight stops at the FormRequest with 422; a customer viewing another customer's shipment stops at the policy with 403. Each early exit is a feature test. Note that the policy check happens in the controller via Gate::authorize, after validation.",
    },
    {
      type: "code", title: "Policies: rules per record", ar: "السياسات: قواعد لكل سجل", file: "app/Policies/ShipmentPolicy.php",
      code: `class ShipmentPolicy
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

// app/Http/Controllers/Api/ShipmentController.php
public function show(Shipment $shipment): ShipmentResource
{
    Gate::authorize('view', $shipment);   // 403 if false

    return new ShipmentResource($shipment);
}`,
      hl: [5],
      points: [
        "Owner **or** staff may view and cancel",
        "`isStaff()`: dispatcher or admin",
        "Auto-discovered: `Shipment` → `ShipmentPolicy`",
        "Every policy method gets a **403** test",
      ],
      notes: "Policies keep permission logic out of controllers and make it testable. The spec says owner or dispatcher; in Shahna that is User::isStaff(), which is true for dispatchers and admins, the support roles. Agents tend to add bypasses nobody asked for, so every rule here should trace back to the spec and have a test: a customer gets 403 on someone else's shipment, a dispatcher gets 200.",
    },
    {
      type: "bullets", title: "Money and time", ar: "المال والوقت",
      bullets: [
        "Store LYD as `decimal(10,2)`; cast with `'decimal:2'` (a string in PHP)",
        "Compute the price on the server, **round once**, at the end",
        "Store timestamps in **UTC**; convert to Libya time (UTC+2) at the edge",
        "Quotes expire after **15 minutes** (`expires_at`)",
        "Booking an expired quote returns **422**",
      ],
      side: { kicker: "Rule", big: "decimal(10,2)", bigSize: 36, text: "Floats cannot store 0.1 exactly. Invoices that are off by one dirham destroy trust." },
      notes: "Show 0.1 + 0.2 in php artisan tinker. Then explain why the decimal cast returns a string: it keeps exact digits, so our tests compare '322.00' as a string. For time, always store UTC; Postgres timestamps plus Carbon handle conversion. The quote expiry is a business rule we test with Carbon's travel helpers.",
    },
    {
      type: "prompt", title: "Ask your agent: design the API", mode: "plan mode",
      prompt: `Read **docs/requirements.md** and routes/api.php.

Write **docs/plans/day2-api.md** with one row per endpoint:
- route, controller method, FormRequest and its rules
- auth (Sanctum) and authorization (which Policy method)
- success status and every error status, with the reason

Use only names that already exist in the code or docs/requirements.md.
Do not write any code yet.`,
      why: [
        "Forces a decision per endpoint **before** code",
        "Error statuses become your test list",
        "\"Only existing names\" stops invented routes",
        "Reviewable in two minutes",
      ],
      notes: "Run this live in plan mode. Then review the output together: check that an invalid cancel returns 422 with an error on status, that an expired or already-booked quote returns 422 on quote_id, that show uses the policy, and that quotes return 201. If the plan proposes 409 for any of these, discuss it, then follow the project's convention. Every error status in this plan becomes a feature test in the lab.",
    },
    {
      type: "lab", part: 1, name: "The Booking API", ar: "المختبر الثاني: التسعير وعروض الأسعار", time: "11:00–12:30", tag: "day2-end",
      goal: "Price a trip and return a quote: the **service** and its **tests** first, then the endpoint.",
      steps: [
        "`git checkout day1-end`, then migrate fresh and seed",
        "Agent writes `PricingService` unit tests; watch them fail",
        "Implement `PricingService` until the tests are green",
        "`/auth/register` and `/auth/login` returning Sanctum tokens",
        "`StoreQuoteRequest`, `QuoteResource` and `POST /api/quotes`",
        "Feature tests for 201, 401 and 422, then commit",
      ],
      done: "`POST /api/quotes` returns a priced quote that expires in 15 minutes, with unit and feature tests green.",
      notes: "Insist on seeing a red test before any implementation. Walk the room and check: is the price a string with two decimals? Does same-city pricing use 0 km? Is user_id taken from the token, not the body? Does register return role customer even if the body sends role admin? Early finishers can add a test for an unknown vehicle_type.",
    },

    // ---------------- Session B ----------------
    {
      type: "divider", num: "02", kicker: "Session B · 13:30–14:15", section: "Session B",
      title: "Tests **first**, then code", ar: "الاختبارات أولاً ثم الكود",
      topics: ["Red → green → refactor", "Test pyramid", "Pest unit & feature tests", "Constraints & indexes", "Booking & cancelling", "AI review checklist"],
      notes: "Session B is about trust. Tests are how we trust the agent's code, and database constraints are how we trust our data even when the code is wrong.",
    },
    {
      type: "flow", title: "TDD with an agent", ar: "التطوير الموجه بالاختبارات مع وكيل",
      steps: [
        { h: "Red", d: "agent writes a failing test from the spec" },
        { h: "Review", d: "you read the test: right behaviour?" },
        { h: "Green", d: "agent writes the minimum code" },
        { h: "Refactor", d: "tidy up, tests stay green" },
      ],
      highlight: 1, loop: "next behaviour: repeat",
      bullets: ["The test is the **spec you can run**. Reviewing a 10-line test is easier than a 100-line class"],
      notes: "The important addition for agents is the Review step between red and green. If the test is wrong, the code will be confidently wrong too. Also check the test fails for the right reason: a missing class error is not the same as a wrong price.",
    },
    {
      type: "diagram", title: "The test pyramid", ar: "هرم الاختبارات",
      nodes: [
        { id: "e2e", x: 2.0, y: 0.15, w: 3.0, h: 1.05, label: "End-to-end", sub: "few · slow · manual, k6", style: "dark" },
        { id: "feat", x: 1.0, y: 1.45, w: 5.0, h: 1.05, label: "Feature (HTTP) tests", sub: "many · postJson + database", style: "orange" },
        { id: "unit", x: 0, y: 2.75, w: 7.0, h: 1.05, label: "Unit tests", sub: "most · PricingService, ShipmentStatus", style: "light" },
        { id: "n1", x: 7.6, y: 0.15, w: 4.53, h: 1.05, label: "Does the whole system work?", sub: "Day 3 load tests, demos", style: "card", fontSize: 14 },
        { id: "n2", x: 7.6, y: 1.45, w: 4.53, h: 1.05, label: "Does each endpoint keep its contract?", sub: "status codes, JSON shape, auth", style: "card", fontSize: 14 },
        { id: "n3", x: 7.6, y: 2.75, w: 4.53, h: 1.05, label: "Is each rule correct?", sub: "pricing, transitions · milliseconds", style: "card", fontSize: 14 },
      ],
      caption: "Today's target: **≥ 20 new tests**, mostly feature tests. The `day2-end` tag has **56** in total.",
      notes: "Unit tests are fast and pinpoint failures; feature tests prove the HTTP contract, including auth and validation, with a real database. In Laravel, feature tests are cheap enough that we write many of them. End-to-end checks are few and slow; on Day 3 our k6 load test plays that role.",
    },
    {
      type: "code", title: "PricingService: one rule, one place", ar: "خدمة التسعير: قاعدة واحدة في مكان واحد", file: "app/Services/PricingService.php",
      code: `class PricingService
{
    public const BASE_FEE_LYD = 50;
    public const RATE_PER_KG_LYD = 0.02;
    public const RATE_PER_KM_LYD = [
        'van' => 0.8, 'box_truck' => 1.2, 'flatbed' => 1.5, 'reefer' => 1.9,
    ];

    public function price(int $originCityId, int $destinationCityId,
        VehicleType $vehicleType, int $weightKg): string
    {
        $km = $this->distanceKm($originCityId, $destinationCityId);

        $price = self::BASE_FEE_LYD
            + $km * self::RATE_PER_KM_LYD[$vehicleType->value]
            + $weightKg * self::RATE_PER_KG_LYD;

        return number_format($price, 2, '.', '');
    }

    // distanceKm(): 0 for the same city, else city_distances.km
    // createQuote(): saves the Quote with expires_at = now + 15 min
}`,
      hl: [9, 10],
      fontSize: 10.5,
      points: [
        "Formula from the spec: **50 + km × rate + kg × 0.02**",
        "No HTTP: the service is called by the controller and, on Day 4, by the agent",
        "Round **once**, at the end, to 2 decimals",
        "Returns a `\"322.00\"` string, ready for a decimal column",
      ],
      notes: "All pricing lives in PricingService: the controller never computes a price, and on Day 4 the agent's get_quote tool calls the same service. price() looks up the distance through distanceKm, which returns 0 for the same city and otherwise reads city_distances. createQuote saves the Quote with expires_at 15 minutes from now. The constants are public so tests and docs can refer to them. Agents tend to mix all of this into the controller; push back.",
    },
    {
      type: "code", title: "Unit test with a dataset", ar: "اختبار وحدة مع مجموعة بيانات", file: "tests/Unit/PricingServiceTest.php",
      code: `// Pricing reads distances from the database, so these tests boot Laravel.
uses(TestCase::class, RefreshDatabase::class);

beforeEach(function () {
    $this->seed(CitySeeder::class);
    $this->pricing = new PricingService;
});

it('prices Tripoli to Misrata by box truck', function () {
    // 50 + 210 km × 1.2 + 1000 kg × 0.02 = 322
    expect($this->pricing->price(city('TIP')->id, city('MRA')->id,
        VehicleType::BoxTruck, 1000))->toBe('322.00');
});

it('uses each vehicle rate', function (VehicleType $type, string $expected) {
    // Tripoli → Zawiya is 45 km, 500 kg adds 10 LYD
    expect($this->pricing->price(city('TIP')->id, city('ZAW')->id, $type, 500))
        ->toBe($expected);
})->with([[VehicleType::Van, '96.00'], [VehicleType::BoxTruck, '114.00'],
    [VehicleType::Flatbed, '127.50'], [VehicleType::Reefer, '145.50']]);`,
      fontSize: 10.5,
      points: [
        "Expected values worked out **by hand** from the spec",
        "50 + 210 × 1.2 + 1000 × 0.02 = **322.00**",
        "One test, many cases; add a row per bug",
        "Strings, not floats, in the assertions",
      ],
      notes: "Work one row on the board with the class: Tripoli to Misrata is 210 km in the seeder, so a 1000 kg box truck is 50 + 252 + 20 = 322.00. The expected values must come from the spec and the seeded distances, not from running the code, otherwise the test just copies whatever the code does. city() is a small Pest helper in tests/Pest.php that finds a seeded city by code. If the agent produced these numbers, recompute one yourself.",
    },
    {
      type: "prompt", title: "Ask your agent: test first", mode: "auto-accept edits off",
      prompt: `Write Pest unit tests for **PricingService::price()** in
tests/Unit/PricingServiceTest.php, using a dataset.

Work out each expected price by hand from the formula in
docs/requirements.md and show your arithmetic in a comment per row.

Run \`sail artisan test --filter=PricingService\` and show me
that the tests **fail**. Then stop. Do not implement yet.`,
      why: [
        "Arithmetic shown = **checkable** expectations",
        "Proof of red before green",
        "Stops before implementing, so you review",
        "Same pattern works for every rule",
      ],
      notes: "This is the red step as a prompt. When the agent shows the failing output, read the failure message: it should be a missing class or wrong value, not a syntax error in the test. Then say: now implement the minimum to make these pass.",
    },
    {
      type: "code", title: "Feature tests: the HTTP contract", ar: "اختبارات الميزات: عقد HTTP", file: "tests/Feature/QuoteTest.php",
      code: `beforeEach(function () {
    $this->seed(CitySeeder::class);
    $this->user = Sanctum::actingAs(User::factory()->create());
});

it('creates a quote that expires in 15 minutes', function () {
    $this->freezeSecond();

    $this->postJson('/api/quotes', [
        'origin_city_id' => city('TIP')->id,
        'destination_city_id' => city('MRA')->id,
        'vehicle_type' => 'box_truck',
        'weight_kg' => 1000,
    ])->assertCreated()
        ->assertJsonPath('data.price_lyd', '322.00')
        ->assertJsonPath('data.origin.code', 'TIP');

    expect(Quote::sole()->expires_at->equalTo(now()->addMinutes(15)))->toBeTrue();
});`,
      fontSize: 10.5,
      points: [
        "Real routes, middleware, DB",
        "One test per status code in your plan",
        "`assertJsonValidationErrors` for 422",
        "Aim: **≥ 20** tests by 15:45",
      ],
      notes: "Feature tests send real HTTP requests through the whole stack against a test database. Add a 422 test with assertJsonValidationErrors for weight_kg, and a 403 test for viewing another customer's shipment. These tests are what let us refactor safely on Day 3.",
    },
    {
      type: "code", title: "Constraints the database enforces", ar: "قيود تفرضها قاعدة البيانات", file: "database/migrations/2026_01_05_000005_create_shipments_table.php",
      code: `Schema::create('shipments', function (Blueprint $table) {
    $table->id();
    $table->string('reference', 10)->unique();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->foreignId('quote_id')->unique()->constrained();
    $table->foreignId('vehicle_id')->nullable()->constrained();
    // ... origin/destination city FKs, weight_kg, vehicle_type
    $table->decimal('price_lyd', 10, 2);
    $table->enum('status', array_column(ShipmentStatus::cases(), 'value'))
        ->default(ShipmentStatus::Pending->value);
    $table->timestamp('pickup_at');
    $table->timestamps();

    $table->index(['user_id', 'created_at']);
});`,
      hl: [5, 9, 14],
      points: [
        "`quote_id` UNIQUE since Day 1: one booking per quote",
        "`enum()` becomes a CHECK constraint in PostgreSQL: no unknown status",
        "Composite index for \"my shipments, newest first\"",
        "Write `down()` too, and test `migrate:rollback`",
      ],
      notes: "Validation protects the HTTP path, but data also arrives from seeders, jobs, tinker and, from Day 4, an AI agent's tools. Constraints are the last line of defence. On PostgreSQL, Laravel's enum() column is a varchar plus a CHECK constraint, so a typo in a status string fails at the database. The composite index matches the query for GET /shipments: where user_id order by created_at desc. Range rules such as weight 1 to 25000 kg live in StoreQuoteRequest; if you want them enforced for every writer, a raw CHECK is the next step, but guard it for the SQLite test database.",
    },
    {
      type: "cards", title: "PostgreSQL: let the database say no", ar: "PostgreSQL: دع قاعدة البيانات ترفض", cols: 2,
      cards: [
        { h: "Primary & foreign keys", d: "No orphan shipments: `constrained()` adds the FK; deleting a city in use fails loudly." },
        { h: "UNIQUE", d: "`shipments.quote_id`, `cities.code`, the `(from, to)` distance pair. Duplicates are impossible, not just unlikely." },
        { h: "CHECK", d: "`enum()` columns get a CHECK in PostgreSQL: `status` and `vehicle_type` only take known values, for **every** writer." },
        { h: "Indexes", d: "Index what you filter and sort by: `(user_id, created_at)` on shipments. Measure with `EXPLAIN`." },
      ],
      notes: "Ask for one example of each from yesterday's schema. Mention that indexes are not free: they slow writes and use space, so add them for real queries. On Day 3 we will find a missing index and an N+1 query with numbers.",
    },
    {
      type: "code", title: "Booking a quote safely", ar: "حجز عرض السعر بأمان", file: "app/Services/BookingService.php",
      code: `public function book(User $user, int $quoteId, CarbonInterface $pickupAt): Shipment
{
    return DB::transaction(function () use ($user, $quoteId, $pickupAt) {
        $quote = Quote::whereBelongsTo($user)->lockForUpdate()->find($quoteId);

        if (! $quote) { throw ValidationException::withMessages(
            ['quote_id' => 'Quote not found.']); }
        // same pattern: isExpired() and shipment()->exists() → 422 on quote_id

        $shipment = Shipment::create([
            'user_id' => $user->id, 'quote_id' => $quote->id,
            // ... cities, weight, vehicle_type and price_lyd copied from the quote
            'status' => ShipmentStatus::Pending, 'pickup_at' => $pickupAt,
        ]);
        $shipment->events()->create(['status' => ShipmentStatus::Pending,
            'note' => 'Booking received.', 'occurred_at' => now()]);
        $shipment->transitionTo(ShipmentStatus::Confirmed, 'Booking confirmed.');

        return $shipment;
    });
}`,
      hl: [4],
      fontSize: 10.5,
      points: [
        "Look up the quote **through the user**: no booking others' quotes",
        "Not found, expired or already booked → **422** on `quote_id`",
        "Price copied from the quote, never from the body",
        "Returns status `confirmed`; two events on the timeline",
      ],
      notes: "The controller is thin: it passes the user, quote_id and pickup_at to BookingService::book. The most important line is the scoped, locked lookup: Quote::whereBelongsTo($user) means a customer cannot book a quote id they guessed; another customer's quote simply is not found. Every rejection is a ValidationException on quote_id, so the client gets 422 in Laravel's normal error shape. A successful booking writes two events, 'Booking received.' as pending and 'Booking confirmed.' as confirmed, and returns status confirmed. The UNIQUE constraint on quote_id backs up the exists check; Day 3 adds idempotency keys for client retries.",
    },
    {
      type: "code", title: "Cancel: rules from the enum", ar: "الإلغاء: القواعد من التعداد", file: "ShipmentController · BookingService · Shipment",
      code: `// ShipmentController
public function cancel(Shipment $shipment, BookingService $booking): ShipmentResource
{
    Gate::authorize('cancel', $shipment);

    return new ShipmentResource($booking->cancel($shipment));
}

// BookingService: re-read under a lock, then transition
$shipment = Shipment::lockForUpdate()->findOrFail($shipment->id);
$shipment->transitionTo(ShipmentStatus::Cancelled, 'Cancelled by customer.');

// Shipment::transitionTo()
if (! $this->status->canTransitionTo($next)) {
    throw ValidationException::withMessages([
        'status' => "A {$this->status->value} shipment cannot move to {$next->value}.",
    ]);
}
$this->update(['status' => $next]);
$this->events()->create(['status' => $next, 'note' => $note, 'occurred_at' => now()]);`,
      hl: [14],
      fontSize: 10.5,
      points: [
        "Yesterday's `canTransitionTo` does the real work",
        "Policy first (**403**), then state (**422** on `status`)",
        "Status and event change **together** in one transaction",
        "The tracking endpoint reads these events",
      ],
      notes: "Reuse beats re-implementation: the transition rules live in one place, the enum, and are already tested. Shipment::transitionTo is the only way statuses change, and it always writes a ShipmentEvent, inside BookingService's transaction, so we never have a cancelled shipment without its event. An invalid transition is a ValidationException on status, so the client gets 422 with a message such as 'A picked_up shipment cannot move to cancelled.' Tests to write: owner cancels a confirmed shipment gives 200, owner cancels an in-transit one gives 422 with an error on status, another customer gives 403.",
    },
    {
      type: "cards", title: "AI code review checklist", ar: "قائمة مراجعة كود الذكاء الاصطناعي", cols: 3,
      cards: [
        { h: "Boundary", d: "FormRequest for every input; `validated()` only; no unguarded models." },
        { h: "Authorization", d: "A policy check on every record route, and a **403** test for it." },
        { h: "Data", d: "Decimal money, FKs, UNIQUE and CHECK constraints, indexes for real queries." },
        { h: "Tests", d: "You saw them fail first. They assert behaviour from the spec, not the code." },
        { h: "Names", d: "Routes, classes and fields match `docs/requirements.md` exactly. No invented endpoints." },
        { h: "Scope", d: "No surprise packages, files or features. Small diff, one concern." },
      ],
      notes: "This is the checklist students use in the afternoon lab and in the capstone code review. Have pairs swap laptops and review each other's agent-written diff against these six boxes. Each finding is either fixed or explained.",
    },
    {
      type: "pitfalls",
      items: [
        { p: "Tests that mirror the implementation", fix: "Derive expected values from the spec; check one fails for the right reason" },
        { p: "Booking or viewing another user's records by id", fix: "Scope every lookup to the user: `Quote::whereBelongsTo($user)`" },
        { p: "Returning Eloquent models directly", fix: "Always return API Resources; whitelist every field" },
        { p: "Validation only in code, not in the database", fix: "Add UNIQUE and CHECK constraints for the rules that must always hold" },
      ],
      notes: "All four appear regularly in agent-written Laravel code. The second one is a real-world vulnerability class called insecure direct object reference. Ask students to grep their code for findOrFail calls that are not scoped to the user.",
    },
    {
      type: "statement",
      text: "A test you never saw fail\n**proves nothing.**",
      ar: "الاختبار الذي لم تره يفشل لا يثبت شيئاً",
      sub: "Red first. Then green. Then review.",
      notes: "Agents can write tests that always pass, for example asserting on a mock they configured themselves. Seeing the test fail first is your proof that it actually checks something.",
    },
    {
      type: "lab", part: 2, name: "The Booking API", ar: "المختبر الثاني: الحجز والتتبع", time: "14:15–15:45", tag: "day2-end",
      goal: "Book, list, view, cancel and track shipments, with policies and **at least 20** passing tests.",
      steps: [
        "`POST /api/shipments` from a valid, unexpired, unused quote",
        "`GET /api/shipments`: paginated, own shipments only",
        "`GET /api/shipments/{reference}` with `ShipmentPolicy`",
        "Cancel and tracking, enforcing `canTransitionTo`",
        "Swap laptops: review with the checklist, then fix",
        "`sail artisan test`, commit, `git diff day2-end`",
      ],
      done: "≥ 20 new tests pass, every record route has a 401 and a 403 test, and your API matches `day2-end` (56 tests).",
      notes: "Keep the test-first rhythm: for each endpoint the agent writes the feature tests, you review them, then it implements. Teams that fall behind can check out day2-end at 15:40. Collect one good review finding per team for tomorrow's standup.",
    },
  ],
  recap: {
    points: [
      "URLs name resources; **status codes** tell the truth",
      "FormRequests validate; `validated()` stops mass assignment",
      "**Sanctum** says who you are; **Policies** say what you may do",
      "Money is `decimal(10,2)`; time is UTC; quotes expire in 15 min",
      "Red → review → green → refactor, with the agent",
      "Constraints and a checklist catch what tests miss",
    ],
    question: "A customer requests another customer's shipment by reference. What should stop it?",
    options: ["The FormRequest", "The `ShipmentPolicy`", "The API Resource", "The rate limiter"],
    notes: "Two-minute recap, then the exit ticket. The teaser answer is B: authorization is the policy's job. Validation checks input shape, resources shape output, and rate limits control volume.",
  },
  next: "**Tomorrow, Day 3:** making it scale. Queues, caching, idempotency and load tests with k6. Start from `day2-end`.",
  closingNotes: "Thank everyone. Make sure every team has pushed and can check out day2-end. Tomorrow we break the API under load, then fix it with numbers.",
};
