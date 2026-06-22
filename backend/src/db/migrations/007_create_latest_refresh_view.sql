CREATE OR REPLACE VIEW o2.v_latest_refresh_date AS
SELECT MAX(refresh_date) AS refresh_date
FROM o2.raw_refresh_date
WHERE refresh_date IS NOT NULL;
