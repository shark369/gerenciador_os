document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('editConverterForm');
    const revendedorId = new URLSearchParams(window.location.search).get('id');

    if (!revendedorId) {
        alert('ID do revendedor não encontrado!');
        window.location.href = 'view_revendedores.html';
        return;
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
        document.getElementById('name').value = revendedor.name;
        document.getElementById('phone').value = revendedor.phone;
        document.getElementById('email').value = revendedor.email;
        document.getElementById('cep').value = revendedor.cep || '';
        document.getElementById('address').value = revendedor.address || '';
        document.getElementById('number').value = revendedor.number || '';
        document.getElementById('complement').value = revendedor.complement || '';
        document.getElementById('neighborhood').value = revendedor.neighborhood || '';
        document.getElementById('city').value = revendedor.city || '';
        document.getElementById('state').value = revendedor.state || '';
        document.getElementById('active').value = revendedor.active;
    }

    // Evento de envio do formulário
    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const formData = {
            name: document.getElementById('name').value,
            phone: document.getElementById('phone').value,
            email: document.getElementById('email').value,
            cep: document.getElementById('cep').value,
            address: document.getElementById('address').value,
            number: document.getElementById('number').value,
            complement: document.getElementById('complement').value,
            neighborhood: document.getElementById('neighborhood').value,
            city: document.getElementById('city').value,
            state: document.getElementById('state').value,
            active: document.getElementById('active').value === 'true',
        };

        try {
            const response = await fetch(`/api/converters/${revendedorId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                throw new Error('Falha ao atualizar o revendedor.');
            }

            const result = await response.json();
            alert(result.message);
            window.location.href = 'view_revendedores.html'; // Redireciona de volta para a lista
        } catch (error) {
            console.error('Erro ao atualizar:', error);
            alert('Ocorreu um erro ao tentar atualizar o revendedor.');
        }
    });

    fetchRevendedorData();
});
