import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

app.get('/api/proxy-image', async (req, res) => {
  const url = req.query.url as string;
  if (!url) {
    return res.status(400).send('url parameter is required');
  }

  try {
    const decodedUrl = decodeURIComponent(url);
    if (!/^https?:\/\//i.test(decodedUrl)) {
      console.warn('Proxy image received custom/invalid URL:', decodedUrl);
      return res.status(400).send('Invalid absolute HTTP/HTTPS url parameter required');
    }

    const isInstagramUrl = /(instagram\.com|instagr\.am|cdninstagram\.com|fbcdn\.net)/i.test(decodedUrl);
    const isRedditUrl = /(redd\.it|reddit\.com|redditstatic\.com|preview\.redd\.it|i\.redd\.it)/i.test(decodedUrl);
    const isTikTokUrl = /(tiktok\.com|tiktokcdn|byteoversea|ibyteimg)/i.test(decodedUrl);
    
    let referer = '';
    if (isInstagramUrl) {
      referer = 'https://www.instagram.com/';
    } else if (isRedditUrl) {
      referer = 'https://www.reddit.com/';
    } else if (isTikTokUrl) {
      referer = 'https://www.tiktok.com/';
    } else {
      referer = 'https://www.google.com/';
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    };
    
    if (referer) {
      headers['Referer'] = referer;
    }

    let imageRes = await fetch(decodedUrl, { headers });

    // If we get a 403, try once more without Referer (sometimes CDNs are picky about signed URLs)
    if (imageRes.status === 403 && referer) {
      const { Referer, ...headersWithoutReferer } = headers;
      imageRes = await fetch(decodedUrl, { headers: headersWithoutReferer as any });
    }

    if (!imageRes.ok) {
      // Secondary fallback to weserv.nl if our own proxy fails (common for picky social media CDNs)
      if (imageRes.status === 403 || imageRes.status === 401 || imageRes.status === 429) {
         try {
           const fallbackUrl = `https://images.weserv.nl/?url=${encodeURIComponent(decodedUrl)}`;
           const fallbackRes = await fetch(fallbackUrl);
           if (fallbackRes.ok) {
             const contentType = fallbackRes.headers.get('content-type') || 'image/jpeg';
             const arrayBuffer = await fallbackRes.arrayBuffer();
             res.setHeader('Content-Type', contentType);
             res.setHeader('Cache-Control', 'public, max-age=86400');
             return res.send(Buffer.from(arrayBuffer));
           }
         } catch (e) {
           // Fallback failed too, we will log below
         }
      }

      console.warn(`Failed parsing proxy image status ${imageRes.status} for url: ${decodedUrl}`);
      return res.status(imageRes.status).send('Failed to fetch image');
    }

    const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return res.send(buffer);
  } catch (error) {
    console.error('Proxy image error:', error);
    return res.status(500).send('Error proxying image');
  }
});

import * as cheerio from 'cheerio';

