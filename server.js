const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// Serve static web app from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Server-to-Server Proxy Route for AI (Bypasses Browser CORS/Iframe Restrictions)
app.post('/api/chat', async (req, res) => {
  try {
    const { prompt, modelType } = req.body;
    
    // Choose specific AI system prompt based on feature
    let systemInstruction = "";
    if (modelType === 'solver') {
      systemInstruction = "Act as an AI Homework Solver using DeepSeek reasoning style. Do NOT give final answers immediately. Give a hint, explain the concept, and ask the student to attempt the next step.";
    } else {
      systemInstruction = "Act as an AI Socratic Tutor named Ultron powered by Qwen. Explain concepts simply using analogies, use HTML formatting (<b>, <br>, <ul>), and end with a quick practice question.";
    }

    const fullPrompt = `${systemInstruction}\n\nStudent question: ${prompt}`;
    
    // Server-to-server call to free AI API
    const aiResponse = await fetch(`https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}?model=openai`);
    
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
