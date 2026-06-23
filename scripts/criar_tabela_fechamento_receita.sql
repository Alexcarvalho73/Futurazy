-- =============================================================================
-- SCRIPT DDL: FECHAMENTO_RECEITA
-- Executar com usuário que tenha permissão DDL no schema SYS_READ (ou schema destino)
-- =============================================================================

-- Criar a tabela principal de fechamentos mensais de receita
CREATE TABLE FECHAMENTO_RECEITA (
  FR_ID              NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  FR_EMPRESA         VARCHAR2(10)    NOT NULL,   -- Filial ex: '028501'
  FR_ANO             NUMBER(4)       NOT NULL,   -- Ano ex: 2026
  FR_MES             NUMBER(2)       NOT NULL,   -- Mês 1-12
  FR_RUBRICA         VARCHAR2(50)    DEFAULT 'RECEITA' NOT NULL, -- Para expansão futura
  FR_RECEITA_TOTAL   NUMBER(18,2),               -- Soma de (d2_total + d2_valfre) e d1_total
  FR_SACAS           NUMBER(18,4),               -- Total de sacas (Quant/60)
  FR_QTD_NFS         NUMBER(10),                 -- Qtd de NFs distintas
  FR_FUNRURAL        NUMBER(18,2),               -- Soma vl_funrural (F2_CONTSOC / F1_CONTSOC)
  FR_FETHAB          NUMBER(18,2),               -- Soma Vlr_Fethab (F2_VALFET / D1_VALFET)
  FR_VLR_FACS        NUMBER(18,2),               -- Soma Vlr_Facs (F2_VALFAC / D1_VALFAC)
  FR_AGRO_RECEITA    NUMBER(18,2),               -- Receita Agricultura (B1_GRUPO = '0402008')
  FR_AGRO_SACAS      NUMBER(18,4),
  FR_PEC_RECEITA     NUMBER(18,2),               -- Receita Pecuária (B1_GRUPO = '0203003')
  FR_PEC_SACAS       NUMBER(18,4),
  FR_OUTROS_RECEITA  NUMBER(18,2),               -- Receita Outros grupos
  FR_OUTROS_SACAS    NUMBER(18,4),
  FR_DT_FECHAMENTO   DATE            NOT NULL,   -- Data/hora do fechamento
  FR_USUARIO         VARCHAR2(50),               -- Usuário que realizou o fechamento
  FR_OBS             VARCHAR2(500),              -- Observações opcionais
  CONSTRAINT UK_FECH_REC UNIQUE (FR_EMPRESA, FR_ANO, FR_MES, FR_RUBRICA)
);

-- Índices para performance
CREATE INDEX IDX_FECH_REC_ANO_MES ON FECHAMENTO_RECEITA (FR_ANO, FR_MES);
CREATE INDEX IDX_FECH_REC_EMPRESA ON FECHAMENTO_RECEITA (FR_EMPRESA);

-- Comentários das colunas
COMMENT ON TABLE FECHAMENTO_RECEITA IS 'Tabela de fechamentos mensais de receita - Sistema FuturazBI';
COMMENT ON COLUMN FECHAMENTO_RECEITA.FR_EMPRESA IS 'Código da filial Protheus (ex: 028501)';
COMMENT ON COLUMN FECHAMENTO_RECEITA.FR_ANO IS 'Ano de referência do fechamento';
COMMENT ON COLUMN FECHAMENTO_RECEITA.FR_MES IS 'Mês de referência do fechamento (1=Jan, 12=Dez)';
COMMENT ON COLUMN FECHAMENTO_RECEITA.FR_RUBRICA IS 'Rubrica do fechamento (padrão RECEITA)';
COMMENT ON COLUMN FECHAMENTO_RECEITA.FR_RECEITA_TOTAL IS 'Soma total de receita bruta do período';
COMMENT ON COLUMN FECHAMENTO_RECEITA.FR_SACAS IS 'Total de sacas (Quant/60)';
COMMENT ON COLUMN FECHAMENTO_RECEITA.FR_QTD_NFS IS 'Quantidade de notas fiscais distintas';
COMMENT ON COLUMN FECHAMENTO_RECEITA.FR_FUNRURAL IS 'Soma do FUNRURAL (F2_CONTSOC)';
COMMENT ON COLUMN FECHAMENTO_RECEITA.FR_FETHAB IS 'Soma do FETHAB (F2_VALFET)';
COMMENT ON COLUMN FECHAMENTO_RECEITA.FR_VLR_FACS IS 'Soma do valor FACS (F2_VALFAC)';
COMMENT ON COLUMN FECHAMENTO_RECEITA.FR_DT_FECHAMENTO IS 'Data e hora em que o fechamento foi gravado';
COMMENT ON COLUMN FECHAMENTO_RECEITA.FR_USUARIO IS 'Usuário que executou o fechamento';

COMMIT;

-- =============================================================================
-- VERIFICAÇÃO: Estrutura criada
-- =============================================================================
SELECT column_name, data_type, data_length, nullable
FROM user_tab_columns
WHERE table_name = 'FECHAMENTO_RECEITA'
ORDER BY column_id;
