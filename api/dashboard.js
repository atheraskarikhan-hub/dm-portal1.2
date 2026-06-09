import { google } from 'googleapis';

export const maxDuration = 60;

// ─── Parse a number string that may have commas, spaces, parens for negatives
// mode: 'full' = raw dollars (Forecaster), 'thousands' = multiply by 1000 (Waterfall)
const parseNum = (v, mode = 'full') => {
  if (v == null) return 0;
  const s = String(v).trim();
  if (!s || s === '-') return 0;
  // Handle accounting negatives: (1,234) → -1234
  const neg = s.startsWith('(') && s.endsWith(')');
  const clean = s.replace(/[$()\s,]/g, '').replace('%', '');
  const n = parseFloat(clean);
  if (isNaN(n)) return 0;
  const val = neg ? -n : n;
  return mode === 'thousands' ? val * 1000 : val;
};
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
    // Columns: A=Date, B=Latest/Previous/Old, C=Spreadsheet_ID, D=Notes, E=Tab_Name, F=Data_Type
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

    const fcSumLatest = fcRows.filter(r => isSummary(r) && isLatest(r)).pop();
    const fcSumPrev   = fcRows.filter(r => isSummary(r) && isPrevious(r)).pop();
    const fcDetLatest = fcRows.filter(r => isDetails(r) && isLatest(r)).pop()
                     || fcRows.filter(r => isDetails(r)).pop();
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

    // ── Fetch sheets ──────────────────────────────────────────────────────────
    step = "fetch-sheets";
    const fetchSheet = async (sheetId, tabName, range = 'A1:Z200') => {
      try {
        const r = await sheets.spreadsheets.values.get({
          spreadsheetId: cl(sheetId), range: `${cl(tabName)}!${range}`,
        });
        return r.data.values || [];
      } catch (e) {
        console.warn(`Failed ${tabName}: ${e.message}`);
        return [];
      }
    };

    const [fcSumRows, fcSumPrevRows, fcDetRows, wfLatestRows, wfPrevRows] = await Promise.all([
      fetchSheet(fcSumLatest[2], fcSumLatest[4], 'A1:FZ60'),
      fcSumPrev ? fetchSheet(fcSumPrev[2], fcSumPrev[4], 'A1:FZ60') : [],
      fetchSheet(fcDetLatest[2], fcDetLatest[4], 'A2:Z3000'),
      wfSumLatest ? fetchSheet(wfSumLatest[2], wfSumLatest[4], 'A1:AJ40') : [],
      wfSumPrev   ? fetchSheet(wfSumPrev[2],   wfSumPrev[4],   'A1:AJ40') : [],
    ]);

    // ── Parse Executive Summary (Forecaster) ──────────────────────────────────
    //
    // CONFIRMED from CSV analysis:
    //   Row 9  (idx 8)  = column headers  (year labels, month names)
    //   Row 10 (idx 9)  = ACT/FCST type row
    //   Row 52 (idx 51) = "Grand Total" — values in FULL DOLLARS
    //
    //   2026 column indices (0-based):
    //     60 = 2026 Grand Total (ACT+FCST)   e.g. "  72,882,175 "
    //     61 = 2026 YTD Actual               e.g. "  35,665,389 "
    //     62 = 2026 Remaining Forecast
    //     63 = Q1 2026
    //     64 = Q2 2026
    //     65 = Q3 2026
    //     66 = Q4 2026
    //     67 = Jan 2026 (ACT)
    //     68 = Feb 2026 (ACT)
    //     69 = Mar 2026 (ACT)
    //     70 = Apr 2026 (ACT)
    //     71 = May 2026 (ACT)
    //     72 = Jun 2026 (FCST)
    //     73 = Jul 2026 (FCST)
    //     74 = Aug 2026 (FCST)
    //     75 = Sep 2026 (FCST)
    //     76 = Oct 2026 (FCST)
    //     77 = Nov 2026 (FCST)
    //     78 = Dec 2026 (FCST)

    const G  = fcSumRows[51] || [];  // Grand Total row (row 52, 0-indexed = 51)
    const TR = fcSumRows[9]  || [];  // Type row (ACT/FCST)

    const fc_grand = parseNum(G[60]);
    const fc_ytd   = parseNum(G[61]);
    const fc_q1    = parseNum(G[63]);
    const fc_q2    = parseNum(G[64]);
    const fc_q3    = parseNum(G[65]);
    const fc_q4    = parseNum(G[66]);

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const fcMonthly = MONTHS.map((m, i) => {
      const ci = 67 + i;
      const t  = cl(TR[ci]).toLowerCase().includes('act') ? 'ACT' : 'FCST';
      return { m, v: parseNum(G[ci]), t };
    });

    // ── Parse Previous Forecaster (for fc_prev + counts_prev) ──────────────
    const GP  = fcSumPrevRows[51] || [];
    const TRP = fcSumPrevRows[9]  || [];
    const fc_prev_grand = parseNum(GP[60]);
    const fc_prev_ytd   = parseNum(GP[61]);
    const fc_prev_q1    = parseNum(GP[63]);
    const fc_prev_q2    = parseNum(GP[64]);
    const fc_prev_q3    = parseNum(GP[65]);
    const fc_prev_q4    = parseNum(GP[66]);
    const fcPrevMonthly = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => {
      const ci = 67 + i;
      return { m, v: parseNum(GP[ci]), t: cl(TRP[ci]).toLowerCase().includes('act') ? 'ACT' : 'FCST' };
    });

    // Study counts from Executive Summary (col 4 = count column)
    const getCnt = (rows, rowIdx) => parseNum((rows[rowIdx] || [])[4]);
    const cur_pipeline    = getCnt(fcSumRows, 21);
    const cur_awarded = getCnt(fcSumRows, 25);
    const cur_enrolling   = getCnt(fcSumRows, 29);
    const cur_maint       = getCnt(fcSumRows, 33);
    const cur_backlog     = getCnt(fcSumRows, 46);
    const cur_vax         = getCnt(fcSumRows, 48);
    const cur_nvax        = getCnt(fcSumRows, 49);
    const cur_grand       = getCnt(fcSumRows, 51);
    const prev_pipeline   = getCnt(fcSumPrevRows, 21);
    const prev_awarded= getCnt(fcSumPrevRows, 25);
    const prev_enrolling  = getCnt(fcSumPrevRows, 29);
    const prev_maint      = getCnt(fcSumPrevRows, 33);
    const prev_backlog    = getCnt(fcSumPrevRows, 46);
    const prev_vax        = getCnt(fcSumPrevRows, 48);
    const prev_nvax       = getCnt(fcSumPrevRows, 49);
    const prev_grand      = getCnt(fcSumPrevRows, 51);

    // ── Parse Waterfall Summary - baseline 85M ────────────────────────────────
    //
    // CONFIRMED from CSV analysis:
    //   Row 6  (idx 5)  = headers: H1(col1), H2(col2), Q1(col4), Q2(col5), Q3(col6), Q4(col7)
    //                              Jan(col9)..Dec(col20), Total(col21)
    //   Row 5  (idx 4)  = ACT/FCST type row for monthly cols
    //
    //   VALUES ARE IN THOUSANDS → multiply by 1000
    //
    //   Key rows (0-indexed):
    //     6  = "Revenue Waterfall - Baseline Goals"  ← Grand Total
    //     7  = "Backlog (Maintenance)"
    //     8  = "Total Enrolling"
    //     12 = "Total Awarded"
    //     16 = "Total Pipeline"
    //     25 = "Genuine Go-Get"

    const parseWF = (rows) => {
      if (!rows || !rows.length) return { grand: 0, h1: 0, h2: 0, q1: 0, q2: 0, q3: 0, q4: 0, components: [], monthly: [] };

      const p = (row, ci) => parseNum((row || [])[ci], 'thousands');

      const r7  = rows[6]  || [];  // Baseline Goals (grand total)
      const r8  = rows[7]  || [];  // Backlog
      const r9  = rows[8]  || [];  // Total Enrolling
      const r13 = rows[12] || [];  // Total Awarded
      const r17 = rows[16] || [];  // Total Pipeline
      const r26 = rows[25] || [];  // Genuine Go-Get

      // Type row (idx 4): cols 9-20 = Jan-Dec, values "ACT" or "FCST"
      const typeRow = rows[4] || [];

      const h1 = p(r7, 1);
      const h2 = p(r7, 2);
      const q1 = p(r7, 4);
      const q2 = p(r7, 5);
      const q3 = p(r7, 6);
      const q4 = p(r7, 7);

      const monthly = MONTHS.map((m, i) => {
        const ci = 9 + i;
        const t  = cl(typeRow[ci]).toLowerCase().includes('act') ? 'ACT' : 'FCST';
        return { m, v: p(r7, ci), t };
      });

      const components = [
        { label: 'Backlog / Maintenance', value: p(r8,  1) + p(r8,  2), type: 'pos' },
        { label: 'Total Enrolling',       value: p(r9,  1) + p(r9,  2), type: 'pos' },
        { label: 'Total Awarded',         value: p(r13, 1) + p(r13, 2), type: 'pos' },
        { label: 'Total Pipeline',        value: p(r17, 1) + p(r17, 2), type: 'pos' },
        { label: 'Genuine Go-Get',        value: p(r26, 1) + p(r26, 2), type: 'pos' },
        { label: 'Grand Total',           value: h1 + h2,               type: 'tot' },
      ];

      return { grand: h1 + h2, h1, h2, q1, q2, q3, q4, monthly, components };
    };

    const wfCurrent  = parseWF(wfLatestRows);
    const wfPrevious = parseWF(wfPrevRows);

    // ── Parse Study-Level Detail Rows ─────────────────────────────────────────
    step = "parse-studies";
    const liveStudies = fcDetRows.map(p => {
      if (!p || !p[0]) return null;
      const qs = (p[21] || '').split(',').map(Number);
      const mo = {};
      (p[27] || '').split('|').forEach(m => {
        const [k, v] = (m || '').split(':');
        if (k && v) mo[k] = parseFloat(v) || 0;
      });
      return {
        lid: p[0]||'', atom: p[1]||'', protocol: p[2]||'', site: p[3]||'',
        status: p[4]||'', substatus: p[5]||'', sponsor: p[6]||'', cro: p[7]||'',
        indication: p[8]||'', ta: p[9]||'',
        actRando: parseNum(p[10]), goals: parseNum(p[11]), totalPts: parseNum(p[12]),
        bps: parseNum(p[13]), cl: parseNum(p[14]), fcv: parseNum(p[15]), rev: parseNum(p[16]),
        total2026: parseNum(p[17]), actual2026: parseNum(p[18]), h1: parseNum(p[19]), h2: parseNum(p[20]),
        q1: qs[0]||0, q2: qs[1]||0, q3: qs[2]||0, q4: qs[3]||0,
        vax: p[22]||'', priority: p[23]||'', pi: p[24]||'',
        leadName: p[25]||'', active: p[26]||'', mo,
      };
    }).filter(s => s && s.lid && s.lid !== 'undefined' && s.lid !== 'Source');

    // ── Awards ────────────────────────────────────────────────────────────────
    const awarded  = liveStudies.filter(s => s.status === 'Awarded');
    const vaxAwd   = awarded.filter(s => (s.vax||'').includes('Vaccine') && !(s.vax||'').includes('Non'));
    const nvaxAwd  = awarded.filter(s => (s.vax||'').includes('Non'));

    // ── Assemble final SD object ──────────────────────────────────────────────
    const SD = {
      meta,
      asOf    : meta.latestFcName,
      baseline: 85000000,

      fc: {
        grand    : fc_grand,
        ytd      : fc_ytd,
        q1       : fc_q1,
        q2       : fc_q2,
        q3       : fc_q3,
        q4       : fc_q4,
        monthly  : fcMonthly,
        quarterly: [
          { q: 'Q1', v: fc_q1, m: 'Q1' },
          { q: 'Q2', v: fc_q2, m: 'Q2' },
          { q: 'Q3', v: fc_q3, m: 'Q3' },
          { q: 'Q4', v: fc_q4, m: 'Q4' },
        ],
      },

      wf      : wfCurrent,
      wf_prev : wfPrevious,



      awards: {
        vaxTgt  : 30,
        nvaxTgt : 283,
        fcvTgt  : 83200000,
        quarterly: [
          { q:'Q1', tgt:78, act: awarded.filter(s=>s.q1>0).length, fcvAct: awarded.filter(s=>s.q1>0).reduce((a,c)=>a+c.fcv,0) },
          { q:'Q2', tgt:78, act: awarded.filter(s=>s.q2>0).length, fcvAct: awarded.filter(s=>s.q2>0).reduce((a,c)=>a+c.fcv,0) },
          { q:'Q3', tgt:78, act: awarded.filter(s=>s.q3>0).length, fcvAct: awarded.filter(s=>s.q3>0).reduce((a,c)=>a+c.fcv,0) },
          { q:'Q4', tgt:79, act: awarded.filter(s=>s.q4>0).length, fcvAct: awarded.filter(s=>s.q4>0).reduce((a,c)=>a+c.fcv,0) },
        ],
      },

      // ── Counts ──────────────────────────────────────────────────────────
      counts: {
        grand    : cur_grand   || liveStudies.length,
        backlog  : cur_backlog || liveStudies.filter(s=>['Awarded','Enrolling','Maintenance'].includes(s.status)).length,
        pipeline : cur_pipeline|| liveStudies.filter(s=>s.status==='Pipeline').length,
        awarded  : cur_awarded || awarded.length,
        enrolling: cur_enrolling,
        maintenance: cur_maint,
        vaxTotal : cur_vax    || liveStudies.filter(s=>(s.vax||'').includes('Vaccine')).length,
        nvaxTotal: cur_nvax   || liveStudies.filter(s=>(s.vax||'').includes('Non')).length,
        vaxAwarded : vaxAwd.length,
        nvaxAwarded: nvaxAwd.length,
      },

      counts_prev: {
        grand    : prev_grand   || 0,
        backlog  : prev_backlog || 0,
        pipeline : prev_pipeline|| 0,
        awarded  : prev_awarded || 0,
        enrolling: prev_enrolling,
        maintenance: prev_maint,
        vaxTotal : prev_vax    || 0,
        nvaxTotal: prev_nvax   || 0,
      },

      // ── Previous Forecaster ──────────────────────────────────────────────
      fc_prev: {
        grand    : fc_prev_grand,
        ytd      : fc_prev_ytd,
        q1       : fc_prev_q1,
        q2       : fc_prev_q2,
        q3       : fc_prev_q3,
        q4       : fc_prev_q4,
        monthly  : fcPrevMonthly,
        quarterly: [
          { q:'Q1', v:fc_prev_q1, m:'Q1' },
          { q:'Q2', v:fc_prev_q2, m:'Q2' },
          { q:'Q3', v:fc_prev_q3, m:'Q3' },
          { q:'Q4', v:fc_prev_q4, m:'Q4' },
        ],
      },

      // ── Goals (from Waterfall row 34 col 1=H1, col 2=H2, col 4=Q1 etc) ──
      goals: (() => {
        const r34 = wfLatestRows[33] || [];
        const p = (ci) => parseNum(r34[ci], 'thousands');
        return {
          total : Math.round(p(1) + p(2)),
          h1    : Math.round(p(1)),
          h2    : Math.round(p(2)),
          vaxH1 : 0,  // not available in this tab
          nvaxH1: 0,
        };
      })(),

      // ── Variance (MoM Forecaster, WoW Waterfall) ─────────────────────────
      variance: {
        fc_mom: [
          { cat:'Grand Total', old:fc_prev_grand, new_v:fc_grand,
            old_cnt:prev_grand, new_cnt:cur_grand,
            reason:'Pipeline additions, new awards, revenue optimization' },
          { cat:'Pipeline',    old:fc_prev_q3+fc_prev_q4, new_v:fc_q3+fc_q4,
            old_cnt:prev_pipeline, new_cnt:cur_pipeline,
            reason:'New pipeline opportunities added this month' },
          { cat:'Awarded',     old:fc_prev_ytd, new_v:fc_ytd,
            old_cnt:prev_awarded, new_cnt:cur_awarded,
            reason:'New awards and site activations' },
          { cat:'YTD Actual',  old:fc_prev_ytd, new_v:fc_ytd,
            old_cnt:prev_enrolling, new_cnt:cur_enrolling,
            reason:'Actualized monthly revenue captured' },
        ],
        wf_wow: [
          { cat:'Total Revenue', old:wfPrevious.grand, new_v:wfCurrent.grand,
            diff: wfCurrent.grand - wfPrevious.grand, reason:'Week-over-week portfolio adjustments' },
          { cat:'H1 Total',      old:wfPrevious.h1,    new_v:wfCurrent.h1,
            diff: wfCurrent.h1 - wfPrevious.h1,   reason:'Enrollment and backlog changes' },
          { cat:'H2 Total',      old:wfPrevious.h2,    new_v:wfCurrent.h2,
            diff: wfCurrent.h2 - wfPrevious.h2,   reason:'Pipeline and go-get adjustments' },
        ],
      },

      // ── WoW table (built from waterfall component comparison) ────────────
      wow: (() => {
        const labels = ['Backlog / Maintenance','Total Enrolling','Total Awarded','Total Pipeline','Genuine Go-Get'];
        return wfCurrent.components
          .filter(c => c.type !== 'tot')
          .map((c, i) => {
            const prevC = (wfPrevious.components || [])[i] || {};
            return {
              cat   : c.label,
              prev  : prevC.value || 0,
              curr  : c.value,
              drivers: [`${c.label}: ${c.value > (prevC.value||0) ? '+' : ''}${((c.value-(prevC.value||0))/1e6).toFixed(2)}M vs prior week`],
            };
          });
      })(),

      trend   : [],
    };

    step = "done";
    return res.status(200).json({ source: fcSumLatest[4], studies: liveStudies, sdMetrics: SD });

  } catch (err) {
    console.error(`[${step}] ${err.message}`);
    return res.status(500).json({ error: `Failed at [${step}]: ${err.message}` });
  }
}

// NOTE: This file already exports the handler above.
// The additions below are NOT needed - the handler is complete.
