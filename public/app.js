// VERSI BARU - SEMAK KONSOL UNTUK MESEJ INI
console.log("Memuatkan app.js versi borang-affiliate...");

// Konstanta SUPABASE_URL dan SUPABASE_KEY kini didefinisikan dalam config.js
// Pastikan fail config.js dimuatkan sebelum app.js dalam HTML.

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Pembolehubah global untuk menyimpan token sesi semasa dengan lebih reliable
let currentSessionToken = null;

// Fungsi untuk mendapatkan token sesi semasa (digunakan sebagai fallback)
const getSessionToken = async () => {
    const { data: { session } } = await _supabase.auth.getSession();
    return session ? session.access_token : null;
};

// Balut semua logik aplikasi dalam DOMContentLoaded untuk memastikan semua elemen wujud.
document.addEventListener('DOMContentLoaded', () => {
    
    // --> MULA BLOK BARU: Tangkap kod affiliate dari URL dan simpan dalam kuki
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
        // Tetapkan kuki untuk bertahan selama 7 hari
        const d = new Date();
        d.setTime(d.getTime() + (7 * 24 * 60 * 60 * 1000));
        let expires = "expires=" + d.toUTCString();
        document.cookie = "affiliate_ref_code=" + refCode + ";" + expires + ";path=/";
        console.log(`Kod affiliate '${refCode}' dari URL telah disimpan dalam kuki.`);
    }
    // <-- TAMAT BLOK BARU

    // Rujukan kepada elemen DOM
    const authSection = document.getElementById('auth-section');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const showSignup = document.getElementById('show-signup');
    const showLogin = document.getElementById('show-login');
    const loginContainer = document.getElementById('login-container');
    const signupContainer = document.getElementById('signup-container');
    const paymentSection = document.getElementById('payment-section');
    const pendingApprovalSection = document.getElementById('pending-approval-section');
    const mainContentSection = document.getElementById('main-content-section');
    const adminPanelSection = document.getElementById('admin-panel-section');
    const paymentProofForm = document.getElementById('payment-proof-form');
    const openInteractiveButton = document.getElementById('open-interactive-button');
    const pendingPaymentsTableBody = document.getElementById('pending-payments-table-body');
    const logoutButtons = document.querySelectorAll('#logout-button-payment, #logout-button-pending, #logout-button-main, #logout-button-admin');
    const userInfoDisplays = document.querySelectorAll('#payment-user-info, #pending-user-info, #main-user-info, #admin-user-info');
    const registerAffiliateButton = document.getElementById('btn-register-affiliate');
    const affiliateRegisterView = document.getElementById('affiliate-register-view');
    const affiliateDashboardView = document.getElementById('affiliate-dashboard-view');
    const affiliateCodeSpan = document.getElementById('affiliate-code');
    const affiliateLeaderboardLink = document.getElementById('affiliate-leaderboard-link');

async function handlePaymentProofSubmit(event) {
    event.preventDefault();

    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Menghantar...';

    const token = currentSessionToken;
    if (!token) {
        alert('Sesi anda telah tamat. Sila log masuk semula.');
        submitButton.disabled = false;
        submitButton.textContent = 'Hantar Bukti Pembayaran';
        return;
    }

    // Ambil data dari borang
    const payment_date = document.getElementById('payment_date').value;
    const payment_time = document.getElementById('payment_time').value;
    const amount = document.getElementById('amount').value;
    const fullName = document.getElementById('affiliate-full-name').value;
    const phone = document.getElementById('affiliate-phone').value;
    const bankName = document.getElementById('affiliate-bank-name').value;
    const bankAccount = document.getElementById('affiliate-bank-account').value;

    // Pengesahan data - semua medan kini wajib
    if (!payment_date || !payment_time || !amount || !fullName.trim() || !phone.trim() || !bankName.trim() || !bankAccount.trim()) {
        alert('Sila lengkapkan semua butiran pembayaran dan pendaftaran affiliate anda.');
        submitButton.disabled = false;
        submitButton.textContent = 'Hantar Bukti Pembayaran';
        return;
    }

    // Data untuk dihantar ke API
    const body = { 
        payment_date, 
        payment_time, 
        amount,
        full_name: fullName,
        phone_number: phone,
        bank_name: bankName,
        bank_account_number: bankAccount,
        register_as_affiliate: true // Pendaftaran affiliate kini automatik
    };

    try {
        console.log("Attempting to submit payment proof with mandatory affiliate data...");
        const response = await fetch('/api/submit-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Gagal menghantar bukti pembayaran.');
        
        // Mesej kejayaan yang dikemaskini
        const successMessage = 'Terima kasih. Permohonan langganan dan pendaftaran affiliate anda akan disemak dan diproses dalam masa 3 hari bekerja.';
        alert(successMessage);

        await checkUserSession();

    } catch (error) {
        alert(`Ralat Penghantaran Bayaran: ${error.message}`);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Hantar Bukti Pembayaran';
    }
}

    // Fungsi untuk log keluar
    async function handleSignOut() {
        await _supabase.auth.signOut();
        localStorage.removeItem('customerProfile');
        currentSessionToken = null;
        showAuth();
        window.location.href = '/';
    }

    // Inisialisasi Event Listeners
    function initializeEventListeners() {
        if (showSignup) showSignup.addEventListener('click', (e) => { e.preventDefault(); if(loginContainer) loginContainer.style.display = 'none'; if(signupContainer) signupContainer.style.display = 'block'; });
        if (showLogin) showLogin.addEventListener('click', (e) => { e.preventDefault(); if(signupContainer) signupContainer.style.display = 'none'; if(loginContainer) loginContainer.style.display = 'block'; });
        if (loginForm) loginForm.addEventListener('submit', (e) => handleAuth(e, '/api/signin'));
        if (signupForm) signupForm.addEventListener('submit', (e) => handleAuth(e, '/api/signup'));
        logoutButtons.forEach(button => button.addEventListener('click', handleSignOut));
        if (paymentProofForm) paymentProofForm.addEventListener('submit', handlePaymentProofSubmit);
        if (openInteractiveButton) openInteractiveButton.addEventListener('click', () => window.open('/rujukan_interaktif.html', '_blank'));
        
        // Logik untuk checkbox affiliate telah dibuang kerana ia tidak lagi wujud

        if (affiliateLeaderboardLink) {
            affiliateLeaderboardLink.addEventListener('click', (e) => {
                e.preventDefault();
                window.open('/affiliate-leaderboard.html', '_blank'); 
            });
        }

        // --- AFFILIATE EDIT MODAL LOGIC ---
        const editAffiliateModal = document.getElementById('edit-affiliate-modal');
        const openEditModalBtn = document.getElementById('edit-affiliate-details-btn');
        const closeEditModalBtn = document.getElementById('close-edit-affiliate-modal');
        const editAffiliateForm = document.getElementById('edit-affiliate-form');

        if (openEditModalBtn) {
            openEditModalBtn.addEventListener('click', () => {
                const profile = JSON.parse(localStorage.getItem('customerProfile'));
                if (profile) {
                    document.getElementById('edit-affiliate-full-name').value = profile.full_name || '';
                    document.getElementById('edit-affiliate-phone').value = profile.phone_number || '';
                    document.getElementById('edit-affiliate-bank-name').value = profile.bank_name || '';
                    document.getElementById('edit-affiliate-bank-account').value = profile.account_number || '';
                }
                editAffiliateModal.style.display = 'block';
            });
        }

        if (closeEditModalBtn) {
            closeEditModalBtn.addEventListener('click', () => {
                editAffiliateModal.style.display = 'none';
            });
        }

        window.addEventListener('click', (event) => {
            if (event.target === editAffiliateModal) {
                editAffiliateModal.style.display = 'none';
            }
        });

        if (editAffiliateForm) {
            editAffiliateForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const submitButton = event.target.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                submitButton.textContent = 'Menyimpan...';

                const fullName = document.getElementById('edit-affiliate-full-name').value;
                const phone = document.getElementById('edit-affiliate-phone').value;
                const bankName = document.getElementById('edit-affiliate-bank-name').value;
                const bankAccount = document.getElementById('edit-affiliate-bank-account').value;

                if (!fullName.trim() || !phone.trim() || !bankName.trim() || !bankAccount.trim()) {
                    alert('Semua medan wajib diisi.');
                    submitButton.disabled = false;
                    submitButton.textContent = 'Simpan Perubahan';
                    return;
                }

                try {
                    const response = await fetch('/api/profile', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${currentSessionToken}`
                        },
                        body: JSON.stringify({
                            full_name: fullName,
                            phone_number: phone,
                            bank_name: bankName,
                            account_number: bankAccount
                        })
                    });

                    const result = await response.json();
                    if (!response.ok) {
                        throw new Error(result.error || 'Gagal mengemas kini profil.');
                    }

                    alert('Maklumat anda telah berjaya dikemas kini.');
                    editAffiliateModal.style.display = 'none';
                    await checkUserSession(); // Refresh profile data

                } catch (error) {
                    alert(`Ralat: ${error.message}`);
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Simpan Perubahan';
                }
            });
        }
        // --- END AFFILIATE EDIT MODAL LOGIC ---
    }

    // Panggil fungsi inisialisasi
    checkUserSession();
    initializeEventListeners();
});
