import {
  createClient,
} from 'https://esm.sh/@supabase/supabase-js@2';

import {
  cors,
  json,
  gemini,
} from '../_shared.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: cors,
    });
  }

  try {
    const authorization =
      req.headers.get('Authorization');

    if (!authorization) {
      return json(
        { error: 'Unauthorized' },
        401
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: {
            Authorization:
              authorization,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return json(
        { error: 'Unauthorized' },
        401
      );
    }

    const body = await req.json();

    const {
      subjectId,
      topicId,
      subject,
      topic,
      score,
      total,
      accuracy,
    } = body;

    /*
      Get the student's existing
      performance from the database.
    */
    const {
      data: rows,
      error: progressError,
    } = await supabase
      .from('progress')
      .select(
        `
        accuracy,
        questions_attempted,
        questions_correct,
        mastery_level,
        subject_id,
        topic_id,
        subjects(name),
        topics(name)
        `
      )
      .eq('user_id', user.id)
      .order('accuracy', {
        ascending: true,
      })
      .limit(20);

    if (progressError) {
      throw progressError;
    }

    /*
      Put the quiz that was just completed
      at the beginning so Gemini considers
      the latest performance immediately.
    */
    const performance = [
      {
        subject:
          subject || 'Unknown',

        topic:
          topic || 'Unknown',

        questions_attempted:
          total ?? 0,

        questions_correct:
          score ?? 0,

        accuracy:
          Number(accuracy ?? 0),

        latest: true,
      },

      ...(rows ?? []).map(
        (row: any) => ({
          subject:
            row.subjects?.name ??
            'Unknown',

          topic:
            row.topics?.name ??
            'Unknown',

          questions_attempted:
            row.questions_attempted ??
            0,

          questions_correct:
            row.questions_correct ??
            0,

          accuracy:
            Number(
              row.accuracy ?? 0
            ),

          mastery_level:
            Number(
              row.mastery_level ?? 0
            ),
        })
      ),
    ];

    const systemPrompt = `
You are LearnMate AI's personalized
learning recommendation engine.

Analyze the student's real learning
performance and create useful study
recommendations.

Rules:

- Prioritize topics with accuracy below 60%.
- If accuracy is 60% to 84%, recommend
  additional practice.
- If accuracy is 85% or higher, recognize
  the progress and suggest a suitable
  next step.
- Only recommend subjects and topics that
  actually appear in the supplied data.
- Never invent performance data.
- Keep recommendations appropriate for
  school students.
- Return ONLY valid JSON.

Return exactly this format:

{
  "recommendations": [
    {
      "title": "...",
      "description": "...",
      "reason": "..."
    }
  ]
}

Return between 1 and 3 recommendations.
`;

    const userPrompt = `
Latest completed quiz:

Subject: ${subject || 'Unknown'}
Topic: ${topic || 'Unknown'}
Score: ${score ?? 0}/${total ?? 0}
Accuracy: ${accuracy ?? 0}%

Student performance:

${JSON.stringify(
  performance,
  null,
  2
)}
`;

    let recommendations: any[] = [];

    try {
      const raw =
        await gemini(
          [
            {
              text: userPrompt,
            },
          ],
          systemPrompt
        );

      const cleaned =
        raw
          .replace(
            /```json/gi,
            ''
          )
          .replace(
            /```/g,
            ''
          )
          .trim();

      const parsed =
        JSON.parse(cleaned);

      if (
        Array.isArray(
          parsed?.recommendations
        )
      ) {
        recommendations =
          parsed.recommendations
            .filter(
              (item: any) =>
                item?.title &&
                item?.description &&
                item?.reason
            )
            .slice(0, 3);
      }
    } catch (aiError) {
      console.error(
        'Gemini recommendation error:',
        aiError
      );
    }

    /*
      Fallback recommendation.
      This guarantees that a useful
      recommendation can still be saved
      even if Gemini temporarily fails.
    */
    if (
      recommendations.length === 0
    ) {
      const accuracyValue =
        Number(accuracy ?? 0);

      if (
        accuracyValue < 60
      ) {
        recommendations = [
          {
            title:
              `Practice ${topic || subject}`,

            description:
              `Review ${topic || subject} and take another practice quiz.`,

            reason:
              `Your latest quiz accuracy was ${accuracyValue}%.`,
          },
        ];
      } else if (
        accuracyValue < 85
      ) {
        recommendations = [
          {
            title:
              `Strengthen ${topic || subject}`,

            description:
              `Continue practicing ${topic || subject} to improve your accuracy.`,

            reason:
              `Your latest quiz accuracy was ${accuracyValue}%.`,
          },
        ];
      } else {
        recommendations = [
          {
            title:
              `Keep progressing in ${topic || subject}`,

            description:
              `Try a harder quiz or move to the next related topic.`,

            reason:
              `You scored ${accuracyValue}% on your latest quiz.`,
          },
        ];
      }
    }

    /*
      Remove older unfinished recommendations
      for this user so Dashboard shows the
      newest recommendations.
    */
    const {
      error: deleteError,
    } = await supabase
      .from('recommendations')
      .delete()
      .eq('user_id', user.id)
      .eq('completed', false);

    if (deleteError) {
      throw deleteError;
    }

    /*
      Save the new recommendations.
    */
    const rowsToInsert =
      recommendations.map(
        (item: any) => ({
          user_id: user.id,

          subject_id:
            subjectId || null,

          topic_id:
            topicId || null,

          title:
            String(
              item.title
            ),

          description:
            String(
              item.description
            ),

          reason:
            String(
              item.reason
            ),

          completed: false,
        })
      );

    const {
      data: saved,
      error: insertError,
    } =
      await supabase
        .from('recommendations')
        .insert(
          rowsToInsert
        )
        .select();

    if (insertError) {
      throw insertError;
    }

    return json({
      recommendations:
        saved ?? [],
    });
  } catch (error) {
    console.error(
      'Generate recommendations error:',
      error
    );

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Recommendation error',
      },
      500
    );
  }
});