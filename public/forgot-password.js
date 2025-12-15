document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('forgot-password-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Forgot password form submitted.');

            const email = document.getElementById('email').value;
            const messageEl = document.getElementById('message');
            const button = e.target.querySelector('button');

            button.disabled = true;
            button.textContent = 'Menghantar...';
            messageEl.textContent = '';
            messageEl.classList.remove('error', 'success');

            try {
                // 'supabase' is now globally available from config.js
                if (typeof supabase === 'undefined') {
                    throw new Error('Supabase client is not initialized. Make sure config.js is loaded correctly.');
                }
                
                console.log(`Sending request for email: ${email}`);
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: 'https://sistemubbl.abrbrillante.com/reset-password.html',
                });

                if (error) {
                    console.error('Supabase password reset error:', error.message);
                    messageEl.textContent = `Ralat: ${error.message}`;
                    messageEl.classList.add('error');
                } else {
                    messageEl.textContent = 'Jika akaun dengan e-mel ini wujud, pautan set semula kata laluan telah dihantar.';
                    messageEl.classList.add('success');
                    form.reset();
                }
            } catch (error) {
                console.error('Fetch error in forgot-password:', error);
                messageEl.textContent = `Gagal menghubungi pelayan. Ralat: ${error.message}`;
                messageEl.classList.add('error');
            } finally {
                button.disabled = false;
                button.textContent = 'Hantar Pautan Set Semula';
                console.log('Process finished.');
            }
        });
    }
});
