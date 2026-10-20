# اليوم الأول — العمل مع الوكلاء الذكيين

تتعرّف اليوم إلى أداتيك الرئيسيتين: وكيل البرمجة الذكي (AI Coding Agent) الذي ستعمل معه طوال الأسبوع، وإطار عمل Laravel الذي ستبني به. وبنهاية اليوم ستكون قاعدة بيانات شحنة موجودة، مملوءة بالمدن الليبية والناقلين والشاحنات، وستكون قد كتبت أول ملف خطة وأول اختبار لك والوكيل إلى جانبك.

## أهداف التعلّم

بنهاية اليوم الأول يجب أن تكون قادراً على أن:

- تشرح بكلمات بسيطة كيف يعمل وكيل البرمجة المبني على نموذج لغوي كبير (LLM): النموذج، ونافذة السياق (Context Window)، والأدوات (Tools)، والحلقة (Loop).
- تشرح لماذا يهلوس الوكلاء، وتذكر ثلاث طرق للحدّ من ذلك.
- تُعدّ Claude Code مع Laravel Boost وتكتب ملف `CLAUDE.md` مفيداً.
- تستخدم حلقة **استكشف ← خطّط ← نفّذ ← تحقّق (Explore → Plan → Implement → Verify)** على مهمة حقيقية.
- تصف دورة حياة الطلب (Request Lifecycle) في Laravel وأدوار المسارات (Routes)، والمتحكمات (Controllers)، والنماذج (Models)، والترحيلات (Migrations)، وartisan، وحاوية الخدمات (Service Container).
- تُنشئ نماذج Eloquent، وترحيلات، ومصانع (Factories)، وبذّارات (Seeders)، وتعداداً (Enum) بلغة PHP.
- تقرأ فرقاً (Diff) ولّده الذكاء الاصطناعي بعين ناقدة وتقرّر ما تُبقي عليه.

## الجلسة (أ): كيف يعمل الوكلاء، وجولة في Laravel

### ما النموذج اللغوي الكبير؟

النموذج اللغوي الكبير (LLM) برنامج دُرِّب على كمية هائلة من النصوص ليؤدي شيئاً واحداً: إذا أُعطي نصاً ما، يتنبّأ بالنص الذي يليه. وكل ما عدا ذلك — الإجابة عن الأسئلة، وكتابة الشيفرة، واستدعاء الأدوات — مبني فوق هذه القدرة الواحدة.

ثلاث أفكار تهمّك في العمل اليومي:

**الرموز (Tokens).** النماذج لا تقرأ حروفاً ولا كلمات. إنها تقرأ *رموزاً*، أي قطعاً صغيرة من النص. الكلمة الإنجليزية القصيرة غالباً رمز واحد؛ أما الكلمة الطويلة أو قطعة الشيفرة فقد تكون عدة رموز. والنص العربي يستهلك عادةً رموزاً أكثر للكلمة الواحدة مقارنة بالإنجليزية. وتهمّ الرموز لأنك تدفع مقابل كل رمز، ولأن لكل نموذج حداً أقصى من الرموز يستطيع التعامل معه دفعة واحدة.

**نافذة السياق.** هي كل ما يستطيع النموذج «رؤيته» في طلب واحد: تعليمات النظام، والمحادثة حتى الآن، والملفات التي قُرئت، ونتائج الأدوات، ورسالتك الأخيرة. ليس للنموذج أي ذاكرة أخرى. فإن لم يكن شيء ما في نافذة السياق، فالنموذج لا يعرفه — إلا إن كان ضمن بيانات تدريبه، وقد تكون قديمة أو خاطئة بالنسبة لمشروعك.

**التنبّؤ بالرمز التالي احتمالي.** يختار النموذج التتمّات المرجَّحة. وفي أغلب الأحيان يكون المرجَّح صحيحاً أيضاً. لكنه أحياناً يكون مجرد *معقول الشكل*.

### لماذا يهلوس الوكلاء

الهلوسة (Hallucination) مخرجات تبدو واثقة وصحيحة لكنها خاطئة: دالة غير موجودة، أو مفتاح إعدادات تغيّر اسمه قبل إصدارين، أو اختبار «ينجح» لكنه لا يتحقّق من شيء.

