import { google } from 'googleapis';

export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Access-Control-Allow-Origin', '*');

  let debugStep = "Starting";

  try {
    debugStep = "Checking Environment Variables";
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return res.status(500).json({ error: 'Missing Google Credentials in Vercel.' });
    }

    debugStep = "Authenticating with Google Cloud";
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, ''), // Strips accidental quotes
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    debugStep = "Reading Forecaster Registry (Sheet ID: 1B7m7DOSLCXj9vMHTwuXAjLVkuw0i3f0aUrbYweAj6xU)";
    const fcRegistryResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: '1B7m7DOSLCXj9vMHTwuXAjLVkuw0i3f0aUrbYweAj6xU', range: 'A:F', 
    });
    
    debugStep = "Reading Waterfall Registry (Sheet ID: 169w2PQ22gt1ItcQTOXQP-F9XHVocY17OLv3fzoA1_3E)";
    const wfRegistryResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: '169w2PQ22gt1ItcQTOXQP-F9XHVocY17OLv3fzoA1_3E', range: 'A:F', 
    });

    const fcRows = fcRegistryResponse.data.values ? fcRegistryResponse.data.values.slice(1) : [];
    const wfRows = wfRegistryResponse.data.values ? wfRegistryResponse.data.values.slice(1) : [];

    const fcDetails = fcRows.filter(row => (row[5] && row[5].trim().toLowerCase() === 'details') || row[4] === 'DATATAB');
    const wfDetails = wfRows.filter(row => (row[5] && row[5].trim().toLowerCase() === 'details') || row[4] === 'DATATAB');

    const latestFcRow = fcDetails[fcDetails.length - 1];
    const prevFcRow = fcDetails.length > 1 ? fcDetails[fcDetails.length - 2] : null;
    const latestWfRow = wfDetails[wfDetails.length - 1];
    const prevWfRow = wfDetails.length > 1 ? wfDetails[wfDetails.length - 2] : null;

    if (!latestFcRow) return res.status(404).json({ error: 'Could not find Details tab in registry.' });

    const dynamicMetadata = {
      latestFcName: latestFcRow[1] || "Current Month",
      prevFcName: prevFcRow ? prevFcRow[1] : "Previous Month",
      latestWfName: latestWfRow ? latestWfRow[1] : "Current Week",
      prevWfName: prevWfRow ? prevWfRow[1] : "Previous Week",
    };

    const targetSpreadsheetId = latestFcRow[3];
    const targetTabName = latestFcRow[4];

    debugStep = `Reading ACTUAL Data Sheet (Sheet ID: ${targetSpreadsheetId}, Tab: ${targetTabName})`;
    const liveDataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: targetSpreadsheetId,
      range: `${targetTabName}!A2:Z3000`, 
    });

    const liveRows = liveDataResponse.data.values || [];

    debugStep = "Parsing Data";
    const liveStudies = liveRows.map(p => {
      const qs = (p[21] || '').split(',').map(Number);
      const mo = {}; 
      (p[27] || '').split('|').forEach(m => { 
          const [k, v] = m.split(':'); 
          if (k && v) mo[k] = +v || 0; 
      });
      return {
        lid: p[0], atom: p[1], protocol: p[2], site: p[3], status: p[4], substatus: p[5],
        sponsor: p[6], cro: p[7], indication: p[8], ta: p[9],
        actRando: +p[10] || 0, goals: +p[11] || 0, totalPts: +p[12] || 0,
        bps: +p[13] || 0, cl: +p[14] || 0, fcv: +p[15] || 0, rev: +p[16] || 0,
        total2026: +p[17] || 0, actual2026: +p[18] || 0, h1: +p[19] || 0, h2: +p[20] || 0,
        q1: qs[0] || 0, q2: qs[1] || 0, q3: qs[2] || 0, q4: qs[3] || 0,
        vax: p[22] || '', priority: p[23] || '', pi: p[24] || '', leadName: p[25] || '', active: p[26] || '', mo
      };
    }).filter(s => s.lid && s.lid !== 'undefined' && s.lid !== 'Source');

    // Manual Metrics
    const SD = {
      meta: dynamicMetadata, 
      asOf: dynamicMetadata.latestFcName, baseline: 85000000,
      fc:{
        grand:72882175,ytd:35665389,fcstRem:37216786,
        q1:21932289,q2:17219729,q3:11865984,q4:21864173,h1:39152018,h2:33730157,
        monthly:[
          {m:"Jan",v:6413522,t:"ACT"},{m:"Feb",v:7090431,t:"ACT"},{m:"Mar",v:8428336,t:"ACT"},
          {m:"Apr",v:6739662,t:"ACT"},{m:"May",v:6993438,t:"ACT"},{m:"Jun",v:3486629,t:"FCST"},
          {m:"Jul",v:3539075,t:"FCST"},{m:"Aug",v:3915065,t:"FCST"},{m:"Sep",v:4411844,t:"FCST"},
          {m:"Oct",v:10724694,t:"FCST"},{m:"Nov",v:5838132,t:"FCST"},{m:"Dec",v:5301348,t:"FCST"},
        ],
        quarterly:[
          {q:"Q1",v:21932289,tgt:22000000,t:"ACT"},{q:"Q2",v:17219729,tgt:22000000,t:"ACT"},
          {q:"Q3",v:11865984,tgt:21000000,t:"FCST"},{q:"Q4",v:21864173,tgt:20000000,t:"FCST"},
        ],
      },
      fc_prev:{grand:67963656,ytd:28708447,q1:21968785,q2:15717356,q3:10535767,q4:19741748,
        monthly:[{m:"Jan",v:6450018,t:"ACT"},{m:"Feb",v:7090431,t:"ACT"},{m:"Mar",v:8428336,t:"ACT"},{m:"Apr",v:6739662,t:"ACT"},{m:"May",v:4918149,t:"FCST"},{m:"Jun",v:3614054,t:"FCST"},{m:"Jul",v:3168263,t:"FCST"},{m:"Aug",v:2668049,t:"FCST"},{m:"Sep",v:2580431,t:"FCST"},{m:"Oct",v:8280002,t:"FCST"},{m:"Nov",v:3496758,t:"FCST"},{m:"Dec",v:2895688,t:"FCST"}],
      },
      wf:{
        grand:85000003,h1:39545400,h2:45454603,q1:21785047,q2:17760353,q3:18598614,q4:26855989,
        monthly:[{m:"Jan",v:6359419,t:"ACT"},{m:"Feb",v:7017409,t:"ACT"},{m:"Mar",v:8408219,t:"ACT"},{m:"Apr",v:6709662,t:"ACT"},{m:"May",v:6993438,t:"ACT"},{m:"Jun",v:4057253,t:"FCST"},{m:"Jul",v:5420636,t:"FCST"},{m:"Aug",v:5809125,t:"FCST"},{m:"Sep",v:7368853,t:"FCST"},{m:"Oct",v:9576940,t:"FCST"},{m:"Nov",v:8833439,t:"FCST"},{m:"Dec",v:8445610,t:"FCST"}],
        components:[{label:"Maintenance",value:28084923,type:"pos"},{label:"Enrolling",value:27210077,type:"pos"},{label:"Awarded",value:7518807,type:"pos"},{label:"Risk Adj Awd",value:-6100817,type:"neg"},{label:"Pipeline",value:9018658,type:"pos"},{label:"Risk Adj Pip",value:-1050038,type:"neg"},{label:"Go-Get",value:13167538,type:"pos"},{label:"Total 2026",value:85000003,type:"tot"}],
      },
      wf_prev:{
        grand:85000007,h1:39546300,h2:45453708,
        monthly:[{m:"Jan",v:6359421,t:"ACT"},{m:"Feb",v:7017431,t:"ACT"},{m:"Mar",v:8408336,t:"ACT"},{m:"Apr",v:6709662,t:"ACT"},{m:"May",v:6993438,t:"ACT"},{m:"Jun",v:4058012,t:"FCST"},{m:"Jul",v:5421065,t:"FCST"},{m:"Aug",v:5809405,t:"FCST"},{m:"Sep",v:7368542,t:"FCST"},{m:"Oct",v:9576890,t:"FCST"},{m:"Nov",v:8832657,t:"FCST"},{m:"Dec",v:8445148,t:"FCST"}],
      },
      counts:{grand:liveStudies.length,backlog:840,pipeline:2464,awarded:88,vaxAwarded:30,nvaxAwarded:58,enrolling:83,maintenance:279,closed:390,vaxTotal:981,nvaxTotal:1315},
      counts_prev:{grand:2165,backlog:825,pipeline:2179,awarded:82,enrolling:83,maintenance:282,closed:378,vaxTotal:1028,nvaxTotal:1137},
      goals:{total:6522,h1:2666,h2:3856,vaxH1:2351,nvaxH1:315},
      awards:{ytdStudies:115,tgtStudies:313,vaxAct:35,vaxTgt:30,nvaxAct:80,nvaxTgt:283,fcvYtd:29700000,fcvTgt:83200000,
        quarterly:[{q:"Q1",tgt:38,act:38,fcvTgt:10200000,fcvAct:10200000},{q:"Q2",tgt:55,act:77,fcvTgt:13400000,fcvAct:19500000},{q:"Q3",tgt:110,act:null,fcvTgt:26000000,fcvAct:null},{q:"Q4",tgt:110,act:null,fcvTgt:33600000,fcvAct:null}]},
      wow:[
        {cat:"Backlog",prev:28100000,curr:27200000,drivers:["mRNA-1403-P301-AC (Moderna,Vax): -$200K -- 114 discontinued subjects","VYD2311-PREV-002 (Ichnos,LID:2544): -$400K -- discontinued subjects"]},
        {cat:"Enrolling",prev:12300000,curr:11500000,drivers:["VYD2311-PREV-002 (Ichnos,LID:2544,ATOM:6912): -$400K -- 11 discontinued subjects","C4771002 (Pfizer,Vax): -$200K -- Goals 37->30 by PMO"]},
        {cat:"Awarded",prev:7500000,curr:9000000,drivers:["C6511002 (Pfizer,LID:2525): +$1.0M -- Goals 17->21, PPB $38K->$80K","VRB-101-202 (Verdiva Bio): +$0.3M -- reactivated"]},
        {cat:"Pipeline",prev:9800000,curr:9000000,drivers:["D7266C00001 (AstraZeneca): +$337K -- CL 30->77%","VCA23395 (Sanofi): +$128K -- 3 new opps"]},
        {cat:"Go-Get",prev:13200000,curr:13168000,drivers:["Minor portfolio adjustments -- net flat"]},
      ],
      variance:{
        fc_mom:[
          {cat:"Grand Total",old:67963656,new_v:72882175,reason:"Pipeline additions (+285 opps), 6 new awards, revenue optimization in Enrolling"},
          {cat:"Pipeline",old:7633816,new_v:8832261,reason:"+285 pipeline opportunities added. New entries: VCA23395 Sanofi, D7266C00001 AstraZeneca"},
          {cat:"Awarded",old:10831118,new_v:11961955,reason:"+6 new awards this month. Key: C6511002 Pfizer +$1M"},
          {cat:"Enrolling",old:23328627,new_v:24824412,reason:"+$1.5M from enrollment optimization and additional patient visits."},
        ],
        wf_wow:[
          {cat:"Total Revenue",old:85000007,new_v:85000003,diff:-4,reason:"Essentially flat. Minor rounding adjustments."},
          {cat:"Enrolling",old:27214602,new_v:27210077,diff:-4525,reason:"Minor -$4.5K adjustment. VYD2311 discontinued subjects."},
          {cat:"Go-Get",old:13162836,new_v:13167538,diff:4702,reason:"+$4.7K organic adjustment from pipeline confidence level changes."},
        ],
      },
      trend:[{wk:"Dec W1",v:23},{wk:"Jan W1",v:14},{wk:"Feb W1",v:25},{wk:"Mar W2",v:20},{wk:"Apr W5",v:18},{wk:"May W3",v:13}],
    };

    debugStep = "Sending Success Response";
    return res.status(200).json({ source: targetTabName, studies: liveStudies, sdMetrics: SD });
  } catch (error) {
    // THIS WILL TELL US EXACTLY WHERE IT BROKE
    console.error(`ERROR at step: [${debugStep}] - ${error.message}`);
    return res.status(500).json({ error: `Failed at step: [${debugStep}]. Google Error: ${error.message}` });
  }
}