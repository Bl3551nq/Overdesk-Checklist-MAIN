const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table and calculator
const crcTable = [];
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(buffer) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buffer.length; i++) {
    crc = crcTable[(crc ^ buffer[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createChunk(typeStr, dataBuffer) {
  const typeBuffer = Buffer.from(typeStr, 'ascii');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(dataBuffer.length, 0);
  
  const crcInput = Buffer.concat([typeBuffer, dataBuffer]);
  const crcValue = crc32(crcInput);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crcValue, 0);
  
  return Buffer.concat([lengthBuffer, crcInput, crcBuffer]);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx*dx + dy*dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// Generate 256x256 PNG
const width = 256;
const height = 256;

// PNG signature
const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

// IHDR chunk data
const ihdrData = Buffer.alloc(13);
ihdrData.writeUInt32BE(width, 0);
ihdrData.writeUInt32BE(height, 4);
ihdrData[8] = 8; // Bit depth: 8
ihdrData[9] = 6; // Color type: RGBA
ihdrData[10] = 0; // Compression
ihdrData[11] = 0; // Filter
ihdrData[12] = 0; // Interlace

const ihdrChunk = createChunk('IHDR', ihdrData);

// IDAT raw scanlines (filter byte 0 + RGBA data for each row)
const scanlineLength = 1 + width * 4;
const rawPixels = Buffer.alloc(height * scanlineLength);

for (let y = 0; y < height; y++) {
  const rowStart = y * scanlineLength;
  rawPixels[rowStart] = 0; // Filter type: None
  
  for (let x = 0; x < width; x++) {
    const pixelStart = rowStart + 1 + x * 4;
    
    // Draw a beautiful rounded squircle icon card
    // Equation of a squircle: ((x-128)/108)^4 + ((y-128)/108)^4 <= 1.0
    const dx = x - 128;
    const dy = y - 128;
    const squircleVal = Math.pow(dx / 108, 4) + Math.pow(dy / 108, 4);
    
    let r = 0, g = 0, b = 0, a = 0;
    
    if (squircleVal <= 1.0) {
      // It is inside the card! Let's draw a futuristic blue gradient
      // Slate background to bright blue: gradient along diagonal
      const mix = (x + y) / 512;
      r = Math.round(15 + mix * 44);     // 15 to 59 (slate-900 to blue-500)
      g = Math.round(23 + mix * 107);    // 23 to 130
      b = Math.round(42 + mix * 204);    // 42 to 246
      a = 255;
      
      // Draw a subtle border inside the squircle
      if (squircleVal >= 0.88) {
        // Light blue outline
        r = 96; g = 165; b = 250; a = 255;
      } else {
        // Draw a minimalist checkmark in the center of the squircle
        // Line 1: (85, 130) -> (115, 160)
        // Line 2: (115, 160) -> (175, 100)
        const d1 = distToSegment(x, y, 85, 130, 115, 160);
        const d2 = distToSegment(x, y, 115, 160, 175, 100);
        const thickness = 9;
        
        if (d1 <= thickness || d2 <= thickness) {
          // Soft checkmark glow / antialiasing or simple white checkmark
          const minD = Math.min(d1, d2);
          const alphaFactor = Math.max(0, Math.min(1, (thickness - minD) / 1.5));
          if (alphaFactor > 0) {
            r = Math.round(r * (1 - alphaFactor) + 255 * alphaFactor);
            g = Math.round(g * (1 - alphaFactor) + 255 * alphaFactor);
            b = Math.round(b * (1 - alphaFactor) + 255 * alphaFactor);
          }
        }
      }
    } else if (squircleVal <= 1.1) {
      // Soft antialiasing for the squircle edge
      const edgeFactor = Math.max(0, Math.min(1, (1.1 - squircleVal) / 0.1));
      const mix = (x + y) / 512;
      r = Math.round(15 + mix * 44);
      g = Math.round(23 + mix * 107);
      b = Math.round(42 + mix * 204);
      a = Math.round(255 * edgeFactor);
    }
    
    rawPixels[pixelStart] = r;
    rawPixels[pixelStart + 1] = g;
    rawPixels[pixelStart + 2] = b;
    rawPixels[pixelStart + 3] = a;
  }
}

const compressedIDATData = zlib.deflateSync(rawPixels);
const idatChunk = createChunk('IDAT', compressedIDATData);

// IEND chunk
const iendChunk = createChunk('IEND', Buffer.alloc(0));

const pngFile = Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);

const targetDir = path.join(__dirname);
fs.writeFileSync(path.join(targetDir, 'icon.png'), pngFile);
console.log('Build initialization successfully generated high-resolution 256x256 electron/icon.png!');
