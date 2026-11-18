// Eddy on Netlify: serves the endpoint in ../../ask.mjs at /api/ask.
// Settings (Netlify project > Environment variables, scope Functions):
//   ANTHROPIC_API_KEY      required, mark it secret
//   ORFF_SITE_URL          where to read the data files; defaults to the GitHub Pages site
//   ORFF_ALLOWED_ORIGINS   sites allowed to call Eddy; defaults to the GitHub Pages origin
import {askHandlerFromEnv} from '../../ask.mjs';

const env = name => globalThis.Netlify?.env.get(name) ?? process.env[name];
let handler = null;

export default async request => {
  handler ||= askHandlerFromEnv({
    ANTHROPIC_API_KEY: env('ANTHROPIC_API_KEY'),
    ORFF_SITE_URL: env('ORFF_SITE_URL') || 'https://kenny-yukich.github.io/oregon-fish-forecast-concept/',
    ORFF_ALLOWED_ORIGINS: env('ORFF_ALLOWED_ORIGINS') || 'https://kenny-yukich.github.io'
  });
  return handler(request);
};

export const config = {path: '/api/ask', method: ['POST', 'OPTIONS']};
