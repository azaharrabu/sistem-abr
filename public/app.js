// Konstanta SUPABASE_URL dan SUPABASE_KEY kini didefinisikan dalam config.js
// Pastikan fail config.js dimuatkan sebelum app.js dalam HTML.

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Pembolehubah global untuk menyimpan token sesi semasa dengan lebih reliable
let currentSessionToken = null;

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

// Fungsi untuk mendapatkan token sesi semasa (digunakan sebagai fallback)
const getSessionToken = async () => {
    const { data: { session } } = await _supabase.auth.getSession();
    return session ? session.access_token : null;
};

// Fungsi untuk mengambil dan memaparkan permintaan pembayaran tertunda
async function fetchPendingPayments(token) {
    if (!token) {
        token = currentSessionToken || await getSessionToken();
    }
    if (!token) {
        pendingPaymentsTableBody.innerHTML = '<tr><td colspan="8">Sesi tidak sah. Sila log masuk semula.</td></tr>';
        return;
    }

    try {
        const response = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Gagal mengambil data bayaran.');

        const pendingPayments = await response.json();
        
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

    } catch (error) {
        pendingPaymentsTableBody.innerHTML = `<tr><td colspan="8" style="color: red;">Ralat: ${error.message}</td></tr>`;
    }
}

// Fungsi untuk menolak pembayaran
async function handleRejectPayment(event, customerId, token) {
    if (!confirm('Anda pasti mahu menolak pembayaran ini? Tindakan ini tidak boleh diundur.')) {
        return;
    }

    if (!token) {
        alert('Sesi anda telah tamat. Sila log masuk semula.');
        return;
    }

    try {
        const response = await fetch(`/api/users/${customerId}/reject`, {
            method: 'POST', // Menggunakan POST seperti di server.js
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Gagal menolak pembayaran.');
        }

        alert('Pembayaran berjaya ditolak!');
        fetchPendingPayments(token);

    } catch (error) {
        alert(`Ralat: ${error.message}`);
    }
}

// Fungsi untuk meluluskan pembayaran
async function handleApprovePayment(event, customerId, token) {
    if (!confirm('Anda pasti mahu meluluskan pembayaran ini?')) {
        return;
    }
    
    if (!token) {
        alert('Sesi anda telah tamat. Sila log masuk semula.');
        return;
    }

    try {
        const response = await fetch(`/api/users/${customerId}/approve`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Gagal meluluskan pembayaran.');
        }

        alert('Pembayaran berjaya diluluskan!');
        fetchPendingPayments(token);

    } catch (error) {
        alert(`Ralat: ${error.message}`);
    }
}

// Fungsi untuk memaparkan UI berdasarkan status & peranan pengguna
const showUi = (user, profile, token) => {
    currentSessionToken = token; // SIMPAN TOKEN DI SINI
    
    authSection.style.display = 'none';
    paymentSection.style.display = 'none';
    pendingApprovalSection.style.display = 'none';
    mainContentSection.style.display = 'none';
    adminPanelSection.style.display = 'none';

    userInfoDisplays.forEach(display => {
        if (user && user.email) {
            display.innerHTML = `Log masuk sebagai: <strong>${user.email}</strong>`;
        } else {
            display.innerHTML = '';
        }
    });

    if (profile && profile.role === 'admin') {
        adminPanelSection.style.display = 'block';
        fetchPendingPayments(token);
    } 
    else if (profile && profile.role === 'user') {
        switch (profile.payment_status) {
            case 'paid':
                mainContentSection.style.display = 'block';
                break;
            case 'pending':
                pendingApprovalSection.style.display = 'block';
                break;
            case 'rejected':
            default:
                paymentSection.style.display = 'block'; 
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
    currentSessionToken = null; // PADAM TOKEN DI SINI
    authSection.style.display = 'block';
    paymentSection.style.display = 'none';
    pendingApprovalSection.style.display = 'none';
    mainContentSection.style.display = 'none';
    adminPanelSection.style.display = 'none';
    signupContainer.style.display = 'none';
    loginContainer.style.display = 'block';
    localStorage.removeItem('customerProfile');
};

// Fungsi utama untuk memeriksa sesi pengguna semasa memuatkan halaman
const checkUserSession = async () => {
    const { data: { session } } = await _supabase.auth.getSession();
    
    if (session) {
        let customerProfile = JSON.parse(localStorage.getItem('customerProfile'));

        if (!customerProfile || customerProfile.user_id !== session.user.id) {
            const token = session.access_token;
            const response = await fetch('/api/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                customerProfile = await response.json();
                localStorage.setItem('customerProfile', JSON.stringify(customerProfile));
            } else {
                console.error("Gagal mendapatkan profil, log keluar...");
                handleSignOut();
                return;
            }
        }
        
        showUi(session.user, customerProfile, session.access_token);
    } else {
        showAuth();
    }
};

// Fungsi untuk membaca kuki (cookie)
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

// Fungsi generik untuk mengendalikan log masuk & pendaftaran
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

        // --- MODIFIKASI FASA 2: Tambah kod affiliate ---
        // Baca kod affiliate dari kuki dan tambah pada data pendaftaran
        const affiliateCode = getCookie('affiliate_ref_code');
        if (affiliateCode) {
            body.referred_by = affiliateCode;
            console.log(`Pendaftaran dirujuk oleh kod affiliate: ${affiliateCode}`);
        }
        // --- TAMAT MODIFIKASI ---
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
            signupContainer.style.display = 'none';
            loginContainer.style.display = 'block';
        }
    } catch (error) {
        alert(`Ralat Log Masuk: ${error.message}`);
    }
    form.reset();
}

