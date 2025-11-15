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

// Bahagian-bahagian utama aplikasi
const paymentSection = document.getElementById('payment-section');
const pendingApprovalSection = document.getElementById('pending-approval-section');
const mainContentSection = document.getElementById('main-content-section');
const adminPanelSection = document.getElementById('admin-panel-section');

// Borang dan butang lain
const paymentProofForm = document.getElementById('payment-proof-form');
const openInteractiveButton = document.getElementById('open-interactive-button');
const pendingPaymentsTableBody = document.getElementById('pending-payments-table-body');

// Elemen yang dikongsi (diuruskan secara berasingan dalam fungsi UI)
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

    // Sembunyikan semua bahagian utama dahulu

    authSection.style.display = 'none';

    paymentSection.style.display = 'none';

    pendingApprovalSection.style.display = 'none';

    mainContentSection.style.display = 'none';

    adminPanelSection.style.display = 'none';



    // Paparkan maklumat pengguna di semua tempat yang berkenaan

    userInfoDisplays.forEach(display => {

        if (user && user.email) {

            display.innerHTML = `Log masuk sebagai: <strong>${user.email}</strong>`;

        } else {

            display.innerHTML = '';

        }

    });



    if (profile && profile.role === 'admin') {

        adminPanelSection.style.display = 'block';

        fetchPendingPayments(token); // Hantar token terus ke fungsi

    } 

    else if (profile && profile.role === 'user') {

        // Semak status pembayaran pengguna

        switch (profile.payment_status) {

            case 'paid':

                mainContentSection.style.display = 'block'; // Pengguna yang telah bayar

                break;

            case 'pending':

                pendingApprovalSection.style.display = 'block'; // Pengguna menunggu kelulusan

                break;

            case 'rejected':

            default:

                // Untuk status 'rejected' atau status tidak diketahui, tunjukkan skrin pembayaran

                paymentSection.style.display = 'block'; 

                break;

        }

    } 

    else {

        // Jika tiada profil atau berlaku ralat, hantar pengguna ke skrin log masuk

        console.warn("showUi dipanggil tanpa profil yang sah atau pengguna bukan admin/user. Kembali ke Auth.");

        showAuth();

    }

};



// Fungsi untuk memaparkan borang log masuk/daftar

const showAuth = () => {

    authSection.style.display = 'block';

    

    // Sembunyikan semua bahagian lain

    paymentSection.style.display = 'none';

    pendingApprovalSection.style.display = 'none';

    mainContentSection.style.display = 'none';

    adminPanelSection.style.display = 'none';



    // Tetapkan semula borang

    signupContainer.style.display = 'none';

    loginContainer.style.display = 'block'; // Tunjuk borang log masuk secara lalai

    

    localStorage.removeItem('customerProfile');

};



// Fungsi utama untuk memeriksa sesi pengguna semasa memuatkan halaman

const checkUserSession = async () => {

    const { data: { session } } = await _supabase.auth.getSession();

    

    if (session) {

        let customerProfile = JSON.parse(localStorage.getItem('customerProfile'));



        // Jika tiada profil dalam cache atau profil tidak sepadan, dapatkan dari server

        if (!customerProfile || customerProfile.user_id !== session.user.id) {

            console.log("Mendapatkan profil dari server...");

            const token = session.access_token;

            const response = await fetch('/api/profile', {

                headers: { 'Authorization': `Bearer ${token}` }

            });

            if (response.ok) {

                customerProfile = await response.json();

                localStorage.setItem('customerProfile', JSON.stringify(customerProfile));

            } else {

                console.error("Gagal mendapatkan profil, log keluar...");

                handleSignOut(); // Log keluar jika gagal dapatkan profil

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

            // Pastikan data yang diterima adalah betul

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



function initializeEventListeners() {

    if (showSignup && loginContainer && signupContainer) {

        showSignup.addEventListener('click', (e) => { e.preventDefault(); loginContainer.style.display = 'none'; signupContainer.style.display = 'block'; });

    }

    if (showLogin && signupContainer && loginContainer) {

        showLogin.addEventListener('click', (e) => { e.preventDefault(); signupContainer.style.display = 'none'; loginContainer.style.display = 'block'; });

    }



    if (loginForm) loginForm.addEventListener('submit', (e) => handleAuth(e, '/api/signin'));

    if (signupForm) signupForm.addEventListener('submit', (e) => handleAuth(e, '/api/signup'));



    logoutButtons.forEach(button => {

        button.addEventListener('click', handleSignOut);

    });



    if (paymentProofForm) paymentProofForm.addEventListener('submit', handlePaymentProofSubmit);

    if (openInteractiveButton) openInteractiveButton.addEventListener('click', handleOpenInteractiveSystem);



    // Event listener untuk admin

    const addCustomerForm = document.getElementById('add-customer-form');

    if (addCustomerForm) addCustomerForm.addEventListener('submit', handleAddCustomer);

    

    const customerList = document.getElementById('customer-list');

    if (customerList) customerList.addEventListener('click', handleDeleteCustomer);



    // Listener untuk jadual admin tidak lagi diperlukan di sini kerana ia ditambah secara terus

}



document.addEventListener('DOMContentLoaded', () => {

    checkUserSession();

    initializeEventListeners();

});