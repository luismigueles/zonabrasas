const path = require('path');
const fs = require('fs');
const ejs = require('ejs');

const TEMPLATE = path.join(__dirname, '../../../templates/pages/home.ejs');
const LAYOUT = path.join(__dirname, '../../../templates/layouts/base.ejs');

function generateHome(distDir, { siteConfig, categories, comparisons, featured, allFilters }) {
  const content = ejs.render(fs.readFileSync(TEMPLATE, 'utf-8'), {
    categories,
    comparisons,
    featured,
    siteName: siteConfig.site.name,
    allFilters: allFilters || []
  }, { filename: TEMPLATE });

  const html = ejs.render(fs.readFileSync(LAYOUT, 'utf-8'), {
    title: siteConfig.site.name,
    description: siteConfig.site.description,
    siteName: siteConfig.site.name,
    lang: siteConfig.site.lang,
    canonical: siteConfig.site.url + '/',
    categories,
    content,
    logoUrl: siteConfig.site.logo
  }, { filename: LAYOUT });

  fs.writeFileSync(path.join(distDir, 'index.html'), html, 'utf-8');
}

module.exports = { generateHome };
