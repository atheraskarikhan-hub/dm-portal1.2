import { google } from 'googleapis';

export const maxDuration = 60; 

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const { messages, system } = req.body;

    if (!process.env.ANTHROPIC_API_KEY || !process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return res.status(500).json({ error: 'Missing API Keys or Google Credentials in Vercel environment variables.' });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), 
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch both Registries
    const fcReg = await sheets.spreadsheets.values.get({ spreadsheetId: '1B7m7DOSLCXj9vMHTwuXAjLVkuw0i3f0aUrbYweAj6xU', range: 'A:F' });
    const wfReg = await sheets.spreadsheets.values.get({ spreadsheetId: '169w2PQ22gt1ItcQTOXQP-F9XHVocY17OLv3fzoA1_3E', range: 'A:F' });

    const parseRegistry = (response) => response.data.values ? response.data.values.slice(1) : []; 
    const allRegistryRows = [...parseRegistry(fcReg), ...parseRegistry(wfReg)];

    // Traffic Cop: Filter for "Summary" tabs only
    const summaryTabs = allRegistryRows.filter(row => row[5] && row[5].trim().toLowerCase() === 'summary');

    let dbContext = "\n=== LIVE CLINICAL REVENUE DATASET ===\n\n";

    for (const row of summaryTabs) {
      const sheetId = row[3];
      const tabName = row[4];
      if (!sheetId || !tabName) continue;

      try {
        const sheetData = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId.trim(),
          range: `${tabName.trim()}!A1:Z200` 
        });
        
        dbContext += `\n[SOURCE: ${row[0]} | TAB: ${tabName}]\n`;
        if (sheetData.data.values) {
          sheetData.data.values.forEach(r => { dbContext += r.join(', ') + '\n'; });
        }
      } catch (e) {
        console.log(`Failed to fetch ${tabName} from ${sheetId}: ${e.message}`);
      }
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
        system: system + "\nYou are an expert financial analyst. Answer using ONLY this live Google Sheet data:\n" + dbContext,
        messages: messages,
      }),
    });

    const data = await anthropicResponse.json();
    if (!anthropicResponse.ok) return res.status(400).json({ error: data.error ? JSON.stringify(data.error) : 'Anthropic Error' });

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
}