"""GAM country/device pivot and optional offline dashboard seed.
python pivot_processor.py --input report.csv --network Zero1 --seed data-zero1.js
"""
import argparse, csv, json, math
from collections import defaultdict
from datetime import date
from pathlib import Path

GEOS = ['United Kingdom','Ireland','Belgium','Czech Republic','Dominican Republic','Barbados','Nicaragua','United States','Canada','Netherlands','United Arab Emirates','Australia','Romania','South Africa','Germany','Mexico','Spain','Saudi Arabia','New Zealand','Slovakia','Switzerland','Philippines','Sweden','Hungary','Austria','Israel','Puerto Rico','Denmark','Finland','Jamaica','Malta','Trinidad and Tobago','Ghana','Zimbabwe','El Salvador','Lithuania','Namibia','Botswana']

def normalize_domain(v):
    v = v.strip().lower().removeprefix('https://').removeprefix('http://')
    return v.split('/')[0].split('?')[0].split('#')[0].split(':')[0].rstrip('.').removeprefix('www.')

def load(path, network):
    data = dict(schema=2, name=path.name, dates=[], domains=[], countries=[], devices=[], records=[], skipped=0)
    fields = ['dates', 'domains', 'countries', 'devices']
    maps = [dict() for _ in fields]
    required = ['date','domain','country','device category','ad exchange revenue','ad exchange impressions','ad exchange responses served','ad exchange total requests']
    with path.open(encoding='utf-8-sig', newline='') as f:
        reader = csv.reader(f)
        for header in reader:
            lower = [x.strip().lower() for x in header]
            if 'date' in lower and any(x in lower for x in ['domain','site','site (dcm)']): break
        else: raise ValueError('GAM header not found')
        aliases = {'domain':['domain','site','site (dcm)'], 'ad exchange total requests':['ad exchange total requests','ad exchange ad requests','ad exchange total ad requests']}
        indices = []
        for name in required:
            matches = [lower.index(x) for x in aliases.get(name,[name]) if x in lower]
            if not matches: raise ValueError('Missing column: '+name)
            indices.append(matches[0])
        data['headers'] = header
        extras = ['ad exchange match rate','ad exchange average ecpm','ad exchange active view % viewable impressions','ad exchange delivery rate','ad exchange total request ecpm','ad exchange active view measurable impressions','ad exchange active view viewable impressions']
        extra_indices = [lower.index(x) if x in lower else -1 for x in extras]
        data['available'] = ['revenue','impressions','responses','requests'] + [key for key, i in zip(['match','ecpm','viewability','delivery','requestEcpm'],extra_indices) if i >= 0]
        for line, row in enumerate(reader, 2):
            if not row or not row[indices[0]].strip() or 'total' in row[indices[0]].lower():
                data['skipped'] += 1
                continue
            try:
                dims = [row[i].strip() for i in indices[:4]]
                date.fromisoformat(dims[0])
                dims[1] = dims[1] or '(Unknown domain)'
                keys = []
                for k, value in enumerate(dims):
                    if value not in maps[k]:
                        maps[k][value] = len(data[fields[k]])
                        data[fields[k]].append(value)
                    keys.append(maps[k][value])
                values = [float(row[i].strip().replace(',','').replace('$','')) for i in indices[4:]]
                if any(v < 0 or not math.isfinite(v) for v in values): raise ValueError('Invalid numeric value')
                extra_values = []
                for k, i in enumerate(extra_indices):
                    if i < 0 or not row[i].strip():
                        extra_values.append(None)
                    else:
                        value = float(row[i].strip().replace(',','').replace('$','').replace('%',''))
                        if '%' in row[i] and k in {0,2,3}: value /= 100
                        if value < 0 or not math.isfinite(value): raise ValueError('Invalid numeric value')
                        extra_values.append(value)
                data['records'].append(keys + values + extra_values)
            except (ValueError, IndexError) as error: raise ValueError(f'Row {line}: {error}') from error
    if not data['records']: raise ValueError('No website data found')
    return data

def pivot(data, output, days=None):
    dates = sorted(data['dates'])[-days:] if days else sorted(data['dates'])
    grouped = defaultdict(lambda: defaultdict(lambda: [0.0]*4))
    for row in data['records']:
        d, site, country, device = [data[field][row[i]] for i, field in enumerate(['dates','domains','countries','devices'])]
        if d not in dates or country not in GEOS or device not in {'Smartphone','Desktop'} or site.startswith('(') or site.lower() in {'-','total','grand total','web caches and other'}: continue
        total = grouped[(site, country, device)][d]
        for i, val in enumerate(row[4:8]): total[i] += val
    def metrics(v):
        revenue, impressions, responses, requests = v
        return [round(revenue,6), responses/requests if requests else '', revenue/impressions*1000 if impressions else '', int(requests), int(responses), int(impressions), impressions/responses if responses else '', revenue/requests*1000 if requests else '']
    labels = ['Revenue (USD)','Match rate (fraction)','eCPM (USD)','Requests','Responses served','Impressions','Delivery rate (fraction)','Request eCPM (USD)']
    with output.open('w',encoding='utf-8-sig',newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['Domain','Country','Device']+[d+' '+m for d in dates for m in labels]+['Period '+m for m in labels])
        for key, daily in sorted(grouped.items(),key=lambda item: -sum(v[0] for v in item[1].values())):
            totals = [sum(v[i] for v in daily.values()) for i in range(4)]
            writer.writerow(list(key)+[val for d in dates for val in (metrics(daily[d]) if d in daily else ['']*8)]+metrics(totals))
    return len(grouped)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',required=True,type=Path)
    parser.add_argument('--network',required=True,choices=['Zero1','Ellipsis'])
    parser.add_argument('--output',type=Path)
    parser.add_argument('--seed',type=Path)
    parser.add_argument('--days',type=int,help='Latest N available dates; default: complete report')
    args = parser.parse_args()
    if args.days is not None and args.days < 1: parser.error('--days must be positive')
    data = load(args.input,args.network)
    output = args.output or Path(args.network.lower()+'_pivot.csv')
    count = pivot(data,output,args.days)
    if args.seed:
        payload = json.dumps(data,separators=(',',':'),ensure_ascii=True,allow_nan=False)
        args.seed.write_text('window.receiveSeed('+json.dumps(args.network)+','+payload+');',encoding='utf-8')
    print(f'{args.network}: {len(data["records"]):,} source records retained; {count:,} website pivot rows; {min(data["dates"])} to {max(data["dates"])}; {data["skipped"]:,} undated summary rows excluded. Output: {output}')

if __name__ == '__main__': main()
