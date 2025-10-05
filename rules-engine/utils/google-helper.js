// google-helper.js - Google Custom Search API helper for image fetching
import dotenv from 'dotenv';
import sharp from 'sharp';
dotenv.config({ path: '../.env' });

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CX_ID = process.env.GOOGLE_CX_ID;

/**
 * Search for product images using Google Custom Search
 * @param {string} productName - Product name
 * @param {string} manufacturer - Manufacturer name
 * @returns {Promise<string[]>} Array of image URLs
 */
export async function searchProductImage(productName, manufacturer) {
  if (!GOOGLE_API_KEY || !GOOGLE_CX_ID) {
    throw new Error('Google API credentials not configured');
  }

  const query = `${manufacturer} ${productName}`.trim();
  const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX_ID}&q=${encodeURIComponent(query)}&searchType=image&num=8`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Google API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return [];
    }

    return data.items.map(item => item.link);
  } catch (error) {
    console.error('Google image search failed:', error);
    throw error;
  }
}

/**
 * Analyze image to calculate white background percentage
 * Uses sharp library for image processing
 * @param {string} imageUrl - Image URL to analyze
 * @returns {Promise<number>} Percentage of white background (0-100)
 */
export async function analyzeImageBackground(imageUrl) {
  try {
    // Fetch image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process with sharp
    const { data, info } = await sharp(buffer)
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Calculate white pixels (RGB values close to 255)
    const threshold = 240; // Consider pixels with RGB > 240 as white
    let whitePixels = 0;
    const totalPixels = info.width * info.height;
    const channels = info.channels;

    for (let i = 0; i < data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (r >= threshold && g >= threshold && b >= threshold) {
        whitePixels++;
      }
    }

    return (whitePixels / totalPixels) * 100;
  } catch (error) {
    console.error('Image analysis failed:', error);
    // Return 0 if analysis fails so image won't be selected
    return 0;
  }
}

export default {
  searchProductImage,
  analyzeImageBackground
};
