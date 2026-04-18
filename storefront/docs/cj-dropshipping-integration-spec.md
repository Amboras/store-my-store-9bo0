# CJ Dropshipping Integration — Technical Specification

**Status:** Draft v1
**Target store:** my-store-9bo0
**Purpose:** Hand this to a developer or agency to build a full CJ Dropshipping integration.

---

## 1. Goals

1. Import CJ products into the store catalog with a single click (or bulk).
2. Keep inventory levels in sync with CJ automatically.
3. Keep cost/pricing in sync (with configurable markup rules).
4. Automatically forward customer orders to CJ for fulfillment.
5. Pull CJ tracking numbers back and attach them to customer orders.
6. Admin UI to manage the whole flow.

## 2. Non-Goals (v1)

- No customer-facing CJ branding anywhere.
- No direct customer communication from CJ (all emails come from the store).
- No returns workflow automation (handled manually in v1).

---

## 3. External Dependencies

- **CJ Dropshipping Developer Account** — https://developers.cjdropshipping.com
- **Credentials required:**
  - API email + API key (for token generation)
  - Access token (refreshed every ~7 days)
- **Rate limits:** CJ enforces per-endpoint limits (e.g. 300 calls / 5 min on product endpoints). Build a request queue.

## 4. Architecture Overview

```
┌──────────────┐      ┌────────────────┐      ┌──────────────┐
│  Storefront  │─────>│ Commerce API   │<────>│   CJ API     │
│  (Next.js)   │      │  + CJ Module   │      │              │
└──────────────┘      └────────┬───────┘      └──────────────┘
                               │
                        ┌──────▼──────┐
                        │  Postgres   │
                        │ + cj_* tables│
                        └─────────────┘
```

Integration lives in a new **cj-dropshipping module** on the commerce backend. Storefront does not talk to CJ directly.

---

## 5. Data Model (new tables)

### `cj_product_link`
Maps a store product/variant to its CJ counterpart.

| Column | Type | Notes |
|---|---|---|
| id | uuid (pk) | |
| product_id | text | FK to product |
| variant_id | text | FK to variant |
| cj_product_id | text | CJ's PID |
| cj_variant_id | text | CJ's VID |
| cj_sku | text | CJ SKU for reconciliation |
| last_synced_at | timestamptz | |
| sync_status | enum('ok','stale','error') | |
| sync_error | text | last error message |

### `cj_import_job`
Tracks bulk import runs.

| Column | Type | Notes |
|---|---|---|
| id | uuid (pk) | |
| status | enum('queued','running','completed','failed') | |
| source_type | enum('csv','url_list','category','search') | |
| total_items | int | |
| succeeded | int | |
| failed | int | |
| created_by | text | admin user id |
| created_at | timestamptz | |

### `cj_order_forward`
Tracks orders pushed to CJ.

| Column | Type | Notes |
|---|---|---|
| id | uuid (pk) | |
| order_id | text | FK to order |
| cj_order_id | text | CJ's order number |
| status | enum('pending','created','paid','shipped','delivered','cancelled','error') | |
| tracking_number | text | |
| carrier | text | |
| raw_payload | jsonb | last CJ response |
| updated_at | timestamptz | |

### `cj_markup_rule`
Rules for auto-calculating sell price from CJ cost.

| Column | Type | Notes |
|---|---|---|
| id | uuid (pk) | |
| scope | enum('global','category','product') | |
| scope_id | text | nullable |
| multiplier | decimal(6,3) | e.g. 2.500 = 2.5× |
| fixed_add | int | cents to add on top |
| min_price | int | floor price (cents) |
| priority | int | higher wins |

---

## 6. Backend Modules

### 6.1 `cj-client` service
Wrapper around CJ's REST API.

- Token management (auto-refresh before expiry).
- Request queue respecting rate limits.
- Methods: `searchProducts`, `getProduct`, `getVariants`, `getInventory`, `createOrder`, `getOrder`, `getTracking`, `listCategories`.
- Typed responses (generate TS types from CJ API docs).

### 6.2 Product import workflow
Input: array of CJ product IDs or a CSV of CJ URLs.
Steps:
1. For each CJ product ID, call `getProduct` + `getVariants`.
2. Map CJ fields → store product:
   - `title` ← CJ `productNameEn`
   - `description` ← CJ `description` (strip HTML, clamp to 2000 chars)
   - `images` ← CJ `productImage[]` (all images, first becomes thumbnail)
   - `options` ← derived from CJ `variantNameEn` (e.g. "Red / Large" → [Color: Red, Size: Large])
   - `variants[].prices` ← apply `cj_markup_rule` to CJ `sellPrice`
   - `variants[].sku` ← CJ `variantSku`
   - `variants[].stock_quantity` ← CJ `inventory`
