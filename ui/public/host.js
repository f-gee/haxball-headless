const tokenInput = document.getElementById('tokenInput');
if (tokenInput) {
    const savedToken = localStorage.getItem('hb_token');
    const savedTokenTime = localStorage.getItem('hb_token_time');

    if (savedToken && savedTokenTime) {
        const ageMs = Date.now() - parseInt(savedTokenTime, 10);
        const oneHourMs = 60 * 60 * 1000;
        if (ageMs < oneHourMs) {
            tokenInput.value = savedToken;
        }
    }

    tokenInput.closest('form').addEventListener('submit', () => {
        localStorage.setItem('hb_token', tokenInput.value);
        localStorage.setItem('hb_token_time', Date.now().toString());
    });
}