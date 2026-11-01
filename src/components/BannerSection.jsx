import ImageCarousel from './ImageCarousel.jsx';

/** One banner on the landing page: heading, image gallery, then the description. */
export default function BannerSection({ banner }) {
  return (
    <section className="story">
      <h2 className="story-title">{banner.header}</h2>
      {banner.images.length > 0 && <ImageCarousel images={banner.images} alt={banner.header} />}
      <p className="story-text">{banner.description}</p>
    </section>
  );
}
