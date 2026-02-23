import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import scrapeRouter from './routes/scrape';

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
  })
);
app.use(express.json());

// --- Routes ---
app.use('/api/scrape', scrapeRouter);

// --- Health check ---
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`\n🚀 Founder Studio API running on http://localhost:${PORT}`);
  console.log(`   POST /api/scrape — Scrape Instagram or Twitter/X posts`);
  console.log(`   GET  /health     — Health check\n`);
});
