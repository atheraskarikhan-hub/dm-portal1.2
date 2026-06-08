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
        model: 'claude-sonnet-4-6', // Your exact model
        max_tokens: 8192, // Increased budget for extended thinking
        thinking: { type: 'adaptive' }, // Enables the new thinking architecture
        output_config: { effort: 'medium' }, // Sets your explicit effort level
        system,
        messages,
      }),
    });
    
    const data = await response.json();

    // Safely catch Anthropic API errors so React doesn't white-screen
    if (!response.ok) {
       return res.status(400).json({ error: data.error?.message || 'Unknown Anthropic API Error' });
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}