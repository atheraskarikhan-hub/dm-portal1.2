import { google } from 'googleapis';

export const maxDuration = 60;

// ─── helpers ────────────────────────────────────────────────────────────────
const num  = v => { const n = parseFloat(String(v || '').replace(/[$,%\s]/g, '')); return isNaN(n) ? 0 : n; };
const clean = v => (v || '').toString().trim();

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Access-Control-Allow-Origin', '*');

  let debugStep = "Starting";

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    debugStep = "Checking GOOGLE_CREDENTIALS_JSON";
    if (!process.env.GOOGLE_CREDENTIALS_JSON)
      return res.status(500).json({ error: 'Missing GOOGLE_CREDENTIALS_JSON' });

    let credentials;
    try {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      if (credentials.private_key)
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    } catch {
      return res.status(500).json({ error: 'Invalid JSON in GOOGLE_CREDENTIALS_JSON' });
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // ── Read both registries ──────────────────────────────────────────────────
    debugStep = "Reading Forecaster Registry";
    const [fcReg, wfReg] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: '1B7m7DOSLCXj9vMHTwuXAjLVkuw0i3f0aUrbYweAj6xU', range: 'A:F' }),
      sheets.spreadsheets.values.get({ spreadsheetId: '169w2PQ22gt1ItcQTOXQP-F9XHVocY17OLv3fzoA1_3E', range: 'A:F' }),
    ]);

    const fcRows = (fcReg.data.values || []).slice(1);   // skip header
    const wfRows = (wfReg.data.values || []).slice(1);

    // Registry columns: A=Month_Date, B=Latest/Prev, C=Spreadsheet_ID, D=Notes, E=Tab_Name, F=Data_Type
    const isSummary = row => clean(row[5]).toLowerCase() === 'summary';
    const isLatest  = row => clean(row[1]).toLowerCase() === 'latest';

    // For the study-detail query we still want "Details" rows
    const isDetails = row => clean(row[5]).toLowerCase() === 'details';

    // ── Forecaster: pick latest Summary row → "Executive Summary" tab ────────
    const fcSummaryRows  = fcRows.filter(r => isSummary(r));
    const fcLatestSum    = fcSummaryRows.filter(r => isLatest(r)).pop() || fcSummaryRows[fcSummaryRows.length - 1];
    const fcPrevSum      = fcSummaryRows.filter(r => !isLatest(r)).pop() || null;

    // ── Forecaster: pick latest Details rows (for study table) ────────────────
    const fcDetailRows   = fcRows.filter(r => isDetails(r));
    const fcLatestDet    = fcDetailRows.filter(r => isLatest(r)).pop() || fcDetailRows[fcDetailRows.length - 1];

    // ── Waterfall: pick latest + previous Summary rows ────────────────────────
    const wfSummaryRows  = wfRows.filter(r => isSummary(r));
    const wfLatestSum    = wfSummaryRows.filter(r => isLatest(r)).pop() || wfSummaryRows[wfSummaryRows.length - 1];
    const wfPrevSum      = wfSummaryRows.filter(r => !isLatest(r)).pop() || null;

    if (!fcLatestSum) return res.status(404).json({ error: 'No Summary row found in Forecaster Registry.' });
    if (!fcLatestDet) return res.status(404).json({ error: 'No Details row found in Forecaster Registry.' });

    const meta = {
      latestFcName : clean(fcLatestSum[0]) || "Current Month",
      prevFcName   : fcPrevSum ? clean(fcPrevSum[0]) : "Previous Month",
      latestWfName : wfLatestSum ? clean(wfLatestSum[0]) : "Current Week",
      prevWfName   : wfPrevSum  ? clean(wfPrevSum[0])  : "Previous Week",
    };

    // ── Fetch Executive Summary tab (Forecaster) ──────────────────────────────
    debugStep = `Reading Forecaster Executive Summary (${fcLatestSum[2]} / ${fcLatestSum[4]})`;
    const fcSumResp = await sheets.spreadsheets.values.get({
      spreadsheetId: clean(fcLatestSum[2]),
      range: `${clean(fcLatestSum[4])}!A1:Z200`,
    });
    const fcSumRows = fcSumResp.data.values || [];

    // ── Fetch Waterfall Summary – baseline 85M tab ────────────────────────────
    let wfSumRows = [];
    if (wfLatestSum) {
      debugStep = `Reading Waterfall Summary (${wfLatestSum[2]} / ${wfLatestSum[4]})`;
      try {
        const wfSumResp = await sheets.spreadsheets.values.get({
          spreadsheetId: clean(wfLatestSum[2]),
          range: `${clean(wfLatestSum[4])}!A1:Z200`,
        });
        wfSumRows = wfSumResp.data.values || [];
      } catch (e) {
        console.warn('Waterfall summary fetch failed:', e.message);
      }
    }

    // ── Optionally fetch previous waterfall summary ───────────────────────────
    let wfPrevRows = [];
    if (wfPrevSum) {
      try {
        const r = await sheets.spreadsheets.values.get({
          spreadsheetId: clean(wfPrevSum[2]),
          range: `${clean(wfPrevSum[4])}!A1:Z200`,
        });
        wfPrevRows = r.data.values || [];
      } catch { /* silent */ }
    }

    // ── Fetch study-level details (for Study Search tab) ─────────────────────
    debugStep = `Reading study details (${fcLatestDet[2]} / ${fcLatestDet[4]})`;
    const detResp = await sheets.spreadsheets.values.get({
      spreadsheetId: clean(fcLatestDet[2]),
      range: `${clean(fcLatestDet[4])}!A2:Z3000`,
    });
    const detRows = detResp.data.values || [];

    // ── Parse study rows ──────────────────────────────────────────────────────
    const liveStudies = detRows.map(p => {
      if (!p || p.length === 0) return null;
      const qs = (p[21] || '').split(',').map(Number);
      const mo = {};
      (p[27] || '').split('|').forEach(m => {
        if (!m) return;
        const [k, v] = m.split(':');
        if (k && v) mo[k] = +v || 0;
      });
      return {
        lid: p[0] || '', atom: p[1] || '', protocol: p[2] || '', site: p[3] || '',
        status: p[4] || '', substatus: p[5] || '', sponsor: p[6] || '', cro: p[7] || '',
        indication: p[8] || '', ta: p[9] || '',
        actRando: num(p[10]), goals: num(p[11]), totalPts: num(p[12]),
        bps: num(p[13]), cl: num(p[14]), fcv: num(p[15]), rev: num(p[16]),
        total2026: num(p[17]), actual2026: num(p[18]), h1: num(p[19]), h2: num(p[20]),
        q1: qs[0] || 0, q2: qs[1] || 0, q3: qs[2] || 0, q4: qs[3] || 0,
        vax: p[22] || '', priority: p[23] || '', pi: p[24] || '',
        leadName: p[25] || '', active: p[26] || '', mo,
      };
    }).filter(s => s && s.lid && s.lid !== 'undefined' && s.lid !== 'Source');

    // ── Parse Forecaster Executive Summary ────────────────────────────────────
    // The sheet is a pivot-style table.  We scan every cell for recognisable
    // labels and read the value in the adjacent / relevant column.
    const findVal = (rows, labelRegex, colOffset = 1) => {
      for (const row of rows) {
        for (let c = 0; c < row.length; c++) {
          if (labelRegex.test(clean(row[c]))) {
            const v = num(row[c + colOffset]);
            if (v !== 0) return v;
          }
        }
      }
      return 0;
    };

    // Row-label search: find a row whose first non-empty cell matches, return requested col
    const rowVal = (rows, labelRegex, col) => {
      for (const row of rows) {
        const label = clean(row[0]) || clean(row[1]) || '';
        if (labelRegex.test(label)) return num(row[col] || 0);
      }
      return 0;
    };

    // ── Build monthly / quarterly from Executive Summary ──────────────────────
    // Executive Summary typically has months across columns.
    // Strategy: find the header row (contains "Jan" or "January"), then read Grand Total row.
    let fcMonthly = [];
    let fcQuarterly = [];
    let grandTotal = 0;
    let ytdActual  = 0;

    // Find header row index
    const MONTH_RE = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
    let headerRowIdx = -1;
    let monthCols = []; // [{label, col, isActual}]

    for (let r = 0; r < fcSumRows.length; r++) {
      const row = fcSumRows[r];
      const hits = row.filter(c => MONTH_RE.test(clean(c)));
      if (hits.length >= 3) {
        headerRowIdx = r;
        row.forEach((cell, ci) => {
          if (MONTH_RE.test(clean(cell))) monthCols.push({ label: clean(cell), col: ci });
        });
        break;
      }
    }

    // Find Grand Total row (look for "Grand Total" or "Total Loaded" label)
    const TOTAL_RE = /grand.?total|total.?loaded|revenue.*total/i;
    let totalRow = null;
    for (let r = headerRowIdx + 1; r < fcSumRows.length; r++) {
      const row = fcSumRows[r];
      const lbl = clean(row[0]) + ' ' + clean(row[1]);
      if (TOTAL_RE.test(lbl)) { totalRow = row; break; }
    }

    // Also look for ACT/FCST markers in the row just below header
    // to classify each month column as Actual vs Forecast
    let typeRow = headerRowIdx >= 0 ? fcSumRows[headerRowIdx + 1] : [];
    const isActCol = col => /act|actual/i.test(clean((typeRow || [])[col] || ''));

    if (totalRow && monthCols.length) {
      fcMonthly = monthCols.map(mc => ({
        m: mc.label.substring(0, 3),
        v: num(totalRow[mc.col]),
        t: isActCol(mc.col) ? 'ACT' : 'FCST',
      }));
      grandTotal = fcMonthly.reduce((s, m) => s + m.v, 0);
      ytdActual  = fcMonthly.filter(m => m.t === 'ACT').reduce((s, m) => s + m.v, 0);

      // Build quarterly from monthly
      const qMap = { 0:'Q1',1:'Q1',2:'Q1',3:'Q2',4:'Q2',5:'Q2',6:'Q3',7:'Q3',8:'Q3',9:'Q4',10:'Q4',11:'Q4' };
      const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
      const qAgg = { Q1:0, Q2:0, Q3:0, Q4:0 };
      fcMonthly.forEach(m => {
        const idx = MONTHS.indexOf(m.m.toLowerCase());
        if (idx >= 0) qAgg[qMap[idx]] += m.v;
      });
      fcQuarterly = Object.entries(qAgg).map(([q, v]) => ({ q, v, m: q }));
    }

    // Fallback: use study-level totals if summary parse yields nothing
    if (grandTotal === 0) {
      grandTotal = liveStudies.reduce((a, c) => a + c.total2026, 0);
      ytdActual  = liveStudies.reduce((a, c) => a + c.actual2026, 0);
    }

    // ── Parse Waterfall Summary – baseline 85M ────────────────────────────────
    const parseWaterfallSummary = (rows) => {
      if (!rows.length) return { grand: 0, h1: 0, h2: 0, q1: 0, q2: 0, q3: 0, q4: 0, components: [], monthly: [] };

      // Find H1/H2 row
      let h1 = 0, h2 = 0, q1 = 0, q2 = 0, q3 = 0, q4 = 0;
      const H_RE  = /revenue.*waterfall.*baseline|total.*revenue|grand.*total/i;
      const H1_RE = /\bh1\b/i;
      const H2_RE = /\bh2\b/i;
      const Q_RE  = /\bq([1-4])\b/i;

      // Scan for a row that has H1 / H2 in the header or data
      for (const row of rows) {
        for (let c = 0; c < row.length; c++) {
          if (H1_RE.test(clean(row[c]))) h1 = num(row[c + 1] || row[c + 2] || 0);
          if (H2_RE.test(clean(row[c]))) h2 = num(row[c + 1] || row[c + 2] || 0);
        }
      }

      // Find Q values from a header/data row pattern
      for (const row of rows) {
        for (let c = 0; c < row.length; c++) {
          const m = Q_RE.exec(clean(row[c]));
          if (m) {
            const qn = parseInt(m[1]);
            const v  = num(row[c + 1] || 0);
            if (qn === 1 && v) q1 = v;
            if (qn === 2 && v) q2 = v;
            if (qn === 3 && v) q3 = v;
            if (qn === 4 && v) q4 = v;
          }
        }
      }

      const grand = h1 + h2 || q1 + q2 + q3 + q4;

      // Build waterfall bridge components from labelled rows
      const BRIDGE_LABELS = [
        { re: /backlog|maintenance/i,  label: 'Backlog / Maintenance', type: 'pos' },
        { re: /enrolling/i,            label: 'Enrolling',             type: 'pos' },
        { re: /awarded/i,              label: 'Awarded',               type: 'pos' },
        { re: /pipeline/i,             label: 'Pipeline',              type: 'pos' },
        { re: /risk.*adj|adjustment/i, label: 'Risk Adj.',             type: 'neg' },
        { re: /budget.*opt/i,          label: 'Budget Opt.',           type: 'neg' },
      ];

      const components = [];
      for (const bl of BRIDGE_LABELS) {
        for (const row of rows) {
          const lbl = clean(row[0]) + ' ' + clean(row[1]);
          if (bl.re.test(lbl)) {
            // find the "Total" column — usually the rightmost numeric value
            const vals = row.map(num).filter(v => v !== 0);
            const v = vals[vals.length - 1] || 0;
            if (v) { components.push({ label: bl.label, value: v, type: bl.type }); break; }
          }
        }
      }
      if (components.length) components.push({ label: 'Grand Total', value: grand, type: 'tot' });

      return { grand, h1, h2, q1, q2, q3, q4, components, monthly: [] };
    };

    const wfCurrent  = parseWaterfallSummary(wfSumRows);
    const wfPrevData  = parseWaterfallSummary(wfPrevRows);

    // ── Awards from study list ────────────────────────────────────────────────
    const awarded   = liveStudies.filter(s => s.status === 'Awarded');
    const vaxAwd    = awarded.filter(s => (s.vax || '').includes('Vaccine') && !(s.vax || '').includes('Non'));
    const nvaxAwd   = awarded.filter(s => (s.vax || '').includes('Non'));
    const totalFcv  = awarded.reduce((s, x) => s + x.fcv, 0);

    const SD = {
      meta,
      asOf    : meta.latestFcName,
      baseline: 85000000,

      fc: {
        grand   : grandTotal,
        ytd     : ytdActual,
        q1      : fcQuarterly.find(q => q.q === 'Q1')?.v || 0,
        q2      : fcQuarterly.find(q => q.q === 'Q2')?.v || 0,
        q3      : fcQuarterly.find(q => q.q === 'Q3')?.v || 0,
        q4      : fcQuarterly.find(q => q.q === 'Q4')?.v || 0,
        monthly : fcMonthly,
        quarterly: fcQuarterly,
      },

      wf      : wfCurrent,
      wf_prev : wfPrevData,

      counts: {
        grand     : liveStudies.length,
        vaxTotal  : liveStudies.filter(s => (s.vax || '').includes('Vaccine')).length,
        nvaxTotal : liveStudies.filter(s => (s.vax || '').includes('Non')).length,
      },

      awards: {
        vaxTgt  : 30,
        nvaxTgt : 283,
        fcvTgt  : 83200000,
        quarterly: [
          { q: 'Q1', tgt: 78, act: vaxAwd.filter(s => s.q1 > 0).length + nvaxAwd.filter(s => s.q1 > 0).length, fcvAct: awarded.filter(s => s.q1 > 0).reduce((a, c) => a + c.fcv, 0) },
          { q: 'Q2', tgt: 78, act: vaxAwd.filter(s => s.q2 > 0).length + nvaxAwd.filter(s => s.q2 > 0).length, fcvAct: awarded.filter(s => s.q2 > 0).reduce((a, c) => a + c.fcv, 0) },
          { q: 'Q3', tgt: 78, act: vaxAwd.filter(s => s.q3 > 0).length + nvaxAwd.filter(s => s.q3 > 0).length, fcvAct: awarded.filter(s => s.q3 > 0).reduce((a, c) => a + c.fcv, 0) },
          { q: 'Q4', tgt: 79, act: vaxAwd.filter(s => s.q4 > 0).length + nvaxAwd.filter(s => s.q4 > 0).length, fcvAct: awarded.filter(s => s.q4 > 0).reduce((a, c) => a + c.fcv, 0) },
        ],
      },

      variance : { fc_mom: [], wf_wow: [] },
      wow      : [],
      trend    : [],
    };

    debugStep = "Sending Success Response";
    return res.status(200).json({ source: fcLatestSum[4], studies: liveStudies, sdMetrics: SD });

  } catch (error) {
    console.error(`ERROR at [${debugStep}]: ${error.message}`);
    return res.status(500).json({ error: `Failed at [${debugStep}]: ${error.message}` });
  }
}
