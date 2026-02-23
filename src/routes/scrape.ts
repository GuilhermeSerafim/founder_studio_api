import { Router, Request, Response } from 'express';
import { scrape, detectPlatform } from '../scrapers';

const router = Router();

/**
 * POST /api/scrape
 * Body: { url: string }
 * Returns: { name, handle, profilePic, slides }
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { url } = req.body;

  // --- Validate input ---
  if (!url || typeof url !== 'string') {
    res.status(400).json({
      error: 'Missing or invalid "url" field. Please provide a valid URL string.',
    });
    return;
  }

  const platform = detectPlatform(url);
  if (!platform) {
    res.status(400).json({
      error:
        'Unsupported URL. Please provide a valid Instagram (instagram.com/p/...) or Twitter/X (x.com/.../status/...) post URL.',
    });
    return;
  }

  // --- Execute scrape ---
  try {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`[API] Scrape request received`);
    console.log(`[API] URL: ${url}`);
    console.log(`[API] Platform: ${platform}`);
    console.log(`${'='.repeat(50)}`);

    const startTime = Date.now();
    const result = await scrape(url);
    const elapsed = Date.now() - startTime;

    console.log(`[API] Scrape completed in ${elapsed}ms`);
    console.log(`[API] Result: ${result.name} (${result.handle}) — ${result.slides.length} slide(s)`);

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error(`[API] Scrape error: ${message}`);

    res.status(500).json({
      error: message,
    });
  }
});

export default router;
