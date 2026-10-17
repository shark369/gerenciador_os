document.addEventListener('DOMContentLoaded', async () => {
    const container = document.querySelector('.container');
    const userRole = sessionStorage.getItem('userRole');
    const loggedInUsername = sessionStorage.getItem('username');
    const restrictedRecepcaoUsers = ['tarcio', 'safira', 'junior'];
    const isRestrictedRecepcaoUser = userRole === 'recepcao' && restrictedRecepcaoUsers.includes(loggedInUsername);

    if (!userRole) {
        window.location.href = 'index.html';
        return;
    }

    if (isRestrictedRecepcaoUser) {
        alert('Este usuário não tem permissão para editar Ordens de Serviço.');
        window.location.href = 'menu.html';
        return;
    }

    const osListDiv = document.createElement('div');
    osListDiv.id = 'osList';
    container.appendChild(osListDiv);

    const editFormDiv = document.createElement('div');
    editFormDiv.id = 'editFormDiv';
    editFormDiv.style.display = 'none'; // Hidden by default
    editFormDiv.innerHTML = `
        <h3>Editar Ordem de Serviço</h3>
        <form id="editOsForm">
            <input type="hidden" id="editOsIdHidden">
            <div class="header-section">
                <div class="input-group">
                    <label for="editClientName">Nome do Cliente:</label>
                    <input type="text" id="editClientName" name="editClientName" required>
                </div>
                <div class="input-group checkbox-group">
                    <input type="checkbox" id="editIsConverterCheck">
                    <label for="editIsConverterCheck">Revendedor:</label>
                </div>
                <div id="editConverterSelectorGroup" class="input-group" style="display: none;">
                    <label for="editConverterSelect">Selecione o Revendedor:</label>
                    <select id="editConverterSelect">
                        <option value="">-- Selecione --</option>
                    </select>
                </div>
                <div class="input-group">
                    <label for="editClientPhone">Celular:</label>
                    <input type="text" id="editClientPhone" name="editClientPhone" required>
                </div>
                <div class="input-group">
                    <label for="editOsId">ID da OS:</label>
                    <input type="text" id="editOsId" name="editOsId" readonly>
                </div>
                <div class="input-group">
                    <label for="editOsDate">Data:</label>
                    <input type="date" id="editOsDate" name="editOsDate" readonly>
                </div>
            </div>

            <h3>Produtos</h3>
            <div id="editProductsContainer">
                <!-- Product input fields will be added here dynamically by script -->
            </div>
            <button type="button" id="addProductBtn">Adicionar Produto</button>
            <p> <p>
            <div class="summary-section">
                <div class="input-group">
                    <label for="editDiscountType">Tipo de Desconto:</label>
                    <select id="editDiscountType" name="editDiscountType">
                        <option value="percentage">Porcentagem (%)</option>
                        <option value="fixed">Valor Fixo (R$)</option>
                    </select>
                </div>
                <div class="input-group">
                    <label for="editDiscountValue">Desconto:</label>
                    <input type="number" id="editDiscountValue" name="editDiscountValue" value="0" min="0" step="0.01">
                </div>
                <div class="input-group">
                    <label for="editTotalValue">Valor Total da OS:</label>
                    <input type="text" id="editTotalValue" name="editTotalValue" readonly value="0.00">
                </div>
                <div class="input-group">
                    <label for="editTotalDue">Total a Pagar:</label>
                    <input type="text" id="editTotalDue" name="editTotalDue" readonly value="0.00">
                </div>
            </div>
            
            <div class="input-group" id="editSectorInputGroup">
                <label for="editSector">Setor:</label>
                <select id="editSector" name="editSector">
                    <option value="Grafica">Gráfica</option>
                    <option value="Impressao Digital">Impressão Digital</option>
                </select>
            </div>
            
            <div class="input-group">
                <label for="editDescription">Descrição da OS:</label>
                <textarea id="editDescription" name="editDescription"></textarea>
            </div>
            <div class="input-group">
                <label for="editStatus">Status:</label>
                <select id="editStatus" name="editStatus">
                    <option value="Pendente">Pendente</option>
                    <option value="Paga">Paga</option>
                </select>
            </div>

            <button type="submit">Salvar Edição</button>
            <button type="button" id="printEditedOsBtn" class="submit-button-style" style="margin-top: 10px; background-color: #17a2b8;">Imprimir OS</button>
            <p> </p>
            <button type="button" id="cancelEdit" class="submit-button-style">Cancelar</button>
        </form>
    `;
    container.appendChild(editFormDiv);

    let editProductCounter = 0;

    function addEditProductField(product = { name: '', quantity: 1, value: 0 }) {
        editProductCounter++;
        const productDiv = document.createElement('div');
        productDiv.classList.add('product-item');
        productDiv.innerHTML = `
            <div class="input-group">
                <label for="editProductName${editProductCounter}">Produto:</label>
                <input type="text" id="editProductName${editProductCounter}" class="product-name" placeholder="Nome do Produto" value="${product.name}" required>
            </div>
            <div class="input-group">
                <label for="editProductQuantity${editProductCounter}">Quantidade:</label>
                <input type="number" id="editProductQuantity${editProductCounter}" class="product-quantity" value="${product.quantity}" min="1" required>
            </div>
            <div class="input-group">
                <label for="editProductValue${editProductCounter}">Valor Unitário:</label>
                <input type="number" id="editProductValue${editProductCounter}" class="product-value" value="${product.value.toFixed(2)}" min="0" step="0.01" required>
            </div>
            <button type="button" class="remove-product-btn">Remover</button>
            <hr>
        `;
        document.getElementById('editProductsContainer').appendChild(productDiv);

        productDiv.querySelector('.product-quantity').addEventListener('input', calculateEditTotal);
        productDiv.querySelector('.product-value').addEventListener('input', calculateEditTotal);
        productDiv.querySelector('.remove-product-btn').addEventListener('click', () => {
            productDiv.remove();
            calculateEditTotal();
        });
    }

    function calculateEditTotal() {
        let subtotal = 0;
        document.querySelectorAll('#editProductsContainer .product-item').forEach(item => {
            const quantity = parseFloat(item.querySelector('.product-quantity').value) || 0;
            const value = parseFloat(item.querySelector('.product-value').value) || 0;
            subtotal += quantity * value;
        });

        const discountType = document.getElementById('editDiscountType').value;
        const discountValue = parseFloat(document.getElementById('editDiscountValue').value) || 0;
        const editStatusSelect = document.getElementById('editStatus'); // Get status select
        let discountAmount = 0;

        if (discountType === 'percentage') {
            discountAmount = subtotal * (discountValue / 100);
        } else if (discountType === 'fixed') {
            discountAmount = discountValue;
        }
        
        document.getElementById('editTotalValue').value = subtotal.toFixed(2); // Valor Total da OS é a soma dos produtos

        let totalAPagar = subtotal - discountAmount;
        // Logic moved to backend, but we can replicate for immediate UI feedback
        if (editStatusSelect.value === 'Paga') { 
            totalAPagar = 0;
        }
        document.getElementById('editTotalDue').value = totalAPagar.toFixed(2); // Update Total a Pagar
    }

    // Event delegation for addProductBtn (now using the same ID as add_os.html)
    document.addEventListener('click', (event) => {
        if (event.target.id === 'addProductBtn') {
            addEditProductField();
        }
    });

    document.getElementById('editDiscountType').addEventListener('change', calculateEditTotal);
    document.getElementById('editDiscountValue').addEventListener('input', calculateEditTotal);
    document.getElementById('editStatus').addEventListener('change', calculateEditTotal); // Listen for status change
    document.getElementById('editSector').addEventListener('change', calculateEditTotal); // Listen for sector change

    // Converter handling for edit form
    const editIsConverterCheck = document.getElementById('editIsConverterCheck');
    const editConverterSelectorGroup = document.getElementById('editConverterSelectorGroup');
    const editConverterSelect = document.getElementById('editConverterSelect');
    const editClientName = document.getElementById('editClientName');
    const editClientPhone = document.getElementById('editClientPhone');
    let convertersList = [];

    async function fetchConvertersForEdit() {
        try {
            const response = await fetch('/api/converters');
            if (response.ok) {
                convertersList = await response.json();
                if (editConverterSelect) {
                    editConverterSelect.innerHTML = '<option value="">-- Selecione --</option>' +
                        convertersList
                            .filter(c => c.active !== false)
                            .map(c => `<option value="${c.id}">${c.name}</option>`)
                            .join('');
                }
            }
        } catch (e) {
            console.error('Erro ao buscar revendedores para edição:', e);
        }
    }
    fetchConvertersForEdit();

    if (editIsConverterCheck && editConverterSelect) {
        editIsConverterCheck.addEventListener('change', () => {
            if (editIsConverterCheck.checked) {
                editConverterSelectorGroup.style.display = 'block';
                editClientName.readOnly = true;
                editClientPhone.readOnly = true;
            } else {
                editConverterSelectorGroup.style.display = 'none';
                editClientName.readOnly = false;
                editClientPhone.readOnly = false;
                editConverterSelect.value = '';
            }
        });

        editConverterSelect.addEventListener('change', () => {
            const selectedId = editConverterSelect.value;
            if (selectedId) {
                const selectedConv = convertersList.find(c => String(c.id) === String(selectedId));
                if (selectedConv) {
                    editClientName.value = selectedConv.name;
                    editClientPhone.value = selectedConv.phone || '';
                }
            }
        });
    }

    // Hide sector input if not recepcao
    if (userRole !== 'recepcao') {
        const editSectorInputGroup = document.getElementById('editSectorInputGroup');
        if (editSectorInputGroup) {
            editSectorInputGroup.style.display = 'none';
        }
    }

    const osSearchInput = document.getElementById('osSearchInput');
    const searchButton = document.getElementById('searchButton');
    const searchFilterSection = document.getElementById('searchFilterSection');
    const editInstructionText = document.getElementById('editInstructionText');

    const PAGE_SIZE = 50;
    let currentOffset = 0;
    let allEditableOrders = [];
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
        params.set('editableOnly', 'true');
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
                allEditableOrders = allEditableOrders.concat(fetchedOrders);
            } else {
                allEditableOrders = fetchedOrders;
            }

            hasMore = fetchedOrders.length === PAGE_SIZE;

            displayServiceOrders(allEditableOrders);
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

        if (allEditableOrders.length === 0 || editFormDiv.style.display === 'block') {
            loadMoreContainer.style.display = 'none';
            return;
        }

        loadMoreContainer.style.display = 'flex';

        if (hasMore) {
            loadMoreBtn.style.display = 'block';
            loadMoreStatus.textContent = `Exibindo ${allEditableOrders.length} ordens de serviço editáveis.`;
        } else {
            loadMoreBtn.style.display = 'none';
            loadMoreStatus.textContent = `Todas as ${allEditableOrders.length} ordens de serviço editáveis foram carregadas.`;
        }
    }

    function displayServiceOrders(serviceOrders) {
        osListDiv.innerHTML = '';
        
        const editableServiceOrders = serviceOrders.filter(os => os.status !== 'Paga' && os.status !== 'Entregue');

        if (editableServiceOrders.length === 0) {
            osListDiv.innerHTML = '<p>Nenhuma Ordem de Serviço pendente ou em andamento encontrada para editar.</p>';
            return;
        }

        const ul = document.createElement('ul');
        editableServiceOrders.forEach(os => {
            const li = document.createElement('li');
            const converterName = os.convertername || os.converterName;
            const converterBadge = converterName
                ? `<span style="background-color: #ffc107; color: #212529; font-weight: bold; padding: 2px 8px; border-radius: 4px; font-size: 0.85rem; display: inline-block; margin: 4px 0;">Revendedor: ${converterName}</span><br>`
                : '';

            li.innerHTML = `
                <strong>ID da OS:</strong> ${os.osid || os.osId}<br>
                <strong>Cliente:</strong> ${os.clientname || os.clientName}<br>
                ${converterBadge}
                <strong>Descrição:</strong> ${os.description || 'N/A'}<br>
                <strong>Status:</strong> ${os.status}<br>
                <small>Criado em: ${new Date(os.createdat || os.createdAt).toLocaleString()}</small>
                <button class="edit-btn" data-id="${os.id}">Editar</button>
                <hr>
            `;
            ul.appendChild(li);
        });
        osListDiv.appendChild(ul);

        // Add event listeners to edit buttons
        document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const osId = event.target.dataset.id;
                const osToEdit = serviceOrders.find(os => os.id == osId);
                if (osToEdit) {
                    document.getElementById('editOsIdHidden').value = osToEdit.id;
                    document.getElementById('editOsId').value = osToEdit.osid || osToEdit.osId;
                    document.getElementById('editClientName').value = osToEdit.clientname || osToEdit.clientName;
                    document.getElementById('editClientPhone').value = osToEdit.clientphone || osToEdit.clientPhone || '';
                    const rawOsDate = osToEdit.osdate || osToEdit.osDate || '';
                    const dateMatch = String(rawOsDate).match(/^(\d{4}-\d{2}-\d{2})/);
                    document.getElementById('editOsDate').value = dateMatch ? dateMatch[1] : '';
                    document.getElementById('editDescription').value = osToEdit.description || '';
                    document.getElementById('editStatus').value = osToEdit.status;
                    
                    // Converter state
                    const currentConverterId = osToEdit.converterid || osToEdit.converterId;
                    if (currentConverterId) {
                        editIsConverterCheck.checked = true;
                        editConverterSelectorGroup.style.display = 'block';
                        editConverterSelect.value = String(currentConverterId);
                        editClientName.readOnly = true;
                        editClientPhone.readOnly = true;
                    } else {
                        editIsConverterCheck.checked = false;
                        editConverterSelectorGroup.style.display = 'none';
                        editConverterSelect.value = '';
                        editClientName.readOnly = false;
                        editClientPhone.readOnly = false;
                    }

                    // Populate products
                    document.getElementById('editProductsContainer').innerHTML = '';
                    editProductCounter = 0;
                    if (osToEdit.products && osToEdit.products.length > 0) {
                        osToEdit.products.forEach(product => addEditProductField(product));
                    } else {
                        addEditProductField();
                    }

                    // Populate discount
                    const discountType = osToEdit.discounttype !== undefined ? osToEdit.discounttype : (osToEdit.discount ? osToEdit.discount.type : 'percentage');
                    const discountVal = osToEdit.discountvalue !== undefined ? osToEdit.discountvalue : (osToEdit.discount ? osToEdit.discount.value : 0);
                    document.getElementById('editDiscountType').value = discountType;
                    document.getElementById('editDiscountValue').value = discountVal;
                    
                    // Populate totalDue
                    document.getElementById('editTotalValue').value = (parseFloat(osToEdit.totalvalue || osToEdit.totalValue) || 0).toFixed(2);
                    document.getElementById('editTotalDue').value = (parseFloat(osToEdit.totaldue || osToEdit.totalDue) || 0).toFixed(2);

                    // Populate sector
                    document.getElementById('editSector').value = osToEdit.sector || 'Grafica';

                    // Store createdBy for later use in update
                    editFormDiv.dataset.createdBy = osToEdit.createdby || osToEdit.createdBy || '';
                    editFormDiv.dataset.converterId = currentConverterId || '';

                    calculateEditTotal();

                    osListDiv.style.display = 'none';
                    if (loadMoreContainer) loadMoreContainer.style.display = 'none';
                    if (searchFilterSection) searchFilterSection.style.display = 'none';
                    if (editInstructionText) editInstructionText.style.display = 'none';
                    editFormDiv.style.display = 'block';
                }
            });
        });
    }

    // Handle cancel edit button
    document.getElementById('cancelEdit').addEventListener('click', () => {
        document.getElementById('editOsForm').reset();
        document.getElementById('editProductsContainer').innerHTML = '';
        editProductCounter = 0;
        editFormDiv.style.display = 'none';
        osListDiv.style.display = 'block';
        if (searchFilterSection) searchFilterSection.style.display = 'flex';
        if (editInstructionText) editInstructionText.style.display = 'block';
        updateLoadMoreUI();
    });

    // Handle print button on edit form
    document.addEventListener('click', function(event) {
        if (event.target && event.target.id === 'printEditedOsBtn') {
            printEditedOS();
        }
    });

    function printEditedOS() {
        const osIdHidden = document.getElementById('editOsIdHidden').value;
        const products = [];
        document.querySelectorAll('#editProductsContainer .product-item').forEach(item => {
            const productName = item.querySelector('.product-name').value;
            const productQuantity = parseFloat(item.querySelector('.product-quantity').value) || 0;
            const productValue = parseFloat(item.querySelector('.product-value').value) || 0;
            if (productName) {
                products.push({
                    name: productName,
                    quantity: productQuantity,
                    value: productValue
                });
            }
        });

        let osDateForPrint = document.getElementById('editOsDate').value;
        if (!osDateForPrint) {
            const today = new Date();
            osDateForPrint = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
        }

        const osDataForPrint = {
            osId: document.getElementById('editOsId').value,
            osid: document.getElementById('editOsId').value,
            clientName: document.getElementById('editClientName').value,
            clientname: document.getElementById('editClientName').value,
            clientPhone: document.getElementById('editClientPhone').value,
            clientphone: document.getElementById('editClientPhone').value,
            osDate: osDateForPrint,
            osdate: osDateForPrint,
            description: document.getElementById('editDescription').value,
            status: document.getElementById('editStatus').value,
            products: products,
            discount: {
                type: document.getElementById('editDiscountType').value,
                value: parseFloat(document.getElementById('editDiscountValue').value) || 0
            },
            discounttype: document.getElementById('editDiscountType').value,
            discountvalue: parseFloat(document.getElementById('editDiscountValue').value) || 0,
            totalValue: parseFloat(document.getElementById('editTotalValue').value) || 0,
            totalvalue: parseFloat(document.getElementById('editTotalValue').value) || 0,
            totalDue: parseFloat(document.getElementById('editTotalDue').value) || 0,
            totaldue: parseFloat(document.getElementById('editTotalDue').value) || 0,
            sector: document.getElementById('editSector').value
        };

        localStorage.setItem('osData', JSON.stringify(osDataForPrint));
        if (osIdHidden) {
            window.open(`print_os.html?id=${osIdHidden}`, '_blank');
        } else {
            window.open('print_os.html', '_blank');
        }
    }

    // Handle form submission for editing
    document.getElementById('editOsForm').addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission

        const osIdHidden = document.getElementById('editOsIdHidden').value;
        const osId = document.getElementById('editOsId').value;
        const clientName = document.getElementById('editClientName').value;
        const clientPhone = document.getElementById('editClientPhone').value; // Get phone value
        let osDate = document.getElementById('editOsDate').value; // Use let to allow modification
        const description = document.getElementById('editDescription').value;
        const status = document.getElementById('editStatus').value;
        const discountType = document.getElementById('editDiscountType').value;
        const discountValue = parseFloat(document.getElementById('editDiscountValue').value) || 0;
        const totalValue = parseFloat(document.getElementById('editTotalValue').value) || 0;
        const totalDue = parseFloat(document.getElementById('editTotalDue').value) || 0;

        // Ensure osDate is not empty; if so, set to current date
        if (!osDate) {
            const today = new Date();
            osDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
        }

        const products = [];
        document.querySelectorAll('#editProductsContainer .product-item').forEach(item => {
            const productName = item.querySelector('.product-name').value;
            const productQuantity = parseFloat(item.querySelector('.product-quantity').value) || 0;
            const productValue = parseFloat(item.querySelector('.product-value').value) || 0;
            if (productName) { // Only add if product name is not empty
                products.push({
                    name: productName,
                    quantity: productQuantity,
                    value: productValue
                });
            }
        });

        const selectedConverterId = (editIsConverterCheck && editIsConverterCheck.checked && editConverterSelect.value)
            ? Number(editConverterSelect.value)
            : null;

        const updatedOs = {
            osid: osId,
            clientname: clientName,
            clientphone: clientPhone,
            osdate: osDate,
            description,
            status,
            products,
            discount: {
                type: discountType,
                value: discountValue
            },
            totalvalue: totalValue,
            totaldue: totalDue,
            sector: document.getElementById('editSector').value, // Include sector
            createdby: editFormDiv.dataset.createdBy || loggedInUsername, // Use existing or current user
            converterid: Number.isInteger(selectedConverterId) && selectedConverterId > 0 ? selectedConverterId : null,
            userrole: userRole, // Pass user role for backend logic
            username: loggedInUsername,
            action: 'edit'
        };

        try {
            const response = await fetch(`/api/serviceOrders/${osIdHidden}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedOs)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            alert('Ordem de Serviço atualizada com sucesso!');
            editFormDiv.style.display = 'none';
            osListDiv.style.display = 'block';
            if (searchFilterSection) searchFilterSection.style.display = 'flex';
            if (editInstructionText) editInstructionText.style.display = 'block';
            fetchServiceOrders(); // Refresh the list
        } catch (error) {
            console.error('Erro ao atualizar Ordem de Serviço:', error);
            alert(`Erro ao atualizar Ordem de Serviço: ${error.message}`);
        }
    });

    fetchServiceOrders();
});
