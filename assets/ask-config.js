/* Where Eddy, the AI fishing assistant, sends questions (server/ask.mjs on the oregon-fish-forecast-eddy Netlify
   project). The chat checks this address first and stays hidden until it answers that Eddy is ready, so the page
   never shows a chat that cannot reply. Empty turns Eddy off. The local server (server/dev.mjs) serves its own
   copy pointing at /api/ask.
   sell: true opens Eddy to the public: everyone sees the "Ask Eddy" button, gets a few free questions a day, then an
   offer of a pass ($4.99/month or $39.99/year through Stripe). The public sees it only once the endpoint reports a
   live Stripe key; while the Netlify project has a test key, only the owner, pass holders and test shoppers
   (?eddy_shop=1 once in a browser, ?eddy_shop=0 to stop) see Eddy.
   sell: false (with private: true) closes Eddy to the public: only browsers opened once with the owner's unlock link
   (?eddy=<access code>) or a pass link show it, and every other visitor's browser never contacts Eddy. */
window.ORFF_ASK = {endpoint: 'https://oregon-fish-forecast-eddy.netlify.app/api/ask', private: true, sell: true};
