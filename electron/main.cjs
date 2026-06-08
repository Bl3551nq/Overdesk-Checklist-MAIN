const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// Keep variables in higher scope to prevent garbage collection
let mainWindow = null;
let tray = null;
const configPath = path.join(app.getPath('userData'), 'app-config.json');

// Helper to read config
function readConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading config:', err);
  }
  return {};
}

// Helper to write config
function writeConfig(data) {
  try {
    const current = readConfig();
    fs.writeFileSync(configPath, JSON.stringify({ ...current, ...data }, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing config:', err);
  }
}

function createWindow() {
  const config = readConfig();
  const savedScale = config.scale || 1.0;
  
  // Custom sizing math fitting our card size (320px width initially)
  const initialWidth = Math.round(330 * savedScale);
  const initialHeight = Math.round(530 * savedScale);

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

  // Save coordinates when window moves
  let moveTimeout;
  mainWindow.on('move', () => {
    if (moveTimeout) clearTimeout(moveTimeout);
    moveTimeout = setTimeout(() => {
      if (mainWindow) {
        const [x, y] = mainWindow.getPosition();
        writeConfig({ x, y });
      }
    }, 300);
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
    // Resize down to standard 16x16 system tray image size
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
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

// Gumroad License verify
ipcMain.handle('validate-license', async (event, rawKey) => {
  const licenseKey = rawKey.trim();

  try {
    // Gumroad API call
    const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: 'app3', // from gumroad.com/l/app3
        license_key: licenseKey,
        increment_uses_count: true
      })
    });
    
    const data = await response.json();
    if (response.ok && data.success && !data.uses_count_over_limit) {
      writeConfig({ licenseValid: true, licenseKey });
      return { ok: true };
    }
  } catch (err) {
    console.error('Gumroad fetch error:', err);
  }

  return { ok: false };
});

// Close Application
ipcMain.on('close-app', () => {
  app.quit();
});

// Set Height dynamically (e.g. on minimizing)
ipcMain.on('set-height', (event, height) => {
  if (mainWindow) {
    const [w] = mainWindow.getSize();
    const config = readConfig();
    const scale = config.scale || 1.0;
    const newHeight = Math.round((height + 15) * scale);
    mainWindow.setSize(w, newHeight);
  }
});

// Track exact bounds in scaled layout
ipcMain.on('card-bounds', (event, bounds) => {
  if (mainWindow && bounds) {
    const config = readConfig();
    const scale = config.scale || 1.0;
    // Resize Electron window to hug the card tightly, preserving transparency elsewhere
    const targetW = Math.round((bounds.w + 20) * scale);
    const targetH = Math.round((bounds.h + 20) * scale);
    
    // Safety minimums
    const currentW = Math.max(100, targetW);
    const currentH = Math.max(50, targetH);
    mainWindow.setSize(currentW, currentH);
  }
});

ipcMain.on('scale-start', () => {
  // Can perform operations when custom drag scale starts
});

ipcMain.on('scale-end', (event, scale) => {
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
      const trayImg = nativeImage.createFromPath(customIconPath).resize({ width: 16, height: 16 });
      tray.setImage(trayImg);
    }
  } catch (err) {
    console.error('Error saving dynamic icon:', err);
  }
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});