3. Upsert (match on `cj_sku` if product already exists).
4. Insert/update `cj_product_link` rows.

### 6.3 Inventory sync job
Scheduled: every 4 hours.
- Query all active `cj_product_link` rows.
- Batch call CJ inventory endpoint (200 SKUs per call).
- Update `inventory_level.stocked_quantity` for each variant.
- Flag products as out-of-stock if CJ stock = 0 (respect `allow_backorder`).

### 6.4 Price sync job
Scheduled: daily.
- For each linked variant, fetch CJ current cost.
- Re-run markup rule → compute new sell price.
- If new price differs from current by > configurable threshold (e.g. 5%), update and log.

### 6.5 Order forwarding workflow
Triggered on `order.placed` event.
- Filter line items where variant has a `cj_product_link`.
- Build CJ order payload:
  - Shipping address (from order)
  - Line items (CJ VID + quantity)
  - Preferred shipping method (from configurable mapping table)
- Call CJ `createOrder`.
- Store `cj_order_forward` row.
- Call CJ `payOrder` (deducts from merchant's CJ wallet).
- If any step fails → notify admin via email + dashboard alert.

### 6.6 Tracking sync job
Scheduled: every 2 hours.
- For each `cj_order_forward` with status `paid` or `shipped`, poll CJ for tracking.
- On first tracking number → update order fulfillment + send "your order shipped" email to customer.
- On delivered status → mark fulfillment complete.

### 6.7 Webhook handler (optional, recommended)
CJ offers webhooks for: stock changes, price changes, shipment updates. Implement a `/webhooks/cj` endpoint to receive them and bypass polling where possible.

---

## 7. Admin UI

### 7.1 Settings page: `/admin/cj-dropshipping`
- API credentials form (email, key) with "Test connection" button.
- Default shipping method selector.
- Markup rules editor (CRUD on `cj_markup_rule`).
- Sync job status panel (last run, next run, errors).

### 7.2 Product browser: `/admin/cj-dropshipping/browse`
- Search CJ catalog (filters: category, price, warehouse).
- Product card grid with "Import" button per product.
- Bulk select → "Import selected".

### 7.3 Import runner: `/admin/cj-dropshipping/import`
- Upload CSV (columns: `cj_product_id` or `cj_url`, optional `price_override`).
- Paste list of CJ URLs.
- Shows progress bar from `cj_import_job` table.

### 7.4 Linked products view
- In the existing product list, add a "Source: CJ" badge.
- On product detail, new tab "CJ Sync" showing: CJ product ID, last sync, inventory at CJ, cost, current markup.

---

## 8. Storefront Changes

Minimal:

1. **Shipping times** — product pages display dynamic delivery estimate based on whether variant is CJ-sourced (7–20 days) vs domestic (3–5 days). ✅ Shipping page already updated.
2. **"Ships from overseas" badge** — small indicator on product cards for CJ-sourced items (optional, compliance-driven).
3. **Checkout copy** — disclosure near the place-order button: "Some items ship from our overseas partners and may take 7–20 days."

All of these are simple UI additions; no new backend calls needed.

---

## 9. Rollout Plan

| Phase | Scope | Est. effort |
|---|---|---|
| 1 | cj-client service + settings page + product import (manual, 1 product at a time) | 1.5 weeks |
| 2 | Bulk import (CSV + URL list) + markup rules | 1 week |
| 3 | Inventory sync job | 1 week |
| 4 | Order forwarding + tracking sync | 2 weeks |
| 5 | Price sync + webhook handler + admin polish | 1.5 weeks |
| **Total** | MVP → full auto-sync | **~7 weeks** |

## 10. Open Questions / Risks

- **Variant mismatches** — if CJ changes a variant ID, the link breaks. Need reconciliation by SKU.
- **Out-of-stock during checkout** — CJ stock can drop between our sync and checkout. Need a pre-order check on `cart.complete()`.
- **Returns** — v1 is manual. Decide whether to automate in v2.
- **Multi-currency** — CJ prices in USD/CNY. Store uses USD + GHS. Need FX handling for GH region.
- **Tax** — CJ is not a tax collector. Store must handle.
- **GDPR / data transfer** — sending customer addresses to CJ (China) may require disclosure in privacy policy.

---

## 11. Acceptance Criteria for MVP

- [ ] Admin can connect CJ account and import 1 product.
- [ ] Imported product appears on storefront with correct images, variants, price.
- [ ] Customer places an order; order appears in CJ dashboard automatically.
- [ ] Tracking number from CJ appears on the customer's account page within 2 hours of CJ marking shipped.
- [ ] Inventory updates from CJ reflected on storefront within 4 hours.

---

*End of spec. Share with a developer or agency for implementation quote.*
