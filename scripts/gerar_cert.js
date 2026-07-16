const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const certDir = path.join(__dirname, '..', 'certs');
const keyPath = path.join(certDir, 'server.key');
const certPath = path.join(certDir, 'server.crt');

if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });

console.log('Instalando dependência selfsigned...');
execSync('npm install selfsigned --no-save', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

const selfsigned = require('selfsigned');

async function generate() {
  const attrs = [
    { name: 'commonName', value: 'localhost' },
    { name: 'organizationName', value: 'FuturazyBI' },
    { name: 'countryName', value: 'BR' }
  ];

  const pems = await selfsigned.generate(attrs, {
    days: 3650,
    algorithm: 'sha256'
  });

  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);

  console.log('\n✅ Certificado SSL autoassinado gerado com sucesso!');
  console.log('   → certs/server.key');
  console.log('   → certs/server.crt');
  console.log('\n⚠️  Ao abrir o browser pela primeira vez, clique em "Avançado" > "Continuar mesmo assim".');
}

generate().catch(e => { console.error('Erro:', e); process.exit(1); });
