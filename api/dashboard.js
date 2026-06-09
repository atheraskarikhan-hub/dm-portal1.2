import { google } from 'googleapis';

export const maxDuration = 60;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const n  = v => { const x = parseFloat(String(v ?? '').replace(/[$,%\s]/g, '')); return isNaN(x) ? 0 : x; };
const cl = v => String(v ?? '').trim();

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Access-Control-Allow-Origin', '*');
  let step = "init";

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    step = "auth";
    if (!process.env.GOOGLE_CREDENTIALS_JSON)
      return res.status(500).json({ error: 'Missing GOOGLE_CREDENTIALS_JSON' });

    let creds;
    try {
      creds = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      if (creds.private_key) creds.private_key = creds.private_key.replace(/\\n/g, '\n');
    } catch { return res.status(500).json({ error: 'Invalid JSON in GOOGLE_CREDENTIALS_JSON' }); }

    const auth   = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
    const sheets = google.sheets({ version: 'v4', auth });

    // ── Read Registries ───────────────────────────────────────────────────────
    // Registry columns: A=Date, B=Latest/Previous/Old, C=Spreadsheet_ID, D=Notes, E=Tab_Name, F=Data_Type
    step = "registries";
    const [fcReg, wfReg] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: '1B7m7DOSLCXj9vMHTwuXAjLVkuw0i3f0aUrbYweAj6xU', range: 'A:F' }),
      sheets.spreadsheets.values.get({ spreadsheetId: '169w2PQ22gt1ItcQTOXQP-F9XHVocY17OLv3fzoA1_3E', range: 'A:F' }),
    ]);

    const fcRows = (fcReg.data.values || []).slice(1);
    const wfRows = (wfReg.data.values || []).slice(1);

    const isLatest   = r => cl(r[1]).toLowerCase() === 'latest';
    const isPrevious = r => cl(r[1]).toLowerCase() === 'previous';
    const isSummary  = r => cl(r[5]).toLowerCase() === 'summary';
    const isDetails  = r => cl(r[5]).toLowerCase() === 'details';

    // Forecaster: latest Summary row → "Executive Summary" tab
    const fcSumLatest = fcRows.filter(r => isSummary(r) && isLatest(r)).pop();
    const fcSumPrev   = fcRows.filter(r => isSummary(r) && isPrevious(r)).pop();
    // Forecaster: latest Details row → study-level data tab
    const fcDetLatest = fcRows.filter(r => isDetails(r) && isLatest(r)).pop()
                     || fcRows.filter(r => isDetails(r)).pop();

    // Waterfall: latest + previous Summary rows → "Summary - baseline 85M" tab
    const wfSumLatest = wfRows.filter(r => isSummary(r) && isLatest(r)).pop();
    const wfSumPrev   = wfRows.filter(r => isSummary(r) && isPrevious(r)).pop();

    if (!fcSumLatest) return res.status(404).json({ error: 'No Latest Summary row in Forecaster Registry' });
    if (!fcDetLatest) return res.status(404).json({ error: 'No Details row in Forecaster Registry' });

    const meta = {
      latestFcName : cl(fcSumLatest[0]) || "Current Month",
      prevFcName   : cl(fcSumPrev?.[0]) || "Previous Month",
      latestWfName : cl(wfSumLatest?.[0]) || "Current Week",
      prevWfName   : cl(wfSumPrev?.[0])  || "Previous Week",
    };

    // ── Fetch all sheets in parallel ──────────────────────────────────────────
    step = "fetch-sheets";

    const fetchSheet = async (sheetId, tabName, range = 'A1:Z200') => {
      try {
        const r = await sheets.spreadsheets.values.get({
          spreadsheetId: cl(sheetId), range: `${cl(tabName)}!${range}`,
        });
        return r.data.values || [];
      } catch (e) {
        console.warn(`Failed ${tabName} from ${sheetId}: ${e.message}`);
        return [];
      }
    };

    const [fcSumRows, fcDetRows, wfLatestRows, wfPrevRows] = await Promise.all([
      fetchSheet(fcSumLatest[2], fcSumLatest[4]),                          // Executive Summary (latest)
      fetchSheet(fcDetLatest[2], fcDetLatest[4], 'A2:Z3000'),              // Details (study rows)
      wfSumLatest ? fetchSheet(wfSumLatest[2], wfSumLatest[4]) : [],       // WF Summary latest
      wfSumPrev   ? fetchSheet(wfSumPrev[2],   wfSumPrev[4])   : [],       // WF Summary previous
    ]);

    // ── Parse Executive Summary (Forecaster) ──────────────────────────────────
    // EXACT cell positions verified from XLSX inspection:
    //   Row 9  (index 8)  = header row with year/month labels
    //   Row 10 (index 9)  = ACT/FCST type row
    //   Row 52 (index 51) = "Grand Total" row
    //
    //   2026 columns (0-indexed):
    //     col 60 = 2026 Grand Total (ACT+FCST combined)
    //     col 61 = 2026 YTD Actual
    //     col 62 = 2026 Remaining Forecast
    //     col 63 = Q1 2026
    //     col 64 = Q2 2026
    //     col 65 = Q3 2026
    //     col 66 = Q4 2026
    //     col 67 = Jan 2026  (ACT)
    //     col 68 = Feb 2026  (ACT)
    //     col 69 = Mar 2026  (ACT)
    //     col 70 = Apr 2026  (ACT)
    //     col 71 = May 2026  (ACT)
    //     col 72 = Jun 2026  (FCST)
    //     col 73 = Jul 2026  (FCST)
    //     col 74 = Aug 2026  (FCST)
    //     col 75 = Sep 2026  (FCST)
    //     col 76 = Oct 2026  (FCST)
    //     col 77 = Nov 2026  (FCST)
    //     col 78 = Dec 2026  (FCST)

    const GRAND_ROW = fcSumRows[51] || []; // Row 52 (0-indexed = 51)

    const grandTotal = n(GRAND_ROW[60]);
    const ytdActual  = n(GRAND_ROW[61]);

    const fcQ1 = n(GRAND_ROW[63]);
    const fcQ2 = n(GRAND_ROW[64]);
    const fcQ3 = n(GRAND_ROW[65]);
    const fcQ4 = n(GRAND_ROW[66]);

    const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    // Type row (index 9): col 67-78 = Jan-Dec. ACT = actual, else FCST
    const typeRow = fcSumRows[9] || [];
    const fcMonthly = MONTH_LABELS.map((m, i) => {
      const ci = 67 + i;
      const t  = cl(typeRow[ci]).toLowerCase().includes('act') ? 'ACT' : 'FCST';
      return { m, v: n(GRAND_ROW[ci]), t };
    });

    // Status-level rows for study counts (rows 24-26 = Awarded Vax/NonVax/Total)
    // Row 24 (idx 23): Awarded - Vaccine  col 4 = count
    // Row 25 (idx 24): Awarded - Non-Vaccine
    // Row 26 (idx 25): Awarded total
    const awdVaxCount  = n((fcSumRows[23] || [])[4]);
    const awdNvaxCount = n((fcSumRows[24] || [])[4]);

    // ── Parse Waterfall Summary - baseline 85M ────────────────────────────────
    // EXACT row/column positions verified from XLSX inspection:
    //   Row 7  = "Revenue Waterfall - Baseline Goals" (grand total)
    //     col B (idx 1) = H1,  col C (idx 2) = H2
    //     col E (idx 4) = Q1,  col F (idx 5) = Q2,  col G (idx 6) = Q3,  col H (idx 7) = Q4
    //     col J-U (idx 9-20)  = Jan-Dec monthly values
    //   Row 8  = "Backlog (Maintenance)"
    //   Row 9  = "Total Enrolling"
    //   Row 13 = "Total Awarded"
    //   Row 17 = "Total Pipeline"
    //   Row 26 = "Genuine Go-Get"

    const parseWF = (rows) => {
      if (!rows.length) return { grand: 0, h1: 0, h2: 0, q1: 0, q2: 0, q3: 0, q4: 0, components: [], monthly: [] };
      const r7  = rows[6]  || [];
      const r8  = rows[7]  || [];
      const r9  = rows[8]  || [];
      const r13 = rows[12] || [];
      const r17 = rows[16] || [];
      const r26 = rows[25] || [];

      const h1 = n(r7[1]), h2 = n(r7[2]);
      const q1 = n(r7[4]), q2 = n(r7[5]), q3 = n(r7[6]), q4 = n(r7[7]);

      const monthly = MONTH_LABELS.map((m, i) => ({
        m,
        v: n(r7[9 + i]),
        t: i < 5 ? 'ACT' : 'FCST',   // Jan-May = ACT, Jun-Dec = FCST (as of May 26)
      }));

      const components = [
        { label: 'Backlog / Maintenance', value: n(r8[1])  + n(r8[2]),  type: 'pos' },
        { label: 'Total Enrolling',       value: n(r9[1])  + n(r9[2]),  type: 'pos' },
        { label: 'Total Awarded',         value: n(r13[1]) + n(r13[2]), type: 'pos' },
        { label: 'Total Pipeline',        value: n(r17[1]) + n(r17[2]), type: 'pos' },
        { label: 'Genuine Go-Get',        value: n(r26[1]) + n(r26[2]), type: 'pos' },
        { label: 'Grand Total',           value: h1 + h2,               type: 'tot' },
      ];

      return { grand: h1 + h2, h1, h2, q1, q2, q3, q4, monthly, components };
    };

    const wfCurrent = parseWF(wfLatestRows);
    const wfPrevious = parseWF(wfPrevRows);

    // ── Parse Study-Level Detail Rows ─────────────────────────────────────────
    step = "parse-studies";
    const liveStudies = fcDetRows.map(p => {
      if (!p || !p[0]) return null;
      const qs = (p[21] || '').split(',').map(Number);
      const mo = {};
      (p[27] || '').split('|').forEach(m => {
        if (!m) return;
        const [k, v] = m.split(':');
        if (k && v) mo[k] = +v || 0;
      });
      return {
        lid: p[0]||'', atom: p[1]||'', protocol: p[2]||'', site: p[3]||'',
        status: p[4]||'', substatus: p[5]||'', sponsor: p[6]||'', cro: p[7]||'',
        indication: p[8]||'', ta: p[9]||'',
        actRando: n(p[10]), goals: n(p[11]), totalPts: n(p[12]),
        bps: n(p[13]), cl: n(p[14]), fcv: n(p[15]), rev: n(p[16]),
        total2026: n(p[17]), actual2026: n(p[18]), h1: n(p[19]), h2: n(p[20]),
        q1: qs[0]||0, q2: qs[1]||0, q3: qs[2]||0, q4: qs[3]||0,
        vax: p[22]||'', priority: p[23]||'', pi: p[24]||'',
        leadName: p[25]||'', active: p[26]||'', mo,
      };
    }).filter(s => s && s.lid && s.lid !== 'undefined' && s.lid !== 'Source');

    // ── Awards summary from study list ────────────────────────────────────────
    const awarded  = liveStudies.filter(s => s.status === 'Awarded');
    const vaxAwd   = awarded.filter(s => (s.vax||'').includes('Vaccine') && !(s.vax||'').includes('Non'));
    const nvaxAwd  = awarded.filter(s => (s.vax||'').includes('Non'));
    const totalFcv = awarded.reduce((a, c) => a + c.fcv, 0);

    // ── Assemble SD metrics object ────────────────────────────────────────────
    const SD = {
      meta,
      asOf    : meta.latestFcName,
      baseline: 85000000,

      fc: {
        grand    : grandTotal,
        ytd      : ytdActual,
        q1       : fcQ1,
        q2       : fcQ2,
        q3       : fcQ3,
        q4       : fcQ4,
        monthly  : fcMonthly,
        quarterly: [
          { q: 'Q1', v: fcQ1, m: 'Q1' },
          { q: 'Q2', v: fcQ2, m: 'Q2' },
          { q: 'Q3', v: fcQ3, m: 'Q3' },
          { q: 'Q4', v: fcQ4, m: 'Q4' },
        ],
      },

      wf      : wfCurrent,
      wf_prev : wfPrevious,

      counts: {
        grand    : liveStudies.length,
        vaxTotal : liveStudies.filter(s => (s.vax||'').includes('Vaccine')).length,
        nvaxTotal: liveStudies.filter(s => (s.vax||'').includes('Non')).length,
      },

      awards: {
        vaxTgt  : 30,
        nvaxTgt : 283,
        fcvTgt  : 83200000,
        quarterly: [
          { q: 'Q1', tgt: 78, act: awarded.filter(s => s.q1 > 0).length, fcvAct: awarded.filter(s => s.q1 > 0).reduce((a,c) => a+c.fcv, 0) },
          { q: 'Q2', tgt: 78, act: awarded.filter(s => s.q2 > 0).length, fcvAct: awarded.filter(s => s.q2 > 0).reduce((a,c) => a+c.fcv, 0) },
          { q: 'Q3', tgt: 78, act: awarded.filter(s => s.q3 > 0).length, fcvAct: awarded.filter(s => s.q3 > 0).reduce((a,c) => a+c.fcv, 0) },
          { q: 'Q4', tgt: 79, act: awarded.filter(s => s.q4 > 0).length, fcvAct: awarded.filter(s => s.q4 > 0).reduce((a,c) => a+c.fcv, 0) },
        ],
      },

      variance: { fc_mom: [], wf_wow: [] },
      wow     : [],
      trend   : [],
    };

    step = "done";
    return res.status(200).json({ source: fcSumLatest[4], studies: liveStudies, sdMetrics: SD });

  } catch (err) {
    console.error(`[${step}] ${err.message}`);
    return res.status(500).json({ error: `Failed at [${step}]: ${err.message}` });
  }
}
