-- ============================================================
-- DDL: Tabela FECHAMENTO_INSUMOS
-- Estrutura ATUAL no Oracle (apos ALTER TABLE aplicado em 02/07/2026)
-- ============================================================

CREATE TABLE FECHAMENTO_INSUMOS (
  FI_ID             NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  FI_EMPRESA        VARCHAR2(10)  NOT NULL,   -- '028501','028503','TODAS'
  FI_ANO            NUMBER(4)     NOT NULL,
  FI_MES            NUMBER(2)     NOT NULL,
  FI_TIPO_INSUMO    VARCHAR2(20),             -- 'DEFENSIVO','FERTILIZANTE','SEMENTE','OUTROS','TOTAL'
  FI_CUSTO_TOTAL    NUMBER(18,2)  DEFAULT 0,  -- Custo total BRL = SUM(consumo x VLR_RS)
  FI_PTAX           NUMBER(10,4)  DEFAULT 0,  -- PTAX medio ponderado (R$/US$)
  FI_DT_FECHAMENTO  DATE          DEFAULT SYSDATE,
  FI_USUARIO        VARCHAR2(50),
  FI_OBS            VARCHAR2(500),
  CONSTRAINT UK_FI_EMP_ANO_MES_TIPO UNIQUE (FI_EMPRESA, FI_ANO, FI_MES, FI_TIPO_INSUMO)
);

-- Indices para performance
CREATE INDEX IDX_FI_ANO_MES      ON FECHAMENTO_INSUMOS (FI_ANO, FI_MES);
CREATE INDEX IDX_FI_EMPRESA      ON FECHAMENTO_INSUMOS (FI_EMPRESA);
CREATE INDEX IDX_FI_TIPO_INSUMO  ON FECHAMENTO_INSUMOS (FI_TIPO_INSUMO);

-- Comentarios
COMMENT ON TABLE  FECHAMENTO_INSUMOS               IS 'Fechamento mensal de custos com insumos agricolas';
COMMENT ON COLUMN FECHAMENTO_INSUMOS.FI_CUSTO_TOTAL IS 'Custo total BRL = SUM(consumo x VLR_RS)';
COMMENT ON COLUMN FECHAMENTO_INSUMOS.FI_PTAX        IS 'PTAX medio ponderado. USD = FI_CUSTO_TOTAL / FI_PTAX';

-- Logica VLR_RS (calculado no SQL de insumos):
--   za5_moeda = '1' (Real)  => VLR_RS = za5_vcompr
--   za5_moeda = '2' (Dolar) => VLR_RS = za5_vcompr * za5_ptax
-- Custo em USD exibido no frontend: FI_CUSTO_TOTAL / FI_PTAX

COMMIT;
