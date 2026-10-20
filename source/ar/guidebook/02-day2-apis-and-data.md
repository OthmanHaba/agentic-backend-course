# اليوم الثاني — واجهات البرمجة والبيانات بالطريقة الصحيحة

بنيت أمس قاعدة البيانات. واليوم تضع أمامها واجهة برمجة (API): يسجّل الزبائن، ويحصلون على عروض أسعار، ويحجزون الشحنات، ويتتبّعونها، ويلغونها. ستكتب الاختبارات قبل الشيفرة، وسيكتب الوكيل كثيراً من تلك الاختبارات، وستتعلّم مراجعة الشيفرة التي يكتبها الذكاء الاصطناعي بقائمة تحقق بدلاً من الإحساس.

## أهداف التعلّم

بنهاية اليوم الثاني يجب أن تكون قادراً على أن:

- تصمّم موارد REST بالطرق (Methods) والمسارات ورموز الحالة (Status Codes) الصحيحة.
- تتحقّق من المدخلات عند الحدود باستخدام FormRequests وتتجنّب أخطاء الإسناد الجماعي (Mass Assignment).
- تشرح الفرق بين المصادقة (Authentication) والتفويض (Authorization)، وتنفّذ الاثنين باستخدام Sanctum والسياسات (Policies).
- تنمذج البيانات بأمان في PostgreSQL: المفاتيح، والمفاتيح الأجنبية، وقيود التفرّد والفحص، والفهارس (Indexes)، والأنواع العشرية للمال.
- تتعامل مع المال والوقت بشكل صحيح.
- تدير حلقة أحمر ← أخضر ← إعادة هيكلة (Red → Green → Refactor) مع وكيل، والاختبارات أولاً.
- تراجع الشيفرة التي يولّدها الذكاء الاصطناعي بقائمة تحقق مكتوبة.

## الجلسة (أ): تصميم واجهة البرمجة

### REST في التطبيق العملي

REST أسلوب لواجهات برمجة HTTP مبني حول **الموارد** (Resources) (أسماء) و**الطرق** (أفعال). واجهة برمجة شحنة:

| الطريقة | المسار | ماذا يفعل |
|---|---|---|
| POST | `/api/auth/register` | ينشئ مستخدماً ويعيد رمز وصول (Token) |
| POST | `/api/auth/login` | يعيد رمز وصول |
| GET | `/api/cities` | يسرد المدن |
| POST | `/api/quotes` | ينشئ عرض سعر (Quote) |
| POST | `/api/shipments` | يحجز شحنة من عرض سعر |
| GET | `/api/shipments` | يسرد شحناتي (مقسّمة إلى صفحات) |
| GET | `/api/shipments/{reference}` | يعرض شحنة واحدة |
| POST | `/api/shipments/{reference}/cancel` | يلغي شحنة |
| GET | `/api/shipments/{reference}/tracking` | الخط الزمني للأحداث |

بعض قرارات التصميم الجديرة بالملاحظة:

- **أسماء بصيغة الجمع** للمجموعات: `/shipments`، وليس `/getShipments`.
- **معرّفات عامة.** نستخدم `reference` (مثل `SHN-7KQ2XA`) في عناوين URL، وليس `id` الخاص بقاعدة البيانات. فالمعرّفات الداخلية تسرّب معلومات (كم شحنة لديك) ويسهل تخمينها.
- **الإجراءات كموارد فرعية.** الإلغاء ليس مجرد تحديث حقل؛ فله قواعد. والمسار `POST /shipments/{reference}/cancel` يجعل النيّة صريحة، ويسهل تفويضه وتسجيله.

### رموز الحالة

استخدم رمز الحالة لتقول ما حدث. فالعملاء (ولاحقاً أدوات وكيلك الذكي) يعتمدون عليه.