app.post('/api/meta', async (req, res) => {
  const { url } = req.body;
  
  const parseCleanJson = (text: string) => {
    try {
      return JSON.parse(text.trim());
    } catch (e) {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0].trim());
      }
      throw e;
    }
  };

  const generateHumanGuesses = (rawUrl: string) => {
    let title = '';
    let description = '';
    let domain = '';

    try {
      const urlObj = new URL(rawUrl);
      const host = urlObj.hostname.replace('www.', '');
      domain = host;

      if (host.includes('facebook') || host.includes('fb.com') || host.includes('fb.watch')) {
        domain = 'facebook.com';
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        
        if (rawUrl.includes('/groups/')) {
          const groupIndex = pathParts.indexOf('groups');
          const groupName = pathParts[groupIndex + 1] || 'Group';
          const nameClean = groupName.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          title = `Post in ${nameClean} Group`;
          description = 'Shared in a Facebook Group discussion.';
        }
        else if (rawUrl.includes('/share/p/')) {
          title = 'Shared Post on Facebook';
          description = 'Community post or conversation shared on Facebook.';
        }
        else if (rawUrl.includes('/share/v/')) {
          title = 'Shared Video on Facebook';
          description = 'Video update shared on Facebook.';
        }
        else if (rawUrl.includes('/watch') || rawUrl.includes('/videos/')) {
          title = 'Facebook Watch Video';
          description = 'Video update on Facebook Watch.';
        }
        else if (pathParts.length === 1 && !pathParts[0].includes('.')) {
          const profile = pathParts[0];
          title = `${profile.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} on Facebook`;
          description = `Facebook profile or page page for ${profile}.`;
        }
        else if (pathParts[0]) {
          const profile = pathParts[0];
          title = `Post by ${profile.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} on Facebook`;
          description = `Shared update on Facebook from user: @${profile}.`;
        } else {
          title = 'Facebook Post';
          description = 'Shared update from Facebook.';
        }
      } else if (host.includes('reddit') || host.includes('redd.it')) {
        domain = 'reddit.com';
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        if (rawUrl.includes('/r/')) {
          const rIndex = pathParts.indexOf('r');
          const subName = pathParts[rIndex + 1] || 'reddit';
          const titleIndex = rIndex + 3;
          let threadTitle = pathParts[titleIndex] || '';
          if (threadTitle) {
            threadTitle = threadTitle.replace(/[_-]/g, ' ').trim();
            threadTitle = threadTitle.charAt(0).toUpperCase() + threadTitle.slice(1);
            title = `r/${subName} - ${threadTitle}`;
          } else {
            title = `r/${subName} Community`;
          }
          description = `Discussion post in the r/${subName} community on Reddit.`;
        } else {
          title = 'Reddit Discussion Thread';
          description = 'Interesting debate, update, or link shared on Reddit.';
        }
      }
    } catch (e) {
      // ignore
    }

    return { title, description, domain };
  };

  try {
    let targetUrl = url;
    
    // Skip follow-redirects for social networks that aggressively redirect to login pages
    const isSocialMedia = /(pinterest\.com\/pin\/|pin\.it|instagram\.com|instagr\.am|facebook\.com|fb\.com|fb\.watch|reddit\.com|redd\.it)/i.test(url);
    
    if (!isSocialMedia) {
      try {
        const headRes = await fetch(url, { 
          method: 'HEAD',
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(3000)
        });
        targetUrl = headRes.url;
      } catch (e) {
        console.warn('URL resolution failed, using original:', e);
      }
    } else if (url.includes('pin.it')) {
      try {
        const headRes = await fetch(url, { 
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(3000)
        });
        targetUrl = headRes.url;
      } catch (e) {
        console.warn('Pinterest shortlink resolution failed, using original:', e);
      }
    }

    // 2. Pinterest OEmbed is the most reliable way to get high-quality images
    if (targetUrl.includes('pinterest.com/pin/') || targetUrl.includes('pin.it')) {
      try {
        const oeUrl = `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(targetUrl)}`;
        const oeRes = await fetch(oeUrl);
        if (oeRes.ok) {
          const oe = await oeRes.json();
          return res.json({
            title: oe.title || 'Pinterest Pin',
            description: '',
            thumbnail: oe.thumbnail_url || null,
            domain: 'pinterest.com',
          });
        }
      } catch (e) {
        console.warn('Pinterest OEmbed failed:', e);
      }
    }

    // 2.1 Facebook Check
    const fbMatch = targetUrl.match(/(?:facebook\.com|fb\.com|fb\.watch)/i);
    if (fbMatch) {
      const guesses = generateHumanGuesses(targetUrl);
      let fbTitle = guesses.title || 'Facebook Post';
      let fbDesc = guesses.description || 'Shared Facebook content.';
      let fbThumb = null;

      try {
        console.log(`Using Microlink API to parse Facebook URL: ${targetUrl}`);
        const mUrl = `https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}&palette=true`;
        const mRes = await fetch(mUrl);
        if (mRes.ok) {
          const json = await mRes.json();
          if (json.status === 'success' && json.data) {
            const data = json.data;
            let tempTitle = data.title || '';
            if (tempTitle && tempTitle.toLowerCase() !== 'facebook' && !tempTitle.toLowerCase().includes('log in') && !tempTitle.toLowerCase().includes('redirecting')) {
              fbTitle = tempTitle;
            }
            let tempDesc = data.description || '';
            if (tempDesc && !tempDesc.toLowerCase().includes('log in') && !tempDesc.toLowerCase().includes('redirecting')) {
              fbDesc = tempDesc;
            }
            if (data.image?.url) {
              fbThumb = data.image.url;
            }
          }
        }
      } catch (fbErr) {
        console.warn('Facebook Microlink fetch failed, falling back:', fbErr);
      }

      // Fallback: If title is still generic, call Gemini with URL parsing strategy (highly robust, no Google Search failures)
      if ((!fbTitle || fbTitle === 'Facebook Post') && process.env.GEMINI_API_KEY) {
        try {
          console.log('Refining Facebook post metadata with Gemini URL intelligence...');
          const ai = getGeminiClient();
          const geminiRes = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are a high-fidelity URL link preview text generator.
We have a Facebook URL: "${targetUrl}"
Generate a beautiful, context-relevant, human-friendly preview Title and Description from the URL path, parameters, profile handles, and any content keywords.
Do not use generic "Facebook Post" or "Log in". Make it look styled and accurate (e.g., "Post by Cristiano on Facebook" or "Post in Reactjs Developers Group").

Return ONLY a raw JSON object with this structure:
{
  "title": "Title here",
  "description": "Short description here..."
}
Do not use raw markdown blocks, return ONLY valid JSON.`,
          });

          if (geminiRes && geminiRes.text) {
            const parsed = parseCleanJson(geminiRes.text);
            if (parsed.title && parsed.title.toLowerCase() !== 'facebook' && !parsed.title.toLowerCase().includes('log in')) {
              fbTitle = parsed.title;
            }
            if (parsed.description && !parsed.description.toLowerCase().includes('log in')) {
              fbDesc = parsed.description;
            }
          }
        } catch (gemError) {
          console.warn('Gemini metadata refinement for Facebook failed:', gemError);
        }
      }

      // Use a beautiful, highly polished social sharing placeholder icon/image from Unsplash instead of thum.io cookie walls
      if (!fbThumb) {
        fbThumb = 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=600&auto=format&fit=crop&q=80';
      }

      return res.json({
        title: fbTitle,
        description: fbDesc,
        thumbnail: fbThumb,
        domain: 'facebook.com',
      });
    }

    // 2.3 Instagram Post Check
    const igMatch = targetUrl.match(/(?:instagram\.com|instagr\.am)\/(?:p|reel|tv|share\/p)\/([a-zA-Z0-9_-]+)/i);
    if (igMatch) {
      const shortcode = igMatch[1];
      const isReel = targetUrl.toLowerCase().includes('/reel/');
      const isTv = targetUrl.toLowerCase().includes('/tv/');
      const igTypeLabel = isReel ? 'Instagram Reel' : isTv ? 'Instagram Video' : 'Instagram Post';

      try {
        console.log(`Using Microlink API to parse Instagram shortcode: ${shortcode}`);
        const mUrl = `https://api.microlink.io/?url=${encodeURIComponent(`https://www.instagram.com/p/${shortcode}/`)}&palette=true`;
        const mRes = await fetch(mUrl);
        
        let title = '';
        let description = '';
        let thumbnail = null;

        if (mRes.ok) {
          const json = await mRes.json();
          if (json.status === 'success' && json.data) {
            const data = json.data;
            title = data.title || '';
            description = data.description || '';
            if (data.image && data.image.url) {
              thumbnail = data.image.url;
            }
          }
        }

        // Clean values retrieved from Microlink
        if (title && (title.toLowerCase() === 'instagram' || title.toLowerCase().includes('log in') || title.toLowerCase().includes('redirecting'))) {
          title = '';
        }
        if (description && (description.toLowerCase().includes('log in') || description.toLowerCase().includes('redirecting'))) {
          description = '';
        }

        // Fallback to classic scrape/Discordbot captioned embed parsing if Microlink didn't give a real title/thumbnail
        if (!title || !thumbnail) {
          console.log(`Microlink fetch incomplete, attempting captioned embed scraping for: ${shortcode}`);
          const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
          const embedRes = await fetch(embedUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
          });

          if (embedRes.ok) {
            const html = await embedRes.text();
            const $ = cheerio.load(html);

            if (!thumbnail) {
              thumbnail = $('.EmbeddedMediaImage').attr('src') || 
                          $('.EmbeddedMedia img').attr('src') || 
                          $('img.EmbeddedMediaImage').attr('src') || null;

              if (!thumbnail || thumbnail.startsWith('data:')) {
                const displayUrlMatch = html.match(/"display_url"\s*:\s*"([^"]+)"/);
                if (displayUrlMatch) {
                  thumbnail = displayUrlMatch[1].replace(/\\u0026/g, '&');
                }
              }
              if (!thumbnail || thumbnail.startsWith('data:')) {
                const thumbSrcMatch = html.match(/"thumbnail_src"\s*:\s*"([^"]+)"/);
                if (thumbSrcMatch) {
                  thumbnail = thumbSrcMatch[1].replace(/\\u0026/g, '&');
                }
              }
            }

            if (!description) {
              description = $('.CaptionText').text().trim() || 
                            $('.Caption').text().trim() || 
                            $('.CaptionComments').prev().text().trim() || '';

              if (!description) {
                const captionMatch = html.match(/"edge_media_to_caption"\s*:\s*\{\s*"edges"\s*:\s*\[\s*\{\s*"node"\s*:\s*\{\s*"text"\s*:\s*"([^"]+)"/);
                if (captionMatch) {
                  description = captionMatch[1]
                    .replace(/\\n/g, '\n')
                    .replace(/\\u([0-9a-fA-F]{4})/g, (_, grp) => String.fromCharCode(parseInt(grp, 16)));
                }
              }
            }

            if (!title) {
              const docTitle = $('title').text() || '';
              if (docTitle) {
                const cleanedDocTitle = docTitle.replace(/\s+/g, ' ').trim();
                const userMatch = cleanedDocTitle.match(/by\s+([^•]+)/i);
                const userMatchAlt = cleanedDocTitle.match(/^([^\s•]+)/i);
                if (userMatch) {
                  title = `${userMatch[1].trim()} (@${userMatch[1].trim()}) on Instagram`;
                } else if (userMatchAlt && !cleanedDocTitle.toLowerCase().startsWith('instagram')) {
                  title = `${userMatchAlt[1].trim()} on Instagram`;
                } else if (cleanedDocTitle && cleanedDocTitle.toLowerCase() !== 'instagram') {
                  title = cleanedDocTitle;
                }
              }
            }
          }
        }

        // Clean description
        if (description) {
          description = description.replace(/\s+/g, ' ').trim();
          if (description.length > 500) {
            description = description.slice(0, 500) + '...';
          }
        }

        // Final fail-soft formatting
        if ((!title || title.toLowerCase() === 'instagram' || title.toLowerCase().includes('log in') || title.startsWith('Instagram Post (') || title.startsWith('Instagram Reel (')) && process.env.GEMINI_API_KEY) {
          try {
            console.log('Refining Instagram metadata with Gemini URL intelligence...');
            const ai = getGeminiClient();
            const geminiRes = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: `You are a high-fidelity URL link preview text generator.
We have an Instagram URL: "${targetUrl}" with shortcode "${shortcode}"
Generate a beautiful, context-relevant, human-friendly preview Title and Description from the URL path, shortcode, account handle (if present in URL), and any keywords.
Do not use generic "Instagram Post" or "Log in". Make it look clean and accurate (e.g., "Post on Instagram (@shortcode)" or "Instagram Reel by @creator").

Return ONLY a raw JSON object with this structure:
{
  "title": "Title here",
  "description": "Short description here..."
}
Do not use raw markdown blocks, return ONLY valid JSON.`,
            });

            if (geminiRes && geminiRes.text) {
              const parsed = parseCleanJson(geminiRes.text);
              if (parsed.title && parsed.title.toLowerCase() !== 'instagram' && !parsed.title.toLowerCase().includes('log in')) {
                title = parsed.title;
              }
              if (parsed.description && !parsed.description.toLowerCase().includes('log in')) {
                description = parsed.description;
              }
            }
          } catch (gemError) {
            console.warn('Gemini metadata refinement for Instagram failed:', gemError);
          }
        }

        if (!title || title.toLowerCase() === 'instagram' || title.toLowerCase().includes('log in')) {
          title = `${igTypeLabel} (${shortcode})`;
        }

        if (thumbnail && !thumbnail.startsWith('http')) {
          thumbnail = null;
        }

        if (!thumbnail || thumbnail.includes('thum.io')) {
          thumbnail = 'https://images.unsplash.com/photo-1611262588024-d12430b98920?w=600&auto=format&fit=crop&q=80';
        }

        return res.json({
          title,
          description: description || '',
          thumbnail,
          domain: 'instagram.com',
        });

      } catch (err) {
        console.warn('Instagram scrap extraction error:', err);
      }

      return res.json({
        title: `${igTypeLabel} (${shortcode})`,
        description: '',
        thumbnail: 'https://images.unsplash.com/photo-1611262588024-d12430b98920?w=600&auto=format&fit=crop&q=80',
        domain: 'instagram.com',
      });
    }

    // 2.5 YouTube OEmbed Check
    if (targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be')) {
      try {
        const ytOeUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`;
        const ytRes = await fetch(ytOeUrl);
        if (ytRes.ok) {
          const oe = await ytRes.json();
          return res.json({
            title: oe.title || '',
            description: '',
            thumbnail: oe.thumbnail_url || null,
            domain: 'youtube.com',
          });
        }
      } catch (e) {
        console.warn('YouTube OEmbed failed:', e);
      }
    }

    // 2.6 Reddit Check (Dual-layered JSON-based and whitelisted scraping)
    if (targetUrl.includes('reddit.com') || targetUrl.includes('redd.it')) {
      const guesses = generateHumanGuesses(targetUrl);
      let rdTitle = guesses.title || 'Reddit Post';
      let rdDesc = guesses.description || 'Reddit post content';
      let rdThumb = null;
      const hostname = new URL(targetUrl).hostname.replace('www.', '');

      // 1. Try Microlink Parser (super clean, returns original attributes)
      try {
        console.log(`Using Microlink API to parse Reddit URL: ${targetUrl}`);
        const mUrl = `https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}&palette=true`;
        const mRes = await fetch(mUrl);
        if (mRes.ok) {
          const json = await mRes.json();
          if (json.status === 'success' && json.data) {
            const data = json.data;
            let tempTitle = data.title || '';
            if (tempTitle && tempTitle.toLowerCase() !== 'reddit' && !tempTitle.toLowerCase().includes('log in') && !tempTitle.toLowerCase().includes('redirecting')) {
              rdTitle = tempTitle;
            }
            let tempDesc = data.description || '';
            if (tempDesc && !tempDesc.toLowerCase().includes('log in') && !tempDesc.toLowerCase().includes('redirecting')) {
              rdDesc = tempDesc;
            }
            if (data.image?.url) {
              rdThumb = data.image.url;
            }
          }
        }
      } catch (e) {
        console.warn('Reddit Microlink parser failed, trying direct scrapers fallback:', e);
      }

      // Fallback: If title is still generic, call Gemini with URL parsing strategy (highly robust, no Google Search failures)
      if ((!rdTitle || rdTitle === 'Reddit Post') && process.env.GEMINI_API_KEY) {
        try {
          console.log('Refining Reddit post metadata with Gemini URL intelligence...');
          const ai = getGeminiClient();
          const geminiRes = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are a high-fidelity URL link preview text generator.
We have a Reddit URL: "${targetUrl}"
Generate a beautiful, context-relevant, human-friendly preview Title and Description from the URL path, parameters, and any content keywords.
Do not use generic "Reddit" or "Log in". Make it look styled and accurate (e.g., "r/science - Breakthrough in fusion energy research" or "r/pics - Beautiful sunset in Kyoto").

Return ONLY a raw JSON object with this structure:
{
  "title": "Title here",
  "description": "Short description here..."
}
Do not use raw markdown blocks, return ONLY valid JSON.`,
          });

          if (geminiRes && geminiRes.text) {
            const parsed = parseCleanJson(geminiRes.text);
            if (parsed.title && parsed.title.toLowerCase() !== 'reddit' && !parsed.title.toLowerCase().includes('log in')) {
              rdTitle = parsed.title;
            }
            if (parsed.description && !parsed.description.toLowerCase().includes('log in')) {
              rdDesc = parsed.description;
            }
          }
        } catch (gemError) {
          console.warn('Gemini metadata refinement for Reddit failed:', gemError);
        }
      }

      // 3. Dual-layered JSON and Scraper Fallback
      if (!rdThumb || rdTitle === 'Reddit Post') {
        try {
          let canonicalUrl = targetUrl;
          const headRes = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(3000)
          });
          if (headRes.ok) {
            canonicalUrl = headRes.url || targetUrl;
          }

          let jsonUrl = canonicalUrl;
          if (jsonUrl.includes('?')) {
            jsonUrl = jsonUrl.split('?')[0];
          }
          if (jsonUrl.endsWith('/')) {
            jsonUrl = jsonUrl.slice(0, -1);
          }
          jsonUrl = jsonUrl + '.json';

          const jsonRes = await fetch(jsonUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            },
            signal: AbortSignal.timeout(3000)
          });

          if (jsonRes.ok) {
            const data = await jsonRes.json();
            let postData: any = null;
            if (Array.isArray(data)) {
              postData = data[0]?.data?.children?.[0]?.data;
            } else if (data && data.kind === 'Listing') {
              postData = data.data?.children?.[0]?.data;
            } else if (data && data.kind === 't3') {
              postData = data.data;
            }

            if (postData) {
              if (!rdTitle || rdTitle === 'Reddit Post') {
                rdTitle = postData.title || rdTitle;
              }
              if (!rdDesc || rdDesc === 'Reddit post content') {
                rdDesc = postData.selftext || `Posted in r/${postData.subreddit}`;
                if (!rdDesc.includes('by u/') && postData.author) {
                  rdDesc += ` by u/${postData.author}`;
                }
              }

              if (postData.is_gallery && postData.media_metadata) {
                const keys = Object.keys(postData.media_metadata);
                if (keys.length > 0) {
                  const galleryObj = postData.media_metadata[keys[0]];
                  if (galleryObj?.s?.u) rdThumb = galleryObj.s.u;
                }
              }
              if (!rdThumb && postData.preview?.images?.[0]?.source?.url) {
                rdThumb = postData.preview.images[0].source.url;
              }
              if (!rdThumb && postData.url && /\.(jpe?g|png|gif|webp|bmp|avif)(\?|$)/i.test(postData.url)) {
                rdThumb = postData.url;
              }
            }
          }
        } catch (jsonErr) {
          console.warn('Reddit JSON API fallback failed:', jsonErr);
        }
      }

      // 4. Cheerio Direct Scraping Fallback
      if (!rdThumb || rdTitle === 'Reddit Post') {
        try {
          const redditRes = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(3000)
          });

          if (redditRes.ok) {
            const html = await redditRes.text();
            const $ = cheerio.load(html);

            let pageTitle = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
            pageTitle = pageTitle.replace(/\s*[:|-]\s*(r\/\w+|reddit)\s*$/i, '');
            if (pageTitle && pageTitle.toLowerCase() !== 'reddit' && !pageTitle.toLowerCase().includes('log in')) {
              rdTitle = pageTitle;
            }
            
            let pageDesc = $('meta[property="og:description"]').attr('content') || '';
            if (pageDesc && !pageDesc.toLowerCase().includes('log in')) {
              rdDesc = pageDesc;
            }

            let pageThumb = $('meta[property="og:image"]').attr('content') || null;
            if (pageThumb && !pageThumb.includes('redditstatic.com') && !pageThumb.includes('reddit_logo')) {
              rdThumb = pageThumb;
            }
          }
        } catch (e) {
          console.warn('Reddit direct scraping fallback failed:', e);
        }
      }

      // Post-process cleaners
      if (rdTitle) {
        rdTitle = rdTitle.replace(/\s+/g, ' ').trim();
      }
      if (rdDesc) {
        rdDesc = rdDesc.replace(/\s+/g, ' ').trim();
        if (rdDesc.length > 300) {
          rdDesc = rdDesc.slice(0, 300) + '...';
        }
      }

      if (rdThumb) {
        rdThumb = rdThumb.replace(/&amp;/g, '&');
      } else {
        // High quality stylized illustration from Unsplash
        rdThumb = 'https://images.unsplash.com/photo-1611606063065-ee7946f0787a?w=600&auto=format&fit=crop&q=80';
      }

      return res.json({
        title: rdTitle,
        description: rdDesc,
        thumbnail: rdThumb,
        domain: hostname,
      });
    }

    // 2.7 TikTok Check (oEmbed)
    if (targetUrl.includes('tiktok.com')) {
      try {
        const ttOeUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`;
        const ttRes = await fetch(ttOeUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
          }
        });
        if (ttRes.ok) {
          const oe = await ttRes.json();
          return res.json({
            title: oe.title || 'TikTok Video',
            description: oe.author_name ? `By @${oe.author_name}` : '',
            thumbnail: oe.thumbnail_url || null,
            domain: 'tiktok.com',
          });
        }
      } catch (e) {
        console.warn('TikTok OEmbed fetch failed:', e);
      }
    }

    // 2.8 Unsplash Check
    if (targetUrl.includes('unsplash.com')) {
      let usTitle = 'Unsplash Photo';
      let usDesc = 'Beautiful, free images and photos that you can download and use for any project.';
      let usThumb = null;
      
      // Clean slug into a readable title guess
      const photoMatch = targetUrl.match(/unsplash\.com\/photos\/([a-zA-Z0-9_-]+)/i);
      if (photoMatch) {
        const slug = photoMatch[1].split('-').slice(0, -1).join(' ');
        if (slug) {
          usTitle = slug.charAt(0).toUpperCase() + slug.slice(1) + ' - Unsplash Photo';
        }
      }

      // Try Microlink first to get the official title, description, and high-res image
      try {
        console.log(`Using Microlink API to parse Unsplash URL: ${targetUrl}`);
        const mUrl = `https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}&palette=true`;
        const mRes = await fetch(mUrl);
        if (mRes.ok) {
          const json = await mRes.json();
          if (json && json.status === 'success' && json.data) {
            const data = json.data;
            if (data.title && !data.title.toLowerCase().includes('bot') && !data.title.toLowerCase().includes('security') && !data.title.toLowerCase().includes('captcha')) {
              usTitle = data.title;
            }
            if (data.description && !data.description.toLowerCase().includes('bot') && !data.description.toLowerCase().includes('security') && !data.description.toLowerCase().includes('captcha')) {
              usDesc = data.description;
            }
            if (data.image?.url) {
              usThumb = data.image.url;
            } else if (data.screenshot?.url) {
              usThumb = data.screenshot.url;
            }
          }
        }
      } catch (e) {
        console.warn('Unsplash Microlink fetch failed:', e);
      }

      // Use Gemini to refine/generate the finest metadata if we suspect we got blocked or have generic values
      if ((usTitle.toLowerCase().includes('bot') || usTitle.toLowerCase().includes('security') || usTitle.toLowerCase().includes('captcha') || usTitle === 'Unsplash Photo') && process.env.GEMINI_API_KEY) {
        try {
          console.log('Refining Unsplash metadata with Gemini...');
          const ai = getGeminiClient();
          const geminiRes = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are a high-fidelity URL link preview text generator.
We have an Unsplash URL: "${targetUrl}"
Generate a beautiful, context-relevant, human-friendly preview Title and Description from the URL path slug and any keywords.
Do not mention bots, captchas, security checks, or cloudflare. Make it look clean and professional (e.g., "Deep Forests & Blue Mountains Photo by Unsplash" or "Nature Collection by Unsplash").

Return ONLY a raw JSON object with this structure:
{
  "title": "Title here",
  "description": "Short description here..."
}
Do not use raw markdown blocks, return ONLY valid JSON.`,
          });

          if (geminiRes && geminiRes.text) {
            const parsed = parseCleanJson(geminiRes.text);
            if (parsed.title && !parsed.title.toLowerCase().includes('bot') && !parsed.title.toLowerCase().includes('security') && !parsed.title.toLowerCase().includes('captcha')) {
              usTitle = parsed.title;
            }
            if (parsed.description && !parsed.description.toLowerCase().includes('bot') && !parsed.description.toLowerCase().includes('security') && !parsed.description.toLowerCase().includes('captcha')) {
              usDesc = parsed.description;
            }
          }
        } catch (gemError) {
          console.warn('Gemini metadata refinement for Unsplash failed:', gemError);
        }
      }

      // Try checking if we can get a high-quality screenshot via microlink as thumbnail
      if (!usThumb) {
        try {
          const mUrl = `https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}&screenshot=true`;
          const mRes = await fetch(mUrl);
          if (mRes.ok) {
            const json = await mRes.json();
            if (json.status === 'success' && json.data?.screenshot?.url) {
              usThumb = json.data.screenshot.url;
            }
          }
        } catch (e) {
          console.warn('Screenshot fetch fallback failed:', e);
        }
      }

      if (!usThumb) {
        // Fallback to high quality generic beautiful photography from Unsplash itself
        usThumb = 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80';
      }

      return res.json({
        title: usTitle,
        description: usDesc,
        thumbnail: usThumb,
        domain: 'unsplash.com',
      });
    }

    // 2.9 NASA Check
    if (targetUrl.includes('nasa.gov')) {
      let nasaTitle = 'NASA Resource';
      let nasaDesc = 'National Aeronautics and Space Administration (NASA) exploration, science, and discovery.';
      let nasaThumb = null;

      // Try parsing with Microlink first
      try {
        console.log(`Using Microlink API to parse NASA URL: ${targetUrl}`);
        const mUrl = `https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}&palette=true`;
        const mRes = await fetch(mUrl);
        if (mRes.ok) {
          const json = await mRes.json();
          if (json.status === 'success' && json.data) {
            const data = json.data;
            if (data.title) nasaTitle = data.title;
            if (data.description) nasaDesc = data.description;
            if (data.image?.url) nasaThumb = data.image.url;
          }
        }
      } catch (e) {
        console.warn('NASA Microlink fetch failed:', e);
      }

      // If it's Astronomy Picture of the Day (APOD), parse the HTML for the direct image
      if (targetUrl.includes('apod.nasa.gov/apod/')) {
        try {
          console.log(`Fetching APOD page directly: ${targetUrl}`);
          const apodRes = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            }
          });
          if (apodRes.ok) {
            const html = await apodRes.text();
            const $ = cheerio.load(html);
            
            // Extract APOD image path (usually <a href="image/..."> or <img src="image/...">)
            let imgPath = $('img').first().attr('src') || $('a[href^="image/"]').attr('href') || '';
            if (imgPath) {
              if (!imgPath.startsWith('http')) {
                // APOD relative paths are relative to base 'https://apod.nasa.gov/apod/'
                nasaThumb = new URL(imgPath, 'https://apod.nasa.gov/apod/').toString();
              } else {
                nasaThumb = imgPath;
              }
            }
            
            // Clean up typical APOD center layouts for title
            const apodTitle = $('title').text().replace(/APOD:/i, '').trim();
            if (apodTitle) {
              nasaTitle = `NASA APOD: ${apodTitle}`;
            }
            
            // Extract first paragraph words or explanation
            const explanation = $('p').text() || '';
            if (explanation) {
              const cleanedExplanation = explanation
                .replace(/\s+/g, ' ')
                .replace(/Explanation:/i, '')
                .trim();
              if (cleanedExplanation.length > 5) {
                nasaDesc = cleanedExplanation;
              }
            }
          }
        } catch (e) {
          console.warn('APOD direct extraction failed:', e);
        }
      }

      // Use Gemini to refine/generate standard NASA description/titles if they remain generic
      if ((nasaTitle === 'NASA Resource' || !nasaThumb) && process.env.GEMINI_API_KEY) {
        try {
          console.log('Refining NASA metadata with Gemini URL intelligence...');
          const ai = getGeminiClient();
          const geminiRes = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are a high-fidelity URL link preview text generator.
We have a NASA URL: "${targetUrl}"
Generate a beautiful, context-relevant, human-friendly preview Title and Description from the URL path and any keywords.
Make it look highly inspiring and scientifically accurate (e.g., "NASA James Webb Captures Cosmic Cliffs" or "Artemis Mission Updates - NASA").

Return ONLY a raw JSON object with this structure:
{
  "title": "Title here",
  "description": "Short description here..."
}
Do not use raw markdown blocks, return ONLY valid JSON.`,
          });

          if (geminiRes && geminiRes.text) {
            const parsed = parseCleanJson(geminiRes.text);
            if (parsed.title) {
              nasaTitle = parsed.title;
            }
            if (parsed.description) {
              nasaDesc = parsed.description;
            }
          }
        } catch (gemError) {
          console.warn('Gemini metadata refinement for NASA failed:', gemError);
        }
      }

      // Beautiful fallback image if NASA doesn't give a thumb (space theme fits space/nasa perfectly)
      if (!nasaThumb) {
        nasaThumb = 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80';
      }

      // Clean metadata strings
      nasaTitle = nasaTitle.replace(/\s+/g, ' ').trim();
      nasaDesc = nasaDesc.replace(/\s+/g, ' ').trim();
      if (nasaDesc.length > 300) {
        nasaDesc = nasaDesc.slice(0, 300) + '...';
      }

      return res.json({
        title: nasaTitle,
        description: nasaDesc,
        thumbnail: nasaThumb,
        domain: 'nasa.gov',
      });
    }

    // 3. General Scraping Fallback
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    };

    // Yahoo specific tweak
    if (targetUrl.includes('yahoo.com')) {
      headers['Referer'] = 'https://www.google.com/';
      // Sometimes adding a dummy cookie helps with consent walls
      headers['Cookie'] = 'GUC=AQEBCAFmO...;'; 
    }

    const response = await fetch(targetUrl, { headers });
    
    let html = await response.text();
    let $ = cheerio.load(html);
    
    let title = $('meta[property="og:title"]').attr('content') || 
                $('meta[name="twitter:title"]').attr('content') || 
                $('title').text() || 
                $('h1').first().text() || '';

    let description = $('meta[name="description"]').attr('content') || 
                      $('meta[property="og:description"]').attr('content') || 
                      $('meta[name="twitter:description"]').attr('content') || '';

    // Bot challenge detector & bypass using Gemini URL Intelligence
    const isBotChallenge = (str: string) => {
      const s = str.toLowerCase();
      return s.includes('checking if you are a bot') || 
             s.includes('are you a bot') || 
             s.includes('cloudflare') || 
             s.includes('robot check') || 
             s.includes('attention required') || 
             s.includes('security check') || 
             s.includes('verify you are a human') || 
             s.includes('please verify') ||
             s.includes('unsupported browser') ||
             s.includes('captcha');
    };

    if ((isBotChallenge(title) || isBotChallenge(description) || !title) && process.env.GEMINI_API_KEY) {
      console.log('Detected Bot/Security challenge page or empty title! Bypassing with Gemini URL intelligence...');
      try {
        const ai = getGeminiClient();
        const geminiRes = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `You are a high-fidelity URL link preview text generator.
We attempted to scrape this URL but got blocked by a bot detector/CAPTCHA page: "${targetUrl}"
Generate a beautiful, context-relevant, human-friendly preview Title and Description solely from the URL path, parameters, domain and any content keywords.
Do not mention captcha, bot, security, or blocks. Make it look perfectly natural, authentic, and high quality.

Return ONLY a raw JSON object with this structure:
{
  "title": "Title here",
  "description": "Short description here..."
}
Do not use raw markdown blocks, return ONLY valid JSON.`,
        });

        if (geminiRes && geminiRes.text) {
          const parsed = parseCleanJson(geminiRes.text);
          if (parsed.title) {
            title = parsed.title;
          }
          if (parsed.description) {
            description = parsed.description;
          }
        }
      } catch (gemError) {
        console.warn('Gemini bypass for bot check failed:', gemError);
      }
    }
    
    // Yahoo often includes " - Yahoo Finance" or similar in title, which is fine, 
    // but if title is JUST "Yahoo" or "Yahoo Finance", we should look deeper.
    const genericTitles = ['yahoo', 'yahoo finance', 'yahoo news', 'yahoo mail', 'yahoo search'];
    if (genericTitles.includes(title.toLowerCase().trim()) || !title) {
        const h1 = $('h1').first().text();
        if (h1 && h1.length > 5) title = h1;
    }

    let thumbnail = $('meta[property="og:image"]').attr('content') || 
                    $('meta[name="twitter:image"]').attr('content') || 
                    $('link[rel="image_src"]').attr('href') || '';
    
    // 3.1. Extensive Image Scraping (if OG image is missing)
    if (!thumbnail) {
      // Look for high-res icons first
      thumbnail = $('link[rel="apple-touch-icon"]').attr('href') ||
                  $('link[rel="icon"][sizes="192x192"]').attr('href') ||
                  $('link[rel="icon"][sizes="512x512"]').attr('href') ||
                  $('link[rel="shortcut icon"]').attr('href') ||
                  $('link[rel="icon"]').attr('href') || '';
                  
      // If still no thumbnail, scan body for a reasonable image (limit to first 10 images)
      if (!thumbnail) {
        $('img').slice(0, 10).each((i, el) => {
          const src = $(el).attr('src');
          if (src && src.startsWith('http') && !thumbnail) {
            const width = parseInt($(el).attr('width') || '0');
            const height = parseInt($(el).attr('height') || '0');
            // Prefer images that look like hero images or are decently sized
            if ((width > 300 || height > 300) || src.includes('hero') || src.includes('cover') || src.includes('feature')) {
              thumbnail = src;
            }
          }
        });
      }

      // Handle relative paths for thumbnails found via atypical methods
      if (thumbnail && !thumbnail.startsWith('http')) {
        try {
          const base = new URL(targetUrl);
          thumbnail = new URL(thumbnail, base.origin).toString();
        } catch (e) {
          thumbnail = '';
        }
      }
    }

    // 3.2. Final Fallback: If absolutely no image found, use clear high-res Google favicon service
    if (!thumbnail) {
      try {
        const domain = new URL(targetUrl).hostname;
        thumbnail = `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;
      } catch (e) {
        thumbnail = null;
      }
    }
    
    // Clean up title
    title = title.replace(/\s+/g, ' ').trim();
    
    res.json({
      title,
      description,
      thumbnail: thumbnail || null,
      domain: new URL(targetUrl).hostname.replace('www.', ''),
    });
  } catch (error) {
    console.error('Meta extraction failed:', error);
    try {
        const d = new URL(url).hostname.replace('www.', '');
        res.json({ title: d, description: '', thumbnail: null, domain: d });
    } catch {
        res.json({ title: '', description: '', thumbnail: null, domain: '' });
    }
  }
});

