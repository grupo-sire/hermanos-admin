-- Add super_admin role for the platform owner
INSERT INTO public.user_roles (user_id, role)
VALUES ('167b440d-adfe-4bdf-9b1e-dcfb3fd46cb0', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;