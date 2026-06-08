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
    
    let currentTokenEstimate = 0;
    const MAX_ALLOWED_CHARACTERS = 120000; // Hard stop to stay safely under the 50k token limit

    if (fs.existsSync(dataDir)) {
      // Get all CSV files and sort them smallest-to-largest so summary files get processed first!
      const files = fs.readdirSync(dataDir)
        .filter(file => file.endsWith('.csv'))
        .map(file => ({
          name: file,
          path: path.join(dataDir, file),
          size: fs.statSync(path.join(dataDir, file)).size
        }))
        .sort((a, b) => a.size - b.size);
      
      for (const file of files) {
        // If adding this file risks breaking the 50k token limit, skip it
        if (dbContext.length + file.size > MAX_ALLOWED_CHARACTERS) {
          console.log(`[Token Guard] Skipped ${file.name} to prevent exceeding rate limit.`);
          continue; 
        }

        const fileData = fs.readFileSync(file.path, 'utf8');
        dbContext += `[FILE: ${file.name}]\n${fileData}\n\n`;
        console.log(`[Token Guard] Successfully included ${file.name} (${file.size} bytes)`);
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
`;

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
        system: system + namingRules + "\nYou are an expert financial analyst. Use the provided raw CSV files to accurately compute calculations:\n" + dbContext,
        messages: messages,
      }),
    });

    const data = await anthropicResponse.json();
    
    if (!anthropicResponse.ok) {
      return res.status(400).json({ 
        error: data.error ? JSON.stringify(data.error) : 'Unknown Anthropic Error' 
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
}