| الرمز | المعنى | مثال من شحنة |
|---|---|---|
| 200 OK | نجاح مع محتوى | `GET /shipments/SHN-7KQ2XA` |
| 201 Created | أُنشئ مورد جديد | `POST /quotes`، `POST /shipments` |
| 204 No Content | نجاح، ولا شيء يُعاد | (نادر في هذه الواجهة) |
| 401 Unauthorized | غير مصادَق عليه (لا رمز أو رمز غير صالح) | رمز Bearer مفقود |
| 403 Forbidden | مصادَق عليه لكن غير مسموح له | زبون يطّلع على شحنة زبون آخر |
| 404 Not Found | غير موجود | مرجع غير معروف |
| 409 Conflict | الطلب يتعارض مع الحالة الحالية | المفتاح `Idempotency-Key` نفسه لا يزال قيد المعالجة (اليوم الثالث) |
| 422 Unprocessable Content | فشل التحقق أو قاعدة عمل | `weight_kg` سالب؛ عرض السعر منتهٍ أو محجوز سابقاً؛ إلغاء شحنة مُسلَّمة |
| 429 Too Many Requests | بلوغ حدّ المعدّل | اليوم الثالث |
| 500 Internal Server Error | خطأ في شيفرتك | لا يحدث عمداً أبداً |

::: tip
حين يطّلع زبون على شحنة زبون آخر، تعيد بعض الفرق 404 بدلاً من 403 كي لا يعرف المهاجمون حتى أن المرجع موجود. كلا الخيارين يمكن الدفاع عنه. اختر واحداً، واكتبه في `CLAUDE.md`، واختبره.
:::

### موارد الواجهة: تشكيل المخرجات

لا تُعِد نموذجاً مباشرة أبداً. فالنماذج تحتوي أعمدة قد لا ترغب في كشفها، ويتغيّر شكلها حين تتغيّر قاعدة البيانات. أما **مورد الواجهة** (API Resource) فعقد مقصود:

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

وتتبع `CityResource` ‏(`id`، `code`، `name_en`، `name_ar`)، و`QuoteResource`، و`ShipmentEventResource` ‏(`status`، `note`، `occurred_at`) النمط نفسه.

### التقسيم إلى صفحات

لا يجوز أن يعيد `GET /shipments` عشرة آلاف صف. ومُقسِّم الصفحات في Laravel يتولّى العمل (Pagination):

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

تتضمّن الاستجابة `data` و`links` و`meta` (الصفحة الحالية، والإجمالي، وغير ذلك). لاحظ أن الاستعلام يبدأ من `$request->user()->shipments()`: فالزبون لا يرى إلا شحناته هو. وتقييد نطاق الاستعلام هو الطبقة الأولى من التفويض.

### التحقق عند الحدود

كل مدخل يأتي من الخارج غير موثوق. تحقّق منه عند نقطة دخوله، قبل أن يصل إلى منطق العمل. وفي Laravel يكون ذلك عبر **FormRequest**:

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

إن فشل التحقق، يعيد Laravel تلقائياً 422 مع محتوى JSON يسرد الأخطاء. ولا يعمل المتحكم إلا ببيانات صالحة، متاحة عبر `$request->validated()`.

### الإسناد الجماعي

الإسناد الجماعي يعني ملء نموذج من مصفوفة: `Shipment::create($data)`. والخطر هو ملؤه من *مدخلات المستخدم*:

```php
// DANGEROUS: the client can send "price_lyd": 1 or "status": "delivered"
Shipment::create($request->all());
```

دفاعان، استخدم كليهما:

1. لا تمرّر إلا البيانات التي تم التحقق منها: `$request->validated()`.
2. صرّح بـ `$fillable` في النموذج، لتُتجاهل المفاتيح غير المعروفة.

أما الحقول المهمة مثل السعر، فلا تأخذها من العميل أصلاً. فالسعر يأتي من عرض السعر، الذي جاء بدوره من `PricingService`.

### المصادقة مقابل التفويض

| | المصادقة | التفويض |
|---|---|---|
| السؤال | من أنت؟ | هل يُسمح لك بفعل هذا؟ |
| الأداة في شحنة | رمز Bearer من Sanctum | السياسات (`ShipmentPolicy`) وتقييد نطاق الاستعلامات |
| رمز الفشل | 401 | 403 (أو 404) |

**Sanctum** يُصدر رموز وصول لواجهة البرمجة. وفي Laravel 12، يُعدّ الأمر `php artisan install:api` كلاً من Sanctum و`routes/api.php` (تم ذلك أصلاً في مشروع البداية). ويستخدم النموذج `User` السمة (Trait) ‏`HasApiTokens`.

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

توضع المسارات المحمية داخل مجموعة البرمجيات الوسيطة (Middleware) ‏`auth:sanctum`:

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

