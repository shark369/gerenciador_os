document.addEventListener('DOMContentLoaded', () => {
    const userRole = sessionStorage.getItem('userRole');
    if (!userRole || userRole !== 'recepcao') {
        alert('Acesso restrito à recepção.');
        window.location.href = 'index.html';
        return;
    }

    const tableBody = document.querySelector('#revendedoresTable tbody');
    const searchInput = document.getElementById('revendedorSearch');
    let allRevendedores = [];

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async function fetchRevendedores() {
        try {
            const response = await fetch('/api/converters');
            if (!response.ok) {
                throw new Error('Erro ao buscar revendedores');
            }
            allRevendedores = await response.json();
            filterAndPopulateTable();
        } catch (error) {
            console.error('Erro:', error);
            alert('Não foi possível carregar a lista de revendedores.');
        }
    }

    function filterAndPopulateTable() {
        const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
        const filtered = allRevendedores.filter(r => {
            if (!query) return true;
            return (
                (r.name && r.name.toLowerCase().includes(query)) ||
                (r.phone && r.phone.toLowerCase().includes(query)) ||
                (r.city && r.city.toLowerCase().includes(query)) ||
                (r.state && r.state.toLowerCase().includes(query))
            );
        });
        populateTable(filtered);
    }

    if (searchInput) {
        searchInput.addEventListener('input', filterAndPopulateTable);
    }

    function populateTable(revendedores) {
        tableBody.innerHTML = '';

        if (revendedores.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">Nenhum revendedor encontrado.</td></tr>';
            return;
        }

        revendedores.forEach(revendedor => {
            const row = document.createElement('tr');
            const isActive = revendedor.active !== false;
            const statusBadge = isActive
                ? '<span style="background-color: #28a745; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">Ativo</span>'
                : '<span style="background-color: #6c757d; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">Inativo</span>';

            row.innerHTML = `
                <td>${escapeHtml(revendedor.name)}</td>
                <td>${escapeHtml(revendedor.phone)}</td>
                <td>${escapeHtml(revendedor.city || '-')}</td>
                <td>${statusBadge}</td>
                <td class="actions">
                    <button class="edit-btn" data-id="${revendedor.id}">Editar</button>
                    <button class="remove-btn" data-id="${revendedor.id}">Remover</button>
                </td>
            `;

            tableBody.appendChild(row);
        });
    }

    tableBody.addEventListener('click', async (event) => {
        const target = event.target;
        const id = target.dataset.id;

        if (target.classList.contains('edit-btn')) {
            window.location.href = `edit_revendedor.html?id=${id}`;
        }

        if (target.classList.contains('remove-btn')) {
            const revendedorRow = target.closest('tr');
            const revendedorName = revendedorRow.querySelector('td').textContent;

            if (confirm(`Tem certeza que deseja remover o revendedor "${revendedorName}"?`)) {
                try {
                    const response = await fetch(`/api/converters/${id}`, {
                        method: 'DELETE'
                    });

                    if (!response.ok) {
                        throw new Error('Falha ao remover o revendedor.');
                    }

                    const result = await response.json();
                    alert(result.message || 'Revendedor removido com sucesso!');
                    fetchRevendedores();
                } catch (error) {
                    console.error('Erro ao remover:', error);
                    alert('Ocorreu um erro ao tentar remover o revendedor.');
                }
            }
        }
    });

    fetchRevendedores();
});
