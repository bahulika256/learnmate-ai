import {
  createClient,
} from 'https://esm.sh/@supabase/supabase-js@2';

import {
  cors,
  json,
  gemini,
} from '../_shared.ts';

type QuizQuestion = {
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: cors,
    });
  }

  try {
    const auth =
      req.headers.get('Authorization');

    if (!auth) {
      return json(
        { error: 'Unauthorized' },
        401
      );
    }

    const sb =
      createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        {
          global: {
            headers: {
              Authorization: auth,
            },
          },
        }
      );

    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return json(
        { error: 'Unauthorized' },
        401
      );
    }

    const body =
      await req.json();

    const numberOfQuestions =
      Math.min(
        Math.max(
          Number(
            body.numberOfQuestions
          ) || 5,
          1
        ),
        20
      );

    const subject =
      String(
        body.subject || ''
      ).trim();

    const topic =
      String(
        body.topic || ''
      ).trim();

    const difficulty =
      String(
        body.difficulty || 'Medium'
      ).trim();

    const grade =
      String(
        body.grade || '10'
      ).trim();

    const language =
      String(
        body.language || 'English'
      ).trim();

    if (!subject || !topic) {
      return json(
        {
          error:
            'Subject and topic are required.',
        },
        400
      );
    }

    /*
     * --------------------------------
     * FIND THE SUBJECT
     * --------------------------------
     */

    const {
      data: subjectRow,
      error: subjectError,
    } = await sb
      .from('subjects')
      .select('id, name')
      .ilike('name', subject)
      .maybeSingle();

    if (subjectError) {
      console.error(
        'Subject lookup error:',
        subjectError
      );
    }

    /*
     * --------------------------------
     * VALIDATE THE TOPIC
     * --------------------------------
     *
     * Predefined topics are accepted when
     * they belong to the selected subject.
     *
     * Custom topics are checked against the
     * subject-specific database topics first.
     * If the topic is new, Gemini verifies
     * that it genuinely belongs to the
     * selected subject before quiz generation.
     *
     * This does NOT change the existing
     * question generation or non-repetition
     * logic below.
     */

    if (subjectRow?.id) {
      const {
        data: topicRows,
        error: topicLookupError,
      } = await sb
        .from('topics')
        .select('name, subject_id');

      if (topicLookupError) {
        throw topicLookupError;
      }

      const {
        data: subjectRows,
        error: subjectLookupError,
      } = await sb
        .from('subjects')
        .select('id, name');

      if (subjectLookupError) {
        throw subjectLookupError;
      }

      const normalizeTopic = (
        value: string
      ) =>
        value
          .trim()
          .toLowerCase()
          .replace(/\s+/g, ' ');

      const normalizedTopic =
        normalizeTopic(topic);

      const matchingTopics =
        (topicRows ?? []).filter(
          (row: {
            name: string;
            subject_id: string;
          }) =>
            normalizeTopic(
              String(row.name ?? '')
            ) === normalizedTopic
        );

      const currentSubjectMatch =
        matchingTopics.some(
          (row: {
            name: string;
            subject_id: string;
          }) =>
            row.subject_id === subjectRow.id
        );

      if (!currentSubjectMatch) {
        const otherSubjectMatch =
          matchingTopics.find(
            (row: {
              name: string;
              subject_id: string;
            }) =>
              row.subject_id !==
              subjectRow.id
          );

        if (otherSubjectMatch) {
          const otherSubject =
            (subjectRows ?? []).find(
              (row: {
                id: string;
                name: string;
              }) =>
                row.id ===
                otherSubjectMatch.subject_id
            );

          return json(
            {
              error:
                `"${topic}" is a ${otherSubject?.name ?? 'different subject'} topic, not a ${subject} topic. Please enter a topic related to ${subject}.`,
              code:
                'INVALID_TOPIC_SUBJECT',
            },
            400
          );
        }

        /*
         * The topic is not one of the
         * predefined topics. Ask Gemini to
         * classify it before continuing.
         */
        const currentSubjectTopics =
          (topicRows ?? [])
            .filter(
              (row: {
                name: string;
                subject_id: string;
              }) =>
                row.subject_id ===
                subjectRow.id
            )
            .map(
              (row: {
                name: string;
              }) => row.name
            );

        const otherSubjectTopics =
          (topicRows ?? [])
            .filter(
              (row: {
                name: string;
                subject_id: string;
              }) =>
                row.subject_id !==
                subjectRow.id
            )
            .map(
              (row: {
                name: string;
                subject_id: string;
              }) => {
                const owner =
                  (subjectRows ?? []).find(
                    (subjectItem: {
                      id: string;
                      name: string;
                    }) =>
                      subjectItem.id ===
                      row.subject_id
                  );

                return `${
                  owner?.name ?? 'Other'
                }: ${row.name}`;
              }
            );

        const validationPrompt = `
You are a strict school-subject topic validator.

Selected subject:
${subject}

Student's custom topic:
${topic}

Known topics for the selected subject:
${currentSubjectTopics.join(', ') || 'None'}

Known topics belonging to other subjects:
${otherSubjectTopics.join(', ') || 'None'}

Determine whether the student's custom topic genuinely belongs to the selected subject.

Rules:
- Mathematics topics must be genuinely mathematical.
- Physics topics must be genuinely physics-related.
- Chemistry topics must be genuinely chemistry-related.
- Reject programming languages, programming, computer science, web development, and other unrelated topics when the selected subject is Mathematics, Physics, or Chemistry.
- Reject a topic that clearly belongs to another school subject.
- A legitimate new topic that is not in the database may be accepted if it genuinely belongs to the selected subject.
- Do not accept a topic merely because it can be used in a problem involving the selected subject.
- Be strict.

Return ONLY valid JSON:
{
  "valid": true,
  "reason": "short explanation"
}
`;

        let validationText = '';

        try {
          validationText = await gemini(
            [
              {
                text: validationPrompt,
              },
            ],
            `
You are validating whether a custom educational topic belongs to a selected school subject.

Return JSON only.
Do not use markdown.
Do not use code fences.
`
          );
        } catch (validationError) {
          console.error(
            'Custom topic validation error:',
            validationError
          );

          return json(
            {
              error:
                'We could not validate this custom topic right now. Please try again.',
              code:
                'TOPIC_VALIDATION_FAILED',
            },
            503
          );
        }

        const cleanedValidation =
          validationText
            .replace(
              /^```json\s*/i,
              ''
            )
            .replace(
              /^```\s*/i,
              ''
            )
            .replace(
              /\s*```$/i,
              ''
            )
            .trim();

        let validationResult: {
          valid?: boolean;
          reason?: string;
        };

        try {
          validationResult =
            JSON.parse(
              cleanedValidation
            );
        } catch {
          return json(
            {
              error:
                'We could not validate this custom topic. Please try again.',
              code:
                'TOPIC_VALIDATION_FAILED',
            },
            503
          );
        }

        if (
          validationResult.valid !== true
        ) {
          return json(
            {
              error:
                `"${topic}" is not a ${subject} topic. Please enter a topic related to ${subject}.`,
              code:
                'INVALID_TOPIC_SUBJECT',
            },
            400
          );
        }
      }
    }

    /*
     * --------------------------------
     * FIND THE USER'S PREVIOUS QUIZZES
     * FOR THIS SUBJECT
     * --------------------------------
     */

    let previousQuestions:
      QuizQuestion[] = [];

    if (subjectRow?.id) {
      const {
        data: previousQuizzes,
        error: quizzesError,
      } = await sb
        .from('quizzes')
        .select('id')
        .eq(
          'user_id',
          user.id
        )
        .eq(
          'subject_id',
          subjectRow.id
        )
        .order(
          'created_at',
          {
            ascending: false,
          }
        )
        .limit(50);

      if (quizzesError) {
        console.error(
          'Previous quiz lookup error:',
          quizzesError
        );
      }

      const quizIds =
        (previousQuizzes ?? [])
          .map(
            (quiz: { id: string }) =>
              quiz.id
          );

      /*
       * --------------------------------
       * FIND PREVIOUS QUESTIONS
       * --------------------------------
       */

      if (quizIds.length > 0) {
        const {
          data: oldQuestions,
          error: questionsError,
        } = await sb
          .from('quiz_questions')
          .select(
            'question, options, correct_answer, explanation, topic, created_at'
          )
          .in(
            'quiz_id',
            quizIds
          )
          .ilike(
            'topic',
            topic
          )
          .order(
            'created_at',
            {
              ascending: false,
            }
          )
          .limit(50);

        if (questionsError) {
          console.error(
            'Previous question lookup error:',
            questionsError
          );
        } else {
          previousQuestions =
            (oldQuestions ?? [])
              .map(
                (question: {
                  question: string;
                  options: string[];
                  correct_answer: string;
                  explanation: string;
                }) => ({
                  question:
                    question.question,
                  options:
                    question.options,
                  correct_answer:
                    question.correct_answer,
                  explanation:
                    question.explanation,
                })
              );
        }
      }
    }

    /*
     * --------------------------------
     * REMOVE DUPLICATE OLD QUESTIONS
     * --------------------------------
     */

    const seenOldQuestions =
      new Set<string>();

    const previousQuestionTexts =
      previousQuestions
        .map(
          (
            question: QuizQuestion
          ) =>
            String(
              question.question || ''
            ).trim()
        )
        .filter(
          (
            question: string
          ) => {
            const key =
              question.toLowerCase();

            if (
              !question ||
              seenOldQuestions.has(
                key
              )
            ) {
              return false;
            }

            seenOldQuestions.add(
              key
            );

            return true;
          }
        )
        .slice(0, 50);

    /*
     * --------------------------------
     * BUILD PREVIOUS QUESTION SECTION
     * --------------------------------
     */

    let avoidSection =
      `
There are no previous questions available for this student and topic.

Create a fresh set of questions.
`;

    if (
      previousQuestionTexts.length >
      0
    ) {
      avoidSection = `
The student has already seen the following questions for this topic.

DO NOT repeat any of these questions.

DO NOT:
- copy the same question
- merely change the option order
- change only the numbers in the question
- make a trivial variation of the same question

Create genuinely different questions while still testing the same topic.

Previously used questions:

${previousQuestionTexts
  .map(
    (
      question: string,
      index: number
    ) =>
      `${index + 1}. ${question}`
  )
  .join('\n')}
`;
    }

    /*
     * --------------------------------
     * GEMINI PROMPT
     * --------------------------------
     */

    const prompt = `
Generate exactly ${numberOfQuestions} multiple-choice questions.

Student grade: ${grade}
Subject: ${subject}
Topic: ${topic}
Difficulty: ${difficulty}
Preferred language: ${language}

Requirements:

1. Generate exactly ${numberOfQuestions} questions.
2. Every question must have exactly 4 options.
3. There must be exactly one unambiguous correct answer.
4. The correct_answer must exactly match one of the four options.
5. Give a short explanation for each answer.
6. Keep the questions appropriate for Grade ${grade}.
7. Questions must genuinely test the requested topic.
8. Do not repeat previously used questions.
9. Do not simply reorder old questions.
10. Do not create trivial copies of old questions.
11. Vary the question wording and approach.
12. Use the requested language.
13. Return ONLY valid JSON.
14. Do not use markdown.
15. Do not include code fences.

${avoidSection}

Return exactly this JSON structure:

{
  "title": "${subject} - ${topic}",
  "questions": [
    {
      "question": "...",
      "options": [
        "...",
        "...",
        "...",
        "..."
      ],
      "correct_answer": "...",
      "explanation": "..."
    }
  ]
}
`;

    /*
     * --------------------------------
     * CALL GEMINI
     * --------------------------------
     */

    const raw =
      await gemini(
        [
          {
            text: prompt,
          },
        ],
        `
You are an educational assessment generator.

Create original, age-appropriate
multiple-choice questions.

Follow the requested JSON structure
exactly.

Never include markdown fences.
Output JSON only.
        `
      );

    /*
     * --------------------------------
     * CLEAN GEMINI RESPONSE
     * --------------------------------
     */

    const clean =
      raw
        .replace(
          /^```json\s*/i,
          ''
        )
        .replace(
          /^```\s*/i,
          ''
        )
        .replace(
          /\s*```$/i,
          ''
        )
        .trim();

    const parsed =
      JSON.parse(clean);

    /*
     * --------------------------------
     * CHECK QUIZ FORMAT
     * --------------------------------
     */

    if (
      !Array.isArray(
        parsed.questions
      ) ||
      parsed.questions.length !==
        numberOfQuestions
    ) {
      throw new Error(
        'Invalid quiz format returned by AI.'
      );
    }

    /*
     * --------------------------------
     * VALIDATE EACH QUESTION
     * --------------------------------
     */

    const questions =
      parsed.questions as QuizQuestion[];

    for (
      const question of questions
    ) {
      if (
        !question.question ||
        !Array.isArray(
          question.options
        ) ||
        question.options.length !==
          4 ||
        !question.correct_answer ||
        !question.explanation
      ) {
        throw new Error(
          'AI returned an invalid question format.'
        );
      }

      if (
        !question.options.includes(
          question.correct_answer
        )
      ) {
        throw new Error(
          'AI returned a correct answer that does not match an option.'
        );
      }
    }

    /*
     * --------------------------------
     * CHECK DUPLICATES INSIDE
     * THE CURRENT QUIZ
     * --------------------------------
     */

    const currentQuestionSet =
      new Set<string>();

    for (
      const question of questions
    ) {
      const key =
        question.question
          .trim()
          .toLowerCase();

      if (
        currentQuestionSet.has(key)
      ) {
        throw new Error(
          'AI generated duplicate questions. Please generate the quiz again.'
        );
      }

      currentQuestionSet.add(key);
    }

    /*
     * --------------------------------
     * CHECK AGAINST OLD QUESTIONS
     * --------------------------------
     *
     * This is a final safety check.
     * If Gemini accidentally repeats an
     * old question exactly, reject it.
     */

    const oldQuestionSet =
      new Set(
        previousQuestionTexts.map(
          (question: string) =>
            question
              .trim()
              .toLowerCase()
        )
      );

    for (
      const question of questions
    ) {
      const key =
        question.question
          .trim()
          .toLowerCase();

      if (
        oldQuestionSet.has(key)
      ) {
        throw new Error(
          'AI generated a previously used question. Please generate the quiz again.'
        );
      }
    }

    /*
     * --------------------------------
     * RETURN QUIZ
     * --------------------------------
     */

    return json({
      title:
        parsed.title ||
        `${subject} - ${topic}`,

      questions,
    });
  } catch (e) {
    console.error(
      'Generate quiz error:',
      e
    );

    return json(
      {
        error:
          e instanceof Error
            ? e.message
            : 'Quiz error',
      },
      500
    );
  }
});