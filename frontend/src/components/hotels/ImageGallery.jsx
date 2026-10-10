import { useEffect, useState } from 'react';
import Icon from '../ui/Icon';

export default function ImageGallery({ images = [], alt = '' }) {
  const hasImages = images && images.length > 0;
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const next = () => setActiveIndex((i) => (i + 1) % images.length);
  const prev = () => setActiveIndex((i) => (i - 1 + images.length) % images.length);

  useEffect(() => {
    if (!lightboxOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxOpen, images.length]);

  if (!hasImages) {
    return (
      <div className="gallery gallery-empty">
        <Icon name="image" size={30} />
        <p>No photos available for this hotel yet.</p>
      </div>
    );
  }

  const showThumbs = images.length > 1;

  return (
    <div className="gallery">
      <button type="button" className="gallery-main" onClick={() => setLightboxOpen(true)} aria-label="Open image gallery">
        <img src={images[activeIndex]} alt={`${alt} — photo ${activeIndex + 1}`} loading="lazy" />
        {images.length > 1 && (
          <span className="gallery-count">
            <Icon name="image" size={14} /> {activeIndex + 1} / {images.length}
          </span>
        )}
      </button>

      {showThumbs && (
        <div className="gallery-thumbs">
          {images.map((src, i) => (
            <button
              type="button"
              key={src + i}
              className={`gallery-thumb ${i === activeIndex ? 'is-active' : ''}`}
              onClick={() => setActiveIndex(i)}
              aria-label={`Show photo ${i + 1}`}
            >
              <img src={src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && (
        <div className="gallery-lightbox" role="dialog" aria-modal="true" onClick={() => setLightboxOpen(false)}>
          <button
            type="button"
            className="gallery-lightbox-close"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close gallery"
          >
            <Icon name="close" size={22} />
          </button>

          {images.length > 1 && (
            <button
              type="button"
              className="gallery-lightbox-nav gallery-lightbox-prev"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              aria-label="Previous photo"
            >
              <Icon name="chevronLeft" size={22} />
            </button>
          )}

          <img
            src={images[activeIndex]}
            alt={`${alt} — photo ${activeIndex + 1}`}
            className="gallery-lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />

          {images.length > 1 && (
            <button
              type="button"
              className="gallery-lightbox-nav gallery-lightbox-next"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              aria-label="Next photo"
            >
              <Icon name="chevronRight" size={22} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
