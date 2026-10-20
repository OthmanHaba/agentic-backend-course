# اليوم الثالث — بناء أنظمة قابلة للتوسع

واجهة الحجز تعمل. تخيّل الآن عطلة نهاية أسبوع في موسم عيد: مئات الزبائن يحجزون في الوقت نفسه، وهواتف على شبكات جوّال ضعيفة تعيد إرسال الطلبات، ومرسِلون يحدّثون لوحاتهم باستمرار. اليوم تجعل شحنة سريعة، وآمنة تحت التزامن (Concurrency)، وقابلة للمراقبة — وتتعلّم أن تجعل الوكيل يثبت ادعاءاته عن الأداء بالأرقام.

## أهداف التعلّم

بنهاية اليوم الثالث يجب أن تكون قادراً على أن:

- تشرح نموذجاً بسيطاً لقابلية التوسع (Scalability): خوادم تطبيق عديمة الحالة (Stateless)، والتوسع الأفقي (Horizontal Scaling)، وقاعدة البيانات بوصفها عنق الزجاجة المعتاد.
- تجد الاختناقات (Bottlenecks) الشائعة: استعلامات N+1، والفهارس المفقودة، والعمل البطيء داخل الطلب.
- تنقل العمل البطيء إلى طوابير المهام (Queues) باستخدام الأحداث (Events)، والمستمعين (Listeners)، والمهام (Jobs)، التي يديرها Horizon.
- تمنع الحجز المزدوج بمفاتيح عدم التكرار (Idempotency Keys)، وقيود التفرّد، والمعاملات (Transactions)، وأقفال الصفوف (Row Locks).
- تخزّن البيانات الصحيحة تخزيناً مؤقتاً (Caching) مع خطة إبطال (Invalidation) واضحة.
- تحدّد المعدّل (Rate Limiting) لكل مستخدم.
- تجعل النظام قابلاً للمراقبة (Observability) بالسجلات المهيكلة (Structured Logs) ومعرّفات الطلبات (Request IDs).
- تشغّل اختبار حِمل (Load Test) بـ k6، وتقرأ التقرير، وتقارن قبل وبعد.
- تستخدم وكيلاً لتحليل الأداء (Profiling) واقتراح الإصلاحات، ثم تتحقّق من ادعاءاته بالقياسات.

## الجلسة (أ): التوسع، وطوابير المهام، وحالات التسابق

### نموذج ذهني للتوسع

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

ثلاثة مبادئ:

1. **خوادم تطبيق عديمة الحالة.** لا تُخزَّن بيانات مهمة في ذاكرة الخادم أو قرصه المحلي بين الطلبات. الجلسات، والتخزين المؤقت، والطوابير تعيش في Redis؛ والبيانات تعيش في PostgreSQL. عندها يستطيع أي خادم أن يعالج أي طلب، وتتوسّع بإضافة خوادم (*التوسع الأفقي*).
2. **قاعدة البيانات هي عادةً عنق الزجاجة.** تستطيع إضافة خوادم تطبيق بسهولة؛ لكنك لا تستطيع بسهولة إضافة قواعد بيانات رئيسية. لذا: استعلامات أقل، واستعلامات أفضل، وفهارس جيدة، ومعاملات قصيرة، وتخزين مؤقت للبيانات التي نادراً ما تتغيّر.
3. **أنجز العمل البطيء خارج الطلب.** لا ينبغي أن ينتظر الزبون بينما تبحث عن شاحنة أو ترسل بريداً إلكترونياً. ضع ذلك العمل في طابور.

### إيجاد الاختناقات: مشكلة N+1

أكثر أخطاء الأداء شيوعاً في أدوات ORM. انظر إلى `GET /shipments`:

```php
$shipments = $request->user()->shipments()->latest()->paginate(15);
// ShipmentResource reads $this->origin, $this->destination and $this->vehicle
```

هذا يشغّل استعلاماً واحداً للشحنات (إضافة إلى استعلام عدّ واحد لمُقسِّم الصفحات)، ثم لـ*كل* شحنة من الشحنات الخمس عشرة، استعلاماً للمدينة المصدر، وآخر للوجهة، وآخر للمركبة: 47 استعلاماً. وبحجم صفحة 100، يتجاوز العدد 300. هذا هو نمط N+1: استعلام واحد ثم N استعلامات أخرى.

الإصلاح هو **التحميل المسبق** (Eager Loading):

