document.addEventListener('DOMContentLoaded', async () => {
    const container = document.querySelector('.container');
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
                    <option value="Concluída">Concluída</option>
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

    // Hide sector input if not recepcao
    const userRole = sessionStorage.getItem('userRole');
    const loggedInUsername = sessionStorage.getItem('username'); // Get logged-in username
    if (userRole !== 'recepcao') {
        const editSectorInputGroup = document.getElementById('editSectorInputGroup');
        if (editSectorInputGroup) {
            editSectorInputGroup.style.display = 'none';
        }
    }

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
        
        // Filter out service orders with status "Paga"
        const editableServiceOrders = serviceOrders.filter(os => os.status !== 'Paga');

        if (editableServiceOrders.length === 0) {
            osListDiv.innerHTML = '<p>Nenhuma Ordem de Serviço pendente ou em andamento encontrada para editar.</p>';
            return;
        }

        const ul = document.createElement('ul');
        editableServiceOrders.forEach(os => {
            const li = document.createElement('li');
            li.innerHTML = `
                <strong>ID da OS:</strong> ${os.osid}<br>
                <strong>Cliente:</strong> ${os.clientname}<br>
                <strong>Descrição:</strong> ${os.description}<br>
                <strong>Status:</strong> ${os.status}<br>
                <small>Criado em: ${new Date(os.createdat).toLocaleString()}</small>
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
                    document.getElementById('editOsId').value = osToEdit.osid;
                    document.getElementById('editClientName').value = osToEdit.clientname;
                    document.getElementById('editClientPhone').value = osToEdit.clientphone || ''; // Populate phone
                    document.getElementById('editOsDate').value = osToEdit.osdate;
                    document.getElementById('editDescription').value = osToEdit.description;
                    document.getElementById('editStatus').value = osToEdit.status;
                    
                    // Populate products
                    document.getElementById('editProductsContainer').innerHTML = '';
                    editProductCounter = 0; // Reset counter for edit form
                    if (osToEdit.products && osToEdit.products.length > 0) {
                        osToEdit.products.forEach(product => addEditProductField(product));
                    } else {
                        addEditProductField(); // Add at least one empty product field
                    }

                    // Populate discount
                    document.getElementById('editDiscountType').value = osToEdit.discounttype || 'percentage';
                    document.getElementById('editDiscountValue').value = osToEdit.discountvalue || 0;
                    
                    // Populate totalDue
                    document.getElementById('editTotalValue').value = (parseFloat(osToEdit.totalvalue) || 0).toFixed(2);
                    document.getElementById('editTotalDue').value = (parseFloat(osToEdit.totaldue) || 0).toFixed(2);

                    // Populate sector
                    document.getElementById('editSector').value = osToEdit.sector || 'Grafica'; // Default to Grafica if not set

                    // Store createdBy for later use in update
                    editFormDiv.dataset.createdBy = osToEdit.createdby || '';

                    calculateEditTotal(); // Calculate initial total for edit form

                    osListDiv.style.display = 'none';
                    editFormDiv.style.display = 'block';
                }
            });
        });
    }

    // Handle cancel edit button
    document.getElementById('cancelEdit').addEventListener('click', () => {
        editFormDiv.style.display = 'none';
        osListDiv.style.display = 'block';
    });

    // Handle print button on edit form
    document.addEventListener('click', function(event) {
        if (event.target && event.target.id === 'printEditedOsBtn') {
            printEditedOS();
        }
    });

    function printEditedOS() {
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

        const osDataForPrint = {
            osId: document.getElementById('editOsId').value,
            clientName: document.getElementById('editClientName').value,
            osDate: document.getElementById('editOsDate').value,
            description: document.getElementById('editDescription').value,
            status: document.getElementById('editStatus').value,
            products: products,
            discount: {
                type: document.getElementById('editDiscountType').value,
                value: parseFloat(document.getElementById('editDiscountValue').value) || 0
            },
            totalValue: parseFloat(document.getElementById('editTotalValue').value) || 0,
            totalDue: parseFloat(document.getElementById('editTotalDue').value) || 0,
            sector: document.getElementById('editSector').value
        };

        localStorage.setItem('osData', JSON.stringify(osDataForPrint));
        window.open('print_os.html', '_blank');
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

        const updatedOs = {
            osId,
            clientName,
            clientPhone,
            osDate,
            description,
            status,
            products,
            discount: {
                type: discountType,
                value: discountValue
            },
            totalValue,
            totalDue,
            sector: document.getElementById('editSector').value, // Include sector
            createdBy: editFormDiv.dataset.createdBy || loggedInUsername // Use existing or current user
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
            fetchServiceOrders(); // Refresh the list
        } catch (error) {
            console.error('Erro ao atualizar Ordem de Serviço:', error);
            alert(`Erro ao atualizar Ordem de Serviço: ${error.message}`);
        }
    });

    fetchServiceOrders();
});
