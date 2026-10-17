document.addEventListener('DOMContentLoaded', () => {
    const userRole = sessionStorage.getItem('userRole');
    if (!userRole || userRole !== 'recepcao') {
        alert('Acesso restrito à recepção.');
        window.location.href = 'index.html';
        return;
    }

    const addConverterForm = document.getElementById('addConverterForm');
    const cepInput = document.getElementById('cep');
    const saveConverterBtn = document.getElementById('saveConverterBtn');

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

            if (!addConverterForm.reportValidity()) {
                return;
            }

            const converterData = {
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

            if (saveConverterBtn) {
                saveConverterBtn.disabled = true;
                saveConverterBtn.textContent = 'Salvando...';
            }

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
                    addConverterForm.reset();
                    window.location.href = 'view_revendedores.html';
                } else {
                    const errorData = await response.json();
                    alert(`Erro ao adicionar revendedor: ${errorData.message || 'Erro desconhecido.'}`);
                    if (saveConverterBtn) {
                        saveConverterBtn.disabled = false;
                        saveConverterBtn.textContent = 'Salvar Revendedor';
                    }
                }
            } catch (error) {
                console.error('Erro:', error);
                alert('Erro de conexão com o servidor.');
                if (saveConverterBtn) {
                    saveConverterBtn.disabled = false;
                    saveConverterBtn.textContent = 'Salvar Revendedor';
                }
            }
        });
    }
});
