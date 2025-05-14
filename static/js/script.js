document.addEventListener('DOMContentLoaded', () => {
    // Elementos da interface
    const codigoInput = document.getElementById('codigo-input');
    const searchBtn = document.getElementById('search-btn');
    const printBtn = document.getElementById('print-btn');
    const clearBtn = document.getElementById('clear-btn');
    const barcodeBtn = document.getElementById('barcode-btn');
    const produtosGrid = document.getElementById('produtos-grid');
    const messageDiv = document.getElementById('message');
    const countDisplay = document.getElementById('count-display');
    const totalDisplay = document.getElementById('total-display');
    const datetimeDisplay = document.getElementById('datetime');
    const suggestionsContainer = document.getElementById('suggestions-container');
    
    // Elementos do modal de códigos
    const editCodeModal = document.getElementById('editCodeModal');
    const modalProductInfo = document.getElementById('modalProductInfo');
    const codesContainer = document.getElementById('codesContainer');
    const saveCodesBtn = document.getElementById('saveCodesBtn');
    const closeModal = document.querySelector('.close-modal');
    
    // Elementos do modal de descrição
    const editDescModal = document.getElementById('editDescModal');
    const descInput = document.getElementById('desc-input');
    const priceInput = document.getElementById('price-input');
    const saveDescBtn = document.getElementById('save-desc-btn');
    const closeDescModal = document.querySelector('.close-desc-modal');
    
    // Variáveis de estado
    let produtosAdicionados = [];
    const MAX_PRODUTOS = 12;
    let searchTimeout;
    let currentProduct = null;
    let editingProduct = null;

    // Inicialização
    initModals();
    setupEventListeners();
    updateDateTime();
    setInterval(updateDateTime, 60000);
    showEmptyState();
    updateTotals();
    codigoInput.focus();

    function initModals() {
        // Modal de códigos
        closeModal.onclick = () => {
            editCodeModal.style.display = 'none';
        };

        // Modal de descrição
        closeDescModal.onclick = () => {
            editDescModal.style.display = 'none';
        };

        window.onclick = (event) => {
            if (event.target === editCodeModal) {
                editCodeModal.style.display = 'none';
            }
            if (event.target === editDescModal) {
                editDescModal.style.display = 'none';
            }
        };

        saveCodesBtn.onclick = saveProductCodes;
        saveDescBtn.onclick = saveProductDesc;
    }

    function setupEventListeners() {
        searchBtn.addEventListener('click', searchProduct);
        clearBtn.addEventListener('click', clearAllProducts);
        printBtn.addEventListener('click', printProducts);
        barcodeBtn.addEventListener('click', simulateBarcodeScanner);
        codigoInput.addEventListener('paste', (e) => {
            setTimeout(searchProduct, 100);
        });
        codigoInput.addEventListener('input', handleSearchInput);
    }

    function handleSearchInput(e) {
        const searchTerm = e.target.value.trim();
        if (searchTerm.length < 2) {
            suggestionsContainer.style.display = 'none';
            return;
        }
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            const suggestions = await fetchSuggestions(searchTerm);
            showSuggestions(suggestions);
        }, 300);
    }

    function updateDateTime() {
        const now = new Date();
        const options = { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit', 
            minute: '2-digit'
        };
        
        datetimeDisplay.textContent = now.toLocaleDateString('pt-BR', options);
    }

    function showMessage(msg, type = 'info') {
        messageDiv.textContent = msg;
        messageDiv.className = `${type} message-show`;
        setTimeout(() => {
            messageDiv.classList.remove('message-show');
        }, 3000);
    }

    function updateTotals() {
        countDisplay.textContent = `${produtosAdicionados.length}/${MAX_PRODUTOS} itens`;
        const totalValue = produtosAdicionados.reduce((sum, p) => sum + p.preco, 0);
        totalDisplay.textContent = `Total: R$ ${totalValue.toFixed(2)}`;
    }

    function addProductToGrid(produto) {
        const emptyState = produtosGrid.querySelector('.empty-state');
        if (emptyState) emptyState.remove();
        
        const totalCodigos = 1 + (produto.codigos_alternativos?.length || 0);
        const needsTwoColumns = totalCodigos >= 4;
        
        const produtoCard = document.createElement('div');
        produtoCard.className = `produto-card ${needsTwoColumns ? 'double-column' : ''}`;
        
        const imgHTML = produto.imagem 
            ? `<img src="${produto.imagem}" alt="${produto.nome}" onerror="this.onerror=null;this.src='';this.parentElement.innerHTML='<div class=\\'no-image\\'><i class=\\'fas fa-box-open\\'></i><span>Sem imagem</span></div>';">` 
            : `<div class="no-image"><i class="fas fa-box-open"></i><span>Sem imagem</span></div>`;
        
        let codigosHTML = '';
        if (produto.codigo_principal) {
            codigosHTML += `
                <div class="product-code principal">
                    <div class="code-header">
                        <span class="code-label">Principal:</span>
                        <span class="code-value">${produto.codigo_principal}</span>
                    </div>
                </div>`;
        }
        
        if (produto.codigo_pesquisado && produto.codigo_pesquisado !== produto.codigo_principal) {
            codigosHTML += `
                <div class="product-code pesquisado">
                    <div class="code-header">
                        <span class="code-label">Pesquisado:</span>
                        <span class="code-value">${produto.codigo_pesquisado}</span>
                    </div>
                </div>`;
        }
        
        if (produto.codigos_alternativos?.length > 0) {
            produto.codigos_alternativos.forEach(codigo => {
                if (codigo !== produto.codigo_pesquisado) {
                    codigosHTML += `
                        <div class="product-code alternativo">
                            <div class="code-header">
                                <span class="code-label">Alternativo:</span>
                                <span class="code-value">${codigo}</span>
                            </div>
                        </div>`;
                }
            });
        }
        
        produtoCard.innerHTML = `
            <div class="product-image">
                ${imgHTML}
            </div>
            <div class="product-info">
                <div class="product-header">
                    <h3 class="product-name">${produto.nome}</h3>
                    <button class="edit-desc-btn" data-produto-id="${produto.produto_id}">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                </div>
                <div class="product-price-container">
                    <span class="price-ttb">R$ ${produto.preco.toFixed(2)}</span>
                    <button class="edit-price-btn" data-produto-id="${produto.produto_id}">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
                <div class="codes-container">${codigosHTML}</div>
                <div class="product-actions">
                    <button class="edit-btn" data-produto-id="${produto.produto_id}">
                        <i class="fas fa-edit"></i> Editar Códigos
                    </button>
                    <button class="remove-btn" data-produto-id="${produto.produto_id}">
                        <i class="fas fa-times"></i> Remover
                    </button>
                </div>
            </div>
        `;
        
        produtoCard.querySelector('.edit-desc-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const produtoId = e.currentTarget.getAttribute('data-produto-id');
            const produto = produtosAdicionados.find(p => p.produto_id == produtoId);
            openEditDescModal(produto);
        });
        
        produtoCard.querySelector('.edit-price-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const produtoId = e.currentTarget.getAttribute('data-produto-id');
            const produto = produtosAdicionados.find(p => p.produto_id == produtoId);
            openEditDescModal(produto);
        });
        
        produtoCard.querySelector('.edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const produtoId = e.currentTarget.getAttribute('data-produto-id');
            const produto = produtosAdicionados.find(p => p.produto_id == produtoId);
            openEditModal(produto);
        });
        
        produtoCard.querySelector('.remove-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const produtoId = e.currentTarget.getAttribute('data-produto-id');
            removeProduct(produtoId, produtoCard);
        });
        
        produtosGrid.appendChild(produtoCard);
    }

    function openEditModal(product) {
        currentProduct = product;
        modalProductInfo.innerHTML = `
            <h4>${product.nome}</h4>
            <p>Preço: R$ ${product.preco.toFixed(2)}</p>
        `;
        
        codesContainer.innerHTML = '';
        const allCodes = [
            product.codigo_principal,
            ...(product.codigos_alternativos || [])
        ].filter(Boolean);
        
        allCodes.forEach((code, index) => {
            addCodeInput(code, index === 0);
        });
        
        const addCodeBtn = document.createElement('button');
        addCodeBtn.className = 'btn-secondary';
        addCodeBtn.textContent = '+ Adicionar Código';
        addCodeBtn.onclick = () => addCodeInput('', false);
        codesContainer.appendChild(addCodeBtn);
        
        editCodeModal.style.display = 'block';
    }

    function openEditDescModal(product) {
        editingProduct = product;
        descInput.value = product.nome;
        priceInput.value = product.preco.toFixed(2);
        editDescModal.style.display = 'block';
    }

    function addCodeInput(code, isPrincipal) {
        const codeGroup = document.createElement('div');
        codeGroup.className = 'code-input-group';
        codeGroup.innerHTML = `
            <input type="text" value="${code}" placeholder="Código" ${isPrincipal ? 'readonly' : ''}>
            ${isPrincipal ? 
                '<span class="principal-badge">Principal</span>' : 
                '<button class="remove-code-btn">&times;</button>'}
        `;
        
        if (!isPrincipal) {
            codeGroup.querySelector('.remove-code-btn').addEventListener('click', () => {
                codeGroup.remove();
            });
        }
        
        codesContainer.insertBefore(codeGroup, codesContainer.lastChild);
    }

    async function saveProductCodes() {
        if (!currentProduct) return;
        
        const codeInputs = document.querySelectorAll('#codesContainer input[type="text"]');
        const codes = Array.from(codeInputs).map(input => input.value.trim()).filter(Boolean);
        
        if (codes.length === 0) {
            showMessage('Pelo menos um código é obrigatório!', 'error');
            return;
        }

        try {
            const response = await fetch('/api/products/update_codes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    produto_id: currentProduct.produto_id,
                    codigo_principal: codes[0],
                    codigos_alternativos: codes.slice(1)
                })
            });

            if (!response.ok) {
                throw new Error('Erro ao atualizar códigos');
            }

            currentProduct.codigo_principal = codes[0];
            currentProduct.codigos_alternativos = codes.slice(1);
            
            editCodeModal.style.display = 'none';
            showMessage('Códigos atualizados com sucesso!', 'success');
            
            reloadProducts();

        } catch (error) {
            console.error('Erro:', error);
            showMessage('Erro ao atualizar códigos', 'error');
        }
    }

    async function saveProductDesc() {
        if (editingProduct) {
            try {
                const response = await fetch('/api/products/update', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        produto_id: editingProduct.produto_id,
                        descricao: descInput.value,
                        preco: parseFloat(priceInput.value)
                    })
                });

                if (!response.ok) {
                    throw new Error('Erro ao atualizar produto');
                }

                editingProduct.nome = descInput.value;
                editingProduct.preco = parseFloat(priceInput.value);
                reloadProducts();
                editDescModal.style.display = 'none';
                showMessage('Descrição e preço atualizados!', 'success');
            } catch (error) {
                console.error('Erro:', error);
                showMessage('Erro ao atualizar produto', 'error');
            }
        }
    }

    function reloadProducts() {
        produtosGrid.innerHTML = '';
        if (produtosAdicionados.length === 0) {
            showEmptyState();
        } else {
            produtosAdicionados.forEach(p => addProductToGrid(p));
        }
        updateTotals();
    }

    function removeProduct(produtoId, produtoCard) {
        produtosAdicionados = produtosAdicionados.filter(p => p.produto_id != produtoId);
        produtoCard.remove();
        
        if (produtosAdicionados.length === 0) {
            showEmptyState();
        }
        
        updateTotals();
        showMessage('Produto removido', 'info');
    }

    function showEmptyState() {
        produtosGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <p>Nenhum produto adicionado</p>
                <small>Digite um código ou escaneie um produto para começar</small>
            </div>
        `;
    }

    async function searchProduct() {
        const codigo = codigoInput.value.trim();
        
        if (!codigo) {
            showMessage('Por favor, digite um código válido', 'error');
            return;
        }
        
        if (produtosAdicionados.length >= MAX_PRODUTOS) {
            showMessage(`Máximo de ${MAX_PRODUTOS} produtos atingido`, 'error');
            return;
        }
        
        const produtoExistente = produtosAdicionados.find(p => 
            p.codigo_principal === codigo || 
            (p.codigos_alternativos && p.codigos_alternativos.includes(codigo)) ||
            p.codigo_pesquisado === codigo
        );
        
        if (produtoExistente) {
            showMessage('Este produto já foi adicionado', 'error');
            return;
        }
        
        try {
            showMessage('Buscando produto...', 'info');
            
            const response = await fetch('/api/products/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ codigo: codigo })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro ao buscar produto');
            }

            const produto = await response.json();
            
            produtosAdicionados.push({
                produto_id: produto.produto_id,
                codigo_principal: produto.codigo_principal,
                codigo_pesquisado: produto.codigo_pesquisado,
                codigos_alternativos: produto.codigos_alternativos || [],
                nome: produto.nome,
                preco: produto.preco,
                imagem: produto.imagem
            });
            
            addProductToGrid(produtosAdicionados[produtosAdicionados.length - 1]);
            codigoInput.value = '';
            codigoInput.focus();
            updateTotals();
            showMessage('Produto adicionado com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro:', error);
            showMessage(error.message, 'error');
        }
    }

    function clearAllProducts() {
        produtosAdicionados = [];
        produtosGrid.innerHTML = '';
        showEmptyState();
        updateTotals();
        showMessage('Todos os produtos foram removidos', 'info');
    }

    function simulateBarcodeScanner() {
        const sampleCodes = [
            '1408458', '1408236', '1409648', '9610', '8303',
            '2218', '2213', '2202', '2204', '611'
        ];
        const randomCode = sampleCodes[Math.floor(Math.random() * sampleCodes.length)];
        codigoInput.value = randomCode;
        searchProduct();
    }

    async function printProducts() {
        if (produtosAdicionados.length === 0) {
            showMessage('Nenhum produto para imprimir', 'error');
            return;
        }

        const printWindow = window.open('', '_blank');
        
        // HTML base para impressão
        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Lista de Produtos</title>
                <style>
                    body { font-family: Arial; margin: 0; padding: 20px; }
                    h1 { text-align: center; }
                    .product { 
                        margin-bottom: 15px; 
                        border-bottom: 1px solid #eee; 
                        padding-bottom: 10px;
                        page-break-inside: avoid;
                    }
                    .codes { font-size: 0.9em; color: #555; }
                    .product-image { 
                        text-align: center; 
                        margin-bottom: 10px;
                        height: 150px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .product-image img { 
                        max-width: 100%;
                        max-height: 100%;
                        object-fit: contain;
                    }
                    @page {
                        size: A4;
                        margin: 10mm;
                    }
                    @media print {
                        body {
                            padding: 0;
                        }
                    }
                </style>
            </head>
            <body>
                <h1>Lista de Produtos</h1>
                <p>Data: ${new Date().toLocaleDateString('pt-BR')}</p>
        `;

        // Processar cada produto para incluir as imagens
        for (const produto of produtosAdicionados) {
            let imgHTML = '';
            
            if (produto.imagem) {
                try {
                    // Tentar carregar a imagem via fetch
                    const response = await fetch(produto.imagem);
                    if (response.ok) {
                        const blob = await response.blob();
                        const base64 = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        });
                        imgHTML = `<img src="${base64}" alt="${produto.nome}">`;
                    } else {
                        imgHTML = '<div>Sem imagem disponível</div>';
                    }
                } catch (error) {
                    console.error('Erro ao carregar imagem:', error);
                    imgHTML = '<div>Sem imagem disponível</div>';
                }
            } else {
                imgHTML = '<div>Sem imagem</div>';
            }

            html += `
                <div class="product">
                    <div class="product-image">
                        ${imgHTML}
                    </div>
                    <h3>${produto.nome}</h3>
                    <div>Preço: R$ ${produto.preco.toFixed(2)}</div>
                    <div class="codes">
                        Códigos: ${[produto.codigo_principal, ...(produto.codigos_alternativos || [])].filter(Boolean).join(', ')}
                    </div>
                </div>
            `;
        }

        html += `
            <div style="margin-top: 30px; font-weight: bold;">
                Total: R$ ${produtosAdicionados.reduce((sum, p) => sum + p.preco, 0).toFixed(2)} (${produtosAdicionados.length} itens)
            </div>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
        
        // Esperar um pouco para garantir que as imagens estejam carregadas antes de imprimir
        setTimeout(() => {
            printWindow.print();
        }, 500);
    }

    async function fetchSuggestions(searchTerm) {
        try {
            const response = await fetch(`/api/products/suggestions?q=${encodeURIComponent(searchTerm)}`);
            if (response.ok) {
                return await response.json();
            }
            return [];
        } catch (error) {
            console.error('Erro ao buscar sugestões:', error);
            return [];
        }
    }

    function showSuggestions(suggestions) {
        suggestionsContainer.innerHTML = '';
        
        if (suggestions.length === 0) {
            suggestionsContainer.style.display = 'none';
            return;
        }

        const suggestionsList = document.createElement('ul');
        suggestionsList.className = 'suggestions-list';
        
        suggestions.forEach(product => {
            const suggestionItem = document.createElement('li');
            suggestionItem.className = 'suggestion-item';
            suggestionItem.innerHTML = `
                <div class="suggestion-image">
                    ${product.imagem 
                        ? `<img src="${product.imagem}" alt="${product.nome}">` 
                        : '<i class="fas fa-box-open"></i>'}
                </div>
                <div class="suggestion-info">
                    <div class="suggestion-code">${product.codigo}</div>
                    <div class="suggestion-name">${product.nome}</div>
                    <div class="suggestion-price">R$ ${product.preco.toFixed(2)}</div>
                </div>
            `;
            
            suggestionItem.addEventListener('click', () => {
                codigoInput.value = product.codigo;
                suggestionsContainer.style.display = 'none';
                searchProduct();
            });
            
            suggestionsList.appendChild(suggestionItem);
        });
        
        suggestionsContainer.appendChild(suggestionsList);
        suggestionsContainer.style.display = 'block';
    }
});