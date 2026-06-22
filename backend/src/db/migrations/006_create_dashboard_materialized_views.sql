DROP MATERIALIZED VIEW IF EXISTS o2.mv_scan_qty;
DROP MATERIALIZED VIEW IF EXISTS o2.mv_quality_defects_unified;

CREATE MATERIALIZED VIEW o2.mv_quality_defects_unified AS
SELECT
  inspection_stage,
  inspection_date,
  year,
  month_number,
  month_name,
  iso_week,
  factory_source_code,
  factory_display,
  factory,
  customer,
  cust_code,
  so_no_doc,
  so_no,
  so_year,
  style,
  style_ref,
  fac_line,
  fac_line_normalized,
  defect_code,
  defect_desc_eng,
  defect_qty,
  inspected_qty,
  process_checks,
  denominator_key,
  source_table
FROM o2.v_quality_defects_unified;

CREATE INDEX idx_o2_mv_quality_customer ON o2.mv_quality_defects_unified (customer);
CREATE INDEX idx_o2_mv_quality_factory_display ON o2.mv_quality_defects_unified (factory_display);
CREATE INDEX idx_o2_mv_quality_factory ON o2.mv_quality_defects_unified (factory);
CREATE INDEX idx_o2_mv_quality_inspection_date ON o2.mv_quality_defects_unified (inspection_date);
CREATE INDEX idx_o2_mv_quality_inspection_stage ON o2.mv_quality_defects_unified (inspection_stage);
CREATE INDEX idx_o2_mv_quality_fac_line ON o2.mv_quality_defects_unified (fac_line);
CREATE INDEX idx_o2_mv_quality_so_no_doc ON o2.mv_quality_defects_unified (so_no_doc);
CREATE INDEX idx_o2_mv_quality_style ON o2.mv_quality_defects_unified (style);
CREATE INDEX idx_o2_mv_quality_defect_desc ON o2.mv_quality_defects_unified (defect_desc_eng);
CREATE INDEX idx_o2_mv_quality_scope ON o2.mv_quality_defects_unified (customer, factory_display, inspection_date);
CREATE INDEX idx_o2_mv_quality_normalized_scope ON o2.mv_quality_defects_unified (
  LOWER(TRIM(COALESCE(customer, ''))),
  LOWER(TRIM(COALESCE(factory, ''))),
  inspection_date
);
CREATE INDEX idx_o2_mv_quality_normalized_line ON o2.mv_quality_defects_unified (LOWER(TRIM(COALESCE(fac_line, ''))));
CREATE INDEX idx_o2_mv_quality_normalized_so ON o2.mv_quality_defects_unified (LOWER(TRIM(COALESCE(so_no_doc, ''))));
CREATE INDEX idx_o2_mv_quality_normalized_style ON o2.mv_quality_defects_unified (LOWER(TRIM(COALESCE(style, ''))));
CREATE INDEX idx_o2_mv_quality_normalized_defect ON o2.mv_quality_defects_unified (LOWER(TRIM(COALESCE(defect_desc_eng, ''))));

CREATE MATERIALIZED VIEW o2.mv_scan_qty AS
SELECT
  trx_date,
  year,
  month_number,
  month_name,
  iso_week,
  customer,
  factory_source_code,
  factory_display,
  so_no_doc,
  style,
  step,
  scan_qty_type,
  qty
FROM o2.v_scan_qty;

CREATE INDEX idx_o2_mv_scan_customer ON o2.mv_scan_qty (customer);
CREATE INDEX idx_o2_mv_scan_factory ON o2.mv_scan_qty (factory_display);
CREATE INDEX idx_o2_mv_scan_date ON o2.mv_scan_qty (trx_date);
CREATE INDEX idx_o2_mv_scan_so ON o2.mv_scan_qty (so_no_doc);
CREATE INDEX idx_o2_mv_scan_style ON o2.mv_scan_qty (style);
CREATE INDEX idx_o2_mv_scan_scope ON o2.mv_scan_qty (customer, factory_display, trx_date);
CREATE INDEX idx_o2_mv_scan_normalized_scope ON o2.mv_scan_qty (
  LOWER(TRIM(COALESCE(customer, ''))),
  LOWER(TRIM(COALESCE(factory_display, ''))),
  trx_date
);

ANALYZE o2.mv_quality_defects_unified;
ANALYZE o2.mv_scan_qty;
