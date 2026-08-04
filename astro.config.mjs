import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

export default defineConfig({
  integrations: [preact()],
  // GitHub Pages serves project sites from a /<repo>/ prefix, which is only
  // known at deploy time — the Pages workflow passes it in. Locally both are
  // unset and the site builds at the root.
  site: process.env.ASTRO_SITE || undefined,
  base: process.env.ASTRO_BASE || undefined,
  // Fully static: the geometry engine runs in the browser, there is no backend.
  output: 'static',
  vite: {
    worker: { format: 'es' },
  },
});
