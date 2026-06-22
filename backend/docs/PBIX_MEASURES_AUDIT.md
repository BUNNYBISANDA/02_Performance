# PBIX Measures Audit

Source file: `C:\Users\hiruk\Downloads\6_Travis.pbix`

Audit date: 2026-06-19

Percentages in the backend API are returned as percentage points. For example, DAX `0.0472` is returned as `4.72`.

## KPI Measures

### Inline Defect Qty

PBIX DAX:

```DAX
CALCULATE(
    SUM(data_inline[CNT_FAILED]),
    data_inline[DEFECT_CODE] <> BLANK()
)
```

PostgreSQL equivalent:

```sql
SUM(CASE WHEN defect_code IS NOT NULL THEN cnt_failed ELSE 0 END)
```

Backend status: aligned in `o2.v_fact_inline`.

### Total Inspect Inline

PBIX DAX:

```DAX
CALCULATE(
    SUMX(
        SUMMARIZE(
            data_inline,
            data_inline[fac-line],
            data_inline[SO_NO_DOC],
            "InspectQty", MAX(data_inline[TOTAL_INSPECT])
        ),
        [InspectQty]
    ),
    REMOVEFILTERS(mt_defect)
)
```

PostgreSQL equivalent:

```sql
SUM(process_checks)
FROM (
  SELECT denominator_key, MAX(process_checks) AS process_checks
  FROM filtered_inline_rows
  GROUP BY denominator_key
) rows
```

Backend denominator key:

```text
inline|SO_NO_DOC|fac_line
```

Backend status: aligned by formula. Current imported data returns `3,304 / 125,060 = 2.64%` for `Travis Mathew`, `G3`, `2026-01-05..2026-06-04`. The screenshot shows `3,304 / 122,320 = 2.70%`; this remaining difference requires manual Power BI value comparison or a matching source extract.

### Inline Defect Rate

PBIX DAX:

```DAX
DIVIDE(
    [Inline Defect Qty],
    [Total Inspect Inline]
)
```

Backend status: aligned.

### Endline Defect Qty

PBIX DAX:

```DAX
CALCULATE(
    SUM(data_endline[defect_point]),
    data_endline[DEFECT_CODE] <> BLANK()
)
```

PostgreSQL equivalent:

```sql
SUM(CASE WHEN defect_code IS NOT NULL THEN defect_point ELSE 0 END)
```

Backend status: aligned in `o2.v_fact_endline`.

### Total Inspect Endline

PBIX DAX:

```DAX
CALCULATE(
    SUMX(
        SUMMARIZE(
            data_endline,
            data_endline[job_date],
            data_endline[fac-line],
            data_endline[SO_NO_DOC],
            "InspectQty", MAX(data_endline[total_inspect])
        ),
        [InspectQty]
    ),
    REMOVEFILTERS(mt_defect)
)
```

Backend denominator key:

```text
endline|job_date|SO_NO_DOC|fac_line
```

Backend status: aligned. Current imported data returns `9,602 / 203,608 = 4.72%`, matching the screenshot.

### Endline Defect Rate

PBIX DAX:

```DAX
DIVIDE(
    SUM(data_endline[defect_point]),
    [Total Inspect Endline]
)
```

Backend status: aligned.

### Pre Final Defect Qty

PBIX DAX:

```DAX
CALCULATE(
    SUM(data_prefinal[total_defects]),
    data_prefinal[defect_codes] <> BLANK()
)
```

Backend status: aligned by formula in `o2.v_fact_prefinal`.

Current imported data returns `61` for `Travis Mathew`, `G3`, `2026-01-05..2026-06-04`. The screenshot shows `385`, which does not match the exact SO/customer filter in the imported PostgreSQL data. Relaxing SO/customer filters changes the result but still does not exactly reproduce the screenshot denominator. This is logged as a data-context mismatch, not a formula mismatch.

### Total Inspect Pre Final

PBIX DAX:

```DAX
CALCULATE(
    SUMX(
        SUMMARIZE(
            data_prefinal,
            data_prefinal[SO_NO_DOC],
            "InspectQty", MAX(data_prefinal[total_inspect])
        ),
        [InspectQty]
    ),
    REMOVEFILTERS(mt_defect)
)
```

Backend denominator key:

```text
prefinal|SO_NO_DOC
```

Backend status: aligned by formula. Value mismatch remains for the screenshot filter context.

### Pre Final Defect Rate

PBIX DAX:

```DAX
DIVIDE(
    [Pre Final Defect Qty],
    [Total Inspect Pre Final]
)
```

Backend status: aligned by formula.

### Pre Final Adjusted Measures

PBIX also contains:

- `Total Inspect Pre Final (Adjusted)`
- `Pre Final Defect Rate (Adjusted)`

The visible overview/ribbon visuals use `Pre Final Defect Rate`, not the adjusted measure. The backend therefore uses the non-adjusted denominator unless a future frontend page explicitly needs the adjusted measure.

