document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;

    const tabButtons = Array.from(document.querySelectorAll('.reports-tab-btn'));
    const tabPanels = Array.from(document.querySelectorAll('.report-tab-panel'));

    const converterSelect = document.getElementById('reportConverterSelect');
    const converterStartMonth = document.getElementById('reportConverterStartMonth');
    const converterEndMonth = document.getElementById('reportConverterEndMonth');
    const generateConverterReportBtn = document.getElementById('generateConverterReportBtn');
    const clearConverterReportBtn = document.getElementById('clearConverterReportBtn');
    const printConverterReportBtn = document.getElementById('printConverterReportBtn');
    const converterLoading = document.getElementById('converterLoading');

    const generalStartDate = document.getElementById('reportGeneralStartDate');
    const generalEndDate = document.getElementById('reportGeneralEndDate');
    const generalMonth = document.getElementById('reportGeneralMonth');
    const generalYear = document.getElementById('reportGeneralYear');
    const generateGeneralReportBtn = document.getElementById('generateGeneralReportBtn');
    const clearGeneralReportBtn = document.getElementById('clearGeneralReportBtn');
    const printGeneralReportBtn = document.getElementById('printGeneralReportBtn');
    const generalLoading = document.getElementById('generalLoading');

    const converterResultSection = document.getElementById('converterResultSection');
    const converterNoData = document.getElementById('converterNoData');
    const converterReportMeta = document.getElementById('converterReportMeta');
    const converterSummaryCards = document.getElementById('converterSummaryCards');
    const converterReportTableBody = document.getElementById('converterReportTableBody');
    const converterPrintGeneratedAt = document.getElementById('converterPrintGeneratedAt');

    const generalResultSection = document.getElementById('generalResultSection');
    const generalNoData = document.getElementById('generalNoData');
    const generalReportMeta = document.getElementById('generalReportMeta');
    const generalSummaryCards = document.getElementById('generalSummaryCards');
    const generalReportTableBody = document.getElementById('generalReportTableBody');
    const generalPrintGeneratedAt = document.getElementById('generalPrintGeneratedAt');

    function setActiveTab(tabName) {
        tabButtons.forEach((button) => {
            const isActive = button.dataset.tab === tabName;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-selected', String(isActive));
        });

        tabPanels.forEach((panel) => {
            panel.classList.toggle('is-active', panel.dataset.tabPanel === tabName);
        });

        body.dataset.activeTab = tabName;
    }

    tabButtons.forEach((button) => {
        button.addEventListener('click', () => setActiveTab(button.dataset.tab));
    });

    function setLoading(type, isLoading) {
        const isConverter = type === 'converter';

        if (isConverter) {
            converterLoading.hidden = !isLoading;
            generateConverterReportBtn.disabled = isLoading;
            clearConverterReportBtn.disabled = isLoading;
        } else {
            generalLoading.hidden = !isLoading;
            generateGeneralReportBtn.disabled = isLoading;
            clearGeneralReportBtn.disabled = isLoading;
        }
    }

    function setPrintAvailability(type, enabled) {
        if (type === 'converter') {
            printConverterReportBtn.disabled = !enabled;
        } else {
            printGeneralReportBtn.disabled = !enabled;
        }
    }

    function toDateRangeFromMonth(monthValue) {
        const [year, month] = monthValue.split('-').map(Number);
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0);
        return { start, end };
    }

    function formatDateForApi(dateObj) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function toValidDate(dateInput) {
        if (!dateInput) return null;

        if (dateInput instanceof Date) {
            return Number.isNaN(dateInput.getTime()) ? null : dateInput;
        }

        if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            const date = new Date(`${dateInput}T00:00:00`);
            return Number.isNaN(date.getTime()) ? null : date;
        }

        const date = new Date(dateInput);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatDateToPtBr(dateInput) {
        const date = toValidDate(dateInput);
        if (!date) return '-';
        return date.toLocaleDateString('pt-BR');
    }

    function formatDateTimeToPtBr(dateInput) {
        const date = toValidDate(dateInput);
        if (!date) return '-';
        return date.toLocaleString('pt-BR');
    }

    function formatCurrency(value) {
        const num = Number(value) || 0;
        return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getStatusClass(status) {
        const normalized = String(status || '').toLowerCase();
        if (normalized === 'pendente') return 'status-pendente';
        if (normalized === 'paga') return 'status-paga';
        if (normalized === 'entregue') return 'status-entregue';
        return 'status-default';
    }

    function createSummary(osList) {
        const summary = {
            totalOs: osList.length,
            pendenteQtd: 0,
            pagaQtd: 0,
            entregueQtd: 0,
            outrosQtd: 0,
            valorTotal: 0,
            valorPendente: 0,
            valorPaga: 0,
            valorEntregue: 0,
            valorOutros: 0,
            valorEmAberto: 0,
            ticketMedio: 0
        };

        osList.forEach((os) => {
            const status = String(os.status || '').toLowerCase();
            const total = Number(os.totalvalue) || 0;
            const due = Number(os.totaldue) || 0;

            summary.valorTotal += total;
            summary.valorEmAberto += due;

            if (status === 'pendente') {
                summary.pendenteQtd += 1;
                summary.valorPendente += total;
            } else if (status === 'paga') {
                summary.pagaQtd += 1;
                summary.valorPaga += total;
            } else if (status === 'entregue') {
                summary.entregueQtd += 1;
                summary.valorEntregue += total;
            } else {
                summary.outrosQtd += 1;
                summary.valorOutros += total;
            }
        });

        summary.ticketMedio = summary.totalOs > 0 ? summary.valorTotal / summary.totalOs : 0;
        return summary;
    }

    function renderSummary(container, summary) {
        const cards = [
            { label: 'Total de OSs', value: summary.totalOs },
            { label: 'Pendente', value: `${summary.pendenteQtd} (${formatCurrency(summary.valorPendente)})` },
            { label: 'Paga', value: `${summary.pagaQtd} (${formatCurrency(summary.valorPaga)})` },
            { label: 'Entregue', value: `${summary.entregueQtd} (${formatCurrency(summary.valorEntregue)})` },
            { label: 'Outros status', value: `${summary.outrosQtd} (${formatCurrency(summary.valorOutros)})` },
            { label: 'Valor total', value: formatCurrency(summary.valorTotal) },
            { label: 'Valor em aberto', value: formatCurrency(summary.valorEmAberto) },
            { label: 'Ticket médio', value: formatCurrency(summary.ticketMedio) }
        ];

        container.innerHTML = cards
            .map((card) => `
                <div class="report-summary-card">
                    <span class="report-summary-label">${escapeHtml(card.label)}</span>
                    <strong class="report-summary-value">${escapeHtml(card.value)}</strong>
                </div>
            `)
            .join('');
    }

    function renderTable(tableBody, osList) {
        tableBody.innerHTML = osList
            .map((os) => {
                const statusClass = getStatusClass(os.status);
                const descriptionRaw = os.description || '-';
                const descriptionSafe = escapeHtml(descriptionRaw);

                return `
                    <tr>
                        <td>${escapeHtml(os.osid)}</td>
                        <td>${escapeHtml(formatDateToPtBr(os.osdate))}</td>
                        <td>${escapeHtml(os.clientname || '-')}</td>
                        <td>${escapeHtml(os.clientphone || '-')}</td>
                        <td><span class="report-status-badge ${statusClass}">${escapeHtml(os.status || '-')}</span></td>
                        <td>${escapeHtml(formatCurrency(os.totalvalue))}</td>
                        <td>${escapeHtml(formatCurrency(os.totaldue))}</td>
                        <td>${escapeHtml(os.sector || '-')}</td>
                        <td>${escapeHtml(os.createdby || '-')}</td>
                        <td class="report-description-cell" title="${descriptionSafe}">${descriptionSafe}</td>
                    </tr>
                `;
            })
            .join('');
    }

    async function fetchConverters() {
        try {
            const response = await fetch('/api/converters');
            if (!response.ok) {
                throw new Error('Erro ao buscar revendedores');
            }

            const converters = await response.json();

            const options = converters
                .filter((converter) => converter.active !== false)
                .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
                .map((converter) => `
                    <option value="${escapeHtml(converter.name)}">${escapeHtml(converter.name)}</option>
                `)
                .join('');

            converterSelect.innerHTML = '<option value="">Selecione um revendedor</option>' + options;
        } catch (error) {
            console.error('Erro ao carregar revendedores:', error);
            alert('Não foi possível carregar a lista de revendedores para o relatório.');
        }
    }

    async function fetchReportData({ startDate, endDate, converterName }) {
        const params = new URLSearchParams();
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        if (converterName) params.set('converterName', converterName);

        const response = await fetch(`/api/reports?${params.toString()}`);
        if (!response.ok) {
            throw new Error('Erro ao buscar dados do relatório');
        }

        return response.json();
    }

    function hideConverterOutput() {
        converterResultSection.hidden = true;
        converterNoData.hidden = true;
        converterReportMeta.textContent = '';
        converterSummaryCards.innerHTML = '';
        converterReportTableBody.innerHTML = '';
        converterPrintGeneratedAt.textContent = '';
        setPrintAvailability('converter', false);
    }

    function hideGeneralOutput() {
        generalResultSection.hidden = true;
        generalNoData.hidden = true;
        generalReportMeta.textContent = '';
        generalSummaryCards.innerHTML = '';
        generalReportTableBody.innerHTML = '';
        generalPrintGeneratedAt.textContent = '';
        setPrintAvailability('general', false);
    }

    function clearConverterFilters() {
        converterSelect.value = '';
        converterStartMonth.value = '';
        converterEndMonth.value = '';
        hideConverterOutput();
    }

    function clearGeneralFilters() {
        generalStartDate.value = '';
        generalEndDate.value = '';
        generalMonth.value = '';
        generalYear.value = '';
        hideGeneralOutput();
    }

    async function generateConverterReport() {
        setLoading('converter', true);

        try {
            hideConverterOutput();

            const selectedConverter = converterSelect.value;
            const startMonth = converterStartMonth.value;
            const endMonth = converterEndMonth.value;

            if (!selectedConverter) {
                alert('Selecione um revendedor para gerar o relatório.');
                return;
            }

            if (!startMonth || !endMonth) {
                alert('Selecione mês inicial e mês final para o relatório por revendedor.');
                return;
            }

            const startRange = toDateRangeFromMonth(startMonth);
            const endRange = toDateRangeFromMonth(endMonth);

            if (endRange.end < startRange.start) {
                alert('O mês final não pode ser menor que o mês inicial.');
                return;
            }

            const startDate = formatDateForApi(startRange.start);
            const endDate = formatDateForApi(endRange.end);

            const osList = await fetchReportData({
                startDate,
                endDate,
                converterName: selectedConverter
            });

            if (!osList.length) {
                converterNoData.hidden = false;
                return;
            }

            const summary = createSummary(osList);
            converterReportMeta.textContent = `Revendedor: ${selectedConverter} | Período: ${formatDateToPtBr(startDate)} até ${formatDateToPtBr(endDate)}`;
            converterPrintGeneratedAt.textContent = `Gerado em: ${formatDateTimeToPtBr(new Date())}`;

            renderSummary(converterSummaryCards, summary);
            renderTable(converterReportTableBody, osList);

            converterResultSection.hidden = false;
            setPrintAvailability('converter', true);
        } catch (error) {
            console.error('Erro ao gerar relatório por revendedor:', error);
            alert('Erro ao gerar relatório por revendedor. Tente novamente.');
        } finally {
            setLoading('converter', false);
        }
    }

    function clearGeneralAlternativeFilters(except) {
        if (except !== 'date') {
            generalStartDate.value = '';
            generalEndDate.value = '';
        }
        if (except !== 'month') {
            generalMonth.value = '';
        }
        if (except !== 'year') {
            generalYear.value = '';
        }
    }

    function buildGeneralDateRange() {
        const hasStart = Boolean(generalStartDate.value);
        const hasEnd = Boolean(generalEndDate.value);
        const hasMonth = Boolean(generalMonth.value);
        const hasYear = Boolean(String(generalYear.value || '').trim());

        const selectedModeCount = [hasStart || hasEnd, hasMonth, hasYear].filter(Boolean).length;

        if (selectedModeCount === 0) {
            return { error: 'Escolha um filtro: intervalo de datas, mês ou ano.' };
        }

        if (selectedModeCount > 1) {
            return { error: 'Use apenas um tipo de filtro por vez (datas, mês ou ano).' };
        }

        if (hasStart || hasEnd) {
            if (!hasStart || !hasEnd) {
                return { error: 'Para intervalo de datas, preencha data inicial e data final.' };
            }

            const start = new Date(generalStartDate.value);
            const end = new Date(generalEndDate.value);

            if (end < start) {
                return { error: 'A data final não pode ser menor que a data inicial.' };
            }

            return {
                startDate: formatDateForApi(start),
                endDate: formatDateForApi(end),
                label: `${formatDateToPtBr(start)} até ${formatDateToPtBr(end)}`
            };
        }

        if (hasMonth) {
            const monthRange = toDateRangeFromMonth(generalMonth.value);
            return {
                startDate: formatDateForApi(monthRange.start),
                endDate: formatDateForApi(monthRange.end),
                label: `${formatDateToPtBr(monthRange.start)} até ${formatDateToPtBr(monthRange.end)}`
            };
        }

        const yearNum = Number(generalYear.value);
        if (!Number.isInteger(yearNum) || yearNum < 2000 || yearNum > 2100) {
            return { error: 'Informe um ano válido entre 2000 e 2100.' };
        }

        const start = new Date(yearNum, 0, 1);
        const end = new Date(yearNum, 11, 31);
        return {
            startDate: formatDateForApi(start),
            endDate: formatDateForApi(end),
            label: `Ano de ${yearNum}`
        };
    }

    async function generateGeneralReport() {
        setLoading('general', true);

        try {
            hideGeneralOutput();

            const range = buildGeneralDateRange();
            if (range.error) {
                alert(range.error);
                return;
            }

            const osList = await fetchReportData({
                startDate: range.startDate,
                endDate: range.endDate
            });

            if (!osList.length) {
                generalNoData.hidden = false;
                return;
            }

            const summary = createSummary(osList);
            generalReportMeta.textContent = `Filtro aplicado: ${range.label}`;
            generalPrintGeneratedAt.textContent = `Gerado em: ${formatDateTimeToPtBr(new Date())}`;

            renderSummary(generalSummaryCards, summary);
            renderTable(generalReportTableBody, osList);

            generalResultSection.hidden = false;
            setPrintAvailability('general', true);
        } catch (error) {
            console.error('Erro ao gerar relatório geral:', error);
            alert('Erro ao gerar relatório geral. Tente novamente.');
        } finally {
            setLoading('general', false);
        }
    }

    function printReport(reportType) {
        const hasData = reportType === 'converter'
            ? !converterResultSection.hidden
            : !generalResultSection.hidden;

        if (!hasData) {
            alert('Gere um relatório antes de imprimir.');
            return;
        }

        setActiveTab(reportType);
        body.dataset.printTab = reportType;
        window.print();
    }

    generalStartDate.addEventListener('change', () => {
        if (generalStartDate.value || generalEndDate.value) clearGeneralAlternativeFilters('date');
    });

    generalEndDate.addEventListener('change', () => {
        if (generalStartDate.value || generalEndDate.value) clearGeneralAlternativeFilters('date');
    });

    generalMonth.addEventListener('change', () => {
        if (generalMonth.value) clearGeneralAlternativeFilters('month');
    });

    generalYear.addEventListener('input', () => {
        if (String(generalYear.value || '').trim()) clearGeneralAlternativeFilters('year');
    });

    generateConverterReportBtn.addEventListener('click', generateConverterReport);
    clearConverterReportBtn.addEventListener('click', clearConverterFilters);
    printConverterReportBtn.addEventListener('click', () => printReport('converter'));

    generateGeneralReportBtn.addEventListener('click', generateGeneralReport);
    clearGeneralReportBtn.addEventListener('click', clearGeneralFilters);
    printGeneralReportBtn.addEventListener('click', () => printReport('general'));

    window.addEventListener('beforeprint', () => {
        const activeTab = body.dataset.activeTab || 'converter';
        body.dataset.printTab = activeTab;
    });

    window.addEventListener('afterprint', () => {
        body.removeAttribute('data-print-tab');
    });

    hideConverterOutput();
    hideGeneralOutput();
    setActiveTab('converter');
    fetchConverters();
});