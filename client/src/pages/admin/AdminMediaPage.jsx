import { useCallback, useEffect, useState } from 'react';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { adminApi } from '../../api/admin';
import { EmptyState, ErrorState, LoadingState, TrainingButton, TrainingInput, TrainingModal } from '../../branding/components';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { PageHeader } from '../../components/PageHeader';
import { formatDate } from '../../utils/format';
import { resolveMediaUrl } from '../../utils/media';

export function AdminMediaPage() {
  const [state, setState] = useState({ loading: true, items: [], error: '' });
  const [form, setForm] = useState({ file: null, altText: '' });
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [removeAsset, setRemoveAsset] = useState(null);
  const [removing, setRemoving] = useState(false);
  const load = useCallback(async () => {
    try { setState({ loading: false, items: await adminApi.media(), error: '' }); }
    catch (error) { setState({ loading: false, items: [], error: error.message }); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const upload = async (event) => {
    event.preventDefault();
    if (!form.file) return setFeedback({ tone: 'danger', message: 'Choose an image to upload.' });
    if (!form.altText.trim()) return setFeedback({ tone: 'danger', message: 'Alternative text is required for every uploaded image.' });
    setUploading(true);
    setFeedback(null);
    try { await adminApi.uploadMedia(form.file, form.altText); setForm({ file: null, altText: '' }); setFeedback({ tone: 'success', message: 'Image uploaded to the media library.' }); await load(); }
    catch (error) { setFeedback({ tone: 'danger', message: error.message }); }
    finally { setUploading(false); }
  };

  const remove = async () => {
    setRemoving(true);
    try { await adminApi.deleteMedia(removeAsset._id || removeAsset.id); setRemoveAsset(null); setFeedback({ tone: 'success', message: 'Media asset removed.' }); await load(); }
    catch (error) { setFeedback({ tone: 'danger', message: error.message }); }
    finally { setRemoving(false); }
  };

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Course media" title="Media library" description="Approved local image assets for course covers and structured image blocks." />
      {feedback && <FeedbackBanner tone={feedback.tone} onDismiss={() => setFeedback(null)}>{feedback.message}</FeedbackBanner>}
      <form className="media-upload-panel" onSubmit={upload}><label className="file-drop"><Upload /><span><strong>{form.file ? form.file.name : 'Choose an image to upload'}</strong><small>JPEG, PNG, WebP, or GIF. File size and type are validated by the server.</small></span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => setForm((current) => ({ ...current, file: event.target.files?.[0] || null }))} /></label><TrainingInput label="Alternative text" value={form.altText} onChange={(event) => setForm((current) => ({ ...current, altText: event.target.value }))} placeholder="Describe the purpose of the image" required /><TrainingButton type="submit" loading={uploading} icon={<ImagePlus />}>Upload image</TrainingButton></form>
      {state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} onRetry={load} /> : state.items.length ? <div className="media-library-grid">{state.items.map((asset) => <article className="media-library-card" key={asset._id || asset.id || asset.url}><img src={resolveMediaUrl(asset.url)} alt={asset.altText || ''} /><div><strong>{asset.altText || asset.originalName || 'Course image'}</strong><small>{asset.originalName} · {formatDate(asset.createdAt)}</small><TrainingButton variant="danger" size="small" icon={<Trash2 />} onClick={() => setRemoveAsset(asset)}>Remove</TrainingButton></div></article>)}</div> : <EmptyState title="No media assets" message="Upload the first approved training visual above." />}
      <TrainingModal open={Boolean(removeAsset)} onClose={() => setRemoveAsset(null)} title="Remove this media asset?" description="The server will prevent unsafe deletion, but courses already using this URL may need a replacement." footer={<><TrainingButton variant="ghost" onClick={() => setRemoveAsset(null)}>Cancel</TrainingButton><TrainingButton variant="danger" loading={removing} onClick={remove}>Remove asset</TrainingButton></>}><p>{removeAsset?.originalName}</p></TrainingModal>
    </div>
  );
}
