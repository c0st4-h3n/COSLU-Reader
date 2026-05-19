// Markdown → HTML SANEADO, infra compartilhada (§13.3/§13.5):
// markdown-it com html:false + DOMPurify (3.4.x) na saída.
import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

export function renderSafeMarkdown(src: string): string {
  return DOMPurify.sanitize(md.render(src));
}
