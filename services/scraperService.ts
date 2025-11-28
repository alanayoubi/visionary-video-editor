
import { blobToBase64 } from '../utils';

const CORS_PROXY = "https://corsproxy.io/?";

/**
 * Attempts to scrape the raw MP4 video file from a public Loom share URL.
 * It uses a CORS proxy to fetch the HTML, then uses multiple strategies 
 * (Regex, JSON-LD, Next.js Data) to find the video URL.
 */
export const fetchLoomVideo = async (loomUrl: string): Promise<{ base64: string; mimeType: string; filename: string }> => {
  try {
    // 1. Fetch the HTML page via proxy
    const encodedUrl = encodeURIComponent(loomUrl);
    const htmlResponse = await fetch(`${CORS_PROXY}${encodedUrl}`);
    
    if (!htmlResponse.ok) {
      throw new Error(`Failed to fetch Loom page source. Status: ${htmlResponse.status}`);
    }

    const html = await htmlResponse.text();

    if (html.length < 1000) {
        console.warn("Loom HTML response is very short.", html);
    }

    let videoUrl: string | null = null;
    let videoName = "loom_video";

    // --- STRATEGY 1: Open Graph Tags (Standard Metadata) ---
    // Many sites expose the video file in og:video or og:video:secure_url
    if (!videoUrl) {
       const ogVideoRegex = /<meta\s+property="og:video(:secure_url)?"\s+content="([^"]+)"/i;
       const ogMatch = html.match(ogVideoRegex);
       if (ogMatch && ogMatch[2].endsWith('.mp4')) {
           videoUrl = ogMatch[2];
           console.log("Found via OpenGraph");
       }
    }

    // --- STRATEGY 2: Brute Force Regex for Loom CDN URLs ---
    if (!videoUrl) {
      const cdnRegex = /https:\/\/cdn\.loom\.com\/sessions\/[a-zA-Z0-9-_]+\/[a-zA-Z0-9-_]+\.mp4/gi;
      const cdnMatches = html.match(cdnRegex);
      if (cdnMatches && cdnMatches.length > 0) {
          videoUrl = cdnMatches[0];
          console.log("Found via CDN Regex");
      }
    }

    // --- STRATEGY 3: Preloaded Session Data (Specific to Loom) ---
    // Loom often dumps the session data into a window variable
    if (!videoUrl) {
        const preloadedRegex = /"contentUrl":"([^"]+\.mp4)"/i;
        const preloadedMatch = html.match(preloadedRegex);
        if (preloadedMatch) {
            videoUrl = preloadedMatch[1].replace(/\\u002F/g, "/"); // Fix escaped slashes
            console.log("Found via Preloaded Data");
        }
    }

    // --- STRATEGY 4: Generic MP4 Regex (Last Resort) ---
    if (!videoUrl) {
        const genericMp4Regex = /https?:\/\/[^"'\s<>]+\.mp4/gi;
        const mp4Matches = html.match(genericMp4Regex);
        if (mp4Matches) {
            const bestMatch = mp4Matches.find(url => url.includes('transcoded') || url.includes('sessions')) || mp4Matches[0];
            videoUrl = bestMatch;
            console.log("Found via Generic Regex");
        }
    }
    
    if (!videoUrl) {
      // Create a snippet of the HTML for debugging (in console)
      console.log("Failed Scrape HTML Snippet:", html.substring(0, 500) + "...");
      throw new Error("Could not find video file URL (contentUrl) in page metadata.");
    }

    console.log("Found Loom Video URL:", videoUrl);

    // 4. Fetch the actual MP4 file
    let blob: Blob;
    try {
        const directResponse = await fetch(videoUrl);
        if (directResponse.ok) {
            blob = await directResponse.blob();
        } else {
            throw new Error("Direct fetch failed");
        }
    } catch (e) {
        // Fallback to proxy
        const proxyVideoResponse = await fetch(`${CORS_PROXY}${encodeURIComponent(videoUrl)}`);
        if (!proxyVideoResponse.ok) {
            throw new Error("Failed to download video file via proxy.");
        }
        blob = await proxyVideoResponse.blob();
    }

    const base64 = await blobToBase64(blob);

    return {
      base64,
      mimeType: blob.type || 'video/mp4',
      filename: `${videoName}.mp4`
    };

  } catch (error: any) {
    console.error("Loom Scrape Error:", error);
    throw new Error(`Direct Import Failed. Loom security prevented the download. Please use the 'Start Capture' button instead.`);
  }
};
