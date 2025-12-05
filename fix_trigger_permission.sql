-- Skrip ini membetulkan ralat kebenaran (permission error) dan mengemas kini trigger untuk pendaftaran pengguna baru.
-- Sila jalankan keseluruhan skrip ini di Supabase SQL Editor anda.

-- LANGKAH 1: Kemas kini jadual 'users' untuk menambah lajur 'referred_by'
-- Ini akan menambah lajur hanya jika ia belum wujud, jadi selamat untuk dijalankan berulang kali.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referred_by UUID;
COMMENT ON COLUMN public.users.referred_by IS 'ID pengguna yang merujuk pengguna baru ini (untuk sistem affiliate).';


-- LANGKAH 2: Cipta Semula Fungsi `handle_new_user`
-- Fungsi ini disempurnakan untuk memastikan ia selaras dengan skema dan amalan terbaik keselamatan.
-- Menggunakan SECURITY DEFINER adalah betul, tetapi pemiliknya perlu ditukar.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    user_id, email, role, subscription_plan, subscription_price,
    is_promo_user, referred_by, payment_status
  )
  VALUES (
    new.id,
    new.email,
    'user', -- Peranan lalai untuk semua pengguna baru
    new.raw_user_meta_data->>'subscription_plan',
    (new.raw_user_meta_data->>'subscription_price')::numeric,
    (new.raw_user_meta_data->>'is_promo_user')::boolean,
    (new.raw_user_meta_data->>'referred_by')::UUID, -- Memastikan jenis data adalah UUID
    new.raw_user_meta_data->>'payment_status'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user() IS 'Mencipta profil pengguna di jadual public.users selepas pendaftaran di auth.users.';


-- LANGKAH 3: Beri Kebenaran dan Tukar Pemilik Fungsi
-- INI ADALAH LANGKAH PALING PENTING UNTUK MEMBETULKAN RALAT.
-- Kita beri kebenaran INSERT pada jadual 'users' kepada peranan 'supabase_auth_admin'.
-- Kemudian kita tukar pemilik fungsi kepada 'supabase_auth_admin' supaya ia berjalan dengan kebenaran yang betul.
GRANT INSERT ON TABLE public.users TO supabase_auth_admin;
ALTER FUNCTION public.handle_new_user() OWNER TO supabase_auth_admin;


-- LANGKAH 4: Cipta Semula Trigger (Pencetus)
-- Memadam trigger lama (jika ada) dan mencipta yang baru untuk mengelakkan sebarang konflik.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'Menjalankan fungsi handle_new_user() selepas pendaftaran pengguna baru.';

-- Mesej pengesahan untuk memberitahu anda skrip telah selesai.
SELECT 'Skrip untuk trigger handle_new_user telah berjaya dikemas kini.' AS status;
