import { useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Layers3, Plus, Trash2 } from 'lucide-react';
import { EmptyState, TrainingButton, TrainingCard, TrainingInput, TrainingModal, TrainingSelect } from '../../branding/components';
import { MediaPickerModal } from '../../components/MediaPickerModal';
import { blockTypes, createBlock, createModule, moveItem } from '../../utils/courseEditor';
import { resolveMediaUrl } from '../../utils/media';

function BlockFields({ block, onChange, onChooseImage }) {
  if (block.type === 'heading') return (
    <div className="form-grid">
      <TrainingInput label="Heading text" value={block.text || ''} onChange={(event) => onChange({ ...block, text: event.target.value })} />
      <TrainingSelect label="Heading level" value={block.level || 2} onChange={(event) => onChange({ ...block, level: Number(event.target.value) })}><option value="2">Section heading</option><option value="3">Subheading</option></TrainingSelect>
    </div>
  );
  if (block.type === 'paragraph') return <TrainingInput label="Paragraph" value={block.text || ''} onChange={(event) => onChange({ ...block, text: event.target.value })} multiline rows={6} />;
  if (block.type === 'callout') return (
    <>
      <div className="form-grid"><TrainingInput label="Callout title" value={block.title || ''} onChange={(event) => onChange({ ...block, title: event.target.value })} /><TrainingSelect label="Tone" value={block.tone || 'info'} onChange={(event) => onChange({ ...block, tone: event.target.value })}><option value="info">Information</option><option value="tip">Practical tip</option><option value="warning">Caution</option></TrainingSelect></div>
      <TrainingInput label="Callout text" value={block.text || ''} onChange={(event) => onChange({ ...block, text: event.target.value })} multiline rows={4} />
    </>
  );
  if (block.type === 'checklist') return <TrainingInput label="Checklist items" value={(block.items || []).map((item) => typeof item === 'string' ? item : item.text).join('\n')} onChange={(event) => onChange({ ...block, items: event.target.value.split('\n') })} multiline rows={5} hint="Place each checklist item on a new line." />;
  if (block.type === 'image') return (
    <>
      <div className="image-block-editor">{block.url ? <img src={resolveMediaUrl(block.url)} alt="Selected block preview" /> : <span>No image selected</span>}<TrainingButton variant="secondary" size="small" icon={<ImagePlus />} onClick={onChooseImage}>Choose from media</TrainingButton></div>
      <TrainingInput label="Image URL" value={block.url || ''} onChange={(event) => onChange({ ...block, url: event.target.value })} placeholder="/uploads/..." />
      <div className="form-grid"><TrainingInput label="Alternative text" value={block.altText || ''} onChange={(event) => onChange({ ...block, altText: event.target.value })} required /><TrainingInput label="Caption" value={block.caption || ''} onChange={(event) => onChange({ ...block, caption: event.target.value })} /></div>
      <div className="form-grid"><TrainingInput label="Credit (optional)" value={block.credit || ''} onChange={(event) => onChange({ ...block, credit: event.target.value })} /><TrainingSelect label="Display size" value={block.layout || 'wide'} onChange={(event) => onChange({ ...block, layout: event.target.value })}><option value="wide">Wide</option><option value="medium">Medium</option><option value="full">Full width</option></TrainingSelect></div>
    </>
  );
  return null;
}

