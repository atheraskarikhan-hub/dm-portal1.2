// 1. Force Vercel to wait up to 60 seconds instead of the default 10 seconds
export const maxDuration = 60; 

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const { messages, system } = req.body;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', 
        max_tokens: 4096, // Reduced slightly to prevent it from rambling past the 60s limit
        thinking: { type: 'adaptive' }, 
        output_config: { effort: 'low' }, // 2. Lowered effort so the AI answers much faster
        system,
        messages,
      }),
    });
    
    const data = await response.json();

    if (!response.ok) {
       return res.status(400).json({ error: data.error?.message || 'Unknown Anthropic API Error' });
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}