يحدث ذلك لأن النموذج يُكمل نمطاً. فإن كانت مكتبات كثيرة تحتوي دالة باسم `->withTimeout()`، فقد «يتنبّأ» النموذج بأن مكتبتك تحتويها أيضاً. وليس لدى النموذج إحساس مدمج بعبارة «لا أعرف».

| السبب | مثال | كيف تحدّ منه |
|---|---|---|
| سياق ناقص | الوكيل يخمّن أعمدة جدولك | دعه يقرأ المخطط (أداة Boost ‏`database-schema`) |
| بيانات تدريب قديمة | يستخدم البرمجيات الوسيطة بأسلوب `Kernel.php` من Laravel 8 | وجّهه إلى وثائق خاصة بالإصدار (Boost ‏`search-docs`) |
| إكمال النمط | يخترع دالة معقولة الشكل في حزمة ما | اطلب منه أن يريك أين عُرّفت الدالة في `vendor/` |
| غياب التغذية الراجعة | يدّعي أن الشيفرة تعمل دون تشغيلها | اجعله يشغّل `php artisan test` ويُظهر الناتج |

القاعدة العامة: **ثبّت الوكيل على حقائق من مشروعك، وأغلق الحلقة بشيء يمكن أن يفشل** (اختبار، أو أمر، أو استعلام).

### ماذا تعني «الوكالية»

روبوت المحادثة العادي يجيب مرة واحدة. أما **الوكيل** (Agent) فيعمل في حلقة:

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

النموذج نفسه لا يلمس حاسوبك أبداً. إنه *يطلب* استدعاء أداة («اقرأ الملف `app/Models/Shipment.php`»)، فيشغّلها برنامج الوكيل (Claude Code)، وتعود النتيجة إلى نافذة السياق. ثم يقرّر النموذج الخطوة التالية.

وهذه الحلقة نفسها هي ما ستبنيه *داخل* شحنة في اليوم الرابع. سيفكّر مساعد شحنة، ويستدعي أدوات مثل `get_quote` أو `track_shipment`، ويلاحظ النتائج، ثم يجيب. انتبه إلى سلوك Claude Code اليوم؛ فأنت تدرس التصميم الذي ستنفّذه لاحقاً.

### تشريح Claude Code

Claude Code وكيل يعمل من سطر الأوامر. تشغّله داخل مجلد مشروعك:

```bash
cd shahna-api
claude
```

أجزاؤه الرئيسية:

| الجزء | ماذا يفعل | لماذا يهمّك |
|---|---|---|
| **النموذج** | النموذج اللغوي الذي يقوم بالاستدلال | الجودة والتكلفة تعتمدان عليه |
| **الأدوات** | قراءة الملفات، وتعديلها، والبحث، وتشغيل أوامر الطرفية، وجلب صفحات الويب | بها يتصرّف في مشروعك |
| **الأذونات** | قواعد تحدّد أي الأدوات تحتاج إلى موافقتك | تبقى متحكّماً في الآثار الجانبية |
| **`CLAUDE.md`** | ملف في مستودعك يُحمَّل في السياق مع بداية كل جلسة | أعراف مشروعك، حاضرة دائماً |
| **خوادم MCP** | أدوات إضافية من برامج خارجية (Model Context Protocol) | هنا يتّصل Boost |
| **أوامر الشرطة المائلة** | أوامر مدمجة مثل `/clear` و`/compact` و`/mcp` | لإدارة الجلسة |

**الأذونات (Permissions)** تستحق الانتباه. افتراضياً يسألك Claude Code قبل تعديل الملفات أو تشغيل الأوامر. تستطيع الموافقة مرة واحدة، أو الموافقة طوال الجلسة، أو الرفض. وحين يطلب تشغيل أمر، *اقرأ الأمر*. الموافقة على `sail artisan migrate:fresh --seed` على قاعدة بياناتك المحلية لا بأس بها. أما الموافقة على شيء لا تفهمه فليست كذلك.

**وضع التخطيط (Plan Mode)** وضع يستطيع فيه الوكيل القراءة والتفكير دون التعديل. تستطيع التبديل بين الأوضاع بـ Shift+Tab. استخدمه للاستكشاف والتخطيط.