يخبر `{shipment:reference}` ‏Laravel أن يجد `Shipment` عبر عمود `reference` (ربط النموذج بالمسار، Route Model Binding). وإن لم يوجد، يعيد Laravel ‏404 نيابة عنك.

**السياسات** تحمل قواعد التفويض الخاصة بنموذج:

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

يجد Laravel ‏`ShipmentPolicy` تلقائياً عبر عُرف التسمية. وفي المتحكم:

```php
use Illuminate\Support\Facades\Gate;

public function show(Shipment $shipment)
{
    Gate::authorize('view', $shipment);   // throws 403 if not allowed

    return new ShipmentResource($shipment);
}
```

::: tip
يحوّل النموذج `User` الحقل `role` إلى التعداد `UserRole`، لذا تقارن `isStaff()` حالات التعداد (`UserRole::Dispatcher`، `UserRole::Admin`)، وليس نصوصاً خاماً أبداً.
:::

### المال والوقت

**المال.** الأعداد العشرية العائمة (Floating Point) لا تستطيع تمثيل معظم الكسور العشرية بدقة (`0.1 + 0.2` لا يساوي `0.3`). للمال:

- خزّنه بالنوع `decimal(10, 2)` في PostgreSQL.
- حوّله في النموذج بـ `decimal:2`، الذي يعطيك نصاً.
- احسب بعناية، وقرّب مرة واحدة، في النهاية، إلى منزلتين عشريتين.

**الوقت.** خزّن الطوابع الزمنية (Timestamps) بتوقيت UTC (الإعداد الافتراضي في Laravel ‏`APP_TIMEZONE=UTC`). ولا تحوّلها إلى توقيت ليبيا (`Africa/Tripoli`) إلا عند العرض. وأعِد نصوصاً بصيغة ISO 8601 في واجهة البرمجة (`2026-10-21T08:00:00+00:00`). ولقاعدة «ينتهي عرض السعر بعد 15 دقيقة»، استخدم `now()->addMinutes(15)` وقارن بـ `$quote->expires_at->isPast()`.

## منطق العمل الأساسي: PricingService

قواعد العمل تعيش في الخدمات، لا في المتحكمات. قاعدة التسعير من المواصفات:

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

مثال محلول: شاحنة صغيرة (van) تحمل 500 كغ من طرابلس إلى بنغازي (1,020 كم في البذّارة) تكلّف `50 + 1020 × 0.8 + 500 × 0.02 = 50 + 816 + 10 = 876.00` ديناراً ليبياً.

::: tip
هذه نسخة المستودع (وفي اليوم الثالث يُغلَّف البحث عن المسافة لاحقاً بـ `Cache::remember`). إن اختلفت نسختك في الأسماء، فالمهم هو القاعدة وحالات الاختبار، لكن اقرأ دائماً نسخة المستودع بعد أن تكتب نسختك.
:::

## الجلسة (ب): الاختبارات أولاً، مع وكيل

### حلقة TDD

التطوير المقاد بالاختبارات (Test-Driven Development, TDD) دورة قصيرة:

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

لماذا تصبح TDD *أكثر* قيمة مع الوكيل، لا أقل:

- **الاختبارات هي المواصفات التي يستطيع الوكيل أن يقيس نفسه عليها.** عبارة «اجعل هذه الاختبارات تنجح» تعليمات أوضح بكثير من «نفّذ التسعير».
- **الاختبارات تكشف الهلوسات.** الدالة المخترعة تفشل فوراً.
- **أنت تراجع الاختبارات أولاً.** الاختبارات أقصر وأسهل في الحكم عليها من التنفيذ. فإن كانت الاختبارات صحيحة وخضراء، زال معظم الخطر.

القاعدة: **أنت توافق على الاختبارات قبل أن يكتب الوكيل التنفيذ.** واحذر من أن «يصلح» الوكيل اختباراً فاشلاً بتغيير الاختبار بدلاً من الشيفرة.

### اختبارات الوحدة لـ PricingService

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

هذه الاختبارات تلمس قاعدة البيانات (المدن والمسافات)، لذا تحتاج إلى `RefreshDatabase`. ويطبّق `tests/Pest.php` كلاً من `TestCase` و`RefreshDatabase` على مجلد `Feature` فقط، لذا يختار هذا الملف الموجود في `tests/Unit` تفعيلهما بـ `uses(...)`. والدالة المساعدة `city('TIP')` معرّفة في `tests/Pest.php`.

