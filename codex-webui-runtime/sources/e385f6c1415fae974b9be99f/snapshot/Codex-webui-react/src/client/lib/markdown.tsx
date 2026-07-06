import * as React from 'react';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inline(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="text-primary underline" target="_blank" rel="noreferrer" href="$2">$1</a>');
}

export function Markdown({ text }: { text: string }) {
  const html = React.useMemo(() => {
    const lines = String(text || '').split(/\r?\n/);
    const out: string[] = [];
    let code: string[] = [];
    let inCode = false;
    let paragraph: string[] = [];
    const flushParagraph = () => {
      if (!paragraph.length) return;
      out.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    };
    const flushCode = () => {
      out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      code = [];
    };
    for (const line of lines) {
      if (line.trim().startsWith('```')) {
        if (inCode) {
          flushCode();
          inCode = false;
        } else {
          flushParagraph();
          inCode = true;
        }
        continue;
      }
      if (inCode) {
        code.push(line);
        continue;
      }
      if (!line.trim()) {
        flushParagraph();
        continue;
      }
      if (/^#{1,4}\s+/.test(line)) {
        flushParagraph();
        const level = Math.min(4, line.match(/^#+/)?.[0].length || 2);
        out.push(`<h${level}>${inline(line.replace(/^#+\s+/, ''))}</h${level}>`);
        continue;
      }
      paragraph.push(line);
    }
    flushParagraph();
    if (inCode) flushCode();
    return out.join('');
  }, [text]);
  return <div className="message-markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}
