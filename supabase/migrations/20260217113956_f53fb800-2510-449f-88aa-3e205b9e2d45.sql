
-- Add booking state to track the scheduling flow per conversation
ALTER TABLE public.whatsapp_conversas 
ADD COLUMN IF NOT EXISTS booking_state jsonb DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.whatsapp_conversas.booking_state IS 'Tracks chatbot booking flow state: step, selected_service, selected_unit, selected_date, etc.';
