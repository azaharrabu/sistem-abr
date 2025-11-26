-- =====================================================================================
-- PENCIPTAAN FUNGSI DAN TRIGGER AUTOMATIK (FASA 2 - LANGKAH TERAKHIR)
-- =====================================================================================
-- Arahan: Sila jalankan kod SQL ini di dalam Supabase SQL Editor anda.
-- Ia akan mencipta automasi untuk merekodkan jualan affiliate secara automatik.

-- -------------------------------------------------------------------------------------
-- LANGKAH 1: CIPTA FUNGSI 'record_affiliate_sale'
-- Fungsi ini akan mengandungi semua logik untuk merekodkan jualan.
-- Ia akan dijalankan oleh trigger setiap kali jadual 'users' dikemas kini.
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_affiliate_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- Fungsi ini perlu dijalankan dengan kebenaran 'postgres' untuk mengakses jadual lain.
AS $$
DECLARE
    v_affiliate_id BIGINT;
BEGIN
    -- 1. Semak jika kemas kini ini adalah untuk menukar status kepada 'paid'.
    --    NEW merujuk kepada data baris SELEPAS kemas kini.
    --    OLD merujuk kepada data baris SEBELUM kemas kini.
    --    Kita hanya mahu trigger ini berjalan SEKALI sahaja apabila status bertukar menjadi 'paid'.
    IF NEW.payment_status = 'paid' AND OLD.payment_status <> 'paid' THEN

        -- 2. Semak jika pengguna ini mempunyai kod rujukan affiliate.
        IF NEW.referred_by IS NOT NULL THEN

            -- 3. Dapatkan ID affiliate dari jadual 'affiliates' berdasarkan kod rujukan.
            SELECT id INTO v_affiliate_id
            FROM public.affiliates
            WHERE affiliate_code = NEW.referred_by;

            -- 4. Jika affiliate ditemui, masukkan rekod jualan baru.
            IF v_affiliate_id IS NOT NULL THEN
                INSERT INTO public.sales (purchaser_user_id, affiliate_id, sale_amount)
                VALUES (NEW.user_id, v_affiliate_id, NEW.subscription_price);
            END IF;

        END IF;

    END IF;

    -- Kembalikan baris yang telah dikemas kini.
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.record_affiliate_sale() IS 'Fungsi yang dipanggil oleh trigger untuk merekodkan jualan affiliate apabila bayaran pengguna disahkan.';


-- -------------------------------------------------------------------------------------
-- LANGKAH 2: CIPTA TRIGGER 'on_user_payment_paid'
-- Trigger ini akan "mendengar" sebarang kemas kini pada jadual 'users'
-- dan akan memanggil fungsi 'record_affiliate_sale' untuk setiap baris yang dikemas kini.
-- -------------------------------------------------------------------------------------
-- Padam trigger lama jika wujud untuk mengelakkan ralat.
DROP TRIGGER IF EXISTS on_user_payment_paid ON public.users;

-- Cipta trigger baru.
CREATE TRIGGER on_user_payment_paid
AFTER UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.record_affiliate_sale();

COMMENT ON TRIGGER on_user_payment_paid ON public.users IS 'Menjalankan fungsi record_affiliate_sale() setiap kali satu baris di dalam jadual users dikemas kini.';

-- =====================================================================================
-- SELESAI. Sila jalankan skrip ini di Supabase.
-- Automasi anda kini sedia.
-- =====================================================================================
