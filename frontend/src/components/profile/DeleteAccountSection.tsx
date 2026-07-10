import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';

export function DeleteAccountSection() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const confirmed = window.confirm(
      'This permanently deletes your account and everything in it -- your conversations, goals, story chapters, ' +
        'documents, and profile. This cannot be undone. Are you sure?'
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await api.deleteAccount(password);
      logout();
      navigate('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
      setIsDeleting(false);
    }
  }

  return (
    <section className="danger-zone" aria-labelledby="danger-zone-heading">
      <h2 id="danger-zone-heading">Delete my account</h2>
      <p className="section-intro">
        This permanently deletes your account and all of your data -- there is no way to undo this.
      </p>
      <form onSubmit={handleSubmit} className="auth-form">
        <label htmlFor="delete-account-password">Enter your password to confirm</label>
        <input
          id="delete-account-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="danger-button" disabled={isDeleting || !password}>
          {isDeleting ? 'Deleting...' : 'Delete my account permanently'}
        </button>
      </form>
    </section>
  );
}
