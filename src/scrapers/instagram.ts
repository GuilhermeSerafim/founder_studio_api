import { chromium, Browser, Page } from 'playwright';
import { ScrapeResult } from './types';

/**
 * Scrape an Instagram post URL for profile info and caption/slides.
 */
export async function scrapeInstagram(url: string): Promise<ScrapeResult> {
  let browser: Browser | null = null;

  try {
    console.log(`[Instagram] Starting scrape for: ${url}`);

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();

    // Navigate and wait for content
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Wait for the main article/post container to appear
    await page.waitForSelector('article', { timeout: 10000 }).catch(() => {
      console.log('[Instagram] Article element not found, attempting fallback selectors...');
    });

    // Give a small extra delay for dynamic content
    await page.waitForTimeout(2000);

    // DEBUG
    await page.screenshot({ path: 'debug-ig.png' });
    const html = await page.content();
    require('fs').writeFileSync('debug-ig.html', html);

    // --- Extract profile info ---
    const profileData = await extractProfileData(page);

    // --- Extract caption / slides ---
    const slides = await extractSlides(page);

    console.log(`[Instagram] Scrape complete. Found ${slides.length} slide(s).`);

    return {
      name: profileData.name,
      handle: profileData.handle,
      profilePic: profileData.profilePic,
      slides,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Instagram] Scrape failed: ${message}`);
    throw new Error(`Failed to scrape Instagram post: ${message}`);
  } finally {
    if (browser) await browser.close();
  }
}

async function extractProfileData(page: Page) {
  let name = '';
  let handle = '';
  let profilePic = '';

  try {
    // Try to extract the handle from the header link
    handle = await page.evaluate(() => {
      // Look for the username link in the post header
      const headerLink = document.querySelector('article header a[href]');
      if (headerLink) {
        const href = headerLink.getAttribute('href') || '';
        const match = href.match(/^\/([^/]+)\/?$/);
        if (match) return `@${match[1]}`;
      }

      // Fallback: look for any link with the username pattern
      const links = document.querySelectorAll('a[href^="/"]');
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        if (href.match(/^\/[a-zA-Z0-9_.]+\/?$/) && !href.includes('/p/') && !href.includes('/explore/')) {
          return `@${href.replace(/\//g, '')}`;
        }
      }
      return '';
    });

    // Extract display name (often the same as handle on Instagram)
    name = await page.evaluate(() => {
      // The display name is usually in a header span or link
      const headerLink = document.querySelector('article header a[href] span');
      if (headerLink?.textContent) return headerLink.textContent.trim();

      // Fallback to meta tags
      const metaTitle = document.querySelector('meta[property="og:title"]');
      if (metaTitle) {
        const content = metaTitle.getAttribute('content') || '';
        // Format: "Username on Instagram: caption..."
        const match = content.match(/^(.+?)\s+on\s+Instagram/i);
        if (match) return match[1];
      }
      return '';
    });

    // If name is empty, use handle without @
    if (!name && handle) {
      name = handle.replace('@', '');
    }

    // Extract profile picture URL
    profilePic = await page.evaluate(() => {
      // 1. Best approach: Instagram uses a specific button or link for the story/profile pic in the header.
      // Easiest reliable way is to look for an image where alt contains "profile" OR the title is "profile picture"
      const allImgs = document.querySelectorAll('img');
      for (const img of allImgs) {
         // Profile pics usually have alt="<username>'s profile picture"
        const alt = (img.getAttribute('alt') || '').toLowerCase();
        if (alt.includes('profile picture') || alt.includes('foto do perfil')) {
          // Instagram profile pics are often standard size like 150x150, but we just grab the src
          return img.getAttribute('src') || '';
        }
      }

      // 2. Fallback: getting the first image inside the header
      const headerImg = document.querySelector('header img');
      if (headerImg) return headerImg.getAttribute('src') || '';

      return '';
    });
  } catch (err) {
    console.log('[Instagram] Warning: Could not extract some profile data.');
  }

  return { name, handle, profilePic };
}

async function extractSlides(page: Page): Promise<string[]> {
  const slides: string[] = [];

  try {
    // First, extract the main caption
    const mainCaption = await page.evaluate(() => {
      // Look for the caption in the post content
      const captionSelectors = [
        'article div > ul > div span',  // Direct caption
        'article h1',                     // Some layouts use h1
        'article span[dir="auto"]',       // RTL/LTR text spans
      ];

      for (const sel of captionSelectors) {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim()) {
          return el.textContent.trim();
        }
      }

      // Fallback: OG description
      const metaDesc = document.querySelector('meta[property="og:description"]');
      if (metaDesc) {
        const content = metaDesc.getAttribute('content') || '';
        // Format: "N Likes, N Comments - username on Instagram: \"caption\""
        const match = content.match(/"(.+)"$/);
        if (match) return match[1];
        return content;
      }

      return '';
    });

    if (mainCaption) {
      slides.push(mainCaption);
    }

    // Check if this is a carousel — look for the "next" button
    const hasCarousel = await page.$('button[aria-label="Next"], button[aria-label="Próximo"], div[role="presentation"] button:has(svg)');

    if (hasCarousel) {
      console.log('[Instagram] Carousel detected. Navigating slides...');
      // Try clicking through carousel slides and extracting text
      let clickCount = 0;
      const maxClicks = 10; // Safety limit

      while (clickCount < maxClicks) {
        const nextButton = await page.$('button[aria-label="Next"], button[aria-label="Próximo"]');
        if (!nextButton) break;

        await nextButton.click();
        await page.waitForTimeout(800); // Wait for slide transition

        // Extract text from the current slide (carousel alt text or overlay text)
        const slideText = await page.evaluate(() => {
          // Look for alt text on the current visible image
          const images = document.querySelectorAll('article img[alt]');
          const lastImg = images[images.length - 1];
          if (lastImg) {
            const alt = lastImg.getAttribute('alt') || '';
            // Instagram generates alt text; skip generic ones
            if (alt && !alt.startsWith('Photo by') && !alt.startsWith('Photo shared')) {
              return alt;
            }
          }
          return '';
        });

        if (slideText && !slides.includes(slideText)) {
          slides.push(slideText);
        }

        clickCount++;
      }
    }
  } catch (err) {
    console.log('[Instagram] Warning: Could not extract all slide data.');
  }

  // If we got nothing, add a placeholder
  if (slides.length === 0) {
    slides.push('');
  }

  return slides;
}
