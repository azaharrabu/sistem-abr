-- Menukar pemilik fungsi handle_new_user kepada 'postgres'
-- Ini diperlukan untuk memberikan kebenaran yang betul bagi mencipta trigger pada jadual auth.users.
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Memberi komen untuk mengesahkan perubahan telah digunakan.
COMMENT ON FUNCTION public.handle_new_user() IS 'Mencipta profil pengguna di jadual public.users selepas pendaftaran di auth.users. Pemilik: postgres.';
