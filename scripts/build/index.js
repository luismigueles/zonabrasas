const fs = require('fs');
const path = require('path');

const siteConfig = require('../../config/site.json');
const categories = require('../../data/categories.json');
const comparisons = require('../../data/comparisons.json');
const allFilters = require('../../data/filters.json');

const { generateHome } = require('./generator/home');
const { generateProductPage } = require('./generator/products');
const { generateListing } = require('./generator/listings');
const { generateCategory } = require('./generator/categories');
const { generateFilterPages } = require('./generator/filters');
const { generateSitemap } = require('./seo/sitemap');
const { generateRobots } = require('./seo/robots');

const DIST = path.join(__dirname, '../../dist');
const DATA = path.join(__dirname, '../../data/products');

function loadProducts(categoryId) {
  const filePath = path.join(DATA, `${categoryId}.json`);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getAllProducts() {
  let all = [];
  categories.forEach(cat => {
    const prods = loadProducts(cat.id);
    all = all.concat(prods.map(p => ({ ...p, categoryData: cat })));
  });
  return all;
}

function getAllProductsByCategory() {
  const map = {};
  categories.forEach(cat => {
    map[cat.id] = loadProducts(cat.id);
  });
  return map;
}

async function build() {
  console.log('🚀 Iniciando build...\n');

  ensureDir(DIST);
  ensureDir(path.join(DIST, 'assets', 'css'));
  ensureDir(path.join(DIST, 'assets', 'js'));
  ensureDir(path.join(DIST, 'assets', 'img'));

  const allProducts = getAllProducts();
  const productsByCategory = getAllProductsByCategory();

  // Generate homepage
  console.log('📄 Generando portada...');
  generateHome(DIST, {
    siteConfig,
    categories,
    comparisons,
    allFilters,
    featured: siteConfig.site.featuredIds.map(id => allProducts.find(p => p.id === id)).filter(Boolean)
  });

  // Generate category pages
  console.log('📁 Generando páginas de categoría...');
  categories.forEach(cat => {
    const products = productsByCategory[cat.id] || [];
    generateCategory(DIST, { siteConfig, categories, category: cat, products, comparisons, allFilters });
  });

  // Generate product pages (con AI content)
  console.log('📦 Generando páginas de producto...');
  for (const product of allProducts) {
    await generateProductPage(DIST, { siteConfig, categories, product, allProducts, allFilters });
  }

  // Generate listing/comparison pages (con AI content + etiquetas dinámicas)
  console.log('⚖️  Generando comparativas y listings...');
  for (const comp of comparisons) {
    const products = comp.items
      .map(id => allProducts.find(p => p.id === id))
      .filter(Boolean);
    await generateListing(DIST, { siteConfig, categories, comparison: comp, products, allComparisons: comparisons, allFilters });
  }

  // Generate filter pages
  console.log('🔎 Generando páginas de filtros...');
  generateFilterPages(DIST, { siteConfig, categories, allFilters, productsByCategory, allComparisons: comparisons });

  // Copy assets
  console.log('🎨 Copiando assets...');
  copyAssets();

  // Generate SEO files
  console.log('🔍 Generando archivos SEO...');
  generateSitemap(DIST, { siteConfig, categories, products: allProducts, comparisons, allFilters, productsByCategory });
  generateRobots(DIST, { siteConfig });

  console.log('\n✅ Build completado en dist/');
}

function copyAssets() {
  const srcCSS = path.join(__dirname, '../../src/styles');
  const srcJS = path.join(__dirname, '../../src/js');
  const srcImg = path.join(__dirname, '../../src/images');
  const dstCSS = path.join(DIST, 'assets', 'css');
  const dstJS = path.join(DIST, 'assets', 'js');
  const dstImg = path.join(DIST, 'assets', 'img');

  if (fs.existsSync(srcCSS)) {
    fs.readdirSync(srcCSS).forEach(f => {
      fs.copyFileSync(path.join(srcCSS, f), path.join(dstCSS, f));
    });
  }
  if (fs.existsSync(srcJS)) {
    fs.readdirSync(srcJS).forEach(f => {
      fs.copyFileSync(path.join(srcJS, f), path.join(dstJS, f));
    });
  }
  if (fs.existsSync(srcImg)) {
    fs.readdirSync(srcImg).forEach(f => {
      fs.copyFileSync(path.join(srcImg, f), path.join(dstImg, f));
    });
  }
}

build().catch(err => {
  console.error('❌ Error en build:', err);
  process.exit(1);
});
