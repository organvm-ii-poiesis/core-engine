import { Router } from 'express';
import { architect } from '../orchestrator/architect.js';

const router = Router();

// Ask the Architect
router.post('/ask', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query required' });

  try {
    const answer = await architect.ask(query);
    res.json({ answer });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Feed the Architect (Ingest)
router.post('/memorize', async (req, res) => {
  const { content, source } = req.body;
  if (!content || !source) return res.status(400).json({ error: 'Content and source required' });

  try {
    await architect.memorize(content, { source });
    res.json({ status: 'memorized' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
