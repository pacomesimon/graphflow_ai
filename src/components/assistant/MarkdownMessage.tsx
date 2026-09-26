import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface MarkdownMessageProps {
  content: string;
  isDark: boolean;
}

const CodeBlock: React.FC<{ code: string; language: string; isDark: boolean }> = ({
  code,
  language,
  isDark
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`my-2.5 rounded-lg border overflow-hidden font-mono text-xs shadow-xs ${
      isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100'
    }`}>
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-850/90 border-b border-slate-800 text-[10px] text-slate-400 select-none">
        <span className="uppercase font-semibold tracking-wider text-sky-400">{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3 overflow-x-auto text-[11px] leading-relaxed text-slate-200">
        <pre className="!bg-transparent !p-0 !m-0 font-mono">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};

export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content, isDark }) => {
  return (
    <div className="markdown-body leading-relaxed text-xs">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p({ children }) {
            return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
          },
          strong({ children }) {
            return (
              <strong className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {children}
              </strong>
            );
          },
          em({ children }) {
            return <em className="italic">{children}</em>;
          },
          h1({ children }) {
            return (
              <h1 className={`text-sm font-bold mt-3 mb-1.5 pb-1 border-b ${
                isDark ? 'border-slate-800 text-slate-100' : 'border-slate-200 text-slate-900'
              }`}>
                {children}
              </h1>
            );
          },
          h2({ children }) {
            return (
              <h2 className="text-xs font-bold mt-2.5 mb-1 text-sky-400">
                {children}
              </h2>
            );
          },
          h3({ children }) {
            return (
              <h3 className={`text-xs font-semibold mt-2 mb-0.5 ${
                isDark ? 'text-slate-200' : 'text-slate-800'
              }`}>
                {children}
              </h3>
            );
          },
          ul({ children }) {
            return <ul className="list-disc pl-4 space-y-1 my-1.5 marker:text-sky-500">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-4 space-y-1 my-1.5 marker:text-sky-500">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>;
          },
          blockquote({ children }) {
            return (
              <blockquote className={`border-l-2 border-sky-500 pl-2.5 py-0.5 my-2 italic ${
                isDark ? 'bg-sky-500/5 text-slate-300' : 'bg-sky-50/50 text-slate-600'
              }`}>
                {children}
              </blockquote>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:text-sky-300 underline underline-offset-2 inline-flex items-center gap-0.5 font-medium transition-colors"
              >
                <span>{children}</span>
                <ExternalLink className="w-2.5 h-2.5 inline shrink-0" />
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-2.5 rounded-lg border border-slate-700/60">
                <table className="min-w-full divide-y divide-slate-700/60 text-[11px] font-mono">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return (
              <thead className={isDark ? 'bg-slate-800/80 text-slate-200' : 'bg-slate-200/70 text-slate-800'}>
                {children}
              </thead>
            );
          },
          th({ children }) {
            return <th className="px-2.5 py-1.5 text-left font-semibold">{children}</th>;
          },
          td({ children }) {
            return (
              <td className={`px-2.5 py-1 border-t ${
                isDark ? 'border-slate-800/80 text-slate-300' : 'border-slate-200 text-slate-700'
              }`}>
                {children}
              </td>
            );
          },
          code({ className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            const isMultiLine = codeString.includes('\n');

            if (match || isMultiLine) {
              return (
                <CodeBlock
                  code={codeString}
                  language={match ? match[1] : ''}
                  isDark={isDark}
                />
              );
            }

            return (
              <code
                className={`font-mono text-[11px] px-1.5 py-0.5 rounded border ${
                  isDark
                    ? 'bg-slate-800/90 text-sky-300 border-slate-700/70'
                    : 'bg-slate-200/80 text-sky-800 border-slate-300'
                }`}
                {...props}
              >
                {children}
              </code>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