// Gemini helper lazy initialization to prevent startup crashes if key is missing
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('GEMINI_API_KEY is not defined in environment variables. Please check your config.');
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// Gemini Helper with model fallbacks and backoff retry to handle transient 503 high-demand spikes
async function callGemini(prompt: string) {
  const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.5-pro'];
  let lastError: any = null;
  const ai = getGeminiClient();

  for (const modelName of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`Sending Gemini request context (Attempt ${attempt}, Model: ${modelName})...`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          }
        });
        if (response && response.text) {
          return response.text;
        }
      } catch (error: any) {
        lastError = error;
        console.warn(`Gemini Warning: Attempt ${attempt} on ${modelName} failed. Error: ${error?.message || error}`);
        
        // Wait briefly before retrying the same model
        if (attempt < 2) {
          const delay = 800 * attempt;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
  }

  console.error('All Gemini model fallbacks and retries completed, but no response was received. Last active error:', lastError);
  throw lastError || new Error('All model candidates failed or timed out.');
}

// Helper Rule-Based Fallbacks when GEMINI_API_KEY is missing or Gemini API call fails
function generateFallbackTags(items: any[]) {
  const result: Record<string, string[]> = {};
  if (!Array.isArray(items)) return result;

  for (const item of items) {
    if (!item || !item.id) continue;
    const tags = new Set<string>();
    const title = (item.title || '').toLowerCase();
    const type = (item.type || '').toLowerCase();
    const urlStr = (item.url || item.domain || '').toLowerCase();

    if (type === 'video' || urlStr.includes('youtube') || urlStr.includes('vimeo') || urlStr.includes('youtu.be')) {
      tags.add('video');
      tags.add('media');
    } else if (type === 'image' || urlStr.includes('unsplash') || urlStr.includes('pinterest') || urlStr.includes('instagram')) {
      tags.add('design');
      tags.add('visuals');
    } else if (urlStr.includes('github') || urlStr.includes('gitlab') || urlStr.includes('stackoverflow')) {
      tags.add('dev');
      tags.add('code');
    } else if (urlStr.includes('figma') || urlStr.includes('dribbble') || urlStr.includes('behance')) {
      tags.add('design');
      tags.add('ui/ux');
    } else if (urlStr.includes('twitter') || urlStr.includes('x.com') || urlStr.includes('facebook')) {
      tags.add('social');
    } else if (type === 'note' || title.includes('note') || title.includes('idea')) {
      tags.add('notes');
      tags.add('ideas');
    } else {
      tags.add('reference');
      tags.add('reading');
    }

    if (item.tags && Array.isArray(item.tags)) {
      item.tags.forEach((t: string) => { if (typeof t === 'string' && t.trim()) tags.add(t.toLowerCase().trim()); });
    }

    result[item.id] = Array.from(tags).slice(0, 4);
  }
  return result;
}

