const net = require('net');

function isPrivateOrLocal(address) {
  const ip = String(address || '').replace(/^::ffff:/, '');
  if (net.isIP(ip) === 6) return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb');
  if (net.isIP(ip) !== 4) return false;
  const parts = ip.split('.').map(Number);
  return parts[0] === 10 || parts[0] === 127 || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31);
}

function getClientIp(req) {
  const socketIp = req.socket?.remoteAddress || req.ip || '';
  // Only trust proxy headers when the origin is deliberately hidden behind
  // Cloudflare Tunnel/reverse proxy. Otherwise these headers are spoofable.
  if (process.env.TRUST_PROXY_HEADERS === 'true' && isPrivateOrLocal(socketIp)) {
    const cloudflareIp = req.headers['cf-connecting-ip'];
    if (cloudflareIp && net.isIP(cloudflareIp)) return cloudflareIp;
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (net.isIP(forwarded)) return forwarded;
  }
  return String(socketIp).replace(/^::ffff:/, '') || 'unknown';
}

module.exports = { getClientIp };
