-- Criar função que cria comanda automaticamente quando agendamento é criado
CREATE OR REPLACE FUNCTION public.create_comanda_on_appointment()
RETURNS TRIGGER AS $$
DECLARE
  servico_record RECORD;
  new_comanda_id UUID;
BEGIN
  -- Buscar informações do serviço
  SELECT nome, preco INTO servico_record
  FROM public.servicos
  WHERE id = NEW.servico_id;

  -- Criar a comanda vinculada ao agendamento
  INSERT INTO public.comandas (
    id,
    agendamento_id,
    cliente_id,
    barbeiro_id,
    unidade_id,
    status,
    subtotal,
    desconto,
    total,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    NEW.id,
    NEW.cliente_id,
    NEW.barbeiro_id,
    NEW.unidade_id,
    'aberta',
    NEW.preco,
    0,
    NEW.preco,
    NOW(),
    NOW()
  )
  RETURNING id INTO new_comanda_id;

  -- Adicionar o serviço como primeiro item da comanda
  INSERT INTO public.comanda_itens (
    id,
    comanda_id,
    tipo,
    servico_id,
    nome,
    quantidade,
    preco_unitario,
    subtotal,
    created_at
  ) VALUES (
    gen_random_uuid(),
    new_comanda_id,
    'servico',
    NEW.servico_id,
    COALESCE(servico_record.nome, 'Serviço'),
    1,
    NEW.preco,
    NEW.preco,
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para executar a função após INSERT em agendamentos
DROP TRIGGER IF EXISTS trigger_create_comanda_on_appointment ON public.agendamentos;

CREATE TRIGGER trigger_create_comanda_on_appointment
AFTER INSERT ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION public.create_comanda_on_appointment();