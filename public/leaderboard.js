// leaderboard.js

document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('leaderboard-table-body');
    const loadingMessage = document.getElementById('loading-message');

    // Fungsi untuk mengambil dan memaparkan data papan pendahulu
    const fetchLeaderboardData = async () => {
        try {
            // Panggil API endpoint yang telah kita cipta
            const response = await fetch('/api/affiliate-leaderboard');

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Gagal memuatkan data papan pendahulu.');
            }

            const leaderboardData = await response.json();

            // Sembunyikan mesej "memuatkan"
            loadingMessage.style.display = 'none';

            // Kosongkan sebarang data lama
            tableBody.innerHTML = '';

            if (leaderboardData.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Tiada data affiliate buat masa ini.</td></tr>';
                return;
            }

            // Isikan jadual dengan data baru
            leaderboardData.forEach((affiliate, index) => {
                const row = tableBody.insertRow();
                
                row.insertCell().textContent = index + 1; // Pangkat
                row.insertCell().textContent = affiliate.name || 'Nama Tidak Ditetapkan'; // Nama Agen
                row.insertCell().textContent = `RM ${affiliate.total_sales.toFixed(2)}`; // Jumlah Jualan
            });

        } catch (error) {
            loadingMessage.style.display = 'none';
            tableBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: red;">Ralat: ${error.message}</td></tr>`;
            console.error('Ralat memuatkan papan pendahulu:', error);
        }
    };

    // Panggil fungsi untuk memuatkan data apabila halaman sedia
    fetchLeaderboardData();
});
