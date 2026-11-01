import { useEffect, useRef, useState } from 'react';
import { uploadApi } from '../services/api.js';
import { ACCEPT, typeProblem } from '../utils/image.js';
import { useToast } from './Toast.jsx';

const MAX_IMAGES = 8;
const HEADER_MAX = 120;
const DESCRIPTION_MAX = 2000;

/**
 * Add / edit form: images (one or more), header, description.
 * Images upload as soon as they are chosen; only their paths are sent when the banner is saved.
 */
export default function BannerForm({ banner, busy, onSubmit, onCancel }) {
  const toast = useToast();
  const isEdit = Boolean(banner);
  const [items, setItems] = useState(() =>
    (banner?.images ?? []).map((image) => ({ key: image.path, path: image.path, url: image.url, status: 'done', isNew: false })),
  );
  const [header, setHeader] = useState(banner?.header ?? '');
  const [description, setDescription] = useState(banner?.description ?? '');
  const [errors, setErrors] = useState({});
  const itemsRef = useRef(items);
  const closedRef = useRef(false);
  const objectUrls = useRef([]);
  itemsRef.current = items;

  useEffect(() => {
    closedRef.current = false; // React StrictMode re-mounts effects in dev, so reset on every mount
    return () => {
      closedRef.current = true;
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const patchItem = (key, patch) => setItems((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const addFiles = (event) => {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = '';
    const room = MAX_IMAGES - itemsRef.current.length;
    if (chosen.length > room) toast.error(`A banner can have at most ${MAX_IMAGES} images.`);

    for (const file of chosen.slice(0, Math.max(room, 0))) {
      const problem = typeProblem(file);
      if (problem) {
        toast.error(`${file.name}: ${problem}`);
        continue;
      }
      const preview = URL.createObjectURL(file);
      objectUrls.current.push(preview);
      const key = `new-${crypto.randomUUID()}`;
      setItems((list) => [...list, { key, path: null, url: preview, status: 'uploading', isNew: true }]);
      setErrors((current) => ({ ...current, images: '' }));

      uploadApi
        .upload(file)
        .then(({ path }) => {
          if (closedRef.current) uploadApi.discard(path); // form was closed while uploading
          else patchItem(key, { path, status: 'done' });
        })
        .catch((error) => {
          toast.error(`${file.name}: ${error.message}`);
          setItems((list) => list.filter((item) => item.key !== key));
        });
    }
  };

  const removeItem = (item) => {
    setItems((list) => list.filter((entry) => entry.key !== item.key));
    if (item.isNew && item.path) uploadApi.discard(item.path); // never saved, so delete it right away
  };

  const cancel = () => {
    itemsRef.current.filter((item) => item.isNew && item.path).forEach((item) => uploadApi.discard(item.path));
    onCancel();
  };

  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && !busy && cancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const uploading = items.some((item) => item.status === 'uploading');

  const submit = (event) => {
    event.preventDefault();
    const next = {};
    if (items.length === 0) next.images = 'Add at least one image.';
    if (!header.trim()) next.header = 'Header is required.';
    if (!description.trim()) next.description = 'Description is required.';
    setErrors(next);
    if (Object.keys(next).length === 0) {
      onSubmit({ header: header.trim(), description: description.trim(), images: items.map((item) => item.path) });
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && cancel()}>
      <form className="dialog" onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-labelledby="form-title">
        <h2 id="form-title">{isEdit ? 'Edit banner' : 'Add banner'}</h2>

        <div className="field">
          <span>Images <small className="hint">({items.length}/{MAX_IMAGES})</small></span>
          <div className="image-grid">
            {items.map((item, position) => (
              <div className="image-tile" key={item.key}>
                <img src={item.url} alt={`Banner image ${position + 1}`} />
                {position === 0 && <span className="tile-badge">Cover</span>}
                {item.status === 'uploading' && <div className="tile-busy"><div className="spinner small" role="status" aria-label="Uploading" /></div>}
                <button type="button" className="tile-remove" aria-label="Remove image" onClick={() => removeItem(item)} disabled={busy}>×</button>
              </div>
            ))}
            {items.length < MAX_IMAGES && (
              <label className={`image-tile image-add ${errors.images ? 'has-error' : ''}`}>
                <span className="plus">+</span>
                <span>Add images</span>
                <input type="file" accept={ACCEPT} multiple onChange={addFiles} disabled={busy} />
              </label>
            )}
          </div>
          <span className="hint">JPG, PNG or WEBP. You can select several at once. Visitors browse them with &lt; &gt;.</span>
          {errors.images && <span className="field-error">{errors.images}</span>}
        </div>

        <label className="field">
          <span>Header</span>
          <input type="text" value={header} maxLength={HEADER_MAX} onChange={(e) => setHeader(e.target.value)} disabled={busy} placeholder="e.g. 1. Kerala" />
          {errors.header && <span className="field-error">{errors.header}</span>}
        </label>

        <label className="field">
          <span>Description</span>
          <textarea rows={5} value={description} maxLength={DESCRIPTION_MAX} onChange={(e) => setDescription(e.target.value)} disabled={busy} placeholder="Write the description shown below the images" />
          <span className="hint">{description.length} / {DESCRIPTION_MAX}</span>
          {errors.description && <span className="field-error">{errors.description}</span>}
        </label>

        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={cancel} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy || uploading}>
            {busy ? 'Saving…' : uploading ? 'Uploading…' : 'Save Banner'}
          </button>
        </div>
      </form>
    </div>
  );
}
