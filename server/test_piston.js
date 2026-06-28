const https = require('https');
const data = JSON.stringify({
  language: 'c++',
  version: '*',
  files: [{ content: 'int main(){ return 0; }' }]
});
const req = https.request({
  hostname: 'emkc.org',
  port: 443,
  path: '/api/v2/piston/execute',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'User-Agent': 'CoCode-Execution-Proxy/1.0'
  }
}, res => {
  let str = '';
  res.on('data', c => str += c);
  res.on('end', () => console.log('STATUS:', res.statusCode, 'DATA:', str));
});
req.on('error', e => console.error('ERROR:', e.message));
req.setTimeout(5000, () => { console.log('TIMEOUT'); req.destroy(); });
req.write(data);
req.end();