# BitTorrent Client Architecture (Go & Wails)

## 1. Project Overview
A production-quality, cross-platform BitTorrent client built with Go and Wails, featuring a modern uTorrent-inspired UI. The application is designed to be highly modular, heavily tested, and conformant with official BitTorrent protocols (BEPs).

## 2. Environment Considerations & Constraints
*Note: This architecture is designed for a local desktop environment bridging Go and a frontend via Wails or Electron.* 
*(Platform limitation notice: The current AI Studio environment runs restricted, sandboxed Node.js/TypeScript environments that only expose port 3000 over an HTTP proxy. While we will document the Go backend here as requested, any executable code generated within this workspace will be limited to web technologies like TypeScript and WebTorrent. We can implement a fully robust React UI for the client here, but a local Go backend must be run natively on your machine).*

## 3. High-Level Architecture Design
The architecture is separated into three primary tiers:
1.  **Frontend (UI)**: Built in React/TypeScript. Communicates with Go via Wails IPC (Inter-Process Communication).
2.  **Go Application Layer**: Acts as the coordinator. Handles UI commands, configuration, database state (persistence), and orchestrating the networking core.
3.  **BitTorrent Engine Core (Go)**: A heavily decoupled set of packages responsible for P2P networking, Bencode parsing, hashing, disk I/O, and peer management.

## 4. Module Design & Responsibilities

### Core Modules (Go Engine)
- `/internal/bencode`: Bencode parser and serializer. Cleanly marshal/unmarshal `.torrent` files and tracker responses.
- `/internal/metainfo`: Parses and validates decoded `.torrent` files. Extracts infohashes, piece lengths, and announces.
- `/internal/tracker`: Handles HTTP and UDP tracker communications. Emits discovered peer IPs back to the coordinator.
- `/internal/p2p`: The heart of the implementation. Handles TCP dialing, handshakes, `Choke`, `Unchoke`, `Interested`, and `Bitfield` messages.
- `/internal/piece`: Manages piece validation (SHA-1 hashing), maintains the piece selection strategy (e.g., rarest-first), and splits pieces into blocks suitable for network transport.
- `/internal/disk`: Disk I/O module. Responsible for pre-allocating files, seeking, reading, and writing verified blocks to the filesystem. 
- `/internal/bandwidth`: Configurable token-bucket rate limiter to enforce upload/download speed limits globally and per-peer.

### Advanced Feature Modules
- `/internal/dht`: Mainline DHT (Kademlia) implementation for trackerless peer discovery.
- `/internal/pex`: Peer Exchange module (implemented as an extension protocol).
- `/internal/crypto`: MSE/PE (Message Stream Encryption / Protocol Encryption) implementations.
- `/internal/upnp`: Automated NAT traversal map via UPnP and NAT-PMP.

### Application Modules
- `/internal/config`: YAML/JSON based application properties (download paths, ports, limits).
- `/internal/state`: SQLite or BadgerDB to persist session states, progress, and historical stats.
- `/frontend`: The UI application codebase.

## 5. Milestone Roadmap

### Milestone 1: Foundation & Metainfo Parsing
- Implement Bencode decoder and encoder.
- Implement `.torrent` file parsing (extracting Tracker URL, InfoHash, Piece Hashes, File structures).
- Establish the Go/Wails basic folder structure and logging (using `slog` or `zap`).

### Milestone 2: Trackers & Peer Discovery
- Implement HTTP Tracker client to retrieve Peer List.
- Implement UDP Tracker protocol.
- Create concurrency structures (channels/workers) to ping trackers periodically.

### Milestone 3: The P2P Protocol (Handshake & State)
- Establish TCP connections with discovered peers.
- Implement the protocol handshake mechanism.
- Implement message serialization/deserialization for all standard BEP-3 messages (Keep-Alive, Choke, Unchoke, Interested, Not Interested, Have, Bitfield, Request, Piece, Cancel).

### Milestone 4: Downloader Engine & Disk I/O
- Implement the Piece Selection algorithm (Rarest-First).
- Implement Disk I/O: pre-allocate multiline/single files, write blocks, and compute SHA-1 hashes of completed pieces.
- Integrate the piece manager to distribute requests to active, unchoked peers.

### Milestone 5: Uploading & Seeding
- Implement peer choking/unchoking algorithms based on reciprocity (Tit-for-Tat).
- Serve piece requests from the Disk module up to the network.

### Milestone 6: Application Layer & Persistence
- Build the Job Manager (managing multiple torrents at once).
- Implement session saving: tracking progress across application restarts.
- Bandwidth shaping layer to enforce limits.

### Milestone 7: The UI Implementation
- Design the React frontend mimicking uTorrent.
- Expose Go methods to Wails (Add Torrent, Pause, Delete, Get Status).
- Implement real-time Wails events to emit speed, ETA, and progress stats to the frontend.

### Milestone 8: Advanced Protocols
- DHT (Distributed Hash Table), PEX (Peer Exchange), UPnP/NAT-PMP, and Magnet Links.

## 6. Target Folder Structure

```text
.
├── cmd/
│   └── torrentapp/
│       └── main.go               # Application entry point
├── build/                        # Packaging assets (icons, manifests)
├── frontend/                     # Wails React/TypeScript UI
│   ├── src/
│   │   ├── components/           # UI elements (Toolbar, TorrentList, Tabs)
│   │   ├── hooks/
│   │   ├── stores/               # Zustand or Context for state
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── internal/
│   ├── bencode/                  # Bencoder parser
│   ├── metainfo/                 # .torrent file struct modeling
│   ├── p2p/                      # Peer connection and message logic
│   ├── tracker/                  # HTTP/UDP announce mechanisms
│   ├── disk/                     # OS File allocation and I/O
│   ├── engine/                   # Main piece scheduler and coordinator
│   ├── ui/                       # Wails Go bindings for UI API
│   └── util/                     # Helpers, logging, hashing
├── .gitignore
├── go.mod
├── go.sum
└── wails.json                    # Wails configuration
```
