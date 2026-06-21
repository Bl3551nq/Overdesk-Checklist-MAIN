const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const crypto = require('crypto');
const os = require('os');

// Keep variables in higher scope to prevent garbage collection
let mainWindow = null;
let tray = null;
let isQuitting = false;
let cachedX = null;
let cachedY = null;
let cachedScale = null;
let configCache = null;
let isProgrammaticBoundsUpdate = false;
let programmaticTimeout = null;
let isScaling = false;
let scaleCenterX = null;
let scaleCenterY = null;
const configPath = path.join(app.getPath('userData'), 'app-config.json');

// Helper to read config
function readConfig() {
  if (configCache) return configCache;
  try {
    if (fs.existsSync(configPath)) {
      configCache = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return configCache;
    }
  } catch (err) {
    console.error('Error reading config:', err);
  }
  configCache = {};
  return configCache;
}

// Helper to write config
let writeTimeout = null;
function writeConfig(data) {
  try {
    const current = readConfig();
    configCache = { ...current, ...data };
    
    if (writeTimeout) clearTimeout(writeTimeout);
    writeTimeout = setTimeout(() => {
      try {
        fs.writeFileSync(configPath, JSON.stringify(configCache, null, 2), 'utf8');
      } catch (err) {
        console.error('Error writing config:', err);
      }
    }, 500); // 500ms debounce
  } catch (err) {
    console.error('Error in writeConfig queue:', err);
  }
}

function createWindow() {
  const config = readConfig();
  const savedScale = config.scale || 1.0;
  cachedScale = savedScale;
  
  // Custom sizing math fitting our card size (320px width initially)
  const initialWidth = Math.round((320 + 140) * savedScale);
  const initialHeight = Math.round((480 + 200) * savedScale);

  const windowOptions = {
    width: initialWidth,
    height: initialHeight,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: true, // Set to true to bypass OS/Win32 boundary positioning restrictions
    maximizable: false, // Prevent maximize behavior to sustain checklist aspect ratio
    alwaysOnTop: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  };

  // Restore saved coordinates if loaded correctly
  if (typeof config.x === 'number' && typeof config.y === 'number') {
    windowOptions.x = config.x;
    windowOptions.y = config.y;
    cachedX = config.x;
    cachedY = config.y;
  }

  // Load appropriate application icon
  const customIconPath = path.join(app.getPath('userData'), 'icon.png');
  const packagedIconPath = path.join(__dirname, 'icon.png');
  if (fs.existsSync(customIconPath)) {
    windowOptions.icon = customIconPath;
  } else if (fs.existsSync(packagedIconPath)) {
    windowOptions.icon = packagedIconPath;
  }

  mainWindow = new BrowserWindow(windowOptions);

  // Load from local static build or development server
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    // Open DevTools in dev mode if needed for debugging
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Save coordinates when window moves (only if NOT programmatic resize/drag scale)
  let moveTimeout;
  mainWindow.on('move', () => {
    if (isProgrammaticBoundsUpdate || isScaling) return;
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      cachedX = x;
      cachedY = y;
    }
    if (moveTimeout) clearTimeout(moveTimeout);
    moveTimeout = setTimeout(() => {
      if (isProgrammaticBoundsUpdate || isScaling) return;
      if (mainWindow) {
        const [x, y] = mainWindow.getPosition();
        cachedX = x;
        cachedY = y;
        writeConfig({ x, y });
      }
    }, 300);
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Check for auto updates once window displays
  mainWindow.once('ready-to-show', () => {
    if (!isDev) {
      autoUpdater.checkForUpdatesAndNotify().catch(err => {
        console.error('Error checking for updates:', err);
      });
    }
  });
}

function createTray() {
  const customIconPath = path.join(app.getPath('userData'), 'icon.png');
  const packagedIconPath = path.join(__dirname, 'icon.png');
  let iconPath = packagedIconPath;

  if (fs.existsSync(customIconPath)) {
    iconPath = customIconPath;
  }

  let trayIcon;
  if (fs.existsSync(iconPath)) {
    // Windows supports 32x32 or 48x48 for High-DPI screens. macOS standard size is 16x16 with optional template styling.
    if (process.platform === 'win32') {
      trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 32, height: 32, quality: 'best' });
    } else if (process.platform === 'darwin') {
      trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16, quality: 'best' });
      trayIcon.setTemplateImage(true);
    } else {
      trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 24, height: 24, quality: 'best' });
    }
  } else {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show/Hide App',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
            mainWindow.focus();
          }
        } else {
          createWindow();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Overdesk Checklist');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createWindow();
    }
  });
}

