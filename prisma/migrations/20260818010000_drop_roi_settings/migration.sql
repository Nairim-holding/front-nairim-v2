-- Reverte a tabela criada para o módulo ROI (retirado a pedido do usuário
-- logo após a implementação, na mesma sessão). Seguro: a tabela nunca chegou
-- a ser usada em produção — foi criada e imediatamente descartada.

DROP TABLE IF EXISTS "RoiSettings";
