document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Socket.IO client
    const socket = io(); // Connect to backend Socket.IO server on the same host

    socket.on('newOS', (newOs) => {
        console.log('Nova OS recebida via Socket.IO:', newOs);
        fetchServiceOrders(); // Refresh the list when a new OS is added
    });

    const osListContainer = document.getElementById('osListContainer');
    const clientSearchInput = document.getElementById('clientSearch');
    const searchButton = document.getElementById('searchButton');
    const statusFilterSelect = document.getElementById('statusFilter');
    const noOsMessage = document.getElementById('noOsMessage');
    const backToMenuBtn = document.getElementById('backToMenuBtn');
    const searchFilterSection = document.getElementById('searchFilterSection');

    let allServiceOrders = []; // Store all fetched service orders
    const userRole = sessionStorage.getItem('userRole'); // Get user role once
    const loggedInUsername = sessionStorage.getItem('username'); // Get username
    console.log('User Role:', userRole); // Debug: Print user role

    // Conditional visibility for menu and search/filter
    if (userRole === 'recepcao') {
        if (backToMenuBtn) backToMenuBtn.style.display = 'block';
        if (searchFilterSection) searchFilterSection.style.display = 'block';
    } else {
        if (backToMenuBtn) backToMenuBtn.style.display = 'none';
        if (searchFilterSection) searchFilterSection.style.display = 'none';
    }

    // No logout button functionality needed here as it's removed from view_os.html

    async function fetchServiceOrders() {
        let url = '/api/serviceOrders';
        
        // Add role to URL for backend filtering
        if (userRole) {
            url += `?role=${userRole}`;
        }

        // Backend now handles filtering by role correctly

        console.log('Fetching URL:', url); // Debug: Print the URL being fetched

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            let serviceOrders = await response.json();

            console.log('Service Orders Data:', serviceOrders); // Debug: Print the data received
            
            // Parse products JSON string back to object
            serviceOrders.forEach(os => {
                if (typeof os.products === 'string') {
                    os.products = JSON.parse(os.products);
                }
            });

            allServiceOrders = serviceOrders; // Store all fetched data

            applyFilters(); // Apply filters after fetching all data

        } catch (error) {
            console.error('Erro ao buscar Ordens de Serviço:', error);
            osListContainer.innerHTML = '<p>Erro ao carregar Ordens de Serviço.</p>';
            noOsMessage.style.display = 'none'; // Hide initial message on error
        }
    }

    function applyFilters() {
        const searchQuery = clientSearchInput.value.toLowerCase();
        const selectedStatus = statusFilterSelect.value;

        let filteredOrders = allServiceOrders.filter(os => {
            const matchesSearch = (os.clientname || '').toLowerCase().includes(searchQuery);
            // Only apply status filter if user is recepcao or if status is explicitly 'Todas'
            const matchesStatus = (userRole === 'recepcao' && selectedStatus !== 'Todas' && os.status !== selectedStatus) ? false : true;
            
            // If user is grafica or impressao, they only see pending, so no need for status filter on frontend
            if (userRole === 'grafica' || userRole === 'impressao') { // Corrected typo: 'grafao' to 'grafica'
                return matchesSearch; // Status is already filtered by backend
            } else {
                return matchesSearch && matchesStatus;
            }
        });
        
        console.log('Filtered Orders Data:', filteredOrders); // Debug: Print the filtered data
        displayServiceOrders(filteredOrders);
    }

    function displayServiceOrders(serviceOrders) {
        osListContainer.innerHTML = ''; // Clear previous list
        noOsMessage.style.display = 'none'; // Hide initial message

        if (serviceOrders.length === 0) {
            osListContainer.innerHTML = '<p>Nenhuma Ordem de Serviço encontrada.</p>';
            return;
        }

        // Group service orders by client name and calculate balance
        const groupedOrders = serviceOrders.reduce((acc, os) => {
            const clientName = os.clientname || 'Cliente Desconhecido';
            if (!acc[clientName]) {
                acc[clientName] = { orders: [], balance: 0 };
            }
            acc[clientName].orders.push(os);

            // Sum totalDue for any non-paid orders
            if (os.status !== 'Paga') {
                acc[clientName].balance += (parseFloat(os.totaldue) || 0);
            }
            return acc;
        }, {});

        for (const clientName in groupedOrders) {
            const clientBalance = groupedOrders[clientName].balance;
            const clientGroupDiv = document.createElement('div');
            clientGroupDiv.classList.add('client-group');
            clientGroupDiv.innerHTML = `<h3>Cliente: ${clientName} <small>(Saldo: R$ ${clientBalance.toFixed(2)})</small></h3>`;
            
            const ul = document.createElement('ul');
            groupedOrders[clientName].orders.forEach(os => {
                let productsHtml = '';
                if (os.products && os.products.length > 0) {
                    productsHtml = '<h4>Produtos:</h4><ul>';
                    os.products.forEach(product => {
                        const productVal = parseFloat(product.value) || 0;
                        productsHtml += `<li>${product.name} (Qtd: ${product.quantity}, Valor Unitário: R$ ${productVal.toFixed(2)})</li>`;
                    });
                    productsHtml += '</ul>';
                }

                let discountInfo = 'Desconto/Pagamento: N/A'; // Default if no discount info
                // Access discounttype and discountvalue directly from os object
                if (os.discounttype) { // Check if discounttype exists
                    const discountVal = parseFloat(os.discountvalue) || 0;
                    if (os.discounttype === 'percentage') {
                        discountInfo = `Desconto/Pagamento: ${discountVal}%`;
                    } else if (os.discounttype === 'fixed') {
                        discountInfo = `Desconto/Pagamento: R$ ${discountVal.toFixed(2)}`;
                    }
                }

                const totalVal = parseFloat(os.totalvalue) || 0;
                const totalDue = parseFloat(os.totaldue) || 0; // Use the fetched totaldue

                const li = document.createElement('li');
                li.innerHTML = `
                    <strong>ID da OS:</strong> ${os.osid}<br>
                    <strong>Celular:</strong> ${os.clientphone || 'N/A'}<br>
                    <strong>Descrição:</strong> ${os.description}<br>
                    <strong>Status:</strong> ${os.status}<br>
                    ${productsHtml}
                    ${discountInfo}<br>
                    <strong>Valor Total da OS:</strong> R$ ${totalVal.toFixed(2)}<br>
                    <strong>Total a Pagar:</strong> R$ ${totalDue.toFixed(2)}<br>
                    <small>Criado por: ${os.createdby || 'N/A'} em: ${new Date(os.createdat).toLocaleString()}</small>
                `;

                const actionsDiv = document.createElement('div');
                actionsDiv.classList.add('os-actions');

                // --- Actions for Recepcao ---
                if (userRole === 'recepcao') {
                    const statusSelect = document.createElement('select');
                    statusSelect.classList.add('status-select');
                    statusSelect.dataset.id = os.id;
                    ['Pendente', 'Concluída', 'Paga'].forEach(status => {
                        const option = document.createElement('option');
                        option.value = status;
                        option.textContent = status;
                        if (os.status === status) option.selected = true;
                        statusSelect.appendChild(option);
                    });
                    actionsDiv.appendChild(statusSelect);
                }

                // --- Actions for Grafica/Impressao ---
                if ((userRole === 'grafica' || userRole === 'impressao') && os.status === 'Pendente') {
                    const completeButton = document.createElement('button');
                    completeButton.textContent = 'Marcar como Concluído';
                    completeButton.classList.add('update-status-btn');
                    completeButton.dataset.id = os.id;
                    completeButton.dataset.newstatus = 'Concluída';
                    actionsDiv.appendChild(completeButton);
                }
                
                li.appendChild(actionsDiv);
                li.innerHTML += `<hr>`;
                ul.appendChild(li);
            });
            clientGroupDiv.appendChild(ul);
            osListContainer.appendChild(clientGroupDiv);
        }
    }

    // Event Listeners for filters
    searchButton.addEventListener('click', applyFilters);
    clientSearchInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            applyFilters();
        }
    });
    statusFilterSelect.addEventListener('change', applyFilters);

    async function updateOsStatus(osId, newStatus) {
        try {
            const osToUpdate = allServiceOrders.find(os => os.id == osId);
            if (!osToUpdate) throw new Error('OS não encontrada.');

            // Prepare data for PUT request
            const updatedData = { ...osToUpdate, status: newStatus, userRole: userRole };
            // The pg driver handles JSON objects automatically, no need to stringify here.
            // updatedData.products = JSON.stringify(updatedData.products);


            const response = await fetch(`/api/serviceOrders/${osId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });

            if (response.ok) {
                alert('Status da OS atualizado com sucesso!');
                fetchServiceOrders(); // Refresh the list
            } else {
                const errorData = await response.json();
                alert(`Erro ao atualizar status: ${errorData.message || response.statusText}`);
            }
        } catch (error) {
            console.error('Erro:', error);
            alert('Erro de conexão ao atualizar status da OS.');
        }
    }
    
    async function removeOs(osId) {
        if (!confirm('Tem certeza que deseja remover esta Ordem de Serviço? Esta ação não pode ser desfeita.')) {
            return;
        }
        try {
            const response = await fetch(`/api/serviceOrders/${osId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: loggedInUsername }) // Send username for security check
            });

            if (response.ok) {
                alert('Ordem de Serviço removida com sucesso!');
                fetchServiceOrders(); // Refresh the list
            } else {
                const errorData = await response.json();
                alert(`Erro ao remover OS: ${errorData.message || response.statusText}`);
            }
        } catch (error) {
            console.error('Erro:', error);
            alert('Erro de conexão ao remover OS.');
        }
    }


    // Event listener for all actions
    osListContainer.addEventListener('click', async (event) => {
        const target = event.target;
        if (target.classList.contains('update-status-btn')) {
            const osId = target.dataset.id;
            const newStatus = target.dataset.newstatus;
            if (confirm(`Tem certeza que deseja marcar esta OS como ${newStatus}?`)) {
                updateOsStatus(osId, newStatus);
            }
        }
        if (target.classList.contains('remove-os-btn')) {
            const osId = target.dataset.id;
            removeOs(osId);
        }
    });
    
    osListContainer.addEventListener('change', async (event) => {
        const target = event.target;
        if (target.classList.contains('status-select')) {
            const osId = target.dataset.id;
            const newStatus = target.value;
            updateOsStatus(osId, newStatus);
        }
    });


    // Initial fetch and display
    fetchServiceOrders();
});
