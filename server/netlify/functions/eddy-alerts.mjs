// The morning alert run: one email per follower with what is new on the waters they follow (../../alerts.mjs).
// Runs at 16:05 UTC, which is 8:05 am Pacific in winter and 9:05 am in summer, after the daily data job
// (GitHub Actions, 13:41 UTC) has committed the new data and the site has published it.
// Scheduled functions run only on the published deploy; "Run now" in the Netlify dashboard runs it by hand.
// A follower already handled today is skipped, so running it twice sends nothing twice.
import {netlifyEddy} from '../eddy-env.mjs';

export default async () => {
  const result = await netlifyEddy().runAlerts();
  return new Response(JSON.stringify(result), {headers: {'content-type': 'application/json'}});
};

export const config = {schedule: '5 16 * * *'};
