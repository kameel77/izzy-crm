import React from 'react';
import { Link } from 'react-router-dom';

export const ThankYouPage: React.FC = () => {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Dziękujemy!</h1>
        <p style={styles.message}>
          Twój wniosek został pomyślnie wysłany. Nasz konsultant skontaktuje się z Tobą wkrótce, aby omówić kolejne kroki.
        </p>
        <Link to="/" style={styles.button}>
          Wróć na stronę główną
        </Link>
        <a href="https://salon.izzylease.pl" target="_blank" rel="noopener noreferrer" style={styles.externalLink}>
          Odwiedź nasz salon
        </a>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
    padding: '1rem',
  },
  card: {
    backgroundColor: '#ffffff',
    padding: '2.5rem',
    borderRadius: '1rem',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
    textAlign: 'center',
    maxWidth: '500px',
    width: '100%',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    color: '#16a34a',
    marginBottom: '1rem',
  },
  message: {
    fontSize: '1.1rem',
    color: '#4b5563',
    lineHeight: '1.6',
    marginBottom: '2rem',
  },
  button: {
    display: 'inline-block',
    padding: '0.75rem 1.5rem',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    textDecoration: 'none',
    borderRadius: '0.5rem',
    fontWeight: 500,
    transition: 'background-color 0.2s',
  },
  externalLink: {
    display: 'block',
    marginTop: '1rem',
    color: '#2563eb',
    textDecoration: 'underline',
    fontSize: '0.9rem',
  },
};
