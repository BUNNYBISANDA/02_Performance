# O2 Quality Backend API Contract

Base URL:

```text
http://localhost:4000/api
```

Configure the frontend with:

```text
VITE_API_BASE_URL=http://localhost:4000/api
```

## Query Parameters

Main dashboard endpoints accept:

- `customer`: single customer display name. Matching is case-insensitive and trim-safe.
- `factory`: single factory display value. Matching is case-insensitive and trim-safe.
- `startDate`: `YYYY-MM-DD`, compared against `inspection_date`.
- `endDate`: `YYYY-MM-DD`, compared against `inspection_date`.
- `soNumbers`: comma-separated list, matched against `so_no_doc` or `so_no`.
- `styles`: comma-separated list, matched against `style` or `style_ref`.
- `lines`: comma-separated list, matched against `fac_line`.
- `defectDescriptions`: comma-separated list.
- `inspectionStages`: comma-separated list using `Inline`, `Endline`, `Pre Final`, `Final`, `Third Party`.

Empty or omitted array parameters mean All.

## Shared Metadata

Main endpoints include:

```json
{
  "meta": {
    "rowCount": 0,
    "appliedFilters": {},
    "generatedAt": "2026-06-19T00:00:00.000Z"
  }
}
```

Rates are percentages, not ratios. Example: `2.37` means `2.37%`.

## Relationship Model

Dashboard endpoints read from indexed materialized views, not directly from raw
fact tables. The relationship views remain the semantic source used to refresh
them:

- `o2.mv_quality_defects_unified`
- `o2.mv_scan_qty`

- `o2.v_dim_so`
- `o2.v_dim_defect`
- `o2.v_dim_department`
- `o2.v_dim_factory`
- `o2.v_dim_date`
- `o2.v_fact_inline`
- `o2.v_fact_endline`
- `o2.v_fact_prefinal`
- `o2.v_fact_final`
- `o2.v_fact_third_party`
- `o2.v_quality_defects_unified`
- `o2.v_scan_qty`

Refresh the materialized views after source-data changes with:

```text
npm run refresh:views
```

SO relationship note:

- In this workbook, `raw_mt_so_base.so_no_doc` includes an OU prefix, for
  example `05256323`.
- The inspection fact tables and `raw_mt_so` use the fact-compatible key, for
  example `256323`.
- The helper `o2.so_fact_key(so_no_doc, so_year, so_no)` uses
  `so_year || so_no` when available and falls back to raw `so_no_doc`.

Customer display note:

- `raw_mt_so.brand` is prioritized for dashboard customer labels because this
  matches PBIX labels such as `Travis Mathew`.
- `raw_mt_so_base` still supplies SO, customer code, style, style reference,
  and shipment attributes where available.

Factory display note:

- `raw_mt_factory.factory` is used as the dashboard display value.
- `factory_fi` values such as `NYG2` are mapped back to display factories such
  as `G2`.

## GET /health

Returns backend and database status.

## GET /filters

Returns filter options backed by rows from `o2.v_quality_defects_unified`.

```json
{
  "customers": [],
  "factories": [],
  "soNumbers": [],
  "styles": [],
  "lines": [],
  "defectDescriptions": [],
  "inspectionStages": [],
  "defaultCustomer": "Travis Mathew",
  "defaultFactory": "G3",
  "minDate": "2025-12-18",
  "maxDate": "2026-10-03",
  "dateRange": {
    "startDate": "2026-01-05",
    "endDate": "2026-06-04"
  },
  "latestRefreshDate": "2026-06-18",
  "meta": {}
}
```

Default factory logic:

1. Prefer `G3` if it has unified rows.
2. Else prefer `EA` if it has unified rows.
3. Else first factory by non-zero row count.

Default date logic:

- The workbook contains a wider imported date span, exposed as `minDate` and `maxDate`.
- `dateRange` defaults to the persisted PBIX report window `2026-01-05` through `2026-06-04` when that range is available in the imported data.
- Users can still pass `startDate` and `endDate` to override this range.

## GET /overview

Returns:

- `kpiCards`
- `monthlyTrend`
- `scanQty`
- `latestRefreshDate`
- `meta`

KPI formulas:

- Inline: `SUM(Inline defect_qty) / SUM(MAX(process_checks) by SO_NO_DOC + fac_line) * 100`
- Endline: `SUM(Endline defect_qty) / SUM(MAX(inspected_qty) by job_date + SO_NO_DOC + fac_line) * 100`
- Pre Final: `SUM(Pre Final defect_qty) / SUM(MAX(inspected_qty) by SO_NO_DOC) * 100`
- Final: `SUM(Final defect_qty) / SUM(MAX(inspected_qty) by date + sewing line + SO_NO_DOC + order qty + inspection type + color) * 100`
- Third Party: `SUM(Third Party defect_qty) / SUM(MAX(inspected_qty) by date + fac_line + SO_NO + style + color) * 100`

Denominators are deduplicated with source-specific `denominator_key` values in
`o2.v_quality_defects_unified`. This mirrors PBIX behavior where inspect/process
quantities repeat across defect-code rows. Blank defect-code rows are retained
for filter coverage but contribute `0` defect quantity.

