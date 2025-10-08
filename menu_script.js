document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logoutButton');
    const userRole = sessionStorage.getItem('userRole');
    const username = sessionStorage.getItem('username'); // Get username

    const addOsLink = document.getElementById('addOsLink');
    const removeOsLink = document.getElementById('removeOsLink');
    const editOsLink = document.getElementById('editOsLink');
    const viewOsLink = document.getElementById('viewOsLink');
    const addConverterLink = document.getElementById('addConverterLink');

    if (userRole) {
        if (userRole === 'recepcao') {
            // For recepcao, check specific usernames
            if (username === 'tarcio' || username === 'safira') {
                if (removeOsLink) removeOsLink.style.display = 'none';
                if (editOsLink) editOsLink.style.display = 'none';
            }
            if (logoutButton) logoutButton.style.display = 'block'; // Show logout for recepcao
        } else if (userRole === 'grafica' || userRole === 'impressao') {
            if (addOsLink) addOsLink.style.display = 'none';
            if (removeOsLink) removeOsLink.style.display = 'none';
            if (editOsLink) editOsLink.style.display = 'none';
            if (viewOsLink) viewOsLink.style.display = 'block';
            if (addConverterLink) addConverterLink.style.display = 'none'; // Hide for non-recepcao
            // Logout button remains visible for grafica/impressao if they somehow reach menu.html
        }
    } else {
        // If no role is found, redirect to login
        window.location.href = 'index.html';
    }

    if (logoutButton) { // Add listener for all roles if button is present
        logoutButton.addEventListener('click', () => {
            sessionStorage.removeItem('userRole'); // Clear role on logout
            sessionStorage.removeItem('username'); // Clear username on logout
            alert('Saindo...');
            window.location.href = 'index.html'; // Redirect back to login page
        });
    }
});
