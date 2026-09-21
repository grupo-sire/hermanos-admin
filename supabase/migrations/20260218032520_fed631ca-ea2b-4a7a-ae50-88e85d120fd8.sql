
ALTER TABLE public.whatsapp_conversas 
ADD COLUMN IF NOT EXISTS flow_state jsonb DEFAULT null;

COMMENT ON COLUMN public.whatsapp_conversas.flow_state IS 'Tracks current position in visual chatbot flow: {flow_id, current_node_id}';
