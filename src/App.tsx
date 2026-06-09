import { useState, useEffect, useRef } from 'react';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

type PeerUI = {
  ip: string;
  client: string;
  downSpeed: string;
  upSpeed: string;
  downloaded: string;
  uploaded: string;
  progress: number;
};

type TorrentUI = {
  id: string;
  name: string;
  size: string;
  sizeBytes: number;
  progress: number;
  status: 'Downloading' | 'Seeding' | 'Paused' | 'Metadata';
  downSpeed: string;
  upSpeed: string;
  eta: string;
  peers: number;
  seeds: number;
  downloaded: string;
  uploaded: string;
  files: { name: string; length: number; downloaded: number; progress: number }[];
  peerList: PeerUI[];
  _torrent: any;
};

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) return '🎬';
  if (['mp3', 'wav', 'flac', 'ogg', 'm4a'].includes(ext)) return '🎵';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️';
  if (['txt', 'md', 'pdf', 'doc', 'docx'].includes(ext)) return '📄';
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) return '📦';
  if (['iso', 'img'].includes(ext)) return '💿';
  return '📁';
}

function formatBytes(b: number) {
  if (b === 0) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTime(ms: number) {
  if (!ms || ms === Infinity || isNaN(ms)) return '-';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m === 0) return `${s}s`;
  const h = Math.floor(m / 60);
  if (h === 0) return `${m}m ${s % 60}s`;
  return `${h}h ${m % 60}m`;
}

