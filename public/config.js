// Settings for the self-hosted dashboard.
// aiEndpoint: where the AI guide sends questions. Leave as "/api/ask" when you deploy with
// the included server (Vercel or server.js). Set to null for a static-only host
// (GitHub Pages, Netlify Drop): the guide then answers from the dashboard's own data.
window.ATLAS_CONFIG = {
  aiEndpoint: "/api/ask",
};