// Fungsi untuk menghantar bukti pembayaran
async function handlePaymentProofSubmit(event) {
    event.preventDefault();
    const token = currentSessionToken; // GUNA TOKEN YANG DISIMPAN
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

    const body = {
        reference_no,
        payment_date,
        payment_time,
        amount
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
        if (!response.ok) throw new Error(data.error || 'Gagal menghantar bukti pembayaran.');

        alert('Terima kasih. Permohonan anda akan disemak dan diproses dalam masa 3 hari bekerja.');
        
        // Selepas berjaya, kita perlu kemas kini status pengguna secara manual di frontend
        // untuk memaparkan halaman yang betul tanpa perlu refresh.
        const customerProfile = JSON.parse(localStorage.getItem('customerProfile'));
        if(customerProfile) {
            customerProfile.payment_status = 'pending';
            localStorage.setItem('customerProfile', JSON.stringify(customerProfile));
            const { data: { user } } = await _supabase.auth.getUser();
            showUi(user, customerProfile, token);
        } else {
            // Fallback jika profil tiada dalam localStorage
            paymentSection.style.display = 'none';
            pendingApprovalSection.style.display = 'block';
        }

    } catch (error) {
        alert(`Ralat: ${error.message}`);
    }
}

// Fungsi untuk membuka sistem interaktif yang dilindungi
function handleOpenInteractiveSystem() {
    window.open('/rujukan_interaktif.html', '_blank');
}

// Fungsi untuk log keluar
async function handleSignOut() {
    await _supabase.auth.signOut();
    localStorage.removeItem('customerProfile');
    currentSessionToken = null; // PADAM TOKEN DI SINI
    showAuth();
    window.location.href = '/';
}

// --- FUNGSI-FUNGSI ADMIN (Tidak digunakan dalam aliran utama) ---
// ... (kekal sama)

// --- Inisialisasi Event Listeners ---
function initializeEventListeners() {
    if (showSignup) {
        showSignup.addEventListener('click', (e) => { e.preventDefault(); loginContainer.style.display = 'none'; signupContainer.style.display = 'block'; });
    }
    if (showLogin) {
        showLogin.addEventListener('click', (e) => { e.preventDefault(); signupContainer.style.display = 'none'; loginContainer.style.display = 'block'; });
    }
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => handleAuth(e, '/api/signin'));
    }
    if (signupForm) {
        signupForm.addEventListener('submit', (e) => handleAuth(e, '/api/signup'));
    }
    logoutButtons.forEach(button => {
        button.addEventListener('click', handleSignOut);
    });
    if (paymentProofForm) {
        paymentProofForm.addEventListener('submit', handlePaymentProofSubmit);
    }
    if (openInteractiveButton) {
        openInteractiveButton.addEventListener('click', handleOpenInteractiveSystem);
    }
    // ... (kekal sama)
}

document.addEventListener('DOMContentLoaded', () => {
    checkUserSession();
    initializeEventListeners();
});