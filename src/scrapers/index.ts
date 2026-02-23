import { ScrapeResult } from './types';
import { scrapeInstagram } from './instagram';
import { scrapeTwitter } from './twitter';

export type Platform = 'instagram' | 'twitter';

/**
 * Detect the platform from a URL.
 */
export function detectPlatform(url: string): Platform | null {
  if (/instagram\.com/i.test(url)) return 'instagram';
  if (/twitter\.com/i.test(url) || /x\.com/i.test(url)) return 'twitter';
  return null;
}

/**
 * Dispatch a scrape request to the correct platform scraper.
 */
export async function scrape(url: string): Promise<ScrapeResult> {
  const platform = detectPlatform(url);

  if (!platform) {
    throw new Error(
      'Unsupported URL. Please provide a valid Instagram or Twitter/X post URL.'
    );
  }

  console.log(`[Scraper] Platform detected: ${platform}`);

  switch (platform) {
    case 'instagram':
      return scrapeInstagram(url);
    case 'twitter':
      return scrapeTwitter(url);
  }
}

export type { ScrapeResult };
