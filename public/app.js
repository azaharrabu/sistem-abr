const SUPABASE_URL = 'https://jtvkxeqjtkwrkwvpgafx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0dmt4ZXFqdGt3cmt3dnBnYWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzMjQyMjcsImV4cCI6MjA3NTkwMDIyN30.8OBj3JOMYqIBY64IHrLe5Gw2oOuztMaYTORcU3EuWuY';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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

// Fungsi untuk mendapatkan token sesi semasa
const getSessionToken = async () => {
    const { data: { session } } = await _supabase.auth.getSession();
    return session ? session.access_token : null;
};

// Fungsi untuk mengambil dan memaparkan permintaan pembayaran tertunda
async function fetchPendingPayments(token) {
    if (!token) {
        token = await getSessionToken();
    }
    if (!token) {
        pendingPaymentsTableBody.innerHTML = '<tr><td colspan="6">Sesi tidak sah. Sila log masuk semula.</td></tr>';
        return;
    }

    try {
        const response = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Gagal mengambil data pengguna.');

        const users = await response.json();
        const pendingPayments = users.filter(user => user.payment_status === 'pending');

        pendingPaymentsTableBody.innerHTML = '';

        if (pendingPayments.length === 0) {
            pendingPaymentsTableBody.innerHTML = '<tr><td colspan="6">Tiada permintaan pembayaran tertunda.</td></tr>';
            return;
        }

        pendingPayments.forEach(user => {
            const row = pendingPaymentsTableBody.insertRow();

            row.insertCell().textContent = user.email;
            row.insertCell().textContent = user.subscription_plan;
            row.insertCell().textContent = `RM${user.subscription_price}`;
            row.insertCell().textContent = user.payment_reference || 'Tiada';

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
        pendingPaymentsTableBody.innerHTML = `<tr><td colspan="6" style="color: red;">Ralat: ${error.message}</td></tr>`;
    }
}

// Fungsi untuk menolak pembayaran
async function handleRejectPayment(event, customerId, token) {
    if (!customerId) {
        alert('Ralat: ID pengguna tidak ditemui.');
        return;
    }
    if (!confirm('Anda pasti mahu menolak pembayaran ini? Tindakan ini tidak boleh diundur.')) {
        return;
    }
    if (!token) {
        alert('Sesi anda telah tamat. Sila log masuk semula.');
        return;
    }

    try {
        const response = await fetch(`/api/users/${customerId}/reject`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Gagal menolak pembayaran.');

        alert('Pembayaran berjaya ditolak!');
        fetchPendingPayments(token);

    } catch (error) {
        alert(`Ralat: ${error.message}`);
    }
}

// Fungsi untuk meluluskan pembayaran
async function handleApprovePayment(event, customerId, token) {
    if (!customerId) {
        alert('Ralat: ID pengguna tidak ditemui.');
        return;
    }
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
        if (!response.ok) throw new Error(data.error || 'Gagal meluluskan pembayaran.');

        alert('Pembayaran berjaya diluluskan!');
        fetchPendingPayments(token);

    } catch (error) {
        alert(`Ralat: ${error.message}`);
    }
}

// Fungsi untuk memaparkan UI berdasarkan status & peranan pengguna
const showUi = (user, profile, token) => {
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
    const token = await getSessionToken();
    if (!token) {
        alert('Sesi anda telah tamat. Sila log masuk semula.');
        return;
    }

    // Dapatkan nilai dari semua medan borang
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
        const response = await fetch('/api/submit-payment', { // Guna endpoint baru
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Gagal menghantar bukti pembayaran.');

        // Kemas kini UI selepas berjaya hantar
        alert('Terima kasih. Permohonan anda akan disemak dan diproses dalam masa 3 hari bekerja.');
        paymentSection.style.display = 'none';
        pendingApprovalSection.style.display = 'block';

    } catch (error) {
        alert(`Ralat: ${error.message}`);
    }
}

// Fungsi untuk membuka sistem interaktif yang dilindungi
function handleOpenInteractiveSystem() {
    // Pengguna sudah disahkan kerana mereka boleh melihat butang ini.
    // Halaman ini adalah fail statik dan tidak dilindungi oleh pengesahan API.
    // Oleh itu, kita boleh membukanya secara terus.
    window.open('/rujukan_interaktif.html', '_blank');
}

// Fungsi untuk log keluar
async function handleSignOut() {
    await _supabase.auth.signOut();
    localStorage.removeItem('customerProfile');
    showAuth();
    window.location.href = '/';
}

// --- FUNGSI-FUNGSI ADMIN (Tidak digunakan dalam aliran utama) ---
async function fetchCustomers() {
    const token = await getSessionToken();
    if (!token) return;
    try {
        const response = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error((await response.json()).error);
        const users = await response.json();
        const customerList = document.getElementById('customer-list');
        if (customerList) {
            customerList.innerHTML = users.length ? '' : '<p>Tiada data pelanggan.</p>';
            users.forEach(user => {
                const el = document.createElement('div');
                el.classList.add('customer-item');
                el.innerHTML = `<div><strong>${user.name || user.email}</strong><br><small>${user.subscription_plan || ''}</small></div><button class="delete-button" data-id="${user.id}">Padam</button>`;
                customerList.appendChild(el);
            });
        }
    } catch (error) {
        const customerList = document.getElementById('customer-list');
        if(customerList) customerList.innerHTML = `<p style="color: red;">${error.message}</p>`;
    }
}

async function handleAddCustomer(event) {
    event.preventDefault();
    const token = await getSessionToken();
    if (!token) return;
    const name = document.getElementById('customer-name').value;
    const email = document.getElementById('customer-email').value;
    const phone = document.getElementById('customer-phone').value;
    await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name, email, phone })
    });
    fetchCustomers();
    event.target.reset();
}

async function handleDeleteCustomer(event) {
    if (!event.target.classList.contains('delete-button')) return;
    if (confirm('Anda pasti mahu padam pelanggan ini?')) {
        const token = await getSessionToken();
        if (!token) return;
        await fetch(`/api/users/${event.target.dataset.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchCustomers();
    }
}

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
    const addCustomerForm = document.getElementById('add-customer-form');
    if (addCustomerForm) {
        addCustomerForm.addEventListener('submit', handleAddCustomer);
    }
    const customerList = document.getElementById('customer-list');
    if (customerList) {
        customerList.addEventListener('click', handleDeleteCustomer);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    checkUserSession();
    initializeEventListeners();
});
