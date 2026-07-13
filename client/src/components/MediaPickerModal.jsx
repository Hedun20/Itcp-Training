import { useCallback, useEffect, useState } from 'react';
import { Check, ImagePlus, Upload } from 'lucide-react';
import { adminApi } from '../api/admin';
import { EmptyState, ErrorState, LoadingState, TrainingButton, TrainingInput, TrainingModal } from '../branding/components';
import { FeedbackBanner } from './FeedbackBanner';
import { resolveMediaUrl } from '../utils/media';

export function MediaPickerModal({ open, onClose, onSelect, title = 'Choose media' }) {
  const [state, setState] = useState({ loading: false, items: [], error: '' });
  const [file, setFile] = useState(null);
  const [altText, setAltText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try { setState({ loading: false, items: await adminApi.media(), error: '' }); }
    catch (error) { setState({ loading: false, items: [], error: error.message }); }
  }, []);
  useEffect(() => { if (open) load(); }, [load, open]);
  const upload = async (event) => {
    event.preventDefault();
    if (!file) return setUploadError('Choose an image to upload.');
    if (!altText.trim()) return setUploadError('Alternative text is required for every uploaded image.');
    setUploading(true);
    setUploadError('');
    try {
      const asset = await adminApi.uploadMedia(file, altText);
      setState((current) => ({ ...current, items: [asset, ...current.items] }));
      setFile(null);
      setAltText('');
    } catch (error) { setUploadError(error.message); }
    finally { setUploading(false); }
  };
  return (
    <TrainingModal open={open} onClose={onClose} title={title} description="Upload an approved local image or choose one already in the ITCP media library." size="large">
      <form className="media-upload-inline" onSubmit={upload}>
        <label className="file-drop"><Upload /><span><strong>{file ? file.name : 'Choose an image'}</strong><small>PNG, JPG, WEBP, or GIF within the configured size limit</small></span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
        <TrainingInput label="Alternative text" value={altText} onChange={(event) => setAltText(event.target.value)} placeholder="Describe the image for learners" required />
        <TrainingButton type="submit" loading={uploading} icon={<ImagePlus />}>Upload image</TrainingButton>
      </form>
      {uploadError && <FeedbackBanner tone="danger">{uploadError}</FeedbackBanner>}
      <div className="media-picker-results">{state.loading ? <LoadingState compact label="Loading media…" /> : state.error ? <ErrorState message={state.error} onRetry={load} /> : state.items.length ? <div className="media-grid">{state.items.map((asset) => <button type="button" key={asset._id || asset.id || asset.url} className="media-tile" onClick={() => { onSelect(asset); onClose(); }}><img src={resolveMediaUrl(asset.url)} alt={asset.altText || ''} /><span><strong>{asset.altText || asset.originalName}</strong><Check /></span></button>)}</div> : <EmptyState title="Media library is empty" message="Upload the first approved course image above." />}</div>
    </TrainingModal>
  );
}
