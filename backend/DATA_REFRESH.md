# Safe Excel Data Refresh

Use this workflow for every supervisor workbook refresh. It validates the workbook and loads `o2_staging` before it can modify the live `o2` raw tables.

## What the command does

1. Validates every required sheet and mapped column before connecting to staging.
2. For a real refresh, attempts a timestamped `pg_dump` under `backend/backups/` and always creates timestamped SQL backup tables in `o2_backup`.
3. Recreates and loads the mapped raw tables under `o2_staging`.
4. Compares staging with live row counts, fact-table dates, customer/factory values, and KPI totals.
5. Stops without changing live tables if a required validation fails.
6. In one transaction, truncates and reloads every live raw table, verifies row counts, refreshes the dashboard materialized views, and commits. Any failure rolls the transaction back.

Large row-count or KPI changes are reported as warnings using `DATA_REFRESH_WARNING_PERCENT` (default 50%). Missing sheets/columns, empty key tables, missing fact dates, or fact dates that do not overlap the expected range are blocking errors.

## Workbook location

The workbook may be anywhere accessible from the machine running the backend. Always quote Windows paths that contain spaces.

Current supervisor file:

```powershell
cd C:\O2\backend
npm run refresh:data -- --file "C:\Users\hiruk\Downloads\7QA_All_Customer_v2 (1).xlsx" --dry-run
```

## Dry run

Run this first:

```powershell
cd C:\O2\backend
npm run refresh:data -- --file "C:\Users\hiruk\Downloads\7QA_All_Customer_v2 (1).xlsx" --dry-run
```

A dry run recreates and validates `o2_staging`. It does not create backups because it never modifies live tables, and it does not replace or refresh live data.

Review every warning, especially KPI percentage differences, before proceeding.

## Real refresh

Use a maintenance window and stop any long-running import job before starting:

```powershell
cd C:\O2\backend
npm run refresh:data -- --file "C:\Users\hiruk\Downloads\7QA_All_Customer_v2 (1).xlsx"
```

If `pg_dump` is installed and on `PATH`, a custom-format dump is written to `backend/backups/`. The SQL backup tables are mandatory and are created even when `pg_dump` is unavailable.

The command prints a backup run ID such as `20260622153000`. Backup tables use names such as:

```text
o2_backup.raw_data_inline_20260622153000
o2_backup.raw_data_endline_20260622153000
```

Refresh history is recorded in `o2_backup.refresh_runs`.

## Export GitHub Pages data

After a successful real refresh:

```powershell
cd C:\O2\backend
npm run export:static
```

Or run database refresh and static export together:

```powershell
cd C:\O2\backend
npm run refresh:data:and-export -- --file "C:\Users\hiruk\Downloads\7QA_All_Customer_v2 (1).xlsx"
```

The combined command exports static JSON only after the database refresh commits successfully.

## Roll back from SQL backup tables

First find the required run ID:

```sql
SELECT run_id, created_at, source_file, status
FROM o2_backup.refresh_runs
ORDER BY created_at DESC;
```

Replace `RUN_ID_HERE` below with that run ID. This restores all mapped raw tables atomically:

```sql
BEGIN;

DO $$
DECLARE
  table_name text;
  backup_suffix text := 'RUN_ID_HERE';
  tables text[] := ARRAY[
    'raw_bridge_so_line', 'raw_data_3party', 'raw_data_endline',
    'raw_data_final', 'raw_data_fn_fg', 'raw_data_inline',
    'raw_data_prefinal', 'raw_defect_qty', 'raw_defect_rate',
    'raw_mt_defect', 'raw_mt_department', 'raw_mt_factory',
    'raw_mt_so', 'raw_mt_so_base', 'raw_refresh_date', 'raw_sort_table'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables LOOP
    EXECUTE format('TRUNCATE TABLE o2.%I RESTART IDENTITY', table_name);
    EXECUTE format(
      'INSERT INTO o2.%I SELECT * FROM o2_backup.%I',
      table_name,
      table_name || '_' || backup_suffix
    );
    EXECUTE format(
      'SELECT setval(pg_get_serial_sequence(%L, %L), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM o2.%I',
      'o2.' || table_name,
      'id',
      table_name
    );
  END LOOP;
END $$;

REFRESH MATERIALIZED VIEW o2.mv_quality_defects_unified;
REFRESH MATERIALIZED VIEW o2.mv_scan_qty;
COMMIT;
```

Then regenerate the static JSON:

```powershell
cd C:\O2\backend
npm run export:static
```

If a custom-format dump exists, it can alternatively be restored with `pg_restore`. Use a separate recovery database first when possible so the dump can be inspected before replacing production data.

## Static JSON artifacts

Static JSON files under `public/data/` are generated artifacts and are ignored by
Git. To regenerate them locally after a successful refresh, run:

```powershell
cd C:\O2\backend
npm run export:static
```

For a GitHub Pages demo deployment, generated JSON must be produced before the
frontend build/deploy step so the static site has data available.

Do not commit `.env`, database dumps, generated static JSON, or supervisor workbooks containing production data.
