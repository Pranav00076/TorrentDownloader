import electron from 'electron';
const { app, BrowserWindow } = electron;
import express from 'express';

app.whenReady().then(async () => {
  const exp = express();
  exp.get('/', (req, res) => res.send('<h1>Hello</h1>'));
  
  // start listening but don't await
  exp.listen(8087, () => console.log('Listening'));

  const win = new BrowserWindow();
  win.loadURL('http://localhost:8087');
});
