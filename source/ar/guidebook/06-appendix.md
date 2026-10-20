# الملاحق

أبقِ هذا الملحق مفتوحاً أثناء المختبرات. فهو يجمع المصطلحات والأوامر وقوائم التحقق والمصادر من الأسبوع كله.

## A. مسرد المصطلحات

| المصطلح (EN) | بالعربية | المعنى |
|---|---|---|
| Agent | وكيل ذكي | برنامج يستخدم نموذجاً لغوياً كبيراً في حلقة، ويستدعي أدوات للوصول إلى هدف |
| Agent loop | حلقة الوكيل | فكّر، واستدعِ أداة، ولاحظ النتيجة، وكرّر حتى تنتهي |
| API Resource | مورد واجهة البرمجة | صنف في Laravel يشكّل النموذج (Model) في مخرجات JSON |
| Artisan | أداة Artisan | أداة سطر الأوامر في Laravel |
| Authentication | المصادقة | إثبات هويتك (رمز Sanctum) |
| Authorization | التفويض / الصلاحيات | تقرير هل يُسمح لك بفعل شيء ما (السياسات Policies) |
| Cache | ذاكرة التخزين المؤقت | نتائج مخزّنة يُعاد استخدامها لتجنّب تكرار العمل |
| Cache invalidation | إبطال الذاكرة المؤقتة | حذف البيانات المخزّنة مؤقتاً أو تحديثها عندما يتغيّر مصدرها |
| CLAUDE.md | ملف CLAUDE.md | تعليمات المشروع التي تُحمَّل في سياق Claude Code |
| Context window | نافذة السياق | كل ما يستطيع النموذج رؤيته في طلب واحد |
| Eager loading | التحميل المسبق | تحميل النماذج المرتبطة مسبقاً لتجنّب استعلامات N+1 |
| Eloquent | Eloquent | أداة ربط الكائنات بالعلاقات (ORM) في Laravel |
| Embedding | التضمين المتجهي | قائمة من الأرقام تمثّل معنى نص ما |
| Enum | تعداد | نوع له مجموعة ثابتة من القيم المسمّاة |
| Eval | تقييم | اختبار لسلوك النموذج الحقيقي مقابل مجموعة بيانات مرجعية |
| Event / Listener | حدث / مستمع | إعلان بأن شيئاً ما حدث، والشيفرة التي تستجيب له |
| Factory | مصنع بيانات | يولّد بيانات وهمية للنماذج من أجل الاختبارات |
| Feature test | اختبار ميزة | اختبار يرسل طلبات HTTP إلى التطبيق |
| Foreign key | مفتاح أجنبي | عمود يجب أن يشير إلى صف في جدول آخر |
| FormRequest | طلب نموذج | صنف في Laravel للتحقق من مدخلات الطلب |
| Full-text search | البحث النصي الكامل | البحث في الوثائق بالكلمات، مع ترتيب النتائج |
| Guardrail | ضابط حماية | فحص يحدّ مما تستطيع ميزة ذكاء اصطناعي فعله |
| Hallucination | الهلوسة | مخرجات واثقة من النموذج لكنها خاطئة |
| Horizon | Horizon | لوحة طوابير Redis ومدير العمّال في Laravel |
| Human in the loop | الإنسان في الحلقة | يجب أن يوافق إنسان قبل أن يحدث الإجراء |
| Idempotency | عدم التأثر بالتكرار | تكرار الطلب له الأثر نفسه كتنفيذه مرة واحدة |
| Index | فهرس | بنية في قاعدة البيانات تسرّع عمليات البحث |
| Job | مهمة | وحدة عمل ينفّذها عامل في الخلفية |
| LLM | نموذج لغوي كبير | نموذج لغوي كبير (Large Language Model) |
| Load test | اختبار الحمل | قياس السلوك تحت عدد كبير من الطلبات المتزامنة |
| Mass assignment | الإسناد الجماعي | تعبئة حقول كثيرة في النموذج من مصفوفة دفعة واحدة |
| MCP | بروتوكول سياق النموذج | بروتوكول سياق النموذج (Model Context Protocol): معيار لتزويد الوكلاء بأدوات إضافية |
| Middleware | البرمجية الوسيطة | شيفرة تعمل قبل كل طلب في مجموعة أو بعده |
| Migration | ترحيل قاعدة البيانات | تغيير في مخطط قاعدة البيانات خاضع لإدارة الإصدارات |
| Model routing | توجيه النماذج | إرسال كل مهمة إلى أرخص نموذج قادر على أدائها |
| N+1 query | مشكلة الاستعلامات N+1 | استعلام واحد إضافة إلى استعلام إضافي لكل صف |
| ORM | ربط الكائنات بالعلاقات | يربط صفوف قاعدة البيانات بكائنات |
| p95 latency | زمن الاستجابة p95 | ‏95% من الطلبات أسرع من هذه القيمة |
| Pagination | ترقيم الصفحات | إعادة النتائج على شكل صفحات |
| Policy | سياسة التفويض | صنف في Laravel يحمل قواعد التفويض لنموذج ما |
| Prompt | موجّه / تعليمة | نص المدخلات المعطى للنموذج |
| Prompt injection | حقن التعليمات | مدخلات تحاول تجاوز تعليمات النموذج |
| Queue | طابور المهام | قائمة من المهام تنتظر المعالجة في الخلفية |
| RAG | التوليد المعزز بالاسترجاع | التوليد المعزّز بالاسترجاع (Retrieval-Augmented Generation): ابحث في بياناتك، ثم أجب منها |
| Race condition | حالة التسابق | خطأ يعتمد على توقيت العمليات المتزامنة |
| Rate limiting | تحديد معدل الطلبات | تحديد عدد الطلبات التي يستطيع العميل إرسالها في كل نافذة زمنية |
| Row lock | قفل الصف | يمنع المعاملات الأخرى من تغيير صف حتى الإيداع (Commit) |
| Sanctum | Sanctum | حزمة Laravel للمصادقة برموز الواجهة |
| Seeder | بذّارة | يملأ قاعدة البيانات ببيانات البداية |
| Service container | حاوية الخدمات | نظام حقن الاعتماديات (Dependency Injection) في Laravel |
| Structured output | المخرجات المهيكلة | مخرجات نموذج تتبع مخطط JSON ‏(JSON Schema) |
| System prompt | تعليمات النظام | تعليمات دائمة تحدّد دور النموذج وقواعده |
| TDD | التطوير الموجّه بالاختبارات | التطوير الموجّه بالاختبارات (Test-Driven Development): أحمر، أخضر، إعادة هيكلة |
| Temperature | درجة الحرارة | تتحكم في عشوائية مخرجات النموذج |
| Token | رمز (توكن) | جزء صغير من النص يقرؤه النموذج ويكتبه |
| Tool calling | استدعاء الأدوات | يطلب النموذج من شيفرتك تشغيل دالة |
| Transaction | معاملة | مجموعة من تغييرات قاعدة البيانات تنجح معاً أو تفشل معاً |
| Unique constraint | قيد التفرد | ترفض قاعدة البيانات القيم المكررة في عمود |

