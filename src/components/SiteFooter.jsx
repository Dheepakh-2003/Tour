/** Page footer: profiles (photo above name), starting at the left, at most 5 per row. */
export default function SiteFooter({ footer }) {
  const people = footer?.people ?? [];
  if (people.length === 0) return null;
  return (
    <footer className="site-footer">
      <ul className="people">
        {people.map((person) => (
          <li key={person.id} className="person">
            {person.image ? (
              <img className="footer-photo" src={person.image} alt={person.name} />
            ) : (
              <div className="footer-photo footer-initial" aria-hidden="true">{person.name.charAt(0).toUpperCase()}</div>
            )}
            <p className="footer-name">{person.name}</p>
          </li>
        ))}
      </ul>
    </footer>
  );
}
