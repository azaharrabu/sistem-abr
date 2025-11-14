const SUPABASE_URL = 'https://jtvkxeqjtkwrkwvpgafx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0dmt4ZXFqdGt3cmt3dnBnYWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzMjQyMjcsImV4cCI6MjA3NTkwMDIyN30.8OBj3JOMYqIBY64IHrLe5Gw2oOuztMaYTORcU3EuWuY';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Rujukan kepada elemen DOM
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const logoutButton = document.getElementById('logout-button');
const showSignup = document.getElementById('show-signup');
const showLogin = document.getElementById('show-login');
const loginContainer = document.getElementById('login-container');
const signupContainer = document.getElementById('signup-container');
const userInfo = document.getElementById('user-info');
const navLinksContainer = document.getElementById('nav-links-container');
const openInteractiveButton = document.getElementById('open-interactive-button');

// Elemen untuk aliran baru
const paymentVerificationSection = document.getElementById('payment-verification-section');
const paymentProofForm = document.getElementById('payment-proof-form');
const paymentMessage = document.getElementById('payment-message');
const adminPanelSection = document.getElementById('admin-panel-section');
const pendingPaymentsTableBody = document.getElementById('pending-payments-table-body');
const adminSections = {
    addCustomer: document.getElementById('admin-add-customer-section'),
    customerListHeader: document.getElementById('admin-customer-list-header'),
    customerList: document.getElementById('customer-list')
};


// Fungsi untuk mendapatkan token sesi semasa
const getSessionToken = async () => {
    const { data: { session } } = await _supabase.auth.getSession();
    return session ? session.access_token : null;
};

