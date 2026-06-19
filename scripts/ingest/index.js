/**
 * Módulo de Ingesta de Datos
 *
 * Orquesta la importación de productos al sistema.
 * Por defecto lee desde archivos JSON locales en data/feeds/.
 *
 * Uso:
 *   node scripts/ingest/index.js                                   # Lee data/feeds/ para todas las categorías
 *   node scripts/ingest/index.js --category parrillas              # Solo categoría parrillas
 *   node scripts/ingest/index.js --file data/feeds/mi-archivo.json # Archivo específico
 *   node scripts/ingest/index.js --provider amazon                 # Usar API de Amazon (requiere credenciales)
 *   node scripts/ingest/index.js --dry-run                         # Simular sin escribir
 */

const path = require('path');
const fs = require('fs');
const config = require('../../config/site.json');

const DATA_DIR = path.join(__dirname, '../../data/products');
const CATEGORIES_PATH = path.join(__dirname, '../../data/categories.json');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const providerFlag = parseArg(args, '--provider') || 'local';
const categoryFlag = parseArg(args, '--category');
const fileFlag = parseArg(args, '--file');

function parseArg(args, flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx < args.length - 1 ? args[idx + 1] : null;
}

async function loadProvider(name) {
  try {
    return require(`./providers/${name}`);
  } catch {
    console.error(`❌ Provider "${name}" no encontrado en scripts/ingest/providers/`);
    process.exit(1);
  }
}

async function ingest() {
  const categories = JSON.parse(fs.readFileSync(CATEGORIES_PATH, 'utf-8'));

  // Si se especificó --file, ignorar categorías y procesar ese archivo directo
  if (fileFlag) {
    if (!fs.existsSync(fileFlag)) {
      console.error(`❌ Archivo no encontrado: ${fileFlag}`);
      process.exit(1);
    }
    const raw = JSON.parse(fs.readFileSync(fileFlag, 'utf-8'));
    const catId = raw.categoria;
    const category = categories.find(c => c.id === catId);
    if (!category) {
      console.error(`❌ Categoría "${catId}" no encontrada en data/categories.json`);
      console.log('   Categorías disponibles:', categories.map(c => c.id).join(', '));
      process.exit(1);
    }
    const provider = await loadProvider(providerFlag);
    const products = await provider.fetch(category, config, { file: fileFlag });
    await saveProducts(category, products);
    console.log('\n✅ Ingesta completada.');
    return;
  }

  // Modo normal: procesar por categorías
  const targetCategories = categoryFlag
    ? categories.filter(c => c.id === categoryFlag)
    : categories;

  if (targetCategories.length === 0) {
    console.error(`❌ Categoría "${categoryFlag}" no encontrada.`);
    console.log('   Categorías disponibles:', categories.map(c => c.id).join(', '));
    process.exit(1);
  }

  const provider = await loadProvider(providerFlag);

  for (const cat of targetCategories) {
    console.log(`\n📥 Procesando categoría: ${cat.name} (${cat.id})`);

    let products = [];
    try {
      products = await provider.fetch(cat, config);
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
      continue;
    }

    if (products.length === 0) {
      console.log(`   ⚠️  Sin productos para "${cat.name}"`);
      continue;
    }

    await saveProducts(cat, products);
  }

  console.log('\n✅ Ingesta completada.');
}

async function saveProducts(category, products) {
  if (dryRun) {
    console.log(`   🏁 Dry-run: ${products.length} productos listos para importar`);
    console.log('   Muestra:', JSON.stringify(products.slice(0, 1), null, 2));
    return;
  }

  const filePath = path.join(DATA_DIR, `${category.id}.json`);
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  // Fusionar con productos existentes (deduplicar por id)
  const existing = fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    : [];
  const existingMap = new Map(existing.map(p => [p.id, p]));

  products.forEach(p => existingMap.set(p.id, p));
  const merged = [...existingMap.values()];

  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf-8');
  console.log(`   ✅ ${products.length} productos guardados en data/products/${category.id}.json`);
  console.log(`   📊 Total en categoría: ${merged.length} productos`);
}

ingest().catch(err => {
  console.error('❌ Error en ingesta:', err);
  process.exit(1);
});
