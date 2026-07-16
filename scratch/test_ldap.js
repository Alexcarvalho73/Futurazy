const { autenticar } = require('../auth');

async function test() {
  const usuario = 'alexandre.carvalho';
  const senha = 'Agro@2026';
  
  console.log(`Tentando autenticar o usuário: ${usuario}...`);
  try {
    const res = await autenticar(usuario, senha);
    console.log('Resultado completo:', res);
  } catch (err) {
    console.error('Erro capturado no teste:', err);
  }
  process.exit(0);
}

test();
