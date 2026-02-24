/**
 * Generate minimal PWA icon files
 * Creates tiny valid PNG files as placeholders for manifest
 */

const fs = require('fs');
const path = require('path');

// Minimal valid 1x1 transparent PNG (base64)
const minimalPNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const sizes = [72, 192, 512];
const iconDir = path.join(__dirname, '../public/icons');

// Create directory if it doesn't exist
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

// Generate placeholder icons for each size
sizes.forEach(size => {
  const filename = `icon-${size}x${size}.png`;
  const filepath = path.join(iconDir, filename);
  fs.writeFileSync(filepath, minimalPNG);
  console.log(`✓ Created ${filename}`);
});

// Also create maskable versions
sizes.forEach(size => {
  const filename = `icon-${size}x${size}-maskable.png`;
  const filepath = path.join(iconDir, filename);
  fs.writeFileSync(filepath, minimalPNG);
  console.log(`✓ Created ${filename} (maskable)`);
});

console.log('\n✓ PWA icon files generated successfully');
console.log('Note: These are minimal placeholder images. For production,');
console.log('generate proper icons from your brand logo using:');
console.log('  npx sharp-cli convert src/favicon.svg -o public/icons/icon-192.png');