**`CLAUDE.md`** أكثر الميزات استخفافاً بقيمتها. إنه ملف Markdown عادي يخبر الوكيل كيف يعمل مشروعك. والوسم `day1-start` يحتوي واحداً بالفعل. وملف `CLAUDE.md` الجيد قصير ومحدّد:

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
حين يكرّر الوكيل الخطأ نفسه مرتين، أضف سطراً إلى `CLAUDE.md`. فهذا الملف هو طريقتك لتعليم الوكيل مشروعك مرة واحدة بدلاً من تعليمه في كل جلسة.
:::

### Laravel Boost

Laravel Boost خادم MCP مبني لمشاريع Laravel. الحزمة موجودة أصلاً في `composer.json` عند `day1-start`؛ وتثبّتها في مشروعك بالأمر `sail artisan boost:install` (اختر Claude Code)، فيكتب `.mcp.json` ليشغّل Claude Code الخادم بالأمر `php artisan boost:mcp`. ويمنح Claude Code أدوات تقرأ *تطبيقك أنت*، لا تطبيق Laravel المتوسط على الإنترنت. ومن بينها:

| أداة Boost | ما تقدّمه للوكيل |
|---|---|
| `search-docs` | بحث في الوثائق مطابق لإصدارات الحزم المثبّتة لديك |
| `database-schema` | جداولك وأعمدتك وفهارسك الحقيقية |
| `database-query` | تشغيل استعلام قراءة على قاعدة بياناتك |
| `tinker` | تنفيذ PHP داخل تطبيقك (مثل `php artisan tinker`) |
| `last-error` | آخر استثناء في سجلاتك |
| `read-log-entries` | أسطر السجلّ الأخيرة |

ويثبّت Boost أيضاً إرشادات خاصة بـ Laravel للوكيل. وتستطيع التحقق من اتصال الخادم بكتابة `/mcp` داخل Claude Code والبحث عن `laravel-boost`.

::: warning
قد تتغيّر قائمة أدوات Boost بين إصداراته. شغّل `/mcp` لترى ما يقدّمه التثبيت لديك.
:::

### جولة في Laravel

Laravel إطار عمل ويب بلغة PHP. ستبني في الغالب واجهة برمجة JSON، لذا نركّز على أجزاء النظام الخلفي.

**PHP في 60 ثانية.** تبدأ المتغيرات بـ `$`. وتنتهي التعليمات بـ `;`. وتعيش الأصناف في مساحات أسماء (Namespaces) تطابق المجلدات (`App\Models\Shipment` موجود في `app/Models/Shipment.php`). يستدعي `->` دالة على كائن؛ ويستدعي `::` دالة ساكنة أو يقرأ ثابتاً. وتستخدم المصفوفات `[]` ويمكن أن تكون قوائم أو خرائط مفتاح-قيمة: `['name' => 'Tripoli']`. وفي PHP 8 أنواع، وتعدادات، ووسائط مسمّاة، وتعابير `match` — وسترى كل ذلك.

**دورة حياة الطلب.** حين يصل طلب مثل `GET /api/cities`:

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

**المسارات** تربط عناوين URL بالشيفرة:

```php
// routes/api.php
use App\Http\Controllers\Api\CityController;
use Illuminate\Support\Facades\Route;

Route::get('/cities', [CityController::class, 'index']);
```

المسارات في `routes/api.php` تحصل تلقائياً على البادئة `/api`.

**MVC.** يتبع Laravel نمط النموذج–العرض–المتحكم (Model–View–Controller). وفي واجهة البرمجة، «العرض» هو استجابة JSON، وتُشكَّل عادةً بواسطة *مورد واجهة* (API Resource) (اليوم الثاني). النماذج تتحدّث مع قاعدة البيانات. والمتحكمات تربط الطلبات بالنماذج والخدمات.

**Eloquent** هو أداة الربط الكائني العلائقي (ORM) في Laravel: لكل جدول في قاعدة البيانات صنف نموذج، وكل صف يصبح كائناً.

```php
$tripoli = City::where('code', 'TIP')->first();
$tripoli->name_ar;                      // "طرابلس"
$vans = Vehicle::where('type', 'van')->where('status', 'available')->get();
```

