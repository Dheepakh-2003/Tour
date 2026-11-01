import { useEffect, useRef, useState } from 'react';
import { uploadApi } from '../services/api.js';
import { ACCEPT, typeProblem } from '../utils/image.js';
import { useToast } from './Toast.jsx';

const NAME_MAX = 80;
const MAX_PEOPLE = 30;

const blankRow = () => ({ key: `new-${crypto.randomUUID()}`, id: null, name: '', path: null, url: null, status: 'idle', isNew: false });

/** Footer editor: a list of profiles, each with a photo and a name. Photos upload as soon as they are chosen. */
export default function FooterForm({ footer, busy, onSubmit, onCancel }) {
  const toast = useToast();
  const [rows, setRows] = useState(() =>
    (footer?.people ?? []).map((person) => ({
      key: person.id, id: person.id, name: person.name, path: person.imagePath, url: person.image,
      status: person.imagePath ? 'done' : 'idle', isNew: false,
    })),
  );
  const [errors, setErrors] = useState({});
  const rowsRef = useRef(rows);
  const closedRef = useRef(false);
  const objectUrls = useRef([]);
  rowsRef.current = rows;

  useEffect(() => {
    closedRef.current = false; // React StrictMode re-mounts effects in dev, so reset on every mount
    return () => {
      closedRef.current = true;
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const patchRow = (key, patch) => setRows((list) => list.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const discardIfNew = (row) => row?.isNew && row.path && uploadApi.discard(row.path);

  const choosePhoto = (row, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const problem = typeProblem(file);
    if (problem) return toast.error(problem);

    const before = rowsRef.current.find((entry) => entry.key === row.key);
    discardIfNew(before); // replacing an unsaved upload
    const preview = URL.createObjectURL(file);
    objectUrls.current.push(preview);
    patchRow(row.key, { url: preview, path: null, status: 'uploading', isNew: true });

    uploadApi
      .upload(file, { maxSide: 800 })
      .then(({ path }) => {
        if (closedRef.current) uploadApi.discard(path);
        else patchRow(row.key, { path, status: 'done' });
      })
      .catch((error) => {
        toast.error(error.message);
        // Fall back to the previously saved photo, if there was one.
        const restore = before?.isNew || !before?.path ? { url: null, path: null, status: 'idle', isNew: false } : { url: before.url, path: before.path, status: 'done', isNew: false };
        patchRow(row.key, restore);
      });
  };

  const removeRow = (row) => {
    discardIfNew(row);
    setRows((list) => list.filter((entry) => entry.key !== row.key));
  };

  const cancel = () => {
    rowsRef.current.forEach(discardIfNew);
    onCancel();
  };

  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && !busy && cancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const uploading = rows.some((row) => row.status === 'uploading');

  const submit = (event) => {
    event.preventDefault();
    const next = {};
    rows.forEach((row) => {
      if (!row.name.trim()) next[row.key] = 'Name is required.';
    });
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit({ people: rows.map((row) => ({ id: row.id ?? undefined, name: row.name.trim(), imagePath: row.path ?? null })) });
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && cancel()}>
      <form className="dialog" onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-labelledby="footer-title">
        <h2 id="footer-title">Footer profiles</h2>
        <p className="muted people-hint">Shown at the bottom of the landing page, 5 per row.</p>

        {rows.length === 0 && <p className="muted people-empty">No profiles yet. Add the first one below.</p>}
        <ul className="people-editor">
          {rows.map((row) => (
            <li key={row.key} className="person-row">
              <label className="avatar-picker avatar-small" title="Choose photo">
                {row.url ? <img src={row.url} alt="" /> : <span>+ Photo</span>}
                {row.status === 'uploading' && <div className="tile-busy"><div className="spinner small" role="status" aria-label="Uploading" /></div>}
                <input type="file" accept={ACCEPT} onChange={(event) => choosePhoto(row, event)} disabled={busy} />
              </label>
              <div className="person-name">
                <input
                  type="text" value={row.name} maxLength={NAME_MAX} placeholder="Name" aria-label="Name" disabled={busy}
                  onChange={(e) => patchRow(row.key, { name: e.target.value })}
                />
                {errors[row.key] && <span className="field-error">{errors[row.key]}</span>}
              </div>
              <button type="button" className="icon-btn" aria-label="Remove profile" onClick={() => removeRow(row)} disabled={busy}>×</button>
            </li>
          ))}
        </ul>

        <button type="button" className="btn btn-ghost" onClick={() => setRows((list) => [...list, blankRow()])} disabled={busy || rows.length >= MAX_PEOPLE}>
          + Add profile
        </button>

        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={cancel} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy || uploading}>
            {busy ? 'Saving…' : uploading ? 'Uploading…' : 'Save Footer'}
          </button>
        </div>
      </form>
    </div>
  );
}
