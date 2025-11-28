<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/17MtOvHEpJVV76pBfWRxU6hkuMrl7RqyU

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Supabase Setup

1. Create a new project in [Supabase](https://supabase.com) and grab the project URL and anon/public API key. Add them to `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. Apply the SQL in [`supabase-schema.sql`](supabase-schema.sql) using the Supabase SQL editor. This creates the `projects` and `project_states` tables plus permissive row-level security policies for anonymous access.
3. Create a storage bucket named `project-uploads` and mark it public. Ensure the bucket policies allow `read` and `write` for anonymous users since this app runs purely in the browser.
4. Start the Vite dev server. You'll be prompted to create or select a project before entering the editor; uploads, AI analysis, scripts, audio, and timeline data are automatically persisted to Supabase.