### اختبارات الميزات لواجهة البرمجة

اختبارات الميزات (Feature Tests) ترسل طلبات HTTP حقيقية إلى تطبيقك وتفحص الاستجابة:

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
الدالة `actingAs()` تتخطّى فحص الرموز لتبقى الاختبارات سريعة. احتفظ باختبار واحد على الأقل يرسل ترويسة `Authorization: Bearer ...` حقيقية ليثبت أن البرمجيات الوسيطة للمصادقة موصولة بشكل صحيح.
:::

### هرم الاختبارات

```text
            /\
           /  \        few: end-to-end (real HTTP client, real services)
          /----\
         /      \      some: feature tests (HTTP into Laravel, real DB)
        /--------\
       /          \    many: unit tests (one class, fast, no HTTP)
      /------------\
```

اختبارات الوحدة (Unit Tests) سريعة وتحدّد موضع الإخفاق بدقة. واختبارات الميزات تثبت أن الأجزاء تعمل معاً. استهدف كثيراً من اختبارات الوحدة على القواعد مثل `PricingService` و`ShipmentStatus`، واختبارات ميزات لكل نقطة نهاية (Endpoint) تغطي المسار السعيد (Happy Path) وإخفاقاته المهمة (401، 403، 404، 422). هدف اليوم: 20 اختباراً ناجحاً على الأقل.

### الحجز والإلغاء: القواعد في الشيفرة

يجب أن يرفض إجراء الحجز عروض الأسعار المنتهية وتلك المستخدمة سابقاً. وفي المستودع، تنجز `BookingService` الحجز كله في معاملة (Transaction) واحدة: تنشئ الشحنة بالحالة `pending` (الحدث "Booking received.")، ثم تنقلها فوراً إلى `confirmed` (الحدث "Booking confirmed."). لذا تُظهر استجابة 201 الحالة `confirmed`، ويبدأ الخط الزمني للتتبّع بحدثين:

```json
{
  "data": [
    {"status": "pending", "note": "Booking received.", "occurred_at": "2026-10-21T08:00:00+00:00"},
    {"status": "confirmed", "note": "Booking confirmed.", "occurred_at": "2026-10-21T08:00:00+00:00"}
  ]
}
```

كل تغيير في الحالة يمرّ عبر `canTransitionTo()` ويكتب حدثاً، فيصبح الخط الزمني سجلاً كاملاً. ويجب أن يحترم إجراء الإلغاء آلة الحالات نفسها.

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

الإلغاء غير الصالح (مثل شحنة حالتها أصلاً `in_transit` أو `cancelled`) يرمي `ValidationException`، فيحصل العميل على **422** مع `errors.status`، مثل `"A cancelled shipment cannot move to cancelled."`. ويُكتب تغيير الحالة وصفّ الحدث في معاملة واحدة: إما أن يحدثا معاً أو لا يحدث أي منهما.

::: tip
يُبقي المستودع الحجز والإلغاء كليهما في `BookingService`، فتستدعي واجهة البرمجة وأدوات الوكيل في اليوم الرابع الشيفرة نفسها تماماً.
:::

### PostgreSQL: المفاتيح، والقيود، والفهارس

تطبيقك يتحقّق من البيانات. لكن **قاعدة البيانات** يجب أن تحميها أيضاً، لأنها خط الدفاع الأخير — ضد الأخطاء البرمجية، وضد وصول طلبين في اللحظة نفسها، وضد مسارات في الشيفرة نسيتها.

| الحماية | مثال في شحنة | ما الذي تمنعه |
|---|---|---|
| المفتاح الأساسي (Primary Key) | `id` في كل جدول | الصفوف المكرّرة، والإشارات الملتبسة |
| المفتاح الأجنبي (Foreign Key) | `shipments.user_id → users.id` | شحنات لمستخدمين غير موجودين |
| التفرّد (Unique) | `shipments.quote_id`، `shipments.reference`، `cities.code` | حجز عرض سعر واحد مرتين؛ المراجع المكرّرة |
| الفحص (Check) | `weight_kg > 0`، `price_lyd >= 0` (إضافة اختيارية؛ يعتمد المستودع على الأعمدة غير السالبة والتحقق) | القيم المستحيلة، حتى من شيفرة معيبة |
| عدم القبول بالفراغ (Not Null) | `price_lyd`، `status` | غياب بيانات حرجة |
| الفهرس (Index) | `shipments(user_id, created_at)` | بطء استعلامات «شحناتي» |

