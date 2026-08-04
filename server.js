const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// Serve static web app from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Server-to-Server Proxy Route for AI
app.post('/api/chat', async (req, res) => {
  try {
    const { prompt, modelType } = req.body;
    
    let systemInstruction = "";
    if (modelType === 'solver') {
      systemInstruction = "Act as an AI Homework Solver. Do NOT give final answers immediately. Give a hint, explain the concept, and ask the student to attempt the next step. Format beautifully with HTML.";
    } else {
      systemInstruction = "Act as an AI Socratic Tutor named Ultron. Explain concepts simply using analogies, use HTML formatting (<b>, <br>, <ul>), and end with a quick practice question.";
    }

    // Using a robust POST request to avoid URL length limits
    const aiResponse = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ],
        model: 'openai' // Most stable free model backend
      })
    });
    
    if (!aiResponse.ok) {
      throw new Error("AI provider network error");
    }

    const text = await aiResponse.text();
    res.json({ success: true, reply: text });

  } catch (error) {
    console.error("AI Proxy Error:", error);
    res.status(500).json({ 
      success: false, 
      reply: "Ultron AI engine is temporarily re-routing. Please try sending your question again." 
    });
  }
});

// Fallback to index.html for single page routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Ultron AI Tutor running live on port ${PORT}`);
});
