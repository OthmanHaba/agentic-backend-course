---
title: Brand Sample Document
subtitle: Every feature of the build pipeline
doc_type: Student Guide Book
toc: true
---

# Building with Agents

Body text in Inter. This paragraph has `inline code`, a [link](https://naqlaa.ly), **bold** and *italic* text. The student is the engineer; the agent is a fast pair. Verify everything.

## Why verification matters

Playfair headings carry an orange accent rule. Lists:

- Plan the change before you prompt
- Review every diff
- Run the tests

1. Create the migration
2. Run `php artisan migrate`

### A third-level heading

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v1/shipments` | GET | List shipments |
| `/api/v1/shipments` | POST | Create a shipment |
| `/api/v1/shipments/{id}` | GET | Show one shipment |

```php
<?php
// Controller with a Form Request
class ShipmentController extends Controller
{
    public function store(StoreShipmentRequest $request): JsonResponse
    {
        $shipment = Shipment::create($request->validated());
        return response()->json($shipment, 201);
    }
}
```

```bash
docker compose up -d && php artisan test
```

::: tip
Keep prompts small and specific. One task per prompt gives reviewable diffs.
:::

::: warning
Never paste your `ANTHROPIC_API_KEY` into a prompt or commit it to Git.
:::

::: agent
Add a `POST /api/v1/shipments` endpoint with a Form Request, a resource, and a feature test. Show the plan first.
:::

::: checkpoint
- [ ] `php artisan test` passes
- [ ] `GET /api/v1/shipments` returns 200
:::

::: instructor
Allow 10 minutes here. Common mistake: students accept the agent diff without reading it.
:::

# Queues and Jobs

Second chapter starts on a new page with a big orange number.

## Dispatching a job

```json
{ "queue": "default", "tries": 3, "backoff": [10, 60] }
```
