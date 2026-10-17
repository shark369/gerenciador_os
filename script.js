document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');

    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok) {
                    sessionStorage.setItem('userRole', data.role);
                    sessionStorage.setItem('username', data.username); // Store username
                    if (data.role === 'recepcao') {
                        window.location.href = 'menu.html'; // Redirect to menu page for recepcao
                    } else {
                        window.location.href = 'view_os.html'; // Redirect directly to view_os for grafica/impressao
                    }
                } else {
                    alert(data.message || 'Usuário ou senha incorretos.');
                }
            } catch (error) {
                console.error('Erro ao tentar fazer login:', error);
                alert('Não foi possível conectar ao servidor. Tente novamente mais tarde.');
            }
        });
    }
});
