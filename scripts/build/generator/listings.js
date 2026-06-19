const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const { generateComparisonContent, assignDynamicTags } = require('../../content/generator');

const LAYOUT = path.join(__dirname, '../../../templates/layouts/base.ejs');
const COMPARISON_TEMPLATE = path.join(__dirname, '../../../templates/pages/comparison.ejs');
const LISTING_TEMPLATE = path.join(__dirname, '../../../templates/pages/listing.ejs');

async function generateListing(distDir, { siteConfig, categories, comparison, products, allComparisons, allFilters }) {
  const slug = comparison.slug;
  const dir = path.join(distDir, slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const crumbs = [
    { name: 'Inicio', url: '/' },
    { name: comparison.title, url: '/' + slug + '/' }
  ];

  // Regla de Oro #2: Asignar etiquetas dinámicas basadas en datos
  const taggedProducts = assignDynamicTags(products);

  // Collect all spec keys from all products
  const specKeysSet = new Set();
  products.forEach(p => {
    if (p.specs) Object.keys(p.specs).forEach(k => specKeysSet.add(k));
  });
  const specKeys = [...specKeysSet];

  if (comparison.type === 'vs') {
    // Regla de Oro #1: Generar contenido editorial para comparativa
    const aiContent = await generateComparisonContent(comparison, taggedProducts);

    const content = ejs.render(fs.readFileSync(COMPARISON_TEMPLATE, 'utf-8'), {
      title: comparison.title,
      description: comparison.description,
      products: taggedProducts,
      crumbs,
      specKeys,
      siteName: siteConfig.site.name,
      allFilters: allFilters || [],
      aiContent
    }, { filename: COMPARISON_TEMPLATE });

    const html = ejs.render(fs.readFileSync(LAYOUT, 'utf-8'), {
      title: comparison.title,
      description: aiContent?.gancho?.substring(0, 160) || comparison.description,
      siteName: siteConfig.site.name,
      lang: siteConfig.site.lang,
      canonical: `${siteConfig.site.url}/${slug}/`,
      categories,
      content,
      ogImage: products.length > 0 ? products[0].image : undefined,
      logoUrl: siteConfig.site.logo
    }, { filename: LAYOUT });

    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf-8');

  } else {
    // Ranking / listing - usa listing template con tabla comparativa
    const content = ejs.render(fs.readFileSync(LISTING_TEMPLATE, 'utf-8'), {
      title: comparison.title,
      description: comparison.description,
      products: taggedProducts,
      crumbs,
      comparison: true,
      siteName: siteConfig.site.name,
      allFilters: allFilters || []
    }, { filename: LISTING_TEMPLATE });

    const html = ejs.render(fs.readFileSync(LAYOUT, 'utf-8'), {
      title: comparison.title,
      description: comparison.description,
      siteName: siteConfig.site.name,
      lang: siteConfig.site.lang,
      canonical: `${siteConfig.site.url}/${slug}/`,
      categories,
      content,
      ogImage: products.length > 0 ? products[0].image : undefined,
      logoUrl: siteConfig.site.logo
    }, { filename: LAYOUT });

    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf-8');
  }
}

module.exports = { generateListing };