Monthly trend is wide format:

```json
{
  "month": "Jan",
  "monthStart": "2026-01-01",
  "monthNumber": 1,
  "inline": 0.45,
  "endline": 2.38,
  "preFinal": 0,
  "final": 2.21,
  "thirdParty": 0
}
```

`scanQty` comes from `o2.raw_data_fn_fg`:

- `sewQty`: step containing `SEW`
- `enQty`: step containing `FN`
- `fgQty`: step containing `FG`

Customer filtering for scan quantities uses both direct `raw_data_fn_fg.cust_name`
and the PBIX-style `raw_mt_so.brand -> so_no_doc -> raw_data_fn_fg.so_no_doc`
relationship. This is required for Travis Mathew G3 scan parity.

## GET /weekly-trend

Returns:

```json
{
  "weeklyTrend": [
    {
      "weekStart": "2026-01-05",
      "isoWeek": "2026-W02",
      "weekNumber": 2,
      "month": "Jan",
      "inline": 0,
      "endline": 0,
      "preFinal": 0,
      "final": 0,
      "thirdParty": 0
    }
  ],
  "meta": {}
}
```

## GET /defect-categories

Returns:

- `topCategories`: defect rows with stage columns.
- `detailTable`: long-format defect/stage details.
- `totals`
- `meta`

## GET /line-analysis

Returns:

- `lineLevelDefectRates`: chart-ready line rows with stage rate columns.
- `lineDefectDetailTable`
- `totals`
- `meta`

## GET /stage-detail

Requires or defaults:

- `stage=Inline`

Returns:

- `selectedStageKpiSummary`
- `donutValues`
- `topDefects`
- `trend`
- `detailTable`
- `meta`

## Debug Endpoints

### GET /debug/row-counts

Returns raw table and unified view counts.

### GET /debug/distinct-values

Returns customer, factory, stage, line, date range, month range, raw factory values, and customer source coverage.

### GET /debug/filter-test

Accepts `customer`, `factory`, `startDate`, `endDate` and returns:

- total rows after filter
- rows/defects/inspected/checks by inspection stage
- monthly rows by stage
- scan quantity by step/factory/customer

### GET /debug/relationship-audit

Returns per-fact relationship match coverage:

- total rows
- rows with SO key
- rows matched to canonical `mt_so_base`
- rows with and matched to `mt_defect`
- rows with and matched to line/department/bridge relationships
- unknown customer/factory/defect/line counts after view normalization

Also returns distinct customers, factory source codes, factory display values,
inspection stages, and the unified date range.

### GET /debug/powerbi-validation

Accepts the normal dashboard query parameters and returns backend calculations
in a Power BI comparison format:

- KPI numerator, denominator, and percentage by inspection stage.
- Monthly numerator, denominator, and percentage by stage.
- Weekly numerator, denominator, and percentage by stage.
- Defect category numerator totals by stage.
- Line numerator, denominator, and percentage by stage.

Use this endpoint for manual side-by-side comparison with the original PBIX
visuals:

```text
/api/debug/powerbi-validation?customer=Travis%20Mathew&factory=G3&startDate=2026-01-05&endDate=2026-06-04
```

## Customer Mapping

`o2.customer_display_name(text)` canonicalizes known source variants:

- `TRAVISMATHEW LLC`, `TRAVIS MATHEW`, and `TRAVIS MATHEW-GROSSWELL` -> `Travis Mathew`
- `LULULEMON...` -> `lululemon`
- `FANATICS...` -> `Fanatics`
- `NIKE...` -> `Nike`
- `ADIDAS...` -> `Adidas`

Other customer values are returned trimmed from source.

The unified quality view resolves customer in this order where available:

1. `raw_data_final.customer_brand` for Final rows.
2. `raw_mt_so.brand` by `so_no_doc`, which is required for Travis Mathew PBIX parity.
3. `raw_mt_so_base.brand_name` / `raw_mt_so_base.cust_name`.
4. `raw_data_fn_fg.cust_name`.

Third Party rows with blank `fac_line` infer line/factory from
`raw_bridge_so_line` by `so_no_doc`, so Travis Mathew rows without a direct
Third Party line still participate in the G3 dashboard slice.

Known current limitation:

- The backend now implements the extracted PBIX DAX denominator grains.
- For `customer=Travis Mathew`, `factory=G3`, and report window
  `2026-01-05` to `2026-06-04`, the imported PostgreSQL data matches the
  screenshot for scan quantities, Endline, Third Party, Final numerator, and
  several defect-category totals.
- Inline still differs in denominator: backend `3,304 / 125,060 = 2.64%`;
  screenshot `3,304 / 122,320 = 2.70%`.
- Pre Final differs more significantly under the exact SO/customer/factory
  filter: backend `61 / 2,328 = 2.62%`; screenshot `385 / 6,620 = 5.82%`.
  The PBIX extraction did not expose complete calculated-table relationship
  metadata for `mt_so`, `Date`, or `bridge_so_line`, so this remains a manual
  Power BI comparison item.