// Configure autoUpdater
autoUpdater.on('update-available', (info) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info.version);
  }
});

autoUpdater.on('update-downloaded', () => {
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded');
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Keep the app process alive in the system tray area
});

/* ═══════════════════════════════════════════════════════
   IPC HANDLERS (License Validation & Window Controls)
═══════════════════════════════════════════════════════ */

// Check if license is already validated
ipcMain.handle('check-license', () => {
  const config = readConfig();
  if (config.licenseValid) {
    return { ok: true, key: config.licenseKey };
  }
  return { ok: false };
});

function getMachineId() {
  const raw = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.cpus()[0]?.model || '',
    os.totalmem(),
  ].join('|');
  return crypto.createHash('sha256').update(raw).digest('hex');
}

const ENCRYPTION_KEY = crypto.scryptSync('overdesk-license-key-salt', 'salt', 32);
const IV = Buffer.alloc(16, 0);

function encryptData(dataStr) {
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, IV);
  let encrypted = cipher.update(dataStr, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decryptData(encryptedHex) {
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, IV);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    return null;
  }
}

// Gumroad License verify
ipcMain.handle('validate-license', async (event, rawKey) => {
  const licenseKey = rawKey.trim();
  const normalizedKey = licenseKey.toUpperCase();
  const cleanedKey = normalizedKey.replace(/[^A-Z0-9]/g, '');

  // Support offline/testing authorization override keys
  if (
    normalizedKey === 'TEST-LICENSE-KEY' ||
    normalizedKey === 'OVERDESK-TEST-KEY-2026' ||
    normalizedKey === 'TEST-1234-5678-90AB-CDEF-1234-5678' ||
    (cleanedKey.length === 32 && cleanedKey.startsWith('TEST'))
  ) {
    writeConfig({ licenseValid: true, licenseKey });
    return { ok: true, test: true };
  }

  // Attempt to load Gumroad config from package.json dynamically so developers can override without editing code
  let productId = 'app2';
  let accessToken = '';
  let usePermalink = true;

  try {
    const pkgPath = path.join(__dirname, '../package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.gumroad) {
        if (pkg.gumroad.product_id) {
          productId = pkg.gumroad.product_id;
          usePermalink = false;
        } else if (pkg.gumroad.product_permalink) {
          productId = pkg.gumroad.product_permalink;
          usePermalink = true;
        }
        if (pkg.gumroad.access_token !== undefined) {
          accessToken = pkg.gumroad.access_token;
        }
      }
    }
  } catch (pkgErr) {
    console.error('Error reading package.json for Gumroad configuration, using defaults:', pkgErr);
  }

  const currentMachineId = getMachineId();
  const licenseDevicePath = path.join(app.getPath('userData'), 'license-device.enc');
  let hasFirstActivated = false;
  let storedMachineId = '';

  if (fs.existsSync(licenseDevicePath)) {
    try {
      const encryptedData = fs.readFileSync(licenseDevicePath, 'utf8').trim();
      const decrypted = decryptData(encryptedData);
      if (decrypted) {
        const parsed = JSON.parse(decrypted);
        if (parsed.machineId && parsed.licenseKey) {
          const storedKeyMatch = parsed.licenseKey.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (storedKeyMatch === cleanedKey) {
            storedMachineId = parsed.machineId;
            hasFirstActivated = true;
          }
        }
      }
    } catch (err) {
      console.error('Error reading/decrypting machine activation:', err);
    }
  }

  // Always call Gumroad with increment_uses_count: false after the first activation so the count stays at 1 and is only used as a flag
  const shouldIncrement = !hasFirstActivated;

  // Gumroad API can be sensitive to content-types. We try URL-encoded first and fall back to JSON.
  try {
    const params = new URLSearchParams();
    params.append('license_key', licenseKey);
    params.append('increment_uses_count', shouldIncrement ? 'true' : 'false');
    if (usePermalink) {
      params.append('product_permalink', productId);
    } else {
      params.append('product_id', productId);
    }
    if (accessToken) {
      params.append('access_token', accessToken);
    }

    console.log(`Verifying license with Gumroad URL-encoded API. Product ID: ${productId}`);
    let response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    let data = {};
    try {
      data = await response.json();
    } catch (jsonErr) {
      console.error('Failed to parse Gumroad response as JSON, trying text:', jsonErr);
    }

    console.log('Gumroad direct response state:', response.status, data);

    if (!response.ok || !data.success) {
      // Fallback to JSON payload
      const requestBody = {
        license_key: licenseKey,
        increment_uses_count: shouldIncrement
      };
      if (usePermalink) {
        requestBody.product_permalink = productId;
      } else {
        requestBody.product_id = productId;
      }
      if (accessToken) {
        requestBody.access_token = accessToken;
      }

      console.log('Trying JSON fallback verification...');
      const fallbackResponse = await fetch('https://api.gumroad.com/v2/licenses/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        console.log('Gumroad JSON response:', fallbackResponse.status, fallbackData);
        data = fallbackData; // retain latest error message if still failed
      }
    }

    // Process Gumroad result
    if (data.success) {
      if (data.purchase && data.purchase.refunded === true) {
        return { ok: false, error: 'This license has been refunded and is no longer valid.' };
      }

      const uses = (data.uses !== undefined) ? data.uses : 0;
      if (uses > 1 && storedMachineId !== currentMachineId) {
        return { 
          ok: false, 
          error: 'This license key is already activated on another device. Contact support to transfer.' 
        };
      }

      if (uses === 1 || storedMachineId === currentMachineId) {
        if (!hasFirstActivated) {
          try {
            const dataToEncrypt = JSON.stringify({
              machineId: currentMachineId,
              licenseKey: licenseKey
            });
            const encryptedStr = encryptData(dataToEncrypt);
            fs.writeFileSync(licenseDevicePath, encryptedStr, 'utf8');
          } catch (writeErr) {
            console.error('Failed to store machine fingerprint:', writeErr);
          }
        }
        writeConfig({ licenseValid: true, licenseKey });
        return { ok: true };
      }
    }

    const errorMessage = data && data.message ? data.message : `Gumroad verification failed (Status: ${response.status})`;
    return { ok: false, error: errorMessage };

  } catch (err) {
    console.error('Gumroad fetch error:', err);
    return { ok: false, error: err.message || 'Network error connecting to Gumroad.' };
  }
});

