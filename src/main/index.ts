import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { AppDatabase } from './db/database';
import { registerIpcHandlers } from './ipc';

let mainWindow: BrowserWindow | null = null;
let db: AppDatabase | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

async function createWindow() {
  // Ensure user data directory exists
  const userDataDir = path.join(app.getPath('userData'), 'SellerPilotData');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  // Set environment variable for database if needed
  process.env.SELLERPILOT_DATA_DIR = userDataDir;

  // Initialize SQLite database
  const dbPath = path.join(userDataDir, 'sellerpilot.db');
  db = new AppDatabase(dbPath);
  await db.init();

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    title: 'SellerPilot AI',
    backgroundColor: '#F8FAFC',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    autoHideMenuBar: true,
  });

  registerIpcHandlers(db, mainWindow);

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, '../../dist/index.html');
    if (fs.existsSync(indexPath)) {
      await mainWindow.loadFile(indexPath);
    } else {
      // In case dev server url isn't passed via env but dev port 5173 is standard
      await mainWindow.loadURL('http://localhost:5173');
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (db) {
    db.saveImmediate();
    db.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (db) {
    db.saveImmediate();
    db.close();
  }
});
