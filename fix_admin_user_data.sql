-- Skrip untuk membetulkan data pengguna admin yang hilang.
--
-- ARAHAN:
-- 1. Pergi ke papan pemuka Supabase anda -> Authentication -> Users.
-- 2. Cari pengguna dengan emel 'admin-staging@gmail.com'.
-- 3. Salin nilai dari lajur 'User UID'.
-- 4. Tampal 'User UID' tersebut di bawah untuk menggantikan 'PASTE_ADMIN_USER_ID_HERE'.
-- 5. Jalankan keseluruhan skrip ini di Supabase SQL Editor.

INSERT INTO public.users (user_id, email, role, payment_status)
VALUES ('PASTE_ADMIN_USER_ID_HERE', 'admin-staging@gmail.com', 'admin', 'paid')
ON CONFLICT (user_id) DO UPDATE SET
  role = EXCLUDED.role,
  email = EXCLUDED.email,
  payment_status = EXCLUDED.payment_status;

COMMENT ON COLUMN public.users.role IS 'Peranan pengguna dalam sistem (cth: admin, user, affiliate).';
COMMENT ON COLUMN public.users.payment_status IS 'Status pembayaran langganan (cth: needs_payment, pending, paid, expired).';

-- Selepas menjalankan skrip, admin sepatutnya boleh mengakses sumber yang dilindungi.
