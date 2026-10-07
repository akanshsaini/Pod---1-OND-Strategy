Pod 1 Interactive Reports

Open index.html in your browser, or use the running preview at http://localhost:8765/.
Keep the HTML, CSS, JavaScript and data files together. The dashboard also works directly from a local file.

Default: Website performance, Zero1, full report period, all devices, the 38 requested geos, websites only.
Click a website to drill into countries, then click a country to inspect its devices. Active drill-down filters appear above the cards and can be removed individually.

Interactive reports:
- Group by up to three dimensions in any order: Website, Country, Device, Date and Network.
- Show any combination of the nine supplied GAM metrics, plus website pageviews when imported.
- Every website, geo, device, date, inventory and drill-down filter applies to cards, trends and results together.
- Add aggregate metric filters, including percentage-point changes, to narrow the report. Cards/charts then summarize those matching groups. Metric filters are inactive in Source rows.
- Compare equal-length periods. The previous-period option uses the immediately preceding calendar days. Missing report dates make comparisons unavailable rather than treating missing data as zero.
- Select the trend metric. Hover chart points for exact daily and comparison values; click ranking results to drill down.
- Switch between Table, Daily pivot and Source rows. Source rows preserve every original supplied metric, including viewability and reported eCPM.
- Sort columns, paginate and export all filtered results, not just the current page.
- Save report layouts and filters using Save report. Reuse them from the sidebar.

The six sidebar reports are starting layouts: Performance overview, Match-rate analysis, Geography & devices, Period changes, Daily performance and Source data. Source data selects all available geos and inventory, including blank-domain and mobile-app rows. The default website view continues to use the requested geos.

Data management:
Manage data lets you replace Zero1 or Ellipsis, or add reporting dates. When adding dates, an incoming date replaces all existing rows for that date to avoid overlap; other dates remain. Use consistent GAM export filters and USD currency. Imported data is stored locally in this browser through IndexedDB, with a session-only fallback if storage is unavailable. Saved reports use localStorage. Restoring supplied data resets that network to the original attached report. No direct GAM connection or scheduled report fetch is configured.

All supplied data is retained: 272,735 Zero1 rows and 265,787 Ellipsis rows, with Date, Domain, Country, Device category, and all nine metrics. Domain labels that are empty display as (Unknown domain). The supplied reports also contain Caribbean Netherlands, which is available in the geo selector but excluded from the default 38-geos scope.

Metrics:
Match rate = responses served / total requests.
Average eCPM = revenue / impressions * 1,000.
Delivery rate = impressions / responses served.
Request eCPM = revenue / total requests * 1,000.
Additive metrics are summed. Aggregate rates use the correct summed numerator and denominator. Source rows preserve GAM-reported values, which may differ slightly from rates recalculated from rounded revenue.
Active View viewability is retained in Source rows. To aggregate it correctly, also export Ad Exchange Active View measurable impressions and Ad Exchange Active View viewable impressions. The importer recognizes those counts. Aggregating percentages by an unweighted average would be misleading, so unsupported multi-row rollups display n.a.

Pageviews:
Use Manage data, select the network, and import Date, Website, Pageviews. Supply one daily full-website total per row; use an explicit 0 for a known zero. Mapping file columns are Website, Domain. The template buttons provide layouts. Domain matching normalizes URL prefixes and www. Unmatched names appear in Manage data. Missing dates and conflicting aliases return n.a. to avoid partial or double-counted totals.
Select Website pageviews in the builder. Values appear for website rows, optionally grouped by Date or Network. Country/device breakdowns return n.a. because full-site traffic cannot be distributed across those dimensions without more data. When viewing Both networks, group by Network as well to preserve pageview ownership. GAM geo/device filters do not change full-site pageviews.

Exported percentage columns contain percentage numbers, e.g. 1 means 1%. Percentage changes in rates are percentage points. Table exports include period/filter metadata and comparison values. Source exports retain the nine original source metrics.

The standalone zero1_pivot.csv and ellipsis_pivot.csv remain available as earlier generated 30-day pivots. Those files use fractions in columns explicitly labelled (fraction), so 0.01 means 1%.

Optional permanent bundle update:
python pivot_processor.py --input "path-to-report.csv" --network Zero1 --output zero1_pivot.csv --seed data-zero1.js
python pivot_processor.py --input "path-to-report.csv" --network Ellipsis --output ellipsis_pivot.csv --seed data-ellipsis.js

Validation: node test-reports.js verifies all source rows and metrics, grouping, comparisons, date drill-downs, network isolation, date merging, viewability denominators and pageview matching. Browser checks cover filtering, drill-downs, original-source browsing, comparisons, saved reports and CSV exports. Source totals reconcile with the earlier verified counts in verification-totals.json.

The original dashboard and processor are preserved in backup. Original raw.csv, table form.csv and pivot_output.csv remain reference files.
