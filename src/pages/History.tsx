import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Trash2,
  Plus,
  MessageCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function History() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', {
        ascending: false,
      });

    if (!error) {
      setItems(data ?? []);
    }

    setLoading(false);
  }

  async function del(id: string) {
    if (!confirm('Delete this conversation?')) return;

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id);

    if (error) {
      alert(
        'Could not delete this conversation. Please try again.'
      );
      return;
    }

    setItems((v) => v.filter((x) => x.id !== id));
  }

  const filtered = items.filter((x) =>
    String(x.title || 'Untitled conversation')
      .toLowerCase()
      .includes(q.toLowerCase())
  );

  return (
    <div className="page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">
            History
          </h1>

          <p className="muted mt-1">
            Continue previous learning conversations.
          </p>
        </div>

        <Link
          to="/tutor?new=1"
          className="btn btn-primary"
        >
          <Plus size={18} />
          New Chat
        </Link>
      </div>

      <div className="relative mt-7">
        <Search
          className="absolute left-3 top-3.5 text-slate-400"
          size={18}
        />

        <input
          className="input pl-10"
          placeholder="Search conversations"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="mt-5 space-y-3">
        {loading ? (
          <div className="card p-8 text-center">
            <p className="muted">
              Loading your conversations...
            </p>
          </div>
        ) : filtered.length > 0 ? (
          filtered.map((x) => (
            <div
              key={x.id}
              className="card p-4 flex items-center justify-between gap-4"
            >
              <Link
                to={`/tutor?conversation=${x.id}`}
                className="flex items-center gap-3 min-w-0 flex-1"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 grid place-items-center shrink-0">
                  <MessageCircle size={19} />
                </div>

                <div className="min-w-0">
                  <p className="font-bold truncate hover:text-indigo-600">
                    {x.title || 'Untitled conversation'}
                  </p>

                  {x.updated_at && (
                    <p className="text-xs muted mt-1">
                      {new Date(
                        x.updated_at
                      ).toLocaleString()}
                    </p>
                  )}
                </div>
              </Link>

              <button
                onClick={() => del(x.id)}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                aria-label="Delete conversation"
                title="Delete conversation"
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))
        ) : (
          <div className="card p-10 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 grid place-items-center">
              <MessageCircle size={22} />
            </div>

            <h2 className="font-black text-lg mt-4">
              {q
                ? 'No conversations found'
                : 'No conversations yet'}
            </h2>

            <p className="muted mt-1">
              {q
                ? 'Try a different search term.'
                : 'Start a new conversation with your AI Tutor.'}
            </p>

            {!q && (
              <Link
                to="/tutor?new=1"
                className="btn btn-primary mt-5 inline-flex"
              >
                <Plus size={18} />
                Start Learning
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}