قيد التفرّد على `quote_id` هو الأهم. فإن وصل طلبا حجز لعرض السعر نفسه في اللحظة نفسها، فقد ينجح كلاهما في فحوص التطبيق («هل استُخدم هذا العرض سابقاً؟»). أما قيد التفرّد في قاعدة البيانات فيضمن نجاح إدراج واحد فقط. وستبني على ذلك في اليوم الثالث.

يغطّي باني المخطط (Schema Builder) في Laravel معظم هذه الحمايات. أما قيد الفحص (Check Constraint) فاستخدم له تعليمة خاماً في الترحيل:

```php
use Illuminate\Support\Facades\DB;

DB::statement('ALTER TABLE shipments ADD CONSTRAINT shipments_weight_positive CHECK (weight_kg > 0)');
```

**الفهارس** تجعل القراءة سريعة والكتابة أبطأ قليلاً. فهرِس الأعمدة التي تصفّي وترتّب بها. وتستطيع أن ترى إن كان PostgreSQL يستخدم فهرساً عبر `EXPLAIN`:

```sql
EXPLAIN ANALYZE
SELECT * FROM shipments
WHERE user_id = 42
ORDER BY created_at DESC
LIMIT 20;
```

ابحث عن `Index Scan` (جيد) مقابل `Seq Scan` على جدول كبير (سيئ غالباً).

### قائمة التحقق لمراجعة شيفرة الذكاء الاصطناعي

استخدم هذه القائمة على كل تغيير يكتبه الذكاء الاصطناعي. وهي موجودة أيضاً في الملحق.

| المجال | السؤال |
|---|---|
| النطاق | هل يفعل التغيير ما طُلب فقط؟ هل هناك ملفات مفاجئة؟ |
| الوجود | هل كل صنف ودالة ومفتاح إعدادات موجود في الإصدارات المثبّتة لدينا؟ |
| التحقق | هل كل مدخل خارجي يُتحقَّق منه بـ FormRequest؟ هل يوجد `$request->all()`؟ |
| التفويض | هل كل قراءة وكتابة مقيّدة بالمستخدم أو مفحوصة بسياسة؟ |
| سلامة البيانات | هل الكتابات المترابطة داخل معاملة؟ هل تدعم القيودُ القواعدَ؟ |
| المال والوقت | عشري للمال؟ UTC للتخزين؟ |
| الأخطاء | رموز حالة صحيحة؟ لا تتبّعات مكدّس (Stack Traces) ولا أسرار في الاستجابات؟ |
| الاختبارات | هل تفحص الاختبارات السلوك، بما فيه الإخفاقات؟ هل أُضعف أي اختبار لينجح؟ |
| الأداء | استعلامات داخل حلقات؟ فهارس مفقودة؟ قوائم بلا حدود؟ |
| المقروئية | هل تستطيع شرح كل سطر لمراجِع؟ |

## بناء الوكلاء داخل النظام الخلفي: لماذا يهمّ اليوم

واجهة البرمجة اليوم هي صندوق أدوات الغد. ففي اليوم الرابع ستستدعي أدوات مساعد شحنة الشيفرة نفسها:

| نقطة النهاية (اليوم) | أداة الوكيل (اليوم الرابع) | الشيفرة المشتركة |
|---|---|---|
| `POST /quotes` | `get_quote` | `PricingService` |
| `POST /shipments` | `book_shipment` | منطق الحجز، وفحوص عرض السعر |
| `GET /shipments/{reference}/tracking` | `track_shipment` | تقييد النطاق بالملكية |
| `POST /shipments/{reference}/cancel` | `cancel_shipment` | `canTransitionTo()`، والسياسة |

النموذج اللغوي عميل غير اعتيادي: يستطيع أن يرسل *أي شيء*. والتحقق، والتفويض، والقيود، ورسائل الخطأ الواضحة التي تبنيها اليوم هي بالضبط ما يُبقي الوكيل الذكي آمناً غداً. كما تساعد رسائل الخطأ الواضحة ("A delivered shipment cannot move to cancelled.") النموذجَ على شرح الموقف للزبون.

