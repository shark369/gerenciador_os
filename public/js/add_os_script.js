document.addEventListener('DOMContentLoaded', async () => {
    const userRole = sessionStorage.getItem('userRole');
    const loggedInUsername = sessionStorage.getItem('username');

    if (!userRole) {
        window.location.href = 'index.html';
        return;
    }

    const addOsForm = document.getElementById('addOsForm');
    const productsContainer = document.getElementById('productsContainer');
    const addProductBtn = document.getElementById('addProductBtn');
    const totalValueInput = document.getElementById('totalValue');
    const totalDueInput = document.getElementById('totalDue');
    const discountTypeInput = document.getElementById('discountType');
    const discountValueInput = document.getElementById('discountValue');
    const osIdInput = document.getElementById('osId');
    const osDateInput = document.getElementById('osDate');
    const statusSelect = document.getElementById('status');
    const sectorSelect = document.getElementById('sector');
    const sectorInputGroup = document.getElementById('sectorInputGroup');
    const isConverterCheck = document.getElementById('isConverterCheck');
    const converterSelectorGroup = document.getElementById('converterSelectorGroup');
    const converterSelect = document.getElementById('converterSelect');
    const clientNameInput = document.getElementById('clientName');
    const clientPhoneInput = document.getElementById('clientPhone');
    const saveAndPrintBtn = document.getElementById('saveAndPrintBtn');

    let converters = [];

    function generateOsId() {
        return 'OS-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000);
    }

    // Hide sector input if not recepcao
    if (userRole !== 'recepcao' && sectorInputGroup) {
        sectorInputGroup.style.display = 'none';
    }

    // Generate unique ID for OS
    osIdInput.value = generateOsId();
    // Set current date
    osDateInput.valueAsDate = new Date();

    // Fetch converters from the API
    async function fetchConverters() {
        try {
            const response = await fetch('/api/converters');
            if (!response.ok) throw new Error('Failed to fetch converters');
            converters = await response.json();
            populateConverterSelect();
        } catch (error) {
            console.error('Error fetching converters:', error);
        }
    }

    function populateConverterSelect() {
        converterSelect.innerHTML = '<option value="">-- Selecione --</option>';
        converters.forEach(converter => {
            const option = document.createElement('option');
            option.value = converter.id;
            option.textContent = converter.name;
            converterSelect.appendChild(option);
        });
    }

    // Event listener for the checkbox
    isConverterCheck.addEventListener('change', () => {
        if (isConverterCheck.checked) {
            converterSelectorGroup.style.display = 'block';
            clientNameInput.readOnly = true;
            clientPhoneInput.readOnly = true;
        } else {
            converterSelectorGroup.style.display = 'none';
            clientNameInput.readOnly = false;
            clientPhoneInput.readOnly = false;
            clientNameInput.value = '';
            clientPhoneInput.value = '';
            converterSelect.value = '';
        }
    });

    // Event listener for the select dropdown
    converterSelect.addEventListener('change', () => {
        const selectedId = converterSelect.value;
        if (selectedId) {
            const selectedConverter = converters.find(c => c.id == selectedId);
            if (selectedConverter) {
                clientNameInput.value = selectedConverter.name;
                clientPhoneInput.value = selectedConverter.phone;
            }
        } else {
            clientNameInput.value = '';
            clientPhoneInput.value = '';
        }
    });

    let productCounter = 0;

    function addProductField() {
        productCounter++;
        const productDiv = document.createElement('div');
        productDiv.classList.add('product-item');
        productDiv.innerHTML = `
            <div class="input-group">
                <label for="productName${productCounter}">Produto:</label>
                <input type="text" id="productName${productCounter}" class="product-name" placeholder="Nome do Produto" required>
            </div>
            <div class="input-group">
                <label for="productQuantity${productCounter}">Quantidade:</label>
                <input type="number" id="productQuantity${productCounter}" class="product-quantity" value="1" min="1" required>
            </div>
            <div class="input-group">
                <label for="productValue${productCounter}">Valor Unitário:</label>
                <input type="number" id="productValue${productCounter}" class="product-value" value="0.00" min="0" step="0.01" required>
            </div>
            <button type="button" class="remove-product-btn">Remover</button>
            <hr>
        `;
        productsContainer.appendChild(productDiv);

        productDiv.querySelector('.product-quantity').addEventListener('input', calculateTotal);
        productDiv.querySelector('.product-value').addEventListener('input', calculateTotal);
        productDiv.querySelector('.remove-product-btn').addEventListener('click', () => {
            productDiv.remove();
            calculateTotal();
        });
    }

    function calculateTotal() {
        let subtotal = 0;
        document.querySelectorAll('.product-item').forEach(item => {
            const quantity = parseFloat(item.querySelector('.product-quantity').value) || 0;
            const value = parseFloat(item.querySelector('.product-value').value) || 0;
            subtotal += quantity * value;
        });

        const discountType = discountTypeInput.value;
        const discountValue = parseFloat(discountValueInput.value) || 0;
        let discountAmount = 0;

        if (discountType === 'percentage') {
            discountAmount = subtotal * (discountValue / 100);
        } else if (discountType === 'fixed') {
            discountAmount = discountValue;
        }
        
        totalValueInput.value = subtotal.toFixed(2);

        let totalAPagar = subtotal - discountAmount;
        if (totalAPagar < 0) totalAPagar = 0;

        if (statusSelect.value === 'Paga') {
            totalAPagar = 0;
        }
        totalDueInput.value = totalAPagar.toFixed(2);
    }

    addProductBtn.addEventListener('click', addProductField);
    discountTypeInput.addEventListener('change', calculateTotal);
    discountValueInput.addEventListener('input', calculateTotal);
    statusSelect.addEventListener('change', calculateTotal);

    // Add initial product field
    addProductField();

    // Initial fetch of converters
    await fetchConverters();

    addOsForm.addEventListener('submit', (event) => {
        event.preventDefault();
    });

    async function handleSaveAndPrint() {
        if (!addOsForm.reportValidity()) {
            return;
        }

        const clientName = clientNameInput.value.trim();
        const clientPhone = clientPhoneInput.value.trim();
        const osId = osIdInput.value || generateOsId();
        const osDate = osDateInput.value;
        const description = document.getElementById('description').value;
        const status = statusSelect.value;
        const discountType = discountTypeInput.value;
        const discountValue = parseFloat(discountValueInput.value) || 0;
        const totalValue = parseFloat(totalValueInput.value) || 0;
        const totalDue = parseFloat(totalDueInput.value) || 0;

        const products = [];
        document.querySelectorAll('.product-item').forEach(item => {
            const name = item.querySelector('.product-name').value.trim();
            const quantity = parseFloat(item.querySelector('.product-quantity').value) || 0;
            const value = parseFloat(item.querySelector('.product-value').value) || 0;
            if (name) {
                products.push({ name, quantity, value });
            }
        });

        if (products.length === 0) {
            alert('Por favor, adicione pelo menos um produto com nome.');
            return;
        }

        const selectedConverterId = (isConverterCheck.checked && converterSelect.value)
            ? Number(converterSelect.value)
            : null;

        const newServiceOrder = {
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
            sector: sectorSelect ? sectorSelect.value : 'Grafica',
            createdby: loggedInUsername || 'sistema',
            converterid: Number.isInteger(selectedConverterId) && selectedConverterId > 0 ? selectedConverterId : null
        };

        // Disable button to prevent duplicate submissions
        saveAndPrintBtn.disabled = true;
        const originalText = saveAndPrintBtn.textContent;
        saveAndPrintBtn.textContent = 'Salvando...';

        try {
            const response = await fetch('/api/serviceOrders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newServiceOrder)
            });

            if (response.ok) {
                const result = await response.json();
                alert('Ordem de Serviço adicionada com sucesso!');
                
                // Open the print window with the new OS ID
                window.open(`print_os.html?id=${result.id}`, '_blank');
                window.location.href = 'menu.html';
            } else {
                const errorData = await response.json();
                alert(`Erro ao adicionar Ordem de Serviço: ${errorData.message || response.statusText}`);
                saveAndPrintBtn.disabled = false;
                saveAndPrintBtn.textContent = originalText;
                osIdInput.value = generateOsId(); // Generate fresh ID on failure
            }
        } catch (error) {
            console.error('Erro:', error);
            alert('Erro de conexão com o servidor. Verifique sua conexão e tente novamente.');
            saveAndPrintBtn.disabled = false;
            saveAndPrintBtn.textContent = originalText;
            osIdInput.value = generateOsId();
        }
    }

    if (saveAndPrintBtn) {
        saveAndPrintBtn.addEventListener('click', handleSaveAndPrint);
    }
});
