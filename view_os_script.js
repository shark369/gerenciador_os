document.addEventListener('DOMContentLoaded', async () => {
    const userRole = sessionStorage.getItem('userRole');
    const loggedInUsername = sessionStorage.getItem('username');

    if (!userRole) {
        window.location.href = 'index.html';
        return;
    }

    // Initialize Socket.IO client
    const socket = io();

    socket.on('newOS', (newOs) => {
        console.log('Nova OS recebida via Socket.IO:', newOs);
        fetchServiceOrders(false); // Refresh from first page when a new OS is added
    });

    const osListContainer = document.getElementById('osListContainer');
    const clientSearchInput = document.getElementById('clientSearch');
    const searchButton = document.getElementById('searchButton');
    const statusFilterSelect = document.getElementById('statusFilter');
    const typeFilterSelect = document.getElementById('typeFilter');
    const noOsMessage = document.getElementById('noOsMessage');
    const backToMenuBtn = document.getElementById('backToMenuBtn');
    const searchFilterSection = document.getElementById('searchFilterSection');
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const loadMoreStatus = document.getElementById('loadMoreStatus');

    const PAGE_SIZE = 50;
    let currentOffset = 0;
    let allServiceOrders = [];
    let hasMore = true;
    let isFetching = false;

    // Conditional visibility for menu and search/filter
    if (userRole === 'recepcao') {
        if (backToMenuBtn) backToMenuBtn.style.display = 'block';
        if (searchFilterSection) searchFilterSection.style.display = 'block';
    } else {
        if (backToMenuBtn) backToMenuBtn.style.display = 'none';
        if (searchFilterSection) searchFilterSection.style.display = 'none';
    }

    async function fetchServiceOrders(isLoadMore = false) {
        if (isFetching) return;
        isFetching = true;

        if (!isLoadMore) {
            currentOffset = 0;
            if (loadMoreBtn) {
                loadMoreBtn.disabled = false;
                loadMoreBtn.textContent = 'Carregar Mais Ordens de Serviço';
            }
        } else {
            if (loadMoreBtn) {
                loadMoreBtn.disabled = true;
                loadMoreBtn.textContent = 'Carregando...';
            }
        }

        const searchQuery = (clientSearchInput ? clientSearchInput.value : '').trim();
        const selectedStatus = statusFilterSelect ? statusFilterSelect.value : 'Todas';
        const selectedType = typeFilterSelect ? typeFilterSelect.value : 'todos';

        const params = new URLSearchParams();
        if (userRole) params.set('role', userRole);
        params.set('limit', String(PAGE_SIZE));
        params.set('offset', String(currentOffset));
        if (searchQuery) params.set('search', searchQuery);
        if (selectedStatus && selectedStatus !== 'Todas') params.set('status', selectedStatus);
        if (selectedType && selectedType !== 'todos') params.set('typeFilter', selectedType);

        try {
            const response = await fetch(`/api/serviceOrders?${params.toString()}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const fetchedOrders = await response.json();

            // Parse products JSON string back to object
            fetchedOrders.forEach(os => {
                if (typeof os.products === 'string') {
                    try {
                        os.products = JSON.parse(os.products);
                    } catch (e) {
                        os.products = [];
                    }
                }
            });

            if (isLoadMore) {
                allServiceOrders = allServiceOrders.concat(fetchedOrders);
            } else {
                allServiceOrders = fetchedOrders;
            }

            hasMore = fetchedOrders.length === PAGE_SIZE;

            displayServiceOrders(allServiceOrders);
            updateLoadMoreUI();

        } catch (error) {
            console.error('Erro ao buscar Ordens de Serviço:', error);
            if (!isLoadMore) {
                osListContainer.innerHTML = '<p>Erro ao carregar Ordens de Serviço.</p>';
            }
            if (loadMoreContainer) loadMoreContainer.style.display = 'none';
        } finally {
            isFetching = false;
            if (loadMoreBtn) {
                loadMoreBtn.disabled = false;
                loadMoreBtn.textContent = 'Carregar Mais Ordens de Serviço';
            }
        }
    }

    function updateLoadMoreUI() {
        if (!loadMoreContainer) return;

        if (allServiceOrders.length === 0) {
            loadMoreContainer.style.display = 'none';
            return;
        }

        loadMoreContainer.style.display = 'flex';

        if (hasMore) {
            loadMoreBtn.style.display = 'block';
            loadMoreStatus.textContent = `Exibindo ${allServiceOrders.length} ordens de serviço.`;
        } else {
            loadMoreBtn.style.display = 'none';
            loadMoreStatus.textContent = `Todas as ${allServiceOrders.length} ordens de serviço foram carregadas.`;
        }
    }

    function displayServiceOrders(serviceOrders) {
        osListContainer.innerHTML = '';
        if (noOsMessage) noOsMessage.style.display = 'none';

        if (serviceOrders.length === 0) {
            osListContainer.innerHTML = '<p>Nenhuma Ordem de Serviço encontrada.</p>';
            return;
        }

        // Group service orders by client name and calculate balance
        const groupedOrders = serviceOrders.reduce((acc, os) => {
            const clientName = os.clientname || os.clientName || 'Cliente Desconhecido';
            if (!acc[clientName]) {
                acc[clientName] = { orders: [], balance: 0 };
            }
            acc[clientName].orders.push(os);

            // Sum totalDue for any non-paid orders
            if (os.status !== 'Paga') {
                acc[clientName].balance += (parseFloat(os.totaldue || os.totalDue) || 0);
            }
            return acc;
        }, {});

        for (const clientName in groupedOrders) {
            const clientOrders = groupedOrders[clientName].orders;
            const clientBalance = groupedOrders[clientName].balance;
            const hasConverter = clientOrders.some(os => Boolean(os.converterid || os.converterId || os.convertername || os.converterName));
            const converterTag = hasConverter
                ? `<span style="background-color: #ffc107; color: #212529; font-size: 0.75rem; font-weight: bold; padding: 3px 8px; border-radius: 12px; margin-left: 8px; vertical-align: middle;">REVENDEDOR</span>`
                : '';

            const clientGroupDiv = document.createElement('div');
            clientGroupDiv.classList.add('client-group');
            clientGroupDiv.innerHTML = `<h3>Cliente: ${clientName} ${converterTag} <small>(Saldo: R$ ${clientBalance.toFixed(2)})</small></h3>`;
            
            const ul = document.createElement('ul');
            groupedOrders[clientName].orders.forEach(os => {
                let productsHtml = '';
                const products = Array.isArray(os.products) ? os.products : [];
                if (products.length > 0) {
                    productsHtml = '<h4>Produtos:</h4><ul>';
                    products.forEach(product => {
                        const productVal = parseFloat(product.value) || 0;
                        productsHtml += `<li>${product.name} (Qtd: ${product.quantity}, Valor Unitário: R$ ${productVal.toFixed(2)})</li>`;
                    });
                    productsHtml += '</ul>';
                }

                const discountType = os.discounttype || (os.discount ? os.discount.type : null);
                const discountVal = parseFloat(os.discountvalue !== undefined ? os.discountvalue : (os.discount ? os.discount.value : 0)) || 0;
                let discountInfo = 'Desconto/Pagamento: N/A';

                if (discountType === 'percentage') {
                    discountInfo = `Desconto/Pagamento: ${discountVal}%`;
                } else if (discountType === 'fixed') {
                    discountInfo = `Desconto/Pagamento: R$ ${discountVal.toFixed(2)}`;
                }

                const totalVal = parseFloat(os.totalvalue || os.totalValue) || 0;
                const totalDue = parseFloat(os.totaldue !== undefined ? os.totaldue : os.totalDue) || 0;
                const converterName = os.convertername || os.converterName;
                const isDifferentFromClient = converterName && converterName.trim().toLowerCase() !== String(clientName).trim().toLowerCase();
                const converterInfo = isDifferentFromClient
                    ? `<span style="background-color: #fff3cd; color: #856404; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 0.85rem; display: inline-block; margin: 3px 0; border: 1px solid #ffeeba;">Revendedor: ${converterName}</span><br>`
                    : '';

                const li = document.createElement('li');
                li.innerHTML = `
                    <strong>ID da OS:</strong> ${os.osid || os.osId}<br>
                    <strong>Celular:</strong> ${os.clientphone || os.clientPhone || 'N/A'}<br>
                    ${converterInfo}
                    <strong>Descrição:</strong> ${os.description || 'N/A'}<br>
                    <strong>Status:</strong> ${os.status}<br>
                    ${productsHtml}
                    ${discountInfo}<br>
                    <strong>Valor Total da OS:</strong> R$ ${totalVal.toFixed(2)}<br>
                    <strong>Total a Pagar:</strong> R$ ${totalDue.toFixed(2)}<br>
                    <small>Criado por: ${os.createdby || os.createdBy || 'N/A'} em: ${new Date(os.createdat || os.createdAt).toLocaleString()}</small>
                `;

                const actionsDiv = document.createElement('div');
                actionsDiv.classList.add('os-actions');

                // --- Actions for Recepcao ---
                if (userRole === 'recepcao') {
                    const statusSelect = document.createElement('select');
                    statusSelect.classList.add('status-select');
                    statusSelect.dataset.id = os.id;
                    ['Pendente', 'Paga'].forEach(status => {
                        const option = document.createElement('option');
                        option.value = status;
                        option.textContent = status;
                        if (os.status === status) option.selected = true;
                        statusSelect.appendChild(option);
                    });
                    actionsDiv.appendChild(statusSelect);

                    if (os.status === 'Paga') {
                        const entregueButton = document.createElement('button');
                        entregueButton.textContent = 'Marcar como Entregue';
                        entregueButton.classList.add('update-status-btn', 'entregue-btn');
                        entregueButton.dataset.id = os.id;
                        entregueButton.dataset.newstatus = 'Entregue';
                        actionsDiv.appendChild(entregueButton);
                    }
                }
                
                li.appendChild(actionsDiv);
                li.innerHTML += `<hr>`;
                ul.appendChild(li);
            });
            clientGroupDiv.appendChild(ul);
            osListContainer.appendChild(clientGroupDiv);
        }
    }

    // Search and filter listeners
    if (searchButton) {
        searchButton.addEventListener('click', () => fetchServiceOrders(false));
    }
    if (clientSearchInput) {
        let searchTimeout = null;
        clientSearchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                clearTimeout(searchTimeout);
                fetchServiceOrders(false);
            }
        });
        clientSearchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                fetchServiceOrders(false);
            }, 400);
        });
    }
    if (statusFilterSelect) {
        statusFilterSelect.addEventListener('change', () => fetchServiceOrders(false));
    }
    if (typeFilterSelect) {
        typeFilterSelect.addEventListener('change', () => fetchServiceOrders(false));
    }

    // Load More listener
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            currentOffset += PAGE_SIZE;
            fetchServiceOrders(true);
        });
    }

    async function updateOsStatus(osId, newStatus) {
        try {
            const osToUpdate = allServiceOrders.find(os => os.id == osId);
            if (!osToUpdate) throw new Error('OS não encontrada.');

            const discountType = osToUpdate.discounttype !== undefined ? osToUpdate.discounttype : (osToUpdate.discount ? osToUpdate.discount.type : null);
            const discountValue = parseFloat(osToUpdate.discountvalue !== undefined ? osToUpdate.discountvalue : (osToUpdate.discount ? osToUpdate.discount.value : 0)) || 0;

            let updatedTotalDue = parseFloat(osToUpdate.totaldue !== undefined ? osToUpdate.totaldue : osToUpdate.totalDue) || 0;

            if (newStatus === 'Paga') {
                updatedTotalDue = 0;
            } else if (newStatus === 'Pendente' && osToUpdate.status === 'Paga') {
                let subtotal = 0;
                const products = Array.isArray(osToUpdate.products) ? osToUpdate.products : [];
                products.forEach(p => {
                    subtotal += (parseFloat(p.quantity) || 0) * (parseFloat(p.value) || 0);
                });
                if (subtotal === 0) {
                    subtotal = parseFloat(osToUpdate.totalvalue || osToUpdate.totalValue) || 0;
                }
                let discountAmount = 0;
                if (discountType === 'percentage') {
                    discountAmount = subtotal * (discountValue / 100);
                } else if (discountType === 'fixed') {
                    discountAmount = discountValue;
                }
                updatedTotalDue = Math.max(0, subtotal - discountAmount);
            }

            const updatedData = {
                osid: osToUpdate.osid || osToUpdate.osId,
                clientname: osToUpdate.clientname || osToUpdate.clientName,
                clientphone: osToUpdate.clientphone || osToUpdate.clientPhone,
                osdate: osToUpdate.osdate || osToUpdate.osDate,
                description: osToUpdate.description,
                status: newStatus,
                products: osToUpdate.products,
                discount: {
                    type: discountType,
                    value: discountValue
                },
                discounttype: discountType,
                discountvalue: discountValue,
                totalvalue: parseFloat(osToUpdate.totalvalue || osToUpdate.totalValue) || 0,
                totaldue: updatedTotalDue,
                sector: osToUpdate.sector,
                createdby: osToUpdate.createdby || osToUpdate.createdBy,
                converterid: osToUpdate.converterid || osToUpdate.converterId || null,
                userrole: userRole,
                username: loggedInUsername,
                action: 'status-update'
            };

            const response = await fetch(`/api/serviceOrders/${osId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });

            if (response.ok) {
                if (newStatus === 'Entregue') {
                    allServiceOrders = allServiceOrders.filter(os => os.id != osId);
                } else {
                    osToUpdate.status = newStatus;
                    osToUpdate.totaldue = updatedTotalDue;
                    osToUpdate.totalDue = updatedTotalDue;
                }
                displayServiceOrders(allServiceOrders);
                updateLoadMoreUI();
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
                body: JSON.stringify({ username: loggedInUsername })
            });

            if (response.ok) {
                alert('Ordem de Serviço removida com sucesso!');
                allServiceOrders = allServiceOrders.filter(os => os.id != osId);
                displayServiceOrders(allServiceOrders);
                updateLoadMoreUI();
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

    // Initial fetch of first 50 items
    fetchServiceOrders(false);
});