## كيف تعمل مع وكيلك على هذا

الاختبارات أولاً، وتراجعها أنت دائماً:

::: agent
اكتب اختبارات وحدة بـ Pest لـ App\Services\PricingService بناءً على قاعدة التسعير في docs/requirements.md. غطِّ: سعر كل نوع مركبة، والمسافة الصفرية داخل المدينة نفسها، وتكلفة الوزن، والتقريب إلى منزلتين عشريتين. لا تكتب الخدمة بعد. شغّل الاختبارات وأرني أنها تفشل للسبب الصحيح.

بالإنجليزية: `Write Pest unit tests for App\Services\PricingService based on the pricing rule in docs/requirements.md. Cover: each vehicle type rate, same-city zero distance, weight cost, rounding to 2 decimals. Do NOT write the service yet. Run the tests and show me they fail for the right reason.`
:::

بعد أن توافق على الاختبارات:

::: agent
الآن نفّذ PricingService لتنجح هذه الاختبارات. لا تعدّل الاختبارات. وإن كنت تعتقد أن أحد الاختبارات خاطئ، فتوقّف واشرح السبب بدلاً من تغييره.

بالإنجليزية: `Now implement PricingService so these tests pass. Do not modify the tests. If you believe a test is wrong, stop and explain why instead of changing it.`
:::

لنقطة نهاية:

::: agent
خطّط لنقطة النهاية POST /api/shipments في docs/plans/day2-booking.md: قواعد FormRequest، وفحوص السياسات، وحدود المعاملات، وحالات الخطأ مع رموز الحالة (عرض سعر منتهٍ، وعرض مستخدم، وعرض يخصّ شخصاً آخر)، وقائمة اختبارات الميزات. لا شيفرة بعد.

بالإنجليزية: `Plan the POST /api/shipments endpoint in docs/plans/day2-booking.md: FormRequest rules, policy checks, transaction boundaries, error cases with status codes (expired quote, used quote, someone else's quote), and the list of feature tests. No code yet.`
:::

للمراجعة:

::: agent
راجع فرق git الحالي مقابل قائمة التحقق هذه: النطاق، ووجود الواجهات، والتحقق، والتفويض، والمعاملات، والمال كعدد عشري، ورموز الحالة، وجودة الاختبارات، واستعلامات N+1. لكل بند قل نجح أو فشل مع الملف والسطر. لا تصلح أي شيء بعد.

بالإنجليزية: `Review the current git diff against this checklist: scope, existence of APIs, validation, authorization, transactions, money as decimal, status codes, test quality, N+1 queries. For each item say pass or fail with the file and line. Do not fix anything yet.`
:::

ثم أصلح الملاحظات واحدة تلو الأخرى، وأعد تشغيل الاختبارات بعد كل إصلاح.

## أخطاء شائعة

- **الوكيل يعدّل الاختبار ليجعله ينجح.** قل صراحة «لا تعدّل الاختبارات» وافحص `git diff tests/`.
- **اختبارات لا تتحقّق من شيء مفيد.** الدالة `assertOk()` وحدها تثبت القليل جداً. افحص محتوى JSON وقاعدة البيانات.
- **تمرير `$request->all()` إلى `create()`.** ثغرة الإسناد الجماعي الكلاسيكية.
- **السعر من العميل.** يجب أن يأتي السعر من عرض السعر، وليس من محتوى الطلب أبداً.
- **التفويض في دالة `show` بالمتحكم فقط.** نقاط نهاية السرد تحتاج إلى تقييد النطاق أيضاً، وإلا رأى الزبائن بيانات الجميع.
- **المال كعدد عائم والتوقيت المحلي.** استخدم الأعداد العشرية وUTC.
- **غياب قيود قاعدة البيانات** بحجّة «نحن نتحقّق في التطبيق». طلبان متزامنان سيثبتان خطأك.
- **إعادة النماذج بدلاً من الموارد.** تسرّب الأعمدة وتربط العملاء بمخططك.

## أهم الخلاصات

