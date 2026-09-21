
CREATE OR REPLACE FUNCTION public.baixa_estoque_on_comanda_fechada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
  estoque_atual INTEGER;
BEGIN
  IF NEW.status = 'fechada' AND (OLD.status IS DISTINCT FROM 'fechada') THEN
    FOR item IN
      SELECT produto_id, quantidade, nome
      FROM public.comanda_itens
      WHERE comanda_id = NEW.id
        AND tipo = 'produto'
        AND produto_id IS NOT NULL
    LOOP
      -- Check current stock
      SELECT estoque INTO estoque_atual
      FROM public.produtos
      WHERE id = item.produto_id;

      IF estoque_atual < item.quantidade THEN
        RAISE EXCEPTION 'Estoque insuficiente para o produto "%". Disponível: %, Necessário: %', item.nome, estoque_atual, item.quantidade;
      END IF;

      UPDATE public.produtos
      SET estoque = estoque - item.quantidade,
          updated_at = now()
      WHERE id = item.produto_id;

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
