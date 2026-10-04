import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const nav = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();

    setError('');
    setMessage('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage(
        'Password updated successfully. You can now log in with your new password.'
      );

      setTimeout(() => {
        nav('/login');
      }, 1500);
    }

    setBusy(false);
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        <div className="text-indigo-600 font-black text-2xl mb-6">
          LearnMate AI
        </div>

        <div className="card p-7">
          <h1 className="text-2xl font-black">
            Create a new password
          </h1>

          <p className="muted mt-1 mb-6">
            Enter your new password below.
          </p>

          <form
            onSubmit={submit}
            className="space-y-4"
          >
            <input
              className="input"
              type="password"
              required
              minLength={6}
              placeholder="New password"
              value={password}
              onChange={e =>
                setPassword(e.target.value)
              }
            />

            <input
              className="input"
              type="password"
              required
              minLength={6}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={e =>
                setConfirmPassword(e.target.value)
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
              type="submit"
              disabled={busy}
              className="btn btn-primary w-full justify-center"
            >
              {busy
                ? 'Updating…'
                : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}