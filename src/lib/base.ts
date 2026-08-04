/**
 * Join an internal path onto the site's base path.
 *
 * On GitHub Pages a project site lives under /<repo>/, so root-absolute hrefs
 * would 404. Astro normalises `base` inconsistently across trailing slashes,
 * hence the trimming rather than plain concatenation.
 */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}