// Fungsi untuk mengambil dan memaparkan permintaan pembayaran tertunda
async function fetchPendingPayments() {
    const token = await getSessionToken();
    if (!token) {
        pendingPaymentsTableBody.innerHTML = '<tr><td colspan="5">Sesi tidak sah. Sila log masuk semula.</td></tr>';
        return;
    }

    try {
        const response = await fetch('/api/customers', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Gagal mengambil data pelanggan.');

        const customers = await response.json();
        const pendingPayments = customers.filter(customer => customer.payment_status === 'pending');

        pendingPaymentsTableBody.innerHTML = ''; // Kosongkan jadual sedia ada

        if (pendingPayments.length === 0) {
            pendingPaymentsTableBody.innerHTML = '<tr><td colspan="5">Tiada permintaan pembayaran tertunda.</td></tr>';
            return;
        }

        pendingPayments.forEach(customer => {
            const row = pendingPaymentsTableBody.insertRow();
            row.innerHTML = `
                <td>${customer.email}</td>
                <td>${customer.subscription_plan}</td>
                <td>RM${customer.subscription_price}</td>
                <td>${customer.payment_reference || 'Tiada'}</td>
                <td><button class="approve-button" data-customer-id="${customer.id}">Luluskan</button></td>
                <td><button class="reject-button" data-customer-id="${customer.id}">Tolak</button></td>
            `;
        });

    } catch (error) {
        pendingPaymentsTableBody.innerHTML = `<tr><td colspan="5" style="color: red;">Ralat: ${error.message}</td></tr>`;
    }
}

// Fungsi untuk menolak pembayaran
async function handleRejectPayment(event) {
    if (!event.target.classList.contains('reject-button')) return;

    const customerId = event.target.dataset.customerId;
    if (!customerId) {
        alert('ID pelanggan tidak ditemui.');
        return;
    }

    if (!confirm('Anda pasti mahu menolak pembayaran ini? Tindakan ini tidak boleh diundur.')) {
        return;
    }

    const token = await getSessionToken();
    if (!token) {
        alert('Sesi anda telah tamat. Sila log masuk semula.');
        return;
    }

    try {
        const response = await fetch(`/api/customers/${customerId}/reject`, {
            method: 'DELETE', // Menggunakan DELETE untuk penolakan
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Gagal menolak pembayaran.');

        alert('Pembayaran berjaya ditolak!');
        fetchPendingPayments(); // Muat semula senarai pembayaran tertunda

    } catch (error) {
        alert(`Ralat: ${error.message}`);
    }
}

// Fungsi untuk meluluskan pembayaran
async function handleApprovePayment(event) {
    if (!event.target.classList.contains('approve-button')) return;

    const customerId = event.target.dataset.customerId;
    if (!customerId) {
        alert('ID pelanggan tidak ditemui.');
        return;
    }

    if (!confirm('Anda pasti mahu meluluskan pembayaran ini?')) {
        return;
    }

    const token = await getSessionToken();
    if (!token) {
        alert('Sesi anda telah tamat. Sila log masuk semula.');
        return;
    }

    try {
        const response = await fetch(`/api/customers/${customerId}/approve`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Gagal meluluskan pembayaran.');

        alert('Pembayaran berjaya diluluskan!');
        fetchPendingPayments(); // Muat semula senarai pembayaran tertunda

    } catch (error) {
        alert(`Ralat: ${error.message}`);
    }
}

// Fungsi untuk memaparkan UI berdasarkan status & peranan pengguna
const showUi = (user, customer) => {
    authSection.style.display = 'none';
    dashboardSection.style.display = 'block';
    userInfo.innerHTML = `Log masuk sebagai: <strong>${user.email}</strong>`;

    // Sembunyikan semua bahagian spesifik secara lalai
    navLinksContainer.style.display = 'none';
    paymentVerificationSection.style.display = 'none';
    Object.values(adminSections).forEach(el => el.style.display = 'none');
    adminPanelSection.style.display = 'none'; // Sembunyikan admin panel secara lalai

    if (customer && customer.role === 'admin') {
        adminPanelSection.style.display = 'block'; // Paparkan admin panel
        fetchPendingPayments(); // Muatkan pembayaran tertunda
        // Sembunyikan bahagian admin lain yang tidak berkaitan dengan kelulusan pembayaran
        adminSections.addCustomer.style.display = 'none';
        adminSections.customerListHeader.style.display = 'none';
        adminSections.customerList.style.display = 'none';
    } 
    else if (customer && customer.role === 'user') {
        if (customer.payment_status === 'paid') {
            navLinksContainer.style.display = 'block';
        } else if (customer.payment_status === 'pending') {
            paymentVerificationSection.style.display = 'block';
        }
    } 
    else {
        showAuth();
    }
};

// Fungsi untuk memaparkan borang log masuk/daftar
const showAuth = () => {
    authSection.style.display = 'block';
    dashboardSection.style.display = 'none';
    navLinksContainer.style.display = 'none';
    loginContainer.style.display = 'none';
    signupContainer.style.display = 'block';
    localStorage.removeItem('customerProfile');
};

// Fungsi utama untuk memeriksa sesi pengguna semasa memuatkan halaman
const checkUserSession = async () => {
    const { data: { session } } = await _supabase.auth.getSession();
    
    if (session) {
        let customerProfile = JSON.parse(localStorage.getItem('customerProfile'));

        if (!customerProfile || customerProfile.user_id !== session.user.id) {
            const token = await getSessionToken();
            const response = await fetch('/api/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                customerProfile = await response.json();
                localStorage.setItem('customerProfile', JSON.stringify(customerProfile));
            } else {
                handleSignOut();
                return;
            }
        }
        
        showUi(session.user, customerProfile);
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
            await _supabase.auth.setSession(data.session);
            localStorage.setItem('customerProfile', JSON.stringify(data.customer));
            showUi(data.user, data.customer);
        } else { 
            alert('Pendaftaran berjaya! Sila log masuk untuk membuat pengesahan pembayaran.');
            signupContainer.style.display = 'none';
            loginContainer.style.display = 'block';
        }
    } catch (error) {
        alert(`Ralat: ${error.message}`);
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

    const referenceInput = document.getElementById('payment-reference');
    const payment_reference = referenceInput.value;

    if (!payment_reference.trim()) {
        alert('Sila masukkan nombor rujukan bank.');
        return;
    }

    try {
        const response = await fetch('/api/submit-payment-proof', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ payment_reference })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Gagal menghantar bukti pembayaran.');

        paymentMessage.style.color = 'green';
        paymentMessage.textContent = 'Terima kasih. Permohonan anda akan disemak dan diproses dalam masa 3 hari bekerja.';
        paymentProofForm.style.display = 'none'; // Sembunyikan borang selepas berjaya

    } catch (error) {
        paymentMessage.style.color = 'red';
        paymentMessage.textContent = `Ralat: ${error.message}`;
    }
}

// Fungsi untuk membuka sistem interaktif yang dilindungi
async function handleOpenInteractiveSystem() {
    const token = await getSessionToken();
    if (!token) {
        alert("Sesi tidak sah. Sila log masuk semula.");
        return;
    }

    try {
        const response = await fetch('/rujukan_interaktif.html', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const pageBlob = await response.blob();
            const pageUrl = URL.createObjectURL(pageBlob);
            window.open(pageUrl, '_blank');
        } else {
            throw new Error('Akses ditolak. Langganan anda mungkin tidak aktif.');
        }
    } catch (error) {
        alert(`Ralat: ${error.message}`);
    }
}

// Fungsi untuk log keluar
async function handleSignOut() {
    await _supabase.auth.signOut();
    localStorage.removeItem('customerProfile');
    showAuth();
    window.location.href = '/';
}

// --- FUNGSI-FUNGSI ADMIN (Tidak berubah) ---
async function fetchCustomers() {
    const token = await getSessionToken();
    if (!token) return;
    try {
        const response = await fetch('/api/customers', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error((await response.json()).error);
        const customers = await response.json();
        adminSections.customerList.innerHTML = customers.length ? '' : '<p>Tiada data pelanggan.</p>';
        customers.forEach(customer => {
            const el = document.createElement('div');
            el.classList.add('customer-item');
            el.innerHTML = `<div><strong>${customer.name || customer.email}</strong><br><small>${customer.subscription_plan || ''}</small></div><button class="delete-button" data-id="${customer.id}">Padam</button>`;
            adminSections.customerList.appendChild(el);
        });
    } catch (error) {
        adminSections.customerList.innerHTML = `<p style="color: red;">${error.message}</p>`;
    }
}

async function handleAddCustomer(event) {
    event.preventDefault();
    const token = await getSessionToken();
    if (!token) return;
    const name = document.getElementById('customer-name').value;
    const email = document.getElementById('customer-email').value;
    const phone = document.getElementById('customer-phone').value;
    await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name, email, phone })
    });
    fetchCustomers();
    document.getElementById('add-customer-form').reset();
}

