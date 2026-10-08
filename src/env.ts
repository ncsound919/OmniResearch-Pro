/**
 * env.ts — load `.env` BEFORE any module that reads process.env at import time.
 *
 * ESM evaluates imported modules depth-first in source order, so `server.ts`
 * must import this file FIRST. Without it, `dotenv.config()` in the server body
 * would run *after* `src/ecosystem/llm.ts` and `src/ecosystem/clients.ts` had
 * already frozen LITELLM_URL / DEV_BRAIN_URL / RECOURSE_URL / … from an empty
 * environment, silently ignoring the app's `.env`.
 *
 * Under pm2 the fleet-manifest env is already in process.env before node
 * starts, so this is belt-and-braces for local `npm run dev`.
 */
import dotenv from "dotenv";

dotenv.config();
