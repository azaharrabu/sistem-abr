-- =====================================================================================
-- DATABASE SCRIPT: Fix and Automate Affiliate Totals
-- =====================================================================================
-- PURPOSE: This script fixes the affiliate system by adding columns to track total
--          sales and commission, and creates a trigger to automate the update process.
--
-- HOW TO RUN: Execute this entire script once in the Supabase SQL Editor.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- LANGKAH 1: KEMAS KINI JADUAL 'affiliates'
-- Menambah kolum untuk menyimpan jumlah jualan dan komisyen.
-- -------------------------------------------------------------------------------------
DO $$
BEGIN
    -- Tambah kolum total_sales jika belum wujud
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='affiliates' AND column_name='total_sales') THEN
        ALTER TABLE public.affiliates ADD COLUMN total_sales NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
    END IF;

    -- Tambah kolum total_commission jika belum wujud
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='affiliates' AND column_name='total_commission') THEN
        ALTER TABLE public.affiliates ADD COLUMN total_commission NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
    END IF;
END $$;


-- -------------------------------------------------------------------------------------
-- LANGKAH 2: CIPTA FUNGSI TRIGGER
-- Fungsi ini akan dipanggil setiap kali ada rekod baru dalam jadual 'sales'.
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_affiliate_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Kemas kini jumlah pada jadual 'affiliates'
    UPDATE public.affiliates
    SET
        total_sales = total_sales + NEW.sale_amount,
        total_commission = total_commission + NEW.commission_amount
    WHERE id = NEW.affiliate_id;

    -- Kembalikan rekod baru untuk melengkapkan operasi INSERT
    RETURN NEW;
END;
$$;


-- -------------------------------------------------------------------------------------
-- LANGKAH 3: CIPTA TRIGGER PADA JADUAL 'sales'
-- Trigger ini akan menjalankan fungsi di atas secara automatik.
-- -------------------------------------------------------------------------------------
-- Padam trigger lama jika wujud untuk persediaan yang bersih
DROP TRIGGER IF EXISTS on_new_sale_update_affiliate_totals ON public.sales;

-- Cipta trigger yang akan berfungsi SELEPAS rekod baru dimasukkan ke dalam 'sales'
CREATE TRIGGER on_new_sale_update_affiliate_totals
AFTER INSERT ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.update_affiliate_totals();

-- =====================================================================================
-- SELESAI. Sistem affiliate kini sepatutnya mengira jumlah secara automatik.
-- =====================================================================================
