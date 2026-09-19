/* Vercel serverless function:  GET /api/health
   The page calls this on load to decide whether to offer the AI fallback. */
const { health } = require('../lib/assistant.js');

module.exports = function handler(req, res){
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(health());
};
