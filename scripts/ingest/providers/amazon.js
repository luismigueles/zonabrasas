/**
 * Amazon Product Advertising API 5.0 Adapter
 *
 * Conector para importar productos desde Amazon PAAPI5.
 * Requiere credenciales en config/site.json o variables de entorno.
 *
 * Uso:
 *   node scripts/ingest/index.js --provider amazon --category cuchillos-barbacoa
 *
 * Variables de entorno requeridas:
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   AWS_ASSOCIATE_TAG
 */

const https = require('https');

async function fetch(category, config) {
  const affiliate = config.affiliate;
  const amazonCfg = affiliate.networks.amazon;

  const accessKey = process.env.AWS_ACCESS_KEY_ID || amazonCfg.apiKey;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY || amazonCfg.apiSecret;
  const associateTag = process.env.AWS_ASSOCIATE_TAG || amazonCfg.associateTag;

  if (!accessKey || !secretKey || accessKey === 'AWS_ACCESS_KEY') {
    console.warn('   ⚠️  Amazon API no configurada. Establece AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY');
    console.warn('   Para desarrollo, se usarán datos de demostración.');
    return [];
  }

  const keywords = category.tags ? category.tags.slice(0, 3).join(' ') : category.name;

  const payload = JSON.stringify({
    Keywords: keywords,
    Resources: [
      'Images.Primary.Large',
      'ItemInfo.Title',
      'ItemInfo.Features',
      'ItemInfo.Classifications',
      'Offers.Listings.Price'
    ],
    ItemCount: 10,
    PartnerTag: associateTag,
    PartnerType: 'Associates',
    Marketplace: 'www.amazon.es',
    Operation: 'SearchItems'
  });

  console.log(`   🔍 Buscando en Amazon: "${keywords}"`);

  try {
    const data = await paapiRequest(payload, accessKey, secretKey);
    return transformResponse(data, category);
  } catch (err) {
    console.error(`   ❌ Error en API de Amazon: ${err.message}`);
    return [];
  }
}

function paapiRequest(payload, accessKey, secretKey) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'webservices.amazon.es',
      path: '/paapi5/searchitems',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error('Error al parsear respuesta de Amazon'));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function transformResponse(data, category) {
  if (!data.ItemsResult || !data.ItemsResult.Items) return [];

  return data.ItemsResult.Items.map(item => ({
    id: item.ASIN.toLowerCase(),
    name: item.ItemInfo?.Title?.DisplayValue || 'Sin título',
    brand: item.ItemInfo?.Classifications?.Brand?.DisplayValue || 'AmazonBasics',
    slug: (item.ItemInfo?.Title?.DisplayValue || 'producto')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, ''),
    category: category.id,
    price: parseFloat(item.Offers?.Listings?.[0]?.Price?.Amount || '0'),
    originalPrice: null,
    currency: item.Offers?.Listings?.[0]?.Price?.Currency || 'EUR',
    rating: 0, // Amazon API doesn't return rating in basic search
    reviewCount: 0,
    image: item.Images?.Primary?.Large?.URL || '/assets/img/default-product.jpg',
    gallery: [],
    description: (item.ItemInfo?.Features?.DisplayValues || []).join('. ') || 'Sin descripción',
    features: item.ItemInfo?.Features?.DisplayValues || [],
    specs: { asin: item.ASIN },
    pros: [],
    cons: [],
    affiliateUrl: `https://www.amazon.es/dp/${item.ASIN}?tag=luismi-21`,
    asin: item.ASIN,
    stock: true,
    featured: false,
    tags: [category.id]
  }));
}

module.exports = { fetch };
