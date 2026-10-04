export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
};

export function json(
  data: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...cors,
        'Content-Type':
          'application/json',
      },
    }
  );
}

export async function gemini(
  parts: unknown[],
  system: string
) {
  const key =
    Deno.env.get(
      'GEMINI_API_KEY'
    );

  if (!key) {
    throw new Error(
      'GEMINI_API_KEY is not configured'
    );
  }

  const response =
    await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
          'x-goog-api-key': key,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: system,
              },
            ],
          },
          contents: [
            {
              role: 'user',
              parts,
            },
          ],
          generationConfig: {
            temperature: 0.35,
          },
        }),
      }
    );

  if (!response.ok) {
    const errorText =
      await response.text();

    console.error(
      'Gemini API error:',
      response.status,
      errorText
    );

    throw new Error(
      `Gemini request failed: ${response.status} ${errorText}`
    );
  }

  const data =
    await response.json();

  return (
    data.candidates?.[0]
      ?.content?.parts
      ?.map(
        (part: {
          text?: string;
        }) =>
          part.text || ''
      )
      .join('') || ''
  );
}