```php
$shipments = $request->user()
    ->shipments()
    ->with(['origin', 'destination', 'vehicle'])
    ->latest()
    ->paginate(15);
```

الآن عدد الاستعلامات ثابت (الشحنات، والعدّ، واستعلام واحد لكل علاقة) مهما كان حجم الصفحة. والملف `tests/Feature/PerformanceTest.php` في المستودع يثبت ذلك: يعدّ الاستعلامات لشحنتين ولـ 12 شحنة ويتوقّع العدد نفسه.

::: tip
أضف هذا إلى `AppServiceProvider::boot()` في بيئة التطوير لتفشل أخطاء N+1 بصوت عالٍ بدلاً من أن تمرّ بصمت:
`Model::preventLazyLoading(! app()->isProduction());`
:::

اختناقات شائعة أخرى:

| العَرَض | السبب المرجَّح | الإصلاح |
|---|---|---|
| عدد الاستعلامات يزداد مع حجم الصفحة | N+1 | التحميل المسبق بـ `with()` |
| استعلام واحد بطيء على جدول كبير | فهرس مفقود | أضف فهرساً؛ وتأكّد بـ `EXPLAIN ANALYZE` |
| نقطة النهاية بطيئة لكن الاستعلامات سريعة | عمل بطيء داخل الطلب (بريد، أو استدعاء HTTP، أو استدعاء نموذج لغوي) | انقله إلى مهمة في الطابور |
| البيانات نفسها تُحمَّل في كل طلب | لا تخزين مؤقت | خزّن مؤقتاً مع قاعدة إبطال واضحة |
| أخطاء لا تظهر إلا تحت الحِمل | حالات التسابق، وحدود الاتصالات | الأقفال، والقيود، وضبط حجم مجمّع الاتصالات |

### طوابير المهام، والمهام، والأحداث

**المهمة** (Job) وحدة عمل يمكن تشغيلها لاحقاً في عامل خلفي (Worker). و**الحدث** (Event) يعلن أن شيئاً ما حدث. و**المستمع** (Listener) يستجيب لحدث، غالباً بوضع مهام في الطابور. وهذا يُبقي متحكم الحجز صغيراً: يحجز، ويعلن، ويُرجع الاستجابة.

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

الحدث:

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

المستمع هو `App\Listeners\QueueBookingJobs` (يكتشف Laravel المستمعين في `app/Listeners` تلقائياً من نوع وسيط الدالة `handle`). وكل مهمة تختار طابورها في مُنشئها (`$this->onQueue('dispatch')` و`$this->onQueue('notifications')`):

```php
public function handle(ShipmentBooked $event): void
{
    AssignVehicleJob::dispatch($event->shipment);
    SendBookingConfirmationJob::dispatch($event->shipment);
}
```

::: warning
الدالة `BookingService::book()` تُطلق `ShipmentBooked` *داخل* معاملة قاعدة البيانات الخاصة بها. والحدث العادي كان سيشغّل المستمع فوراً، وقد يلتقط عامل سريع المهمة `AssignVehicleJob` قبل تثبيت المعاملة (Commit)، فلا يجد الشحنة (أو قد تتراجع المعاملة بعدها). وتنفيذ `ShouldDispatchAfterCommit` يخبر Laravel أن يحتجز الحدث حتى تُثبَّت المعاملة، وأن يُسقطه إن تراجعت المعاملة.
:::

**Horizon** يدير عمّال طوابير Redis ويمنحك لوحة تحكم على `/horizon`. وتستخدم شحنة أربعة طوابير:

| الطابور | العمل | لماذا منفصل |
|---|---|---|
| `default` | أعمال متفرّقة | — |
| `dispatch` | إسناد المركبات | حرج للعمل، ويجب ألا ينتظر خلف رسائل البريد |
| `notifications` | رسائل البريد والرسائل | يحتمل البطء؛ والخدمات الخارجية تفشل أحياناً |
| `ai` | مهام النموذج اللغوي الطويلة (اليوم الخامس) | بطيئة ومكلفة؛ اعزلها كي لا تعطّل الحجوزات |

شغّل Horizon داخل Sail بـ `sail artisan horizon`. وتُهيَّأ الطوابير لكل مشرف (Supervisor) في `config/horizon.php`.

