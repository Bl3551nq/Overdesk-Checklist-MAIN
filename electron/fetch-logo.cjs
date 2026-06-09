const fs = require('fs');
const path = require('path');

async function fetchLogo() {
  const url = 'https://raw.githubusercontent.com/Bl3551nq/Overdesk-Logos/refs/heads/main/OVERDESK-checklist.svg';
  console.log(`Fetching SVG from: ${url}`);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch: ${res.statusText}`);
    }
    const svgContent = await res.text();
    const destPath = path.join(__dirname, '../src/logo.svg');
    fs.writeFileSync(destPath, svgContent, 'utf8');
    console.log(`Successfully saved SVG to: ${destPath}`);
    console.log('SVG Preview (first 1000 chars):');
    console.log(svgContent.substring(0, 1000));
  } catch (err) {
    console.error('Error fetching SVG:', err);
    process.exit(1);
  }
}

fetchLogo();
