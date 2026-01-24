import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { Loader2, AlertCircle } from 'lucide-react';

// Map slugs to file imports
// In Vite, we can import files as raw strings using ?raw
// We need to define the mapping explicitly or use a glob import if dynamic
const docFiles = import.meta.glob('../content/docs/**/*.md', { query: '?raw', import: 'default' });

export default function SetupPage() {
  const { category, slug } = useParams();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadContent() {
      if (!category || !slug) return;

      setLoading(true);
      setError(null);

      try {
        const path = `../content/docs/${category}/${slug}.md`;
        const loader = docFiles[path];

        if (!loader) {
          throw new Error('Document not found');
        }

        const mdContent = (await loader()) as string;
        setContent(mdContent);
      } catch (err) {
        console.error('Failed to load markdown:', err);
        setError('Document not found or could not be loaded.');
      } finally {
        setLoading(false);
      }
    }

    loadContent();
  }, [category, slug]);

  if (loading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <Loader2 className='w-8 h-8 animate-spin text-primary' />
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex flex-col items-center justify-center h-64 text-muted-foreground gap-4'>
        <AlertCircle className='w-12 h-12 stroke-[1.5]' />
        <p>{error}</p>
      </div>
    );
  }

  return <MarkdownRenderer content={content} />;
}
