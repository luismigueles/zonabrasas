const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const { generateProductContent } = require('../../content/generator');

const TEMPLATE = path.join(__dirname, '../../../templates/pages/product.ejs');
const LAYOUT = path.join(__dirname, '../../../templates/layouts/base.ejs');
const SCHEMA_PARTIAL = path.join(__dirname, '../../../templates/partials/schema-product.ejs');

async function generateProductPage(distDir, { siteConfig, categories, product, allProducts, allFilters }) {
  const cat = categories.find(c => c.id === product.category);
  const slug = product.slug;
  const catSlug = cat ? cat.slug : product.category;

  const dir = path.join(distDir, catSlug, slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Regla de Oro #1: Generar contenido editorial con IA
  const aiContent = await generateProductContent(product);

  const crumbs = [
    { name: 'Inicio', url: '/' },
    { name: cat ? cat.name : product.category, url: '/' + catSlug + '/' },
    { name: product.name, url: '/' + catSlug + '/' + slug + '/' }
  ];

  const schema = ejs.render(fs.readFileSync(SCHEMA_PARTIAL, 'utf-8'), { product }, { filename: SCHEMA_PARTIAL });

  const content = ejs.render(fs.readFileSync(TEMPLATE, 'utf-8'), {
    product,
    crumbs,
    allFilters: allFilters || [],
    aiContent
  }, { filename: TEMPLATE });

  const html = ejs.render(fs.readFileSync(LAYOUT, 'utf-8'), {
    title: product.name,
    description: aiContent?.gancho?.substring(0, 160) || product.description.substring(0, 160),
    siteName: siteConfig.site.name,
    lang: siteConfig.site.lang,
    canonical: `${siteConfig.site.url}/${catSlug}/${slug}/`,
    categories,
    content,
    schema,
    ogImage: product.image,
    logoUrl: siteConfig.site.logo
  }, { filename: LAYOUT });

  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf-8');
  delete require.cache[require.resolve('../../content/generator')];
}

module.exports = { generateProductPage };
