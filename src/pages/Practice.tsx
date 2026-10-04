import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

function MathText({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children }) => <>{children}</>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

type Topic = {
  id: string;
  name: string;
  subject_id: string;
};

type QuizQuestion = {
  question: string;
  options: string[];
  answer?: string;
  correct_answer?: string;
  explanation?: string;
};

type QuizData = {
  title?: string;
  questions: QuizQuestion[];
};

type QuizResult = {
  score: number;
  total: number;
  accuracy: number;
  xp: number;
  subject: string;
  topic: string;
  difficulty: string;
};

const SUBJECTS = [
  'Mathematics',
  'Physics',
  'Chemistry',
];

const CUSTOM_TOPIC = '__CUSTOM_TOPIC__';
const RESUME_KEY = 'learnmate_active_quiz';

export default function Practice() {
  const [subject, setSubject] =
    useState('Mathematics');

  const [topics, setTopics] =
    useState<Topic[]>([]);

  const [topic, setTopic] =
    useState('');

  const [customTopic, setCustomTopic] =
    useState('');

  const [difficulty, setDifficulty] =
    useState('Medium');

  const [count, setCount] =
    useState(5);

  const [quiz, setQuiz] =
    useState<QuizData | null>(null);

  const [answers, setAnswers] =
    useState<Record<number, string>>({});

  const [current, setCurrent] =
    useState(0);

  const [result, setResult] =
    useState<QuizResult | null>(null);

  const [busy, setBusy] =
    useState(false);

  const [loadingTopics, setLoadingTopics] =
    useState(false);

  const [error, setError] =
    useState('');

  const restoringQuiz = useRef(false);

  const isCustomTopic =
    topic === CUSTOM_TOPIC;

  useEffect(() => {
    const saved = localStorage.getItem(RESUME_KEY);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        if (
          parsed?.quiz?.questions &&
          Array.isArray(parsed.quiz.questions) &&
          parsed.quiz.questions.length > 0
        ) {
          restoringQuiz.current = true;

          setSubject(parsed.subject ?? 'Mathematics');
          setDifficulty(parsed.difficulty ?? 'Medium');
          setCount(parsed.count ?? parsed.quiz.questions.length);
          setTopic(parsed.topic ?? '');
          setCustomTopic(parsed.customTopic ?? '');
          setQuiz(parsed.quiz);
          setAnswers(parsed.answers ?? {});
          setCurrent(
            typeof parsed.current === 'number'
              ? parsed.current
              : 0
          );
        }
      } catch (err) {
        console.error(
          'Could not restore saved quiz:',
          err
        );
        localStorage.removeItem(RESUME_KEY);
      }
    }
  }, []);

  useEffect(() => {
    loadTopics();
  }, [subject]);

  useEffect(() => {
    if (!quiz) return;

    localStorage.setItem(
      RESUME_KEY,
      JSON.stringify({
        quiz,
        answers,
        current,
        subject,
        topic,
        customTopic,
        difficulty,
        count,
      })
    );
  }, [
    quiz,
    answers,
    current,
    subject,
    topic,
    customTopic,
    difficulty,
    count,
  ]);

  async function loadTopics() {
    setLoadingTopics(true);
    setError('');

    setTopics([]);

    const keepRestoredTopic =
      restoringQuiz.current;

    if (!keepRestoredTopic) {
      setTopic('');
      setCustomTopic('');
    }

    try {
      const {
        data: subjectData,
        error: subjectError,
      } = await supabase
        .from('subjects')
        .select('id')
        .eq('name', subject)
        .maybeSingle();

      if (subjectError) {
        throw subjectError;
      }

      if (!subjectData) {
        throw new Error(
          `Could not find ${subject} in the database.`
        );
      }

      const {
        data: topicData,
        error: topicError,
      } = await supabase
        .from('topics')
        .select('id,name,subject_id')
        .eq('subject_id', subjectData.id)
        .order('name');

      if (topicError) {
        throw topicError;
      }

      const loadedTopics =
        topicData ?? [];

      setTopics(loadedTopics);

      if (!keepRestoredTopic) {
        if (loadedTopics.length > 0) {
          setTopic(
            loadedTopics[0].name
          );
        } else {
          setTopic(CUSTOM_TOPIC);
        }
      }

      restoringQuiz.current = false;
    } catch (err: any) {
      console.error(
        'Topic loading error:',
        err
      );

      setError(
        err?.message ||
          'Could not load topics.'
      );
    } finally {
      setLoadingTopics(false);
    }
  }

  async function generateQuiz() {
    setError('');

    const finalTopic =
      isCustomTopic
        ? customTopic.trim()
        : topic;

    if (!finalTopic) {
      setError(
        'Please select a topic or enter a custom topic.'
      );
      return;
    }

    setBusy(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          'Please log in again.'
        );
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select(
          'grade, preferred_language'
        )
        .eq('id', user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      const {
        data,
        error: functionError,
      } = await supabase.functions.invoke(
        'generate-quiz',
        {
          body: {
            userId: user.id,
            grade:
              profile?.grade ?? 10,
            subject,
            topic: finalTopic,
            difficulty,
            numberOfQuestions:
              count,
            language:
              profile?.preferred_language ??
              'English',
          },
        }
      );

      if (functionError) {
        throw functionError;
      }

      if (
        !data?.questions ||
        !Array.isArray(
          data.questions
        )
      ) {
        throw new Error(
          'AI did not return a valid quiz.'
        );
      }

      setQuiz({
        title:
          data.title ||
          `${subject} - ${finalTopic}`,
        questions:
          data.questions,
      });

      setAnswers({});
      setCurrent(0);
      setResult(null);
    } catch (err: any) {
      console.error(
        'Quiz generation error:',
        err
      );

      setError(
        err?.message ||
          'Could not generate the quiz.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitQuiz() {
    if (!quiz) return;

    setBusy(true);
    setError('');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          'Please log in again.'
        );
      }

      const total =
        quiz.questions.length;

      let score = 0;

      quiz.questions.forEach(
        (question, index) => {
          const correctAnswer =
            question.answer ??
            question.correct_answer ??
            '';

          if (
            answers[index] ===
            correctAnswer
          ) {
            score++;
          }
        }
      );

      const accuracy =
        total > 0
          ? Math.round(
              (score / total) * 100
            )
          : 0;

      const xp =
        score * 10 + 20;

      /* -----------------------------
         FIND SUBJECT
      ----------------------------- */

      const {
        data: subjectData,
        error: subjectError,
      } = await supabase
        .from('subjects')
        .select('id')
        .eq('name', subject)
        .maybeSingle();

      if (subjectError) {
        throw subjectError;
      }

      if (!subjectData) {
        throw new Error(
          `Could not find ${subject} in the database.`
        );
      }

      /* -----------------------------
         FIND TOPIC

         IMPORTANT:
         maybeSingle() is used instead
         of single().

         This allows custom topics
         that are not in the database.
      ----------------------------- */

      let topicId: string | null =
        null;

      if (!isCustomTopic) {
        const {
          data: topicData,
          error: topicError,
        } = await supabase
          .from('topics')
          .select('id')
          .eq(
            'subject_id',
            subjectData.id
          )
          .eq('name', topic)
          .maybeSingle();

        if (topicError) {
          throw topicError;
        }

        topicId =
          topicData?.id ?? null;
      }

      const finalTopic =
        isCustomTopic
          ? customTopic.trim()
          : topic;

      if (!finalTopic) {
        throw new Error(
          'Topic cannot be empty.'
        );
      }

      /* -----------------------------
         SAVE QUIZ
      ----------------------------- */

      const {
        data: savedQuiz,
        error: quizError,
      } = await supabase
        .from('quizzes')
        .insert({
          user_id: user.id,
          subject_id:
            subjectData.id,
          topic_id: topicId,
          difficulty,
          number_of_questions:
            total,
          score,
          completed: true,
          completed_at:
            new Date().toISOString(),
        })
        .select()
        .single();

      if (quizError) {
        throw quizError;
      }

      /* -----------------------------
         SAVE QUESTIONS
      ----------------------------- */

      const questionRows =
        quiz.questions.map(
          (question, index) => {
            const correctAnswer =
              question.answer ??
              question.correct_answer ??
              '';

            return {
              quiz_id:
                savedQuiz.id,

              question:
                question.question,

              options:
                question.options,

              correct_answer:
                correctAnswer,

              explanation:
                question.explanation ??
                '',

              student_answer:
                answers[index] ??
                null,

              is_correct:
                answers[index] ===
                correctAnswer,

              topic: finalTopic,
            };
          }
        );

      const {
        error: questionsError,
      } = await supabase
        .from('quiz_questions')
        .insert(questionRows);

      if (questionsError) {
        throw questionsError;
      }

      /* -----------------------------
         UPDATE PROGRESS + XP

         Only predefined database
         topics have a progress row.
      ----------------------------- */

      if (topicId) {
        const {
          error: progressError,
        } = await supabase.rpc(
          'record_quiz_progress',
          {
            p_user_id: user.id,
            p_subject_id:
              subjectData.id,
            p_topic_id: topicId,
            p_questions_attempted:
              total,
            p_questions_correct:
              score,
            p_xp: xp,
          }
        );

        if (progressError) {
          throw progressError;
        }
      } else {
        /* -----------------------------
           CUSTOM TOPIC

           There is no topic row, so
           update XP directly.
        ----------------------------- */

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from('profiles')
          .select('xp')
          .eq('id', user.id)
          .single();

        if (profileError) {
          throw profileError;
        }

        const currentXP =
          profile?.xp ?? 0;

        const {
          error: xpError,
        } = await supabase
          .from('profiles')
          .update({
            xp:
              currentXP + xp,
          })
          .eq(
            'id',
            user.id
          );

        if (xpError) {
          throw xpError;
        }
      }

      /* -----------------------------
         RECORD LEARNING ACTIVITY

         This updates:
         - current streak
         - longest streak
         - learning_activity

         XP is NOT added again here.
         The XP was already awarded above.
      ----------------------------- */

      const {
        error: activityError,
      } = await supabase.rpc(
        'record_learning_activity',
        {
          p_user_id: user.id,
          p_activity_type: 'quiz',
          p_xp: xp,
        }
      );

      if (activityError) {
        throw activityError;
      }
      /* -----------------------------
         GENERATE RECOMMENDATION

         This runs after the quiz,
         progress, XP, and streak have
         already been saved.

         Recommendation failure must
         NOT prevent quiz submission.
      ----------------------------- */

      try {
        const {
          error: recommendationError,
        } = await supabase.functions.invoke(
          'generate-recommendations',
          {
            body: {
              subjectId:
                subjectData.id,

              topicId:
                topicId,

              subject:
                subject,

              topic:
                finalTopic,

              score:
                score,

              total:
                total,

              accuracy:
                accuracy,
            },
          }
        );

        if (recommendationError) {
          console.error(
            'Recommendation generation failed:',
            recommendationError
          );
        }
      } catch (recommendationError) {
        console.error(
          'Recommendation generation failed:',
          recommendationError
        );
      }

      /* -----------------------------
         SHOW RESULT
      ----------------------------- */

      localStorage.removeItem(
        RESUME_KEY
      );

      setResult({
        score,
        total,
        accuracy,
        xp,
        subject,
        topic: finalTopic,
        difficulty,
      });

      setQuiz(null);
    } catch (err: any) {
      console.error(
        'Quiz submission error:',
        err
      );

      setError(
        err?.message ||
          'Could not submit the quiz.'
      );
    } finally {
      setBusy(false);
    }
  }

  function restartPractice() {
    localStorage.removeItem(
      RESUME_KEY
    );

    setQuiz(null);
    setAnswers({});
    setCurrent(0);
    setResult(null);
    setError('');
  }

  /* =================================
     RESULT SCREEN
  ================================= */

  if (result) {
    return (
      <div className="page max-w-4xl">
        <div className="card p-8 text-center">
          <div className="w-20 h-20 rounded-2xl bg-green-50 text-green-600 grid place-items-center mx-auto">
            <Trophy size={40} />
          </div>

          <h1 className="text-3xl font-black mt-5">
            Quiz complete!
          </h1>

          <p className="muted mt-2">
            {result.subject} ·{' '}
            {result.topic} ·{' '}
            {result.difficulty}
          </p>

          <p className="muted mt-6">
            You scored
          </p>

          <div className="text-5xl font-black text-indigo-600 mt-2">
            {result.score}/
            {result.total}
          </div>

          <p className="mt-4">
            Accuracy:{' '}
            {result.accuracy}%
            {' · '}
            XP earned:{' '}
            {result.xp}
          </p>

          <button
            type="button"
            onClick={
              restartPractice
            }
            className="btn btn-primary mt-8"
          >
            Practice again
          </button>
        </div>
      </div>
    );
  }

  /* =================================
     QUIZ SCREEN
  ================================= */

  if (quiz) {
    const question =
      quiz.questions[current];

    const selectedAnswer =
      answers[current];

    const isLastQuestion =
      current ===
      quiz.questions.length - 1;

    return (
      <div className="page max-w-4xl">
        <div className="flex justify-between items-center gap-4">
          <div>
            <p className="muted">
              {subject} ·{' '}
              {isCustomTopic
                ? customTopic
                : topic}{' '}
              · {difficulty}
            </p>

            <h1 className="text-2xl font-black mt-1">
              Question{' '}
              {current + 1} of{' '}
              {quiz.questions.length}
            </h1>
          </div>

          <div className="text-sm font-bold">
            {Math.round(
              ((current + 1) /
                quiz.questions.length) *
                100
            )}
            %
          </div>
        </div>

        <div className="h-2 bg-slate-200 rounded-full mt-5 overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all"
            style={{
              width: `${
                ((current + 1) /
                  quiz.questions.length) *
                100
              }%`,
            }}
          />
        </div>

        <div className="card p-7 mt-6">
          <div className="text-xl font-bold leading-8">
            <MathText
              text={question.question}
            />
          </div>

          <div className="grid gap-3 mt-6">
            {question.options.map(
              (option, index) => {
                const selected =
                  selectedAnswer ===
                  option;

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() =>
                      setAnswers(
                        (previous) => ({
                          ...previous,
                          [current]:
                            option,
                        })
                      )
                    }
                    className={`p-4 border rounded-xl text-left transition ${
                      selected
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full grid place-items-center font-bold ${
                          selected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {String.fromCharCode(
                          65 + index
                        )}
                      </div>

                      <div className="flex-1">
                        <MathText
                          text={option}
                        />
                      </div>
                    </div>
                  </button>
                );
              }
            )}
          </div>
        </div>

        <div className="flex justify-between mt-5">
          <button
            type="button"
            disabled={
              current === 0 ||
              busy
            }
            onClick={() =>
              setCurrent(
                (value) =>
                  Math.max(
                    0,
                    value - 1
                  )
              )
            }
            className="btn btn-ghost"
          >
            <ChevronLeft />
            Previous
          </button>

          {!isLastQuestion ? (
            <button
              type="button"
              disabled={
                !selectedAnswer ||
                busy
              }
              onClick={() =>
                setCurrent(
                  (value) =>
                    Math.min(
                      quiz.questions
                        .length - 1,
                      value + 1
                    )
                )
              }
              className="btn btn-primary"
            >
              Next
              <ChevronRight />
            </button>
          ) : (
            <button
              type="button"
              disabled={
                !selectedAnswer ||
                busy
              }
              onClick={
                submitQuiz
              }
              className="btn btn-primary"
            >
              {busy ? (
                <>
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2
                    size={18}
                  />
                  Submit Quiz
                </>
              )}
            </button>
          )}
        </div>

        {error && (
          <div className="mt-5 p-4 rounded-xl bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>
    );
  }

  /* =================================
     PRACTICE SETUP
  ================================= */

  return (
    <div className="page max-w-4xl">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 grid place-items-center mx-auto">
          <Sparkles />
        </div>

        <h1 className="text-3xl font-black mt-5">
          AI Practice
        </h1>

        <p className="muted mt-2">
          Generate a quiz tailored to
          what you are learning.
        </p>
      </div>

      <div className="card p-6 mt-8 space-y-5">
        {/* SUBJECT */}

        <label className="block font-bold">
          Subject

          <select
            className="input mt-2 w-full"
            value={subject}
            onChange={(e) =>
              setSubject(
                e.target.value
              )
            }
            disabled={busy}
          >
            {SUBJECTS.map(
              (item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              )
            )}
          </select>
        </label>

        {/* TOPIC */}

        <label className="block font-bold">
          Topic

          <select
            className="input mt-2 w-full"
            value={topic}
            onChange={(e) => {
              setTopic(
                e.target.value
              );

              if (
                e.target.value !==
                CUSTOM_TOPIC
              ) {
                setCustomTopic('');
              }
            }}
            disabled={
              loadingTopics ||
              busy
            }
          >
            {loadingTopics ? (
              <option>
                Loading topics...
              </option>
            ) : (
              <>
                {topics.map(
                  (item) => (
                    <option
                      key={item.id}
                      value={
                        item.name
                      }
                    >
                      {item.name}
                    </option>
                  )
                )}

                <option
                  value={
                    CUSTOM_TOPIC
                  }
                >
                  Other / Custom Topic
                </option>
              </>
            )}
          </select>
        </label>

        {/* CUSTOM TOPIC */}

        {isCustomTopic && (
          <div>
            <label className="block font-bold">
              Enter your topic

              <input
                className="input mt-2 w-full"
                value={
                  customTopic
                }
                onChange={(e) =>
                  setCustomTopic(
                    e.target.value
                  )
                }
                placeholder="Example: Newton's Laws"
                disabled={busy}
              />
            </label>

            <p className="text-xs text-slate-500 mt-2">
              Use this when your topic is
              not available in the list.
            </p>
          </div>
        )}

        {/* DIFFICULTY + COUNT */}

        <div className="grid md:grid-cols-2 gap-4">
          <label className="block font-bold">
            Difficulty

            <select
              className="input mt-2 w-full"
              value={
                difficulty
              }
              onChange={(e) =>
                setDifficulty(
                  e.target.value
                )
              }
              disabled={busy}
            >
              <option>
                Easy
              </option>

              <option>
                Medium
              </option>

              <option>
                Hard
              </option>
            </select>
          </label>

          <label className="block font-bold">
            Questions

            <select
              className="input mt-2 w-full"
              value={count}
              onChange={(e) =>
                setCount(
                  Number(
                    e.target.value
                  )
                )
              }
              disabled={busy}
            >
              <option value={5}>
                5
              </option>

              <option value={10}>
                10
              </option>

              <option value={20}>
                20
              </option>
            </select>
          </label>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={
            generateQuiz
          }
          disabled={
            busy ||
            loadingTopics ||
            !topic ||
            (isCustomTopic &&
              !customTopic.trim())
          }
          className="btn btn-primary w-full justify-center"
        >
          {busy ? (
            <>
              <Loader2
                className="animate-spin"
              />
              Generating...
            </>
          ) : (
            <>
              <Sparkles />
              Generate quiz
            </>
          )}
        </button>
      </div>
    </div>
  );
}