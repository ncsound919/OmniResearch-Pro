const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

function startServer() {
  const serverPath = path.join(__dirname, '../dist/server.cjs');
  serverProcess = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: '3000', NODE_ENV: 'production' },
    stdio: 'pipe',
  });
  serverProcess.stdout.on('data', (data) => console.log(`[server] ${data}`));
  serverProcess.stderr.on('data', (data) => console.error(`[server] ${data}`));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'OmniResearch Pro',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Wait for server to start, then load
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:3000');
  }, 2000);

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  startServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
