document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Socket.IO client
    const socket = io('http://localhost:3001'); // Connect to backend Socket.IO server

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
        let url = 'http://localhost:3001/api/serviceOrders';
        
        // Add role to URL for backend filtering
        if (userRole) {
            url += `?role=${userRole}`;
        }

        // For grafica and impressao, initially fetch only pending orders
        if (userRole === 'grafica' || userRole === 'impressao') {
            url += (userRole ? '&' : '?') + 'status=Pendente'; // Add status filter
        }

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
            const matchesSearch = os.clientName.toLowerCase().includes(searchQuery);
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
            const clientName = os.clientName || 'Cliente Desconhecido';
            if (!acc[clientName]) {
                acc[clientName] = { orders: [], balance: 0 };
            }
            acc[clientName].orders.push(os);

            const totalVal = parseFloat(os.totalValue) || 0;
            if (os.status === 'Pendente') {
            acc[clientName].balance += (parseFloat(os.totalDue) || 0); // Sum totalDue for pending orders
            }
            // If "Concluída", totalDue is 0, so it doesn't affect the balance
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
                // Access discountType and discountValue directly from os object
                if (os.discountType) { // Check if discountType exists
                    const discountVal = parseFloat(os.discountValue) || 0;
                    if (os.discountType === 'percentage') {
                        discountInfo = `Desconto/Pagamento: ${discountVal}%`;
                    } else if (os.discountType === 'fixed') {
                        discountInfo = `Desconto/Pagamento: R$ ${discountVal.toFixed(2)}`;
                    }
                }

                const totalVal = parseFloat(os.totalValue) || 0;
                const totalDue = parseFloat(os.totalDue) || 0; // Use the fetched totalDue

                const li = document.createElement('li');
                li.innerHTML = `
                    <strong>ID da OS:</strong> ${os.osId}<br>
                    <strong>Descrição:</strong> ${os.description}<br>
                    <strong>Status:</strong> ${os.status}<br>
                    ${productsHtml}
                    ${discountInfo}<br>
                    <strong>Valor Total da OS:</strong> R$ ${totalVal.toFixed(2)}<br>
                    <strong>Total a Pagar:</strong> R$ ${totalDue.toFixed(2)}<br>
                    <small>Criado por: ${os.createdBy || 'N/A'} em: ${new Date(os.createdAt).toLocaleString()}</small>
                `;
                // Add "Marcar como Concluído" button for pending orders for grafica/impressao roles
                if ((userRole === 'grafica' || userRole === 'impressao') && os.status === 'Pendente') {
                    const completeButton = document.createElement('button');
                    completeButton.textContent = 'Marcar como Concluído';
                    completeButton.classList.add('complete-os-btn');
                    completeButton.dataset.id = os.id;
                    li.appendChild(completeButton);
                }
                li.innerHTML += `<hr>`; // Add HR after button or directly after content
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

    // Event listener for "Marcar como Concluído" buttons
    osListContainer.addEventListener('click', async (event) => {
        if (event.target.classList.contains('complete-os-btn')) {
            const osDbId = event.target.dataset.id; // This is the database ID
            if (confirm('Tem certeza que deseja marcar esta OS como Concluída?')) {
                try {
                    // First, fetch the complete OS data
                    const fetchResponse = await fetch(`http://localhost:3001/api/serviceOrders/${osDbId}`);
                    if (!fetchResponse.ok) {
                        throw new Error(`HTTP error! status: ${fetchResponse.status}`);
                    }
                    const osToUpdate = await fetchResponse.json();

                    // Ensure products is an array of objects, not a string
                    if (typeof osToUpdate.products === 'string') {
                        osToUpdate.products = JSON.parse(osToUpdate.products);
                    }

                    // Update the status
                    osToUpdate.status = 'Concluída';
                    osToUpdate.totalDue = 0; // Set totalDue to 0 when completed

                    // Prepare data for PUT request, ensuring all fields are present
                    const updatedData = {
                        osId: osToUpdate.osId,
                        clientName: osToUpdate.clientName,
                        osDate: osToUpdate.osDate.split('T')[0], // Format date for input type="date"
                        description: osToUpdate.description,
                        status: osToUpdate.status,
                        products: osToUpdate.products,
                        discount: {
                            type: osToUpdate.discountType,
                            value: osToUpdate.discountValue
                        },
                        totalValue: osToUpdate.totalValue,
                        totalDue: osToUpdate.totalDue,
                        sector: osToUpdate.sector
                    };

                    const response = await fetch(`http://localhost:3001/api/serviceOrders/${osDbId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(updatedData)
                    });

                    if (response.ok) {
                        alert('OS marcada como Concluída com sucesso!');
                        fetchServiceOrders(); // Refresh the list
                    } else {
                        const errorData = await response.json();
                        alert(`Erro ao marcar OS como Concluída: ${errorData.message || response.statusText}`);
                    }
                } catch (error) {
                    console.error('Erro:', error);
                    alert('Erro de conexão ao marcar OS como Concluída.');
                }
            }
        }
    });

    // Initial fetch and display
    fetchServiceOrders();

    // Auto-refresh for grafica and impressao digital roles
    if (userRole === 'grafica' || userRole === 'impressao') {
        setInterval(fetchServiceOrders, 500); // Refresh every 0.5 seconds
    }
});