## B. ورقة مرجعية سريعة لـ Laravel وartisan

تُشغَّل جميع الأوامر في هذه الدورة عبر Sail: استبدل `php artisan` بـ `sail artisan`.

### Sail

```bash
./vendor/bin/sail up -d          # تشغيل الحاويات في الخلفية
./vendor/bin/sail down           # إيقاف الحاويات
sail shell                       # صدفة داخل حاوية التطبيق
sail psql                        # عميل PostgreSQL
sail redis                       # سطر أوامر Redis
sail composer require vendor/pkg # إضافة حزمة (اسأل أولاً!)
```

### أوامر الإنشاء (Make)

```bash
sail artisan make:model Shipment -mf        # نموذج + ترحيل + مصنع بيانات
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

### قاعدة البيانات

```bash
sail artisan migrate                 # تشغيل الترحيلات الجديدة
sail artisan migrate:status          # أي الترحيلات نُفّذت
sail artisan migrate:rollback        # التراجع عن آخر دفعة
sail artisan migrate:fresh --seed    # حذف الكل، ثم الترحيل، ثم التعبئة (محلياً فقط)
sail artisan db:seed --class=CitySeeder
sail artisan tinker                  # PHP تفاعلي داخل التطبيق
```

### الفحص والاستكشاف

```bash
sail artisan route:list --path=api   # كل مسارات الواجهة
sail artisan about                   # التطبيق، والبيئة، والمشغّلات
sail artisan config:show database    # قيم الإعدادات بعد حلّها
sail artisan horizon                 # تشغيل عمّال الطوابير (اليوم الثالث فما بعده)
sail artisan queue:failed            # عرض المهام الفاشلة
sail artisan pail                    # متابعة السجلات مباشرة
sail artisan boost:install           # إعداد Laravel Boost لـ Claude Code (خادم MCP: boost:mcp)
sail artisan agent:eval              # تشغيل tests/Evals/cases.json على النموذج الحقيقي (اليوم الخامس، يكلّف مالاً)
sail artisan agent:costs --days=7    # استدعاءات النموذج اللغوي، والرموز، والتكلفة لكل غرض ونموذج (اليوم الخامس)
```

### أنماط شيفرة شائعة

| الحاجة | الشيفرة |
|---|---|
| ابحث أو أعد 404 | `Shipment::where('reference', $ref)->firstOrFail()` |
| التحميل المسبق | `->with(['origin', 'destination'])` |
| الحصر في نطاق المستخدم | `$request->user()->shipments()` |
| ترقيم الصفحات | `->paginate(15)` |
| معاملة | `DB::transaction(function () { ... })` |
| قفل الصف | `->lockForUpdate()` داخل معاملة |
| التفويض | `Gate::authorize('view', $shipment)` |
| المدخلات المتحقَّق منها | `$request->validated()` |
| التخزين المؤقت | `Cache::remember('key', now()->addHour(), fn () => ...)` |
| إرسال مهمة إلى طابور | `AssignVehicleJob::dispatch($shipment)` (تضبط المهمة `$this->onQueue('dispatch')` في بانيها) |
| التسجيل مع السياق | `Log::info('event.name', ['key' => $value])` |
| تحويل نوع إلى تعداد (Enum Cast) | `'status' => ShipmentStatus::class` في `casts()` |

## C. ورقة مرجعية سريعة لـ Pest

```bash
sail artisan test                          # كل الاختبارات
sail artisan test --filter=PricingService  # الاختبارات المطابقة فقط
sail artisan test --parallel               # أسرع على الأجهزة متعددة الأنوية
sail artisan test --coverage               # يحتاج إلى مشغّل لقياس التغطية
```

### البنية

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

### التوقعات (Expectations)

| التوقّع | ما يتحقق منه |
|---|---|
| `->toBe($x)` | مساواة صارمة (`===`) |
| `->toEqual($x)` | مساواة مرنة |
| `->toBeTrue()` / `->toBeFalse()` | القيم المنطقية |
| `->toBeNull()` | القيمة Null |
| `->toHaveCount(3)` | عدد عناصر المصفوفة أو المجموعة |
| `->toHaveKey('error')` | وجود مفتاح في المصفوفة |
| `->toContain('SHN-')` | احتواء النص أو المصفوفة |
| `->toBeInstanceOf(Shipment::class)` | الصنف |
| `->toThrow(Exception::class)` | الدالة المغلقة (Closure) ترمي استثناءً |
| `->not->toBe($x)` | النفي |
| `->and($other)->toBe(...)` | ربط قيمة أخرى في السلسلة |

### تأكيدات HTTP وقاعدة البيانات

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

### المحاكاة (Fakes)

```php
Queue::fake();
// ... book a shipment
Queue::assertPushed(AssignVehicleJob::class);

