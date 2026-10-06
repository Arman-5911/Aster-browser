export function settingsPanel(url:string){return url==='aster://performance'?'performance':url==='aster://settings'?'settings':url==='aster://studio'?'studio':url==='aster://extensions'?'extensions':undefined;}
import type { Settings } from './schema';
export function isWebUrl(value: string): boolean {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
export function resolveInput(input: string, engine: Settings['searchEngine'] = 'duckduckgo'): string {
  const value = input.trim();
  if (!value || value.length > 8192) throw new Error('Enter a URL or search term.');
  if (value === 'aster://newtab'||settingsPanel(value)) return value;
  if (/^https?:\/\//i.test(value)) { if (!isWebUrl(value)) throw new Error('This address is not supported.'); return new URL(value).href; }
  const host = /^(localhost|\d{1,3}(?:\.\d{1,3}){3})(:\d+)?([/?#].*)?$/i.test(value);
  if (host) return new URL(`http://${value}`).href;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) throw new Error('Only HTTP and HTTPS addresses are supported.');
  if (!/\s/.test(value) && /^[^/]+\.[^/]+/.test(value) && isWebUrl(`https://${value}`)) return new URL(`https://${value}`).href;
  const base = { duckduckgo: 'https://duckduckgo.com/?q=', google: 'https://www.google.com/search?q=', bing: 'https://www.bing.com/search?q=' };
  return base[engine] + encodeURIComponent(value);
}
