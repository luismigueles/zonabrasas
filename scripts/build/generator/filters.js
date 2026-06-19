const path = require('path');
const fs = require('fs');
const ejs = require('ejs');

const TEMPLATE = path.join(__dirname, '../../../templates/pages/listing.ejs');
const LAYOUT = path.join(__dirname, '../../../templates/layouts/base.ejs');

function generateFilterPages(distDir, { siteConfig, categories, allFilters, productsByCategory, allComparisons }) {
  allFilters.forEach(filterDef => {
    filterDef.options.forEach(opt => {
      categories.forEach(cat => {
        if (!cat.filters || !cat.filters.includes(filterDef.id)) return;

        const products = (productsByCategory[cat.id] || [])
          .filter(p => p[filterDef.id] === opt.id);

        if (products.length === 0) return;

        const slug = `${filterDef.id}-${opt.id}`;
        const dir = path.join(distDir, cat.slug, slug);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const title = `${opt.name} - ${cat.name}`;
        const description = `Los mejores productos de ${cat.name} con ${filterDef.name.toLowerCase()} de tipo ${opt.name.toLowerCase()}.`;

        const crumbs = [
          { name: 'Inicio', url: '/' },
          { name: cat.name, url: '/' + cat.slug + '/' },
          { name: opt.name, url: `/${cat.slug}/${slug}/` }
        ];

        // Compute filter counts for the filter nav
        const filterCounts = computeFilterCounts(cat, productsByCategory[cat.id] || [], allFilters);

        const content = ejs.render(fs.readFileSync(TEMPLATE, 'utf-8'), {
          title,
          description,
          products,
          crumbs,
          comparison: false,
          allFilters,
          categoryFilters: cat.filters,
          filterCounts,
          categorySlug: cat.slug,
          siteName: siteConfig.site.name
        }, { filename: TEMPLATE });

        const html = ejs.render(fs.readFileSync(LAYOUT, 'utf-8'), {
          title,
          description,
          siteName: siteConfig.site.name,
          lang: siteConfig.site.lang,
          canonical: `${siteConfig.site.url}/${cat.slug}/${slug}/`,
          categories,
          content,
          ogImage: products.length > 0 ? products[0].image : undefined,
          logoUrl: siteConfig.site.logo
        }, { filename: LAYOUT });

        fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf-8');
        console.log(`   /${cat.slug}/${slug}/ (${products.length} productos)`);
      });
    });
  });
}

function computeFilterCounts(category, products, allFilters) {
  const counts = {};
  (category.filters || []).forEach(filterId => {
    counts[filterId] = {};
    const filterDef = allFilters.find(f => f.id === filterId);
    if (!filterDef) return;
    filterDef.options.forEach(opt => {
      counts[filterId][opt.id] = products.filter(p => p[filterId] === opt.id).length;
    });
  });
  return counts;
}

module.exports = { generateFilterPages, computeFilterCounts };