يجب أن تُكتب المهام بحيث **يمكن تشغيلها أكثر من مرة بأمان**، لأن الطوابير تضمن التسليم *مرة واحدة على الأقل*، لا مرة واحدة بالضبط. فقد تُعاد محاولة مهمة بعد انتهاء المهلة حتى لو نجحت المحاولة الأولى جزئياً.

### حالات التسابق

تحدث حالة التسابق (Race Condition) حين تعتمد النتيجة على توقيت عمليات متزامنة. مهمّتا إسناد تعملان في اللحظة نفسها:

```text
 Job A (shipment 1)                 Job B (shipment 2)
 SELECT available van in TIP  ──>  van #7
                                    SELECT available van in TIP  ──> van #7
 UPDATE van #7 busy, assign
                                    UPDATE van #7 busy, assign
 Result: one van, two shipments.
```

الإصلاح هو **قفل الصف** داخل معاملة، فتنتظر المهمة الثانية حتى تُثبَّت الأولى ثم ترى أن الشاحنة الصغيرة مشغولة:

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

تضيف `lockForUpdate()` العبارة `FOR UPDATE` إلى SQL. والمعاملات الأخرى التي تحاول قفل الصف نفسه تنتظر حتى تنتهي هذه. أبقِ المعاملات المقفلة قصيرة.

لاحظ **إعادة الجلب تحت القفل**. فالكائن `$this->shipment` هو النسخة التي سُلسِلت حين وُضعت المهمة في الطابور؛ وحين يشغّلها عامل، ربما يكون مرسِل قد أسند شاحنة أو يكون الزبون قد ألغى. لذا تقرأ المهمة الصف مجدداً بـ `lockForUpdate()` وتفحص الحالة على *تلك* النسخة الحديثة. أما فحص النسخة القديمة الموجودة في الذاكرة فسيكون حالة تسابق. وتتبع `BookingService::cancel()` و`BookingService::assign()` النمط نفسه: `Shipment::lockForUpdate()->findOrFail($shipment->id)` أولاً، ثم القواعد.

حين تجد المهمة مركبة، تُعلِّم `BookingService::assign()` المركبة بالحالة `busy`، وتنقل الشحنة من `confirmed` إلى `assigned`، وتكتب حدثاً مثل "Vehicle 5-1000 assigned.". وحين لا تتوفّر مركبة مناسبة شاغرة، تسجّل المهمة تحذيراً، وتبقى الشحنة `confirmed`، ويستطيع المرسِل إسناد مركبة يدوياً.

نقطة النهاية للتجاوز اليدوي `POST /api/dispatch/shipments/{reference}/assign` (المحتوى `{"vehicle_id": 12}`، للمرسِل أو المسؤول فقط، عبر `ShipmentPolicy::assign`) تقبل الشحنات التي حالتها `confirmed` أو `assigned` أصلاً (لإعادة الإسناد، مع تحرير الشاحنة السابقة). وتستدعي `BookingService::assign()` نفسها، التي تقفل صفّي الشحنة والمركبة كليهما وتعيد فحصهما، لأن المرسِل والمهمة قد يتصرّفان في الوقت نفسه.

### عدم التكرار: مشكلة الحجز المزدوج

زبون في سبها ينقر «احجز» على اتصال 3G ضعيف. يصل الطلب إلى الخادم وتُنشأ الشحنة، لكن الاستجابة تضيع. فيعيد التطبيق المحاولة. ودون حماية، يصبح لدى الزبون شحنتان.

العملية **عديمة التكرار** (Idempotent) تعطي النتيجة نفسها مهما تكرّرت. `GET` و`PUT` عديمتا التكرار بطبيعتهما؛ أما `POST` فليست كذلك. ونجعل `POST /shipments` عديمة التكرار بترويسة `Idempotency-Key`:

```http
POST /api/shipments HTTP/1.1
Authorization: Bearer 12|abc...
Idempotency-Key: 6f1c2a9e-7b1d-4c55-9f0e-2b8e8c1d4a10
Content-Type: application/json

{"quote_id": 381, "pickup_at": "2026-10-22T07:00:00Z"}
```

يولّد العميل مفتاحاً فريداً (UUID) لكل حجز *مقصود* ويعيد استخدامه عند إعادة المحاولة. أما الخادم:

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

البرمجية الوسيطة في المستودع هي `App\Http\Middleware\EnsureIdempotency`، مسجّلة في `bootstrap/app.php` تحت الاسم المستعار `idempotent` ومطبّقة بـ `Route::post('/shipments', ...)->middleware('idempotent')`. وجوهرها:

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

