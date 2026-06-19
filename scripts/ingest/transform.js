/**
 * Transformador de datos para normalizar productos
 * de diferentes fuentes (Amazon, feeds JSON locales, CSV)
 * al formato unificado del sistema.
 */

function normalizeProduct(raw, source, categoryId) {
  const base = {
    id: '',
    name: '',
    brand: '',
    slug: '',
    category: categoryId,
    price: 0,
    originalPrice: null,
    currency: 'EUR',
    rating: 0,
    reviewCount: 0,
    image: '/assets/img/default-product.jpg',
    gallery: [],
    description: '',
    features: [],
    specs: {},
    combustible: null,
    material: null,
    uso: null,
    tipo: null,
    'rango-precio': null,
    pros: [],
    cons: [],
    gancho: null,
    veredicto: null,
    affiliateUrl: '',
    asin: '',
    stock: true,
    featured: false,
    featuredTag: null,
    tags: [categoryId]
  };

  switch (source) {
    case 'amazon':
      return normalizeAmazon(raw, base);
    case 'csv':
      return normalizeCSV(raw, base);
    case 'local':
      return normalizeFeedProduct(raw, categoryId);
    default:
      return { ...base, ...raw };
  }
}

function normalizeAmazon(item, base) {
  return {
    ...base,
    id: item.ASIN ? item.ASIN.toLowerCase() : base.id,
    name: item.Title || item.ItemInfo?.Title?.DisplayValue || base.name,
    brand: item.Brand || item.ItemInfo?.Classifications?.Brand?.DisplayValue || base.brand,
    slug: createSlug(item.Title || 'producto'),
    price: parseFloat(item.Price?.Amount || item.Offers?.Listings?.[0]?.Price?.Amount || '0'),
    currency: item.Price?.Currency || item.Offers?.Listings?.[0]?.Price?.Currency || 'EUR',
    image: item.Image?.Large?.URL || item.Images?.Primary?.Large?.URL || base.image,
    description: (item.Features || item.ItemInfo?.Features?.DisplayValues || []).join('. '),
    features: item.Features || item.ItemInfo?.Features?.DisplayValues || [],
    affiliateUrl: `https://www.amazon.es/dp/${item.ASIN}?tag=${process.env.AWS_ASSOCIATE_TAG || 'luismi-21'}`,
    asin: item.ASIN,
    combustible: item.Combustible || item.combustible || null,
    material: item.Material || item.material || null,
    uso: item.Uso || item.uso || null
  };
}

function normalizeCSV(row, base) {
  return {
    ...base,
    id: createSlug(row.name || row.nombre),
    name: row.name || row.nombre || base.name,
    brand: row.brand || row.marca || base.brand,
    slug: createSlug(row.name || row.nombre || 'producto'),
    price: parseFloat(row.price || row.precio || '0'),
    originalPrice: row.original_price ? parseFloat(row.original_price) : null,
    currency: row.currency || row.moneda || 'EUR',
    rating: parseFloat(row.rating || row.valoracion || '0'),
    reviewCount: parseInt(row.reviews || row.valoraciones || '0'),
    image: row.image_url || row.imagen || base.image,
    description: row.description || row.descripcion || base.description,
    affiliateUrl: row.affiliate_url || row.url_afiliado || base.affiliateUrl,
    asin: row.asin || '',
    combustible: row.combustible || null,
    material: row.material || null,
    uso: row.uso || null
  };
}

/**
 * Normaliza un producto desde el formato Feeds JSON local.
 *
 * Formato de entrada (que tú escribes):
 * {
 *   "ID_Producto": "parrilla-electrica-2000w",
 *   "Nombre": "Parrilla Eléctrica 2000W Sin Humo",
 *   "Precio": 129.99,
 *   "URL_Afiliado": "https://www.amazon.es/dp/B07PN9T1KJ?tag=luismi-21",
 *   "Imagen_URL": "/assets/img/products/parrilla-electrica.jpg",
 *   "Especificaciones_Tecnicas": [
 *     { "clave": "Potencia", "valor": "2000W" }
 *   ],
 *   // opcional
 *   "combustible": "electrico",
 *   "material": "acero-inoxidable",
 *   "uso": "domestico",
 *   "Marca": "Prince Castle",
 *   "Valoracion": 4.6,
 *   "Resenas": 289,
 *   "Precio_Original": 159.99,
 *   "Descripcion": "...",
 *   "Destacado": true
 * }
 */
