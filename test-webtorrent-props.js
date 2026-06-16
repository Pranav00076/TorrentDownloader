const WebTorrent = require('webtorrent');
const client = new WebTorrent();
client.add('magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel', (torrent) => {
  torrent.pause();
  console.log('Keys:', Object.keys(torrent).filter(k => k.includes('paus')));
  client.destroy();
});
