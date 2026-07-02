-- ============================================================
-- DDL: Tabela FECHAMENTO_INSUMOS
-- Executar no Oracle antes de usar o módulo de Insumos
-- ============================================================

CREATE TABLE FECHAMENTO_INSUMOS (
  FI_ID             NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  FI_EMPRESA        VARCHAR2(10)    NOT NULL,   -- '028501','028503','TODAS'
  FI_ANO            NUMBER(4)       NOT NULL,
  FI_MES            NUMBER(2)       NOT NULL,
  FI_TIPO_INSUMO    VARCHAR2(20),               -- 'DEFENSIVO','FERTILIZANTE','SEMENTE','OUTROS','TOTAL'
  FI_CUSTO_TOTAL    NUMBER(18,2)    DEFAULT 0,  -- Custo em BRL (consumo × vlr_brl)
  FI_CUSTO_USD      NUMBER(18,2)    DEFAULT 0,  -- Custo em USD (consumo × vlr_usd)
  FI_DT_FECHAMENTO  DATE            DEFAULT SYSDATE,
  FI_USUARIO        VARCHAR2(50),
  FI_OBS            VARCHAR2(500),
  CONSTRAINT UK_FI_EMP_ANO_MES_TIPO UNIQUE (FI_EMPRESA, FI_ANO, FI_MES, FI_TIPO_INSUMO)
);

-- Índices para performance
CREATE INDEX IDX_FI_ANO_MES      ON FECHAMENTO_INSUMOS (FI_ANO, FI_MES);
CREATE INDEX IDX_FI_EMPRESA      ON FECHAMENTO_INSUMOS (FI_EMPRESA);
CREATE INDEX IDX_FI_TIPO_INSUMO  ON FECHAMENTO_INSUMOS (FI_TIPO_INSUMO);

-- Comentários
COMMENT ON TABLE  FECHAMENTO_INSUMOS               IS 'Fechamento mensal de custos com insumos agrícolas (Defensivos, Fertilizantes, Sementes)';
COMMENT ON COLUMN FECHAMENTO_INSUMOS.FI_EMPRESA    IS 'Filial Protheus: 028501, 028503 ou TODAS';
COMMENT ON COLUMN FECHAMENTO_INSUMOS.FI_TIPO_INSUMO IS 'Tipo de insumo: DEFENSIVO, FERTILIZANTE, SEMENTE, OUTROS, TOTAL';
COMMENT ON COLUMN FECHAMENTO_INSUMOS.FI_CUSTO_TOTAL IS 'Custo total em BRL = SUM(consumo × vlr_brl)';
COMMENT ON COLUMN FECHAMENTO_INSUMOS.FI_CUSTO_USD   IS 'Custo total em USD = SUM(consumo × vlr_usd)';

COMMIT;
