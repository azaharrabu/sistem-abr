-- recover_missing_profile.sql

-- Skrip ini direka untuk membaiki ketidakkonsistenan data antara jadual
-- `auth.users` dan `public.users`. Ia akan mencari semua pengguna yang
-- wujud dalam sistem pengesahan (`auth.users`) tetapi tidak mempunyai
-- rekod profil yang sepadan dalam jadual data awam (`public.users`),
-- dan kemudian mencipta rekod yang hilang itu.

-- Lakukan operasi ini sebagai satu transaksi untuk memastikan integriti data.
RAISE NOTICE 'Memulakan proses pemulihan profil pengguna...';

-- Masukkan rekod pengguna yang hilang ke dalam `public.users`.
-- Ia memilih pengguna dari `auth.users` yang tiada padanan `user_id` dalam `public.users`.
INSERT INTO public.users (user_id, email, role, payment_status)
SELECT
    u.id,
    u.email,
    'user' AS role, -- Tetapkan peranan lalai sebagai 'user'
    NULL AS payment_status -- Tetapkan status pembayaran sebagai NULL
FROM
    auth.users u
LEFT JOIN
    public.users pu ON u.id = pu.user_id
WHERE
    pu.user_id IS NULL; -- Syarat utama: hanya pilih jika tiada dalam public.users