const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// Serve static web app from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Server-to-Server Proxy Route for Groq AI
app.post('/api/chat', async (req, res) => {
  try {
    const { prompt, modelType } = req.body;
    
    let systemInstruction = "";
    if (modelType === 'solver') {
      systemInstruction = "Act as an AI Homework Solver. Do NOT give final answers immediately. Give a hint, explain the concept step-by-step, and ask the student to attempt the next logical step. Format beautifully with HTML (<br>, <b>, <ul>).";
    } else {
      systemInstruction = "Act as an AI Socratic Tutor named Ultron. Explain concepts simply using real-world analogies. Use HTML formatting (<b>, <br>, <ul>), and end your response with a quick practice question.";
    }

    // Call Groq API endpoint
    const aiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer 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' 
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ]
      })
    });
    
    if (!aiResponse.ok) {
      throw new Error("Groq API network error");
    }

    const data = await aiResponse.json();
    const text = data.choices[0].message.content;
    
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