**الترحيلات** تغييرات على قاعدة البيانات خاضعة لنظام التحكم بالإصدارات، ومكتوبة بـ PHP. ولا تعدّل قاعدة البيانات يدوياً أبداً.

**Artisan** أداة سطر الأوامر في Laravel. وعبر Sail تشغّلها هكذا: `sail artisan ...`. ستستخدم `make:model` و`migrate` و`db:seed` و`test` و`tinker` و`route:list` باستمرار.

**حاوية الخدمات** تُنشئ الكائنات لك وتمرّر إليها اعتمادياتها. فإن طلب مُنشئ متحكم أو إحدى دواله `PricingService`، يبني Laravel واحدة ويسلّمها له. ويسمّى هذا *حقن الاعتماديات* (Dependency Injection)، وهو سبب بقاء شيفرتك سهلة الاختبار: ففي الاختبار تستطيع استبدال الخدمة الحقيقية بأخرى مزيّفة.

```php
class QuoteController extends Controller
{
    public function store(StoreQuoteRequest $request, PricingService $pricing)
    {
        // Laravel created both $request and $pricing for us.
    }
}
```

## الجلسة (ب): المواصفات أولاً، ثم النماذج

### التطوير بالمواصفات أولاً

الوكيل سريع جداً في كتابة الشيفرة. وهذه السرعة خطيرة حين لم يقرّر أحد *ماذا* سيُبنى. والتطوير بالمواصفات أولاً (Spec-first) يعني أن تكتب النيّة قبل أي شيفرة:

1. **المتطلبات** (`docs/requirements.md`): ما الذي يفعله المنتج، بلغة العمل. موجود أصلاً في المستودع.
2. **الخطة** (`docs/plans/day1-domain.md`): كيف ستبني جزءاً واحداً — الجداول، والأعمدة، والعلاقات، والقواعد، والاختبارات، وترتيب الخطوات.
3. **الشيفرة**، تُنتَج بخطوات صغيرة تتبع الخطة.

ملف الخطة عقد بينك وبين الوكيل. تراجعه *قبل* وجود أي شيفرة، حين تكون التغييرات رخيصة.

### حلقة استكشف ← خطّط ← نفّذ ← تحقّق

هذه طريقة العمل للدورة كلها.

| الخطوة | ما تفعله أنت | ما يفعله الوكيل | الناتج |
|---|---|---|---|
| **استكشف** | تطرح أسئلة عن قاعدة الشيفرة | يقرأ الملفات والمخطط والوثائق | فهم مشترك |
| **خطّط** | تراجع، وتعترض، وتعدّل | يكتب مسودة ملف الخطة | `docs/plans/*.md` وافقت عليه |
| **نفّذ** | توافق على خطوات صغيرة، وتقرأ الفروق | يكتب الشيفرة خطوة بخطوة | تغييرات صغيرة قابلة للمراجعة |
| **تحقّق** | تشغّل الاختبارات وتقرؤها، وتجرّب الطلبات | يشغّل الاختبارات ويصلح الإخفاقات | دليل على أنها تعمل |

تخطّي الاستكشاف يؤدي إلى شيفرة تتجاهل ما هو موجود أصلاً. وتخطّي التخطيط يؤدي إلى الإفراط في التهيئة (Over-scaffolding). وتخطّي التحقق يؤدي إلى أخطاء واثقة.

### ملف خطة ينجح

الخطة الجيدة قصيرة بما يكفي لمراجعتها في خمس دقائق، ومحدّدة بما يكفي لأن يبني منها مهندسان الشيء نفسه.

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

لاحظ قسم «خارج النطاق» (Out of scope). إنه يمنع الوكيل من توليد متحكمات لم تطلبها «من باب المساعدة».

### الترحيلات

ولّد نموذجاً مع ترحيله ومصنعه بأمر واحد:

```bash
sail artisan make:model Vehicle -mf
```

الترحيل يصف الجدول:

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

أمور تتحقّق منها في كل ترحيل، وخاصة ما يكتبه الذكاء الاصطناعي:

