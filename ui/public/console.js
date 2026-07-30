const consoleEl = document.getElementById('console');
const nameInput = document.getElementById('nameInput');

nameInput.value = localStorage.getItem('nickname') || '';
nameInput.addEventListener('input', () => {
    localStorage.setItem('nickname', nameInput.value);
});

document.getElementById('evalBtn').onclick = async () => {
    const code = document.getElementById('evalInput').value;
    consoleEl.innerHTML += `<div>&gt; ${code}</div>`;
    const res = await fetch('/eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code })
    });
    const { result } = await res.json();
    consoleEl.innerHTML += `<div>${result}</div>`;
    consoleEl.scrollTop = consoleEl.scrollHeight;
};

document.getElementById('chatBtn').onclick = async () => {
    const name = nameInput.value || 'Admin';
    const text = document.getElementById('chatInput').value;
    await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ text: `${name}: ${text}` })
    });
    document.getElementById('chatInput').value = '';
};

document.getElementById('closeBtn').onclick = async () => {
    await fetch('/close');
    document.location.href = "/";
};