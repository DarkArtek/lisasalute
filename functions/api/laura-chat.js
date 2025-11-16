// File: functions/api/laura-chat.js
// Questo è un Cloudflare Worker, usa la sintassi 'fetch'

// L'URL di Gemini (la chiave API sarà presa dai Segreti)
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=';

/**
 * Gestisce le richieste CORS (pre-flight)
 */
function handleOptions(request) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*', // Sostituisci con il tuo dominio in produzione
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

/**
 * Gestisce la richiesta POST dal tuo client Vue
 */
async function handlePost(request, env) {
  // 1. Recupera la chiave segreta (vedi Passo 2)
  const GEMINI_API_KEY = env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: 'Chiave API non configurata' }), { status: 500 });
  }

  // 2. Recupera il payload inviato da Vue (contents, systemInstruction)
  const payload = await request.json();

  // 3. Chiama Gemini (Server-to-Server)
  const geminiResponse = await fetch(GEMINI_API_URL + GEMINI_API_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  // 4. Gestisce la risposta di Gemini
  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text();
    return new Response(JSON.stringify({ error: `Errore API Gemini: ${errorText}` }), { status: geminiResponse.status });
  }

  // 5. Restituisce la risposta di Gemini al client Vue
  const data = await geminiResponse.json();

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', // Permetti la risposta
    },
  });
}

/**
 * Punto di ingresso della Cloudflare Function
 */
export async function onRequest(context) {
  // 'context.env' contiene i segreti
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return handleOptions(request);
  }

  if (request.method === 'POST') {
    return handlePost(request, env);
  }

  return new Response('Metodo non consentito', { status: 405 });
}
