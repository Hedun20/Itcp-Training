import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileJson,
  RefreshCw,
  UploadCloud,
} from 'lucide-react';
import { TrainingButton, TrainingModal } from '../../branding/components';
import {
  parseCourseImportFile,
  serializeCourseImportTemplate,
} from '../../utils/courseImport';

function downloadTemplate() {
  const blob = new Blob([serializeCourseImportTemplate()], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'itcp-course-import-template.v1.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function formatFileSize(size) {
  if (!Number.isFinite(size)) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function CourseImportModal({ open, onClose, onApply }) {
  const inputRef = useRef(null);
  const requestIdRef = useRef(0);
  const [phase, setPhase] = useState('idle');
  const [dragActive, setDragActive] = useState(false);
  const [fileMeta, setFileMeta] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    requestIdRef.current += 1;
    if (!open) return;
    setPhase('idle');
    setDragActive(false);
    setFileMeta(null);
    setResult(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  }, [open]);

  const processFile = async (file) => {
    if (!file) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setFileMeta({ name: file.name || 'course.json', size: Number(file.size) || 0 });
    setPhase('processing');
    setError('');
    setResult(null);
    try {
      const imported = await parseCourseImportFile(file);
      if (requestId !== requestIdRef.current) return;
      setResult(imported);
      setPhase('ready');
    } catch (importError) {
      if (requestId !== requestIdRef.current) return;
      setError(importError?.message || 'The course JSON could not be imported.');
      setPhase('error');
    }
  };

  const chooseFile = () => inputRef.current?.click();
  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    const [file] = Array.from(event.dataTransfer?.files || []);
    processFile(file);
  };

  const reset = () => {
    setPhase('idle');
    setFileMeta(null);
    setResult(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const apply = () => {
    if (!result) return;
    onApply?.(result);
    onClose?.();
  };

  const footer = (
    <>
      <TrainingButton variant="ghost" onClick={onClose} disabled={phase === 'processing'}>Cancel</TrainingButton>
      {phase === 'ready' && (
        <TrainingButton icon={<CheckCircle2 />} onClick={apply}>Apply to course</TrainingButton>
      )}
      {phase === 'error' && (
        <TrainingButton variant="secondary" icon={<RefreshCw />} onClick={reset}>Choose another file</TrainingButton>
      )}
    </>
  );

  const reportIssues = result
    ? [...result.report.autoFixed, ...result.report.reviewRequired]
    : [];

  return (
    <TrainingModal
      open={open}
      onClose={() => { if (phase !== 'processing') onClose?.(); }}
      title="Import course from JSON"
      description="Upload one complete course file. ITCP Training will repair safe formatting issues and fill course details, modules, learning blocks, and assessment questions."
      size="large"
      eyebrow="Course automation"
      footer={footer}
    >
      <div className="course-import-stack">
        <div className="course-import-toolbar">
          <div>
            <strong>Use the official structure</strong>
            <span>Download the template and give it to ChatGPT, Claude, or another assistant.</span>
          </div>
          <TrainingButton variant="secondary" icon={<Download />} onClick={downloadTemplate}>
            Download JSON template
          </TrainingButton>
        </div>

        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept=".json,application/json"
          onChange={(event) => processFile(event.target.files?.[0])}
        />

        {phase === 'idle' && (
          <div
            className={`course-import-dropzone${dragActive ? ' is-dragging' : ''}`}
            role="button"
            tabIndex={0}
            onClick={chooseFile}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                chooseFile();
              }
            }}
            onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
            onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false);
            }}
            onDrop={handleDrop}
          >
            <span className="course-import-dropzone__icon"><UploadCloud /></span>
            <strong>Drop your JSON file here</strong>
            <span>or click to choose a file</span>
            <small>JSON only · maximum 5 MB</small>
          </div>
        )}

        {phase === 'processing' && (
          <div className="course-import-status" role="status" aria-live="polite">
            <span className="course-import-spinner" aria-hidden="true" />
            <div>
              <strong>Checking and preparing the course…</strong>
              <span>{fileMeta?.name} {fileMeta?.size ? `· ${formatFileSize(fileMeta.size)}` : ''}</span>
              <small>Reading JSON, repairing safe formatting issues, validating fields, and building the editor draft.</small>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="course-import-result course-import-result--error" role="alert">
            <span className="course-import-result__icon"><AlertTriangle /></span>
            <div>
              <strong>Course JSON could not be imported</strong>
              <p>{error}</p>
              {fileMeta && <small>{fileMeta.name} · {formatFileSize(fileMeta.size)}</small>}
            </div>
          </div>
        )}

        {phase === 'ready' && result && (
          <div className="course-import-ready" aria-live="polite">
            <div className="course-import-result course-import-result--success">
              <span className="course-import-result__icon"><CheckCircle2 /></span>
              <div>
                <strong>Course JSON verified</strong>
                <p>The imported content is ready to fill the current course draft.</p>
                {fileMeta && <small>{fileMeta.name} · {formatFileSize(fileMeta.size)}</small>}
              </div>
            </div>

            <div className="course-import-stats" aria-label="Import summary">
              <div><strong>{result.report.stats.modules}</strong><span>Modules</span></div>
              <div><strong>{result.report.stats.blocks}</strong><span>Learning blocks</span></div>
              <div><strong>{result.report.stats.questions}</strong><span>Questions</span></div>
              <div><strong>{result.report.autoFixed.length}</strong><span>Auto-fixed</span></div>
            </div>

            {result.report.reviewRequired.length > 0 && (
              <div className="course-import-review-note">
                <AlertTriangle />
                <div>
                  <strong>{result.report.reviewRequired.length} field{result.report.reviewRequired.length === 1 ? '' : 's'} {result.report.reviewRequired.length === 1 ? 'requires' : 'require'} review</strong>
                  <span>The course will still be imported as a draft. Publishing validation will keep incomplete fields visible.</span>
                </div>
              </div>
            )}

            {reportIssues.length > 0 && (
              <details className="course-import-details">
                <summary>View import report</summary>
                <ul>
                  {reportIssues.slice(0, 12).map((issue, index) => (
                    <li key={`${issue.path}-${index}`}>
                      <FileJson />
                      <span><strong>{issue.path}</strong>{issue.message}</span>
                    </li>
                  ))}
                </ul>
                {reportIssues.length > 12 && <p>And {reportIssues.length - 12} more report items.</p>}
              </details>
            )}
          </div>
        )}
      </div>
    </TrainingModal>
  );
}
