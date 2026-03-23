# Copilot Instructions for CMS-Loader

## Project summary
- Node.js + Express server with TypeScript.
- Handles CSV uploads, analysis and user registration via routes: `/analyzeCSV`, `/registerUsers`, `/addParticipation`, `/`.
- Static assets served from `src/public` and views in `src/views` using EJS.

## How to run
- `npm install`
- `npm run dev` for local development (ts-node)
- `npm run build` then `npm start` for production build

## Key files
- `src/index.ts`: Express configuration, middleware, sessions, logging, routes.
- `src/router.ts`: router mount points and controllers.
- `src/controllers/*.ts`: request handling for business flows.
- `src/utils/csv.ts`: CSV parsing helper.

## Coding conventions
- TypeScript modules with `import`/`export`.
- Async operations use Promises.
- Use existing controller pattern (default export router). Keep minimal side effects.
- Keep doc strings brief and in English/Spanish mix based on source style.

## PR guidance
- follow `npm run build` without errors
- preserve route structure and session handling behavior

## Risks / pitfalls
- `process.env.NODE_ENV` controls secure cookie and proxy settings.
- CSV parsing is central; avoid silent data-loss changes.

## Suggested prompts
- "Refactor `src/controllers/analyzeCSV.ts` to use typed request/response and add a unit test scenario for invalid CSV format."
- "Add a new `POST /uploadMetadata` route and controller in the same style as existing routes."

## Next agent customization ideas
- `/create-instruction add-express-route`: scaffold route + controller + tests.
- `/create-hook enforce-csv-schema`: validate uploaded CSV column names.
- `/create-skill workflow-runner`: describe build/test/deploy workflow for this project.
