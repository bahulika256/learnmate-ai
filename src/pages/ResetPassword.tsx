import {
  FormEvent,
  useEffect,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const [password, setPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [error, setError] =
    useState('');

  const [message, setMessage] =
    useState('');

  const [busy, setBusy] =
    useState(false);

  const [sessionReady, setSessionReady] =
    useState(false);

  const nav = useNavigate();

  useEffect(() => {
    let mounted = true;

    async function prepareRecoverySession() {
      setError('');

      /*
       * Supabase may need a moment to process
       * the recovery tokens from the URL.
       *
       * getSession() checks whether the session
       * is already available.
       */
      const {
        data: sessionData,
      } = await supabase.auth.getSession();

      if (
        mounted &&
        sessionData.session
      ) {
        setSessionReady(true);
        return;
      }

      /*
       * Listen for the recovery session.
       * This is especially important on mobile
       * browsers where the session may arrive
       * shortly after the page loads.
       */
      const {
        data: authListener,
      } =
        supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (!mounted) return;

            if (
              event ===
                'PASSWORD_RECOVERY' &&
              session
            ) {
              setSessionReady(true);
              return;
            }

            if (
              event === 'SIGNED_IN' &&
              session
            ) {
              setSessionReady(true);
            }
          }
        );

      /*
       * Check again after the listener is
       * registered so we don't miss a session
       * created between the first check and
       * listener registration.
       */
      const {
        data: secondCheck,
      } = await supabase.auth.getSession();

      if (
        mounted &&
        secondCheck.session
      ) {
        setSessionReady(true);
      }

      /*
       * Give Supabase a little extra time to
       * process the recovery URL.
       */
      const timeout = window.setTimeout(
        async () => {
          if (!mounted) return;

          const {
            data,
          } =
            await supabase.auth.getSession();

          if (data.session) {
            setSessionReady(true);
          } else {
            setError(
              'The password reset session could not be established. Please open the newest reset email again.'
            );
          }
        },
        2500
      );

      return () => {
        window.clearTimeout(timeout);
        authListener.subscription.unsubscribe();
      };
    }

    prepareRecoverySession();

    return () => {
      mounted = false;
    };
  }, []);

  async function submit(
    e: FormEvent
  ) {
    e.preventDefault();

    setError('');
    setMessage('');

    if (password.length < 6) {
      setError(
        'Password must be at least 6 characters.'
      );
      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setError(
        'Passwords do not match.'
      );
      return;
    }

    setBusy(true);

    /*
     * Always check the current session
     * immediately before updating the password.
     */
    const {
      data: sessionData,
    } =
      await supabase.auth.getSession();

    if (!sessionData.session) {
      setError(
        'Your password reset session has expired. Please open the newest reset email again.'
      );

      setBusy(false);
      return;
    }

    const {
      error: updateError,
    } =
      await supabase.auth.updateUser({
        password,
      });

    if (updateError) {
      setError(
        updateError.message
      );
    } else {
      setMessage(
        'Password updated successfully. You can now log in with your new password.'
      );

      setTimeout(() => {
        nav('/login', {
          replace: true,
        });
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
                setPassword(
                  e.target.value
                )
              }
            />

            <input
              className="input"
              type="password"
              required
              minLength={6}
              placeholder="Confirm new password"
              value={
                confirmPassword
              }
              onChange={e =>
                setConfirmPassword(
                  e.target.value
                )
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
              disabled={
                busy ||
                !sessionReady
              }
              className="btn btn-primary w-full justify-center"
            >
              {busy
                ? 'Updating…'
                : !sessionReady
                ? 'Preparing reset…'
                : 'Update password'}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}