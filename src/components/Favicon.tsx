import React, { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';

interface FaviconProps {
  domain: string;
  className?: string;
}

export const Favicon: React.FC<FaviconProps> = ({ domain, className = "w-4 h-4 rounded" }) => {
  const [errorRef, setErrorRef] = useState(false);
  
  // Clean domain and get apex domain
  const cleanDomain = (dom: string): string => {
    try {
      const parts = dom.toLowerCase().replace(/^www\./, '').split('.');
      if (parts.length > 2) {
        const last = parts[parts.length - 1];
        const second = parts[parts.length - 2];
        // If secondary domain is co / org / net / com / gov, we might want to keep 3 parts (e.g. co.uk)
        if (['com', 'org', 'net', 'edu', 'gov', 'co', 'io', 'me', 'tv'].includes(second) || (last.length === 2 && second.length <= 3)) {
          if (parts.length > 3) {
            return parts.slice(-3).join('.');
          }
        }
        return parts.slice(-2).join('.');
      }
      return dom;
    } catch {
      return dom;
    }
  };

  const apex = cleanDomain(domain);
  const firstLetter = apex ? apex.charAt(0).toUpperCase() : 'W';

  // If the domain changes, reset error state
  useEffect(() => {
    setErrorRef(false);
  }, [domain]);

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(apex)}&sz=64`;

  if (errorRef || !domain || domain === 'local upload') {
    // Elegant fallback with nice pastel tones based on the first letter char code
    const colors = [
      'bg-[var(--text)]/5 text-[var(--text-muted)] border-[var(--border-bright)]',
      'bg-[var(--text)]/5 text-[var(--text-muted)] border-[var(--border-bright)]',
      'bg-[var(--text)]/5 text-[var(--text-muted)] border-[var(--border-bright)]',
      'bg-[var(--text)]/5 text-[var(--text-muted)] border-[var(--border-bright)]',
      'bg-[var(--text)]/5 text-[var(--text-muted)] border-[var(--border-bright)]',
      'bg-[var(--text)]/5 text-[var(--text-muted)] border-[var(--border-bright)]',
      'bg-[var(--text)]/5 text-[var(--text-muted)] border-[var(--border-bright)]'
    ];
    const colorIndex = firstLetter.charCodeAt(0) % colors.length;
    const colorClass = colors[colorIndex];

    return (
      <div 
        className={`${className} flex items-center justify-center font-bold text-[9px] uppercase border font-sans select-none shrink-0 ${colorClass}`}
        title={domain}
      >
        {firstLetter}
      </div>
    );
  }

  return (
    <img 
      src={faviconUrl} 
      className={`${className} object-contain shrink-0`}
      style={{ imageRendering: '-webkit-optimize-contrast' }}
      alt={domain}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        setErrorRef(true);
      }}
    />
  );
};