تفاصيل أساسية:

- **احجز المفتاح أولاً، ثم عالج.** يُدرَج صف المفتاح *قبل* تشغيل الحجز. وتعتمد `createOrFirst` على الفهرس الفريد على `(user_id, key)`: فإن وصل طلبان متطابقان في اللحظة نفسها، ينجح إدراج واحد فقط؛ ويحصل الآخر على الصف الموجود ويجيب بـ **409** بينما لا يزال الأول يعمل.
- **مهلة الطلب الجاري.** لو تعطّل عامل بعد حجز مفتاح، لظلّ الصف يحجب ذلك المفتاح إلى الأبد. لذا فإن الحجز الذي لا استجابة له وعمره أكبر من `IN_FLIGHT_TIMEOUT_SECONDS` ‏(60 ثانية) يُعامَل كأنه مهجور ويمكن حجزه مجدداً.
- **لا تُخزَّن إلا الإجابات النهائية.** تُحفظ استجابات 2xx و4xx وتُعاد كما هي؛ أما 5xx فتحذف الصف ليستطيع العميل إعادة المحاولة بالمفتاح نفسه.
- **الانتهاء.** تعيش المفاتيح يوماً واحداً (`expires_at`). والنموذج `IdempotencyKey` من نوع `MassPrunable`، ويحذف الأمر المجدول `model:prune` الصفوف المنتهية يومياً.

| الموقف | الاستجابة |
|---|---|
| لا توجد ترويسة `Idempotency-Key` | 400 |
| مفتاح جديد | استجابة عادية (201)، تُخزَّن |
| المفتاح نفسه، والمحتوى نفسه، وانتهت المعالجة | الحالة والمحتوى المخزّنان، مع `Idempotent-Replayed: true` |
| المفتاح نفسه، والمحتوى نفسه، ولا تزال المعالجة جارية | 409 |
| المفتاح نفسه، ومحتوى مختلف | 422 |

::: warning
الدفاع المتعدّد الطبقات (Defense in Depth) لا يزال مهماً: فقيد التفرّد على `quote_id` في الشحنات، وقراءة عرض السعر المقفلة في `BookingService::book()`، يمنعان مفتاحين *مختلفين* من حجز عرض السعر نفسه (ويحصل الثاني على 422 "This quote has already been booked.").
:::

### طبقات الحماية من الحجز المزدوج

| الطبقة | تحمي من |
|---|---|
| مفتاح عدم التكرار | إعادة العميل محاولة الطلب نفسه |
| التفرّد على `shipments.quote_id` | طلبين مختلفين يحجزان عرض السعر نفسه |
| المعاملة | الحجوزات المكتوبة جزئياً |
| `ShouldDispatchAfterCommit` على `ShipmentBooked` | تشغيل المهام قبل تثبيت الحجز |
| `lockForUpdate` | عاملين يُسندان المركبة نفسها |
| فحص الحالة على الصف المُعاد جلبه والمقفل | إسناد شحنة ملغاة |

## الجلسة (ب): التخزين المؤقت، والحدود، وقابلية المراقبة، والحِمل

### التخزين المؤقت

ذاكرة التخزين المؤقت (Cache) تحفظ نتيجة عمل مكلف لتعيد استخدامها. والجزء الصعب ليس الحفظ؛ بل معرفة متى تصبح القيمة المحفوظة **قديمة** (Stale).

اطرح ثلاثة أسئلة على كل ما تخزّنه مؤقتاً:

1. **كم مرة يتغيّر؟** المدن: تقريباً أبداً. توفّر المركبات: كل دقيقة.
2. **ماذا يحدث إن كان قديماً؟** قائمة مدن قديمة: لا ضرر. سعر قديم: تتقاضى مبلغاً خاطئاً.
3. **كيف سيُبطَل؟** بحسب الوقت (TTL)، أو بحسب الأحداث (المسح عند التغيير)، أو كليهما.

المدن والمسافات مرشّحة مثالية:

```php
public function index()
{
    $cities = Cache::remember(City::CACHE_KEY, now()->addDay(), fn () => City::orderBy('name_en')->get());

    return CityResource::collection($cities);
}
```

وأبطِل الذاكرة المؤقتة حين تتغيّر المدن. يفعل المستودع ذلك بأحداث النموذج في `City`، حيث `CACHE_KEY` تساوي `'cities'`:

