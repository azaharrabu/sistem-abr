-- =====================================================================================
-- FAIL UNTUK CIPTA VIEW 'affiliate_details'
-- =====================================================================================
-- Arahan: Sila jalankan kod SQL ini di dalam Supabase SQL Editor anda.
-- Ia akan mencipta satu 'view' (jadual maya) yang menggabungkan data affiliate dan pengguna.

CREATE OR REPLACE VIEW public.affiliate_details AS
SELECT
  a.id AS affiliate_id,      -- ID dari jadual affiliates
  u.full_name,               -- Nama penuh dari jadual users
  u.email,                   -- Emel dari jadual users
  a.affiliate_code,          -- Kod affiliate dari jadual affiliates
  a.user_id,                 -- ID pengguna (UUID)
  a.created_at AS affiliate_since -- Tarikh pendaftaran affiliate
FROM
  public.affiliates AS a
JOIN
  public.users AS u ON a.user_id = u.user_id;

-- Komen untuk menjelaskan tujuan view ini
COMMENT ON VIEW public.affiliate_details IS 'Paparan gabungan yang memaparkan maklumat affiliate bersama nama dan e-mel pengguna. Data e-mel dan nama sentiasa dikemas kini dari jadual users.';

-- Memberi kebenaran akses (penting untuk RLS)
-- Ini membenarkan pengguna yang telah log masuk untuk membaca data dari view ini.
-- Akses selanjutnya masih dikawal oleh polisi RLS pada jadual asal jika perlu.
GRANT SELECT ON public.affiliate_details TO authenticated;
GRANT SELECT ON public.affiliate_details TO service_role;

-- =====================================================================================
-- SELESAI. Selepas menjalankan ini, anda akan nampak satu 'view' baru bernama 'affiliate_details'
-- di bahagian 'Tables' dalam sidebar Supabase Studio anda.
-- =ganteng
-- =====================================================================================