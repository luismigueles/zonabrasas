/**
 * Cliente AI multi-provider (OpenAI / Anthropic)
 *
 * Lee la config desde config/site.json y la API key desde variable de entorno.
 * Soporta:
 *   - OpenAI (GPT-4o-mini, GPT-4o, etc.)
 *   - Anthropic (Claude 3/3.5)
 *   - Endpoint personalizado (compatible OpenAI)
 *
 * Uso:
 *   const ai = require('./ai');
 *   const texto = await ai.generate('User prompt', 'system prompt');
 */

const https = require('https');
const config = require('../../config/site.json');

const AI_CFG = config.ai || {};

const PROVIDER = AI_CFG.provider || 'openai';
const MODEL = AI_CFG.model || 'gpt-4o-mini';
const API_KEY_ENV = AI_CFG.apiKeyEnvVar || 'OPENAI_API_KEY';
const TEMPERATURE = AI_CFG.temperature ?? 0.7;
const MAX_TOKENS = AI_CFG.maxTokens || 600;

const PROVIDERS = {
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    headers: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }),
    body: (system, user) => ({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS
    }),
    parse: (json) => json.choices?.[0]?.message?.content || ''
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    headers: (key) => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    }),
    body: (system, user) => ({
      model: MODEL,
      system,
      messages: [{ role: 'user', content: user }],
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS
    }),
    parse: (json) => json.content?.[0]?.text || ''
  }
};

async function generate(userPrompt, systemPrompt) {
  const apiKey = process.env[API_KEY_ENV];
  if (!apiKey) {
    throw new Error(`API key no encontrada. Define la variable de entorno ${API_KEY_ENV}`);
  }

  const provider = PROVIDERS[PROVIDER];
  if (!provider) {
    throw new Error(`Provider no soportado: ${PROVIDER}. Usa: ${Object.keys(PROVIDERS).join(', ')}`);
  }

  const body = provider.body(systemPrompt || 'Eres un experto en análisis de productos.', userPrompt);
  const bodyStr = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const urlObj = new URL(provider.url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        ...provider.headers(apiKey),
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          try {
            const err = JSON.parse(data);
            reject(new Error(`AI API error ${res.statusCode}: ${err.error?.message || err.message || data}`));
          } catch {
            reject(new Error(`AI API error ${res.statusCode}: ${data}`));
          }
          return;
        }
        try {
          const json = JSON.parse(data);
          resolve(provider.parse(json));
        } catch {
          reject(new Error('Error al parsear respuesta AI'));
        }
      });
    });

    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

module.exports = { generate };
