import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  const nav = useNavigate();
  const loc = useLocation();

  async function submit(e: FormEvent) {
    e.preventDefault();

    setBusy(true);
    setError('');
    setMessage('');

    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      setError(error.message);
    } else {
      nav(
        (loc.state as any)?.from ||
          '/dashboard'
      );
    }

    setBusy(false);
  }

  async function resetPassword() {
    if (!email.trim()) {
      setError(
        'Please enter your email address first.'
      );
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    const redirectTo =
      `${window.location.origin}/reset-password`;

    const { error } =
      await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo,
        }
      );

    if (error) {
      setError(error.message);
    } else {
      setMessage(
        'Password reset link sent. Check your email inbox.'
      );
    }

    setBusy(false);
  }

  if (resetMode) {
    return (
      <Auth
        title="Reset your password"
        subtitle="Enter your email and we will send you a password reset link."
      >
        <div className="space-y-4">
          <input
            className="input"
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={e =>
              setEmail(e.target.value)
            }
          />

          {error && (
            <p className="text-sm text-red-600">
              {error}
            </p>
          )}

          {message && (
            <p className="text-sm text-green-600">
              {message}
            </p>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={resetPassword}
            className="btn btn-primary w-full justify-center"
          >
            {busy
              ? 'Sending…'
              : 'Send reset link'}
          </button>

          <button
            type="button"
            onClick={() => {
              setResetMode(false);
              setError('');
              setMessage('');
            }}
            className="w-full text-sm text-indigo-600 font-bold"
          >
            ← Back to login
          </button>
        </div>
      </Auth>
    );
  }

  return (
    <Auth
      title="Welcome back"
      subtitle="Continue your learning journey"
    >
      <form
        onSubmit={submit}
        className="space-y-4"
      >
        <input
          className="input"
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={e =>
            setEmail(e.target.value)
          }
        />

        <input
          className="input"
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={e =>
            setPassword(e.target.value)
          }
        />

        <div className="text-right">
          <button
            type="button"
            onClick={() => {
              setResetMode(true);
              setError('');
              setMessage('');
            }}
            className="text-sm text-indigo-600 font-bold"
          >
            Forgot password?
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          disabled={busy}
          className="btn btn-primary w-full justify-center"
        >
          {busy
            ? 'Signing in…'
            : 'Log in'}
        </button>

        <p className="text-sm text-center muted">
          New here?{' '}
          <Link
            className="text-indigo-600 font-bold"
            to="/signup"
          >
            Create an account
          </Link>
        </p>
      </form>
    </Auth>
  );
}

function Auth({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex gradient p-14 items-center">
        <div>
          <div className="text-indigo-600 font-black text-2xl">
            LearnMate AI
          </div>

          <h1 className="text-5xl font-black mt-8">
            A patient tutor
            <br />
            for every question.
          </h1>

          <p className="muted text-lg mt-5 max-w-md">
            Learn concepts, practice deliberately
            and see your progress grow.
          </p>
        </div>
      </div>

      <div className="p-6 grid place-items-center">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="text-indigo-600 font-black"
          >
            ← LearnMate AI
          </Link>

          <div className="card p-7 mt-8">
            <h2 className="text-2xl font-black">
              {title}
            </h2>

            <p className="muted mt-1 mb-6">
              {subtitle}
            </p>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}