### Final Defect Qty

PBIX DAX:

```DAX
SUM('data_final'[DEFECT_QTY])
```

Backend status: aligned. The backend no longer falls back to `total_defect_found` for this numerator.

### Total Inspect Final

PBIX DAX:

```DAX
CALCULATE(
    SUMX(
        ADDCOLUMNS(
            SUMMARIZE(
                data_final,
                data_final[DATE],
                data_final[Sewing Line#],
                data_final[SO_NO_DOC],
                data_final[Order Quantity (Pcs)],
                data_final[Type Of Inspection],
                data_final[Color ]
            ),
            "InspectQty", CALCULATE(MAX(data_final[Total Garment Inspected]))
        ),
        [InspectQty]
    ),
    REMOVEFILTERS(data_final[DEFECT_CODE], data_final[DEFECT_DESC])
)
```

Backend denominator key:

```text
final|date|sewing_line|SO_NO_DOC|order_quantity|type_of_inspection|color
```

Backend status: aligned by formula.

### Final Defect Rate

PBIX DAX:

```DAX
DIVIDE([Final Defect Qty], [Total Inspect Final])
```

Backend status: aligned by formula. Current imported data returns `178 / 10,854 = 1.64%`; the screenshot overview card does not display Final as a top KPI, but the monthly chart includes Final.

### Third Party Defect Qty

PBIX DAX:

```DAX
SUM('data_3party'[DefectQty])
```

Backend status: aligned.

### Total Inspect 3party (Distinct)

PBIX DAX:

```DAX
SUMX(
    SUMMARIZE(
        data_3party,
        data_3party[Date],
        data_3party[fac-line],
        data_3party[SO#],
        data_3party[Style],
        data_3party[Color ],
        "InspectQty", MAX(data_3party[Inspet. (Qty.)])
    ),
    [InspectQty]
)
```

Backend denominator key:

```text
thirdparty|date|fac_line|SO_NO|style|color
```

Backend status: aligned. Current imported data returns `356 / 10,156 = 3.51%`, matching the screenshot rate after rounding.

### Third Party Defect Rate

PBIX DAX:

```DAX
DIVIDE(
    'data_3party'[Third Party Defect Qty],
    'data_3party'[Total Inspect 3party (Distinct)]
)
```

Backend status: aligned.

## Scan Quantity Measures

### SEW QTY

PBIX DAX:

```DAX
CALCULATE(
    SUM('data_fn_fg'[QTY]),
    'data_fn_fg'[STEP] = "6 SEW"
)
```

Backend mapping: `scan_qty_type = 'SEW QTY'` when `step ILIKE '%SEW%'`.

Current imported data returns `21,898` for the screenshot filter set, matching the screenshot.

### FN QTY

PBIX DAX:

```DAX
CALCULATE(
    SUM('data_fn_fg'[QTY]),
    'data_fn_fg'[STEP] = "7 FN"
)
```

Backend maps this to API field `enQty` because the dashboard label is `EN QTY`.

Current imported data returns `24,811`, matching the screenshot.

### FG QTY

PBIX DAX:

```DAX
CALCULATE(
    SUM('data_fn_fg'[QTY]),
    'data_fn_fg'[STEP] = "8 FG"
)
```

Current imported data returns `30,627`, matching the screenshot.

## Other Measures

### Line Visible by SO

PBIX DAX:

```DAX
VAR _Line = SELECTEDVALUE(mt_department[fac-line])
VAR _CountLine =
    CALCULATE(
        COUNTROWS(bridge_so_line),
        TREATAS(VALUES(mt_so[SO_NO_DOC]), bridge_so_line[SO_NO_DOC]),
        bridge_so_line[fac-line] = _Line
    )
RETURN
IF(
    ISBLANK(_Line),
    0,
    IF(_CountLine > 0, 1, 0)
)
```

Backend equivalent: `/api/filters` returns line options from filtered unified data. This is not an exact DAX implementation because the backend does not yet regenerate `bridge_so_line` from facts for slicer visibility; it is close for dashboard API behavior.

### Target Lines

PBIX DAX:

- `Target Inline`: returns `0.03` when Inline is selected in `Defect Rate`
- `Target 2pct`: returns `0.02` for other selected defect-rate categories

Backend currently exposes target metadata as percentage points in the API:

- Inline: `3.5`
- Endline: `2`
- Pre Final: `1.2`
- Final: `0.7`
- Third Party: `0.5`

Mismatch: target/reference-line logic is not fully PBIX-aligned. It affects chart reference lines, not numerator/denominator calculations.

## Summary of Formula Fixes Applied

- Denominators are now calculated by `SUM(MAX(quantity) GROUP BY denominator_key)` instead of raw row sums.
- Inline, Endline, and Pre Final numerators ignore blank defect-code rows.
- Final numerator uses only `DEFECT_QTY`.
- Third Party denominator no longer includes audit in the distinct grain.
- API rates are returned as percentage points.

