/**
 * Electron main process.
 * creates the app window, registers IPC handlers, and manages the WS server.
 */

import { app, BrowserWindow, clipboard, ipcMain } from "electron";
import path from "path";
import { ElectronWsServer } from "./ws-server.js";
import { getLanIp } from "./net-utils.js";

let mainWindow: BrowserWindow | null = null;
const wsServer = new ElectronWsServer();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 680,
    minWidth: 360,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "ShareGo",
    icon: path.join(__dirname, "../build/icon-512.png"),
    backgroundColor: "#0f172a",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    show: false,
  });

  // show window after content loads to avoid white flash
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  // open devtools in debug mode
  if (process.env.SHAREGO_DEBUG) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
    // pipe renderer console to terminal
    mainWindow.webContents.on("console-message", (_e, level, message) => {
      const tag = ["LOG", "WARN", "ERR"][level] ?? "LOG";
      console.log(`[renderer:${tag}] ${message}`);
    });
  }

  // grant only camera permission (needed for QR scanning)
  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      callback(permission === "media");
    },
  );

  // allow only media permission checks
  mainWindow.webContents.session.setPermissionCheckHandler(
    (_webContents, permission) => {
      return permission === "media";
    },
  );

  // allow device enumeration (needed for getUserMedia on some Electron versions)
  // device permission handler covers HID/serial/USB — not camera (camera is
  // handled by the permission request handler above). grant none of these.
  mainWindow.webContents.session.setDevicePermissionHandler(() => false);

  // in dev, load from webpack dev server; in prod, load the built HTML
  if (process.env.ELECTRON_DEV_URL) {
    mainWindow.loadURL(process.env.ELECTRON_DEV_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../web/dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// -- IPC handlers --

function registerIpcHandlers(): void {
  // ws server control
  ipcMain.handle("ws:start", async (_event, port: number) => {
    if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("invalid port — must be integer 1-65535");
    }
    const address = await wsServer.start(port, {
      onConnection: () => {
        mainWindow?.webContents.send("ws:connection");
      },
      onMessage: (data: Buffer) => {
        // encode binary data as base64 for IPC transport
        const encoded = data.toString("base64");
        mainWindow?.webContents.send("ws:message", encoded);
      },
      onClose: () => {
        mainWindow?.webContents.send("ws:close");
      },
    });
    return address;
  });

  ipcMain.handle("ws:stop", async () => {
    await wsServer.stop();
  });

  ipcMain.handle("ws:send", async (_event, data: string) => {
    if (typeof data !== "string" || data.length === 0) {
      throw new Error("invalid data — must be non-empty base64 string");
    }
    const bytes = Buffer.from(data, "base64");
    wsServer.send(bytes);
  });

  // clipboard
  ipcMain.on("clipboard:copy", (_event, text: string) => {
    if (typeof text !== "string" || text.length > 1_048_576) return;
    clipboard.writeText(text);
  });

  // network
  ipcMain.handle("net:get-local-ip", () => {
    const ip = getLanIp();
    if (!ip) throw new Error("failed to detect LAN IP address");
    return ip;
  });
}

// -- app lifecycle --

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", async () => {
  await wsServer.stop();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
