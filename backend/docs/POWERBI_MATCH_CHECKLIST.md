# Power BI Match Checklist

Source file: `C:\Users\hiruk\Downloads\6_Travis.pbix`

Primary comparison filter set used during this phase:

- Customer display: `Travis Mathew`
- PBIX page filter: `mt_so[Brand] = 'TRAVIS MATHEW-GROSSWELL'`
- Factory: `G3`
- Date range: `2026-01-05` to `2026-06-04`

Status values:

- `match`: backend value matches the screenshot or extracted PBIX logic for the tested context
- `mismatch`: backend value differs and needs follow-up
- `pending`: needs manual comparison in Power BI Desktop because PBIX extraction was incomplete or screenshots do not expose enough detail

## Overview KPI Cards

| Metric | Power BI expected from screenshot | Backend API after PBIX-aligned formulas | Status | Notes |
| --- | ---: | ---: | --- | --- |
| Inline Defect Qty | 3,304 | 3,304 | match | Numerator matches |
| Total Process Checks | 122,320 | 125,060 | mismatch | DAX grain is aligned; value differs by 2,740 in imported data/context |
| Inline Defect Rate | 2.70% | 2.64% | mismatch | Follows denominator mismatch |
| Endline Defect Qty | 9,602 / 10K | 9,602 | match | Rounded screenshot shows 10K |
| Total Endline Inspected | 203,608 | 203,608 | match |  |
| Endline Defect Rate | 4.72% | 4.72% | match |  |
| Pre Final Defect Qty | 385 | 61 | mismatch | Exact Travis/G3 filter in imported data gives 61; screenshot context differs |
| Total Pre Final Inspected | 6,620 | 2,328 | mismatch | Exact Travis/G3 filter in imported data differs |
| Pre Final Defect Rate | 5.82% | 2.62% | mismatch | Follows numerator/denominator mismatch |
| Third Party Defect Qty | 356 | 356 | match |  |
| Total Inspect 3party | 10K | 10,156 | match | Screenshot rounds to 10K |
| Third Party Defect Rate | 3.51% | 3.51% | match |  |

## Scan Quantity

| Metric | Power BI expected from screenshot | Backend API value | Status |
| --- | ---: | ---: | --- |
| SEW QTY | 21,898 | 21,898 | match |
| FN/EN QTY | 24,811 | 24,811 | match |
| FG QTY | 30,627 | 30,627 | match |

## Monthly Ribbon Chart

| Item | Status | Notes |
| --- | --- | --- |
| Uses extracted DAX denominator grains | match | Backend monthly rates use `SUM(MAX(...) GROUP BY denominator_key)` |
| Inline monthly values | pending | Needs manual visual-by-visual comparison after denominator context is resolved |
| Endline monthly values | pending |  |
| Pre Final monthly values | mismatch | Overall Pre Final filter context mismatch remains |
| Final monthly values | pending | Formula aligned but screenshot only labels selected points |
| Third Party monthly values | pending | Formula aligned |

## Weekly Trend Chart

| Item | Status | Notes |
| --- | --- | --- |
| Uses `/api/weekly-trend` with DAX denominator grains | match | Backend formula corrected |
| Target/reference lines | mismatch | PBIX target measures expose 3% Inline and 2% other selected rates; backend currently uses stage-specific targets |
| Point labels and peak values | pending | Needs manual Power BI comparison |

## Defect Category Chart and Table

| Item | Status | Notes |
| --- | --- | --- |
| Defect category field source | match | Uses `mt_defect[defect_desc_eng]` equivalent |
| Inline defect category totals | match | Top values such as `Uneven... = 786` match screenshot |
| Endline defect category totals | match | Top values such as `Oil Stain = 2,747` match screenshot |
| Final defect category totals | match | Total `178` matches screenshot |
| Third Party defect category totals | match | Total `356` matches screenshot |
| Pre Final defect category totals | mismatch | Screenshot total `385`; exact backend filter returns `61` |

## Line-Level Analysis

| Item | Status | Notes |
| --- | --- | --- |
| Line relationship | partial | Backend uses `fac_line` plus department/bridge fallbacks |
| Line-level rates | pending | Needs manual Power BI comparison after Pre Final context is resolved |
| Line detail table | pending |  |

## Stage Deep Dive Pages

| Stage | Status | Notes |
| --- | --- | --- |
| Inline | pending | Formula aligned; screenshot stage page has a different date end (`2026-05-19`) |
| Endline | pending | Formula aligned; needs manual comparison |
| Pre Final | mismatch | Screenshot context differs from exact backend filter |
| Final | pending | Formula aligned |
| Third Party | pending | Formula aligned |

## Filters

| Filter | PBIX source | Backend source | Status |
| --- | --- | --- | --- |
| Customer/report brand | `mt_so[Brand]` page filter | `v_dim_so.customer` display from `raw_mt_so.brand` / `mt_so_base` | partial |
| Factory | `mt_factory[FACTORY]` | `v_dim_factory.factory_display` | match |
| Date | `Date[Date]` | Fact date fields via `inspection_date` | partial |
| SO Number | `mt_so[SO_NO_DOC]` | Unified `so_no_doc` / `so_no` | partial |
| Style | `mt_so[STYLE_REF]` | Unified `style` / `style_ref` | partial |
| Line Number | `mt_department[fac-line]` with `Line Visible by SO` | Filtered unified `fac_line` | partial |
| Defect Description | `mt_defect[defect_desc_eng]` | Unified defect description from `v_dim_defect` | match |
| Inspection Category | `Defect Rate[Defect Rate]` | `inspection_stage` | partial |

## Remaining Manual Checks

- Open the PBIX in Power BI Desktop and verify whether the Overview page is filtered by factory `G3` or all factories.
- Inspect whether the page date slicer includes June 4, 2026 for Pre Final, or whether the displayed end date is a formatting artifact.
- Confirm why extracted relationships omit `mt_so`, `Date`, and `bridge_so_line` despite report visuals using those tables.
- Compare `/api/debug/powerbi-validation` against the Power BI visual values for each page.