// Dynamic click-through/ignore-mouse-events handling for transparent shadow padding area
ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(ignore, options);
  }
});

// Close Application (Hide to tray area)
ipcMain.on('close-app', () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});

// Set Height dynamically (e.g. on minimizing)
ipcMain.on('set-height', (event, height) => {
  if (mainWindow) {
    const [w] = mainWindow.getSize();
    const config = readConfig();
    const scale = config.scale || 1.0;
    const newHeight = Math.round((height + 200) * scale);
    mainWindow.setSize(w, newHeight);
  }
});

// Track exact bounds in scaled layout
ipcMain.on('card-bounds', (event, bounds) => {
  if (mainWindow && bounds) {
    const config = readConfig();
    const activeScale = bounds.scale !== undefined ? bounds.scale : (config.scale || 1.0);
    
    // Resize Electron window to leave ample transparent padding so the card's deep blurred drop shadow doesn't get clipped
    const targetW = Math.max(100, Math.round((bounds.w + 140) * activeScale));
    const targetH = Math.max(50, Math.round((bounds.h + 200) * activeScale));
    
    // Fetch current position and size
    const [currentX, currentY] = mainWindow.getPosition();
    const [currentW, currentH] = mainWindow.getSize();
    
    // Initialize or read position from cached values
    if (cachedX === null || cachedY === null) {
      cachedX = currentX;
      cachedY = currentY;
    }
    if (cachedScale === null) {
      cachedScale = activeScale;
    }
    
    let newX = currentX;
    let newY = currentY;
    
    const isScaleChanged = cachedScale !== null && Math.abs(activeScale - cachedScale) > 0.01;
    
    if (isScaling && scaleCenterX !== null && scaleCenterY !== null) {
      // Anchors the absolute center of the window during active drag-and-resize scaling
      newX = Math.round(scaleCenterX - targetW / 2);
      newY = Math.round(scaleCenterY - targetH / 2);
      cachedScale = activeScale;
    } else if (isScaleChanged) {
      // Anchors the visual center of the window if scale changed discretely (e.g. from settings option)
      const centerX = currentX + currentW / 2;
      const centerY = currentY + currentH / 2;
      newX = Math.round(centerX - targetW / 2);
      newY = Math.round(centerY - targetH / 2);
      cachedScale = activeScale;
    } else {
      // Keeps the top-left of the window perfectly constant for normal height updates 
      // (minimizing/expanding, adding/removing checklist items, settings toggles)
      // to guarantee zero visual shift mismatch and zero flickering.
      newX = currentX;
      newY = currentY;
      cachedScale = activeScale;
    }
    
    // Update cache proactively before the asynchronous window shift settles
    cachedX = newX;
    cachedY = newY;
    
    isProgrammaticBoundsUpdate = true;
    if (programmaticTimeout) clearTimeout(programmaticTimeout);
    
    mainWindow.setBounds({
      x: newX,
      y: newY,
      width: targetW,
      height: targetH
    });
    
    programmaticTimeout = setTimeout(() => {
      isProgrammaticBoundsUpdate = false;
    }, 200);
    
    writeConfig({ x: newX, y: newY, scale: activeScale });
  }
});

