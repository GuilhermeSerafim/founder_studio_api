import { scrapeInstagram } from './src/scrapers/instagram';

async function test() {
  const url = 'https://www.instagram.com/p/C_m3N91J12Y/'; // or any public post
  try {
    const res = await scrapeInstagram(url);
    console.log('Result:', res);
  } catch (err) {
    console.error(err);
  }
}

test();
