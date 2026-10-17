document.addEventListener('DOMContentLoaded', () => {
    const userRole = sessionStorage.getItem('userRole');
    if (!userRole || userRole !== 'recepcao') {
        alert('Acesso restrito à recepção.');
        window.location.href = 'index.html';
        return;
    }

    const form = document.getElementById('editConverterForm');
    const cepInput = document.getElementById('cep');
    const saveBtn = document.getElementById('saveConverterBtn');
    const revendedorId = new URLSearchParams(window.location.search).get('id');

    if (!revendedorId) {
        alert('ID do revendedor não encontrado!');
        window.location.href = 'view_revendedores.html';
        return;
    }

    // Function to fetch address from ViaCEP
    async function fetchAddress(cep) {
        if (cep.length === 8) {
            try {
                const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                if (!response.ok) throw new Error('CEP não encontrado.');
                const data = await response.json();
                if (data.erro) {
                    alert('CEP não encontrado.');
                    return;
                }
                document.getElementById('address').value = data.logradouro || '';
                document.getElementById('neighborhood').value = data.bairro || '';
                document.getElementById('city').value = data.localidade || '';
                document.getElementById('state').value = data.uf || '';
            } catch (error) {
                console.error('Erro ao buscar CEP:', error);
            }
        }
    }

    if (cepInput) {
        cepInput.addEventListener('blur', () => fetchAddress(cepInput.value.replace(/\D/g, '')));
    }

    // Função para buscar os dados do revendedor e preencher o formulário
    async function fetchRevendedorData() {
        try {
            const response = await fetch(`/api/converters/${revendedorId}`);
            if (!response.ok) {
                throw new Error('Revendedor não encontrado.');
            }
            const revendedor = await response.json();
            populateForm(revendedor);
        } catch (error) {
            console.error('Erro ao buscar dados do revendedor:', error);
            alert(error.message);
            window.location.href = 'view_revendedores.html';
        }
    }

    // Preenche o formulário com os dados
    function populateForm(revendedor) {
        document.getElementById('name').value = revendedor.name || '';
        document.getElementById('phone').value = revendedor.phone || '';
        document.getElementById('email').value = revendedor.email || '';
        document.getElementById('cep').value = revendedor.cep || '';
        document.getElementById('address').value = revendedor.address || '';
        document.getElementById('number').value = revendedor.number || '';
        document.getElementById('complement').value = revendedor.complement || '';
        document.getElementById('neighborhood').value = revendedor.neighborhood || '';
        document.getElementById('city').value = revendedor.city || '';
        document.getElementById('state').value = revendedor.state || '';
        document.getElementById('active').value = revendedor.active === false ? 'false' : 'true';
    }

    // Evento de envio do formulário
    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!form.reportValidity()) {
            return;
        }

        const formData = {
            name: document.getElementById('name').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            email: document.getElementById('email').value.trim(),
            cep: document.getElementById('cep').value.trim(),
            address: document.getElementById('address').value.trim(),
            number: document.getElementById('number').value.trim(),
            complement: document.getElementById('complement').value.trim(),
            neighborhood: document.getElementById('neighborhood').value.trim(),
            city: document.getElementById('city').value.trim(),
            state: document.getElementById('state').value.trim(),
            active: document.getElementById('active').value === 'true',
        };

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Salvando...';
        }

        try {
            const response = await fetch(`/api/converters/${revendedorId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Falha ao atualizar o revendedor.');
            }

            const result = await response.json();
            alert(result.message || 'Revendedor atualizado com sucesso!');
            window.location.href = 'view_revendedores.html';
        } catch (error) {
            console.error('Erro ao atualizar:', error);
            alert(`Ocorreu um erro ao tentar atualizar o revendedor: ${error.message}`);
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Salvar Alterações';
            }
        }
    });

    fetchRevendedorData();
});
