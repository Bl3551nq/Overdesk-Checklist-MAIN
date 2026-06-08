const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  checkLicense: () => ipcRenderer.invoke('check-license'),
  validateLicense: (key) => ipcRenderer.invoke('validate-license', key),
  closeApp: () => ipcRenderer.send('close-app'),
  setHeight: (height) => ipcRenderer.send('set-height', height),
  cardBounds: (bounds) => ipcRenderer.send('card-bounds', bounds),
  scaleStart: () => ipcRenderer.send('scale-start'),
  scaleEnd: (scale) => ipcRenderer.send('scale-end', scale),
  saveIcon: (dataUrl) => ipcRenderer.send('save-icon', dataUrl),
  installUpdate: () => ipcRenderer.send('install-update'),
  onUpdateAvailable: (cb) => {
    ipcRenderer.on('update-available', (event, version) => cb(version));
  },
  onUpdateDownloaded: (cb) => {
    ipcRenderer.on('update-downloaded', () => cb());
  }
});
