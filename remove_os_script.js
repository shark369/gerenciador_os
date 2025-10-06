document.addEventListener('DOMContentLoaded', async () => {
    const container = document.querySelector('.container');
    const osListDiv = document.createElement('div');
    osListDiv.id = 'osList';
    container.appendChild(osListDiv);

    async function fetchServiceOrders() {
        try {
            const response = await fetch('/api/serviceOrders');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const serviceOrders = await response.json();
            // Parse products JSON string back to object
            serviceOrders.forEach(os => {
                if (typeof os.products === 'string') {
                    os.products = JSON.parse(os.products);
                }
            });
            displayServiceOrders(serviceOrders);
        } catch (error) {
            console.error('Erro ao buscar Ordens de Serviço:', error);
            osListDiv.innerHTML = '<p>Erro ao carregar Ordens de Serviço.</p>';
        }
    }

    function displayServiceOrders(serviceOrders) {
        osListDiv.innerHTML = ''; // Clear previous list
        if (serviceOrders.length === 0) {
            osListDiv.innerHTML = '<p>Nenhuma Ordem de Serviço encontrada para remover.</p>';
            return;
        }

        const ul = document.createElement('ul');
        serviceOrders.forEach(os => {
            const li = document.createElement('li');
            li.innerHTML = `
                <p><strong>ID da OS:</strong> ${os.osid}</p>
                <p><strong>Cliente:</strong> ${os.clientname}</p>
                <p><strong>Descrição:</strong> ${os.description}</p>
                <p><strong>Status:</strong> ${os.status}</p>
                <small>Criado em: ${new Date(os.createdat).toLocaleString()}</small>
                <button class="remove-btn" data-id="${os.id}">Remover</button>
                <hr>
            `;
            ul.appendChild(li);
        });
        osListDiv.appendChild(ul);

        // Add event listeners to remove buttons
        document.querySelectorAll('.remove-btn').forEach(button => {
            button.addEventListener('click', async (event) => {
                const osId = event.target.dataset.id;
                // Find the OS to get client name for confirmation
                const osToRemove = serviceOrders.find(os => os.id == osId);
                const clientName = osToRemove ? osToRemove.clientname : 'desconhecido';

                if (confirm(`Tem certeza que deseja remover a OS ${osId} do cliente ${clientName}?`)) {
                    try {
                        const response = await fetch(`/api/serviceOrders/${osId}`, {
                            method: 'DELETE'
                        });

                        if (response.ok) {
                            alert('Ordem de Serviço removida com sucesso!');
                            fetchServiceOrders(); // Refresh the list
                        } else {
                            alert('Erro ao remover Ordem de Serviço.');
                        }
                    } catch (error) {
                        console.error('Erro:', error);
                        alert('Erro de conexão com o servidor.');
                    }
                }
            });
        });
    }

    fetchServiceOrders();
});
