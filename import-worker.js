importScripts('analysis-core.js','report-core.js');
onmessage=e=>{try{postMessage({data:Report.parseGAM(e.data.text,e.data.name)});}catch(error){postMessage({error:error.message});}};
