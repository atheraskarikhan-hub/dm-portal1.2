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

    // ── Auth (supports both credential styles) ────────────────────────────────
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
      return res.status(500).json({ error: 'Missing Google credentials in environment variables.' });
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // ── Step 1: Read both Registries ─────────────────────────────────────────
    // Registry columns: A=Date, B=Latest/Previous/Old, C=Spreadsheet_ID, D=Notes, E=Tab_Name, F=Data_Type
    const [fcReg, wfReg] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: '1B7m7DOSLCXj9vMHTwuXAjLVkuw0i3f0aUrbYweAj6xU', range: 'A:F' }),
      sheets.spreadsheets.values.get({ spreadsheetId: '169w2PQ22gt1ItcQTOXQP-F9XHVocY17OLv3fzoA1_3E', range: 'A:F' }),
    ]);

    const parseReg = r => r.data.values ? r.data.values.slice(1) : [];
    const fcRows = parseReg(fcReg);
    const wfRows = parseReg(wfReg);
    const allRows = [...fcRows, ...wfRows];

    const cl = v => String(v || '').trim().toLowerCase();
    const isLatest  = r => cl(r[1]) === 'latest';
    const isSummary = r => cl(r[5]) === 'summary';
    const isDetails = r => cl(r[5]) === 'details';

    // ── Step 2: Identify which tabs to fetch ──────────────────────────────────
    // Always fetch Latest Summary tabs (for financial overview)
    const summaryTabs = allRows.filter(r => isSummary(r) && isLatest(r));

    // Always fetch Latest Details tabs (for study/lead-level queries)
    const detailTabs  = allRows.filter(r => isDetails(r) && isLatest(r));

    // ── Step 3: Fetch all tabs in parallel ────────────────────────────────────
    const fetchTab = async (row, rangeOverride) => {
      const sheetId = String(row[2] || '').trim(); // ✅ Column C = Spreadsheet_ID
      const tabName = String(row[4] || '').trim(); // ✅ Column E = Tab_Name
      const date    = String(row[0] || '');
      const dtype   = String(row[5] || '');
      if (!sheetId || !tabName) return null;
      try {
        const range = rangeOverride || `${tabName}!A1:Z200`;
        const resp = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range,
        });
        return { date, tabName, dtype, rows: resp.data.values || [] };
      } catch (e) {
        console.warn(`Failed ${tabName} from ${sheetId}: ${e.message}`);
        return null;
      }
    };

    // Fetch summaries (A1:Z200) and details (A1:AZ3000 for full study list)
    const [summaryResults, detailResults] = await Promise.all([
      Promise.all(summaryTabs.map(r => fetchTab(r))),
      Promise.all(detailTabs.map(r => fetchTab(r, `${String(r[4]).trim()}!A1:AZ3000`))),
    ]);

    // ── Step 4: Build context string for Claude ───────────────────────────────
    let dbContext = "=== LIVE DATA FROM GOOGLE SHEETS (via Registry) ===\n";
    dbContext += `Fetched: ${new Date().toISOString()}\n\n`;

    // Add summary data
    dbContext += "--- SUMMARY / FINANCIAL DATA ---\n";
    for (const result of summaryResults) {
      if (!result || !result.rows.length) continue;
      dbContext += `\n[${result.date} | ${result.tabName}]\n`;
      result.rows.forEach(r => { dbContext += r.join('\t') + '\n'; });
    }

    // Add detail/study-level data
    dbContext += "\n--- STUDY & LEAD LEVEL DETAIL DATA ---\n";
    dbContext += "Columns: LID, ATOM, Protocol, Site, Status, SubStatus, Sponsor, CRO, Indication, TA, ActRando, Goals, TotalPts, BPS, CL, FCV, Rev, Total2026, Actual2026, H1, H2, Q1-Q4, Vax, Priority, PI, LeadName, Active, Monthly\n\n";
    for (const result of detailResults) {
      if (!result || !result.rows.length) continue;
      dbContext += `[${result.date} | ${result.tabName}]\n`;
      result.rows.forEach(r => { dbContext += r.join('\t') + '\n'; });
    }

    // ── Step 5: Call Claude with full live context ────────────────────────────
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: `You are the DM Clinical Revenue Intelligence Agent for DM Clinical Research.
You have DIRECT ACCESS to live Google Sheets data fetched right now via the registry files.
NEVER say you don't have data — all data is in this system prompt.
Answer with specific Lead IDs, ATOM numbers, and exact dollar figures from the data below.
Format currency as $X.XM or $X.XK with 1 decimal place.
${system || ''}

${dbContext}`,
        messages,
      }),
    });

    const data = await anthropicResponse.json();
    if (!anthropicResponse.ok) return res.status(400).json({ error: data.error ? JSON.stringify(data.error) : 'Anthropic API Error' });
    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
}
