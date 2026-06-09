import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import WebTorrent from "webtorrent";

// The downloaded files will be stored in a 'downloads' folder in the root directory
export const DOWNLOAD_DIR = path.join(process.cwd(), "downloads");
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// Torrent state persistence
export const STATE_FILE = path.join(DOWNLOAD_DIR, "torrents.json");

const client = new WebTorrent();

// Helper to format torrent data for the frontend
const getTorrentData = (t: WebTorrent.Torrent) => {
  return {
    id: t.infoHash,
    name: t.name || "Retrieving Metadata...",
    sizeBytes: t.length || 0,
    progress: t.progress * 100,
    paused: t.paused,
    done: t.done,
    downSpeed: t.downloadSpeed,
    upSpeed: t.uploadSpeed,
    timeRemaining: t.timeRemaining,
    numPeers: t.numPeers,
    downloaded: t.downloaded,
    uploaded: t.uploaded,
    files: t.files ? t.files.map((f: WebTorrent.TorrentFile) => ({
      name: f.name,
      length: f.length,
      downloaded: f.downloaded,
      progress: f.progress * 100
    })) : [],
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

const saveState = () => {
  const torrents = client.torrents.map(t => ({ magnetURI: t.magnetURI }));
  fs.writeFileSync(STATE_FILE, JSON.stringify(torrents));
};

const loadState = () => {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
      if (Array.isArray(data)) {
        data.forEach((t: { magnetURI: string }) => {
          if (t.magnetURI) {
            client.add(t.magnetURI, { path: DOWNLOAD_DIR });
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Restore previous torrents
  loadState();

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "WebTorrent Engine Active" });
  });

  app.get("/api/torrents", (req, res) => {
    const data = {
      downloadSpeed: client.downloadSpeed,
      uploadSpeed: client.uploadSpeed,
      torrents: client.torrents.map(getTorrentData)
    };
    res.json(data);
  });

  app.post("/api/torrents", (req, res) => {
    const { magnetLink } = req.body;
    if (!magnetLink) {
      return res.status(400).json({ error: "No magnet link provided" });
    }

    try {
      // Check if already added
      const existing = client.torrents.find(t => t.magnetURI === magnetLink);
      if (existing) {
        return res.json(getTorrentData(existing));
      }

      client.add(magnetLink, { path: DOWNLOAD_DIR }, (torrent) => {
        saveState();
      });
      res.json({ success: true, message: "Adding torrent..." });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/torrents/:id/pause", (req, res) => {
    const torrent = client.get(req.params.id);
    if (!torrent) return res.status(404).json({ error: "Torrent not found" });
    torrent.pause();
    res.json(getTorrentData(torrent as WebTorrent.Torrent));
  });

  app.post("/api/torrents/:id/resume", (req, res) => {
    const torrent = client.get(req.params.id);
    if (!torrent) return res.status(404).json({ error: "Torrent not found" });
    torrent.resume();
    res.json(getTorrentData(torrent as WebTorrent.Torrent));
  });

  app.delete("/api/torrents/:id", (req, res) => {
    const torrent = client.get(req.params.id);
    if (!torrent) return res.status(404).json({ error: "Torrent not found" });
    torrent.destroy({}, () => {
      saveState();
    });
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
