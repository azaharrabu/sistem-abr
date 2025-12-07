-- =====================================================================================
-- FIX: MEMBETULKAN JENIS DATA KOLUM 'referred_by'
-- =====================================================================================
-- TUJUAN: Skrip ini membetulkan ralat "column "referred_by" is of type uuid but
--         expression is of type text". Ia menukar jenis data bagi kolum 'referred_by'
--         dalam jadual 'public.users' daripada UUID kepada TEXT.
--
-- TINDAKAN:
-- 1. Menukar kolum 'referred_by' kepada jenis TEXT.
-- =====================================================================================

ALTER TABLE public.users
ALTER COLUMN referred_by TYPE TEXT;

-- =====================================================================================
-- SELESAI. Ini adalah pembaikan struktur.
-- Aliran pendaftaran sepatutnya berfungsi sepenuhnya selepas ini.
-- =====================================================================================
