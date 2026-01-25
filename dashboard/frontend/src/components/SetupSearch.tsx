import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

// Load all markdown files for search
const docFiles = import.meta.glob('../content/docs/**/*.md', { query: '?raw', import: 'default', eager: true });

interface SearchResult {
  path: string;
  title: string; // From metadata or first H1 or filename
  category: string;
  snippet: string;
  matchScore: number;
}

interface DocContent {
  path: string;
  content: string;
  category: string;
  slug: string;
}

export default function SetupSearch() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Process and index documents
  const documents: DocContent[] = useMemo(() => {
    return Object.entries(docFiles).map(([path, content]) => {
      // Path format: ../content/docs/category/slug.md
      const parts = path.split('/');
      const filename = parts.pop()!;
      const category = parts.pop()!;
      const slug = filename.replace('.md', '');

      return {
        path: `/setup/${category}/${slug}`,
        content: content as string,
        category,
        slug,
      };
    });
  }, []);

  // Search logic
  const results: SearchResult[] = useMemo(() => {
    if (!query || query.length < 2) return [];

    const lowerQuery = query.toLowerCase();

    return documents
      .map((doc) => {
        const lowerContent = doc.content.toLowerCase();
        const lowerCategory = doc.category.toLowerCase();
        const lowerSlug = doc.slug.toLowerCase().replace(/-/g, ' ');

        // Simple scoring
        let score = 0;

        // Match in Slug/Title (High priority)
        if (lowerSlug.includes(lowerQuery)) score += 10;

        // Match in Category
        if (lowerCategory.includes(lowerQuery)) score += 5;

        // Match in Content
        const contentIndex = lowerContent.indexOf(lowerQuery);
        if (contentIndex !== -1) score += 1;

        if (score === 0) return null;

        // Extract Snippet
        let snippet = '';
        if (contentIndex !== -1) {
          const start = Math.max(0, contentIndex - 30);
          const end = Math.min(doc.content.length, contentIndex + 100);
          // Simple cleanup
          snippet = doc.content
            .substring(start, end)
            .replace(/[#*`]/g, '') // Remove basic MD syntax
            .replace(/\n/g, ' ');
          if (start > 0) snippet = '...' + snippet;
          if (end < doc.content.length) snippet = snippet + '...';
        } else {
          // Default snippet from start
          snippet = doc.content.substring(0, 100).replace(/[#*`]/g, '').replace(/\n/g, ' ') + '...';
        }

        // Extract Title from first H1 if possible
        const h1Match = doc.content.match(/^#\s+(.+)$/m);
        const title = h1Match
          ? h1Match[1]
          : doc.slug
              .split('-')
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ');

        return {
          path: doc.path,
          title,
          category: doc.category.charAt(0).toUpperCase() + doc.category.slice(1),
          snippet,
          matchScore: score,
        };
      })
      .filter((r): r is SearchResult => r !== null)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5); // Limit to 5 results
  }, [query, documents]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [wrapperRef]);

  const handleSelect = (path: string) => {
    navigate(path);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div className='relative w-full px-3 mb-6' ref={wrapperRef}>
      <div className='relative'>
        <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
        <input
          type='text'
          placeholder='Search guide...'
          className={cn(
            'w-full pl-9 pr-4 py-2 bg-secondary/50 border border-transparent rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground transition-all',
            isOpen && results.length > 0 ? 'rounded-b-none border-border' : ''
          )}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
      </div>

      {/* Results Dropdown */}
      {isOpen && query.length >= 2 && results.length > 0 && (
        <div className='absolute left-3 right-3 top-full bg-popover border border-border border-t-0 rounded-b-md shadow-lg z-50 overflow-hidden'>
          <div className='py-1'>
            {results.map((result, idx) => (
              <button
                key={idx}
                onClick={() => handleSelect(result.path)}
                className='w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-start gap-3 group border-b border-border/50 last:border-0'
              >
                <FileText className='w-5 h-5 text-muted-foreground group-hover:text-primary mt-0.5' />
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center gap-2 mb-0.5'>
                    <span className='font-medium text-foreground text-sm truncate'>{result.title}</span>
                    <span className='text-muted-foreground text-xs flex items-center'>
                      <ChevronRight className='w-3 h-3 mx-0.5' />
                      {result.category}
                    </span>
                  </div>
                  <p className='text-xs text-muted-foreground line-clamp-2'>{result.snippet}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {isOpen && query.length >= 2 && results.length === 0 && (
        <div className='absolute left-3 right-3 top-full bg-popover border border-border border-t-0 rounded-b-md shadow-lg z-50 p-4 text-center text-muted-foreground text-sm'>
          No results found.
        </div>
      )}
    </div>
  );
}
