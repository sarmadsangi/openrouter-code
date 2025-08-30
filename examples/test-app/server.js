const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/contact', (req, res) => {
  const { name, email, message } = req.body;
  
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  // Simulate processing
  setTimeout(() => {
    res.json({ 
      success: true, 
      message: 'Thank you for your message! We will get back to you soon.' 
    });
  }, 1000);
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Test app running on http://localhost:${PORT}`);
});