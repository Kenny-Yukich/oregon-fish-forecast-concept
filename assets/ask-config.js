/* Where Eddy, the AI fishing assistant, sends questions (server/ask.mjs on the oregon-fish-forecast-eddy Netlify
   project). The chat checks this address first and stays hidden until it answers that Eddy is ready, so the page
   never shows a chat that cannot reply. Empty turns Eddy off. The local server (server/dev.mjs) serves its own
   copy pointing at /api/ask. */
window.ORFF_ASK = {endpoint: 'https://oregon-fish-forecast-eddy.netlify.app/api/ask'};
