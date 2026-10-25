ALTER TABLE "Transaction" ADD COLUMN "statement_order" INTEGER;
CREATE SEQUENCE "transaction_statement_order_seq" AS INTEGER;

-- Confirmações futuras têm ordem estável mesmo quando feitas em lote ou
-- diretamente pela conciliação/fatura. Não inventa a ordem bancária do legado.
CREATE FUNCTION "assign_transaction_statement_order"() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'COMPLETED' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.statement_order := nextval('transaction_statement_order_seq');
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
      NEW.statement_order := nextval('transaction_statement_order_seq');
    ELSE
      NEW.statement_order := OLD.statement_order;
    END IF;
  ELSE
    NEW.statement_order := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "transaction_statement_order"
BEFORE INSERT OR UPDATE ON "Transaction"
FOR EACH ROW EXECUTE FUNCTION "assign_transaction_statement_order"();

CREATE INDEX "Transaction_statement_order_idx"
ON "Transaction"("financial_institution_id", "effective_date", "statement_order");
