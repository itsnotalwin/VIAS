// Client-side AI and rule-based fallbacks
// Ensures clustering, tagging, and design critique work seamlessly on static hosts like GitHub Pages

export function generateFallbackTags(items: any[]): Record<string, string[]> {
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
      item.tags.forEach((t: string) => {
        if (typeof t === 'string' && t.trim()) tags.add(t.toLowerCase().trim());
      });
    }

    result[item.id] = Array.from(tags).slice(0, 4);
  }
  return result;
}

export function generateFallbackColonies(items: any[]): Array<{ id: string; name: string; description: string; itemIds: string[] }> {
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

export function generateFallbackAnalysis(item: any): {
  aesthetic: string;
  colors: string[];
  typography: string;
  review: string;
  vibe: string;
} {
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
