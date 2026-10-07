"""
AdOps Pivot Table Processor
Transforms raw Google Ad Manager CSV export into a structured pivot table.
"""

import csv
import sys
import io
from collections import defaultdict
from datetime import datetime

# Fix Unicode output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def parse_float(val):
    """Safely parse a float value, returning 0.0 on failure."""
    try:
        return float(str(val).strip().replace(',', ''))
    except (ValueError, TypeError):
        return 0.0

def main():
    input_file = 'raw.csv'
    output_file = 'pivot_output.csv'
    
    # ── STEP 1: Read and understand the CSV ──────────────────────────────
    with open(input_file, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        rows = list(reader)
    
    if not rows:
        print("ERROR: Empty CSV file.")
        return
    
    # Dynamically detect header row by looking for known column names
    header_row_idx = None
    col_map = {}
    target_cols = ['date', 'site', 'ad exchange revenue', 'estimated revenue',
                   'ad exchange match rate', 'ad exchange average ecpm', 
                   'total ad requests', 'ad exchange total requests']
    
    for i, row in enumerate(rows):
        lower_row = [str(c).strip().lower() for c in row]
        # Check if this row contains date/site and revenue columns
        has_date = any('date' in c for c in lower_row)
        has_site = any('site' in c for c in lower_row)
        has_revenue = any('revenue' in c for c in lower_row)
        
        if has_date and has_site and has_revenue:
            header_row_idx = i
            for j, col in enumerate(lower_row):
                col_map[col] = j
            break
    
    if header_row_idx is None:
        print("ERROR: Could not detect header row.")
        return
    
    header = [str(c).strip().lower() for c in rows[header_row_idx]]
    print(f"Detected header at row {header_row_idx + 1}")
    print(f"Columns: {header}")
    
    # Dynamically detect column positions by name
    date_col = None
    site_col = None
    revenue_col = None
    match_rate_col = None
    ecpm_col = None
    ad_requests_col = None
    
    for j, col in enumerate(header):
        if 'date' in col:
            date_col = j
        elif col in ('site', 'site (dcm)'):
            site_col = j
        elif 'revenue' in col and revenue_col is None:
            revenue_col = j
        elif 'match rate' in col and match_rate_col is None:
            match_rate_col = j
        elif 'average ecpm' in col or ('ecpm' in col and 'total' not in col):
            if ecpm_col is None:
                ecpm_col = j
        elif 'total ad requests' in col:
            ad_requests_col = j
        elif 'ad exchange total requests' in col and ad_requests_col is None:
            ad_requests_col = j
    
    print(f"\nColumn mapping:")
    print(f"  Date: col {date_col}")
    print(f"  Site: col {site_col}")
    print(f"  Revenue: col {revenue_col}")
    print(f"  Match Rate: col {match_rate_col}")
    print(f"  eCPM: col {ecpm_col}")
    print(f"  Ad Requests: col {ad_requests_col}")
    
    if None in (date_col, site_col, revenue_col):
        print("ERROR: Could not find required columns (Date, Site, Revenue).")
        return
    
    # ── STEP 2: Parse data rows ──────────────────────────────────────────
    data_rows = rows[header_row_idx + 1:]
    
    # Collect all dates and sites
    site_date_data = defaultdict(lambda: defaultdict(lambda: {
        'revenue': 0.0, 'match_rate': 0.0, 'ecpm': 0.0, 'ad_requests': 0
    }))
    all_dates = set()
    skip_sites = {'', 'total', 'grand total', 'web caches and other', '(blank)'}
    
    for row in data_rows:
        if len(row) <= max(filter(None, [date_col, site_col, revenue_col])):
            continue
        
        date_val = str(row[date_col]).strip()
        site_val = str(row[site_col]).strip()
        
        # Skip empty, total, and summary rows
        if site_val.lower() in skip_sites or not date_val:
            continue
        
        # Validate date format
        try:
            datetime.strptime(date_val, '%Y-%m-%d')
        except ValueError:
            continue
        
        all_dates.add(date_val)
        
        rev = parse_float(row[revenue_col]) if revenue_col is not None and revenue_col < len(row) else 0.0
        mr = parse_float(row[match_rate_col]) if match_rate_col is not None and match_rate_col < len(row) else 0.0
        ecpm = parse_float(row[ecpm_col]) if ecpm_col is not None and ecpm_col < len(row) else 0.0
        ar = parse_float(row[ad_requests_col]) if ad_requests_col is not None and ad_requests_col < len(row) else 0
        
        entry = site_date_data[site_val][date_val]
        entry['revenue'] += rev
        entry['match_rate'] = mr  # Take last value (they aggregate per site-day anyway)
        entry['ecpm'] = ecpm
        entry['ad_requests'] += ar
    
    # Sort dates and pick last 7
    sorted_dates = sorted(all_dates)
    print(f"\nAll dates found: {sorted_dates}")
    
    last_8_dates = sorted_dates[-8:] if len(sorted_dates) >= 8 else sorted_dates
    last_7_dates = sorted_dates[-7:] if len(sorted_dates) >= 7 else sorted_dates
    
    # We use last 8 dates for the full pivot (matching sample format: 8 days)
    # But for the "Status" flagging and D1-D7 logic, we use 7 days
    # Looking at sample: it has 8 date columns. Let me check...
    # The sample pivot has 8 dates (30-Mar to 6-Apr) = 8 days
    # The instruction says "LAST 7 DAYS" for revenue columns
    # Let's use the last 8 available dates for full output (matching sample)
    # but calculate change % using the user's D1-D7 logic on last 7 days
    
    dates_for_pivot = last_8_dates  # Full 8 days as in sample
    dates_for_metrics = last_7_dates  # Last 7 for D1-D7
    
    # Actually, re-reading the instructions: "Select ONLY the LAST 7 DAYS"
    # and "Map them as: D1 → oldest, D7 → most recent"
    # The sample has 8 columns, but let's follow the USER instruction: 7 days
    # Wait - the sample has 8 date columns. Let me count dates in sample pivot header:
    # 30-Mar, 31-Mar, 1-Apr, 2-Apr, 3-Apr, 4-Apr, 5-Apr, 6-Apr = 8 dates
    # But user says "LAST 7 DAYS". Let me look more carefully:
    # The first column in sample is 30-Mar (actually D1), last is 6-Apr (D8).
    # The user says "Select ONLY the LAST 7 DAYS" - let's use 7 most recent
    # But also provide the 8th day since it's in the data and matches sample
    
    # Let's follow the user instruction: 7 days for D1-D7
    # But also output all 8 if available, matching the sample pivot format
    
    # I'll output 8 date columns to match the sample but use the requested 7-day
    # analysis window for flags
    
    # Let's just follow the instruction literally: D1-D7 = last 7 days
    pivot_dates = sorted_dates[-7:] if len(sorted_dates) >= 7 else sorted_dates
    
    # ── STEP 3: Build pivot rows ─────────────────────────────────────────
    pivot_rows = []
    
    for site, date_data in site_date_data.items():
        row_data = {
            'site': site,
            'revenues': [],
            'total_revenue': 0.0,
        }
        
        for d in pivot_dates:
            entry = date_data.get(d, {'revenue': 0.0, 'match_rate': 0.0, 'ecpm': 0.0, 'ad_requests': 0})
            row_data['revenues'].append(entry['revenue'])
        
        row_data['total_revenue'] = sum(row_data['revenues'])
        
        # Most recent date metrics
        most_recent_date = pivot_dates[-1]
        most_recent = date_data.get(most_recent_date, {'revenue': 0.0, 'match_rate': 0.0, 'ecpm': 0.0, 'ad_requests': 0})
        
        row_data['match_rate'] = most_recent['match_rate']
        row_data['ecpm'] = most_recent['ecpm']
        row_data['ad_requests'] = int(most_recent['ad_requests'])
        
        # ── Revenue Change % ──
        # D7 = most recent, D1-D6 = previous 6 days
        d7_rev = row_data['revenues'][-1] if row_data['revenues'] else 0
        d1_d6_revs = row_data['revenues'][:-1] if len(row_data['revenues']) > 1 else []
        
        if d1_d6_revs:
            avg_d1_d6 = sum(d1_d6_revs) / len(d1_d6_revs)
        else:
            avg_d1_d6 = 0
        
        if avg_d1_d6 > 0:
            change_pct = ((d7_rev - avg_d1_d6) / avg_d1_d6) * 100
        else:
            change_pct = 0.0
        
        row_data['change_pct'] = change_pct
        
        # ── Status flagging ──
        if change_pct < -70:
            status = '🚨 CRITICAL'
        elif change_pct < -50:
            status = '🔴 RED'
        elif change_pct <= -20:
            status = '🟡 YELLOW'
        elif change_pct > 10:
            status = '🟢 GREEN'
        else:
            status = ''
        
        row_data['status'] = status
        
        pivot_rows.append(row_data)
    
    # ── STEP 5: Sort by Total Revenue (descending) ───────────────────────
    pivot_rows.sort(key=lambda x: (-x['total_revenue'], -x['match_rate']))
    
    # ── STEP 6: Write output CSV ─────────────────────────────────────────
    # Date labels for headers
    date_labels = []
    for i, d in enumerate(pivot_dates):
        dt = datetime.strptime(d, '%Y-%m-%d')
        date_labels.append(dt.strftime('%d-%b'))
    
    # D1-D7 column names
    d_headers = [f'D{i+1} ({dl})' for i, dl in enumerate(date_labels)]
    
    csv_header = ['Site'] + d_headers + ['Total Revenue', 'Revenue Change %', 'Match Rate (%)', 'eCPM', 'Ad Requests', 'Status']
    
    with open(output_file, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerow(csv_header)
        
        for row in pivot_rows:
            csv_row = [row['site']]
            csv_row += [f"{r:.2f}" for r in row['revenues']]
            csv_row.append(f"{row['total_revenue']:.2f}")
            csv_row.append(f"{row['change_pct']:.2f}%")
            csv_row.append(f"{row['match_rate'] * 100:.2f}%")
            csv_row.append(f"{row['ecpm']:.2f}")
            csv_row.append(str(row['ad_requests']))
            csv_row.append(row['status'])
            writer.writerow(csv_row)
    
    print(f"\n✅ Pivot table written to: {output_file}")
    print(f"   Total sites: {len(pivot_rows)}")
    print(f"   Date range: {pivot_dates[0]} to {pivot_dates[-1]}")
    
    # ── STEP 8: Additional Insights ──────────────────────────────────────
    print("\n" + "=" * 80)
    print("📊 ADDITIONAL INSIGHTS")
    print("=" * 80)
    
    # 🔥 Top 5 Sites by Revenue
    print("\n🔥 TOP 5 SITES BY TOTAL REVENUE:")
    print("-" * 60)
    for i, row in enumerate(pivot_rows[:5], 1):
        print(f"  {i}. {row['site']:<45} ${row['total_revenue']:>10,.2f}")
    
    # 📉 Biggest Drops
    drops = [r for r in pivot_rows if r['change_pct'] < -10 and r['total_revenue'] > 1]
    drops.sort(key=lambda x: x['change_pct'])
    print(f"\n📉 BIGGEST DROPS (Top 10):")
    print("-" * 70)
    for i, row in enumerate(drops[:10], 1):
        print(f"  {i}. {row['site']:<45} Change: {row['change_pct']:>8.2f}%  Rev: ${row['total_revenue']:>8,.2f}  {row['status']}")
    
    # 📈 Biggest Spikes
    spikes = [r for r in pivot_rows if r['change_pct'] > 10 and r['total_revenue'] > 1]
    spikes.sort(key=lambda x: x['change_pct'], reverse=True)
    print(f"\n📈 BIGGEST SPIKES (Top 10):")
    print("-" * 70)
    for i, row in enumerate(spikes[:10], 1):
        print(f"  {i}. {row['site']:<45} Change: {row['change_pct']:>8.2f}%  Rev: ${row['total_revenue']:>8,.2f}  {row['status']}")
    
    # Summary stats
    critical_count = sum(1 for r in pivot_rows if '🚨' in r['status'])
    red_count = sum(1 for r in pivot_rows if '🔴' in r['status'])
    yellow_count = sum(1 for r in pivot_rows if '🟡' in r['status'])
    green_count = sum(1 for r in pivot_rows if '🟢' in r['status'])
    
    print(f"\n📋 STATUS SUMMARY:")
    print(f"  🟢 GREEN (Spike > +10%):     {green_count}")
    print(f"  🟡 YELLOW (Drop -20% to -30%): {yellow_count}")
    print(f"  🔴 RED (Drop > -50%):          {red_count}")
    print(f"  🚨 CRITICAL (Drop > -70%):     {critical_count}")
    print(f"  ⚪ Normal:                     {len(pivot_rows) - critical_count - red_count - yellow_count - green_count}")

if __name__ == '__main__':
    main()
