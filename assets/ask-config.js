/* Where Eddy, the AI fishing assistant, sends questions (server/ask.mjs on the oregon-fish-forecast-eddy Netlify
   project). The chat checks this address first and stays hidden until it answers that Eddy is ready, so the page
   never shows a chat that cannot reply. Empty turns Eddy off. The local server (server/dev.mjs) serves its own
   copy pointing at /api/ask.
   private: only browsers opened once with the owner's unlock link (?eddy=<access code>) show Eddy; every other
   visitor sees no chat and their browser never contacts Eddy.
   sell: true puts Eddy passes on sale: everyone sees the "Ask Eddy" button, gets a few free questions a day, then an
   offer of a $4.99/month pass (Stripe checkout; needs STRIPE_SECRET_KEY on the Netlify project). While it is false,
   the owner can test the whole flow in one browser by opening the site once with ?eddy_shop=1 (and ?eddy_shop=0
   to stop). */
window.ORFF_ASK = {endpoint: 'https://oregon-fish-forecast-eddy.netlify.app/api/ask', private: true, sell: false};
