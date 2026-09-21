
-- Create trigger to update client visits when comanda is closed
CREATE OR REPLACE FUNCTION public.update_client_visits_on_comanda_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'fechada' AND (OLD.status IS DISTINCT FROM 'fechada') THEN
    UPDATE public.clientes
    SET 
      total_visitas = COALESCE(total_visitas, 0) + 1,
      ultima_visita = NOW(),
      updated_at = NOW()
    WHERE id = NEW.cliente_id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER update_client_visits_on_comanda_close
BEFORE UPDATE ON public.comandas
FOR EACH ROW
EXECUTE FUNCTION public.update_client_visits_on_comanda_close();