```php
protected static function booted(): void
{
    static::saved(fn () => Cache::forget(self::CACHE_KEY));
    static::deleted(fn () => Cache::forget(self::CACHE_KEY));
}
```

كما تخزّن `PricingService::distanceKm()` كل مسافة طريق مؤقتاً لمدة أسبوع تحت المفتاح `distance:{originCityId}:{destinationCityId}`، لأن المسافات لا تتغيّر أبداً.

ما *لا* تخزّنه مؤقتاً: توفّر المركبات أثناء الإسناد (يجب أن يكون مقفلاً وحديثاً)، وأي بيانات خاصة بمستخدم تحت مفتاح مشترك (تسرّب البيانات بين المستخدمين)، والأسعار دون تضمين كل المدخلات في مفتاح التخزين المؤقت.

::: tip
سمِّ مفاتيح التخزين المؤقت ببادئة وبالمدخلات، مثل `distance:1:2`. وحين يظهر خطأ، تستطيع إيجاد المفتاح الصحيح بالضبط وحذفه.
:::

### تحديد المعدّل

حدود المعدّل (Rate Limits) تحمي خدمتك من إساءة الاستخدام، والعملاء المعيبين، والدفعات المكلفة. وبنهاية الدورة تعرّف شحنة محدِّدين اثنين، مفتاحهما المستخدم: `api` اليوم، و`agent` في اليوم الخامس:

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

طبّقهما بالبرمجية الوسيطة `throttle`. يُطبَّق المحدِّد `api` على كل مسار في `routes/api.php` من `bootstrap/app.php`؛ ويضيف مسار الوكيل محدِّده الخاص:

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

حين يُبلَغ الحدّ، يعيد Laravel ‏429 مع ترويسة `Retry-After`. والمحدِّد `agent` أكثر صرامة لأن كل رسالة محادثة تكلّف مالاً حقيقياً من رموز النموذج اللغوي.

### قابلية المراقبة

حين يحدث خلل في الثانية فجراً، تحتاج إلى أن تجيب: *ماذا حدث، ولأي طلب، ولماذا؟* ثلاث أدوات:

**السجلات المهيكلة.** سجّل الأحداث مع سياقها كبيانات مفتاح-قيمة، لا كجمل ملصوقة ببعضها:

```php
Log::info('vehicle.assigned', [
    'shipment' => $shipment->reference,
    'vehicle_id' => $vehicle->id,
    'origin' => $shipment->origin_city_id,
]);
```

السجلات المهيكلة يمكن البحث فيها وعدّها: «كم حدثاً من نوع `vehicle.assigned` في الساعة؟»

**معرّفات الطلبات.** أعطِ كل طلب معرّفاً، وأعِده في ترويسة الاستجابة، وأرفقه بكل سطر في السجلّ. والبرمجية الوسيطة `App\Http\Middleware\AssignRequestId` في المستودع (مضافة في مقدّمة كل طلب في `bootstrap/app.php`) تستخدم `Log::shareContext()`، التي تضيف المعرّف إلى كل سطر سجلّ يُكتب أثناء الطلب:

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

الآن تقودك شكوى زبون تتضمّن معرّف طلب مباشرة إلى كل سطر سجلّ يخصّ ذلك الطلب. ولنقل المعرّف إلى المهام في الطوابير أيضاً، تُمرَّر واجهة `Context` في Laravel ‏(`Context::add('request_id', $requestId)`) إلى المهام التي تُطلق أثناء الطلب؛ وهذا تمرين إضافي جيد.

**لوحات المتابعة (Dashboards).** يقدّم Laravel أداتين رسميتين:

| الأداة | الأنسب لـ |
|---|---|
| Telescope | تصحيح الأخطاء محلياً: كل طلب، واستعلام، ومهمة، واستثناء، بالتفصيل |
| Pulse | نظرة عامة على الإنتاج: الطلبات البطيئة، والاستعلامات البطيئة، والمهام البطيئة، والمستخدمون الأكثر نشاطاً |

ويضيف Horizon مقاييس الطوابير: الإنتاجية، وزمن الانتظار، والمهام الفاشلة.

### اختبار الحِمل بـ k6

k6 أداة لاختبار الحِمل تكتب فيها السيناريوهات بلغة JavaScript. ويبدو سكربت بسيط لا يفعل سوى سرد الشحنات هكذا (احفظه في ملف خاص بك، مثل `load/list.js`):

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

