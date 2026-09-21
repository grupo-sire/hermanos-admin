-- Migration: Add and Seed 7 Official Booksy Links for Barbearia Hermanos
ALTER TABLE public.unidades ADD COLUMN IF NOT EXISTS link_booksy text;

-- Insert or Update units with Booksy links
UPDATE public.unidades SET link_booksy = 'https://bit.ly/3BarbeariaHermanosSantaCecilia' WHERE lower(nome) LIKE '%higien%';
UPDATE public.unidades SET link_booksy = 'https://barbeariahermanosos.booksy.com/' WHERE lower(nome) LIKE '%osasco%';
UPDATE public.unidades SET link_booksy = 'https://barbeariahermanosmooca.booksy.com/' WHERE lower(nome) LIKE '%mooca%';
UPDATE public.unidades SET link_booksy = 'https://hermanostatuape.booksy.com/' WHERE lower(nome) LIKE '%tatuap%';
UPDATE public.unidades SET link_booksy = 'https://bit.ly/AgendaBarbeariaHermanos' WHERE lower(nome) LIKE '%freguesia%';
UPDATE public.unidades SET link_booksy = 'https://bit.ly/3W42IXa' WHERE lower(nome) LIKE '%caetano%';
UPDATE public.unidades SET link_booksy = 'https://bit.ly/3yGUY63' WHERE lower(nome) LIKE '%itaim%';
