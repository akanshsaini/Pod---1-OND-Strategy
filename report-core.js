(function(root){
'use strict';
const A=typeof module!=='undefined'?require('./analysis-core.js'):root.Analysis;
const METRICS={
 match:{label:'Match rate',type:'percent',source:8,help:'Responses served / Ad Exchange requests'},
 revenue:{label:'Revenue',type:'money',source:4,help:'Sum of Ad Exchange revenue (USD)'},
 requests:{label:'Ad requests',type:'number',source:7,help:'Sum of Ad Exchange total requests'},
 impressions:{label:'Impressions',type:'number',source:5,help:'Sum of Ad Exchange impressions'},
 responses:{label:'Responses served',type:'number',source:6,help:'Sum of Ad Exchange responses served'},
 ecpm:{label:'Average eCPM',type:'money',source:9,help:'Revenue / impressions × 1,000'},
 delivery:{label:'Delivery rate',type:'percent',source:11,help:'Impressions / responses served'},
 requestEcpm:{label:'Request eCPM',type:'money',source:12,help:'Revenue / requests × 1,000'},
 viewability:{label:'Active View viewability',type:'percent',source:10,help:'Viewable / measurable impressions. Original rate available at source-row level; aggregate requires both counts.'},
 pageviews:{label:'Website pageviews',type:'number',help:'Full-website daily pageviews, independent of GAM country and device filters. Available for website rows without country/device breakdowns.'}
};
const DIMS={domain:'Website',country:'Country',device:'Device',date:'Date',network:'Network'};
const SOURCE_METRICS=['revenue','impressions','match','responses','ecpm','requests','viewability','delivery','requestEcpm'];
const fields=['dates','domains','countries','devices'];
function isWebsite(s){return !!s&&!s.startsWith('(')&&!['-','total','grand total','web caches and other'].includes(s.toLowerCase());}
function parseGAM(text,name){
 const rows=A.csv(text),h=rows.findIndex(r=>r.some(c=>/^date$/i.test(c.trim()))&&r.some(c=>/^(domain|site|site \(dcm\))$/i.test(c.trim())));
 if(h<0)throw Error('Export Date, Domain, Country and Device category with Ad Exchange metrics.');
 const header=rows[h].map(x=>x.trim().toLowerCase()),col=(...ns)=>header.findIndex(x=>ns.includes(x));
 const idx=[col('date'),col('domain','site','site (dcm)'),col('country'),col('device category'),col('ad exchange revenue'),col('ad exchange impressions'),col('ad exchange responses served'),col('ad exchange total requests','ad exchange ad requests','ad exchange total ad requests'),col('ad exchange match rate'),col('ad exchange average ecpm'),col('ad exchange active view % viewable impressions'),col('ad exchange delivery rate'),col('ad exchange total request ecpm','ad exchange ad request ecpm'),col('ad exchange active view measurable impressions'),col('ad exchange active view viewable impressions')];
 if(idx.slice(0,8).includes(-1))throw Error('Missing required columns: Date, Domain, Country, Device category, Ad Exchange revenue, impressions, responses served or total requests.');
 const out={schema:2,name,dates:[],domains:[],countries:[],devices:[],records:[],skipped:0,headers:rows[h],available:SOURCE_METRICS.filter(k=>idx[METRICS[k].source]>=0)};
 const maps=fields.map(()=>new Map());
 for(let j=h+1;j<rows.length;j++){
  const r=rows[j];if(!r[idx[0]]||/total/i.test(r[idx[0]])){out.skipped++;continue;}
  try{const rawDomain=(r[idx[1]]||'').trim();const dims=[A.date(r[idx[0]]),rawDomain||'(Unknown domain)',r[idx[2]].trim(),r[idx[3]].trim()];
   const keys=dims.map((v,k)=>{if(!maps[k].has(v)){maps[k].set(v,out[fields[k]].length);out[fields[k]].push(v);}return maps[k].get(v);});
   const vals=idx.slice(4).map((i,k)=>{if(i<0||r[i]===''||r[i]===undefined)return null;let n=A.num(r[i]);if([4,6,7].includes(k)&&r[i].includes('%'))n/=100;return n;});
   if(vals.slice(0,4).some(x=>x===null))throw Error('Missing additive metric.');
   out.records.push([...keys,...vals]);
  }catch(e){throw Error('CSV row '+(j+1)+': '+e.message);}
 }
 if(!out.records.length)throw Error('No dated report rows found.');return out;
}
function empty(){return {revenue:0,impressions:0,responses:0,requests:0,count:0,measurable:0,viewable:0,viewCount:0,singleView:null};}
function addRecord(a,r){a.revenue+=r[4];a.impressions+=r[5];a.responses+=r[6];a.requests+=r[7];a.count++;a.singleView=a.count===1?r[10]:null;if(r[13]!=null&&r[14]!=null){a.measurable+=r[13];a.viewable+=r[14];a.viewCount++;}return a;}
function add(a,b){for(const k of ['revenue','impressions','responses','requests','count','measurable','viewable','viewCount'])a[k]+=b[k];a.singleView=a.count===1?b.singleView:null;return a;}
function value(a,k){if(!a||!a.count)return null;switch(k){case 'match':return a.requests?a.responses/a.requests:null;case 'ecpm':return a.impressions?a.revenue/a.impressions*1000:null;case 'delivery':return a.responses?a.impressions/a.responses:null;case 'requestEcpm':return a.requests?a.revenue/a.requests*1000:null;case 'viewability':return a.viewCount===a.count?(a.measurable?a.viewable/a.measurable:null):a.count===1?a.singleView:null;default:return a[k]??null;}}
function shift(d,n){return new Date(Date.parse(d)+n*86400000).toISOString().slice(0,10);}
function days(start,end){if(!start||!end||start>end)return [];const count=Math.round((Date.parse(end)-Date.parse(start))/86400000)+1;if(count>3660)throw Error('Choose a date range of at most 10 years.');return Array.from({length:count},(_,i)=>shift(start,i));}
function compareRange(c){if(c.compare==='none')return null;if(c.compare==='custom')return [c.compareStart,c.compareEnd];const len=days(c.start,c.end).length;return [shift(c.start,-len),shift(c.start,-1)];}
function diff(a,b,k){if(a==null||b==null)return null;if(METRICS[k].type==='percent')return (a-b)*100;return b!==0?(a-b)/Math.abs(b)*100:null;}
function matches(v,op,b){if(v==null)return false;return op==='gt'?v>b:op==='lt'?v<b:op==='gte'?v>=b:op==='lte'?v<=b:op==='eq'?v===b:true;}
function query(datasets,c){
 const currentDays=days(c.start,c.end),cr=compareRange(c),previousDays=cr?days(...cr):[];
 const nets=c.focus?.network?[c.focus.network]:c.network==='Both'?Object.keys(datasets):[c.network];
 const coverage=(ds)=>nets.every(n=>!!datasets[n]&&ds.every(d=>datasets[n].dates.includes(d)));
 const result={days:currentDays,previousDays,compareComplete:!!cr&&coverage(previousDays),currentComplete:coverage(currentDays),groups:[],total:empty(),previous:empty(),daily:new Map(),previousDaily:new Map(),raw:[],matched:0};
 const groups=new Map(),geos=new Set(c.geos),dims=c.dimensions||['domain'],offset=cr?Math.round((Date.parse(c.start)-Date.parse(cr[0]))/86400000):0;
 for(const n of nets){const data=datasets[n];if(!data)continue;for(const r of data.records){
  const d=data.dates[r[0]],domain=data.domains[r[1]],country=data.countries[r[2]],device=data.devices[r[3]];
  if(!geos.has(country)||(c.device!=='All'&&device!==c.device)||(c.inventory==='websites'&&!isWebsite(domain))||(c.search&&!domain.toLowerCase().includes(c.search.toLowerCase())))continue;
  const ctx={network:n,date:d,domain,country,device};if(Object.entries(c.focus||{}).some(([k,v])=>k!=='date'&&ctx[k]!==v))continue;
  const current=d>=c.start&&d<=c.end,previous=!!cr&&d>=cr[0]&&d<=cr[1];if(!current&&!previous)continue;
  for(const period of [current?'current':null,previous?'previous':null].filter(Boolean)){
   const currentPeriod=period==='current',aligned=currentPeriod?d:shift(d,offset);
   if(c.focus?.date&&c.focus.date!==aligned)continue;
   const values=dims.map(k=>k==='date'?aligned:ctx[k]),key=JSON.stringify(values);
   let g=groups.get(key);if(!g){g={key,values,context:Object.fromEntries(dims.map((k,i)=>[k,values[i]])),current:empty(),previous:empty(),daily:new Map(),previousDaily:new Map()};groups.set(key,g);}
   addRecord(g[period],r);addRecord(currentPeriod?result.total:result.previous,r);
   const byDay=currentPeriod?result.daily:result.previousDaily;
   if(!byDay.has(aligned))byDay.set(aligned,empty());addRecord(byDay.get(aligned),r);
   if(currentPeriod){if(!g.daily.has(d))g.daily.set(d,empty());addRecord(g.daily.get(d),r);result.raw.push({network:n,data,row:r,context:ctx});result.matched++;}
   else{if(!g.previousDaily.has(aligned))g.previousDaily.set(aligned,empty());addRecord(g.previousDaily.get(aligned),r);}
  }
 }}
 result.groups=[...groups.values()];return result;
}
function merge(existing,incoming){if(!existing)return incoming;const newDates=new Set(incoming.dates),out={...incoming,name:existing.name+' + '+incoming.name,dates:[],domains:[],countries:[],devices:[],records:[],skipped:existing.skipped+incoming.skipped};const maps=fields.map(()=>new Map());for(const d of [existing,incoming])for(const r of d.records){if(d===existing&&newDates.has(d.dates[r[0]]))continue;const keys=fields.map((f,i)=>{const v=d[f][r[i]];if(!maps[i].has(v)){maps[i].set(v,out[f].length);out[f].push(v);}return maps[i].get(v);});out.records.push([...keys,...r.slice(4)]);}return out;}
function pageviewIndex(rows,mapping){const byDomain=new Map();for(const r of rows||[]){const name=A.domain(r.site),domain=mapping?.get(name)||name;let daily=byDomain.get(domain);if(!daily){daily=new Map();byDomain.set(domain,daily);}daily.set(r.date,daily.has(r.date)?null:r.views);}return byDomain;}
function pageviewTotal(index,domain,dates){const daily=index?.get(A.domain(domain));if(!daily||dates.some(d=>daily.get(d)==null))return null;return dates.reduce((sum,d)=>sum+daily.get(d),0);}
const api={...A,METRICS,DIMS,SOURCE_METRICS,isWebsite,parseGAM,empty,addRecord,add,value,shift,days,compareRange,diff,matches,query,merge,pageviewIndex,pageviewTotal};
if(typeof module!=='undefined')module.exports=api;else root.Report=api;
})(typeof self!=='undefined'?self:globalThis);
