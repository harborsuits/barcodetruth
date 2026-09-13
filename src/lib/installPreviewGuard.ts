import { createReadOnlyFetch } from './previewGuard';

// This explicit flag also protects a locally served production build.
if (import.meta.env.VITE_READ_ONLY_PREVIEW === 'true') {
  globalThis.fetch = createReadOnlyFetch(import.meta.env.VITE_SUPABASE_URL, globalThis.fetch.bind(globalThis));
}
