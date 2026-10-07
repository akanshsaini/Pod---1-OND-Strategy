const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('./report-core.js');
const header='Date,Domain,Country,Device category,Ad Exchange revenue,Ad Exchange impressions,Ad Exchange match rate,Ad Exchange responses served,Ad Exchange average eCPM,Ad Exchange total requests,Ad Exchange Active View % viewable impressions,Ad Exchange delivery rate,Ad Exchange total request eCPM';
let fixture=header+'\n';
for(let i=1;i<=14;i++)fixture+=`2026-09-${String(i).padStart(2,'0')},example.com,United States,Smartphone,10,20,${i<=7?.8:.6},${i<=7?80:60},500,100,0.75,${i<=7?.25:1/3},100\n`;
fixture+='2026-09-14,,United States,Smartphone,5,1,0.5,1,5000,2,0.5,1,2500\n';
const data=R.parseGAM(fixture,'test');assert.equal(data.records.length,15);assert.equal(data.records[0][10],.75);assert.equal(data.records[0][8],.8);assert.equal(data.records[0][9],500);
const cfg={network:'Zero1',start:'2026-09-08',end:'2026-09-14',compare:'previous',device:'All',geos:['United States'],inventory:'websites',search:'',focus:{},dimensions:['domain']};
let q=R.query({Zero1:data},cfg);assert.equal(q.compareComplete,true);assert.equal(q.total.revenue,70);assert.equal(R.value(q.total,'match'),.6);assert.equal(R.value(q.previous,'match'),.8);assert.ok(Math.abs(R.diff(.6,.8,'match')+20)<1e-9);assert.equal(R.value(q.total,'viewability'),null);assert.equal(q.groups[0].previousDaily.get('2026-09-08').responses,80);
q=R.query({Zero1:data},{...cfg,dimensions:['date']});assert.equal(q.groups.length,7);for(const g of q.groups){assert.equal(g.current.responses,60);assert.equal(g.previous.responses,80);}
q=R.query({Zero1:data},{...cfg,focus:{date:'2026-09-14'}});assert.equal(q.total.revenue,10);assert.equal(q.previous.revenue,10);
q=R.query({Zero1:data},{...cfg,inventory:'all',compare:'none'});assert.equal(q.total.revenue,75);assert.equal(q.raw.length,8);
q=R.query({Zero1:data},{...cfg,start:'2026-09-01',end:'2026-09-07'});assert.equal(q.compareComplete,false);
q=R.query({Zero1:data},{...cfg,search:'absent'});assert.equal(q.total.count,0);
q=R.query({Zero1:data},{...cfg,geos:[]});assert.equal(q.total.count,0);
const additions=R.parseGAM(header+'\n2026-09-14,example.com,Canada,Desktop,100,20,0.5,50,5000,100,0.2,0.4,1000\n2026-09-15,example.com,Canada,Desktop,100,20,0.5,50,5000,100,0.2,0.4,1000','new');
const merged=R.merge(data,additions);assert.equal(merged.records.length,15);assert.equal(merged.records.filter(r=>merged.dates[r[0]]==='2026-09-14').length,1);
const index=R.pageviewIndex([{site:'Example',date:'2026-09-14',views:0},{site:'https://www.example.com',date:'2026-09-15',views:100}],new Map([['example','example.com']]));assert.equal(R.pageviewTotal(index,'example.com',['2026-09-14','2026-09-15']),100);assert.equal(R.pageviewTotal(index,'example.com',['2026-09-16']),null);
const dup=R.pageviewIndex([{site:'Example',date:'2026-09-14',views:5},{site:'example.com',date:'2026-09-14',views:10}],new Map([['example','example.com']]));assert.equal(R.pageviewTotal(dup,'example.com',['2026-09-14']),null);
const measurable=R.parseGAM(header+',Ad Exchange Active View measurable impressions,Ad Exchange Active View viewable impressions\n2026-09-14,x.com,Canada,Desktop,1,20,0.5,50,50,100,0.2,0.4,10,100,20\n2026-09-14,x.com,Canada,Desktop,1,20,0.5,50,50,100,1,0.4,10,10,10','counts');
q=R.query({Zero1:measurable},{...cfg,start:'2026-09-14',end:'2026-09-14',compare:'none',geos:['Canada']});assert.equal(R.value(q.total,'viewability'),30/110);
const nets={};for(const n of ['Zero1','Ellipsis']){vm.runInNewContext(fs.readFileSync('data-'+n.toLowerCase()+'.js','utf8'),{window:{receiveSeed:(_,d)=>nets[n]=d}});const rows=R.csv(fs.readFileSync('../Pod-1 Analysis '+n+' (Sep 7, 2026 - Oct 6, 2026).csv','utf8'));assert.equal(nets[n].records.length,rows.length-1);const old=JSON.parse(fs.readFileSync('verification-totals.json','utf8'))[n].All;const scope={...cfg,network:n,start:'2026-09-07',end:'2026-10-06',compare:'none',geos:R.GEOS,dimensions:['country','device']};q=R.query(nets,scope);assert.ok(Math.abs(q.total.revenue-old.revenue)<.00001);assert.equal(q.total.requests,old.requests);assert.equal(q.groups.reduce((sum,g)=>sum+g.current.requests,0),q.total.requests);
 const indices=[4,5,7,9,6,8,10,11,12];for(let i=0;i<rows.length-1;i+=997){const r=nets[n].records[i];for(let j=0;j<indices.length;j++)assert.equal(r[4+j],Number(rows[i+1][indices[j]]));}
 console.log(n+': all '+nets[n].records.length+' rows retained; all nine metrics sampled exactly; country/device totals reconcile.');}
q=R.query(nets,{...cfg,network:'Both',start:'2026-09-07',end:'2026-10-06',compare:'none',geos:R.GEOS,dimensions:['network']});assert.equal(q.groups.length,2);assert.equal(q.total.requests,4359348507+4313506814);
console.log('PASS: grouping, period alignment, date drill, inventory scope, missing baselines, merging, viewability weighting, pageview mapping, and network isolation.');
