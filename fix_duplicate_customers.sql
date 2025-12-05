-- PERINGATAN: Skrip ini akan memadam data secara kekal. Sila buat sandaran (backup) jadual 'profiles' anda sebelum melaksanakannya.
-- Skrip ini membuang rekod profil pendua berdasarkan 'user_id', hanya menyimpan rekod yang paling terkini untuk setiap pengguna.
-- Ia mengandaikan terdapat lajur 'created_at' untuk menentukan rekod mana yang paling baru.

DELETE FROM public.profiles
WHERE ctid IN (
  SELECT ctid FROM (
    SELECT
      ctid,
      -- Partition by user_id and order by created_at to find the latest record
      ROW_NUMBER() OVER(PARTITION BY user_id ORDER BY created_at DESC) as rn
    FROM
      public.profiles
  ) t
  WHERE t.rn > 1
);

-- Selepas pembersihan, sahkan bahawa tiada lagi 'user_id' pendua.
-- Anda boleh menjalankan query ini untuk menyemak. Ia sepatutnya tidak memulangkan sebarang baris.
SELECT user_id, COUNT(*)
FROM public.profiles
GROUP BY user_id
HAVING COUNT(*) > 1;