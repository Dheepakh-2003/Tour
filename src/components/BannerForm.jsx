import { useEffect, useRef, useState } from 'react';

const ALLOWED_TYPES = { 'image/jpeg': true, 'image/png': true, 'image/webp': true };
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const MAX_BYTES = 4 * 1024 * 1024;
const HEADER_MAX = 120;
const DESCRIPTION_MAX = 2000;

function checkImage(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  if (!ALLOWED_TYPES[file.type] || !ALLOWED_EXTENSIONS.includes(extension)) return 'Please choose a JPG, PNG or WEBP image.';
  if (file.size > MAX_BYTES) return 'Image must be smaller than 4 MB.';
  return '';
}

/** Add / edit form: exactly three fields — image, header, description. */
export default function BannerForm({ banner, busy, onSubmit, onCancel }) {
  const isEdit = Boolean(banner);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(banner?.image ?? '');
  const [header, setHeader] = useState(banner?.header ?? '');
  const [description, setDescription] = useState(banner?.description ?? '');
  const [errors, setErrors] = useState({});
  const objectUrl = useRef(null);

  useEffect(() => () => objectUrl.current && URL.revokeObjectURL(objectUrl.current), []);

  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  const chooseFile = (event) => {
    const chosen = event.target.files?.[0];
    if (!chosen) return;
    const problem = checkImage(chosen);
    if (problem) {
      setErrors((current) => ({ ...current, image: problem }));
      event.target.value = '';
      return;
    }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(chosen);
    setFile(chosen);
    setPreview(objectUrl.current);
    setErrors((current) => ({ ...current, image: '' }));
  };

  const submit = (event) => {
    event.preventDefault();
    const next = {};
    if (!isEdit && !file) next.image = 'An image is required.';
    if (!header.trim()) next.header = 'Header is required.';
    if (!description.trim()) next.description = 'Description is required.';
    setErrors(next);
    if (Object.keys(next).length === 0) onSubmit({ image: file, header: header.trim(), description: description.trim() });
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <form className="dialog" onSubmit={submit} noValidate aria-modal="true" role="dialog" aria-labelledby="form-title">
        <h2 id="form-title">{isEdit ? 'Edit banner' : 'Add banner'}</h2>

        <div className="field">
          <span>Image</span>
          <label className={`dropzone ${errors.image ? 'has-error' : ''}`}>
            {preview ? <img src={preview} alt="Selected banner preview" /> : <span>Click to choose a JPG, PNG or WEBP image (max 4 MB)</span>}
            <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={chooseFile} disabled={busy} />
          </label>
          {preview && <span className="hint">{isEdit && !file ? 'Click the image to replace it.' : 'Click the image to change it.'}</span>}
          {errors.image && <span className="field-error">{errors.image}</span>}
        </div>

        <label className="field">
          <span>Header</span>
          <input type="text" value={header} maxLength={HEADER_MAX} onChange={(e) => setHeader(e.target.value)} disabled={busy} placeholder="Banner heading" />
          {errors.header && <span className="field-error">{errors.header}</span>}
        </label>

        <label className="field">
          <span>Description</span>
          <textarea rows={5} value={description} maxLength={DESCRIPTION_MAX} onChange={(e) => setDescription(e.target.value)} disabled={busy} placeholder="Write the description shown below the heading" />
          <span className="hint">{description.length} / {DESCRIPTION_MAX}</span>
          {errors.description && <span className="field-error">{errors.description}</span>}
        </label>

        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save Banner'}
          </button>
        </div>
      </form>
    </div>
  );
}
