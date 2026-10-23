// Cloudflare Worker журнала баллов. Настройка и запуск: worker/README.md.
import { githubStore, handleJournal } from '../tools/journal-api.mjs';

export default {
  fetch(request, env) {
    const store = githubStore({ token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO, branch: env.GITHUB_BRANCH || 'main' });
    const origins = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    return handleJournal(request, { store, origins });
  },
};
