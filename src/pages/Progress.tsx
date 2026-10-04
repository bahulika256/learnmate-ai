import { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  CheckCircle2,
  CircleHelp,
  Flame,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';

import { supabase } from '../lib/supabase';

type ProgressRow = {
  id: string;
  questions_attempted: number | null;
  questions_correct: number | null;
  accuracy: number | null;
  mastery_level: number | null;
  time_spent: number | null;
  updated_at: string | null;
  subjects?: {
    name: string;
  } | null;
  topics?: {
    name: string;
  } | null;
};

type ActivityRow = {
  id: string;
  activity_type: string;
  xp_earned: number | null;
  created_at: string;
};

export default function Progress() {
  const [data, setData] = useState<ProgressRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgress();
  }, []);

  async function loadProgress() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const [progressResult, activityResult, profileResult] =
        await Promise.all([
          supabase
            .from('progress')
            .select(
              '*,subjects(name),topics(name)'
            )
            .eq('user_id', user.id)
            .order('updated_at', {
              ascending: false,
            }),

          supabase
            .from('learning_activity')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', {
              ascending: false,
            })
            .limit(30),

          supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single(),
        ]);

      setData(progressResult.data ?? []);
      setActivity(activityResult.data ?? []);
      setProfile(profileResult.data ?? null);
    } catch (error) {
      console.error(
        'Failed to load progress:',
        error
      );
    } finally {
      setLoading(false);
    }
  }

  const statistics = useMemo(() => {
    const attempted = data.reduce(
      (total, row) =>
        total +
        Number(
          row.questions_attempted || 0
        ),
      0
    );

    const correct = data.reduce(
      (total, row) =>
        total +
        Number(
          row.questions_correct || 0
        ),
      0
    );

    const accuracy =
      attempted > 0
        ? Math.round(
            (correct / attempted) *
              100
          )
        : 0;

    const activityXp = activity.reduce(
      (total, item) =>
        total +
        Number(
          item.xp_earned || 0
        ),
      0
    );

    return {
      attempted,
      correct,
      accuracy,
      activityXp,
    };
  }, [data, activity]);

  const chartData = useMemo(() => {
    return data
      .map((row) => ({
        name:
          row.topics?.name ||
          row.subjects?.name ||
          'Unknown',
        accuracy: Math.round(
          Number(
            row.accuracy || 0
          )
        ),
      }))
      .slice(0, 12);
  }, [data]);

  const subjectSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        attempted: number;
        correct: number;
      }
    >();

    data.forEach((row) => {
      const subject =
        row.subjects?.name ||
        'Other';

      const current =
        map.get(subject) || {
          attempted: 0,
          correct: 0,
        };

      current.attempted += Number(
        row.questions_attempted || 0
      );

      current.correct += Number(
        row.questions_correct || 0
      );

      map.set(
        subject,
        current
      );
    });

    return Array.from(
      map.entries()
    ).map(
      ([name, values]) => ({
        name,
        attempted:
          values.attempted,
        correct:
          values.correct,
        accuracy:
          values.attempted > 0
            ? Math.round(
                (values.correct /
                  values.attempted) *
                  100
              )
            : 0,
      })
    );
  }, [data]);

  if (loading) {
    return (
      <div className="page">
        <div className="animate-pulse">
          <div className="h-9 w-56 bg-slate-200 rounded-lg" />

          <div className="h-4 w-80 bg-slate-200 rounded mt-3" />

          <div className="grid md:grid-cols-4 gap-4 mt-7">
            {[1, 2, 3, 4].map(
              (item) => (
                <div
                  key={item}
                  className="h-32 bg-slate-200 rounded-2xl"
                />
              )
            )}
          </div>

          <div className="h-96 bg-slate-200 rounded-2xl mt-6" />
        </div>
      </div>
    );
  }

  return (
    <div className="page">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-black">
          Your progress
        </h1>

        <p className="muted mt-1">
          Track your learning performance,
          accuracy, and activity.
        </p>
      </div>

      {/* Statistics */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-7">

        <StatCard
          icon={
            <CircleHelp
              size={21}
            />
          }
          label="Questions attempted"
          value={statistics.attempted}
          description="Total questions"
        />

        <StatCard
          icon={
            <CheckCircle2
              size={21}
            />
          }
          label="Correct answers"
          value={statistics.correct}
          description="Questions answered correctly"
        />

        <StatCard
          icon={
            <Target
              size={21}
            />
          }
          label="Overall accuracy"
          value={`${statistics.accuracy}%`}
          description="Across recorded practice"
        />

        <StatCard
          icon={
            <Zap size={21} />
          }
          label="Learning XP"
          value={
            profile?.xp ??
            statistics.activityXp
          }
          description="XP earned"
        />

      </div>

      {/* Streak */}
      <div className="card p-5 mt-5 flex flex-wrap items-center justify-between gap-4">

        <div className="flex items-center gap-4">

          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-500 grid place-items-center">
            <Flame size={24} />
          </div>

          <div>
            <p className="font-black text-lg">
              {profile?.current_streak ??
                0}{' '}
              day streak
            </p>

            <p className="text-sm muted">
              Keep learning regularly to
              build your streak.
            </p>
          </div>

        </div>

        <div className="text-right">

          <p className="text-xs muted">
            Longest streak
          </p>

          <p className="font-black">
            {profile?.longest_streak ??
              0}{' '}
            days
          </p>

        </div>

      </div>

      {/* Topic accuracy */}
      <div className="card p-5 mt-5">

        <div className="flex items-center justify-between gap-4">

          <div>
            <h2 className="font-black text-lg">
              Topic accuracy
            </h2>

            <p className="text-sm muted mt-1">
              See how you're performing
              across your recorded topics.
            </p>
          </div>

          <Target
            size={22}
            className="text-indigo-600"
          />

        </div>

        {chartData.length > 0 ? (

          <div className="h-80 mt-5">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={chartData}
                margin={{
                  top: 10,
                  right: 10,
                  left: 0,
                  bottom: 45,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="name"
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  height={70}
                />

                <YAxis
                  domain={[
                    0,
                    100,
                  ]}
                  tickFormatter={(value) =>
                    `${value}%`
                  }
                />

                <Tooltip
                  formatter={(
                    value
                  ) => [
                    `${value}%`,
                    'Accuracy',
                  ]}
                />

                <Bar
                  dataKey="accuracy"
                  name="Accuracy"
                  radius={[
                    6,
                    6,
                    0,
                    0,
                  ]}
                />

              </BarChart>
            </ResponsiveContainer>

          </div>

        ) : (

          <EmptyState
            title="No progress data yet"
            description="Complete a quiz or practice activity to start seeing your topic performance here."
          />

        )}

      </div>

      {/* Subject summary */}
      <div className="card p-5 mt-5">

        <div className="flex items-center justify-between">

          <div>
            <h2 className="font-black text-lg">
              Subject performance
            </h2>

            <p className="text-sm muted mt-1">
              Your recorded performance by
              subject.
            </p>
          </div>

          <Trophy
            size={22}
            className="text-indigo-600"
          />

        </div>

        {subjectSummary.length > 0 ? (

          <div className="grid md:grid-cols-3 gap-4 mt-5">

            {subjectSummary.map(
              (subject) => (
                <div
                  key={subject.name}
                  className="rounded-2xl border border-slate-200 p-4"
                >

                  <div className="flex items-center justify-between">

                    <p className="font-bold">
                      {subject.name}
                    </p>

                    <span className="text-sm font-bold text-indigo-600">
                      {subject.accuracy}%
                    </span>

                  </div>

                  <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden">

                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          subject.accuracy
                        )}%`,
                      }}
                    />

                  </div>

                  <div className="flex justify-between mt-3 text-xs muted">

                    <span>
                      {subject.correct}{' '}
                      correct
                    </span>

                    <span>
                      {subject.attempted}{' '}
                      attempted
                    </span>

                  </div>

                </div>
              )
            )}

          </div>

        ) : (

          <EmptyState
            title="No subject data yet"
            description="Complete some practice questions to build your subject performance."
          />

        )}

      </div>

      {/* Recent activity */}
      <div className="card p-5 mt-5">

        <div className="flex items-center justify-between">

          <div>
            <h2 className="font-black text-lg">
              Recent learning activity
            </h2>

            <p className="text-sm muted mt-1">
              Your latest learning actions.
            </p>
          </div>

          <Flame
            size={22}
            className="text-orange-500"
          />

        </div>

        <div className="mt-4 divide-y">

          {activity.length ? (

            activity.map(
              (item) => (
                <div
                  key={item.id}
                  className="py-3 flex items-center justify-between gap-4"
                >

                  <div className="min-w-0">

                    <p className="font-medium capitalize">
                      {formatActivity(
                        item.activity_type
                      )}
                    </p>

                    <p className="text-xs muted mt-1">
                      {new Date(
                        item.created_at
                      ).toLocaleDateString(
                        undefined,
                        {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        }
                      )}
                    </p>

                  </div>

                  <span className="shrink-0 text-sm font-bold text-indigo-600">
                    +
                    {item.xp_earned ??
                      0}{' '}
                    XP
                  </span>

                </div>
              )
            )

          ) : (

            <EmptyState
              title="No learning activity yet"
              description="Start learning to see your recent activity here."
            />

          )}

        </div>

      </div>

    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <div className="card p-5">

      <div className="flex items-center justify-between">

        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 grid place-items-center">
          {icon}
        </div>

      </div>

      <p className="text-sm muted mt-4">
        {label}
      </p>

      <p className="text-2xl font-black mt-1">
        {value}
      </p>

      <p className="text-xs muted mt-1">
        {description}
      </p>

    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="py-10 text-center">

      <div className="w-12 h-12 rounded-2xl bg-slate-100 mx-auto grid place-items-center text-slate-400">
        <Target size={21} />
      </div>

      <p className="font-bold mt-3">
        {title}
      </p>

      <p className="text-sm muted mt-1 max-w-md mx-auto">
        {description}
      </p>

    </div>
  );
}

function formatActivity(
  activityType: string
) {
  return activityType
    .replace(/_/g, ' ')
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}