function generateFallbackColonies(items: any[]) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const groups: Record<string, { id: string; name: string; description: string; itemIds: string[] }> = {
    media: { id: 'colony-media', name: 'Media & Streams', description: 'Video content, audio streams, and rich visual clips', itemIds: [] },
    design: { id: 'colony-design', name: 'Design & Visuals', description: 'UI layouts, graphic references, and design inspirations', itemIds: [] },
    tech: { id: 'colony-tech', name: 'Dev & Engineering', description: 'Developer repositories, technical docs, and code samples', itemIds: [] },
    reading: { id: 'colony-reading', name: 'Articles & Web', description: 'Saved articles, blog posts, and online resources', itemIds: [] },
    notes: { id: 'colony-notes', name: 'Notes & Ideas', description: 'Personal thoughts, memos, and creative snippets', itemIds: [] },
  };

  for (const item of items) {
    if (!item || !item.id) continue;
    const title = (item.title || '').toLowerCase();
    const type = (item.type || '').toLowerCase();
    const urlStr = (item.url || item.domain || '').toLowerCase();

    if (type === 'video' || urlStr.includes('youtube') || urlStr.includes('vimeo') || urlStr.includes('spotify')) {
      groups.media.itemIds.push(item.id);
    } else if (type === 'image' || urlStr.includes('figma') || urlStr.includes('dribbble') || urlStr.includes('unsplash') || urlStr.includes('instagram')) {
      groups.design.itemIds.push(item.id);
    } else if (urlStr.includes('github') || urlStr.includes('gitlab') || urlStr.includes('npm') || urlStr.includes('stack')) {
      groups.tech.itemIds.push(item.id);
    } else if (type === 'note' || title.includes('note') || title.includes('idea')) {
      groups.notes.itemIds.push(item.id);
    } else {
      groups.reading.itemIds.push(item.id);
    }
  }

  return Object.values(groups).filter(g => g.itemIds.length > 0);
}

