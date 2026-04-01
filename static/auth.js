// ─── AUTH ───
function showMsg(msg, type) {
    const el = document.getElementById('authMessage');
    if (!el) return;
    el.textContent = msg;
    el.className = 'auth-message ' + type;
}

function showWelcome() {
    const w = document.getElementById('welcomeScreen');
    const f = document.getElementById('authForms');
    if (w) w.style.display = 'block';
    if (f) f.style.display = 'none';
}

function showLoginForm() {
    const w = document.getElementById('welcomeScreen');
    const f = document.getElementById('authForms');
    if (w) w.style.display = 'none';
    if (f) f.style.display = 'block';
    document.getElementById('loginFormSection').style.display = 'flex';
    document.getElementById('registerFormSection').style.display = 'none';
    document.getElementById('authMessage').className = 'auth-message';
}

function showRegisterForm() {
    const w = document.getElementById('welcomeScreen');
    const f = document.getElementById('authForms');
    if (w) w.style.display = 'none';
    if (f) f.style.display = 'block';
    document.getElementById('loginFormSection').style.display = 'none';
    document.getElementById('registerFormSection').style.display = 'flex';
    document.getElementById('authMessage').className = 'auth-message';
}

function togglePw(id) {
    const inp = document.getElementById(id);
    const btn = inp.parentElement.querySelector('.toggle-pw');
    if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
    else { inp.type = 'password'; btn.textContent = '👁️'; }
}

document.addEventListener('DOMContentLoaded', () => {
    const openLogin = document.getElementById('openLogin');
    if (openLogin) openLogin.addEventListener('click', () => {
        document.getElementById('loginOverlay').style.display = 'flex';
    });

    const showReg = document.getElementById('showRegister');
    if (showReg) showReg.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('loginFormSection').style.display = 'none';
        document.getElementById('registerFormSection').style.display = 'flex';
        document.getElementById('authMessage').className = 'auth-message';
    });

    const showLog = document.getElementById('showLogin');
    if (showLog) showLog.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('loginFormSection').style.display = 'flex';
        document.getElementById('registerFormSection').style.display = 'none';
        document.getElementById('authMessage').className = 'auth-message';
    });

    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) loginBtn.addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        if (!email || !password) { showMsg('All fields required', 'error'); return; }
        try {
            const res = await fetch('/api/login', {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (res.ok) { showMsg('Login successful!', 'success'); setTimeout(() => location.reload(), 800); }
            else showMsg(data.error, 'error');
        } catch (err) { console.error('Login error:', err); showMsg('Connection error: ' + err.message, 'error'); }
    });

    const regBtn = document.getElementById('registerBtn');
    if (regBtn) regBtn.addEventListener('click', async () => {
        const username = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const company = document.getElementById('regCompany').value.trim();
        const role = document.getElementById('regRole').value.trim();
        const password = document.getElementById('regPassword').value;
        if (!username || !email || !password) { showMsg('Name, email and password required', 'error'); return; }
        if (password.length < 6) { showMsg('Password must be at least 6 characters', 'error'); return; }
        try {
            const res = await fetch('/api/register', {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ username, email, password, company, role })
            });
            const data = await res.json();
            if (res.ok) { showMsg('Account created!', 'success'); setTimeout(() => location.reload(), 800); }
            else showMsg(data.error, 'error');
        } catch (err) { console.error('Register error:', err); showMsg('Connection error: ' + err.message, 'error'); }
    });

    // Enter key on login password
    const loginPw = document.getElementById('loginPassword');
    if (loginPw) loginPw.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('loginBtn').click();
    });
});
