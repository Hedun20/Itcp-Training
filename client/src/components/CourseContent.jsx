import { Check, CircleCheckBig, Info, Lightbulb, TriangleAlert } from 'lucide-react';
import { resolveMediaUrl } from '../utils/media';

function blockText(block) {
  return block.text || block.content || '';
}

export function CourseContent({ blocks = [] }) {
  if (!blocks.length) return <p className="muted">This module’s content is being prepared.</p>;
  return (
    <div className="course-content">
      {blocks.map((block, index) => {
        const key = block._id || block.id || `${block.type}-${index}`;
        if (block.type === 'heading') {
          const Heading = block.level === 4 ? 'h4' : block.level === 3 ? 'h3' : 'h2';
          return <Heading key={key}>{blockText(block)}</Heading>;
        }
        if (block.type === 'paragraph') return <p key={key}>{blockText(block)}</p>;
        if (block.type === 'callout') {
          const Icon = block.tone === 'tip' ? Lightbulb : block.tone === 'warning' ? TriangleAlert : block.tone === 'success' ? CircleCheckBig : Info;
          return <aside key={key} className={`content-callout content-callout--${block.tone || 'info'}`}><span><Icon aria-hidden="true" /></span><div>{block.title && <strong>{block.title}</strong>}<p>{blockText(block)}</p></div></aside>;
        }
        if (block.type === 'checklist') {
          const items = block.items || [];
          return <ul key={key} className="content-checklist">{items.map((item, itemIndex) => <li key={`${key}-${itemIndex}`}><Check aria-hidden="true" />{typeof item === 'string' ? item : item.text}</li>)}</ul>;
        }
        if (block.type === 'image') {
          const src = block.url || block.src || block.imageUrl || block.image?.url || block.image?.src;
          if (!src) return null;
          return <figure key={key} className={`content-image content-image--${block.layout || block.displaySize || 'wide'}`}><img src={resolveMediaUrl(src)} alt={block.altText || block.alt || ''} loading="lazy" />{(block.caption || block.credit || block.placeholder) && <figcaption><span>{block.caption}{block.placeholder && <em>Training visual placeholder</em>}</span>{block.credit && <small>Credit: {block.credit}</small>}</figcaption>}</figure>;
        }
        return null;
      })}
    </div>
  );
}