function generateFallbackAnalysis(item: any) {
  const type = (item.type || 'link').toLowerCase();
  const title = item.title || 'Untitled';
  return {
    aesthetic: type === 'video' ? 'Dynamic Motion' : type === 'note' ? 'Editorial Minimalist' : 'Modern Web Layout',
    colors: ['#0F172A', '#38BDF8', '#818CF8', '#F8FAFC'],
    typography: 'High-contrast sans-serif pairing with legible body typography.',
    review: `An engaging ${type} resource titled "${title}". Clean layout hierarchy and balanced visual structure.`,
    vibe: 'Modern, balanced, focused'
  };
}

function generateFallbackSearch(query: string, items: any[]) {
  if (!Array.isArray(items)) return [];
  const q = (query || '').toLowerCase().trim();
  if (!q) return items.map((i: any) => i.id);

  return items
    .filter((item: any) => {
      if (!item) return false;
      const title = (item.title || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      const notes = (item.notes || '').toLowerCase();
      const domain = (item.domain || item.url || '').toLowerCase();
      const tags = Array.isArray(item.tags) ? item.tags.join(' ').toLowerCase() : '';
      return title.includes(q) || desc.includes(q) || notes.includes(q) || domain.includes(q) || tags.includes(q);
    })
    .map((i: any) => i.id);
}

app.post('/api/ai/analyze', async (req, res) => {
  const { title, description, url, notes, type } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    console.log('GEMINI_API_KEY missing. Returning fallback design analysis.');
    return res.json({ analysis: generateFallbackAnalysis({ title, description, url, notes, type }) });
  }

  const prompt = `You are an expert design director and aesthetic critic. Analyze this mood board item and parse its visual/design archetype.

Item Info:
- Title: ${title || 'Untitled'}
- Type: ${type || 'link'}
- Description: ${description || 'No description provided.'}
- URL: ${url || 'None'}
- Notes: ${notes || 'No user notes.'}

We want to categorize and critique this item from a high-fidelity visual design, UI/UX structure, and color theory perspective.
Generate:
1. "aesthetic": A precise aesthetic/design movement label (e.g., "Swiss-International Grid", "High-Tech Brutalism", "Vaporwave Retrofuturism", "Organic Japandi", "Cozy Skeuomorphism", etc.) (1-3 words max).
2. "colors": 4 cohesive hex colors that define this vibe or scheme (e.g. ["#1A1A1A", "#FFFFFF", "#FF3366", "#00FF66"]). Always include 4 valid 6-character hex color strings.
3. "typography": A highly accurate typography analysis describing what font family pairings (sans-serif, serif, mono, display geometric) and size contrast principles fit this design archetype (1-2 sentences).
4. "review": A concise, intellectual, yet humble visual design review covering layout, negative space, and usability rhythm of the content (2-3 sentences).
5. "vibe": A concise vibe descriptive string (e.g. "Industrial, sharp, technical", "Warm, meditative, soft") (3-5 words max).

Return ONLY a valid JSON object matching this structure:
{
  "aesthetic": "string",
  "colors": ["string", "string", "string", "string"],
  "typography": "string",
  "review": "string",
  "vibe": "string"
}

Do not return any markdown codeblocks or pretext other than the raw JSON itself.`;

  try {
    const text = await callGemini(prompt);
    if (text) {
      const parsed = JSON.parse(text);
      return res.json({ analysis: parsed });
    } else {
      return res.json({ analysis: generateFallbackAnalysis({ title, description, url, notes, type }) });
    }
  } catch (error: any) {
    console.warn('AI analysis fallback triggered:', error?.message || error);
    return res.json({ analysis: generateFallbackAnalysis({ title, description, url, notes, type }) });
  }
});

