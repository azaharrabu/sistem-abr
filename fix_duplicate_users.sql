-- fix_duplicate_users.sql
-- KESALAHAN YANG DIKENALPASTI: Ralat "Cannot coerce the result to a single JSON object" semasa log masuk
-- menunjukkan terdapat rekod pengguna pendua dalam jadual `users` anda (user_id yang sama untuk beberapa baris).
-- Skrip ini akan mengenal pasti dan membuang rekod pendua tersebut.

-- LANGKAH 1: (Pilihan) Kenal pasti pengguna pendua
-- Jalankan SELECT di bawah untuk melihat user_id mana yang mempunyai rekod pendua.
-- Ini tidak akan mengubah apa-apa.
SELECT user_id, email, COUNT(*)
FROM public.users
GROUP BY user_id, email
HAVING COUNT(*) > 1;


-- LANGKAH 2: Buang rekod pendua
-- Skrip di bawah akan memadam semua rekod pengguna pendua, dan HANYA MENYIMPAN REKOD YANG PALING BARU
-- (berdasarkan bila ia dicipta).
-- AMARAN: Sila buat sandaran (backup) jadual `users` anda sebelum menjalankan skrip ini jika anda tidak pasti.

DELETE FROM public.users
WHERE id IN (
    SELECT id
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER(PARTITION BY user_id ORDER BY created_at DESC) as rn
        FROM public.users
    ) t
    WHERE t.rn > 1
);


-- LANGKAH 3: Pastikan kekangan UNIK wujud
-- Selepas membersihkan data pendua, adalah penting untuk memastikan ini tidak berlaku lagi.
-- Kekangan UNIK menghalang kemasukan rekod dengan user_id yang sudah wujud.
-- Jalankan perintah di bawah. Jika kekangan sudah ada, ia mungkin akan memberikan notis,
-- dan itu tidak mengapa.
ALTER TABLE public.users
ADD CONSTRAINT users_user_id_key UNIQUE (user_id);

-- Nota: Jika anda mendapat ralat "constraint 'users_user_id_key' already exists", itu bermakna
-- kekangan sudah ada dan anda boleh abaikan ralat tersebut. Data anda kini bersih.

-- Sila jalankan skrip ini (LANGKAH 2 & 3) di Supabase SQL Editor anda.
