const WebTorrent = require('webtorrent');
const client = new WebTorrent();
const t = client.add('magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel');
console.log("infoHash:", t.infoHash);
client.destroy();