app.post('/api/ai/tags', async (req, res) => {
  const { title, description, url } = req.body;
  
  if (!process.env.GEMINI_API_KEY) {
    const fallback = generateFallbackTags([{ id: 'temp', title, url, description }]);
    return res.json({ tags: fallback['temp'] || ['reference'], suggestedTitle: null });
  }

  const prompt = `Analyze the following item and provide enrichment data.
If the current title is generic (like a domain name), suggest a better, more descriptive "title".
Also extract 1-3 short, relevant "tags".

Item Info:
URL: ${url}
Title: ${title}
Description: ${description}

Return ONLY a JSON object with this structure:
{
  "title": "A better title",
  "tags": ["tag1", "tag2"]
}

Ensure the title is concise and the tags are strictly lowercase.`;

  try {
    const text = await callGemini(prompt);
    if (text) {
      const parsed = JSON.parse(text);
      return res.json({
        tags: parsed.tags || [],
        suggestedTitle: parsed.title || null
      });
    } else {
      const fallback = generateFallbackTags([{ id: 'temp', title, url, description }]);
      return res.json({ tags: fallback['temp'] || ['reference'], suggestedTitle: null });
    }
  } catch (error) {
    console.warn('AI Enrichment fallback triggered:', error);
    const fallback = generateFallbackTags([{ id: 'temp', title, url, description }]);
    return res.json({ tags: fallback['temp'] || ['reference'], suggestedTitle: null });
  }
});

