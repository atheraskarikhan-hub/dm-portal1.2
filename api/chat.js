import { google } from 'googleapis';

export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const { messages, system, studies, sdMetrics } = req.body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY.' });
    }

    // Use GOOGLE_CREDENTIALS_JSON (same as dashboard) with fallback to split keys
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

    // Fetch both Registries
    const [fcReg, wfReg] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: '1B7m7DOSLCXj9vMHTwuXAjLVkuw0i3f0aUrbYweAj6xU', range: 'A:F' }),
      sheets.spreadsheets.values.get({ spreadsheetId: '169w2PQ22gt1ItcQTOXQP-F9XHVocY17OLv3fzoA1_3E', range: 'A:F' }),
    ]);

    const parseReg = r => r.data.values ? r.data.values.slice(1) : [];
    const allRows  = [...parseReg(fcReg), ...parseReg(wfReg)];

    // col C (index 2) = Spreadsheet_ID, col E (index 4) = Tab_Name, col F (index 5) = Data_Type
    // Only fetch Summary tabs that are "Latest"
    const summaryTabs = allRows.filter(row =>
      row[5] && row[5].trim().toLowerCase() === 'summary' &&
      row[1] && row[1].trim().toLowerCase() === 'latest'
    );

    let dbContext = "\n=== LIVE CLINICAL REVENUE DATASET ===\n";
    dbContext += `As of: ${summaryTabs[0]?.[0] || 'Current Period'}\n\n`;

    for (const row of summaryTabs) {
      const sheetId = (row[2] || '').trim();   // ✅ Column C = Spreadsheet_ID
      const tabName = (row[4] || '').trim();   // ✅ Column E = Tab_Name
      if (!sheetId || !tabName) continue;

      try {
        const sheetData = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `${tabName}!A1:Z200`,
        });
        dbContext += `\n--- SOURCE: ${row[0]} | TAB: ${tabName} ---\n`;
        if (sheetData.data.values) {
          sheetData.data.values.forEach(r => { dbContext += r.join('\t') + '\n'; });
        }
      } catch (e) {
        console.warn(`Failed to fetch ${tabName} from ${sheetId}: ${e.message}`);
      }
    }

    // Also inject the already-loaded study list from the frontend (fast, no extra API call)
    if (studies && studies.length) {
      dbContext += `\n\n--- STUDY DATABASE (${studies.length} studies loaded) ---\n`;
      dbContext += 'LID\tProtocol\tSite\tStatus\tSponsor\tCRO\tIndication\tVax\tFCV\tRev2026\tTotal2026\tActual2026\n';
      studies.slice(0, 500).forEach(s => {
        dbContext += `${s.lid}\t${s.protocol}\t${s.site}\t${s.status}\t${s.sponsor}\t${s.cro}\t${s.indication}\t${s.vax}\t${s.fcv}\t${s.rev}\t${s.total2026}\t${s.actual2026}\n`;
      });
    }

    // Inject top-level metrics summary
    if (sdMetrics) {
      dbContext += `\n\n--- KEY METRICS SUMMARY ---\n`;
      dbContext += `Grand Total 2026 Forecast: $${(sdMetrics.fc?.grand || 0).toLocaleString()}\n`;
      dbContext += `YTD Actual: $${(sdMetrics.fc?.ytd || 0).toLocaleString()}\n`;
      dbContext += `Baseline Target: $${(sdMetrics.baseline || 85000000).toLocaleString()}\n`;
      dbContext += `Total Studies: ${sdMetrics.counts?.grand || 0}\n`;
      dbContext += `Vaccine Studies: ${sdMetrics.counts?.vaxTotal || 0}\n`;
      dbContext += `Non-Vaccine Studies: ${sdMetrics.counts?.nvaxTotal || 0}\n`;
      dbContext += `H1 Waterfall: $${(sdMetrics.wf?.h1 || 0).toLocaleString()}\n`;
      dbContext += `H2 Waterfall: $${(sdMetrics.wf?.h2 || 0).toLocaleString()}\n`;
    }

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
You have DIRECT ACCESS to live Google Sheets data injected below. 
NEVER say you don't have data — the data is in this system prompt.
Answer concisely and use specific numbers from the data.
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