- المفاتيح الأجنبية (Foreign Keys) تستخدم `foreignId(...)->constrained()` لتفرضها قاعدة البيانات.
- المال `decimal('price_lyd', 10, 2)`، وليس `float` أبداً.
- الأعمدة التي يجب أن تكون فريدة (`code` و`plate` و`reference` و`quote_id`) عليها `->unique()`.
- تعمل الترحيلات بترتيب تكون فيه الجداول المشار إليها موجودة مسبقاً.
- الدالة `down()` تعكس فعلاً ما تفعله `up()`.

شغّلها:

```bash
sail artisan migrate          # apply new migrations
sail artisan migrate:fresh --seed   # drop everything, rebuild, seed (local only!)
```

::: warning
الأمر `migrate:fresh` يحذف كل البيانات. إنه مثالي على حاسوبك المحمول وكارثة في بيئة الإنتاج. اقرأ كل أمر يقترحه الوكيل قبل الموافقة عليه.
:::

### التعدادات: آلة حالات الشحنة

في PHP 8.1+ تعدادات أصلية. والتعداد *المدعوم* (Backed Enum) يربط كل حالة فيه بنص يُخزَّن في قاعدة البيانات.

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

لماذا نضع القواعد داخل التعداد؟ لأن *كل* مسار حينها — واجهة البرمجة، وإجراء المرسِل، والمهمة في الطابور، وفي اليوم الرابع أداة `cancel_shipment` الخاصة بالوكيل الذكي — يستخدم القاعدة نفسها. مكان واحد للقراءة، ومكان واحد للاختبار.

### النماذج، والتحويلات، والعلاقات

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

الدالة `casts()` تحوّل النص المخزّن في قاعدة البيانات `'in_transit'` إلى `ShipmentStatus::InTransit` عند القراءة، وتعيده نصاً عند الحفظ. والتحويل (Cast) ‏`decimal:2` يُبقي المال نصاً مثل `"876.00"` بدلاً من عدد عشري عائم (Float).

تسرد `$fillable` الأعمدة المسموح بها في الإسناد الجماعي (Mass Assignment) ‏(`Shipment::create([...])`). وستتعلّم في اليوم الثاني لماذا يهمّ هذا للأمان.

### المصانع والبذّارات

**المصانع** تُنشئ صفوفاً مزيّفة للاختبارات:

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

**البذّارات** تملأ قاعدة البيانات ببيانات بداية معروفة — مدننا الثماني، والمسافات، والناقلين، والمركبات:

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

الدالة `updateOrCreate` تجعل تشغيل البذّارة مرتين آمناً. ويجب بذر المسافات في الاتجاهين (TIP→BEN وBEN→TIP)، وإلا فعلى شيفرة التسعير البحث بأي من الترتيبين. قرّر أيهما في خطتك.

### اختبارك الأول

اختبارات Pest تُقرأ تقريباً كالجمل:

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

الاختبار الأخير يستخدم *مجموعة بيانات* (Dataset): يعمل مرة لكل حالة. شغّل الاختبارات بـ:

```bash
sail artisan test
sail artisan test --filter=ShipmentStatus
```

### مراجعة الفرق

بعد أن يعدّل الوكيل الملفات، راجع التغييرات كما يراجع مهندس خبير طلب دمج (Pull Request) لزميله:

```bash
git status            # which files changed?
git diff              # what changed in them?
git diff --stat       # how big is the change?
```

اسأل نفسك:

1. **النطاق.** هل غيّر فقط ما طلبته الخطة؟ الملفات الجديدة غير المتوقعة إشارة خطر.
2. **الصحة.** هل تطابق أنواع الأعمدة والقيود وقيم التعدادات المواصفات؟
3. **الوجود.** هل كل دالة وصنف يستخدمه موجود فعلاً؟ إن لم تكن متأكداً، فابحث في `vendor/` أو اسأل أداة Boost ‏`search-docs`.
4. **الاختبارات.** هل يوجد اختبار، وهل يختبر *السلوك* أم مجرد أن الشيفرة تعمل؟
5. **الوضوح.** هل تستطيع شرح هذه الشيفرة لقائد فريقك غداً؟

أودِع على خطوات صغيرة ليسهل التراجع عن أي خطوة سيئة:

