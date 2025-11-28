# Repository Guidelines

Keep Visionary Video Analysis predictable by following the shared structure, tooling, and workflows below.

## Project Structure & Module Organization

- `index.tsx` mounts the Vite + React app while `App.tsx` contains the shell layout; colocate new feature views beside `App.tsx`.
- Cross-cutting logic belongs in `services/` (Gemini, FFmpeg, Supabase, ElevenLabs, scraper, project persistence) plus `utils.ts`, `constants.ts`, and `types.ts`. Extend these modules before adding ad-hoc helpers.
- Track schema updates in `supabase-schema.sql` and store tests/mocks beside their modules (`services/__tests__/geminiService.test.ts`).

## Build, Test, and Development Commands

- `npm install` installs dependencies pinned in `package-lock.json`.
- `npm run dev` launches the Vite dev server with HMR at http://localhost:5173.
- `npm run build` emits an optimized bundle into `dist/`.
- `npm run preview` serves the latest build to inspect production behaviour.

## Coding Style & Naming Conventions

- Stack defaults: TypeScript 5.8, ES modules, React function components. Use `tsx` for UI surfaces and `ts` for headless utilities.
- Naming: camelCase variables/functions, PascalCase components, SCREAMING_SNAKE_CASE exported constants.
- Style: 2-space indent, trailing commas on multiline literals, explicit return types for shared utilities. Format via your editor or Prettier-equivalent before committing.

## Testing Guidelines

- No automated suites exist yet. Add Vitest specs beside their targets (`services/.../__tests__`) and mock Supabase/Gemini calls for offline determinism.
- Name tests after observable behaviour (e.g., `geminiService.generateSummary returns markdown`) and cover failure modes like API throttling or upload errors.

## Commit & Pull Request Guidelines

- Use Conventional Commits (`feat:`, `fix:`, `chore:`) to keep history scan-friendly. Scope each PR to one feature or fix.
- PR descriptions must outline behaviour changes, list manual/automated test evidence, and call out Supabase schema modifications.

## Security & Configuration Tips

- Secrets stay in `.env.local` (`GEMINI_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and are accessed through `import.meta.env`. Never commit credentialed files.
- Document Supabase storage/policy changes (e.g., `project-uploads` bucket, RLS updates) and confirm third-party quotas before new automation ships.

## Frontend Design Agent Workflow

- Treat UI design requests as the **superdesign** agent: 1) share ASCII layout, 2) generate theme via `generateTheme`, 3) describe animations, 4) output a single-screen HTML/SVG.
- Pause after each stage for user approval before moving forward.
- Save every design file inside `.superdesign/design_iterations/` using `{design_name}_{n}.html`; iterate with suffixes (`ui_1.html`, `ui_1_1.html`, etc.).
- Prefer Flowbite/Tailwind foundations, avoid default blues unless requested, include responsive breakpoints, and reference the generated theme CSS with `!important` on key selectors.