async function handleDeleteCustomer(event) {
    if (!event.target.classList.contains('delete-button')) return;
    if (confirm('Anda pasti mahu padam pelanggan ini?')) {
        const token = await getSessionToken();
        if (!token) return;
        await fetch(`/api/customers/${event.target.dataset.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchCustomers();
    }
}

// Event Listeners
showSignup.addEventListener('click', (e) => { e.preventDefault(); loginContainer.style.display = 'none'; signupContainer.style.display = 'block'; });
showLogin.addEventListener('click', (e) => { e.preventDefault(); signupContainer.style.display = 'none'; loginContainer.style.display = 'block'; });

loginForm.addEventListener('submit', (e) => handleAuth(e, '/api/signin'));
signupForm.addEventListener('submit', (e) => handleAuth(e, '/api/signup'));
logoutButton.addEventListener('click', handleSignOut);
paymentProofForm.addEventListener('submit', handlePaymentProofSubmit);
openInteractiveButton.addEventListener('click', handleOpenInteractiveSystem);

// Event listener untuk admin
document.getElementById('add-customer-form').addEventListener('submit', handleAddCustomer);
document.getElementById('customer-list').addEventListener('click', handleDeleteCustomer);
pendingPaymentsTableBody.addEventListener('click', handleApprovePayment); // Event listener untuk butang luluskan
pendingPaymentsTableBody.addEventListener('click', handleRejectPayment); // Event listener untuk butang tolak

document.addEventListener('DOMContentLoaded', checkUserSession);