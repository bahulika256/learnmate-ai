import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Calculator,
  FlaskConical,
  Zap,
} from 'lucide-react';

export default function Profile() {
  const [p, setP] = useState<any>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [language, setLanguage] = useState('English');

  const [saving, setSaving] = useState(false);
  const [savingSubjects, setSavingSubjects] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const [
      profileResult,
      badgeResult,
      subjectsResult,
      userSubjectsResult,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single(),

      supabase
        .from('user_achievements')
        .select('earned_at, achievements(*)')
        .eq('user_id', user.id),

      supabase
        .from('subjects')
        .select('*')
        .order('name'),

      supabase
        .from('user_subjects')
        .select('subject_id')
        .eq('user_id', user.id),
    ]);

    const profile = profileResult.data;

    setP(profile);
    setBadges(badgeResult.data ?? []);
    setAllSubjects(subjectsResult.data ?? []);

    setSelectedSubjects(
      (userSubjectsResult.data ?? []).map(
        (item: any) => item.subject_id
      )
    );

    setName(profile?.full_name ?? '');
    setGrade(
      profile?.grade
        ? String(profile.grade)
        : ''
    );
    setLanguage(
      profile?.preferred_language ??
        'English'
    );
  }

  async function saveProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    setSaving(true);

    const {
      data,
      error,
    } = await supabase
      .from('profiles')
      .update({
        full_name: name,
        grade: grade
          ? Number(grade)
          : null,
        preferred_language:
          language,
      })
      .eq('id', user.id)
      .select()
      .single();

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setP(data);

    alert(
      'Profile updated successfully!'
    );
  }

  function toggleSubject(
    subjectId: string
  ) {
    setSelectedSubjects((current) =>
      current.includes(subjectId)
        ? current.filter(
            (id) => id !== subjectId
          )
        : [...current, subjectId]
    );
  }

  async function saveSubjects() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    setSavingSubjects(true);

    const {
      error: deleteError,
    } = await supabase
      .from('user_subjects')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      setSavingSubjects(false);
      alert(deleteError.message);
      return;
    }

    if (selectedSubjects.length > 0) {
      const rows =
        selectedSubjects.map(
          (subjectId) => ({
            user_id: user.id,
            subject_id:
              subjectId,
          })
        );

      const {
        error: insertError,
      } = await supabase
        .from('user_subjects')
        .insert(rows);

      if (insertError) {
        setSavingSubjects(false);
        alert(insertError.message);
        return;
      }
    }

    setSavingSubjects(false);

    alert(
      'Subjects updated successfully!'
    );
  }

  function getSubjectIcon(
    subjectName: string
  ) {
    const name =
      subjectName.toLowerCase();

    if (name.includes('math')) {
      return (
        <Calculator
          size={28}
          strokeWidth={2}
        />
      );
    }

    if (name.includes('chem')) {
      return (
        <FlaskConical
          size={28}
          strokeWidth={2}
        />
      );
    }

    if (name.includes('phys')) {
      return (
        <Zap
          size={28}
          strokeWidth={2}
        />
      );
    }

    return (
      <Calculator
        size={28}
        strokeWidth={2}
      />
    );
  }

  return (
    <div className="page max-w-3xl">
      <h1 className="text-3xl font-black">
        Profile
      </h1>

      {/* Profile information */}
      <div className="card p-6 mt-7">
        <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-700 grid place-items-center text-2xl font-black">
          {name?.[0]?.toUpperCase() ||
            'L'}
        </div>

        <h2 className="text-2xl font-black mt-4">
          {name || 'Student'}
        </h2>

        <p className="muted">
          {p?.email}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <Stat
            t="Grade"
            v={p?.grade}
          />

          <Stat
            t="Language"
            v={p?.preferred_language}
          />

          <Stat
            t="XP"
            v={p?.xp || 0}
          />

          <Stat
            t="Streak"
            v={`${p?.current_streak || 0} days`}
          />
        </div>
      </div>

      {/* Edit profile */}
      <div className="card p-6 mt-5">
        <h2 className="font-black text-xl">
          Edit Profile
        </h2>

        <div className="space-y-4 mt-5">
          <div>
            <label className="block text-sm font-semibold mb-2">
              Full Name
            </label>

            <input
              value={name}
              onChange={(e) =>
                setName(
                  e.target.value
                )
              }
              className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="Enter your name"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              Grade
            </label>

            <select
              value={grade}
              onChange={(e) =>
                setGrade(
                  e.target.value
                )
              }
              className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">
                Select Grade
              </option>

              <option value="6">
                Grade 6
              </option>

              <option value="7">
                Grade 7
              </option>

              <option value="8">
                Grade 8
              </option>

              <option value="9">
                Grade 9
              </option>

              <option value="10">
                Grade 10
              </option>

              <option value="11">
                Grade 11
              </option>

              <option value="12">
                Grade 12
              </option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              Preferred Language
            </label>

            <select
              value={language}
              onChange={(e) =>
                setLanguage(
                  e.target.value
                )
              }
              className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="English">
                English
              </option>

              <option value="Hindi">
                Hindi
              </option>

              <option value="Telugu">
                Telugu
              </option>
            </select>
          </div>

          <button
            onClick={saveProfile}
            disabled={saving}
            className="btn btn-primary"
          >
            {saving
              ? 'Saving...'
              : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* Subjects */}
      <div className="card p-6 mt-5">
        <h2 className="font-black text-xl">
          My Subjects
        </h2>

        <p className="muted text-sm mt-1">
          Select the subjects you
          want to learn.
        </p>

        <div className="grid sm:grid-cols-3 gap-3 mt-5">
          {allSubjects.map(
            (subject) => {
              const selected =
                selectedSubjects.includes(
                  subject.id
                );

              return (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() =>
                    toggleSubject(
                      subject.id
                    )
                  }
                  className={`p-4 rounded-xl border text-left transition ${
                    selected
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      selected
                        ? 'bg-white text-indigo-600'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {getSubjectIcon(
                      subject.name
                    )}
                  </div>

                  <div className="font-bold mt-3">
                    {subject.name}
                  </div>

                  <div className="text-xs mt-1">
                    {selected
                      ? 'Selected ✓'
                      : 'Click to select'}
                  </div>
                </button>
              );
            }
          )}
        </div>

        <button
          onClick={saveSubjects}
          disabled={
            savingSubjects
          }
          className="btn btn-primary mt-5"
        >
          {savingSubjects
            ? 'Saving...'
            : 'Save Subjects'}
        </button>
      </div>

      {/* Badges */}
      <div className="card p-6 mt-5">
        <h2 className="font-black">
          Badges
        </h2>

        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          {badges.length ? (
            badges.map((b) => (
              <div
                key={b.earned_at}
                className="p-4 rounded-xl bg-amber-50"
              >
                <div className="font-bold">
                  {b.achievements
                    ?.icon}{' '}
                  {
                    b.achievements
                      ?.name
                  }
                </div>

                <div className="text-sm muted mt-1">
                  {
                    b.achievements
                      ?.description
                  }
                </div>
              </div>
            ))
          ) : (
            <p className="muted">
              Achievements you earn
              will appear here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  t,
  v,
}: {
  t: string;
  v: any;
}) {
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <div className="text-xs muted">
        {t}
      </div>

      <div className="font-black mt-1">
        {v ?? '—'}
      </div>
    </div>
  );
}