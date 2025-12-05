
// delete_duplicates.js
const { createClient } = require('@supabase/supabase-js');

// URL dan Kunci Servis Supabase
const SUPABASE_URL = 'https://grpyjfftucaooghlutgb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdycHlqZmZ0dWNhb29naGx1dGdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjkyOTkyNywiZXhwIjoyMDc4NTA1OTI3fQ.gF5MYEw7pyQN3hL0ZAOhnw3Tiq6kgTSqMh0cVuvhxbk';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function deleteDuplicatePayments() {
    try {
        console.log('Mencari rekod bayaran dari jadual "payments"...');
        const { data: payments, error: fetchError } = await supabase
            .from('payments')
            .select('id, user_id, reference_no, payment_date, payment_time, amount');

        if (fetchError) throw fetchError;
        console.log(`Menemui ${payments.length} jumlah rekod bayaran.`);

        const groups = {};
        payments.forEach(p => {
            const key = `${p.user_id}|${p.reference_no}|${p.payment_date}|${p.payment_time}|${p.amount}`;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(p.id);
        });

        const idsToDelete = [];
        for (const key in groups) {
            const ids = groups[key];
            // Isih ID untuk pastikan yang asal (paling lama) disimpan
            ids.sort((a, b) => a - b);
            if (ids.length > 1) {
                // Simpan rekod pertama, buang yang lain
                ids.shift();
                idsToDelete.push(...ids);
            }
        }

        if (idsToDelete.length > 0) {
            console.log(`Menemui ${idsToDelete.length} rekod berganda untuk dipadam...`);
            const { error: deleteError } = await supabase
                .from('payments')
                .delete()
                .in('id', idsToDelete);

            if (deleteError) throw deleteError;

            console.log(`Berjaya memadam ${idsToDelete.length} rekod bayaran berganda.`);
        } else {
            console.log('Tiada rekod berganda ditemui.');
        }

    } catch (err) {
        console.error('Ralat semasa proses memadam:', err.message);
    }
}

deleteDuplicatePayments();
