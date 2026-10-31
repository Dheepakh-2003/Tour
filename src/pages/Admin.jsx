import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BannerForm from '../components/BannerForm.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import LoginForm from '../components/LoginForm.jsx';
import { useToast } from '../components/Toast.jsx';
import { authApi, bannerApi } from '../services/api.js';
import '../styles/admin.css';

export default function Admin() {
  const [auth, setAuth] = useState('checking'); // checking | in | out
  useEffect(() => {
    authApi
      .me()
      .then(({ authenticated }) => setAuth(authenticated ? 'in' : 'out'))
      .catch(() => setAuth('out'));
  }, []);

  if (auth === 'checking') return <div className="center-screen"><div className="spinner" role="status" aria-label="Loading" /></div>;
  if (auth === 'out') return <LoginForm onSuccess={() => setAuth('in')} />;
  return <Dashboard onSignedOut={() => setAuth('out')} />;
}

function Dashboard({ onSignedOut }) {
  const toast = useToast();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // null | { banner?: Banner }
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // A 401 from any call means the session expired: return to the login screen.
  const handleError = useCallback(
    (error) => {
      if (error.status === 401) {
        toast.error('Your session has expired. Please sign in again.');
        onSignedOut();
      } else {
        toast.error(error.message);
      }
    },
    [toast, onSignedOut],
  );

  const refresh = useCallback(async () => {
    try {
      setBanners(await bannerApi.list());
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = async (values) => {
    setSaving(true);
    try {
      if (form.banner) {
        const updated = await bannerApi.update(form.banner.id, values);
        setBanners((list) => list.map((item) => (item.id === updated.id ? updated : item)));
        toast.success('Banner updated.');
      } else {
        const created = await bannerApi.create(values);
        setBanners((list) => [...list, created]);
        toast.success('Banner added.');
      }
      setForm(null);
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await bannerApi.remove(pendingDelete.id);
      setBanners((list) => list.filter((item) => item.id !== pendingDelete.id));
      toast.success('Banner deleted.');
      setPendingDelete(null);
    } catch (error) {
      handleError(error);
    } finally {
      setDeleting(false);
    }
  };

  const signOut = async () => {
    try {
      await authApi.logout();
    } finally {
      onSignedOut();
    }
  };

  return (
    <div className="admin">
      <header className="admin-bar">
        <span className="brand">Tour</span>
        <nav>
          <Link to="/" className="btn btn-ghost">View site</Link>
          <button type="button" className="btn btn-ghost" onClick={signOut}>Log out</button>
        </nav>
      </header>

      <main className="admin-main">
        <div className="admin-title">
          <div>
            <h1>Banner Management</h1>
            <p className="muted">{banners.length} {banners.length === 1 ? 'banner' : 'banners'} on the landing page</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setForm({})}>+ Add Banner</button>
        </div>

        {loading ? (
          <div className="center-block"><div className="spinner" role="status" aria-label="Loading" /></div>
        ) : banners.length === 0 ? (
          <div className="panel empty-panel">
            <h2>No banners yet</h2>
            <p className="muted">Add your first banner and it will appear on the landing page right away.</p>
          </div>
        ) : (
          <ul className="banner-list">
            {banners.map((banner) => (
              <li key={banner.id} className="banner-item panel">
                <img src={banner.image} alt="" className="thumb" loading="lazy" />
                <div className="banner-item-body">
                  <h3>{banner.header}</h3>
                  <p className="muted clamp">{banner.description}</p>
                </div>
                <div className="banner-item-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setForm({ banner })}>Edit</button>
                  <button type="button" className="btn btn-ghost btn-danger-text" onClick={() => setPendingDelete(banner)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {form && <BannerForm banner={form.banner} busy={saving} onSubmit={save} onCancel={() => setForm(null)} />}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete this banner?"
          message={`“${pendingDelete.header}” will be removed from the landing page and its image deleted. This cannot be undone.`}
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