export default function App() {
  const [torrents, setTorrents] = useState<TorrentUI[]>([]);
  const [selectedTorrentId, setSelectedTorrentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'General' | 'Peers' | 'Files'>('General');
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, torrentId: string | null }>({ x: 0, y: 0, torrentId: null });
  
  const [backendStatus, setBackendStatus] = useState<'Connecting...' | 'WebTorrent Engine Active' | 'WebTorrent Engine Failed'>('Connecting...');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [magnetLink, setMagnetLink] = useState('');

  // Total speeds for footer
  const [totalDown, setTotalDown] = useState(0);
  const [totalUp, setTotalUp] = useState(0);

  // Initialize and Sync with Backend API
  useEffect(() => {
    let intervalId: any;

    const fetchHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) setBackendStatus('WebTorrent Engine Active');
        else setBackendStatus('WebTorrent Engine Failed');
      } catch (e) {
        setBackendStatus('WebTorrent Engine Failed');
      }
    };

    const fetchTorrents = async () => {
      try {
        const res = await fetch('/api/torrents');
        if (res.ok) {
          const data = await res.json();
          setTotalDown(data.downloadSpeed);
          setTotalUp(data.uploadSpeed);
          
          const uiTorrents = data.torrents.map((t: any) => ({
            id: t.id,
            name: t.name,
            size: t.sizeBytes ? formatBytes(t.sizeBytes) : '-',
            sizeBytes: t.sizeBytes,
            progress: t.progress,
            status: t.paused ? 'Paused' : t.done ? 'Seeding' : t.name !== 'Retrieving Metadata...' ? 'Downloading' : 'Metadata',
            downSpeed: formatBytes(t.downSpeed) + '/s',
            upSpeed: formatBytes(t.upSpeed) + '/s',
            eta: formatTime(t.timeRemaining),
            peers: t.numPeers,
            seeds: t.numPeers, 
            downloaded: formatBytes(t.downloaded),
            uploaded: formatBytes(t.uploaded),
            files: t.files,
            peerList: t.wires,
            _torrent: t // we keep it for reference but won't call methods on it directly
          }));
          
          setTorrents(uiTorrents);
        }
      } catch (e) {
        console.error("Failed to fetch torrents:", e);
      }
    };

    fetchHealth();
    fetchTorrents();
    
    intervalId = setInterval(() => {
      fetchTorrents();
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(prev => ({ ...prev, torrentId: null }));
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleAddMagnet = async () => {
    if (!magnetLink.trim()) return;
    
    let finalMagnet = magnetLink.trim();
    
    try {
      await fetch('/api/torrents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ magnetLink: finalMagnet })
      });
    } catch (e) {
      console.error("Failed to add torrent:", e);
    }

    setMagnetLink('');
    setIsAddModalOpen(false);
  };

  const selectedTorrent = torrents.find(t => t.id === selectedTorrentId) || torrents[0];

  const handleStart = async () => {
    if (selectedTorrent) {
      await fetch(`/api/torrents/${selectedTorrent.id}/resume`, { method: 'POST' });
    }
  };

  const handlePause = async () => {
    if (selectedTorrent) {
      await fetch(`/api/torrents/${selectedTorrent.id}/pause`, { method: 'POST' });
    }
  };

  const handleRemove = async () => {
    if (selectedTorrent) {
      await fetch(`/api/torrents/${selectedTorrent.id}`, { method: 'DELETE' });
      setSelectedTorrentId(null);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setSelectedTorrentId(id);
    setContextMenu({ x: e.clientX, y: e.clientY, torrentId: id });
  };

  const handleContextAction = async (action: 'pause' | 'resume' | 'remove' | 'copyHash') => {
    if (!contextMenu.torrentId) return;
    const t = torrents.find(t => t.id === contextMenu.torrentId);
    if (!t) return;

    if (action === 'pause') {
      await fetch(`/api/torrents/${t.id}/pause`, { method: 'POST' });
    } else if (action === 'resume') {
      await fetch(`/api/torrents/${t.id}/resume`, { method: 'POST' });
    } else if (action === 'remove') {
      await fetch(`/api/torrents/${t.id}`, { method: 'DELETE' });
      if (selectedTorrentId === contextMenu.torrentId) setSelectedTorrentId(null);
    } else if (action === 'copyHash') {
      navigator.clipboard.writeText(t.id);
    }
    
    setContextMenu(prev => ({ ...prev, torrentId: null }));
  };

  return (
    <div className="flex flex-col h-screen bg-[#0F1115] text-[#E4E7EB] font-sans">
      {/* Toolbar */}
      <header className="flex items-center px-4 py-2 border-b border-[#2D333B] bg-[#161B22]">
        <div className="flex space-x-4">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex flex-col items-center justify-center p-1 hover:bg-[#2D333B] rounded text-emerald-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            <span className="text-[10px] font-medium text-[#E4E7EB]">Add</span>
          </button>
          <button onClick={handleStart} className="flex flex-col items-center justify-center p-1 hover:bg-[#2D333B] rounded text-sky-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[10px] font-medium text-[#E4E7EB]">Start</span>
          </button>
          <button onClick={handlePause} className="flex flex-col items-center justify-center p-1 hover:bg-[#2D333B] rounded text-[#8B949E]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[10px] font-medium text-[#E4E7EB]">Pause</span>
          </button>
          <button onClick={handleRemove} className="flex flex-col items-center justify-center p-1 hover:bg-[#2D333B] rounded text-rose-500 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="text-[10px] font-medium text-[#E4E7EB]">Remove</span>
          </button>
        </div>
        <div className="ml-auto w-64">
           <input type="text" placeholder="Search torrents..." className="w-full pl-3 pr-3 py-1 text-sm bg-[#0F1115] border border-[#2D333B] rounded focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-[#E4E7EB] placeholder-[#8B949E]" />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-48 border-r border-[#2D333B] bg-[#161B22] overflow-y-auto flex flex-col p-2 space-y-4">
          <div className="py-2">
            <h3 className="px-2 mb-1 text-[10px] uppercase font-bold text-[#8B949E] tracking-wider">Status</h3>
            <ul className="space-y-0.5">
               <li><a href="#" className="flex items-center px-2 py-1.5 rounded bg-[#21262D] text-white text-xs"><span className="mr-2">📁</span> All ({torrents.length})</a></li>
               <li><a href="#" className="flex items-center px-2 py-1.5 rounded text-[#8B949E] hover:bg-[#21262D] text-xs"><span className="mr-2 text-sky-400">⬇</span> Downloading ({torrents.filter(t => t.status === 'Downloading').length})</a></li>
               <li><a href="#" className="flex items-center px-2 py-1.5 rounded text-[#8B949E] hover:bg-[#21262D] text-xs"><span className="mr-2 text-emerald-400">⬆</span> Seeding ({torrents.filter(t => t.status === 'Seeding').length})</a></li>
               <li><a href="#" className="flex items-center px-2 py-1.5 rounded text-[#8B949E] hover:bg-[#21262D] text-xs"><span className="mr-2 text-emerald-500">✔</span> Completed ({torrents.filter(t => t.progress === 100).length})</a></li>
               <li><a href="#" className="flex items-center px-2 py-1.5 rounded text-[#8B949E] hover:bg-[#21262D] text-xs"><span className="mr-2 text-amber-500">⏸</span> Paused ({torrents.filter(t => t.status === 'Paused').length})</a></li>
            </ul>
          </div>
          <div className="py-2 border-t border-[#2D333B]">
            <h3 className="px-2 mb-1 text-[10px] uppercase font-bold text-[#8B949E] tracking-wider">Labels</h3>
            <ul className="space-y-0.5">
               <li><a href="#" className="flex items-center px-2 py-1.5 rounded text-[#8B949E] hover:bg-[#21262D] text-xs"><span className="w-2 h-2 rounded-full bg-rose-400 mr-2"></span> Movies</a></li>
               <li><a href="#" className="flex items-center px-2 py-1.5 rounded text-[#8B949E] hover:bg-[#21262D] text-xs"><span className="w-2 h-2 rounded-full bg-emerald-400 mr-2"></span> Software</a></li>
            </ul>
          </div>
        </aside>

        {/* Main Content Areas */}
        <main className="flex-1 flex flex-col min-w-0">
          
          {/* Torrent List */}
          <div className="flex-1 overflow-auto bg-[#0F1115]">
            <table className="min-w-full text-[11px] text-left table-fixed">
              <thead className="bg-[#161B22] text-[#8B949E] border-b border-[#2D333B] uppercase tracking-tight font-semibold sticky top-0">
                <tr>
                  <th className="p-2 w-1/3">Name</th>
                  <th className="p-2 w-24">Size</th>
                  <th className="p-2 w-32">Done</th>
                  <th className="p-2 w-24">Status</th>
                  <th className="p-2 w-24">Down Speed</th>
                  <th className="p-2 w-24">Up Speed</th>
                  <th className="p-2 w-20">ETA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2D333B]">
                {torrents.map((t) => (
                  <tr 
                    key={t.id} 
                    onClick={() => setSelectedTorrentId(t.id)}
                    onContextMenu={(e) => handleContextMenu(e, t.id)}
                    className={`${selectedTorrentId === t.id ? 'bg-[#21262D]' : 'bg-[#0F1115] hover:bg-[#1C2128]'} text-white cursor-pointer select-none`}
                  >
                    <td className="p-2 font-medium truncate flex items-center"><span className="mr-2">📄</span> {t.name}</td>
                    <td className="p-2 text-[#8B949E]">{t.size}</td>
                    <td className="p-2">
                      <div className="flex flex-col space-y-1">
                        <div className={`flex justify-between text-[10px] ${t.status === 'Seeding' ? 'text-emerald-400' : t.status === 'Paused' ? 'text-amber-400' : 'text-sky-400'}`}><span>{t.progress.toFixed(1)}%</span></div>
                        <div className={`w-full bg-[#2D333B] h-1.5 rounded-sm overflow-hidden ${t.status === 'Paused' ? 'opacity-50' : ''}`}>
                          <div className={`h-full ${t.status === 'Seeding' ? 'bg-emerald-500' : t.status === 'Paused' ? 'bg-amber-500' : 'bg-sky-500'}`} style={{ width: `${Math.max(t.progress, 0)}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className={`p-2 ${t.status === 'Seeding' ? 'text-emerald-400' : t.status === 'Paused' ? 'text-amber-500' : 'text-sky-400'}`}>{t.status}</td>
                    <td className={`p-2 font-mono ${t.status === 'Seeding' || t.status === 'Paused' ? 'text-[#8B949E]' : 'text-sky-400'}`}>{t.status === 'Paused' ? '-' : t.downSpeed}</td>
                    <td className={`p-2 font-mono ${t.status === 'Seeding' ? 'text-emerald-400' : 'text-[#8B949E]'}`}>{t.status === 'Paused' ? '-' : t.upSpeed}</td>
                    <td className="p-2 text-[#8B949E]">{t.status === 'Paused' ? '-' : t.eta}</td>
                  </tr>
                ))}
                {torrents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#8B949E] italic">
                      No torrents active. Click the "Add" button to download a magnet link.
                      <div className="mt-2 text-xs">Try: <span className="text-sky-400 font-mono">magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel</span></div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Panel (Details) */}
          <div className="h-64 border-t border-[#2D333B] bg-[#0D1117] flex flex-col">
            <div className="flex border-b border-[#2D333B] px-4 space-x-6 overflow-x-auto text-[10px] uppercase font-bold">
              <button 
                onClick={() => setActiveTab('General')}
                className={`py-2 whitespace-nowrap ${activeTab === 'General' ? 'text-sky-400 border-b border-sky-400' : 'text-[#8B949E] hover:text-white'}`}>
                General
              </button>
              <button 
                onClick={() => setActiveTab('Peers')}
                className={`py-2 whitespace-nowrap ${activeTab === 'Peers' ? 'text-sky-400 border-b border-sky-400' : 'text-[#8B949E] hover:text-white'}`}>
                Peers ({selectedTorrent?.peers || 0})
              </button>
              <button 
                onClick={() => setActiveTab('Files')}
                className={`py-2 whitespace-nowrap ${activeTab === 'Files' ? 'text-sky-400 border-b border-sky-400' : 'text-[#8B949E] hover:text-white'}`}>
                Files ({selectedTorrent?.files.length || 0})
              </button>
            </div>
            
            <div className="flex-1 p-4 grid grid-cols-2 gap-4 text-[11px] overflow-y-auto">
              {!selectedTorrent && (
                <div className="col-span-2 flex items-center justify-center text-[#8B949E] italic h-full">
                  Select a torrent to view details
                </div>
              )}
              
              {selectedTorrent && activeTab === 'General' && (
                <>
                  <div>
                    <div className="grid grid-cols-[100px_1fr] gap-1 mb-1">
                      <span className="text-[#8B949E] text-right pr-2">Save As:</span>
                      <span className="text-white truncate">Disk Persistence (Server)</span>
                    </div>
                    <div className="grid grid-cols-[100px_1fr] gap-1 mb-1">
                      <span className="text-[#8B949E] text-right pr-2">Total Size:</span>
                      <span className="text-white">{selectedTorrent.size}</span>
                    </div>
                    <div className="grid grid-cols-[100px_1fr] gap-1 mb-1">
                      <span className="text-[#8B949E] text-right pr-2">Status:</span>
                      <span className="text-white">{selectedTorrent.status} ({Math.round(selectedTorrent.progress)}%)</span>
                    </div>
                    <div className="grid grid-cols-[100px_1fr] gap-1">
                      <span className="text-[#8B949E] text-right pr-2">Hash (BTIH):</span>
                      <span className="text-white font-mono uppercase truncate" title={selectedTorrent.id}>{selectedTorrent.id}</span>
                    </div>
                  </div>
                  <div>
                    <div className="grid grid-cols-[100px_1fr] gap-1 mb-1">
                      <span className="text-[#8B949E] text-right pr-2">Downloaded:</span>
                      <span className="text-white font-mono">{selectedTorrent.downloaded}</span>
                    </div>
                    <div className="grid grid-cols-[100px_1fr] gap-1 mb-1">
                      <span className="text-[#8B949E] text-right pr-2">Uploaded:</span>
                      <span className="text-white font-mono">{selectedTorrent.uploaded}</span>
                    </div>
                    <div className="grid grid-cols-[100px_1fr] gap-1 mb-1">
                      <span className="text-[#8B949E] text-right pr-2">Shares:</span>
                      <span className="text-white">Ratio {(t => t.uploaded / Math.max(t.downloaded, 1))(selectedTorrent._torrent || {uploaded: 0, downloaded: 1}).toFixed(3)}</span>
                    </div>
                    <div className="grid grid-cols-[100px_1fr] gap-1">
                      <span className="text-[#8B949E] text-right pr-2">Connected:</span>
                      <span className="text-white">{selectedTorrent.peers} nodes</span>
                    </div>
                  </div>
                </>
              )}

              {selectedTorrent && activeTab === 'Files' && (
                <div className="col-span-2 overflow-auto h-full pr-2">
                  <table className="min-w-full text-left table-fixed">
                    <thead className="text-[#8B949E] sticky top-0 bg-[#0D1117] uppercase tracking-tight font-semibold pb-2">
                      <tr>
                        <th className="p-1 pb-2 w-1/2">File</th>
                        <th className="p-1 pb-2 w-24">Size</th>
                        <th className="p-1 pb-2 w-32">Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2D333B]">
                      {selectedTorrent.files.map((f, i) => (
                        <tr key={i} className="hover:bg-[#1C2128]">
                          <td className="p-1 font-medium truncate text-white" title={f.name}>
                            <span className="mr-2">{getFileIcon(f.name)}</span>
                            {f.name}
                          </td>
                          <td className="p-1 text-[#8B949E]">{formatBytes(f.length)}</td>
                          <td className="p-1">
                            <div className="flex flex-col space-y-1">
                              <div className="flex justify-between text-[10px] text-sky-400"><span>{f.progress.toFixed(1)}%</span></div>
                              <div className="w-full bg-[#2D333B] h-1.5 rounded-sm overflow-hidden">
                                <div className="bg-sky-500 h-full" style={{ width: `${Math.max(f.progress, 0)}%` }}></div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {selectedTorrent && activeTab === 'Peers' && (
                <div className="col-span-2 overflow-auto h-full pr-2">
                  <table className="min-w-full text-left table-fixed">
                     <thead className="text-[#8B949E] sticky top-0 bg-[#0D1117] uppercase tracking-tight font-semibold pb-2">
                      <tr>
                        <th className="p-1 pb-2 w-1/3">IP Address</th>
                        <th className="p-1 pb-2 w-1/3">Client</th>
                        <th className="p-1 pb-2 w-1/3">Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2D333B]">
                      {selectedTorrent.peerList && selectedTorrent.peerList.map((p, i) => (
                        <tr key={i} className="hover:bg-[#1C2128]">
                          <td className="p-1 font-mono text-[#8B949E]">{p.ip}</td>
                          <td className="p-1 truncate text-white" title={p.client}>{p.client}</td>
                          <td className="p-1">
                            <div className="flex flex-col space-y-1">
                              <div className="flex justify-between text-[10px] text-sky-400"><span>{p.progress.toFixed(1)}%</span></div>
                              <div className="w-full bg-[#2D333B] h-1.5 rounded-sm overflow-hidden">
                                <div className="bg-emerald-500 h-full" style={{ width: `${Math.max(p.progress, 0)}%` }}></div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {(!selectedTorrent.peerList || selectedTorrent.peerList.length === 0) && (
                        <tr>
                          <td colSpan={3} className="p-4 text-center text-[#8B949E] italic">
                            No peers connected.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Status Bar */}
      <footer className="flex items-center justify-between px-3 py-1 bg-[#161B22] border-t border-[#2D333B] text-[10px] text-[#8B949E]">
        <div className="flex items-center space-x-4">
          <div className="flex space-x-2">
            <span>D: <span className="text-sky-400 font-mono">{formatBytes(totalDown)}/s</span></span>
            <span>U: <span className="text-emerald-500 font-mono">{formatBytes(totalUp)}/s</span></span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-[#0F1115] px-2 py-0.5 border border-[#2D333B] rounded-sm">
            <span className={`w-1.5 h-1.5 rounded-full ${backendStatus === 'WebTorrent Engine Active' ? 'bg-emerald-500' : backendStatus === 'Connecting...' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'}`}></span>
            <span className={`font-mono text-[9px] uppercase font-bold tracking-wider ${backendStatus === 'WebTorrent Engine Active' ? 'text-emerald-400' : backendStatus === 'Connecting...' ? 'text-amber-400' : 'text-rose-400'}`}>
              Backend: {backendStatus}
            </span>
          </div>
        </div>
      </footer>

      {/* Context Menu Overlay */}
      {contextMenu.torrentId && (
        <div 
          className="fixed z-50 bg-[#161B22] border border-[#2D333B] rounded shadow-xl py-1 min-w-[160px] text-xs font-semibold text-[#8B949E]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button onClick={() => handleContextAction('resume')} className="w-full text-left px-4 py-2 hover:bg-[#21262D] hover:text-white flex items-center">
            <span className="mr-2 text-sky-400">▶</span> Resume
          </button>
          <button onClick={() => handleContextAction('pause')} className="w-full text-left px-4 py-2 hover:bg-[#21262D] hover:text-white flex items-center">
            <span className="mr-2 text-amber-500">⏸</span> Pause
          </button>
          <div className="my-1 border-t border-[#2D333B]"></div>
          <button onClick={() => handleContextAction('copyHash')} className="w-full text-left px-4 py-2 hover:bg-[#21262D] hover:text-white flex items-center">
            <span className="mr-2 text-[#E4E7EB]">📄</span> Copy Info Hash
          </button>
          <div className="my-1 border-t border-[#2D333B]"></div>
          <button onClick={() => handleContextAction('remove')} className="w-full text-left px-4 py-2 hover:bg-[#21262D] hover:text-rose-500 flex items-center">
            <span className="mr-2 text-rose-500">❌</span> Remove
          </button>
        </div>
      )}

      {/* Add Magnet Modal Overlay */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-[#0F1115]/80 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-[#161B22] border border-[#2D333B] rounded shadow-2xl p-6 w-[500px]">
            <h2 className="text-white text-sm uppercase tracking-wide font-bold mb-4">Add Torrent from Magnet Link</h2>
            <input 
              type="text" 
              value={magnetLink}
              onChange={(e) => setMagnetLink(e.target.value)}
              placeholder="magnet:?xt=urn:btih:..." 
              className="w-full bg-[#0F1115] border border-[#2D333B] rounded py-2 px-3 text-[#E4E7EB] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 mb-6 font-mono text-xs placeholder-[#8B949E]"
              autoFocus
            />
            <div className="flex justify-end space-x-3 text-xs font-medium">
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 rounded text-[#8B949E] hover:text-white hover:bg-[#2D333B] transition-colors uppercase tracking-wide"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddMagnet}
                className="px-4 py-2 rounded bg-sky-600/20 text-sky-400 border border-sky-500/30 hover:bg-sky-600/30 transition-colors uppercase tracking-wide"
              >
                Start Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
