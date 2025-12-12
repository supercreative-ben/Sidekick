const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron')
const path = require('path')

// Set app name early
app.setName('Sidekick')

function createWindow () {
    // Create the browser window
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: 'Sidekick',
        icon: path.join(__dirname, '../assets/icon.png'),
        titleBarStyle: 'hiddenInset', // Hide title bar but keep traffic light controls
        show: false, // Don't show until ready
        webPreferences: {
            nodeIntegration: false, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            preload: path.join(__dirname, 'preload.js')
        }
    })

    // Load the index.html file from the client folder
    mainWindow.loadFile(path.join(__dirname, '../client/index.html'))
    
    // Show window when ready to prevent visual flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
    })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
    // Set app icon explicitly for macOS
    if (process.platform === 'darwin') {
        const iconPath = path.resolve(__dirname, '../assets/icon.png')
        console.log('Setting dock icon to:', iconPath)
        console.log('Icon file exists:', require('fs').existsSync(iconPath))
        app.dock.setIcon(iconPath)
    }
    
    createWindow()

    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})

// Handle get sources request
ipcMain.handle('GET_SOURCES', async (event) => {
    try {
        const sources = await desktopCapturer.getSources({
            types: ['screen', 'window'],
            thumbnailSize: { width: 0, height: 0 }, // No thumbnails for better performance
            fetchWindowIcons: true
        });
        return sources;
    } catch (error) {
        console.error('Error getting sources:', error);
        throw error;
    }
}) 