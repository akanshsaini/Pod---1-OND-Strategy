const fs=require('node:fs');
const R=require('./report-core.js');
for(const name of ['Zero1','Ellipsis']){
 const filename=`Pod-1 Analysis ${name} (Sep 7, 2026 - Oct 6, 2026).csv`;
 const data=R.parseGAM(fs.readFileSync('../'+filename,'utf8'),filename);
 fs.writeFileSync('data-'+name.toLowerCase()+'.js','window.receiveSeed('+JSON.stringify(name)+','+JSON.stringify(data)+');');
 console.log(name+': '+data.records.length+' rows; '+data.available.length+' original metrics; '+data.domains.length+' domains/inventory labels');
}
