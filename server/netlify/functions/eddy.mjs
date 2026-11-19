// Eddy on Netlify: serves the endpoint in ../../ask.mjs at /api/ask.
// Settings (Netlify project > Environment variables, scope Functions):
//   ANTHROPIC_API_KEY      required, mark it secret
//   ORFF_SITE_URL          where to read the data files; defaults to the GitHub Pages site
//   ORFF_ALLOWED_ORIGINS   sites allowed to call Eddy; defaults to oregonfishforecast.com and the GitHub Pages origin
//   EDDY_ACCESS_CODE       optional: a new access code, replacing the default below (mark it secret)
// Eddy is private. Every request must carry the access code, which a browser gets once from the unlock link
// (?eddy=<code>, see v2/assets/ask.js). Only the code's SHA-256 is kept here, so the repository never holds the code.
import {askHandlerFromEnv} from '../../ask.mjs';

const DEFAULT_ACCESS_HASH = '4dc8eb75a7d3d3bf8e49de60f33c4486ebfc97592944cb5341c0cf370900907f';
const env = name => globalThis.Netlify?.env.get(name) ?? process.env[name];
let handler = null;

export default async request => {
  handler ||= askHandlerFromEnv({
    ANTHROPIC_API_KEY: env('ANTHROPIC_API_KEY'),
    ORFF_SITE_URL: env('ORFF_SITE_URL') || 'https://kenny-yukich.github.io/oregon-fish-forecast-concept/',
    ORFF_ALLOWED_ORIGINS: env('ORFF_ALLOWED_ORIGINS') || 'https://oregonfishforecast.com,https://www.oregonfishforecast.com,https://kenny-yukich.github.io',
    EDDY_ACCESS_CODE: env('EDDY_ACCESS_CODE'),
    EDDY_ACCESS_HASH: env('EDDY_ACCESS_HASH') || DEFAULT_ACCESS_HASH
  });
  return handler(request);
};

export const config = {path: '/api/ask', method: ['GET', 'POST', 'OPTIONS']};
