import fs from 'fs';
import path from 'path';

export const maxDuration = 60; 

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const { messages, system } = req.body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY environment variable is missing' });
    }

    const dataDir = path.join(process.cwd(), 'data');
    let dbContext = "\n=== LIVE CLINICAL REVENUE DATASET ===\n\n";
    let totalPayloadSize = 0;

    if (fs.existsSync(dataDir)) {
      const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.csv'));
      
      for (const file of files) {
        const filePath = path.join(dataDir, file);
        const stats = fs.statSync(filePath);
        
        // SAFETY FILTER: Skip any file larger than 800 KB (800,000 bytes)
        // This prevents the "Request exceeds maximum size" crash.
        if (stats.size > 800000) {
          console.warn(`Skipping ${file} - File is too large for AI context window.`);
          continue; 
        }

        const fileData = fs.readFileSync(filePath, 'utf8');
        dbContext += `[FILE: ${file}]\n${fileData}\n\n`;
        totalPayloadSize += stats.size;
      }
    } else {
      dbContext += "Error: No data folder found on the server.";
    }

    const namingRules = `
CRITICAL NAMING CONVENTIONS TO REMEMBER:
- 'WF' means Waterfall data.
- 'FS' means Forecaster data.
- '4W' means Fourth Week (LATEST).
- '3W' means Third Week (PREVIOUS).
- 'MAY26' is LATEST Forecaster.
- 'APR26' is PREVIOUS Forecaster.
- You are only looking at SUMMARY files. If the user asks for highly granular lead-level data that is missing, politely explain you only have summary-level access right now.
`;

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 4096,
        system: system + namingRules + "\nYou are an expert financial analyst. Use the provided raw CSV files to accurately compute calculations:\n" + dbContext,
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