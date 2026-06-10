import { google } from 'googleapis';

export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const { messages, system } = req.body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY.' });
    }

    // ── Auth ──────────────────────────────────────────────────────────────────
    let credentials;
    if (process.env.GOOGLE_CREDENTIALS_JSON) {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      if (credentials.private_key) credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    } else if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      credentials = {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      };
    } else {
      return res.status(500).json({ error: 'Missing Google credentials.' });
    }

    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
    const sheets = google.sheets({ version: 'v4', auth });

    // ── Step 1: Read Registries ───────────────────────────────────────────────
    // Columns: A=Date, B=Latest/Previous, C=Spreadsheet_ID, D=Notes, E=Tab_Name, F=Data_Type
    const [fcReg, wfReg] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: '1B7m7DOSLCXj9vMHTwuXAjLVkuw0i3f0aUrbYweAj6xU', range: 'A:F' }),
      sheets.spreadsheets.values.get({ spreadsheetId: '169w2PQ22gt1ItcQTOXQP-F9XHVocY17OLv3fzoA1_3E', range: 'A:F' }),
    ]);

    const parseReg = r => r.data.values ? r.data.values.slice(1) : [];
    const allRows  = [...parseReg(fcReg), ...parseReg(wfReg)];
    const cl = v  => String(v || '').trim().toLowerCase();

    // Only Latest rows
    const isLatest  = r => cl(r[1]) === 'latest';
    const isSummary = r => cl(r[5]) === 'summary';
    const isDetails = r => cl(r[5]) === 'details';

    // ── Step 2: Detect what the user is asking ────────────────────────────────
    const lastMsg = (messages[messages.length - 1]?.content || '').toLowerCase();
    const wantsStudyDetail = /lead.?id|atom|lid:|study|sponsor|cro|pi |protocol|enrolling|awarded|maintenance|pipeline|site/i.test(lastMsg);

    // ── Step 3: Always fetch Summary tabs (small, fast) ───────────────────────
    const summaryRows = allRows.filter(r => isSummary(r) && isLatest(r));
    let dbContext = "=== LIVE GOOGLE SHEETS DATA (via Registry) ===\n\n";

    for (const row of summaryRows) {
      const sheetId = String(row[2] || '').trim(); // Column C = Spreadsheet_ID
      const tabName = String(row[4] || '').trim(); // Column E = Tab_Name
      if (!sheetId || !tabName) continue;
      try {
        const resp = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `${tabName}!A1:BZ200`,
        });
        dbContext += `--- ${row[0]} | ${tabName} ---\n`;
        (resp.data.values || []).forEach(r => { dbContext += r.join('\t') + '\n'; });
        dbContext += '\n';
      } catch (e) { console.warn(`Summary fetch failed: ${e.message}`); }
    }

    // ── Step 4: Fetch Details ONLY if user is asking study-level questions ────
    // Limit to 300 rows max to stay within token limits
    if (wantsStudyDetail) {
      const detailRows = allRows.filter(r => isDetails(r) && isLatest(r));
      // Only fetch the ONE latest forecaster details tab (most relevant)
      const fcDetail = detailRows.find(r => {
        const src = String(r[0] || '').toLowerCase();
        return src.includes('may') || src.includes('apr') || src.includes('forecast');
      }) || detailRows[0];

      if (fcDetail) {
        const sheetId = String(fcDetail[2] || '').trim();
        const tabName = String(fcDetail[4] || '').trim();
        if (sheetId && tabName) {
          try {
            const resp = await sheets.spreadsheets.values.get({
              spreadsheetId: sheetId,
              range: `${tabName}!A1:AB301`, // Max 300 data rows + header
            });
            const rows = resp.data.values || [];
            dbContext += `--- STUDY DETAIL: ${fcDetail[0]} | ${tabName} (${rows.length - 1} studies) ---\n`;
            dbContext += 'Columns: LID\tATOM\tProtocol\tSite\tStatus\tSubStatus\tSponsor\tCRO\tIndication\tTA\tActRando\tGoals\tTotalPts\tBPS\tCL\tFCV\tRev\tTotal2026\tActual2026\tH1\tH2\tQ1-Q4\tVax\tPriority\tPI\tLeadName\tActive\n';
            rows.forEach(r => { dbContext += r.join('\t') + '\n'; });
          } catch (e) { console.warn(`Details fetch failed: ${e.message}`); }
        }
      }
    }

    // ── Step 5: Send to Claude ────────────────────────────────────────────────
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: `You are the DM Clinical Revenue Intelligence Agent for DM Clinical Research.
You have LIVE Google Sheets data below fetched right now via the registry files.
NEVER say you don't have data. Answer with specific Lead IDs, ATOM numbers, exact dollar figures.
Format currency as $X.XM or $X.XK with 1 decimal place.
${system || ''}

${dbContext}`,
        messages,
      }),
    });

    const data = await anthropicResponse.json();
    if (!anthropicResponse.ok) return res.status(400).json({ error: data.error ? JSON.stringify(data.error) : 'Anthropic Error' });
    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
}