```bash
git add -p                     # stage chunk by chunk, reading each one
git commit -m "Add ShipmentStatus enum with transition rules"
```

### متى لا تستخدم الوكيل

الوكيل ليس دائماً الطريق الأسرع.

| الموقف | الخيار الأفضل |
|---|---|
| تغيير من سطر واحد تعرفه أصلاً | اكتبه بنفسك |
| تعلّم مفهوم لأول مرة | اقرأ الوثائق، واكتبه بيدك مرة، ثم استخدم الوكيل |
| الأسرار، وبيانات الاعتماد، وبيانات الإنتاج | أبعدها عن التعليمات |
| قرار يحتاج إلى سياق عمل لا يملكه سواك | قرّر أولاً، ثم دع الوكيل ينفّذ |
| لا تستطيع الحكم على صحة الناتج | تعلّم ما يكفي أولاً، أو اعمل مع زميل بشري |

اختبار مفيد: *لو أعطاني الوكيل هنا إجابة خاطئة، هل كنت سألاحظ؟* إن لم يكن كذلك، فتمهّل.

## بناء الوكلاء داخل النظام الخلفي: لمحة مسبقة

كل ما تعلّمته هذا الصباح عن Claude Code — النموذج، والسياق، والأدوات، والحلقة، والأذونات — هو المخطط الهندسي لمساعد شحنة. قارن:

| Claude Code (اليوم) | مساعد شحنة (اليوم الرابع) |
|---|---|
| تعليمات النظام + `CLAUDE.md` | تعليمات نظام (System Prompt) تصف قواعد شحنة |
| الأدوات: القراءة، والتعديل، وbash، وBoost | الأدوات: `get_quote`، `book_shipment`، `track_shipment`، `cancel_shipment`، `search_policies`، `escalate_to_human` |
| يطلب الإذن قبل الآثار الجانبية | `book_shipment` يتطلّب `confirmed: true` بعد سؤال الزبون |
| حلقة حتى الانتهاء | حلقة بحدّ أقصى 6 خطوات |
| يهلوس دون تثبيت على الحقائق | مثبَّت على الحقائق عبر `search_policies` على وثائق سياسات حقيقية |

قاعدة `ShipmentStatus::canTransitionTo()` التي تكتبها اليوم ستحمي أداة الوكيل `cancel_shipment` في اليوم الرابع. شيفرة المجال (Domain) الجيدة هي أفضل ضابط حماية (Guardrail) لميزات الذكاء الاصطناعي.

## كيف تعمل مع وكيلك على هذا

ابدأ كل مهمة بالاستكشاف، في وضع التخطيط، قبل أي تعديل.

::: agent
اقرأ CLAUDE.md وdocs/requirements.md. ثم استخدم أداة database-schema لسرد الجداول الحالية. لخّص ما هو موجود وما الذي لا يزال مجال شحنة يحتاج إليه. لا تعدّل أي ملفات.

بالإنجليزية: `Read CLAUDE.md and docs/requirements.md. Then use the database-schema tool to list the current tables. Summarize what exists and what the Shahna domain still needs. Do not edit any files.`
:::

::: agent
اكتب مسودة docs/plans/day1-domain.md لهذه النماذج: City وCityDistance وCarrier وVehicle وQuote وShipment وShipmentEvent. استخدم قائمة الحقول في docs/requirements.md. لكل جدول اذكر الأعمدة، والأنواع، والمفاتيح الأجنبية، وقيود التفرّد، والفهارس. أضف قسم "Out of scope". يجب أن يكون المال decimal(10,2). لا تكتب أي شيفرة بعد.

بالإنجليزية: `Draft docs/plans/day1-domain.md for these models: City, CityDistance, Carrier, Vehicle, Quote, Shipment, ShipmentEvent. Use the field list in docs/requirements.md. For each table give columns, types, foreign keys, unique constraints, and indexes. Include an "Out of scope" section. Money must be decimal(10,2). Do not write any code yet.`
:::

بعد أن تعدّل الخطة وتوافق عليها:

