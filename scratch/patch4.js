const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// 1. Insumos: Fixar filtro de datas removendo hasDetailFilter de dinamicos
code = code.replace(
  /if \(isFuturo\) return false;\s*if \(hasDetailFilter\) return true;/g,
  `if (isFuturo) return false;`
);

// 2. Insumos: Remover trava do hasDetailFilter no fallback para fechados
code = code.replace(
  /if \(f && !hasDetailFilter\) {/g,
  `if (f) {`
);

// 3. Receitas: Remover trava do hasDetailFilter no fallback para fechados (keyTodas)
code = code.replace(
  /} else if \(isTodasClosed && !hasDetailFilter\) {/g,
  `} else if (isTodasClosed) {`
);

// Ensure it replaced both occurrences for hasDetailFilter in dinamicos
// One is in insumos (dinamicos) and one is in receita (dinâmicos).

fs.writeFileSync('server.js', code, 'utf8');
console.log('Filtros corrigidos no server.js');
