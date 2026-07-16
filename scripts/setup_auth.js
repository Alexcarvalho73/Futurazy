/**
 * Script de criação das tabelas de autenticação e permissões, atualizado para suportar usuários vinculados aos grupos locais.
 */
const db = require('../db');

async function setup() {
  try {
    await db.initialize();
    console.log('Conectado ao banco Oracle. Criando estrutura de autenticação e permissões...\n');

    const sqls = [
      // Tabela de Grupos de Permissão (removido GR_GRUPO_AD)
      `BEGIN
        EXECUTE IMMEDIATE 'CREATE TABLE DF_GRUPOS (
          GR_ID       NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          GR_NOME     VARCHAR2(100) NOT NULL,
          GR_DESCRICAO VARCHAR2(500),
          GR_ATIVO    CHAR(1) DEFAULT ''S'' NOT NULL,
          GR_CREATED_AT DATE DEFAULT SYSDATE
        )';
      EXCEPTION
        WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;`,

      // Tabela de Permissões por Painel
      `BEGIN
        EXECUTE IMMEDIATE 'CREATE TABLE DF_PERMISSOES (
          PM_ID       NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          PM_GRUPO_ID NUMBER NOT NULL,
          PM_PAINEL   VARCHAR2(100) NOT NULL,
          PM_CREATED_AT DATE DEFAULT SYSDATE,
          CONSTRAINT fk_pm_grupo FOREIGN KEY (PM_GRUPO_ID) REFERENCES DF_GRUPOS(GR_ID) ON DELETE CASCADE
        )';
      EXCEPTION
        WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;`,

      // Tabela de Usuários por Grupo (Nova tabela para ligar os usuários aos grupos internos)
      `BEGIN
        EXECUTE IMMEDIATE 'CREATE TABLE DF_GRUPO_USUARIOS (
          GU_ID       NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          GU_GRUPO_ID NUMBER NOT NULL,
          GU_USUARIO  VARCHAR2(100) NOT NULL,
          GU_CREATED_AT DATE DEFAULT SYSDATE,
          CONSTRAINT fk_gu_grupo FOREIGN KEY (GU_GRUPO_ID) REFERENCES DF_GRUPOS(GR_ID) ON DELETE CASCADE,
          CONSTRAINT uq_gu_grupo_user UNIQUE (GU_GRUPO_ID, GU_USUARIO)
        )';
      EXCEPTION
        WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;`,

      // Tabela de Log de Acesso
      `BEGIN
        EXECUTE IMMEDIATE 'CREATE TABLE DF_LOG_ACESSO (
          LA_ID       NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          LA_USUARIO  VARCHAR2(200) NOT NULL,
          LA_NOME     VARCHAR2(300),
          LA_ACAO     VARCHAR2(100) NOT NULL,
          LA_PAINEL   VARCHAR2(100),
          LA_IP       VARCHAR2(50),
          LA_DATA     DATE DEFAULT SYSDATE
        )';
      EXCEPTION
        WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;`,
    ];

    for (const sql of sqls) {
      await db.execute(sql, {}, { autoCommit: true });
    }

    console.log('✅ Tabelas criadas (ou já existentes):');
    console.log('   → DF_GRUPOS');
    console.log('   → DF_PERMISSOES');
    console.log('   → DF_GRUPO_USUARIOS');
    console.log('   → DF_LOG_ACESSO');

    // Tentar adicionar coluna caso a tabela DF_GRUPOS já existisse sem ela ou para remover o que for antigo
    try {
      // Se necessário remover a coluna antiga GR_GRUPO_AD
      await db.execute(`ALTER TABLE DF_GRUPOS DROP COLUMN GR_GRUPO_AD`, {}, { autoCommit: true });
      console.log('   → Coluna antiga GR_GRUPO_AD removida.');
    } catch(e) {}

    // Criar grupo Admin padrão se não existir
    const grupos = await db.execute(`SELECT GR_ID FROM DF_GRUPOS WHERE GR_NOME = 'Admin'`);
    if (grupos.length === 0) {
      await db.execute(
        `INSERT INTO DF_GRUPOS (GR_NOME, GR_DESCRICAO) VALUES (:nome, :descricao)`,
        { nome: 'Admin', descricao: 'Grupo administrador com acesso total ao sistema' },
        { autoCommit: true }
      );

      // Buscar ID do grupo recém criado
      const [adminGrupo] = await db.execute(`SELECT GR_ID FROM DF_GRUPOS WHERE GR_NOME = 'Admin'`);
      const adminId = adminGrupo.GR_ID;

      // Conceder acesso a todos os painéis
      const paineis = ['analise_trato', 'central_xml', 'fechamento_dre', 'fechamento_financeiro', 'fechamento_receita', 'fechamento_insumos', 'fechamento_pecuaria', 'admin_permissoes'];
      for (const painel of paineis) {
        await db.execute(
          `INSERT INTO DF_PERMISSOES (PM_GRUPO_ID, PM_PAINEL) VALUES (:grupoId, :painel)`,
          { grupoId: adminId, painel },
          { autoCommit: true }
        );
      }
      
      // Inserir usuário admin padrão na tabela de relacionamento do grupo Admin
      await db.execute(
        `INSERT INTO DF_GRUPO_USUARIOS (GU_GRUPO_ID, GU_USUARIO) VALUES (:grupoId, :usuario)`,
        { grupoId: adminId, usuario: 'admin' },
        { autoCommit: true }
      );

      console.log('\n✅ Grupo "Admin" criado com acesso a todos os painéis e o usuário "admin" associado.');
    } else {
      console.log('\nℹ️  Grupo "Admin" já existe.');
      
      // Garante que o usuario admin esteja associado ao grupo Admin
      const adminId = grupos[0].GR_ID;
      const associado = await db.execute(`SELECT GU_ID FROM DF_GRUPO_USUARIOS WHERE GU_GRUPO_ID = :adminId AND GU_USUARIO = 'admin'`, { adminId });
      if (associado.length === 0) {
        await db.execute(
          `INSERT INTO DF_GRUPO_USUARIOS (GU_GRUPO_ID, GU_USUARIO) VALUES (:adminId, 'admin')`,
          { adminId },
          { autoCommit: true }
        );
        console.log('✅ Usuário "admin" associado ao grupo Admin.');
      }
    }

    console.log('\n🎉 Setup concluído com sucesso!');
  } catch (e) {
    console.error('\n❌ Erro durante o setup:', e);
  } finally {
    try { await db.close(); } catch (e) {}
    process.exit(0);
  }
}

setup();
