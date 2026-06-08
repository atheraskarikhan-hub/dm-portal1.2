import fs from 'fs';
import path from 'path';

export const maxDuration = 60; // Prevents Vercel timeouts

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const { messages, system } = req.body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY environment variable is missing' });
    }

    // 1. Locate the data folder
    const dataDir = path.join(process.cwd(), 'data');
    let dbContext = "\n=== LIVE CLINICAL REVENUE DATASET ===\n\n";

    // 2. Dynamically read EVERY .csv file in the data folder
    if (fs.existsSync(dataDir)) {
      const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.csv'));
      
      for (const file of files) {
        const filePath = path.join(dataDir, file);
        const fileData = fs.readFileSync(filePath, 'utf8');
        // Add the file name as a header so Claude knows exactly what data it is looking at
        dbContext += `[FILE: ${file}]\n${fileData}\n\n`;
      }
    } else {
      dbContext += "Error: No data folder found on the server.";
    }

    // 3. Teach Claude your specific naming conventions
    const namingRules = `
CRITICAL NAMING CONVENTIONS TO REMEMBER:
- 'WF' in a filename means Waterfall data.
- 'FS' in a filename means Forecaster data.
- '4W' means Fourth Week (This is the LATEST data).
- '3W' means Third Week (This is the PREVIOUS data).
- 'MAY26' is the LATEST Forecaster data.
- 'APR26' is the PREVIOUS Forecaster data.
Compare these files accurately when asked about week-over-week or month-over-month changes.
`;

    // 4. Send the request directly to Anthropic
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: system + namingRules + "\nYou are an expert financial analyst. Use the provided raw CSV files to accurately compute calculations and answer any question at any level:\n" + dbContext,
        messages: messages,
      }),
    });

    const data = await anthropicResponse.json();
    if (!anthropicResponse.ok) return res.status(400).json({ error: data.error?.message || 'Anthropic Error' });

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
}