شغّله بـ `k6 run -e TOKEN=your-token load/list.js`.

السكربت الحقيقي في المستودع، `load/booking.js`، أكثر اكتمالاً: يسجّل كل مستخدم افتراضي حسابه الخاص، ثم يكرّر الدورة عرض سعر ← حجز (بمفتاح `Idempotency-Key` جديد) ← سرد. ويتصاعد إلى `VUS` مستخدمين (20 افتراضياً)، ويثبت لمدة دقيقة، ويفحص أن `http_req_failed` أقل من 1%، وأن p95 أقل من 300 ms لطلب السرد وأقل من 500 ms لطلب الحجز:

```bash
k6 run load/booking.js                                          # BASE_URL defaults to http://localhost
k6 run -e BASE_URL=http://localhost -e VUS=50 load/booking.js
```

### قراءة تقرير k6

يطبع الملخّص أسطراً كثيرة. ركّز على هذه:

| المقياس | ماذا يخبرك |
|---|---|
| `http_req_duration` avg, p(90), p(95) | كم تستغرق الطلبات. والمئينات (Percentiles) أهم من المتوسط |
| `http_req_failed` | نسبة الطلبات الفاشلة |
| `http_reqs` | إجمالي الطلبات وعدد الطلبات في الثانية (الإنتاجية) |
| `checks` | نسبة تأكيدات `check()` التي نجحت |
| نتائج العتبات | نجاح أو فشل مقابل أهدافك |

**لماذا المئينات؟** إن استغرق 95 طلباً 100 ms واستغرقت 5 طلبات 4 ثوانٍ، فسيبدو المتوسط جيداً (نحو 300 ms) لكن زبوناً من كل 20 ينتظر 4 ثوانٍ. وp95 يُظهر هذا الألم.

سجّل القيم قبل وبعد في جدول. وهذا جزء من مخرجات مختبرك:

| السيناريو | p95 قبل | p95 بعد | طلبات/ثانية قبل | بعد | التغيير المُنفَّذ |
|---|---|---|---|---|---|
| `GET /shipments` (20 VUs) | رقمك | رقمك | | | التحميل المسبق |
| `GET /cities` (20 VUs) | | | | | التخزين المؤقت |

::: warning
أرقام اختبار الحِمل على حاسوب محمول مشوّشة. شغّل كل سيناريو مرتين على الأقل، وأبقِ كل شيء آخر كما هو، وقارن التغيّر النسبي لا الأرقام المطلقة. ولا تختبر حِمل نظام لا تملكه أبداً.
:::

## بناء الوكلاء داخل النظام الخلفي: لماذا يهمّ التوسع للذكاء الاصطناعي

كل ما تعلّمته اليوم يصبح أكثر أهمية حين يدخل نموذج لغوي في الصورة:

| المفهوم | لماذا يهمّ لمساعد شحنة |
|---|---|
| إخراج العمل البطيء من الطلب | قد يستغرق استدعاء النموذج اللغوي عدة ثوانٍ؛ ومهام الوكيل الطويلة تعمل على الطابور `ai` (اليوم الخامس) |
| تحديد المعدّل | كل رسالة محادثة تكلّف مالاً؛ والمحدِّد `agent` هو 10 في الدقيقة لكل مستخدم |
| عدم التكرار | قد تعيد حلقة الوكيل محاولة أداة؛ ويجب ألا تُنشئ `book_shipment` نسخاً مكرّرة |
| التخزين المؤقت | يمكن تخزين إجابات أسئلة السياسات الشائعة مؤقتاً (اليوم الخامس) |
| قابلية المراقبة | سيُسجَّل كل استدعاء للنموذج اللغوي مع الرموز، والتكلفة، وزمن الاستجابة (`LlmCall`، اليوم الخامس) |
| الأقفال والقيود | أداة الوكيل `book_shipment` تصطدم بقواعد قاعدة البيانات نفسها التي تصطدم بها واجهة البرمجة |

الوكيل الذكي مجرد عميل آخر لنظامك الخلفي — عميل سريع، ومُلحّ، ومرتبك أحياناً. والنظام الخلفي الآمن تحت التزامن وإعادة المحاولات هو نظام خلفي آمن للوكلاء.

## كيف تعمل مع وكيلك على هذا

