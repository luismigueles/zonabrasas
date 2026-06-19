/**
 * Generador de Contenido Editorial con IA
 *
 * Regla de Oro #1: Esquema de Redacción para la IA
 *   - El Gancho: párrafo que entiende al usuario
 *   - La Ficha de Datos Cruzados: specs técnicas en limpio
 *   - Pros/Contras "Traducidos": datos → beneficios reales
 *   - El Veredicto / Para quién es
 *
 * Regla de Oro #2: Tablas Comparativas Automáticas + Etiquetas
 *   - Top 3 productos por categoría
 *   - Etiquetas dinámicas: "Mejor Calidad-Precio", "El Más Profesional", "TOP Ventas"
 *
 * Con caché: los resultados se guardan en data/content-cache/
 * y solo se regeneran si cambian los datos del producto.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../../config/site.json');
const ai = require('./ai');

const AI_CFG = config.ai || {};
const CACHE_DIR = path.join(__dirname, '../../', AI_CFG.cacheDir || 'data/content-cache');
const FALLBACK = AI_CFG.fallbackToTemplate !== false;
const LANG = AI_CFG.language || 'es';

// ─── Sistema de prompts ───────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un copywriter experto en productos de hogar, cocina y barbacoa para un sitio web de afiliación español. 
Escribes en español nativo, con tono cercano pero autoritario, como un carnicero experto que recomienda a un amigo.

NORMAS OBLIGATORIAS:
- NO repitas la descripción de la tienda.
- Transforma datos técnicos en BENEFICIOS reales para el usuario.
- Los pros deben explicar POR QUÉ es bueno (no solo "es bueno").
- Los contras deben ser puntos débiles reales y cómo mitigarlos.
- El veredicto debe comparar con alternativas y decir PARA QUIÉN ES.
- Usa párrafos cortos, lenguaje natural, sin markdown ni listas con asteriscos.
- Todo en español.`;

function productPrompt(product) {
  return `Genera contenido editorial para la ficha de este producto:

NOMBRE: ${product.name}
MARCA: ${product.brand}
PRECIO: ${product.price}€${product.originalPrice ? ` (antes ${product.originalPrice}€)` : ''}
VALORACIÓN: ${product.rating}/5 (${product.reviewCount} reseñas)

DESCRIPCIÓN: ${product.description}

CARACTERÍSTICAS TÉCNICAS:
${(product.features || []).map(f => `- ${f}`).join('\n')}

ESPECS:
${Object.entries(product.specs || {}).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

PROS ACTUALES:
${(product.pros || []).map(p => `- ${p}`).join('\n')}

CONTRAS ACTUALES:
${(product.cons || []).map(c => `- ${c}`).join('\n')}

FILTROS: ${product.combustible ? `Combustible: ${product.combustible}` : ''} ${product.material ? `| Material: ${product.material}` : ''} ${product.uso ? `| Uso: ${product.uso}` : ''}

Debes responder EXACTAMENTE en este formato JSON (sin markdown, sin notas):

{
  "gancho": "Párrafo corto de gancho que conecte con el dolor/necesidad del usuario (máx 3 frases). Ej: 'Mantener los 110°C estables en un ahumado largo sin abrir la tapa es un dolor de cabeza...'",
  "ficha_datos": "Lista limpia en texto plano con los datos técnicos clave que importan (precio, material, potencia, peso, etc). Sin rodeos.",
  "pros_traducidos": [
    "Beneficio real transformado del dato. Ej: 'Ideal para piezas grandes como Brisket o Pulled Pork sin perder el centro térmico'"
  ],
  "contras_traducidos": [
    "Punto débil real con contexto. Ej: 'La app requiere tener el móvil cerca si no usas el modo Wi-Fi'"
  ],
  "veredicto": "Párrafo diciendo para quién es perfecto y para quién no, comparando con alternativas. Ej: 'Este accesorio es perfecto para ti si haces ahumados de más de 6 horas, pero si solo haces parrilladas rápidas de fin de semana, te basta con el modelo X que es más barato.'"
}`;
}

function comparisonPrompt(comparison, products) {
  const productsBlock = products.map((p, i) => `
PRODUCTO ${i + 1}: ${p.name}
PRECIO: ${p.price}€
VALORACIÓN: ${p.rating}/5
CARACTERÍSTICAS: ${(p.features || []).join(', ')}
PROS: ${(p.pros || []).join(', ')}
CONTRAS: ${(p.cons || []).join(', ')}
`).join('\n---\n');

  return `Genera contenido editorial para esta comparativa:

TÍTULO: ${comparison.title}
DESCRIPCIÓN: ${comparison.description}

PRODUCTOS A COMPARAR:
${productsBlock}

Debes responder EXACTAMENTE en este formato JSON (sin markdown, sin notas):

{
  "gancho": "Párrafo de gancho que haga al usuario sentir que esta comparativa le va a ahorrar dinero y tiempo (máx 3 frases).",
  "veredicto": "Párrafo final diciendo cuál elegir según cada perfil de usuario y presupuesto. Ej: 'Si tu prioridad es el sabor ahumado auténtico y no te importa esperar, ve a por el carbón. Si cocinas entre semana y rápido, el eléctrico te va a cambiar la vida.'"
}`;
}

// ─── Caché ─────────────────────────────────────────────────────────

function cacheKey(data) {
  return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
}

function readCache(cacheFile) {
  try {
    if (fs.existsSync(cacheFile)) {
      return JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    }
  } catch {}
  return null;
}

function writeCache(cacheFile, data) {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2), 'utf-8');
}

function getCachePath(type, id, key) {
  return path.join(CACHE_DIR, `${type}-${id}-${key}.json`);
}

// ─── Parseo seguro de JSON desde respuesta AI ─────────────────────

function parseJSON(text) {
  // Busca el primer { y el último }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ─── Fallbacks template-based (sin AI) ─────────────────────────────

function templateProductContent(product) {
  return {
    gancho: `¿Cansado de comprar productos que prometen y no rinden? Con ${product.name} de ${product.brand} sabes exactamente lo que pagas: ${product.features?.[0]?.toLowerCase() || 'calidad y rendimiento'}.`,
    ficha_datos: (product.features || []).map(f => `• ${f}`).join('\n'),
    pros_traducidos: (product.pros || []).map(p => p),
    contras_traducidos: (product.cons || []).map(c => c),
    veredicto: `${product.name} es ideal para quienes buscan ${product.uso === 'profesional' ? 'máximo rendimiento' : product.uso === 'portatil' ? 'algo versátil y fácil de transportar' : 'buena calidad a un precio justo'}.${product.rating >= 4.5 ? ' Con una valoración de ' + product.rating + '/5, es uno de los mejor valorados del mercado.' : ''}`
  };
}

function templateComparisonContent(comparison, products) {
  const cheaper = [...products].sort((a, b) => a.price - b.price)[0];
  return {
    gancho: `Comparativa definitiva: analizamos los mejores productos para que no te lleves sorpresas. Hemos cruzado datos técnicos, valoraciones y precios para ayudarte a decidir.`,
    veredicto: `Si buscas la mejor relación calidad-precio, ${cheaper?.name || 'elige según tu presupuesto'} es una apuesta segura. Para uso profesional intensivo, cualquiera de las opciones de gama alta cumple sin problemas.`
  };
}

// ─── Generación de contenido para producto ─────────────────────────

async function generateProductContent(product) {
  // Si el producto ya trae contenido pre-escrito (Gancho, Veredicto), usarlo directamente
  if (product.gancho && product.veredicto) {
    return {
      gancho: product.gancho,
      ficha_datos: (product.features || []).map(f => `• ${f}`).join('\n'),
      pros_traducidos: product.pros || [],
      contras_traducidos: product.cons || [],
      veredicto: product.veredicto
    };
  }

  const key = cacheKey({ name: product.name, price: product.price, features: product.features, specs: product.specs });
  const cacheFile = getCachePath('product', product.id, key);

  if (AI_CFG.cacheEnabled) {
    const cached = readCache(cacheFile);
    if (cached) return cached;
  }

  let content;
  const apiKey = process.env[AI_CFG.apiKeyEnvVar];

  if (apiKey) {
    try {
      console.log(`   🤖 AI: generando contenido para "${product.name}"...`);
      const raw = await ai.generate(productPrompt(product), SYSTEM_PROMPT);
      const parsed = parseJSON(raw);
      if (parsed && parsed.gancho && parsed.veredicto) {
        content = parsed;
      } else {
        throw new Error('Respuesta AI mal formateada');
      }
      console.log(`   ✅ AI: contenido generado para "${product.name}"`);
    } catch (err) {
      console.warn(`   ⚠️  AI error: ${err.message}`);
      if (FALLBACK) {
        content = templateProductContent(product);
        console.log(`   📝 Usando fallback template para "${product.name}"`);
      } else {
        throw err;
      }
    }
  } else {
    content = templateProductContent(product);
  }

  if (AI_CFG.cacheEnabled && content) {
    writeCache(cacheFile, content);
  }

  return content;
}

// ─── Generación de contenido para comparativa ──────────────────────

async function generateComparisonContent(comparison, products) {
  const key = cacheKey({ comparison: comparison.title, productIds: products.map(p => p.id) });
  const cacheFile = getCachePath('comparison', comparison.id, key);

  if (AI_CFG.cacheEnabled) {
    const cached = readCache(cacheFile);
    if (cached) return cached;
  }

  let content;
  const apiKey = process.env[AI_CFG.apiKeyEnvVar];

  if (apiKey) {
    try {
      console.log(`   🤖 AI: generando contenido para comparativa "${comparison.title}"...`);
      const raw = await ai.generate(comparisonPrompt(comparison, products), SYSTEM_PROMPT);
      const parsed = parseJSON(raw);
      if (parsed && parsed.gancho && parsed.veredicto) {
        content = parsed;
      } else {
        throw new Error('Respuesta AI mal formateada');
      }
      console.log(`   ✅ AI: contenido generado para "${comparison.title}"`);
    } catch (err) {
      console.warn(`   ⚠️  AI error: ${err.message}`);
      if (FALLBACK) {
        content = templateComparisonContent(comparison, products);
        console.log(`   📝 Usando fallback template para "${comparison.title}"`);
      } else {
        throw err;
      }
    }
  } else {
    content = templateComparisonContent(comparison, products);
  }

  if (AI_CFG.cacheEnabled && content) {
    writeCache(cacheFile, content);
  }

  return content;
}

// ─── Etiquetas dinámicas para tablas (Regla de Oro #2) ────────────

function assignDynamicTags(products) {
  if (!products || products.length === 0) return [];

  const sorted = [...products].map((p, i) => ({ ...p, _idx: i }));

  // El más barato → "Mejor Calidad-Precio"
  const cheapest = [...sorted].sort((a, b) => a.price - b.price)[0];

  // El más valorado → "El Más Popular"
  const topRated = [...sorted].sort((a, b) => b.rating - a.rating)[0];

  // El de mayor precio (más features o mejor specs) → "El Más Profesional"
  const mostExpensive = [...sorted].sort((a, b) => b.price - a.price)[0];

  // Asignar etiquetas
  sorted.forEach(p => {
    p.dynamicTags = [];

    // Si el producto trae su propio tag destacado del feed, usarlo
    if (p.featuredTag) {
      p.dynamicTags.push({ label: p.featuredTag, class: 'tag-user' });
    }

    if (p._idx === cheapest._idx) {
      p.dynamicTags.push({ label: 'Mejor Calidad-Precio', class: 'tag-value' });
    }
    if (p._idx === topRated._idx && products.length > 1 && topRated._idx !== cheapest._idx) {
      p.dynamicTags.push({ label: 'El Más Popular', class: 'tag-top' });
    }
    if (p._idx === mostExpensive._idx && products.length > 2 && mostExpensive._idx !== cheapest._idx) {
      p.dynamicTags.push({ label: 'El Más Profesional', class: 'tag-pro' });
    }
    // Si solo hay 1 o 2 productos y coinciden, no duplicar
    if (p.dynamicTags.length > 1) {
      const unique = [];
      const seen = new Set();
      p.dynamicTags.forEach(t => {
        if (!seen.has(t.label)) { seen.add(t.label); unique.push(t); }
      });
      p.dynamicTags = unique;
    }
    delete p._idx;
  });

  return sorted;
}

module.exports = {
  generateProductContent,
  generateComparisonContent,
  assignDynamicTags
};
