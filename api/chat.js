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

    if (fs.existsSync(dataDir)) {
      const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.csv'));
      
      for (const file of files) {
        const filePath = path.join(dataDir, file);
        const stats = fs.statSync(filePath);
        
        // Safety filter to prevent payload crashes
        if (stats.size > 800000) continue; 

        const fileData = fs.readFileSync(filePath, 'utf8');
        dbContext += `[FILE: ${file}]\n${fileData}\n\n`;
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
        model: 'claude-3-haiku-20240307', // <-- Changed to Haiku (Unlocked for all tiers)
        max_tokens: 4096,
        system: system + namingRules + "\nYou are an expert financial analyst. Use the provided raw CSV files to accurately compute calculations:\n" + dbContext,
        messages: messages,
      }),
    });

    const data = await anthropicResponse.json();
    
    // NEW: We now stringify the entire error object so Anthropic can't hide the real reason!
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