Event::fake([ShipmentBooked::class]);
Event::assertDispatched(ShipmentBooked::class);

Prism::fake([StructuredResponseFake::make()->withStructured(['intent' => 'track', 'language' => 'en'])]);
```

يستبدل `Prism::fake()` استدعاء النموذج بالكامل؛ ولا تعمل أدواتك. اختبر الأدوات مباشرة.

## D. ورقة مرجعية سريعة لـ Claude Code

### الأوامر والمفاتيح

| الأمر أو المفتاح | ماذا يفعل |
|---|---|
| `claude` | بدء جلسة تفاعلية في المجلد الحالي |
| `claude -p "prompt"` | تشغيل طلب واحد بشكل غير تفاعلي وطباعة النتيجة |
| `claude --continue` | متابعة أحدث محادثة |
| `/init` | توليد ملف `CLAUDE.md` مبدئي للمشروع |
| `/clear` | مسح المحادثة (بداية جديدة لمهمة جديدة) |
| `/compact` | تلخيص المحادثة لتحرير مساحة من السياق |
| `/mcp` | عرض خوادم MCP المتصلة (تحقّق من Boost هنا) |
| `/permissions` | عرض صلاحيات الأدوات وتعديلها |
| `/help` | عرض قائمة الأوامر |
| `@path/to/file` | الإشارة إلى ملف لتضمينه في السياق |
| Shift+Tab | التنقل بين الأوضاع، بما فيها وضع التخطيط |
| Esc | مقاطعة الوكيل |

شغّل `/help` في الإصدار المثبّت لديك للحصول على القائمة الحالية؛ فالأوامر تُضاف مع الوقت.

### أنماط الطلبات

| النمط | القالب |
|---|---|
| **الاستكشاف أولاً** | «اقرأ X وY. اشرح كيف يعمل Z اليوم. لا تعدّل أي ملفات.» — بالإنجليزية: "Read X and Y. Explain how Z works today. Do not edit any files." |
| **ملف الخطة** | «اكتب مسودة ملف خطة في مجلد الخطط لتحقيق [الهدف]: الخطوات، والملفات، والاختبارات، وما هو خارج النطاق. لا شيفرة بعد.» — بالإنجليزية: "Draft `docs/plans/<name>.md` for [goal]: steps, files, tests, out of scope. No code yet." |
| **خطوة واحدة** | «نفّذ الخطوة 2 فقط من ملف الخطة.» — بالإنجليزية: "Implement step 2 of `docs/plans/<name>.md` only." |
| **الاختبارات أولاً** | «اكتب اختبارات Pest فاشلة لـ [السلوك]. شغّلها واعرض الفشل. لا تنفّذ بعد.» — بالإنجليزية: "Write failing Pest tests for [behaviour]. Run them and show the failure. Do not implement yet." |
| **حماية الاختبارات** | «اجعل هذه الاختبارات تنجح دون تعديل الاختبارات. إن كان اختبار ما خاطئاً، فتوقف واشرح.» — بالإنجليزية: "Make these tests pass without modifying the tests. If a test is wrong, stop and explain." |
| **الاستناد إلى التوثيق** | «تحقّق باستخدام search-docs قبل استخدام أي واجهة لست متأكداً من وجودها. اذكر الصفحة.» — بالإنجليزية: "Check with search-docs before using any API you are not sure exists. Cite the page." |
| **إثبات الوجود** | «أرني الملف داخل مجلد vendor الذي عُرّفت فيه هذه الدالة.» — بالإنجليزية: "Show me the file in `vendor/` where this method is defined." |
| **وضع المراجعة** | «راجع فرق git ‏(git diff) مقابل قائمة التحقق هذه. أبلغ عن النجاح أو الفشل لكل بند مع الملف والسطر. لا تصلح شيئاً.» — بالإنجليزية: "Review the git diff against this checklist. Report pass/fail per item with file and line. Do not fix." |
| **الشرح** | «اشرح هذه الشيفرة سطراً سطراً كأنك تشرحها لمهندس مبتدئ. ما الذي قد يسوء؟» — بالإنجليزية: "Explain this code line by line as if to a junior engineer. What could go wrong?" |
| **قِس ولا تخمّن** | «أعطني الأمر الدقيق لقياس هذا قبل التغيير وبعده. لا تقدّر النتائج.» — بالإنجليزية: "Give me the exact command to measure this before and after. Do not estimate results." |
| **هاجمه** | «افترض أن النموذج الذي يستدعي هذه الأداة يسيطر عليه مهاجم. ماذا يستطيع أن يفعل؟» — بالإنجليزية: "Assume the model calling this tool is controlled by an attacker. What can it do?" |

الطلب الجيد يحتوي على **سياق** (الملفات، والخطة)، و**مهمة واحدة**، و**قيود** (ما لا يجب لمسه)، و**تحقّق** (أي أمر يثبت أنه يعمل).

## E. قائمة التحقق لمراجعة الشيفرة المكتوبة بالذكاء الاصطناعي

استخدمها مع كل تغيير كتبه الذكاء الاصطناعي قبل الإيداع (Commit).

| # | المجال | السؤال |
|---|---|---|
| 1 | النطاق | هل يفعل الفرق (Diff) ما طُلب فقط؟ هل توجد ملفات أو حزم غير متوقعة؟ |
| 2 | الوجود | هل كل صنف ودالة ومفتاح إعدادات وأمر artisan موجود فعلاً في الإصدارات المثبّتة لدينا؟ |
| 3 | التحقق من المدخلات | هل تُتحقَّق كل المدخلات الخارجية (FormRequest أو Validator)؟ ألا يوجد تمرير لـ `$request->all()` إلى النماذج؟ |
| 4 | التفويض | هل كل قراءة وكتابة محصورة في نطاق المستخدم أو تمرّ بفحص سياسة؟ هل تحصل الأدوات على المستخدم من الشيفرة؟ |
| 5 | سلامة البيانات | هل الكتابات المترابطة داخل معاملة؟ هل تدعم القيود في قاعدة البيانات القواعد؟ |
| 6 | التزامن | هل يمكن أن يشغّل طلبان أو مهمتان هذا في الوقت نفسه؟ هل توجد أقفال، أو قيود تفرّد، أو عدم تأثر بالتكرار؟ |
| 7 | المال والوقت | هل يُستخدم النوع العشري (Decimal) للمال؟ وUTC للتخزين؟ وISO 8601 في الواجهة؟ |
| 8 | الأخطاء | هل رموز الحالة صحيحة؟ ألا توجد تتبّعات مكدّس أو أسرار أو معرّفات داخلية في الاستجابات؟ |
| 9 | الأداء | هل توجد استعلامات داخل حلقات (N+1)؟ فهارس مفقودة؟ مجموعات نتائج غير محدودة؟ عمل بطيء داخل الطلب؟ |
| 10 | أمان النموذج اللغوي | هل يُتحقَّق من مخرجات النموذج؟ هل تُحمَّل المعرّفات القادمة من النموذج عبر المستخدم؟ هل تُؤكَّد الآثار الجانبية؟ |
| 11 | الاختبارات | هل تتحقق الاختبارات من السلوك، بما فيه حالات الفشل؟ هل أُضعف أي اختبار أو تُخطّي أو حُذف؟ |
| 12 | لا استدعاءات للواجهة الحقيقية في الاختبارات | هل تستخدم اختبارات النموذج اللغوي `Prism::fake()`؟ |
| 13 | قابلية القراءة | هل تستطيع شرح كل سطر؟ هل تتبع اصطلاحات `CLAUDE.md`؟ |
| 14 | الأسرار | ألا توجد مفاتيح أو رموز أو محتويات `.env` في الفرق؟ |

## F. رموز حالة HTTP المستخدمة في شحنة

| الرمز | الاسم | متى |
|---|---|---|
| 200 | OK | قراءة أو إجراء ناجح مع متن في الاستجابة |
| 201 | Created | إنشاء عرض سعر أو شحنة |
| 400 | Bad Request | ترويسة `Idempotency-Key` مفقودة (أو أطول من 255 حرفاً) في `POST /api/shipments` |
| 401 | Unauthorized | لا يوجد رمز، أو الرمز غير صالح |
| 403 | Forbidden | مصادَق عليه لكن غير مسموح له (مالك خاطئ، أو دور خاطئ) |
| 404 | Not Found | مرجع غير معروف، أو `conversation_id` يخص مستخدماً آخر، أو مسار غير معروف |
| 409 | Conflict | طلب بالقيمة نفسها لـ `Idempotency-Key` ما زال قيد المعالجة |
| 422 | Unprocessable Content | فشل التحقق؛ أو تغيير حالة غير صالح (مثل إلغاء شحنة ملغاة أو مستلَمة)؛ أو عرض سعر منتهي الصلاحية أو محجوز مسبقاً؛ أو إعادة استخدام مفتاح عدم التكرار مع متن مختلف |
| 429 | Too Many Requests | تجاوز حدّ المعدّل؛ راجع `Retry-After` |
| 500 | Internal Server Error | خطأ برمجي غير معالَج |
| 503 | Service Unavailable | اعتمادية متوقفة أو وضع الصيانة |

## G. قراءات إضافية

التوثيق الرسمي:

- توثيق Laravel 12 — laravel.com/docs/12.x
- توثيق Pest — pestphp.com/docs
- توثيق Prism — prismphp.com
- Laravel Boost — github.com/laravel/boost
- Laravel Horizon وSanctum وPulse وTelescope — أقسام ضمن توثيق Laravel
- توثيق PostgreSQL، وبخاصة "Full Text Search" و"Indexes" — postgresql.org/docs/16
- توثيق k6 — grafana.com/docs/k6
- توثيق Claude Code — docs.anthropic.com (قسم Claude Code)
- توثيق واجهة Anthropic: الرسائل، واستخدام الأدوات، والمخرجات المهيكلة — docs.anthropic.com
- دليل PHP — php.net/manual

الأمان:

- OWASP Top 10 for Large Language Model Applications — genai.owasp.org
- OWASP API Security Top 10 — owasp.org/API-Security

مقالات وأدلة:

- Anthropic, "Building effective agents" — anthropic.com/research/building-effective-agents
- Anthropic, "Claude Code: Best practices for agentic coding" — anthropic.com/engineering
- كتابات Simon Willison حول حقن التعليمات — simonwillison.net (الوسم: prompt-injection)
- Stripe, "Designing robust and predictable APIs with idempotency" — stripe.com/blog/idempotency

كتب:

- Martin Kleppmann, *Designing Data-Intensive Applications* (O'Reilly)
- Kent Beck, *Test-Driven Development: By Example* (Addison-Wesley)
- Chip Huyen, *AI Engineering* (O'Reilly)
