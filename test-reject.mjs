import electron from 'electron';
const { app, BrowserWindow } = electron;

async function startServer() {
  await import('this-does-not-exist');
}

app.whenReady().then(async () => {
  await startServer();
  const win = new BrowserWindow();
  win.loadURL('http://localhost:8087');
});