::: agent
نفّذ الخطوة 1 فقط من docs/plans/day1-domain.md: التعداد ShipmentStatus في app/Enums مع canTransitionTo()، واختبار وحدة بـ Pest يغطي كل انتقال مسموح وممنوع. اكتب الاختبار أولاً، وشغّله لترى فشله، ثم نفّذ. أرني ناتج الاختبار.

بالإنجليزية: `Implement step 1 of docs/plans/day1-domain.md only: the ShipmentStatus enum in app/Enums with canTransitionTo(), and a Pest unit test covering every allowed and forbidden transition. Write the test first, run it to see it fail, then implement. Show me the test output.`
:::

::: agent
قبل استخدام أي دالة في Laravel لست متأكداً من وجودها في Laravel 12، تحقّق منها بـ search-docs وأخبرني أي صفحة في الوثائق أكّدت ذلك.

بالإنجليزية: `Before using any Laravel method you are not sure exists in Laravel 12, check it with search-docs and tell me which doc page confirmed it.`
:::

حين تشكّ في وجود هلوسة:

::: agent
أين عُرّفت بالضبط الدالة التي استخدمتها للتو؟ أرني مسار الملف في vendor/ وتوقيع الدالة. وإن لم تجدها، فقل ذلك.

بالإنجليزية: `Where exactly is the method you just used defined? Show me the file path in vendor/ and the method signature. If you cannot find it, say so.`
:::

للتعليمات الجيدة أربعة أجزاء: **السياق** (أي الملفات أو الخطة)، و**المهمة** (خطوة واحدة)، و**القيود** (ما لا يجب فعله)، و**التحقق** (كيف تثبت أنها تعمل).

## أخطاء شائعة

- **الوكيل يخترع واجهات حزم.** يكتب دالة «يُفترض» أنها موجودة. الدفاع: اطلب موقعها في المصدر، واستخدم `search-docs`، وشغّل الشيفرة.
- **الإفراط في التهيئة.** تطلب نموذجاً فتحصل على نموذج، ومتحكم، وسياسة، وطلب، ومورد، وخمسة اختبارات لم تُردها. الدفاع: قسم «خارج النطاق» في الخطة، وعبارة «هذه الخطوة فقط» في التعليمات.
- **تخطّي مراجعة الترحيلات.** غياب `unique()` اليوم يصبح خطأ حجز مزدوج في اليوم الثالث. اقرأ كل ترحيل سطراً بسطر.
- **المال كعدد عائم.** يبدو `$table->float('price_lyd')` غير مؤذٍ، لكنه يُنتج أخطاء تقريب. استخدم دائماً `decimal(10, 2)`.
- **إيداع واحد ضخم.** إن كسر التغيير العاشر للوكيل شيئاً، فلن تستطيع العودة بسهولة. أودِع بعد كل خطوة خضراء.
- **قبول الأوامر دون قراءتها.** الموافقة على أمر لم تقرأه هي الطريقة التي تُحذف بها قواعد البيانات.
- **جلسات طويلة وفوضوية.** بعد مهمة كبيرة يمتلئ السياق بتفاصيل قديمة. استخدم `/clear` حين تنتقل إلى مهمة أخرى ليركّز الوكيل على الجديدة.

## أهم الخلاصات

- النموذج اللغوي الكبير يتنبّأ بالرمز التالي. والوكيل يغلّف ذلك في حلقة: فكّر ← تصرّف (بالأدوات) ← لاحظ.
- لا يعرف النموذج إلا ما في نافذة سياقه. ثبّته بملفاتك ومخططك ووثائق خاصة بالإصدار.
- `CLAUDE.md` وBoost يجعلان الوكيل يعرف *مشروعك أنت*. والأذونات تُبقيك متحكّماً.
- اعمل ضمن الحلقة: استكشف ← خطّط ← نفّذ ← تحقّق. ويُراجَع ملف الخطة قبل وجود الشيفرة.
- Laravel: المسارات ← البرمجيات الوسيطة ← المتحكم ← الخدمة/النموذج ← الاستجابة. ونماذج Eloquent، والترحيلات، والمصانع، والبذّارات، وartisan، وحاوية الخدمات أدواتك اليومية.
- ضع قواعد العمل في مكان واحد، مثل `ShipmentStatus::canTransitionTo()`، ليتّبعها كل مستدعٍ — بشراً كان أو ذكاءً اصطناعياً.
- أنت مسؤول عن كل سطر تودعه.

