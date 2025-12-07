// public/competition-leaderboard.js

document.addEventListener('DOMContentLoaded', () => {
    // Get references to DOM elements
    const startDateInput = document.getElementById('start_date');
    const endDateInput = document.getElementById('end_date');
    const viewButton = document.getElementById('view_button');
    const tableBody = document.getElementById('leaderboard-table-body');
    const loadingMessage = document.getElementById('loading-message');

    // Set default dates for user convenience
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startDateInput.value = firstDayOfMonth.toISOString().split('T')[0];
    endDateInput.value = today.toISOString().split('T')[0];

    const fetchCompetitionData = async () => {
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;

        // 1. Validate inputs
        if (!startDate || !endDate) {
            tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: red;">Sila pilih tarikh mula dan tamat.</td></tr>';
            return;
        }

        // 2. Show loading state
        loadingMessage.style.display = 'block';
        tableBody.innerHTML = '';

        try {
            // 3. Fetch data from the new API endpoint
            const response = await fetch(`/api/competition-leaderboard?start_date=${startDate}&end_date=${endDate}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Gagal memuatkan data papan pendahulu.');
            }

            const leaderboardData = await response.json();

            // 4. Hide loading message
            loadingMessage.style.display = 'none';

            if (leaderboardData.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Tiada data jualan untuk tempoh yang dipilih.</td></tr>';
                return;
            }

            // 5. Populate the table with data
            leaderboardData.forEach(item => {
                const row = tableBody.insertRow();
                row.insertCell().textContent = item.rank;
                row.insertCell().textContent = item.name || 'Nama Tidak Ditetapkan';
                // Format sales as currency
                const sales = parseFloat(item.total_sales || 0);
                row.insertCell().textContent = `RM ${sales.toFixed(2)}`;
            });

        } catch (error) {
            // 6. Handle errors
            loadingMessage.style.display = 'none';
            tableBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: red;">Ralat: ${error.message}</td></tr>`;
            console.error('Ralat memuatkan papan pendahulu pertandingan:', error);
        }
    };

    // Add event listener to the button
    viewButton.addEventListener('click', fetchCompetitionData);
});
