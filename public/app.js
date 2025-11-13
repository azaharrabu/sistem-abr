const SUPABASE_URL = 'https://jtvkxeqjtkwrkwvpgafx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0dmt4ZXFqdGt3cmt3dnBnYWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzMjQyMjcsImV4cCI6MjA3NTkwMDIyN30.8OBj3JOMYqIBY64IHrLe5Gw2oOuztMaYTORcU3EuWuY';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Rujukan Elemen DOM ---
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const showSignup = document.getElementById('show-signup');
const showLogin = document.getElementById('show-login');
const loginContainer = document.getElementById('login-container');
const signupContainer = document.getElementById('signup-container');
const paymentProofForm = document.getElementById('payment-proof-form');
const openInteractiveButton = document.getElementById('open-interactive-button');
const pendingPaymentsTableBody = document.getElementById('pending-payments-table-body');

// Rujukan untuk semua bahagian utama
const sections = {
    auth: document.getElementById('auth-section'),
    payment: document.getElementById('payment-section'),
    pendingApproval: document.getElementById('pending-approval-section'),
    mainContent: document.getElementById('main-content-section'),
    adminPanel: document.getElementById('admin-panel-section')
};

// Rujukan untuk semua elemen info pengguna dan butang log keluar
const userInfos = {
    payment: document.getElementById('payment-user-info'),
    pending: document.getElementById('pending-user-info'),
    main: document.getElementById('main-user-info'),
    admin: document.getElementById('admin-user-info')
};

const logoutButtons = document.querySelectorAll('[id^="logout-button-"]');


// --- Fungsi Teras ---

// Fungsi untuk menyembunyikan semua bahagian utama
const hideAllSections = () => {
    Object.values(sections).forEach(section => section.style.display = 'none');
};

// Fungsi untuk memaparkan UI berdasarkan status & peranan pengguna
const showUi = (user, customer) => {
    hideAllSections();

    if (!user || !customer) {
        sections.auth.style.display = 'block';
        signupContainer.style.display = 'block';
        loginContainer.style.display = 'none';
        return;
    }

    const emailDisplay = `Log masuk sebagai: <strong>${user.email}</strong>`;

    if (customer.role === 'admin') {
        sections.adminPanel.style.display = 'block';
        userInfos.admin.innerHTML = emailDisplay;
        fetchPendingPayments();
    } else if (customer.role === 'user') {
        if (customer.payment_status === 'paid') {
            sections.mainContent.style.display = 'block';
            userInfos.main.innerHTML = emailDisplay;
        } else if (customer.payment_status === 'pending') {
            // Jika ada rujukan pembayaran, tunjukkan skrin menunggu kelulusan
            if (customer.payment_reference) {
                sections.pendingApproval.style.display = 'block';
                userInfos.pending.innerHTML = emailDisplay;
            } else { // Jika tidak, tunjukkan skrin untuk hantar bukti pembayaran
                sections.payment.style.display = 'block';
                userInfos.payment.innerHTML = emailDisplay;
            }
        } else if (customer.payment_status === 'rejected') {
            // Jika ditolak, kembali ke skrin pembayaran dengan mesej
            sections.payment.style.display = 'block';
            userInfos.payment.innerHTML = emailDisplay;
            alert('Pembayaran anda sebelum ini telah ditolak. Sila buat pembayaran baru dan hantar semula bukti pembayaran.');
        }
    } else {
        sections.auth.style.display = 'block';
    }
};

// Fungsi untuk log keluar
async function handleSignOut() {
    await _supabase.auth.signOut();
    localStorage.removeItem('customerProfile');
    hideAllSections();
    sections.auth.style.display = 'block';
    signupContainer.style.display = 'block';
    loginContainer.style.display = 'none';
}

// Fungsi utama untuk memeriksa sesi pengguna semasa memuatkan halaman
const checkUserSession = async () => {
    const { data: { session } } = await _supabase.auth.getSession();
    
    if (session) {
        let customerProfile = JSON.parse(localStorage.getItem('customerProfile'));

        // Pastikan profil di local storage sepadan dengan sesi
        if (!customerProfile || customerProfile.user_id !== session.user.id) {
            const token = session.access_token;
            const response = await fetch('/api/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                customerProfile = await response.json();
                localStorage.setItem('customerProfile', JSON.stringify(customerProfile));
            } else {
                // Jika gagal dapatkan profil, log keluar
                handleSignOut();
                return;
            }
        }
        
        showUi(session.user, customerProfile);
    } else {
        showUi(null, null);
    }
};

// --- Pengendali Acara (Event Handlers) ---

// Mengendalikan pendaftaran dan log masuk
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
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Ralat tidak diketahui');

        // Selepas daftar atau log masuk, simpan sesi dan profil, kemudian paparkan UI yang betul
        await _supabase.auth.setSession(data.session);
        localStorage.setItem('customerProfile', JSON.stringify(data.customer));
        showUi(data.user, data.customer);

    } catch (error) {
        alert(`Ralat: ${error.message}`);
    }
    form.reset();
}

