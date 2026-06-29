import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from 'url';
import WebTorrent from "webtorrent";

// The downloaded files will be stored in a 'downloads' folder in the user's Downloads directory
export const DOWNLOAD_DIR = path.join(os.homedir(), "Downloads", "TorrentDownloader");
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// Torrent state persistence
export const STATE_FILE = path.join(DOWNLOAD_DIR, "torrents.json");

const client = new WebTorrent();

// In-memory state tracking all torrents (active and paused)
const torrentRecords: Record<string, any> = {};

// Helper to format torrent data for the frontend
const getTorrentData = (t: WebTorrent.Torrent) => {
  let progress = 0;
  let downloaded = 0;
  let sizeBytes = 0;
  let timeRemaining = 0;
  try { progress = t.progress * 100 || 0; } catch (e) {}
  try { downloaded = t.downloaded || 0; } catch (e) {}
  try { sizeBytes = t.length || 0; } catch (e) {}
  try { timeRemaining = t.timeRemaining || 0; } catch (e) {}

  return {
    id: t.infoHash,
    name: t.name || "Retrieving Metadata...",
    sizeBytes,
    progress,
    paused: false,
    done: t.done,
    downSpeed: t.downloadSpeed || 0,
    upSpeed: t.uploadSpeed || 0,
    timeRemaining,
    numPeers: t.numPeers || 0,
    downloaded,
    uploaded: t.uploaded || 0,
    files: t.files ? t.files.map((f: WebTorrent.TorrentFile) => {
      let fProg = 0, fDown = 0;
      try { fProg = f.progress * 100; fDown = f.downloaded; } catch (e) {}
      return {
        name: f.name,
        length: f.length,
        downloaded: fDown,
        progress: fProg
      };
    }) : [],
    wires: t.wires ? t.wires.map((w: any) => {
      const numPieces = t.pieces ? t.pieces.length : 0;
      let peerProgress = 0;
      if (w.peerPieces && numPieces > 0) {
        let piecesHave = 0;
        for (let i = 0; i < numPieces; i++) {
          if (w.peerPieces.get(i)) piecesHave++;
        }
        peerProgress = (piecesHave / numPieces) * 100;
      }
      return {
        ip: w.remoteAddress || "Unknown",
        client: (w.peerExtendedHandshake && w.peerExtendedHandshake.v) 
                 ? w.peerExtendedHandshake.v.toString() 
                 : "Unknown",
        downSpeed: w.downloadSpeed ? w.downloadSpeed() : 0,
        upSpeed: w.uploadSpeed ? w.uploadSpeed() : 0,
        downloaded: w.downloaded || 0,
        uploaded: w.uploaded || 0,
        progress: peerProgress
      };
    }) : []
  };
};

const syncRecords = () => {
  client.torrents.forEach(t => {
    if (!t.infoHash) return;
    const data = getTorrentData(t);
    torrentRecords[t.infoHash] = {
      ...torrentRecords[t.infoHash],
      ...data,
      magnetURI: t.magnetURI || torrentRecords[t.infoHash]?.magnetURI
    };
  });
};

const saveState = () => {
  syncRecords();
  fs.writeFileSync(STATE_FILE, JSON.stringify(Object.values(torrentRecords)));
};

const loadState = () => {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
      if (Array.isArray(data)) {
        data.forEach(record => {
          if (record.id && record.magnetURI) {
            torrentRecords[record.id] = record;
            if (!record.paused) {
              client.add(record.magnetURI, { path: DOWNLOAD_DIR }, (t) => {
                syncRecords();
              });
            }
          }
        });
      }
    } catch (e) {
      console.error("Failed to load torrent state:", e);
    }
  }
};

client.on("torrent", () => {
  saveState();
});

// Prevent internal WebTorrent errors from crashing the Node.js process
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception from WebTorrent:", err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error("Unhandled Rejection:", reason);
});

async function startServer() {
  const app = express();
  const PORT = 8087;

  app.use(express.json());

  // Restore previous torrents
  loadState();

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "WebTorrent Engine Active" });
  });

  app.get("/api/torrents", (req, res) => {
    syncRecords();
    const data = {
      downloadSpeed: client.downloadSpeed,
      uploadSpeed: client.uploadSpeed,
      torrents: Object.values(torrentRecords)
    };
    res.json(data);
  });

  app.post("/api/torrents", (req, res) => {
    const { magnetLink } = req.body;
    if (!magnetLink) {
      return res.status(400).json({ error: "No magnet link provided" });
    }

    try {
      client.add(magnetLink, { path: DOWNLOAD_DIR }, (torrent) => {
        torrentRecords[torrent.infoHash] = {
          ...getTorrentData(torrent),
          magnetURI: magnetLink
        };
        saveState();
      });
      res.json({ success: true, message: "Adding torrent..." });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/torrents/:id/pause", (req, res) => {
    syncRecords();
    const id = req.params.id;
    const record = torrentRecords[id];
    if (!record) return res.status(404).json({ error: "Torrent not found" });

    record.paused = true;
    record.downSpeed = 0;
    record.upSpeed = 0;
    record.timeRemaining = 0;
    record.numPeers = 0;

    const t = client.get(id);
    if (t) {
      client.remove(id, () => {
        saveState();
      });
    } else {
      saveState();
    }
    
    res.json(record);
  });

  app.post("/api/torrents/:id/resume", (req, res) => {
    const id = req.params.id;
    const record = torrentRecords[id];
    if (!record) return res.status(404).json({ error: "Torrent not found" });

    record.paused = false;
    
    const t = client.get(id);
    if (!t && record.magnetURI) {
      client.add(record.magnetURI, { path: DOWNLOAD_DIR }, () => {
        saveState();
      });
    } else {
      saveState();
    }
    
    res.json(record);
  });

  app.delete("/api/torrents/:id", (req, res) => {
    const id = req.params.id;
    
    if (torrentRecords[id]) {
      delete torrentRecords[id];
    }

    try {
      const t = client.get(id);
      if (t) {
        client.remove(id, () => {
          saveState();
        });
      } else {
        saveState();
      }
      res.json({ success: true });
    } catch (e) {
      // Ignore if not found
      res.json({ success: false });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const distPath = __dirname;
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export { startServer };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}
