import electron from 'electron';
const { app, BrowserWindow } = electron;
import path from 'path';

if (app.isPackaged) {
  process.env.NODE_ENV = 'production';
}

// Import and start the backend server (Express + WebTorrent) defined in server.ts
import { startServer } from '../server.ts';

function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
  });

  // Always load from the local express server which serves the static files in production.
  win.loadURL('http://localhost:8087');

  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(async () => {
  // Start the background Express server first
  await startServer();
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // On macOS it is common for applications to stay open until the user explicitly quits.
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
