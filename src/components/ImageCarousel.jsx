import { useCallback, useRef, useState } from 'react';

const SWIPE_THRESHOLD = 40;

/** Sliding image gallery for one banner. Arrows sit inside the image; hidden for a single image. */
export default function ImageCarousel({ images, alt }) {
  const [index, setIndex] = useState(0);
  const touchStart = useRef(null);
  const count = images.length;
  const hasMany = count > 1;

  const go = useCallback(
    (step) => {
      if (count > 1) setIndex((current) => (current + step + count) % count); // wraps both ways
    },
    [count],
  );

  const onKeyDown = (event) => {
    if (event.key === 'ArrowRight') go(1);
    if (event.key === 'ArrowLeft') go(-1);
  };
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

  return (
    <div
      className="carousel"
      tabIndex={hasMany ? 0 : undefined}
      aria-roledescription={hasMany ? 'carousel' : undefined}
      aria-label={alt}
      onKeyDown={hasMany ? onKeyDown : undefined}
      onTouchStart={hasMany ? onTouchStart : undefined}
      onTouchEnd={hasMany ? onTouchEnd : undefined}
    >
      <div className="carousel-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {images.map((image, position) => (
          <div className="slide" key={image.path}>
            {/* Blurred copy fills the empty space around photos that don't match the frame's shape. */}
            <img className="slide-bg" src={image.url} alt="" aria-hidden="true" draggable="false" />
            <img className="slide-img" src={image.url} alt={`${alt} — photo ${position + 1}`} draggable="false" />
          </div>
        ))}
      </div>
      {hasMany && (
        <>
          <button type="button" className="carousel-btn carousel-prev" aria-label="Previous image" onClick={() => go(-1)}>
            &lt;
          </button>
          <button type="button" className="carousel-btn carousel-next" aria-label="Next image" onClick={() => go(1)}>
            &gt;
          </button>
          <div className="carousel-count" aria-live="polite">
            {index + 1} / {count}
          </div>
        </>
      )}
    </div>
  );
}