// Menghantar bukti pembayaran
async function handlePaymentProofSubmit(event) {
    event.preventDefault();
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) {
        alert('Sesi anda telah tamat. Sila log masuk semula.');
        return;
    }

    const payment_reference = document.getElementById('payment-reference').value;
    if (!payment_reference.trim()) {
        alert('Sila masukkan nombor rujukan bank.');
        return;
    }

    try {
        const response = await fetch('/api/submit-payment-proof', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ payment_reference })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Gagal menghantar bukti pembayaran.');

        // Kemas kini profil di local storage dan paparkan UI menunggu
        let customerProfile = JSON.parse(localStorage.getItem('customerProfile'));
        customerProfile.payment_reference = payment_reference;
        localStorage.setItem('customerProfile', JSON.stringify(customerProfile));
        
        showUi(session.user, customerProfile);

    } catch (error) {
        alert(`Ralat: ${error.message}`);
    }
}

// Membuka sistem interaktif
function handleOpenInteractiveSystem() {
    window.open('rujukan_interaktif.html', '_blank');
}


// --- Fungsi-fungsi Admin ---

const getSessionToken = async () => {
    const { data: { session } } = await _supabase.auth.getSession();
    return session ? session.access_token : null;
};

async function fetchPendingPayments() {
    const token = await getSessionToken();
    if (!token) {
        pendingPaymentsTableBody.innerHTML = '<tr><td colspan="6">Sesi tidak sah.</td></tr>';
        return;
    }

    try {
        const response = await fetch('/api/users', { // Ambil semua pengguna
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Gagal mengambil data.');

        const users = await response.json();
        const pendingPayments = users.filter(user => user.payment_status === 'pending' && user.payment_reference);

        pendingPaymentsTableBody.innerHTML = '';
        if (pendingPayments.length === 0) {
            pendingPaymentsTableBody.innerHTML = '<tr><td colspan="6">Tiada permintaan pembayaran tertunda.</td></tr>';
            return;
        }

        pendingPayments.forEach(user => {
            const row = pendingPaymentsTableBody.insertRow();
            row.innerHTML = `
                <td>${user.email}</td>
                <td>${user.subscription_plan}</td>
                <td>RM${user.subscription_price}</td>
                <td>${user.payment_reference || 'Tiada'}</td>
                <td><button class="approve-button" data-user-id="${user.id}">Luluskan</button></td>
                <td><button class="reject-button" data-user-id="${user.id}">Tolak</button></td>
            `;
        });

    } catch (error) {
        pendingPaymentsTableBody.innerHTML = `<tr><td colspan="6" style="color: red;">Ralat: ${error.message}</td></tr>`;
    }
}

async function handlePaymentAction(event, action) {
    const button = event.target;
    const userId = button.dataset.userId;
    if (!userId) return;

    const confirmationMessage = action === 'approve' 
        ? 'Anda pasti mahu meluluskan pembayaran ini?'
        : 'Anda pasti mahu menolak pembayaran ini?';
    
    if (!confirm(confirmationMessage)) return;

    const token = await getSessionToken();
    if (!token) {
        alert('Sesi anda telah tamat.');
        return;
    }

    const endpoint = `/api/users/${userId}/${action}`;
    const method = action === 'approve' ? 'POST' : 'DELETE'; // Guna POST untuk lulus, DELETE untuk tolak

    try {
        const response = await fetch(endpoint, {
            method: method,
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Gagal ${action} pembayaran.`);

        alert(`Pembayaran berjaya di${action === 'approve' ? 'luluskan' : 'tolak'}!`);
        fetchPendingPayments();

    } catch (error) {
        alert(`Ralat: ${error.message}`);
    }
}


// --- Pemasangan Event Listeners ---
document.addEventListener('DOMContentLoaded', checkUserSession);

// Tukar antara borang daftar & log masuk
showSignup.addEventListener('click', (e) => { e.preventDefault(); loginContainer.style.display = 'none'; signupContainer.style.display = 'block'; });
showLogin.addEventListener('click', (e) => { e.preventDefault(); signupContainer.style.display = 'none'; loginContainer.style.display = 'block'; });

// Hantar borang
loginForm.addEventListener('submit', (e) => handleAuth(e, '/api/signin'));
signupForm.addEventListener('submit', (e) => handleAuth(e, '/api/signup'));
paymentProofForm.addEventListener('submit', handlePaymentProofSubmit);

// Butang utama
openInteractiveButton.addEventListener('click', handleOpenInteractiveSystem);
logoutButtons.forEach(button => button.addEventListener('click', handleSignOut));

// Tindakan Admin
pendingPaymentsTableBody.addEventListener('click', (e) => {
    if (e.target.classList.contains('approve-button')) {
        handlePaymentAction(e, 'approve');
    }
    if (e.target.classList.contains('reject-button')) {
        handlePaymentAction(e, 'reject');
    }
});