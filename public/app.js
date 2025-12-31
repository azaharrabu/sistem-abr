// Force rebuild - 20251211
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
document.addEventListener('DOMContentLoaded', async () => {
    // Hanya jalankan logik aplikasi jika kita berada di halaman yang mempunyai bahagian pengesahan utama
    if (!document.getElementById('auth-section')) {
        return; // Jangan jalankan di halaman seperti langganan.html
    }

    // Rujukan kepada elemen DOM (diletakkan di sini untuk akses global dalam skop)
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

    // Fungsi untuk log keluar
    async function handleSignOut() {
        await _supabase.auth.signOut();
        localStorage.removeItem('userProfile');
        currentSessionToken = null;
        
        // Periksa jika 'ref' ada dalam URL. Jika ya, jangan redirect, hanya tunjukkan borang auth.
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('ref')) {
            showAuth(); // Hanya tunjukkan paparan auth, jangan muat semula halaman
        } else {
            window.location.href = '/'; // Fungsi asal untuk log keluar biasa
        }
    }

    // Fungsi utama untuk memulakan aplikasi
    async function initializeApp() {
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');

        // Jika pautan affiliate digunakan, log keluar pengguna sedia ada untuk membenarkan pendaftaran baru
        if (refCode) {
            console.log("Pautan affiliate dikesan. Melog keluar sesi sedia ada...");
            await _supabase.auth.signOut(); // Terus log keluar
            localStorage.removeItem('userProfile'); // Pastikan profil tempatan dibersihkan
            currentSessionToken = null;
            
            // Simpan kod affiliate dalam kuki
            const d = new Date();
            d.setTime(d.getTime() + (7 * 24 * 60 * 60 * 1000));
            let expires = "expires=" + d.toUTCString();
            document.cookie = "affiliate_ref_code=" + refCode + ";" + expires + ";path=/";
            console.log(`Kod affiliate '${refCode}' dari URL telah disimpan dalam kuki.`);

            // Buang parameter 'ref' dari URL untuk mengelakkan log keluar berulang jika halaman dimuat semula
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Teruskan dengan persediaan biasa
        initializeEventListeners();
        await checkUserSession(); // Sekarang checkUserSession akan mendapati tiada sesi dan menunjukkan borang pendaftaran
    }
    
    // Fungsi baru untuk mengendalikan pendaftaran affiliate
    async function handleRegisterAffiliate() {
        const token = currentSessionToken;
        if (!token) {
            alert('Sesi anda telah tamat. Sila log masuk semula.');
            return;
        }

        if (!confirm('Anda pasti mahu mendaftar sebagai agen affiliate?')) {
            return;
        }

        try {
            const response = await fetch('/api/register-affiliate', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Gagal mendaftar sebagai affiliate.');
            }

            alert('Tahniah! Anda kini seorang affiliate. Antaramuka akan dikemaskini.');
            localStorage.removeItem('userProfile');
            await checkUserSession();

        } catch (error) {
            alert(`Ralat: ${error.message}`);
        }
    }

    async function handleApprovePayment(event, userId, token) {
        if (!confirm('Anda pasti mahu meluluskan pembayaran ini?')) return;
        if (!token) {
            alert('Sesi anda telah tamat. Sila log masuk semula.');
            return;
        }
        try {
            const response = await fetch(`/api/approve-payment-v2`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ userId }) // Pastikan backend mengharapkan 'userId'
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Gagal meluluskan pembayaran.');
        
        alert('Pembayaran berjaya diluluskan!');
        await fetchPendingPayments(token); // Reload the list of pending payments
        } catch (error) {
            console.error("--- DEBUGGING approve-payment ---");
            console.error("Full error object:", error);
            alert(`Ralat Frontend Sebenar: ${error.message}`);
        }
    }

    async function handleRejectPayment(event, userId, token) {
        if (!confirm('Anda pasti mahu menolak pembayaran ini? Tindakan ini tidak boleh diundur.')) return;
        if (!token) {
            alert('Sesi anda telah tamat. Sila log masuk semula.');
            return;
        }
        try {
            const response = await fetch(`/api/reject-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ userId })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Gagal menolak pembayaran.');
            alert('Pembayaran berjaya ditolak!');
            fetchPendingPayments(token);
        } catch (error) {
            alert(`Ralat: ${error.message}`);
        }
    }
    
    // Fungsi untuk mengambil dan memaparkan permintaan pembayaran tertunda
    async function fetchPendingPayments(token) {
        if (!token) token = currentSessionToken || await getSessionToken();
        if (!token) {
            if (pendingPaymentsTableBody) pendingPaymentsTableBody.innerHTML = '<tr><td colspan="10">Sesi tidak sah. Sila log masuk semula.</td></tr>';
            return;
        }

        try {
            // Panggil endpoint API admin-dashboard yang telah dibaiki
            const response = await fetch('/api/admin-dashboard', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error((await response.json()).error || 'Gagal mengambil data bayaran.');
            
            const pendingPayments = await response.json();
            if (pendingPaymentsTableBody) {
                pendingPaymentsTableBody.innerHTML = '';
                if (pendingPayments.length === 0) {
                    // Kemas kini colspan kepada 10
                    pendingPaymentsTableBody.innerHTML = '<tr><td colspan="10">Tiada permintaan pembayaran tertunda.</td></tr>';
                    return;
                }
                pendingPayments.forEach(payment => {
                    if (!payment || !payment.user_id) {
                        console.warn("Rekod bayaran tidak lengkap atau tiada user_id:", payment);
                        return; // Langkau rekod yang tidak lengkap
                    }

                    const row = pendingPaymentsTableBody.insertRow();
                    
                    // Isikan sel mengikut susunan lajur baharu
                    row.insertCell().textContent = payment.email || 'N/A';
                    row.insertCell().textContent = payment.full_name || 'N/A';
                    row.insertCell().textContent = payment.phone_number || 'N/A';
                    row.insertCell().textContent = payment.subscription_plan || 'N/A';
                    row.insertCell().textContent = payment.reference_no || 'N/A'; // Gunakan reference_no
                    row.insertCell().textContent = payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('ms-MY') : 'N/A';
                    row.insertCell().textContent = payment.payment_time || 'N/A';
                    row.insertCell().textContent = `RM${Number(payment.amount).toFixed(2)}`;

                    // Sel untuk butang Luluskan
                    const approveCell = row.insertCell();
                    const approveButton = document.createElement('button');
                    approveButton.textContent = 'Luluskan';
                    approveButton.className = 'approve-button';
                    // Gunakan payment.user_id yang kini tersedia
                    approveButton.addEventListener('click', (event) => handleApprovePayment(event, payment.user_id, token));
                    approveCell.appendChild(approveButton);

                    // Sel untuk butang Tolak
                    const rejectCell = row.insertCell();
                    const rejectButton = document.createElement('button');
                    rejectButton.textContent = 'Tolak';
                    rejectButton.className = 'reject-button';
                    // Gunakan payment.user_id yang kini tersedia
                    rejectButton.addEventListener('click', (event) => handleRejectPayment(event, payment.user_id, token));
                    rejectCell.appendChild(rejectButton);
                });
            }
        } catch (error) {
            // Kemas kini colspan kepada 10
            if (pendingPaymentsTableBody) pendingPaymentsTableBody.innerHTML = `<tr><td colspan="10" style="color: red;">Ralat: ${error.message}</td></tr>`;
        }
    }

    // Fungsi untuk memaparkan UI berdasarkan status & peranan pengguna
    const showUi = (user, profile, token) => {
        console.log("--- showUi dipanggil ---");
        console.log("User object:", user);
        console.log("Profile object:", profile);

        currentSessionToken = token;

        // Sembunyikan semua bahagian utama terlebih dahulu
        const allSections = [authSection, paymentSection, pendingApprovalSection, mainContentSection, adminPanelSection];
        allSections.forEach(el => { if (el) el.style.display = 'none'; });

        // Jika tidak perlu kemas kini profil, teruskan dengan logik UI biasa
        const elements = [authSection, paymentSection, pendingApprovalSection, mainContentSection, adminPanelSection, affiliateRegisterView, affiliateDashboardView];
        elements.forEach(el => { if (el) el.style.display = 'none'; });

        userInfoDisplays.forEach(display => {
            if (user && user.email) {
                display.innerHTML = `Log masuk sebagai: <strong>${user.email}</strong>`;
            } else {
                display.innerHTML = '';
            }
        });

        // --> MULA PINDAAN: Logik mengisi e-mel ke medan rujukan pembayaran
        // Logik ini dijalankan setiap kali UI dipaparkan untuk memastikan medan sentiasa diisi jika pengguna wujud.
        const referenceInput = document.getElementById('reference_no');
        if (referenceInput) {
            if (user && user.email) {
                referenceInput.value = user.email;
                console.log(`Medan rujukan pembayaran diisi dengan e-mel: ${user.email}`);
            } else {
                // Kosongkan medan jika tiada pengguna/e-mel, contohnya selepas log keluar
                referenceInput.value = '';
                console.warn('Tidak dapat mengisi medan rujukan: objek pengguna atau e-mel tidak ditemui.');
            }
        }
        // <-- TAMAT PINDAAN

        if (profile && profile.role === 'admin') {
            console.log("UI Path: Admin");
            if (adminPanelSection) adminPanelSection.style.display = 'block';
            fetchPendingPayments(token);
        } else if (profile) {
            console.log(`UI Path: User (Payment Status: ${profile.payment_status})`);
            switch (profile.payment_status) {
                case 'paid':
                    if (mainContentSection) mainContentSection.style.display = 'block';
                    if (profile.is_affiliate) {
                        console.log("UI Sub-Path: User is an affiliate.");
                        if (affiliateDashboardView) affiliateDashboardView.style.display = 'block';
                        if (affiliateRegisterView) affiliateRegisterView.style.display = 'none';
                        if (affiliateCodeSpan) affiliateCodeSpan.textContent = profile.affiliate_code;
                        const affiliateLinkInput = document.getElementById('affiliate-link');
                        if (affiliateLinkInput) {
                            affiliateLinkInput.value = `https://sistemubbl.abrbrillante.com/?ref=${profile.affiliate_code}`;
                        }
                        
                        const salesValueEl = document.getElementById('affiliate-sales-value');
                        const commissionEl = document.getElementById('affiliate-commission');

                        if (salesValueEl) {
                            salesValueEl.textContent = `RM ${profile.totalSalesAmount || '0.00'}`;
                        }
                        if (commissionEl) {
                            commissionEl.textContent = `RM ${profile.totalCommission || '0.00'}`;
                        }

                    } else {
                        console.log("UI Sub-Path: User is NOT an affiliate.");
                        if (affiliateRegisterView) affiliateRegisterView.style.display = 'block';
                        if (affiliateDashboardView) affiliateDashboardView.style.display = 'none';
                    }
                    break;
                case 'pending':
                    console.log("UI Sub-Path: Payment pending.");
                    if (pendingApprovalSection) pendingApprovalSection.style.display = 'block';
                    break;
                case 'rejected':
                default: // Also covers new users where status is null/undefined
                    console.log("UI Sub-Path: Needs payment (new, rejected, or other).");
                    if (paymentSection) {
                        paymentSection.style.display = 'block';
                        
                        // --> MULA BLOK BARU: Isi amaun secara automatik berdasarkan pelan
                        const amountInput = document.getElementById('amount');
                        if (amountInput && profile && profile.subscription_plan) {
                            let price = '';
                            if (profile.subscription_plan === '6-bulan') {
                                price = '50.00';
                            } else if (profile.subscription_plan === '12-bulan') {
                                price = '80.00';
                            }
                            amountInput.value = price;
                            amountInput.readOnly = true; // Kunci medan untuk elak kekeliruan
                            console.log(`Amaun ditetapkan kepada ${price} untuk pelan ${profile.subscription_plan} dan dikunci.`);
                        }
                        // <-- TAMAT BLOK BARU
                    }
                    break;
            }
        } 
        else {
            console.warn("showUi called with invalid profile. Reverting to Auth view.");
            showAuth();
        }
        console.log("--- showUi selesai ---");
    };

    // Fungsi untuk memaparkan borang log masuk/daftar
    const showAuth = () => {
        currentSessionToken = null;
        if (authSection) authSection.style.display = 'block';
        if (paymentSection) paymentSection.style.display = 'none';
        if (pendingApprovalSection) pendingApprovalSection.style.display = 'none';
        if (mainContentSection) mainContentSection.style.display = 'none';
        if (adminPanelSection) adminPanelSection.style.display = 'none';
        if (signupContainer) signupContainer.style.display = 'none';
        if (loginContainer) loginContainer.style.display = 'block';
        localStorage.removeItem('userProfile');
    };

    // Fungsi utama untuk memeriksa sesi pengguna
    const checkUserSession = async () => {
        // JANGAN JALANKAN FUNGSI INI DI HALAMAN SET SEMULA KATA LALUAN
        // Kerana halaman itu mempunyai logik pengesahannya sendiri untuk mengendalikan token.
        if (window.location.pathname.includes('reset-password.html')) {
            console.log("checkUserSession dilangkau pada halaman set semula kata laluan.");
            return;
        }

        const { data: { session } } = await _supabase.auth.getSession();
        
        if (session) {
            const token = session.access_token;
            const response = await fetch('/api/profile', {
                headers: { 'Authorization': `Bearer ${token}` },
                cache: 'no-cache' // Elakkan caching profil
            });
            if (response.ok) {
                const userProfile = await response.json();
                localStorage.setItem('userProfile', JSON.stringify(userProfile));
                showUi(session.user, userProfile, token);
            } else {
                console.error("Gagal mendapatkan profil, log keluar...");
                await handleSignOut(); // Guna handleSignOut yang telah diubah suai
                return;
            }
        } else {
            showAuth();
        }
    };
    
    function getCookie(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for(let i=0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0)==' ') c = c.substring(1,c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
        }
        return null;
    }

    async function handleAuth(event, endpoint) {
        event.preventDefault();
        const form = event.target;
        const email = form.querySelector('input[type="email"]').value;
        const password = form.querySelector('input[type="password"]').value;
        let body = { email, password };
        if (endpoint === '/api/signup') {
            const planInput = form.querySelector('input[name="subscription_plan"]:checked');
            if (!planInput) {
                alert('Sila pilih pelan langganan.');
                return;
            }
            
            // --> MULA BLOK BARU: Tangkap nama penuh dan telefon semasa pendaftaran
            const fullName = document.getElementById('signup-full-name').value;
            const phoneNumber = document.getElementById('signup-phone').value;
            if (!fullName.trim() || !phoneNumber.trim()) {
                alert('Sila masukkan Nama Penuh dan Nombor Telefon anda.');
                return;
            }
            body.full_name = fullName;
            body.phone_number = phoneNumber;
            // <-- TAMAT BLOK BARU

            body.subscription_plan = planInput.value;
            const affiliateCode = getCookie('affiliate_ref_code');
            if (affiliateCode) {
                body.referred_by = affiliateCode;
                console.log(`Pendaftaran dirujuk oleh kod affiliate: ${affiliateCode}`);
            }
        }
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Ralat tidak diketahui');
            if (endpoint === '/api/signin') {
                if (!data.session) {
                    throw new Error("Respons log masuk tidak lengkap dari server.");
                }
                await _supabase.auth.setSession(data.session);
                await checkUserSession(); // Panggil fungsi yang mendapatkan profil penuh & betul
            } else { 
                alert('Pendaftaran berjaya! Sila log masuk untuk menghantar bukti pembayaran.');
                if(signupContainer) signupContainer.style.display = 'none';
                if(loginContainer) loginContainer.style.display = 'block';
            }
        } catch (error) {
            alert(`Ralat Log Masuk: ${error.message}`);
        }
        form.reset();
    }

    async function handlePaymentProofSubmit(event) {
        event.preventDefault();
        const token = currentSessionToken;
        if (!token) {
            alert('Sesi anda telah tamat. Sila log masuk semula.');
            return;
        }

        // Kumpul data yang relevan dari borang
        const reference_no = document.getElementById('reference_no').value;
        let payment_date = document.getElementById('payment_date').value;
        const payment_time = document.getElementById('payment_time').value;

        // --> MULA PEMBETULAN: Tetapkan tarikh hari ini jika tiada tarikh dipilih
        if (!payment_date) {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            payment_date = `${year}-${month}-${day}`;
            console.log(`Tarikh pembayaran kosong, ditetapkan kepada tarikh hari ini: ${payment_date}`);
        }
        // <-- TAMAT PEMBETULAN

        const amount = document.getElementById('amount').value;

        // Semak jika semua medan yang diperlukan diisi
        if (!reference_no.trim() || !payment_date || !payment_time || !amount) {
            alert('Sila lengkapkan semua butiran yang diperlukan.');
            return;
        }

        // Sediakan badan permintaan (flat structure)
        const body = {
            payment_date,
            payment_time,
            amount,
        };

        try {
            const response = await fetch('/api/submit-payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Gagal menghantar bukti pembayaran.');
            }

            alert('Terima kasih. Permohonan anda akan disemak dan diproses dalam masa 3 hari bekerja.');
            
            // Kemas kini profil tempatan untuk mencerminkan status 'pending'
            const userProfile = JSON.parse(localStorage.getItem('userProfile'));
            if (userProfile) {
                userProfile.payment_status = 'pending';
                localStorage.setItem('userProfile', JSON.stringify(userProfile));
                const { data: { user } } = await _supabase.auth.getUser();
                showUi(user, userProfile, token);
            } else {
                // Fallback jika profil tidak wujud
                if(paymentSection) paymentSection.style.display = 'none';
                if(pendingApprovalSection) pendingApprovalSection.style.display = 'block';
            }
        } catch (error) {
            alert(`Ralat: ${error.message}`);
        }
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
        if (registerAffiliateButton) registerAffiliateButton.addEventListener('click', handleRegisterAffiliate);
        if (affiliateLeaderboardLink) {
            affiliateLeaderboardLink.addEventListener('click', (e) => {
                e.preventDefault();
                window.open('/affiliate-leaderboard.html', '_blank'); 
            });
        }
    }

    // Panggil fungsi permulaan utama
    initializeApp();
});