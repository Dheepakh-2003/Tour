import { useCallback, useEffect, useRef, useState } from 'react';
import BannerCard from './BannerCard.jsx';

const SWIPE_THRESHOLD = 50;

export default function BannerSlider({ banners }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState('next');
  const touchStart = useRef(null);
  const count = banners.length;
  const hasMany = count > 1;

  // Keep the index valid when banners are removed while the page is open.
  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  const go = useCallback(
    (step) => {
      if (count < 2) return;
      setDirection(step > 0 ? 'next' : 'prev');
      setIndex((current) => (current + step + count) % count); // wraps in both directions
    },
    [count],
  );

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'ArrowRight') go(1);
      if (event.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const onTouchStart = (event) => {
    touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  };
  const onTouchEnd = (event) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  };

  const banner = banners[Math.min(index, count - 1)];

  return (
    <section className="slider" aria-roledescription="carousel" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {hasMany && (
        <button type="button" className="nav-arrow nav-prev" aria-label="Previous banner" onClick={() => go(-1)}>
          &lt;
        </button>
      )}
      <div className="slider-stage" aria-live="polite">
        <BannerCard key={banner.id} banner={banner} direction={direction} />
      </div>
      {hasMany && (
        <button type="button" className="nav-arrow nav-next" aria-label="Next banner" onClick={() => go(1)}>
          &gt;
        </button>
      )}
      {hasMany && (
        <div className="slider-counter" aria-label={`Banner ${index + 1} of ${count}`}>
          {index + 1} / {count}
        </div>
      )}
    </section>
  );
}
