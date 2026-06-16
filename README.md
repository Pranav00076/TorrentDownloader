# WebTorrent Desktop Downloader

A modern, highly-stable Desktop WebTorrent client built from scratch using React 19, TypeScript, Electron, and Node.js. 

This application provides an elegant, dark-themed UI with real-time peer diagnostics, automatic session recovery, and a custom-engineered pause/resume system for reliable Peer-to-Peer file downloads.

## 🚀 Key Features

* **Real-Time Peer Diagnostics:** Live dashboard showing download/upload speeds, active connection wires, peer IP addresses, and connected client versions.
* **Automatic State Recovery:** Session persistence utilizing JSON serialization (`torrents.json`) ensures that if the app is restarted, downloads resume precisely where they left off without losing any downloaded pieces.
* **Custom Engine Stabilization:** Built on top of a highly stable legacy WebTorrent engine (`v2.8.5`) to maximize bandwidth and prevent event-loop crashing.
* **Graceful Pause/Resume:** Custom backend logic gracefully halts peer discovery and drops active sockets without corrupting the file chunk array.
* **Granular Progress Tracking:** Visual progress bars track the entire torrent as well as the individual files within multi-file torrents.
* **Optimistic UI Updates:** The React frontend updates instantaneously on user actions (like Pause/Delete) while the Express backend asynchronously manages the TCP/UDP swarm connections in the background.

## 🛠 Tech Stack

* **Frontend:** React 19, Tailwind CSS v4, Lucide Icons, Framer Motion
* **Backend:** Node.js, Express, WebTorrent (`v2.8.5`)
* **Desktop Wrapper:** Electron + Electron Builder
* **Language:** Strict TypeScript

## ⚙️ Installation & Usage

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Pranav00076/TorrentDownloader.git
   cd TorrentDownloader
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the development server (Web Version):**
   ```bash
   npm run dev
   ```
   This will start the Express backend and Vite frontend on `http://localhost:8087`.

4. **Run the Desktop App (Electron):**
   ```bash
   npm run electron:dev
   ```

## 🏗 Project Structure

* `/src`: React frontend components (`App.tsx`, `index.css`)
* `/server.ts`: The core Express backend managing the WebTorrent engine and REST API.
* `/electron`: Main process scripts for the Electron wrapper.
* `/downloads`: Default directory where completed torrent files are saved.

## 💡 What Was Learned

Building a stable P2P client requires more than just REST APIs. It involves handling unpredictable external swarms, preventing filesystem race conditions, gracefully managing asynchronous chunk processing, and deeply debugging open-source engine internals to maintain a reliable connection pool.