## أسئلة التقييم الذاتي

1. ما نافذة السياق، وماذا يحدث للمعلومات التي ليست فيها؟
2. اذكر سببين للهلوسة ودفاعاً عملياً واحداً لكل منهما.
3. صِف حلقة الوكيل في ثلاث خطوات.
4. ما الفرق بين أدوات Claude Code المدمجة والأدوات المقدَّمة عبر MCP؟ أعطِ مثالاً على كل منهما.
5. لماذا تضع الدورة قواعد الانتقال داخل التعداد `ShipmentStatus` بدلاً من المتحكم؟
6. ما الذي يجب أن تتحقّق منه في كل ترحيل كتبه الذكاء الاصطناعي؟ اذكر أربعة أشياء.
7. ماذا تفعل `protected function casts()` للعمود `status`؟
8. اذكر موقفين لا ينبغي لك فيهما استخدام الوكيل.
9. ما الغرض من قسم «خارج النطاق» في ملف الخطة؟
10. لماذا يكون `migrate:fresh --seed` مقبولاً على حاسوبك المحمول وخطيراً في غيره؟

### الإجابات

1. نافذة السياق هي كل ما يستطيع النموذج رؤيته في طلب واحد: تعليمات النظام، والمحادثة، ومحتويات الملفات، ونتائج الأدوات. والمعلومات التي ليست فيها مجهولة للنموذج، باستثناء ما تعلّمه أثناء التدريب، وقد يكون قديماً أو خاطئاً بالنسبة لمشروعك.
2. السياق الناقص (الدفاع: دعه يقرأ المخطط أو الملفات عبر الأدوات)؛ بيانات التدريب القديمة (الدفاع: وثائق خاصة بالإصدار عبر Boost ‏`search-docs`)؛ إكمال النمط الذي يخترع واجهات (الدفاع: اطلب موقع المصدر في `vendor/`)؛ غياب التغذية الراجعة (الدفاع: اشترط تشغيل الاختبارات وإظهار الناتج). أي اثنين منها تكفي.
3. فكّر في الخطوة التالية، وتصرّف باستدعاء أداة، ولاحظ النتيجة؛ وكرّر حتى يتحقّق الهدف.
4. الأدوات المدمجة تأتي مع Claude Code، مثل قراءة الملفات أو تعديلها وتشغيل أوامر الطرفية. أما أدوات MCP فتأتي من خوادم خارجية تستخدم بروتوكول سياق النموذج (Model Context Protocol)، مثل `database-schema` أو `search-docs` في Boost.
5. ليستخدم كل مسار في الشيفرة — واجهة البرمجة، والمرسِل، والمهمة في الطابور، وأدوات الوكيل الذكي — القاعدة نفسها، ولتُختبر في مكان واحد.
6. المفاتيح الأجنبية مقيّدة؛ والمال عشري وليس عائماً؛ والأعمدة الفريدة عليها قيود تفرّد؛ والجداول تُنشأ بترتيب الاعتماديات؛ و`down()` تعكس `up()`؛ والفهارس المفيدة موجودة.
7. تحوّل النص المخزّن (مثل `'in_transit'`) إلى حالة التعداد `ShipmentStatus` عند القراءة، وتعيده نصاً عند الحفظ.
8. أمثلة: تغييرات من سطر واحد تعرفها أصلاً؛ تعلّم مفهوم لأول مرة؛ أي شيء يتعلّق بالأسرار أو بيانات الإنتاج؛ قرارات تحتاج إلى سياق عمل لا يملكه سواك؛ حين لا تستطيع الحكم على صحة الناتج.
9. يضع حدوداً كي لا يولّد الوكيل شيفرة إضافية (متحكمات، ومسارات، وحزم) لم يطلبها أحد ولم يراجعها أحد.
10. لأنه يحذف كل الجداول ثم يعيد إنشاءها. محلياً، البيانات بيانات اختبار يمكن التخلّص منها؛ أما على قاعدة بيانات مشتركة أو قاعدة إنتاج فإنه يدمّر بيانات حقيقية.