app.post('/api/ai/autotag', async (req, res) => {
  const { items } = req.body;
  
  if (!process.env.GEMINI_API_KEY) {
    console.log('GEMINI_API_KEY missing. Generating rule-based tags fallback.');
    return res.json({ tags: generateFallbackTags(items) });
  }

  const prompt = `You are an expert AI archivist. Your job is to assign high-quality, relevant, and consistent tags to the list of archived items below.
For each item, suggest 2-4 lowercase tags that link it to design, tech, productivity, aesthetics, media, or other precise topics. Try to reuse tags across similar and related items to create a clean, connected library of content.

Items to tag:
${JSON.stringify(items)}

Return ONLY a valid JSON object matching the structure below:
{
  "tags": {
    "item_id_1": ["tag1", "tag2"],
    "item_id_2": ["tag2", "tag3"]
  }
}

Do not include any other markdown, pretext, or posttext. Return only raw JSON.`;

  try {
    const text = await callGemini(prompt);
    if (text) {
      const parsed = JSON.parse(text);
      return res.json({
        tags: parsed.tags || generateFallbackTags(items)
      });
    } else {
      return res.json({ tags: generateFallbackTags(items) });
    }
  } catch (error) {
    console.warn('AI bulk tagging fallback triggered:', error);
    return res.json({ tags: generateFallbackTags(items) });
  }
});

