# LearnMate AI — Your Personal AI Teacher
🌐 **Live Demo:** https://learnmate-ai-nu.vercel.app

LearnMate AI is a full-stack school-learning companion built around React + TypeScript + Vite, Supabase and Gemini. It supports authenticated student profiles, onboarding, AI tutoring, image attachments, quizzes, progress, recommendations, streaks/XP, history, profile/settings and multilingual/voice browser features.

## Stack
- React + TypeScript + Vite
- Tailwind CSS + Lucide
- Supabase PostgreSQL/Auth/Storage/RLS/Edge Functions
- Google Gemini API via secure Edge Functions
- Recharts

## Local setup
1. Install Node.js 20+ and the Supabase CLI.
2. `npm install`
3. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Create/link a Supabase project.
5. Apply `supabase/migrations/001_init.sql` with the Supabase SQL editor or migrations workflow.
6. Create a private Storage bucket named `student-files` and configure policies so authenticated users can access only their own object prefix.
7. Set `GEMINI_API_KEY` as an Edge Function secret. Never put it in `.env` variables prefixed with `VITE_`.
8. Deploy functions under `supabase/functions/`.
9. `npm run dev`

## Edge Functions
- `ai-tutor`: authenticated Gemini tutoring context.
- `generate-quiz`: strict JSON quiz generation and validation.
- `generate-recommendations`: creates recommendations from real progress.
- `evaluate-answer`: optional open-answer evaluation.

## Security
RLS is enabled for private tables. Backend functions derive the authenticated user from the Supabase session. Gemini secrets remain server-side. Validate file MIME type/size at upload boundaries and use private Storage policies in production.

## Demo flow
Signup → Onboarding → Dashboard → AI Tutor → image question → Practice → Quiz → Progress → Recommendations → History → Profile → Settings → Logout.

## Production hardening checklist
- Replace wildcard Edge Function CORS with the deployed app origin.
- Add Storage RLS policies for `student-files` object paths beginning with `auth.uid()`.
- Add request/rate limits at the edge.
- Add image compression and a server-side multimodal upload path that sends image bytes/parts to Gemini instead of public URLs.
- Add automated tests and CI.
- Configure email confirmation/password recovery and production redirect URLs.
