/** Image on top, then the heading, then the description (the text area scrolls when long). */
export default function BannerCard({ banner, direction }) {
  return (
    <article className={`banner-card slide-${direction}`}>
      <div className="banner-media">
        <img src={banner.image} alt={banner.header} draggable="false" />
      </div>
      <div className="banner-content">
        <h1 className="banner-title">{banner.header}</h1>
        <p className="banner-text">{banner.description}</p>
      </div>
    </article>
  );
}
