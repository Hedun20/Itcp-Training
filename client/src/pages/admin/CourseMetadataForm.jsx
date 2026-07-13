import { ImagePlus, Trash2 } from 'lucide-react';
import { TrainingButton, TrainingCard, TrainingInput, TrainingSelect } from '../../branding/components';
import { resolveMediaUrl } from '../../utils/media';

export function CourseMetadataForm({ course, errors, onChange, onChooseCover }) {
  const set = (field) => (event) => onChange({ ...course, [field]: event.target.value });
  return (
    <div className="editor-section-stack">
      <TrainingCard className="editor-panel">
        <div className="editor-panel__heading"><div><p className="eyebrow">Core information</p><h2>Course details</h2><p>Give learners a clear, scannable reason to start.</p></div></div>
        <div className="form-grid form-grid--three">
          <TrainingInput label="Course code" value={course.code} onChange={set('code')} required error={errors.code} minLength={2} maxLength={30} placeholder="DCT-01" />
          <TrainingInput label="URL slug" value={course.slug} onChange={set('slug')} required error={errors.slug} minLength={2} maxLength={160} placeholder="digital-capability" />
          <TrainingInput label="Estimated duration" value={course.estimatedDuration} onChange={set('estimatedDuration')} error={errors.estimatedDuration} maxLength={80} placeholder="45 minutes" />
        </div>
        <TrainingInput label="Course title" value={course.title} onChange={set('title')} required error={errors.title} minLength={2} maxLength={240} placeholder="Course title" />
        <TrainingInput label="Short description" value={course.shortDescription} onChange={set('shortDescription')} required error={errors.shortDescription} multiline rows={3} maxLength={600} hint={`${course.shortDescription?.length || 0}/600 characters`} placeholder="A concise catalog description" />
        <TrainingInput label="Full description" value={course.description} onChange={set('description')} error={errors.description} multiline rows={6} maxLength={10000} placeholder="Explain the outcomes, audience, and value of this course." />
        <div className="form-grid form-grid--three">
          <TrainingInput label="Category" value={course.category} onChange={set('category')} error={errors.category} maxLength={120} placeholder="Digital capability" />
          <TrainingInput label="Tags" value={(course.tags || []).join(', ')} onChange={(event) => onChange({ ...course, tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} error={errors.tags} hint="Separate up to 30 tags with commas; 80 characters per tag." placeholder="leadership, safety" />
          <TrainingInput label="Pass mark (%)" type="number" min="0" max="100" value={course.passMark} onChange={set('passMark')} required error={errors.passMark} />
        </div>
      </TrainingCard>
      <TrainingCard className="editor-panel">
        <div className="editor-panel__heading"><div><p className="eyebrow">Catalog artwork</p><h2>Cover image</h2><p>Use approved local or uploaded training visuals with meaningful alternative text.</p></div></div>
        <div className="cover-editor">
          <div className="cover-preview">{course.coverImage ? <img src={resolveMediaUrl(course.coverImage)} alt="Selected course cover preview" /> : <span><ImagePlus /><strong>No cover selected</strong></span>}{errors.coverImage && <p className="inline-error" role="alert">{errors.coverImage}</p>}</div>
          <div className="button-column"><TrainingButton variant="secondary" icon={<ImagePlus />} onClick={onChooseCover}>{course.coverImage ? 'Change cover' : 'Choose cover'}</TrainingButton>{course.coverImage && <TrainingButton variant="ghost" icon={<Trash2 />} onClick={() => onChange({ ...course, coverImage: '' })}>Remove cover</TrainingButton>}</div>
        </div>
      </TrainingCard>
      <TrainingCard className="editor-panel">
        <div className="editor-panel__heading"><div><p className="eyebrow">Publication</p><h2>Release settings</h2><p>Status changes are recorded in the administrative audit trail.</p></div></div>
        <TrainingSelect label="Working status" value={course.status || 'draft'} disabled><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></TrainingSelect>
      </TrainingCard>
    </div>
  );
}
