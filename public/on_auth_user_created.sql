-- Skrip untuk mencipta fungsi dan trigger bagi menguruskan pengguna baru secara automatik.
-- VERSI MUKTAMAD: Menggunakan kaedah yang betul untuk menguruskan kebenaran Supabase.

-- LANGKAH 1: CIPTA FUNGSI `handle_new_user`
-- Fungsi ini akan memasukkan rekod baru ke dalam `public.users` selepas pendaftaran pengguna.
-- `SECURITY DEFINER` memastikan fungsi ini berjalan dengan kebenaran pemiliknya (`postgres`),
-- yang mempunyai akses untuk menulis ke jadual `public.users`.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (user_id, email, role, payment_status)
  VALUES (new.id, new.email, 'user', NULL);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- LANGKAH 2: CIPTA TRIGGER DENGAN KEBENARAN YANG BETUL
-- Pastikan anda menjalankan arahan berikut dengan peranan yang mempunyai kebenaran yang mencukupi (cth., 'postgres' atau 'supabase_admin').

-- Padam trigger lama jika ia wujud untuk mengelakkan konflik.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Cipta trigger baru.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- LANGKAH 3: BERI KOMEN UNTUK DOKUMENTASI
COMMENT ON FUNCTION public.handle_new_user() IS 'Mencipta profil pengguna asas di jadual public.users selepas pendaftaran di auth.users.';
COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'Menjalankan fungsi handle_new_user() selepas pendaftaran pengguna baru.';