document.addEventListener('DOMContentLoaded', () => {
    const addConverterForm = document.getElementById('addConverterForm');
    const cepInput = document.getElementById('cep');

    // Function to fetch address from ViaCEP
    async function fetchAddress(cep) {
        if (cep.length === 8) { // Basic validation for CEP length
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
                alert('Não foi possível buscar o endereço para este CEP.');
            }
        }
    }

    // Add event listener to CEP input
    if (cepInput) {
        cepInput.addEventListener('blur', () => fetchAddress(cepInput.value.replace(/\D/g, '')));
    }

    if (addConverterForm) {
        addConverterForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const converterData = {
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
                const response = await fetch('/api/converters', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(converterData),
                });

                if (response.ok) {
                    alert('Revendedor adicionado com sucesso!');
                    addConverterForm.reset(); // Clear the form
                    window.location.href = 'menu.html';
                } else {
                    const errorData = await response.json();
                    alert(`Erro ao adicionar revendedor: ${errorData.message || 'Erro desconhecido.'}`);
                }
            } catch (error) {
                console.error('Erro:', error);
                alert('Erro de conexão com o servidor.');
            }
        });
    }
});
