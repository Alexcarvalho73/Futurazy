const http = require('http');

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/receita/resumo-anual?safra=2025/26',
  method: 'GET'
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json.meses.slice(0, 4), null, 2));
    } catch (e) {
      console.log("Error parsing:", data);
    }
  });
});

req.on('error', e => console.error(e));
req.end();
