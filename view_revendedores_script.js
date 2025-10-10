document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.querySelector('#revendedoresTable tbody');

    async function fetchRevendedores() {
        try {
            const response = await fetch('/api/converters');
            if (!response.ok) {
                throw new Error('Erro ao buscar revendedores');
            }
            const revendedores = await response.json();
            populateTable(revendedores);
        } catch (error) {
            console.error('Erro:', error);
            alert('Não foi possível carregar a lista de revendedores.');
        }
    }

    function populateTable(revendedores) {
        tableBody.innerHTML = ''; // Limpa a tabela antes de preencher

        if (revendedores.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4">Nenhum revendedor encontrado.</td></tr>';
            return;
        }

        revendedores.forEach(revendedor => {
            const row = document.createElement('tr');

            row.innerHTML = `
                <td>${revendedor.name}</td>
                <td>${revendedor.phone}</td>
                <td>${revendedor.city}</td>
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
                    alert(result.message);
                    fetchRevendedores(); // Atualiza a tabela
                } catch (error) {
                    console.error('Erro ao remover:', error);
                    alert('Ocorreu um erro ao tentar remover o revendedor.');
                }
            }
        }
    });

    fetchRevendedores();
});
