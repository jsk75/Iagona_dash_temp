const http = require('http');

// Test 1: Health check
console.log('Test 1: GET /api/health');
http.get('http://localhost:3001/api/health', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
    console.log('');

    // Test 2: Post a log
    console.log('Test 2: POST /api/logs');
    const payload = JSON.stringify({
      sondeIdx: 0,
      label: 'Sonde1',
      temp: 25.5,
      date: '27/06/2026',
      heure: '14:30',
      ts: new Date().toISOString()
    });

    const opts = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/logs',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', data);
        console.log('');

        // Test 3: Get all logs
        console.log('Test 3: GET /api/logs');
        http.get('http://localhost:3001/api/logs', (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            console.log('Status:', res.statusCode);
            console.log('Response:', data);
          });
        });
      });
    });

    req.write(payload);
    req.end();
  });
});
