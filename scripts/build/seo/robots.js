const path = require('path');
const fs = require('fs');

function generateRobots(distDir, { siteConfig }) {
  const robots = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${siteConfig.site.url}/sitemap.xml`,
    ''
  ].join('\n');

  fs.writeFileSync(path.join(distDir, 'robots.txt'), robots, 'utf-8');
  console.log('   robots.txt generado');
}

module.exports = { generateRobots };
