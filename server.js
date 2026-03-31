import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Health check endpoint for Coolify
app.get('/health', (req, res) => {
  console.log('Health check received');
  res.status(200).send('OK');
});

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for React SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Production server running on http://0.0.0.0:${port}`);
});
