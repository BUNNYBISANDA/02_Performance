# PBIX Model Audit

Source file: `C:\Users\hiruk\Downloads\6_Travis.pbix`

Audit date: 2026-06-19

## Extraction Method

The PBIX can be inspected as a package. It contains `DataModel`, `DiagramLayout`, `Report/Layout`, `Metadata`, `Connections`, and resource files.

The embedded `DataModel` is XPress9-compressed. It was inspected with `pbixray`, which successfully extracted:

- 13 table names
- 129 schema columns
- 12 active relationships
- 29 DAX measures
- 12 DAX calculated columns
- 5 DAX calculated table expressions
- report layout filters and visual field bindings

Limitation: `pbixray.get_table()` did not expose all columns for some calculated tables. In particular, the report layout references `mt_so[Brand]`, `mt_so[SO_NO_DOC]`, and `mt_so[STYLE_REF]`, but the extracted tabular column catalog only exposed `mt_so[SHIPMENT_DATE]`. The DAX table expression for `mt_so` was extractable and is documented below.

## Tables Found

Physical/imported tables:

- `Refresh Date`
- `SortTable`
- `data_3party`
- `data_endline`
- `data_final`
- `data_fn_fg`
- `data_inline`
- `data_prefinal`
- `mt_defect`
- `mt_department`
- `mt_factory`
- `mt_so_base`

Calculated/logical tables referenced by DAX or layout:

- `mt_so`
- `bridge_so_line`
- `Date`
- `Defect Qty`
- `Defect Rate`

## Important Columns

`data_inline`

- `TOTAL_INSPECT`
- `JOB_DATE`
- `ID_BU`
- `LINE_NO`
- `SO_NO`
- `SO_YEAR`
- `DEFECT_DESC_ENG`
- `CNT_FAILED`
- `DEFECT_CODE`
- calculated `fac-line`
- calculated `SO_NO_DOC`

`data_endline`

- `total_inspect`
- `job_date`
- `location_code`
- `defect_code`
- `line_name`
- `so_no`
- `so_year`
- `defect_point`
- `good_qty`
- `order_qty`
- calculated `SO_NO_DOC`
- calculated `fac-line`

`data_prefinal`

- `location_code`
- `line_name`
- `job_date`
- `so_no`
- `so_year`
- `defect_codes`
- `total_defects`
- `defect_descs`
- `order_qty`
- calculated `fac-line`
- calculated `SO_NO_DOC`
- calculated `total_inspect`

`data_final`

- `FACTORY`
- `DATE`
- `SO YEAR`
- `SO #`
- `Style #`
- `Cust_Code`
- `Sewing Line#`
- `Type Of Inspection`
- `Order Quantity (Pcs)`
- `Total Garment Inspected`
- `DEFECT_CODE`
- `DEFECT_DESC`
- `DEFECT_QTY`
- `Color `
- calculated `SO_NO_DOC`
- calculated `fac-line`

`data_3party`

- `Date`
- `Line`
- `Style`
- `SO#`
- `Color `
- `Audit `
- `Code`
- `DefectQty`
- `fac-line`
- `Inspet. (Qty.)`
- calculated `SO_YEAR`
- calculated `SO_NO_DOC`

`data_fn_fg`

- `BU_ID`
- `STEP`
- `SO_NO_DOC`
- `CUST_NAME`
- `STYLE_CODE`
- `TRX_DATE`
- `QTY`
- `Factory`

Dimensions:

- `mt_defect`: `defect_code`, `defect_desc_eng`, `defect_grp_code`, `defect_grp_problem`, `type_top`, `type_bottom`, `color`, `active`
- `mt_department`: `LOCATION_CODE`, `LINE_NAME`, `SUB_DEPARTMENT`, `Department_head`, `fac-line`
- `mt_factory`: `FACTORY`, `Index`, `BU`, `FACTORYG`, `factory_FI`
- `mt_so_base`: `SO_YEAR`, `SO_NO`, `SO_NO_DOC`, `STYLE_CODE`, `STYLE_REF`, `SHIPMENT_DATE`, `CUST_CODE`, `CUST_NAME`, `BRAND_CODE`, `BRAND_NAME`, calculated `SO_NO_DOC_REF`

## Relationships Extracted

All extracted relationships are active, many-to-one, single direction, with no referential-integrity enforcement.

| From | To | Cardinality | Direction |
| --- | --- | --- | --- |
| `data_inline[fac-line]` | `mt_department[fac-line]` | M:1 | Single |
| `mt_department[LOCATION_CODE]` | `mt_factory[FACTORY]` | M:1 | Single |
| `data_inline[DEFECT_CODE]` | `mt_defect[defect_code]` | M:1 | Single |
| `data_prefinal[fac-line]` | `mt_department[fac-line]` | M:1 | Single |
| `data_prefinal[defect_codes]` | `mt_defect[defect_code]` | M:1 | Single |
| `data_final[DEFECT_CODE]` | `mt_defect[defect_code]` | M:1 | Single |
| `data_endline[defect_code]` | `mt_defect[defect_code]` | M:1 | Single |
| `data_3party[fac-line]` | `mt_department[fac-line]` | M:1 | Single |
| `data_3party[Code]` | `mt_defect[defect_code]` | M:1 | Single |
| `data_fn_fg[Factory]` | `mt_factory[FACTORY]` | M:1 | Single |
| `data_endline[fac-line]` | `mt_department[fac-line]` | M:1 | Single |
| `data_final[fac-line]` | `mt_department[fac-line]` | M:1 | Single |

