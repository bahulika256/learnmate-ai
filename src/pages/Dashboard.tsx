import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Brain,
  Flame,
  MessageCircle,
  Star,
  Trophy,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile, Subject } from '../lib/types';

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [convos, setConvos] = useState<any[]>([]);
  const [recs, setRecs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const [p, s, us, c, r, pr] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single(),

        supabase
          .from('subjects')
          .select('*')
          .order('name'),

        supabase
          .from('user_subjects')
          .select('subject_id')
          .eq('user_id', user.id),

        supabase
          .from('conversations')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(4),

        supabase
          .from('recommendations')
          .select('*')
          .eq('user_id', user.id)
          .eq('completed', false)
          .order('created_at', { ascending: false })
          .limit(3),

        supabase
          .from('progress')
          .select('subject_id,accuracy')
          .eq('user_id', user.id),
      ]);

      setProfile(p.data);

      const chosen = (s.data ?? []).filter((x) =>
        (us.data ?? []).some(
          (u) => u.subject_id === x.id
        )
      );

      setSubjects(chosen);
      setConvos(c.data ?? []);
      setRecs(r.data ?? []);

      const progressMap: Record<string, number> = {};

      for (const x of pr.data ?? []) {
        progressMap[x.subject_id] = x.accuracy;
      }

      setProgress(progressMap);
    })();
  }, []);

  const hour = new Date().getHours();

  const greeting =
    hour < 12
      ? 'Good morning'
      : hour < 17
        ? 'Good afternoon'
        : 'Good evening';

  return (
    <div className="page">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="muted">Welcome back</p>

          <h1 className="text-3xl font-black mt-1">
            {greeting},{' '}
            {profile?.full_name?.split(' ')[0] || 'Learner'} 👋
          </h1>
        </div>

        <Link
          to="/tutor"
          className="btn btn-primary"
        >
          <Brain size={18} />
          Ask your tutor
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-7">
        <Stat
          icon={<Flame />}
          label="Learning streak"
          value={`${profile?.current_streak ?? 0} Days`}
        />

        <Stat
          icon={<Star />}
          label="XP"
          value={`${profile?.xp ?? 0} XP`}
        />

        <Stat
          icon={<Trophy />}
          label="Longest streak"
          value={`${profile?.longest_streak ?? 0} Days`}
        />
      </div>

      <section className="mt-8">
        <h2 className="text-xl font-black">
          Your subjects
        </h2>

        <div className="grid md:grid-cols-3 gap-4 mt-4">
          {subjects.length ? (
            subjects.map((s) => (
              <div
                key={s.id}
                className="card p-5"
              >
                <div className="font-bold text-lg">
                  {s.name}
                </div>

                <div className="h-2 bg-slate-100 rounded-full mt-4 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500"
                    style={{
                      width: `${Math.round(
                        progress[s.id] ?? 0
                      )}%`,
                    }}
                  />
                </div>

                <div className="text-sm muted mt-2">
                  {Math.round(
                    progress[s.id] ?? 0
                  )}
                  % accuracy
                </div>
              </div>
            ))
          ) : (
            <div className="card p-6 col-span-3 muted">
              Choose subjects in your profile/onboarding
              to personalize this area.
            </div>
          )}
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-5 mt-8">
        <section className="card p-6">
          <div className="flex justify-between">
            <h2 className="font-black text-xl">
              Continue learning
            </h2>

            <Link
              to="/history"
              className="text-indigo-600 text-sm font-bold"
            >
              See all
            </Link>
          </div>

          <div className="mt-4 space-y-2">
            {convos.length ? (
              convos.map((c) => (
                <Link
                  to={`/tutor?conversation=${c.id}`}
                  key={c.id}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50"
                >
                  <span className="flex gap-3 items-center">
                    <MessageCircle
                      size={18}
                      className="text-indigo-500"
                    />

                    {c.title}
                  </span>

                  <ArrowRight size={16} />
                </Link>
              ))
            ) : (
              <p className="muted py-5">
                Your conversations will appear here.
              </p>
            )}
          </div>
        </section>

        <section className="card p-6">
          <h2 className="font-black text-xl">
            Recommended for you
          </h2>

          <div className="mt-4 space-y-3">
            {recs.length ? (
              recs.map((r) => (
                <Link
                  key={r.id}
                  to="/practice"
                  className="block p-4 rounded-xl bg-indigo-50"
                >
                  <div className="font-bold text-indigo-900">
                    {r.title}
                  </div>

                  <div className="text-sm text-indigo-700 mt-1">
                    {r.reason || r.description}
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-5 rounded-xl bg-slate-50 muted">
                Complete a quiz to unlock
                performance-based recommendations.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 grid place-items-center">
        {icon}
      </div>

      <div>
        <div className="text-sm muted">
          {label}
        </div>

        <div className="text-xl font-black mt-1">
          {value}
        </div>
      </div>
    </div>
  );
}