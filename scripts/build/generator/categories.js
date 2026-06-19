const path = require('path');
const fs = require('fs');
const ejs = require('ejs');

const TEMPLATE = path.join(__dirname, '../../../templates/pages/listing.ejs');
const LAYOUT = path.join(__dirname, '../../../templates/layouts/base.ejs');

function generateCategory(distDir, { siteConfig, categories, category, products, comparisons, allFilters }) {
  const slug = category.slug;
  const dir = path.join(distDir, slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const catComparisons = comparisons.filter(c => c.category === category.id);

  // Compute filter counts for nav
  const { computeFilterCounts } = require('./filters');
  const filterCounts = computeFilterCounts(category, products, allFilters || []);

  const crumbs = [
    { name: 'Inicio', url: '/' },
    { name: category.name, url: '/' + slug + '/' }
  ];

  const content = ejs.render(fs.readFileSync(TEMPLATE, 'utf-8'), {
    title: category.name,
    description: category.description,
    products,
    crumbs,
    comparison: catComparisons.length > 0,
    siteName: siteConfig.site.name,
    allFilters: allFilters || [],
    categoryFilters: category.filters || [],
    filterCounts,
    categorySlug: slug
  }, { filename: TEMPLATE });

  const html = ejs.render(fs.readFileSync(LAYOUT, 'utf-8'), {
    title: category.name,
    description: category.description,
    siteName: siteConfig.site.name,
    lang: siteConfig.site.lang,
    canonical: `${siteConfig.site.url}/${slug}/`,
    categories,
    content,
    logoUrl: siteConfig.site.logo
  }, { filename: LAYOUT });

  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf-8');
}

module.exports = { generateCategory };
