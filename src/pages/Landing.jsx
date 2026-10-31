import { useCallback, useEffect, useState } from 'react';
import BannerSlider from '../components/BannerSlider.jsx';
import { bannerApi } from '../services/api.js';
import '../styles/landing.css';

const REFRESH_MS = 30_000;

export default function Landing() {
  const [banners, setBanners] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error

  const load = useCallback(async () => {
    try {
      setBanners(await bannerApi.list());
      setStatus('ready');
    } catch {
      // Keep showing what we have if a background refresh fails.
      setStatus((current) => (current === 'ready' ? 'ready' : 'error'));
    }
  }, []);

  // Fetch on mount, on tab focus, and periodically so admin changes show up.
  useEffect(() => {
    load();
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', load);
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', load);
      clearInterval(timer);
    };
  }, [load]);

  return (
    <div className="landing">
      <main className="landing-main">
        {status === 'loading' && <div className="spinner" role="status" aria-label="Loading" />}
        {status === 'error' && (
          <div className="empty-state">
            <h1>We couldn’t load the showcase</h1>
            <p>Please check your connection and try again.</p>
            <button type="button" className="btn btn-primary" onClick={load}>Retry</button>
          </div>
        )}
        {status === 'ready' && banners.length === 0 && (
          <div className="empty-state">
            <h1>Nothing to show yet</h1>
            <p>New stories will appear here soon.</p>
          </div>
        )}
        {status === 'ready' && banners.length > 0 && <BannerSlider banners={banners} />}
      </main>
    </div>
  );
}
