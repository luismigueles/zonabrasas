const path = require('path');
const fs = require('fs');

function generateSitemap(distDir, { siteConfig, categories, products, comparisons, allFilters, productsByCategory }) {
  const url = siteConfig.site.url;
  const now = new Date().toISOString().split('T')[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  // Homepage
  xml += `  <url><loc>${url}/</loc><priority>1.0</priority><lastmod>${now}</lastmod></url>\n`;

  // Categories
  categories.forEach(cat => {
    xml += `  <url><loc>${url}/${cat.slug}/</loc><priority>0.8</priority><changefreq>weekly</changefreq></url>\n`;
  });

  // Filter pages
  allFilters.forEach(filterDef => {
    filterDef.options.forEach(opt => {
      categories.forEach(cat => {
        if (!cat.filters || !cat.filters.includes(filterDef.id)) return;
        const prods = (productsByCategory[cat.id] || []).filter(p => p[filterDef.id] === opt.id);
        if (prods.length === 0) return;
        xml += `  <url><loc>${url}/${cat.slug}/${filterDef.id}-${opt.id}/</loc><priority>0.7</priority><changefreq>weekly</changefreq></url>\n`;
      });
    });
  });

  // Product pages
  products.forEach(p => {
    const catSlug = p.categoryData ? p.categoryData.slug : p.category;
    xml += `  <url><loc>${url}/${catSlug}/${p.slug}/</loc><priority>0.7</priority><changefreq>monthly</changefreq></url>\n`;
  });

  // Comparison pages
  comparisons.forEach(c => {
    xml += `  <url><loc>${url}/${c.slug}/</loc><priority>0.9</priority><changefreq>weekly</changefreq></url>\n`;
  });

  xml += `</urlset>`;

  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), xml, 'utf-8');
  console.log('   sitemap.xml generado');
}

module.exports = { generateSitemap };
