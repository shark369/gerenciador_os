document.addEventListener('DOMContentLoaded', async () => {
    const container = document.querySelector('.container');
    const userRole = sessionStorage.getItem('userRole');
    const username = sessionStorage.getItem('username');
    const restrictedRecepcaoUsers = ['tarcio', 'safira', 'junior'];
    const isRestrictedRecepcaoUser = userRole === 'recepcao' && restrictedRecepcaoUsers.includes(username);

    if (!userRole) {
        window.location.href = 'index.html';
        return;
    }

    if (isRestrictedRecepcaoUser) {
        alert('Este usuário não tem permissão para remover Ordens de Serviço.');
        window.location.href = 'menu.html';
        return;
    }

    const osListDiv = document.createElement('div');
    osListDiv.id = 'osList';
    container.appendChild(osListDiv);

    const osSearchInput = document.getElementById('osSearchInput');
    const searchButton = document.getElementById('searchButton');

    const PAGE_SIZE = 50;
    let currentOffset = 0;
    let allServiceOrders = [];
    let hasMore = true;
    let isFetching = false;

    const loadMoreContainer = document.createElement('div');
    loadMoreContainer.className = 'load-more-container';
    loadMoreContainer.id = 'loadMoreContainer';
    loadMoreContainer.style.display = 'none';
    loadMoreContainer.innerHTML = `
        <button type="button" id="loadMoreBtn" class="load-more-btn">Carregar Mais Ordens de Serviço</button>
        <span id="loadMoreStatus" class="load-more-status"></span>
    `;
    container.appendChild(loadMoreContainer);

    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const loadMoreStatus = document.getElementById('loadMoreStatus');

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            currentOffset += PAGE_SIZE;
            fetchServiceOrders(true);
        });
    }

    if (searchButton) {
        searchButton.addEventListener('click', () => fetchServiceOrders(false));
    }

    if (osSearchInput) {
        let searchTimeout = null;
        osSearchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                clearTimeout(searchTimeout);
                fetchServiceOrders(false);
            }
        });
        osSearchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                fetchServiceOrders(false);
            }, 400);
        });
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

        const searchQuery = (osSearchInput ? osSearchInput.value : '').trim();
        const params = new URLSearchParams();
        params.set('limit', String(PAGE_SIZE));
        params.set('offset', String(currentOffset));
        if (searchQuery) {
            params.set('search', searchQuery);
        }

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
                osListDiv.innerHTML = '<p>Erro ao carregar Ordens de Serviço.</p>';
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
        osListDiv.innerHTML = '';
        if (serviceOrders.length === 0) {
            osListDiv.innerHTML = '<p>Nenhuma Ordem de Serviço encontrada para remover.</p>';
            return;
        }

        const ul = document.createElement('ul');
        serviceOrders.forEach(os => {
            const li = document.createElement('li');
            li.innerHTML = `
                <p><strong>ID da OS:</strong> ${os.osid || os.osId}</p>
                <p><strong>Cliente:</strong> ${os.clientname || os.clientName}</p>
                <p><strong>Descrição:</strong> ${os.description || 'N/A'}</p>
                <p><strong>Status:</strong> ${os.status}</p>
                <small>Criado em: ${new Date(os.createdat || os.createdAt).toLocaleString()}</small>
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
                const osToRemove = allServiceOrders.find(os => os.id == osId);
                const clientName = osToRemove ? (osToRemove.clientname || osToRemove.clientName) : 'desconhecido';
                const osDisplayId = osToRemove ? (osToRemove.osid || osToRemove.osId || osId) : osId;

                if (confirm(`Tem certeza que deseja remover a OS ${osDisplayId} do cliente ${clientName}?`)) {
                    try {
                        if (!username) {
                            alert('Usuário não logado. Faça o login novamente.');
                            window.location.href = 'index.html';
                            return;
                        }

                        const response = await fetch(`/api/serviceOrders/${osId}`, {
                            method: 'DELETE',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ username })
                        });

                        if (response.ok) {
                            alert('Ordem de Serviço removida com sucesso!');
                            allServiceOrders = allServiceOrders.filter(os => os.id != osId);
                            displayServiceOrders(allServiceOrders);
                            updateLoadMoreUI();
                        } else {
                            const errorData = await response.json().catch(() => ({}));
                            alert(`Erro ao remover Ordem de Serviço: ${errorData.message || response.statusText}`);
                        }
                    } catch (error) {
                        console.error('Erro:', error);
                        alert('Erro de conexão com o servidor.');
                    }
                }
            });
        });
    }

    fetchServiceOrders(false);
});
