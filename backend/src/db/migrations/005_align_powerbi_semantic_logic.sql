CREATE OR REPLACE VIEW o2.v_inline_denominator AS
SELECT
  'Inline'::text AS inspection_stage,
  denominator_key,
  MIN(inspection_date) AS min_inspection_date,
  MAX(inspection_date) AS max_inspection_date,
  customer,
  cust_code,
  factory_source_code,
  factory_display,
  so_no_doc,
  so_no,
  so_year,
  style,
  style_ref,
  fac_line,
  MAX(process_checks) AS denominator_qty
FROM o2.v_fact_inline
GROUP BY
  denominator_key,
  customer,
  cust_code,
  factory_source_code,
  factory_display,
  so_no_doc,
  so_no,
  so_year,
  style,
  style_ref,
  fac_line;

COMMENT ON VIEW o2.v_inline_denominator IS
  'Power BI DAX grain: SUMX(SUMMARIZE(data_inline, data_inline[fac-line], data_inline[SO_NO_DOC], "InspectQty", MAX(data_inline[TOTAL_INSPECT])), [InspectQty]).';

CREATE OR REPLACE VIEW o2.v_endline_denominator AS
SELECT
  'Endline'::text AS inspection_stage,
  denominator_key,
  inspection_date,
  customer,
  cust_code,
  factory_source_code,
  factory_display,
  so_no_doc,
  so_no,
  so_year,
  style,
  style_ref,
  fac_line,
  MAX(inspected_qty) AS denominator_qty
FROM o2.v_fact_endline
GROUP BY
  denominator_key,
  inspection_date,
  customer,
  cust_code,
  factory_source_code,
  factory_display,
  so_no_doc,
  so_no,
  so_year,
  style,
  style_ref,
  fac_line;

COMMENT ON VIEW o2.v_endline_denominator IS
  'Power BI DAX grain: SUMX(SUMMARIZE(data_endline, data_endline[job_date], data_endline[fac-line], data_endline[SO_NO_DOC], "InspectQty", MAX(data_endline[total_inspect])), [InspectQty]).';

CREATE OR REPLACE VIEW o2.v_prefinal_denominator AS
SELECT
  'Pre Final'::text AS inspection_stage,
  denominator_key,
  MIN(inspection_date) AS min_inspection_date,
  MAX(inspection_date) AS max_inspection_date,
  customer,
  cust_code,
  factory_source_code,
  factory_display,
  so_no_doc,
  so_no,
  so_year,
  style,
  style_ref,
  MAX(inspected_qty) AS denominator_qty
FROM o2.v_fact_prefinal
GROUP BY
  denominator_key,
  customer,
  cust_code,
  factory_source_code,
  factory_display,
  so_no_doc,
  so_no,
  so_year,
  style,
  style_ref;

COMMENT ON VIEW o2.v_prefinal_denominator IS
  'Power BI DAX grain: SUMX(SUMMARIZE(data_prefinal, data_prefinal[SO_NO_DOC], "InspectQty", MAX(data_prefinal[total_inspect])), [InspectQty]).';

CREATE OR REPLACE VIEW o2.v_final_denominator AS
SELECT
  'Final'::text AS inspection_stage,
  denominator_key,
  inspection_date,
  customer,
  cust_code,
  factory_source_code,
  factory_display,
  so_no_doc,
  so_no,
  so_year,
  style,
  style_ref,
  fac_line,
  MAX(inspected_qty) AS denominator_qty
FROM o2.v_fact_final
GROUP BY
  denominator_key,
  inspection_date,
  customer,
  cust_code,
  factory_source_code,
  factory_display,
  so_no_doc,
  so_no,
  so_year,
  style,
  style_ref,
  fac_line;

COMMENT ON VIEW o2.v_final_denominator IS
  'Power BI DAX grain: SUMX(SUMMARIZE(data_final, DATE, Sewing Line#, SO_NO_DOC, Order Quantity (Pcs), Type Of Inspection, Color, "InspectQty", MAX(Total Garment Inspected)), [InspectQty]).';

CREATE OR REPLACE VIEW o2.v_third_party_denominator AS
SELECT
  'Third Party'::text AS inspection_stage,
  denominator_key,
  inspection_date,
  customer,
  cust_code,
  factory_source_code,
  factory_display,
  so_no_doc,
  so_no,
  so_year,
  style,
  style_ref,
  fac_line,
  MAX(inspected_qty) AS denominator_qty
FROM o2.v_fact_third_party
GROUP BY
  denominator_key,
  inspection_date,
  customer,
  cust_code,
  factory_source_code,
  factory_display,
  so_no_doc,
  so_no,
  so_year,
  style,
  style_ref,
  fac_line;

COMMENT ON VIEW o2.v_third_party_denominator IS
  'Power BI DAX grain: SUMX(SUMMARIZE(data_3party, Date, fac-line, SO#, Style, Color, "InspectQty", MAX(Inspet. (Qty.))), [InspectQty]).';

CREATE OR REPLACE VIEW o2.v_quality_denominators_unified AS
SELECT
  inspection_stage,
  denominator_key,
  COALESCE(min_inspection_date, NULL) AS min_inspection_date,
  COALESCE(max_inspection_date, NULL) AS max_inspection_date,
  NULL::date AS inspection_date,
  customer,
  cust_code,
  factory_source_code,
  factory_display,
  so_no_doc,
  so_no,
  so_year,
  style,
  style_ref,
  fac_line,
  denominator_qty
FROM o2.v_inline_denominator
UNION ALL
SELECT
  inspection_stage,
  denominator_key,
  inspection_date AS min_inspection_date,
  inspection_date AS max_inspection_date,
  inspection_date,
  customer,
  cust_code,
  factory_source_code,
  factory_display,
  so_no_doc,
  so_no,
  so_year,
  style,
  style_ref,
  fac_line,
  denominator_qty
FROM o2.v_endline_denominator
UNION ALL
SELECT
  inspection_stage,
  denominator_key,
  min_inspection_date,
  max_inspection_date,
  NULL::date AS inspection_date,
  customer,
  cust_code,
  factory_source_code,
  factory_display,
  so_no_doc,
  so_no,
  so_year,
  style,
  style_ref,
  NULL::text AS fac_line,
  denominator_qty
FROM o2.v_prefinal_denominator
UNION ALL
SELECT
  inspection_stage,
  denominator_key,
  inspection_date AS min_inspection_date,
  inspection_date AS max_inspection_date,
  inspection_date,
  customer,
  cust_code,
  factory_source_code,
  factory_display,
  so_no_doc,
  so_no,
  so_year,
  style,
  style_ref,
  fac_line,
  denominator_qty
FROM o2.v_final_denominator
UNION ALL
SELECT
  inspection_stage,
  denominator_key,
  inspection_date AS min_inspection_date,
  inspection_date AS max_inspection_date,
  inspection_date,
  customer,
  cust_code,
  factory_source_code,
  factory_display,
  so_no_doc,
  so_no,
  so_year,
  style,
  style_ref,
  fac_line,
  denominator_qty
FROM o2.v_third_party_denominator;
