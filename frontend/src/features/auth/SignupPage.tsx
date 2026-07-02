import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../lib/api';

export const SignupPage = () => {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(undefined);
    try {
      await signup(email, password, name || undefined);
      navigate('/dashboard', { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Could not create your account. Try again.',
      );
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-signal">Get started</p>
      <h1 className="mt-3 text-3xl font-bold text-ink">Create your account</h1>
      <p className="mt-2 text-sm text-graphite">
        Your interview history and progress will be saved here.
      </p>

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-8 space-y-4">
        <div>
          <label
            htmlFor="name"
            className="text-xs font-semibold uppercase tracking-[0.1em] text-graphite"
          >
            Name <span className="normal-case text-graphite/70">(optional)</span>
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1.5 w-full rounded-md border border-white/15 bg-surface p-3 text-sm text-ink placeholder:text-graphite focus:border-signal focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="text-xs font-semibold uppercase tracking-[0.1em] text-graphite"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1.5 w-full rounded-md border border-white/15 bg-surface p-3 text-sm text-ink placeholder:text-graphite focus:border-signal focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="text-xs font-semibold uppercase tracking-[0.1em] text-graphite"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1.5 w-full rounded-md border border-white/15 bg-surface p-3 text-sm text-ink placeholder:text-graphite focus:border-signal focus:outline-none"
          />
          <p className="mt-1.5 text-xs text-graphite">At least 8 characters.</p>
        </div>

        {error && <p className="text-sm font-medium text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-signal px-5 py-3 text-sm font-semibold text-canvas shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <UserPlus size={16} aria-hidden="true" />
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-graphite">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-signal hover:brightness-110">
          Sign in
        </Link>
      </p>
    </section>
  );
};
