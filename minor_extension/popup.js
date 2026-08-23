document.addEventListener('DOMContentLoaded', () => {
    const loggedOutView = document.getElementById('loggedOutView');
    const loggedInView = document.getElementById('loggedInView');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const errorMessage = document.getElementById('errorMessage');
    const displayUsername = document.getElementById('displayUsername');
    const forgotPasswordView = document.getElementById('forgotPasswordView');
    const showForgotBtn = document.getElementById('showForgotBtn');
    const backToLoginBtn = document.getElementById('backToLoginBtn');
    const resetUsernameInput = document.getElementById('resetUsername');
    const newPasswordInput = document.getElementById('newPassword');
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    const successMessage = document.getElementById('successMessage');
    const loader = document.getElementById('loader');

    const API_BASE = "http://localhost:3000";

    // Check auth status on load
    checkAuthStatus();

    async function checkAuthStatus() {
        chrome.storage.local.get(["authToken", "username"], (res) => {
            if (res.authToken && res.username) {
                showLoggedIn(res.username);
            } else {
                showLoggedOut();
            }
        });
    }

    function showLoggedIn(username) {
        loggedOutView.classList.add('hidden');
        forgotPasswordView.classList.add('hidden');
        loggedInView.classList.remove('hidden');
        displayUsername.textContent = username;
    }

    function showLoggedOut() {
        loggedInView.classList.add('hidden');
        forgotPasswordView.classList.add('hidden');
        loggedOutView.classList.remove('hidden');
        usernameInput.value = '';
        passwordInput.value = '';
        errorMessage.classList.add('hidden');
        successMessage.classList.add('hidden');
    }

    function showForgotPassword() {
        loggedInView.classList.add('hidden');
        loggedOutView.classList.add('hidden');
        forgotPasswordView.classList.remove('hidden');
        resetUsernameInput.value = '';
        newPasswordInput.value = '';
        errorMessage.classList.add('hidden');
        successMessage.classList.add('hidden');
    }

    function showError(msg) {
        errorMessage.textContent = msg;
        errorMessage.classList.remove('hidden');
        successMessage.classList.add('hidden');
    }

    function showSuccess(msg) {
        successMessage.textContent = msg;
        successMessage.classList.remove('hidden');
        errorMessage.classList.add('hidden');
    }

    function toggleLoading(isLoading) {
        if (isLoading) {
            loader.classList.remove('hidden');
            loginBtn.disabled = true;
            registerBtn.disabled = true;
            resetPasswordBtn.disabled = true;
        } else {
            loader.classList.add('hidden');
            loginBtn.disabled = false;
            registerBtn.disabled = false;
            resetPasswordBtn.disabled = false;
        }
    }

    async function handleAuth(action) {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            showError("Username and password are required.");
            return;
        }

        toggleLoading(true);
        errorMessage.classList.add('hidden');
        successMessage.classList.add('hidden');

        try {
            const res = await fetch(`${API_BASE}/auth/${action}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Authentication failed");
            }

            // Save token securely in extension storage
            chrome.storage.local.set({
                authToken: data.token,
                username: data.username
            }, () => {
                showLoggedIn(data.username);
            });

        } catch (err) {
            showError(err.message);
        } finally {
            toggleLoading(false);
        }
    }

    async function handleResetPassword() {
        const username = resetUsernameInput.value.trim();
        const newPassword = newPasswordInput.value;

        if (!username || !newPassword) {
            showError("Username and new password are required.");
            return;
        }

        toggleLoading(true);
        errorMessage.classList.add('hidden');
        successMessage.classList.add('hidden');

        try {
            const res = await fetch(`${API_BASE}/auth/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, newPassword })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Password reset failed");
            }

            showSuccess("Password reset successfully. You can now sign in.");
            setTimeout(() => {
                showLoggedOut();
            }, 2000);

        } catch (err) {
            showError(err.message);
        } finally {
            toggleLoading(false);
        }
    }

    loginBtn.addEventListener('click', () => handleAuth('login'));
    registerBtn.addEventListener('click', () => handleAuth('register'));
    showForgotBtn.addEventListener('click', showForgotPassword);
    backToLoginBtn.addEventListener('click', showLoggedOut);
    resetPasswordBtn.addEventListener('click', handleResetPassword);

    logoutBtn.addEventListener('click', () => {
        chrome.storage.local.remove(["authToken", "username"], () => {
            showLoggedOut();
        });
    });
});
