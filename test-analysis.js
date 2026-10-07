const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const A=require('./analysis-core.js');
const header='Date,Domain,Country,Device category,Ad Exchange revenue,Ad Exchange impressions,Ad Exchange match rate,Ad Exchange responses served,Ad Exchange total requests\n';
const text=header+'2026-09-07,https://www.example.com/,United States,Smartphone,10,10,1,10,10\n2026-09-07,example.com,Canada,Smartphone,20,10,0.1,10,100\n2026-09-07,example.com,Canada,Desktop,99,90,1,90,90\n2026-09-08,example.com,Canada,Smartphone,0,0,0,0,10\n';
const d=A.parseGAM(text,'fixture');
const o={start:'2026-09-07',end:'2026-09-09',device:'Smartphone',geos:['United States','Canada']};
let r=A.aggregate(d,o);
assert.equal(r.sites.length,1);assert.equal(r.total.revenue,30);assert.equal(r.total.requests,120);assert.equal(A.metric(r.total,'match'),20/120);assert.equal(A.metric(r.total,'ecpm'),1500);assert.equal(A.metric(r.daily.get('2026-09-08'),'match'),0);assert.equal(A.metric(r.daily.get('2026-09-09'),'match'),null);
r=A.aggregate(d,{...o,device:'Desktop'});assert.equal(r.total.revenue,99);
r=A.aggregate(d,{...o,geos:['Canada']});assert.equal(r.total.revenue,20);
assert.throws(()=>A.parseGAM(header+'2026-09-07,x.com,Canada,Smartphone,bad,1,0,0,10','bad'),/Invalid numeric/);
assert.deepEqual(A.csv('a,b\r\n"x,y","he said ""hi"""\r\n'),[['a','b'],['x,y','he said "hi"']]);
assert.throws(()=>A.date('2026-02-30'));
let weeks=header;for(let i=0;i<14;i++)weeks+=`2026-09-${String(i+1).padStart(2,'0')},x.com,Canada,Smartphone,1,1,0,${i<7?80:60},100\n`;
r=A.aggregate(A.parseGAM(weeks,'weeks'),{start:'2026-09-01',end:'2026-09-14',device:'Smartphone',geos:['Canada'],minRequests:100});assert.ok(Math.abs(r.sites[0].change+20)<1e-9);
r=A.aggregate(A.parseGAM(weeks,'weeks'),{start:'2026-09-01',end:'2026-09-14',device:'Smartphone',geos:['Canada'],minRequests:1000});assert.equal(r.sites[0].change,null);
const results={};for(const n of ['Zero1','Ellipsis']){let seed;vm.runInNewContext(fs.readFileSync('data-'+n.toLowerCase()+'.js','utf8'),{window:{receiveSeed:(_,d)=>seed=d}});seed.records=seed.records.filter(r=>seed.domains[r[1]]&&!seed.domains[r[1]].startsWith('(')&&!['-','total','grand total','web caches and other'].includes(seed.domains[r[1]].toLowerCase()));const raw=A.parseGAM(fs.readFileSync('../Pod-1 Analysis '+n+' (Sep 7, 2026 - Oct 6, 2026).csv','utf8'),'raw');assert.equal(raw.records.length,seed.records.length);results[n]={};for(const device of ['Smartphone','Desktop','All']){const opt={start:'2026-09-07',end:'2026-10-06',device,geos:A.GEOS};const a=A.aggregate(raw,opt),b=A.aggregate(seed,opt);assert.deepEqual(a.total,b.total);results[n][device]={...a.total,matchRate:A.metric(a.total,'match'),sites:a.sites.length};}}
fs.writeFileSync('verification-totals.json',JSON.stringify(results,null,2));console.log('PASS: weighted rates, geo/device isolation, zero vs missing, quoted CSV, weekly windows, and both full source reports reconcile to bundled data.');console.log(JSON.stringify(results,null,2));
