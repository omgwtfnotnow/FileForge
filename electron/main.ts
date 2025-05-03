
import { app, BrowserWindow } from 'electron';
import path from 'path';
import isDev from 'electron-is-dev';
import url from 'url';

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false, // Keep false for security
      contextIsolation: true, // Keep true for security
      preload: path.join(__dirname, 'preload.js'), // Optional preload script
    },
    // __dirname in the context of the *packaged* app refers to the location of main.js
    // inside the resources folder (e.g., app.asar/dist-electron). The assets folder is copied
    // to the root of the resources folder by electron-builder.
    icon: path.join(__dirname, '..', 'assets', 'icon.png') // Adjusted path relative to __dirname
  });

  // Load the index.html of the app.
  if (isDev) {
    // In development, load the Next.js dev server
    console.log('Running in development mode. Loading URL: http://localhost:9002');
    mainWindow.loadURL('http://localhost:9002') // Ensure this port matches your Next.js dev port
      .catch(err => console.error('Failed to load development URL:', err));
    // Open the DevTools automatically in development.
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the exported static files
    // __dirname will be something like /path/to/YourApp.app/Contents/Resources/app.asar/dist-electron
    // or /path/to/YourApp/resources/app.asar/dist-electron
    // We need to go up one level from dist-electron and then into the 'out' directory.
    const startUrl = url.format({
        pathname: path.join(__dirname, '..', 'out', 'index.html'), // Navigate up from dist-electron to find 'out'
        protocol: 'file:',
        slashes: true,
      });
    console.log(`Loading production URL: ${startUrl}`); // Add logging
    mainWindow.loadURL(startUrl)
      .catch(err => console.error('Failed to load production URL:', err)); // Add error handling
  }

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    // For simplicity, we are not handling multi-windows here.
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// Example preload script (Optional: create electron/preload.ts if needed)
// For contextIsolation: true, preload scripts are used to expose specific Node.js/Electron APIs safely
// to the renderer process. For this simple setup, it might not be strictly necessary.
// If you create preload.ts, update the `electron:build:main` script to compile it too.
// --- electron/preload.ts example ---
// const { contextBridge, ipcRenderer } = require('electron')
// contextBridge.exposeInMainWorld('electronAPI', {
//   // Example: expose a function to send a message to the main process
//   // sendMessage: (channel, data) => ipcRenderer.send(channel, data)
// })
// --- End example ---