function normalizeFeedProduct(item, categoryId, globalFilters = {}) {
  const specs = {};
  const features = [];

  // Soporta dos formatos de especificaciones:
  //   A) Especificaciones_Tecnicas: [{ clave, valor }, ...]  (formato del sistema)
  //   B) especificaciones: { clave: valor, ... }              (formato natural del usuario)
  if (item.Especificaciones_Tecnicas && Array.isArray(item.Especificaciones_Tecnicas)) {
    item.Especificaciones_Tecnicas.forEach(s => {
      const key = createSlug(s.clave).replace(/-/g, '_');
      specs[key] = s.valor;
      features.push(`${s.clave}: ${s.valor}`);
    });
  } else if (item.especificaciones && typeof item.especificaciones === 'object') {
    Object.entries(item.especificaciones).forEach(([clave, valor]) => {
      const key = createSlug(clave).replace(/-/g, '_');
      specs[key] = valor;
      features.push(`${clave}: ${valor}`);
    });
  } else if (item.caracteristicas && typeof item.caracteristicas === 'object') {
    Object.entries(item.caracteristicas).forEach(([clave, valor]) => {
      const key = createSlug(clave).replace(/-/g, '_');
      specs[key] = valor;
      features.push(`${clave}: ${valor}`);
    });
  }

  const autoDescription = features.slice(0, 3).join('. ') || 'Sin descripción';

  // Extraer contenido de analisis_ia si existe (formato natural del usuario)
  const aiBlock = item.analisis_ia || {};

  // Mapear tags a filtros del sistema
  function mapTagToFilter(tags) {
    if (!Array.isArray(tags)) return {};
    const result = {};
    tags.forEach(t => {
      if (t === 'Menos de 25€') result['rango-precio'] = 'menos-25';
      else if (t === 'Menos de 25') result['rango-precio'] = 'menos-25';
      else if (t === 'Entre 25€ y 100€') result['rango-precio'] = 'entre-25-100';
      else if (t === 'Entre 25 y 100') result['rango-precio'] = 'entre-25-100';
      else if (t === 'Más de 100€') result['rango-precio'] = 'mas-100';
      else if (t === 'Más de 100') result['rango-precio'] = 'mas-100';
      else if (t === 'Más de 25€') result['rango-precio'] = 'entre-25-100';
      else if (t === 'Más de 25') result['rango-precio'] = 'entre-25-100';
      else if (t === 'Deshuesar') result.tipo = 'deshuesador';
      else result.tipo = createSlug(t); // Chef → chef, Jamonero → jamonero, etc.
    });
    return result;
  }
  const tagFilters = mapTagToFilter(item.tags);

  // Extraer marca de caracteristicas si no está en nivel superior
  const brandFromCtx = item.caracteristicas?.marca || item.caracteristicas?.Marca || '';

  const id = item.ID_Producto || item.id || createSlug(item.titulo) || createSlug(item.nombre) || createSlug(item.Nombre);
  const name = item.titulo || item.nombre || item.Nombre || 'Producto sin nombre';

  return {
    id,
    name,
    brand: item.Marca || item.marca || brandFromCtx || '',
    slug: createSlug(name),
    category: categoryId,
    price: parseFloat(item.Precio ?? item.precio_actual ?? item.precio ?? 0),
    originalPrice: item.Precio_Original ?? item.precio_original ?? null,
    currency: item.Moneda ?? 'EUR',
    rating: parseFloat(item.Valoracion ?? item.valoracion ?? item.puntuacion ?? 0),
    reviewCount: parseInt(item.Resenas ?? item.resenas ?? item.reviews ?? 0),
    image: item.Imagen_URL ?? item.imagen_url ?? item.imagen ?? '/assets/img/default-product.jpg',
    gallery: [],
    description: item.Descripcion || item.descripcion || autoDescription,
    features,
    specs,
    combustible: item.combustible || globalFilters.combustible || null,
    material: item.material || globalFilters.material || null,
    uso: item.uso || globalFilters.uso || null,
    tipo: item.tipo || tagFilters.tipo || null,
    'rango-precio': item['rango-precio'] || tagFilters['rango-precio'] || null,
    pros: item.Pros || item.pros || aiBlock.pros || [],
    cons: item.Contras || item.cons || aiBlock.contras || [],
    gancho: item.Gancho || item.gancho || aiBlock.gancho || null,
    veredicto: item.Veredicto || item.veredicto || aiBlock.veredicto || null,
    affiliateUrl: item.URL_Afiliado || item.url_afiliado || item.enlace || '',
    asin: item.ASIN || item.asin || '',
    stock: item.Stock !== false,
    featured: !!item.destacado_tag || item.Destacado === true || item.featured === true,
    featuredTag: item.destacado_tag || null,
    tags: [categoryId]
  };
}

function createSlug(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

module.exports = { normalizeProduct, normalizeFeedProduct, createSlug };