- صمّم حول الموارد ورموز الحالة الواضحة. واستخدم المراجع العامة، لا معرّفات قاعدة البيانات، في عناوين URL.
- تحقّق عند الحدود (FormRequest)، ولا تُسند إلا البيانات التي تم التحقق منها، ولا تثق أبداً بالأسعار أو الحالات القادمة من العميل.
- المصادقة (Sanctum) تجيب عن «مَن»؛ والتفويض (السياسات، والاستعلامات المقيّدة النطاق) يجيب عن «هل هو مسموح؟».
- قاعدة البيانات تفرض الحقيقة: المفاتيح الأجنبية، وقيود التفرّد (خاصة `quote_id`)، وقيود الفحص، والفهارس.
- المال عشري؛ والوقت UTC في التخزين.
- مع الوكيل، تأتي الاختبارات أولاً وتراجعها أنت أولاً. والاختبارات الخضراء التي تثق بها أقوى دفاع لك ضد الشيفرة المُهلوَسة.
- منطق واجهة البرمجة اليوم يصبح أدوات الوكيل في اليوم الرابع.

## أسئلة التقييم الذاتي

1. ما الفرق بين 401 و403؟ أعطِ مثالاً من شحنة على كل منهما.
2. لماذا تستخدم واجهة البرمجة `reference` في عناوين URL بدلاً من `id`؟
3. ما الأمران اللذان يمنعان معاً أخطاء الإسناد الجماعي؟
4. لماذا يجب ألا يأتي سعر الشحنة من محتوى الطلب أبداً؟
5. احسب سعر شاحنة مسطّحة (flatbed) تحمل 2,000 كغ لمسافة 300 كم.
6. لماذا نحتاج إلى قيد تفرّد على `shipments.quote_id` حتى لو كان المتحكم يفحص إن كان العرض قد استُخدم؟
7. لماذا تكون TDD مفيدة بشكل خاص حين يكتب الوكيل التنفيذ؟
8. ما علامة التحذير التي يجب أن تبحث عنها في `git diff tests/` بعد أن يقول الوكيل «كل الاختبارات تنجح»؟
9. لماذا يُغلَّف تغيير الحالة وإدراج الحدث في إجراء الإلغاء داخل معاملة؟
10. اذكر أداتين من أدوات الوكيل في اليوم الرابع وشيفرة اليوم الثاني التي تعيد استخدامها.

### الإجابات

1. 401 تعني غير مصادَق عليه (لا رمز أو رمز غير صالح، مثل استدعاء `GET /api/shipments` دون رمز Bearer). و403 تعني مصادَقاً عليه لكن غير مسموح له (زبون يطلب شحنة زبون آخر).
2. المراجع ليست متسلسلة، فلا تسرّب حجم العمل ويصعب تخمينها؛ كما أنها معرّفات ثابتة وذات معنى للزبائن.
3. تمرير بيانات `$request->validated()` فقط، والتصريح بـ `$fillable` في النموذج. (وأيضاً: لا تقبل أبداً الحقول الحسّاسة مثل السعر أو الحالة من العميل.)
4. لأن العميل قد يرسل أي رقم. والسعر الموثوق هو الذي حسبته `PricingService` وخزّنته في عرض السعر.
5. `50 + 300 × 1.5 + 2000 × 0.02 = 50 + 450 + 40 = 540.00` ديناراً ليبياً.
6. قد يصل طلبان في الوقت نفسه وينجح كلاهما في فحص التطبيق قبل أن يُدرج أي منهما. ووحده قيد قاعدة البيانات يضمن نجاح أحدهما وفشل الآخر.
7. الاختبارات مواصفات دقيقة يستطيع الوكيل قياس نفسه عليها، وتكشف الواجهات المخترعة فوراً، وتستطيع مراجعة الاختبارات القصيرة بموثوقية أكبر من التنفيذات الطويلة.
8. تأكيدات (Assertions) مُغيَّرة أو محذوفة، أو توقّعات أُضعفت، أو اختبارات عُلِّمت بالتخطّي — وكلها علامات على أن الوكيل غيّر الاختبار بدلاً من إصلاح الشيفرة.
9. لينجح الاثنان معاً أو يفشلا معاً؛ فلا ينتهي بك الأمر أبداً بشحنة ملغاة دون حدث، أو بحدث لإلغاء لم يقع.
10. `get_quote` تعيد استخدام `PricingService`؛ و`cancel_shipment` تعيد استخدام `canTransitionTo()` وسياسة الإلغاء؛ و`track_shipment` تعيد استخدام تقييد النطاق بالملكية؛ و`book_shipment` تعيد استخدام منطق الحجز وفحوص عرض السعر.