export function ModuleEditor({ modules, errors, onChange }) {
  const [mediaTarget, setMediaTarget] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const updateModule = (index, nextModule) => onChange(modules.map((module, current) => current === index ? nextModule : module));
  const updateBlock = (moduleIndex, blockIndex, nextBlock) => updateModule(moduleIndex, { ...modules[moduleIndex], blocks: modules[moduleIndex].blocks.map((block, current) => current === blockIndex ? nextBlock : block) });
  const confirmRemove = () => {
    if (removeTarget?.type === 'module') onChange(modules.filter((_, index) => index !== removeTarget.moduleIndex));
    if (removeTarget?.type === 'block') {
      const module = modules[removeTarget.moduleIndex];
      updateModule(removeTarget.moduleIndex, { ...module, blocks: module.blocks.filter((_, index) => index !== removeTarget.blockIndex) });
    }
    setRemoveTarget(null);
  };

  return (
    <div className="editor-section-stack">
      <div className="editor-section-heading"><div><p className="eyebrow">Structured content</p><h2>Modules & learning blocks</h2><p>Build safe, readable content without raw HTML or JSON.</p></div><TrainingButton icon={<Plus />} onClick={() => onChange([...modules, createModule()])}>Add module</TrainingButton></div>
      {errors.modules && <p className="inline-error" role="alert">{errors.modules}</p>}
      {!modules.length ? <EmptyState title="No modules yet" message="Add the first module, then compose it from headings, paragraphs, callouts, checklists, and images." action={<TrainingButton icon={<Layers3 />} onClick={() => onChange([createModule()])}>Add first module</TrainingButton>} /> : modules.map((module, moduleIndex) => (
        <TrainingCard as="section" key={module._id || module._clientId} className="module-editor-card">
          <header className="module-editor-header">
            <span className="order-number">{moduleIndex + 1}</span>
            <TrainingInput aria-label={`Module ${moduleIndex + 1} title`} value={module.title || module.name || ''} onChange={(event) => updateModule(moduleIndex, { ...module, title: event.target.value })} error={errors[`module-${moduleIndex}`]} />
            <div className="move-controls"><TrainingButton variant="ghost" iconOnly icon={<ArrowUp />} disabled={moduleIndex === 0} onClick={() => onChange(moveItem(modules, moduleIndex, moduleIndex - 1))}>Move module up</TrainingButton><TrainingButton variant="ghost" iconOnly icon={<ArrowDown />} disabled={moduleIndex === modules.length - 1} onClick={() => onChange(moveItem(modules, moduleIndex, moduleIndex + 1))}>Move module down</TrainingButton><TrainingButton variant="danger" iconOnly icon={<Trash2 />} onClick={() => setRemoveTarget({ type: 'module', moduleIndex })}>Remove module</TrainingButton></div>
          </header>
          <TrainingInput label="Module summary" value={module.description || ''} onChange={(event) => updateModule(moduleIndex, { ...module, description: event.target.value })} placeholder="What will the learner cover?" />
          <div className="block-list">{(module.blocks || []).map((block, blockIndex) => (
            <article className="block-editor" key={block._id || block._clientId}>
              <header><div><span className="order-number order-number--small">{blockIndex + 1}</span><strong>{blockTypes.find((type) => type.value === block.type)?.label || block.type}</strong></div><div className="move-controls"><TrainingButton variant="ghost" iconOnly icon={<ArrowUp />} disabled={blockIndex === 0} onClick={() => updateModule(moduleIndex, { ...module, blocks: moveItem(module.blocks, blockIndex, blockIndex - 1) })}>Move block up</TrainingButton><TrainingButton variant="ghost" iconOnly icon={<ArrowDown />} disabled={blockIndex === module.blocks.length - 1} onClick={() => updateModule(moduleIndex, { ...module, blocks: moveItem(module.blocks, blockIndex, blockIndex + 1) })}>Move block down</TrainingButton><TrainingButton variant="ghost" iconOnly icon={<Trash2 />} onClick={() => setRemoveTarget({ type: 'block', moduleIndex, blockIndex })}>Remove block</TrainingButton></div></header>
              {errors[`block-${moduleIndex}-${blockIndex}`] && <p className="inline-error" role="alert">{errors[`block-${moduleIndex}-${blockIndex}`]}</p>}
              <BlockFields block={block} onChange={(next) => updateBlock(moduleIndex, blockIndex, next)} onChooseImage={() => setMediaTarget({ moduleIndex, blockIndex })} />
            </article>
          ))}</div>
          <div className="add-block-row"><span>Add learning block</span>{blockTypes.map((type) => <TrainingButton key={type.value} variant="ghost" size="small" icon={<Plus />} onClick={() => updateModule(moduleIndex, { ...module, blocks: [...(module.blocks || []), createBlock(type.value)] })}>{type.label}</TrainingButton>)}</div>
        </TrainingCard>
      ))}
      <TrainingModal open={Boolean(removeTarget)} onClose={() => setRemoveTarget(null)} title={`Remove this ${removeTarget?.type || 'item'}?`} description="This removes the item from the working course. The change takes effect when you save." footer={<><TrainingButton variant="ghost" onClick={() => setRemoveTarget(null)}>Cancel</TrainingButton><TrainingButton variant="danger" onClick={confirmRemove}>Remove</TrainingButton></>}><p>This action cannot be undone after the course is saved.</p></TrainingModal>
      <MediaPickerModal open={Boolean(mediaTarget)} onClose={() => setMediaTarget(null)} title="Choose an image block" onSelect={(asset) => { if (!mediaTarget) return; const { moduleIndex, blockIndex } = mediaTarget; updateBlock(moduleIndex, blockIndex, { ...modules[moduleIndex].blocks[blockIndex], url: asset.url, altText: asset.altText || '' }); }} />
    </div>
  );
}