الوكلاء بارعون في اكتشاف أنماط مثل N+1. وبارعون أيضاً في الادعاء بثقة بتحسينات لم تحدث. استخدمهم لـ*الإيجاد* و*الاقتراح*؛ واستخدم القياسات لـ*القرار*.

::: agent
استخدم أداة database-query والشيفرة في ShipmentController@index وShipmentResource لإيجاد استعلامات N+1 في GET /api/shipments. أخبرني كم استعلاماً يعمل لصفحة من 20 شحنة ولماذا. لا تغيّر الشيفرة بعد.

بالإنجليزية: `Use the database-query tool and the code in ShipmentController@index and ShipmentResource to find N+1 queries in GET /api/shipments. Tell me how many queries run for a page of 20 shipments and why. Do not change code yet.`
:::

::: agent
اكتب اختبار Pest يفشل إن شغّل GET /api/shipments أكثر من 5 استعلامات لـ 20 شحنة. استخدم DB::enableQueryLog() أو بديلاً مكافئاً تستطيع التأكّد من وجوده في Laravel 12. ثم أصلح مشكلة N+1 وأرني الاختبار ناجحاً.

بالإنجليزية: `Write a Pest test that fails if GET /api/shipments runs more than 5 queries for 20 shipments. Use DB::enableQueryLog() or an equivalent you can confirm exists in Laravel 12. Then fix the N+1 and show the test passing.`
:::

::: agent
نفّذ AssignVehicleJob الموصوفة في docs/plans/day3-async.md. استخدم معاملة مع lockForUpdate على الشحنة والمركبة كلتيهما. يجب أن يكون تشغيل المهمة مرتين آمناً. اكتب اختباراً يشغّل المهمة مرتين ويتحقّق من أن مركبة واحدة بالضبط مشغولة وأن حدث إسناد واحداً موجود.

بالإنجليزية: `Implement the AssignVehicleJob described in docs/plans/day3-async.md. Use a transaction with lockForUpdate on both the shipment and the vehicle. The job must be safe to run twice. Write a test that runs the job twice and asserts exactly one vehicle is busy and one assigned event exists.`
:::

للتحقق من ادعاءات الأداء:

::: agent
قلت إن التخزين المؤقت للمدن يجعل GET /api/cities أسرع. أعطني أمر k6 الدقيق لقياس ذلك قبل وبعد، والمقياس الذي يجب أن أقارنه. لا تقدّر التحسّن؛ سأشغّله بنفسي.

بالإنجليزية: `You said caching cities makes GET /api/cities faster. Give me the exact k6 command to measure it before and after, and the metric I should compare. Do not estimate the improvement; I will run it.`
:::

## أخطاء شائعة

- **قبول «أصبح هذا أسرع بعشر مرات» دون قياس.** الوكيل لا يستطيع القياس على حاسوبك. أنت تستطيع.
- **إطلاق المهام داخل معاملة** فيشغّلها العمّال قبل التثبيت.
- **مهام غير آمنة لإعادة المحاولة.** افحص دائماً الحالة الراهنة في بداية المهمة.
- **معاملات طويلة تمسك بالأقفال** أثناء استدعاء خدمات بطيئة (البريد، وHTTP، والنماذج اللغوية). اقفل، وغيّر، وثبّت، ثم أنجز العمل البطيء.
- **تخزين بيانات خاصة بالمستخدم مؤقتاً تحت مفتاح مشترك.** فيرى زبون بيانات زبون آخر.
- **نسيان الإبطال.** ذاكرة مؤقتة بلا خطة إبطال خطأ مؤجَّل.
- **تحديد المعدّل بعنوان IP فقط.** كثير من المستخدمين خلف شركة اتصالات واحدة يتشاركون عناوين IP. اجعل المفتاح معرّف المستخدم حين يكون مصادَقاً عليه.
- **اختبار الحِمل مرة واحدة.** التشغيلات المفردة مجرد تشويش.

## أهم الخلاصات

