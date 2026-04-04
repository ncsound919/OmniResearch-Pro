<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# OmniResearch Pro

This contains everything you need to run the OmniResearch Pro app locally.

View your app in AI Studio: https://ai.studio/apps/8c5d9db2-e94a-4ce5-b341-f192900ec6c6

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Optional open-source upgrades:
   - Set `OLLAMA_BASE_URL` and `OLLAMA_MODEL` to enable the Local engine with a real Ollama runtime
   - Set `SEARXNG_BASE_URL` to enable Live Web Search through a SearXNG instance
4. Run the app:
   `npm run dev`

## Open-source enhancement points

- **Local mode** now proxies to an Ollama-compatible runtime when available, then gracefully falls back to simulation when it is not reachable.
- **Live Web Search** can now enrich report grounding through **SearXNG**, an open-source metasearch engine, when `SEARXNG_BASE_URL` is configured.
