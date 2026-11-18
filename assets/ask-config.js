/* Where the Ask the guide chat sends questions (server/ask.mjs). Empty keeps the chat hidden, which is right for
   the static GitHub Pages site until the endpoint is deployed; set it to the deployed URL, for example
   'https://<your-site>.netlify.app/api/ask'. The local server (server/dev.mjs) serves its own copy pointing at /api/ask. */
window.ORFF_ASK = {endpoint: ''};
