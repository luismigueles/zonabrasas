/**
 * Provider Local - Lee productos desde archivos JSON en data/feeds/
 *
 * Formato esperado del JSON:
 * {
 *   "categoria": "parrillas",              // slug de la categoría en data/categories.json
 *   "filtros": {                           // OPCIONAL: filtros globales para todos los productos
 *     "combustible": null,
 *     "material": null,
 *     "uso": null
 *   },
 *   "productos": [
 *     {
 *       "ID_Producto": "parrilla-electrica-2000w",
 *       "Nombre": "Parrilla Eléctrica 2000W Sin Humo",
 *       "Precio": 129.99,
 *       "URL_Afiliado": "https://www.amazon.es/dp/B07PN9T1KJ?tag=luismi-21",
 *       "Imagen_URL": "/assets/img/products/parrilla-electrica.jpg",
 *       "Especificaciones_Tecnicas": [
 *         { "clave": "Potencia", "valor": "2000W" },
 *         { "clave": "Material", "valor": "Acero inoxidable" }
 *       ],
 *       // OPCIONAL: filtros individuales (sobrescriben los globales)
 *       "combustible": "electrico",
 *       "material": "acero-inoxidable",
 *       "uso": "domestico"
 *     }
 *   ]
 * }
 *
 * Uso:
 *   node scripts/ingest/index.js --provider local --category parrillas
 *   node scripts/ingest/index.js --provider local --file data/feeds/mis-productos.json
 */

const path = require('path');
const fs = require('fs');
const { normalizeFeedProduct } = require('../transform');

const FEEDS_DIR = path.join(__dirname, '../../../data/feeds');

/**
 * Lee productos desde data/feeds/
 * @param {object} category - Categoría destino (de data/categories.json)
 * @param {object} config - Config global (site.json)
 * @param {object} options - Opciones adicionales { file?: string }
 */
async function fetch(category, config, options = {}) {
  const filePath = options.file
    ? path.resolve(options.file)
    : path.join(FEEDS_DIR, `${category.id}.json`);

  if (!fs.existsSync(filePath)) {
    console.warn(`   ⚠️  No se encontró el archivo: ${filePath}`);
    console.log('   Crea un JSON en data/feeds/ siguiendo el formato:');
    console.log('   { "categoria": "' + category.id + '", "productos": [...] }');
    return [];
  }

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  if (!raw.productos || !Array.isArray(raw.productos)) {
    console.error(`   ❌ El archivo ${filePath} debe tener un array "productos"`);
    return [];
  }

  const globalFilters = raw.filtros || {};

  const products = raw.productos.map(item =>
    normalizeFeedProduct(item, category.id, globalFilters)
  );

  console.log(`   ✅ ${products.length} productos leídos de ${path.basename(filePath)}`);
  return products;
}

module.exports = { fetch };