- أبقِ خوادم التطبيق عديمة الحالة؛ ووسّعها أفقياً؛ واحمِ قاعدة البيانات.
- اكتشف N+1 بعدّ الاستعلامات وأصلحه بالتحميل المسبق. وتأكّد من الاستعلامات البطيئة بـ `EXPLAIN ANALYZE`.
- انقل العمل البطيء إلى الطوابير عبر الأحداث والمهام؛ وافصل الطوابير بحسب الأولوية؛ واكتب مهام يمكن تشغيلها مرتين بأمان.
- امنع الحجز المزدوج بطبقات: مفاتيح عدم التكرار، وقيود التفرّد، والمعاملات، وأقفال الصفوف.
- خزّن مؤقتاً ما نادراً ما يتغيّر ولا ضرر من قِدَمه؛ واحرص دائماً على خطة إبطال.
- حدّد المعدّل لكل مستخدم؛ ونقطة نهاية الوكيل تحصل على حدّ أكثر صرامة.
- راقب بالسجلات المهيكلة، ومعرّفات الطلبات، ولوحات المتابعة.
- قِس بـ k6 وبالمئينات. الوكيل يقترح؛ والأرقام تقرّر.

## أسئلة التقييم الذاتي

1. ماذا يعني «خادم تطبيق عديم الحالة»، ولماذا يجعل التوسع الأفقي سهلاً؟
2. صفحة من 50 شحنة تعرض اسمي مدينتي المصدر والوجهة. كم استعلاماً يعمل مع التحميل المسبق ودونه؟
3. لماذا يجب ألا تعمل `SendBookingConfirmationJob` داخل طلب الحجز؟
4. لماذا يجب أن تكون المهام في الطوابير آمنة للتشغيل أكثر من مرة؟
5. اشرح كيف تمنع `lockForUpdate()` مهمّتين من إسناد المركبة نفسها.
6. عميل يعيد محاولة `POST /shipments` بالمفتاح `Idempotency-Key` نفسه والمحتوى نفسه. ماذا يجب أن يعيد الخادم؟
7. المفتاح نفسه، ومحتوى مختلف. ماذا يجب أن يحدث ولماذا؟
8. اذكر شيئاً واحداً من الجيد تخزينه مؤقتاً في شحنة، وشيئاً واحداً من الخطر تخزينه مؤقتاً.
9. لماذا يكون زمن الاستجابة p95 أكثر فائدة من متوسط زمن الاستجابة؟
10. يدّعي الوكيل أن تغييراً جعل نقطة نهاية «أسرع بكثير». ماذا تفعل؟

### الإجابات

1. لا يحتفظ الخادم بأي حالة مهمة بين الطلبات؛ فالجلسات والتخزين المؤقت والبيانات تعيش في Redis وPostgreSQL. ويستطيع أي خادم معالجة أي طلب، فتضيف خوادم خلف موازن حمل (Load Balancer) لاستيعاب حركة أكبر.
2. دون التحميل المسبق: 1 + 50 + 50 = 101 استعلام. ومع `with(['origin', 'destination'])`: ‏3 استعلامات.
3. إرسال البريد يعتمد على خدمة خارجية قد تكون بطيئة أو تفشل؛ ولا ينبغي أن ينتظرها الزبون أو يرى خطأً بسببها.
4. الطوابير تسلّم مرة واحدة على الأقل؛ وقد تُعاد محاولة مهمة بعد انتهاء المهلة أو تعطّل حتى لو عملت جزئياً.
5. تقفل صف المركبة المختارة داخل معاملة. والمعاملة الثانية التي تحاول قفل الصف نفسه تنتظر حتى تُثبَّت الأولى، ثم ترى أن المركبة مشغولة أصلاً فتتخطّاها.
6. الاستجابة المخزّنة من الطلب الأول (الحالة والمحتوى نفسيهما، مع الترويسة `Idempotent-Replayed: true`)، دون إنشاء شحنة جديدة. وإن كان الطلب الأول لا يزال قيد التشغيل، فيحصل على 409 بدلاً من ذلك.
7. يُرفض (422 في تصميمنا)، لأن إعادة استخدام مفتاح لطلب مختلف خطأ من العميل، وإعادة الاستجابة القديمة ستكون مضلّلة.
8. جيد: قائمة المدن أو المسافات (نادراً ما تتغيّر، ولا ضرر إن كانت قديمة لفترة وجيزة). خطر: توفّر المركبات أثناء الإسناد، أو بيانات خاصة بمستخدم تحت مفتاح مشترك.
9. المتوسط يخفي القيم الشاذة البطيئة؛ أما p95 فيُظهر تجربة أبطأ 5% من الطلبات، التي يشعر بها زبائن حقيقيون.
10. اطلب طريقة القياس الدقيقة، وشغّل اختبار k6 قبل/بعد بنفسك (مرتين على الأقل)، ولا تقبل الادعاء إلا إن دعمته الأرقام.
