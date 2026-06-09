const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function buildIcon() {
  const svgPath = path.join(__dirname, '../src/logo.svg');
  const iconDest = path.join(__dirname, 'icon.png');

  console.log(`Rendering high-fidelity taskbar/window icon using Sharp from: ${svgPath}`);
  try {
    if (!fs.existsSync(svgPath)) {
      throw new Error(`SVG file not found at ${svgPath}`);
    }

    // Render SVG, trim any transparent padding/margins to let the logo fill the frame, then resize to 256x256
    await sharp(svgPath)
      .trim()
      .resize(256, 256, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(iconDest);

    console.log(`Success! Rendered custom SVG and saved beautifully to: ${iconDest}`);
  } catch (err) {
    console.error('Error generating icon via Sharp:', err);
    process.exit(1);
  }
}

buildIcon();
