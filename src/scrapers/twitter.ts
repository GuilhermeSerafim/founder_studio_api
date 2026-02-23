import { chromium, Browser, Page } from 'playwright';
import { ScrapeResult } from './types';

/**
 * Scrape a Twitter/X post URL for profile info and tweet text.
 */
export async function scrapeTwitter(url: string): Promise<ScrapeResult> {
  let browser: Browser | null = null;

  try {
    console.log(`[Twitter] Starting scrape for: ${url}`);

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();

    // Navigate to the tweet
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Wait for the tweet article to load
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 }).catch(() => {
      console.log('[Twitter] Tweet article not found with data-testid, trying fallback...');
    });

    // Extra wait for dynamic content (React hydration)
    await page.waitForTimeout(2500);

    // --- Extract profile info ---
    const profileData = await extractTwitterProfile(page);

    // --- Extract tweet text / thread ---
    const slides = await extractTweetText(page, url);

    console.log(`[Twitter] Scrape complete. Found ${slides.length} tweet(s).`);

    return {
      name: profileData.name,
      handle: profileData.handle,
      profilePic: profileData.profilePic,
      slides,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Twitter] Scrape failed: ${message}`);
    throw new Error(`Failed to scrape Twitter post: ${message}`);
  } finally {
    if (browser) await browser.close();
  }
}

async function extractTwitterProfile(page: Page) {
  let name = '';
  let handle = '';
  let profilePic = '';

  try {
    // Extract from the first tweet article (the main tweet)
    const data = await page.evaluate(() => {
      const article = document.querySelector('article[data-testid="tweet"]');
      if (!article) return { name: '', handle: '', profilePic: '' };

      // Display name: the first link with dir="ltr" inside the user's name area
      let extractedName = '';
      const userNameEl = article.querySelector('div[data-testid="User-Name"]');
      if (userNameEl) {
        // The name is typically the first text span
        const nameSpans = userNameEl.querySelectorAll('span');
        for (const span of nameSpans) {
          const text = span.textContent?.trim();
          if (text && !text.startsWith('@') && text.length > 0 && text !== '·' && !text.includes('Verified')) {
            extractedName = text;
            break;
          }
        }

        // Handle: look for the @username span
        const allSpans = userNameEl.querySelectorAll('span');
        for (const span of allSpans) {
          const text = span.textContent?.trim();
          if (text?.startsWith('@')) {
            return {
              name: extractedName,
              handle: text,
              profilePic: '',
            };
          }
        }
      }

      return { name: extractedName, handle: '', profilePic: '' };
    });

    name = data.name;
    handle = data.handle;

    // Profile picture — get the avatar image
    profilePic = await page.evaluate(() => {
      const article = document.querySelector('article[data-testid="tweet"]');
      if (!article) return '';

      const avatarImg = article.querySelector('div[data-testid="Tweet-User-Avatar"] img[src]');
      if (avatarImg) return avatarImg.getAttribute('src') || '';

      // Fallback: any small circular image in the article header
      const imgs = article.querySelectorAll('img[src*="profile_images"]');
      if (imgs.length > 0) return imgs[0].getAttribute('src') || '';

      return '';
    });

    // Fallback for handle from URL
    if (!handle) {
      const urlMatch = page.url().match(/(?:twitter\.com|x\.com)\/([^/]+)/);
      if (urlMatch) handle = `@${urlMatch[1]}`;
    }

    // Fallback for name
    if (!name && handle) {
      name = handle.replace('@', '');
    }
  } catch (err) {
    console.log('[Twitter] Warning: Could not extract some profile data.');
  }

  return { name, handle, profilePic };
}

async function extractTweetText(page: Page, originalUrl: string): Promise<string[]> {
  const slides: string[] = [];

  try {
    // Extract the text from the main tweet (not replies)
    const tweetTexts = await page.evaluate((origUrl: string) => {
      const articles = document.querySelectorAll('article[data-testid="tweet"]');
      const texts: string[] = [];

      // Extract the username from the original URL to identify the thread author
      const urlMatch = origUrl.match(/(?:twitter\.com|x\.com)\/([^/]+)/);
      const authorHandle = urlMatch ? urlMatch[1].toLowerCase() : '';

      for (const article of articles) {
        // Check if this tweet is from the same author (thread vs reply)
        const userNameEl = article.querySelector('div[data-testid="User-Name"]');
        if (userNameEl && authorHandle) {
          const handleSpans = userNameEl.querySelectorAll('span');
          let isAuthor = false;
          for (const span of handleSpans) {
            const text = span.textContent?.trim()?.toLowerCase();
            if (text === `@${authorHandle}`) {
              isAuthor = true;
              break;
            }
          }
          if (!isAuthor) continue; // Skip replies from other people
        }

        // Get the tweet text
        const tweetTextEl = article.querySelector('div[data-testid="tweetText"]');
        if (tweetTextEl?.textContent?.trim()) {
          texts.push(tweetTextEl.textContent.trim());
        }
      }

      return texts;
    }, originalUrl);

    slides.push(...tweetTexts);
  } catch (err) {
    console.log('[Twitter] Warning: Could not extract tweet text.');
  }

  if (slides.length === 0) {
    // Fallback: try OG description
    const ogDesc = await page.evaluate(() => {
      const meta = document.querySelector('meta[property="og:description"]');
      return meta?.getAttribute('content')?.trim() || '';
    });
    if (ogDesc) slides.push(ogDesc);
    else slides.push('');
  }

  return slides;
}