ipcMain.on('scale-start', () => {
  isScaling = true;
  if (mainWindow) {
    const [x, y] = mainWindow.getPosition();
    const [w, h] = mainWindow.getSize();
    scaleCenterX = x + w / 2;
    scaleCenterY = y + h / 2;
  }
});

ipcMain.on('scale-end', (event, scale) => {
  isScaling = false;
  scaleCenterX = null;
  scaleCenterY = null;
  writeConfig({ scale });
});

ipcMain.on('save-icon', (event, dataUrl) => {
  try {
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    const customIconPath = path.join(app.getPath('userData'), 'icon.png');
    fs.writeFileSync(customIconPath, base64Data, 'base64');
    
    // Dynamically update main window icon
    if (mainWindow) {
      const nativeImg = nativeImage.createFromPath(customIconPath);
      mainWindow.setIcon(nativeImg);
    }
    
    // Dynamically update tray icon
    if (tray) {
      let trayImg;
      if (process.platform === 'win32') {
        trayImg = nativeImage.createFromPath(customIconPath).resize({ width: 32, height: 32, quality: 'best' });
      } else if (process.platform === 'darwin') {
        trayImg = nativeImage.createFromPath(customIconPath).resize({ width: 16, height: 16, quality: 'best' });
        trayImg.setTemplateImage(true);
      } else {
        trayImg = nativeImage.createFromPath(customIconPath).resize({ width: 24, height: 24, quality: 'best' });
      }
      tray.setImage(trayImg);
    }
  } catch (err) {
    console.error('Error saving dynamic icon:', err);
  }
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});
