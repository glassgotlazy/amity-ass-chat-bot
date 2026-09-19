/*
 * Vercel serverless function:  POST /api/ask
 *
 * server.js (the long-running server used locally and in Codespaces) and
 * this file are two doors into the same room — both call lib/assistant.js,
 * so the scope gate, prompt and provider behave identically on Vercel.
 *
 * The API key comes from the Vercel project's Environment Variables, never
 * from a committed file.
 */
const { answer } = require('../lib/assistant.js');

function readRaw(req){
  return new Promise(resolve => {
    let data = '', size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if(size > 8192){ req.destroy(); resolve(''); return; }
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', () => resolve(''));
  });
}

module.exports = async function handler(req, res){
  res.setHeader('Cache-Control', 'no-store');

  if(req.method !== 'POST'){
    res.status(405).json({ error:'method_not_allowed' });
    return;
  }

  /* Vercel parses JSON bodies for us, but not every content-type, so fall
     back to reading the stream. */
  let body = req.body;
  if(typeof body === 'string' || body === undefined || body === null){
    const raw = typeof body === 'string' ? body : await readRaw(req);
    try{ body = JSON.parse(raw || '{}'); }catch(e){ body = {}; }
  }
  if(typeof body !== 'object' || !body) body = {};

  const forwarded = String(req.headers['x-forwarded-for'] || '');
  const ip = forwarded.split(',')[0].trim() ||
             (req.socket && req.socket.remoteAddress) || 'unknown';

  const result = await answer({ question: body.question, topic: body.topic, ip });
  res.status(result.status).json(result.body);
};
