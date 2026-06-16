const WebTorrent = require('webtorrent');
const client = new WebTorrent();
const torrent = client.add('magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10');
setTimeout(() => {
  console.log("Before manual pause:", torrent.paused);
  torrent.paused = true;
  if (torrent.discovery) torrent.discovery.stop();
  for (const id in torrent._peers || {}) {
    torrent._peers[id].destroy();
  }
  console.log("After manual pause:", torrent.paused);
  
  setTimeout(() => {
    console.log("1 second later, paused:", torrent.paused);
    client.destroy();
  }, 1000);
}, 2000);