app.post('/api/ai/search', async (req, res) => {
  const { query, items } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.json({ matchedIds: generateFallbackSearch(query, items) });
  }

  const prompt = `You are an intelligent search assistant. Match the user's semantic search query with the items in the list.\nQuery: "${query}"\n\nItems (JSON):\n${JSON.stringify(items)}\n\nReturn a raw JSON object containing an array of matched IDs under the key "matchedIds", sorted by relevance. Return ONLY JSON.`;

  try {
    const text = await callGemini(prompt);
    if (text) {
      return res.json(JSON.parse(text));
    } else {
      return res.json({ matchedIds: generateFallbackSearch(query, items) });
    }
  } catch (error) {
    console.warn('Semantic search fallback triggered:', error);
    return res.json({ matchedIds: generateFallbackSearch(query, items) });
  }
});

app.post('/api/ai/cluster', async (req, res) => {
  const { items } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    console.log('GEMINI_API_KEY missing. Generating rule-based colonies fallback.');
    return res.json({ colonies: generateFallbackColonies(items) });
  }

  const prompt = `Analyze the following list of archived items and automatically group them into 3-6 themed "Colonies" (folders).
For each colony, provide:
1. A unique ID (short slug)
2. A descriptive "name" (1-3 words)
3. A short "description" of what links them
4. An array of "itemIds" belonging to this colony.

Every item MUST belong to exactly one colony. If an item doesn't fit, put it in a "General" or "Miscellaneous" colony.

Items (JSON):
${JSON.stringify(items.map((i: any) => ({ id: i.id, title: i.title, type: i.type, tags: i.tags })))}

Return ONLY a JSON object with a "colonies" array.`;

  try {
    const text = await callGemini(prompt);
    if (text) {
      return res.json(JSON.parse(text));
    } else {
      return res.json({ colonies: generateFallbackColonies(items) });
    }
  } catch (error) {
    console.warn('Clustering fallback triggered:', error);
    return res.json({ colonies: generateFallbackColonies(items) });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