No relationship involving `mt_so`, `bridge_so_line`, or `Date` was exposed by the relationship extractor, even though the report layout uses those tables for slicers/page filters. The backend therefore preserves fact rows with `LEFT JOIN`s and uses the extracted DAX table expressions as relationship guidance where explicit relationship metadata is absent.

## Calculated Columns

| Table | Column | Expression summary |
| --- | --- | --- |
| `data_inline` | `fac-line` | `[ID_BU] & "-" & [LINE_NO]` |
| `data_inline` | `SO_NO_DOC` | `[SO_YEAR] & "" & [SO_NO]` |
| `data_endline` | `fac-line` | `[location_code] & "-" & [line_name]` |
| `data_endline` | `SO_NO_DOC` | `[so_year] & "" & [so_no]` |
| `data_prefinal` | `fac-line` | `[location_code] & "-" & [line_name]` |
| `data_prefinal` | `SO_NO_DOC` | `[SO_YEAR] & "" & [SO_NO]` |
| `data_prefinal` | `total_inspect` | Sampling-plan lookup from `order_qty` |
| `data_final` | `SO_NO_DOC` | `[SO YEAR] & "" & [SO #]` |
| `data_3party` | `SO_YEAR` | `LOOKUPVALUE(data_endline[SO_YEAR], data_endline[SO_NO], data_3party[SO#])` |
| `data_3party` | `SO_NO_DOC` | `[SO_YEAR] & "" & [SO#]` |
| `mt_so_base` | `SO_NO_DOC_REF` | `[SO_YEAR] & FORMAT([SO_NO], "0000")` |
| `mt_so` | `SHIPMENT_DATE` | Lookup max `mt_so_base[SHIPMENT_DATE]` by `SO_NO_DOC_REF` |

## Calculated Tables

`mt_so` is built as a distinct union of `SO_NO_DOC` from:

- `data_prefinal`
- `data_inline`
- `data_endline`
- `data_final`
- `data_3party`
- `data_fn_fg`

It then adds:

- `Brand` from `MAX(mt_so_base[BRAND_NAME])` where `mt_so_base[SO_NO_DOC_REF] = mt_so[SO_NO_DOC]`
- `STYLE_REF` from `MAX(mt_so_base[STYLE_REF])` by the same key

`bridge_so_line` is built as a distinct union of `SO_NO_DOC` and `fac-line` from:

- `data_prefinal`
- `data_inline`
- `data_endline`
- `data_final`
- `data_3party`

`Date` is generated from min/max dates across:

- `data_inline[JOB_DATE]`
- `data_endline[job_date]`
- `data_prefinal[job_date]`

The extracted `Date` DAX table does not include `data_final`, `data_3party`, or `data_fn_fg` in its min/max expression.

## Report Layout Filters

The main report pages have a page-level categorical filter:

- `mt_so[Brand] = 'TRAVIS MATHEW-GROSSWELL'`

Visible slicer fields in the extracted layout:

- Date: `Date[Date]`
- SO Number: `mt_so[SO_NO_DOC]`
- Style: `mt_so[STYLE_REF]`
- Line Number: `mt_department[fac-line]`
- Defect Description: `mt_defect[defect_desc_eng]`
- Inspection Category: `Defect Rate[Defect Rate]`

Line slicers use measure `mt_department[Line Visible by SO]`, which checks `bridge_so_line` with `TREATAS(VALUES(mt_so[SO_NO_DOC]), bridge_so_line[SO_NO_DOC])`.

## PostgreSQL Relationship Gap Table

| PBIX relationship or logic | Current backend relationship | Match? | Action |
| --- | --- | --- | --- |
| Fact defect code to `mt_defect[defect_code]` | `v_dim_defect` joined by cleaned defect code in each fact view | Yes | Keep |
| Fact `fac-line` to `mt_department[fac-line]` | Fact views resolve `fac_line` and join `v_dim_department` where possible | Mostly | Keep fallback logic for missing line values |
| `mt_department[LOCATION_CODE]` to `mt_factory[FACTORY]` | `v_dim_factory` maps source factory codes to display factory | Yes | Keep `FACTORY` as display field |
| `data_fn_fg[Factory]` to `mt_factory[FACTORY]` | `v_scan_qty` joins `v_dim_factory` by `Factory` | Yes | Keep |
| `mt_so` calculated table from fact SOs | `v_dim_so` combines raw `mt_so` and `mt_so_base` using `so_fact_key` | Partial | Add audit note: extractor did not expose all calculated `mt_so` columns |
| `mt_so[Brand]` page filter | Backend customer filter currently uses display `customer` from `v_dim_so` | Partial | `Travis Mathew` display maps to `TRAVIS MATHEW-GROSSWELL`; verify per stage |
| `bridge_so_line` calculated table | Backend uses raw/imported `raw_bridge_so_line` plus line fallbacks | Partial | Consider regenerating `bridge_so_line` as a view from fact tables if slicer behavior diverges |
| `Date` calculated table | `v_dim_date` spans all fact/scan dates | Partial | Backend is broader than PBIX min/max but fact filters still use stage date fields |
| Denominator DAX measures | Backend denominator keys now match extracted DAX grains | Yes for formulas | Manual Power BI value comparison still required |

## Data Version Note

The PBIX embedded fact-table row counts differ from the PostgreSQL Excel import. For example, PBIXRay reported `data_inline` with 12,513 rows, while the imported workbook has a larger raw table. This means formula alignment can be verified from the PBIX, but exact screenshot value alignment also depends on using the same source extract/version and report filter context.

