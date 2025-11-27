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
            localStorage.removeItem('customerProfile');
            await checkUserSession();

        } catch (error) {
            alert(`Ralat: ${error.message}`);
        }
    }

    async function handleApprovePayment(event, customerId, token) {
        if (!confirm('Anda pasti mahu meluluskan pembayaran ini?')) return;
        if (!token) {
            alert('Sesi anda telah tamat. Sila log masuk semula.');
            return;
        }
        try {
            const response = await fetch(`/api/approve-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ customerId })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Gagal meluluskan pembayaran.');
            alert('Pembayaran berjaya diluluskan!');
            fetchPendingPayments(token);
        } catch (error) {
            alert(`Ralat: ${error.message}`);
        }
    }

    async function handleRejectPayment(event, customerId, token) {
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
                body: JSON.stringify({ customerId })
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
            if (pendingPaymentsTableBody) pendingPaymentsTableBody.innerHTML = '<tr><td colspan="8">Sesi tidak sah. Sila log masuk semula.</td></tr>';
            return;
        }

        try {
            const response = await fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error((await response.json()).error || 'Gagal mengambil data bayaran.');
            
            const pendingPayments = await response.json();
            if (pendingPaymentsTableBody) {
                pendingPaymentsTableBody.innerHTML = '';
                if (pendingPayments.length === 0) {
                    pendingPaymentsTableBody.innerHTML = '<tr><td colspan="8">Tiada permintaan pembayaran tertunda.</td></tr>';
                    return;
                }
                pendingPayments.forEach(payment => {
                    const row = pendingPaymentsTableBody.insertRow();
                    const user = payment.users;
                    if (!user) {
                        console.warn("Rekod bayaran ditemui tanpa pengguna yang sepadan:", payment);
                        return;
                    }
                    row.insertCell().textContent = user.email;
                    row.insertCell().textContent = user.subscription_plan;
                    row.insertCell().textContent = payment.reference_no;
                    row.insertCell().textContent = new Date(payment.payment_date).toLocaleDateString();
                    row.insertCell().textContent = payment.payment_time;
                    row.insertCell().textContent = `RM${Number(payment.amount).toFixed(2)}`;

                    const approveCell = row.insertCell();
                    const approveButton = document.createElement('button');
                    approveButton.textContent = 'Luluskan';
                    approveButton.className = 'approve-button';
                    approveButton.addEventListener('click', (event) => handleApprovePayment(event, user.id, token));
                    approveCell.appendChild(approveButton);

                    const rejectCell = row.insertCell();
                    const rejectButton = document.createElement('button');
                    rejectButton.textContent = 'Tolak';
                    rejectButton.className = 'reject-button';
                    rejectButton.addEventListener('click', (event) => handleRejectPayment(event, user.id, token));
                    rejectCell.appendChild(rejectButton);
                });
            }
        } catch (error) {
            if (pendingPaymentsTableBody) pendingPaymentsTableBody.innerHTML = `<tr><td colspan="8" style="color: red;">Ralat: ${error.message}</td></tr>`;
        }
    }

    // Fungsi fetchAffiliateDashboard telah dibuang kerana tidak lagi diperlukan.

    // Fungsi untuk memaparkan UI berdasarkan status & peranan pengguna
    const showUi = (user, profile, token) => {
        currentSessionToken = token;
        
        const elements = [authSection, paymentSection, pendingApprovalSection, mainContentSection, adminPanelSection, affiliateRegisterView, affiliateDashboardView];
        elements.forEach(el => { if (el) el.style.display = 'none'; });

        userInfoDisplays.forEach(display => {
            if (user && user.email) {
                display.innerHTML = `Log masuk sebagai: <strong>${user.email}</strong>`;
            } else {
                display.innerHTML = '';
            }
        });

        if (profile && profile.role === 'admin') {
            if (adminPanelSection) adminPanelSection.style.display = 'block';
            fetchPendingPayments(token);
        } 
        else if (profile && profile.role === 'user') {
            switch (profile.payment_status) {
                case 'paid':
                    if (mainContentSection) mainContentSection.style.display = 'block';
                    if (profile.is_affiliate) {
                        if (affiliateDashboardView) affiliateDashboardView.style.display = 'block';
                        if (affiliateRegisterView) affiliateRegisterView.style.display = 'none';
                        if (affiliateCodeSpan) affiliateCodeSpan.textContent = profile.affiliate_code;
                        const affiliateLinkInput = document.getElementById('affiliate-link');
                        if (affiliateLinkInput) {
                            affiliateLinkInput.value = `${window.location.origin}?ref=${profile.affiliate_code}`;
                        }
                        
                        // Data kini dibaca terus dari profil, tidak perlu fetch berasingan.
                        const salesValueEl = document.getElementById('affiliate-sales-value');
                        const commissionEl = document.getElementById('affiliate-commission');

                        if (salesValueEl) {
                            salesValueEl.textContent = `RM ${profile.totalSalesAmount || '0.00'}`;
                        }
                        if (commissionEl) {
                            commissionEl.textContent = `RM ${profile.totalCommission || '0.00'}`;
                        }

                    } else {
                        if (affiliateRegisterView) affiliateRegisterView.style.display = 'block';
                        if (affiliateDashboardView) affiliateDashboardView.style.display = 'none';
                    }
                    break;
                case 'pending':
                    if (pendingApprovalSection) pendingApprovalSection.style.display = 'block';
                    break;
                case 'rejected':
                default:
                    if (paymentSection) paymentSection.style.display = 'block'; 
                    break;
            }
        } 
        else {
            console.warn("showUi dipanggil tanpa profil yang sah. Kembali ke Auth.");
            showAuth();
        }
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
        localStorage.removeItem('customerProfile');
    };

    // Fungsi utama untuk memeriksa sesi pengguna
    const checkUserSession = async () => {
        const { data: { session } } = await _supabase.auth.getSession();
        
        if (session) {
            let customerProfile = JSON.parse(localStorage.getItem('customerProfile'));

            if (!customerProfile || customerProfile.user_id !== session.user.id) {
                const token = session.access_token;
                const response = await fetch('/api/profile', {
                    headers: { 'Authorization': `Bearer ${token}` },
                    cache: 'no-cache' // Elakkan caching profil
                });
                if (response.ok) {
                    customerProfile = await response.json();
                    localStorage.setItem('customerProfile', JSON.stringify(customerProfile));
                } else {
                    console.error("Gagal mendapatkan profil, log keluar...");
                    await handleSignOut();
                    return;
                }
            }
            showUi(session.user, customerProfile, session.access_token);
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
                if (!data.session || !data.profile) {
                    throw new Error("Respons log masuk tidak lengkap dari server.");
                }
                await _supabase.auth.setSession(data.session);
                localStorage.setItem('customerProfile', JSON.stringify(data.profile));
                showUi(data.user, data.profile, data.session.access_token);
            } else { 
                alert('Pendaftaran berjaya! Sila semak emel anda untuk pengesahan, kemudian log masuk.');
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
        const reference_no = document.getElementById('reference_no').value;
        const payment_date = document.getElementById('payment_date').value;
        const payment_time = document.getElementById('payment_time').value;
        const amount = document.getElementById('amount').value;
        if (!reference_no.trim() || !payment_date || !payment_time || !amount) {
            alert('Sila lengkapkan semua butiran pembayaran.');
            return;
        }
        const body = { reference_no, payment_date, payment_time, amount };
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
            if (!response.ok) throw new Error(data.error || 'Gagal menghantar bukti pembayaran.');
            alert('Terima kasih. Permohonan anda akan disemak dan diproses dalam masa 3 hari bekerja.');
            const customerProfile = JSON.parse(localStorage.getItem('customerProfile'));
            if (customerProfile) {
                customerProfile.payment_status = 'pending';
                localStorage.setItem('customerProfile', JSON.stringify(customerProfile));
                const { data: { user } } = await _supabase.auth.getUser();
                showUi(user, customerProfile, token);
            } else {
                if(paymentSection) paymentSection.style.display = 'none';
                if(pendingApprovalSection) pendingApprovalSection.style.display = 'block';
            }
        } catch (error) {
            alert(`Ralat: ${error.message}`);
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
        if (registerAffiliateButton) registerAffiliateButton.addEventListener('click', handleRegisterAffiliate);
        if (affiliateLeaderboardLink) {
            affiliateLeaderboardLink.addEventListener('click', (e) => {
                e.preventDefault();
                window.open('/affiliate-leaderboard.html', '_blank'); 
            });
        }
    }

    // Panggil fungsi inisialisasi
    checkUserSession();
    initializeEventListeners();
});