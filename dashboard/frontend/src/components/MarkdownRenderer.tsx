import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className='w-full max-w-4xl mx-auto pb-20 animate-fade-in-up'>
      <ReactMarkdown
        rehypePlugins={[rehypeHighlight]}
        components={{
          h1: ({ children }: any) => (
            <h1 className='text-3xl md:text-4xl font-bold tracking-tight mb-6 text-foreground border-b border-border pb-4'>
              {children}
            </h1>
          ),
          h2: ({ children }: any) => (
            <h2 className='text-2xl md:text-3xl font-semibold tracking-tight mt-10 mb-4 text-foreground flex items-center gap-2'>
              <span className='w-1.5 h-6 bg-brand-500 rounded-full inline-block' />
              {children}
            </h2>
          ),
          h3: ({ children }: any) => <h3 className='text-xl font-semibold mt-8 mb-3 text-foreground/90'>{children}</h3>,
          p: ({ children }: any) => <p className='text-base text-muted-foreground leading-7 mb-4'>{children}</p>,
          ul: ({ children }: any) => (
            <ul className='my-6 ml-6 list-disc [&>li]:mt-2 text-muted-foreground'>{children}</ul>
          ),
          ol: ({ children }: any) => (
            <ol className='my-6 ml-6 list-decimal [&>li]:mt-2 text-muted-foreground'>{children}</ol>
          ),
          li: ({ children }: any) => <li className='leading-7'>{children}</li>,
          blockquote: ({ children }: any) => (
            <div className='mt-6 border-l-4 border-brand-500 pl-6 italic bg-brand-500/5 py-4 pr-4 rounded-r-lg text-muted-foreground'>
              {children}
            </div>
          ),
          a: ({ href, children }: any) => (
            <a
              href={href}
              className='font-medium text-brand-500 underline underline-offset-4 hover:text-brand-600 transition-colors'
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
            >
              {children}
            </a>
          ),
          code: ({ className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;
            return isInline ? (
              <code className='relative rounded bg-muted px-[0.4rem] py-[0.2rem] font-mono text-sm font-semibold text-foreground border border-border'>
                {children}
              </code>
            ) : (
              <div className='relative my-6 rounded-lg border bg-muted/50 p-4 font-mono text-sm overflow-x-auto'>
                <code className={className} {...props}>
                  {children}
                </code>
              </div>
            );
          },
          table: ({ children }: any) => (
            <div className='my-6 w-full overflow-y-auto rounded-lg border border-border'>
              <table className='w-full text-sm'>{children}</table>
            </div>
          ),
          thead: ({ children }: any) => (
            <thead className='bg-muted/50 text-left font-medium text-muted-foreground'>{children}</thead>
          ),
          tbody: ({ children }: any) => <tbody className='divide-y divide-border bg-background'>{children}</tbody>,
          tr: ({ children }: any) => (
            <tr className='transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted'>{children}</tr>
          ),
          th: ({ children }: any) => (
            <th className='px-4 py-3 align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0'>
              {children}
            </th>
          ),
          td: ({ children }: any) => (
            <td className='px-4 py-3 align-middle [&:has([role=checkbox])]:pr-0'>{children}</td>
          ),
          hr: () => <hr className='my-8 border-border' />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
