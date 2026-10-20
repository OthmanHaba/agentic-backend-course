---
title: مستند عيّنة للهوية
subtitle: كل ميزات نظام البناء
doc_type: دليل المتدرب
toc: true
---

# البناء مع الوكلاء

نص عربي بخط تجوال. هذه فقرة فيها `inline code` وأمر مثل `php artisan migrate` داخل الجملة، و**نص عريض** و[رابط](https://naqlaa.ly). المتدرب هو المهندس، والوكيل شريك سريع. تحقّق من كل شيء.

## لماذا التحقق مهم

عناوين بخط تجوال ثقيل مع خط برتقالي.

- خطّط للتغيير قبل كتابة الطلب
- راجع كل تعديل
- شغّل الاختبارات

1. أنشئ ملف الترحيل (Migration)
2. شغّل `php artisan migrate`

### عنوان فرعي

| المسار | الطريقة | الغرض |
|---|---|---|
| `/api/v1/shipments` | GET | عرض الشحنات |
| `/api/v1/shipments` | POST | إنشاء شحنة |

```php
<?php
class ShipmentController extends Controller
{
    public function store(StoreShipmentRequest $request): JsonResponse
    {
        return response()->json(Shipment::create($request->validated()), 201);
    }
}
```

::: tip
اجعل الطلبات صغيرة ومحددة، مهمة واحدة لكل طلب.
:::

::: warning
لا تلصق مفتاح `ANTHROPIC_API_KEY` في أي طلب ولا ترفعه إلى Git.
:::

::: agent
أضف نقطة `POST /api/v1/shipments` مع Form Request واختبار. اعرض الخطة أولاً.
:::

::: checkpoint
- [ ] نجح الأمر `php artisan test`
- [ ] يعيد `GET /api/v1/shipments` الرمز 200
:::

::: instructor
خصّص 10 دقائق. الخطأ الشائع: قبول تعديلات الوكيل دون قراءتها.
:::

# الطوابير والمهام

يبدأ الفصل الثاني في صفحة جديدة برقم برتقالي كبير.
