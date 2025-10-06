const discountTypeInput = document.getElementById('discountType');
const discountValueInput = document.getElementById('discountValue');
const totalDueInput = document.getElementById('totalDue');
const sectorSelect = document.getElementById('sector');
const loggedInUsername = sessionStorage.getItem('username');

async function openPrintWindow() {
    const clientName = document.getElementById('clientName').value;
    const clientPhone = document.getElementById('clientPhone').value;
    const osId = document.getElementById('osId').value;
    const osDate = document.getElementById('osDate').value;
    const description = document.getElementById('description').value;
    const status = document.getElementById('status').value;
    const discountType = discountTypeInput.value;
    const discountValue = parseFloat(discountValueInput.value) || 0;
    const totalValue = parseFloat(document.getElementById('totalValue').value) || 0;

    const products = [];
    document.querySelectorAll('.product-item').forEach(item => {
        products.push({
            name: item.querySelector('.product-name').value,
            quantity: parseFloat(item.querySelector('.product-quantity').value) || 0,
            value: parseFloat(item.querySelector('.product-value').value) || 0
        });
    });

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
        totaldue: parseFloat(totalDueInput.value),
        sector: sectorSelect ? sectorSelect.value : null,
        createdby: loggedInUsername, // Send the username of the creator
        createdat: new Date().toISOString()
    };

    try {
        const response = await fetch('/api/serviceOrders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newServiceOrder)
        });

        if (response.ok) {
            alert('Ordem de Serviço adicionada com sucesso!');
            localStorage.setItem('osData', JSON.stringify(newServiceOrder));
            window.open('print_os.html', '_blank');
            window.location.href = 'menu.html'; // Redirect to menu
        } else {
            alert('Erro ao adicionar Ordem de Serviço.');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro de conexão com o servidor.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const addOsForm = document.getElementById('addOsForm');
    const productsContainer = document.getElementById('productsContainer');
    const addProductBtn = document.getElementById('addProductBtn');
    const totalValueInput = document.getElementById('totalValue');
    const osIdInput = document.getElementById('osId');
    const osDateInput = document.getElementById('osDate');
    const statusSelect = document.getElementById('status');
    const sectorInputGroup = document.getElementById('sectorInputGroup'); // New

    // Hide sector input if not recepcao
    const userRole = sessionStorage.getItem('userRole');
    if (userRole !== 'recepcao' && sectorInputGroup) {
        sectorInputGroup.style.display = 'none';
    }

    // Generate a simple unique ID for OS (for demonstration purposes)
    osIdInput.value = 'OS-' + Date.now();
    // Set current date
    osDateInput.valueAsDate = new Date();

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

        // Add event listeners for calculation
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
        
        totalValueInput.value = subtotal.toFixed(2); // Valor Total da OS é a soma dos produtos

        let totalAPagar = subtotal - discountAmount; // Total a Pagar é a soma dos produtos menos o desconto
        if (statusSelect.value === 'Concluída') {
            totalAPagar = 0;
        }
        totalDueInput.value = totalAPagar.toFixed(2);
    }

    addProductBtn.addEventListener('click', addProductField);
    discountTypeInput.addEventListener('change', calculateTotal); // Recalculate on type change
    discountValueInput.addEventListener('input', calculateTotal);
    statusSelect.addEventListener('change', calculateTotal); // Recalculate on status change

    // Add initial product field
    addProductField();

    addOsForm.addEventListener('submit', (event) => {
        event.preventDefault();
    });

    const saveAndPrintBtn = document.getElementById('saveAndPrintBtn');
    if (saveAndPrintBtn) {
        saveAndPrintBtn.addEventListener('click', openPrintWindow);
    }
});
