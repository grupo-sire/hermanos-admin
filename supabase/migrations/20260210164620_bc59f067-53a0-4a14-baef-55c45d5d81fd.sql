
CREATE OR REPLACE FUNCTION public.baixa_estoque_on_comanda_fechada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
BEGIN
  -- Only run when status changes to 'fechada'
  IF NEW.status = 'fechada' AND (OLD.status IS DISTINCT FROM 'fechada') THEN
    FOR item IN
      SELECT produto_id, quantidade, nome
      FROM public.comanda_itens
      WHERE comanda_id = NEW.id
        AND tipo = 'produto'
        AND produto_id IS NOT NULL
    LOOP
      -- Decrease product stock
      UPDATE public.produtos
      SET estoque = estoque - item.quantidade,
          updated_at = now()
      WHERE id = item.produto_id;

      -- Register stock movement
      INSERT INTO public.estoque_movimentacoes (
        produto_id, tipo, quantidade, observacao, unidade_id, created_at
      ) VALUES (
        item.produto_id,
        'saida',
        item.quantidade,
        'Venda via comanda - ' || COALESCE(item.nome, ''),
        NEW.unidade_id,
        now()
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_baixa_estoque_comanda_fechada
  AFTER UPDATE ON public.comandas
  FOR EACH ROW
  EXECUTE FUNCTION public.baixa_estoque_on_comanda_fechada();
