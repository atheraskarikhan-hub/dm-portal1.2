import { google } from 'googleapis';

export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Access-Control-Allow-Origin', '*');

  let debugStep = "Starting";

  try {
    debugStep = "Checking GOOGLE_CREDENTIALS_JSON";
    if (!process.env.GOOGLE_CREDENTIALS_JSON) {
      return res.status(500).json({ error: 'Missing GOOGLE_CREDENTIALS_JSON in Vercel environment variables.' });
    }

    let credentials;
    try {
      debugStep = "Parsing GOOGLE_CREDENTIALS_JSON";
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
    } catch (e) {
      return res.status(500).json({ error: 'Invalid JSON format in Vercel GOOGLE_CREDENTIALS_JSON variable.' });
    }

    debugStep = "Authenticating with Google Cloud";
    const auth = new google.auth.GoogleAuth({
      credentials,
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

    // Filter for rows where Data_Type (Column F / index 5) is 'details'
    const fcDetails = fcRows.filter(row => row[5] && row[5].trim().toLowerCase() === 'details');
    const wfDetails = wfRows.filter(row => row[5] && row[5].trim().toLowerCase() === 'details');

    const latestFcRow = fcDetails[fcDetails.length - 1];
    const prevFcRow = fcDetails.length > 1 ? fcDetails[fcDetails.length - 2] : null;
    const latestWfRow = wfDetails[wfDetails.length - 1];
    const prevWfRow = wfDetails.length > 1 ? wfDetails[wfDetails.length - 2] : null;

    if (!latestFcRow) return res.status(404).json({ error: 'Could not find a details row inside the Forecaster Registry.' });

    const dynamicMetadata = {
      latestFcName: latestFcRow[0] || "Current Month", // Column A (index 0) is Week_Date
      prevFcName: prevFcRow ? prevFcRow[0] : "Previous Month",
      latestWfName: latestWfRow ? latestWfRow[0] : "Current Week",
      prevWfName: prevWfRow ? prevWfRow[0] : "Previous Week",
    };

    // ACCURATE MAP MATCHING YOUR SCHEMA:
    const targetSpreadsheetId = latestFcRow[2]; // Spreadsheet_ID is Column C (index 2)
    const targetTabName = latestFcRow[4];       // Tab_Name is Column E (index 4)

    debugStep = `Reading ACTUAL Data Sheet (Sheet ID: ${targetSpreadsheetId}, Tab: ${targetTabName})`;
    const liveDataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: targetSpreadsheetId.trim(),
      range: `${targetTabName.trim()}!A2:Z3000`, 
    });

    const liveRows = liveDataResponse.data.values || [];

    debugStep = "Parsing Data Rows";
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

    const totalRev = liveStudies.reduce((a, c) => a + (c.total2026 || 0), 0);
    const SD = {
      meta: dynamicMetadata, 
      asOf: dynamicMetadata.latestFcName, baseline: 85000000,
      fc: { grand: totalRev, ytd: liveStudies.reduce((a, c) => a + (c.actual2026 || 0), 0), monthly: [{m:"Total", v:totalRev, t:"ACT"}], quarterly: [] },
      wf: { grand: totalRev, h1: 0, h2: 0, monthly: [], components: [] },
      wf_prev: { grand: totalRev, h1: 0, h2: 0, monthly: [] },
      counts: { grand: liveStudies.length, vaxTotal: liveStudies.filter(s=>s.vax.includes("Vaccine")).length, nvaxTotal: liveStudies.filter(s=>s.vax.includes("Non")).length },
      awards: { vaxTgt: 30, nvaxTgt: 283, fcvTgt: 83200000, quarterly: [] },
      variance: { fc_mom: [], wf_wow: [] }, wow: [], trend: []
    };

    debugStep = "Sending Success Response";
    return res.status(200).json({ source: targetTabName, studies: liveStudies, sdMetrics: SD });
  } catch (error) {
    console.error(`ERROR at step: [${debugStep}] - ${error.message}`);
    return res.status(500).json({ error: `Failed at step: [${debugStep}]. Error: ${error.message}` });
  }
}