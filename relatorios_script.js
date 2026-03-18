document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    const loggedUsername = sessionStorage.getItem('username');
    const loggedUserRole = sessionStorage.getItem('userRole');

    if (!loggedUserRole) {
        window.location.href = 'index.html';
        return;
    }

    if (loggedUsername !== 'jacira') {
        alert('Acesso negado: apenas jacira pode acessar os relatórios.');
        window.location.href = 'menu.html';
        return;
    }

    const YEAR_MIN = 2000;
    const YEAR_MAX = 2100;
    const MONTH_LABELS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

    const tabButtons = Array.from(document.querySelectorAll('.reports-tab-btn'));
    const tabPanels = Array.from(document.querySelectorAll('.report-tab-panel'));

    const converterSelect = document.getElementById('reportConverterSelect');
    const converterStartDay = document.getElementById('reportConverterStartDay');
    const converterStartMonth = document.getElementById('reportConverterStartMonth');
    const converterStartYear = document.getElementById('reportConverterStartYear');
    const converterEndDay = document.getElementById('reportConverterEndDay');
    const converterEndMonth = document.getElementById('reportConverterEndMonth');
    const converterEndYear = document.getElementById('reportConverterEndYear');
    const generateConverterReportBtn = document.getElementById('generateConverterReportBtn');
    const clearConverterReportBtn = document.getElementById('clearConverterReportBtn');
    const printConverterReportBtn = document.getElementById('printConverterReportBtn');
    const converterLoading = document.getElementById('converterLoading');

    const generalStartDay = document.getElementById('reportGeneralStartDay');
    const generalStartMonth = document.getElementById('reportGeneralStartMonth');
    const generalStartYear = document.getElementById('reportGeneralStartYear');
    const generalEndDay = document.getElementById('reportGeneralEndDay');
    const generalEndMonth = document.getElementById('reportGeneralEndMonth');
    const generalEndYear = document.getElementById('reportGeneralEndYear');
    const generalMonth = document.getElementById('reportGeneralMonth');
    const generalMonthYear = document.getElementById('reportGeneralMonthYear');
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

    function createNumberOptions(start, end, padToTwo = false) {
        const options = [];
        for (let value = start; value <= end; value += 1) {
            options.push({
                value: String(value),
                label: padToTwo ? String(value).padStart(2, '0') : String(value)
            });
        }
        return options;
    }

    function setSelectOptions(selectEl, options, placeholder) {
        if (!selectEl) return;

        selectEl.innerHTML = '';

        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = placeholder;
        selectEl.appendChild(placeholderOption);

        options.forEach((item) => {
            const optionEl = document.createElement('option');
            optionEl.value = item.value;
            optionEl.textContent = item.label;
            selectEl.appendChild(optionEl);
        });
    }

    function initializeDateSelectors() {
        const dayOptions = createNumberOptions(1, 31, true);
        const yearOptions = createNumberOptions(YEAR_MIN, YEAR_MAX, false);
        const monthOptions = MONTH_LABELS.map((label, index) => ({
            value: String(index + 1),
            label
        }));

        [converterStartDay, converterEndDay, generalStartDay, generalEndDay].forEach((selectEl) => {
            setSelectOptions(selectEl, dayOptions, 'dia');
        });

        [
            converterStartMonth,
            converterEndMonth,
            generalStartMonth,
            generalEndMonth,
            generalMonth
        ].forEach((selectEl) => {
            setSelectOptions(selectEl, monthOptions, 'mês');
        });

        [
            converterStartYear,
            converterEndYear,
            generalStartYear,
            generalEndYear,
            generalMonthYear,
            generalYear
        ].forEach((selectEl) => {
            setSelectOptions(selectEl, yearOptions, 'ano');
        });
    }

    function toDateFromParts(dayValue, monthValue, yearValue, label) {
        const hasAnyPart = Boolean(dayValue || monthValue || yearValue);
        const hasAllParts = Boolean(dayValue && monthValue && yearValue);

        if (!hasAnyPart) return { empty: true };
        if (!hasAllParts) return { error: `${label}: selecione dia, mês e ano.` };

        const day = Number(dayValue);
        const month = Number(monthValue);
        const year = Number(yearValue);

        if (
            !Number.isInteger(day)
            || !Number.isInteger(month)
            || !Number.isInteger(year)
            || month < 1
            || month > 12
            || day < 1
            || day > 31
            || year < YEAR_MIN
            || year > YEAR_MAX
        ) {
            return { error: `${label} inválida.` };
        }

        const date = new Date(year, month - 1, day);
        const isValidDate = (
            date.getFullYear() === year
            && date.getMonth() === month - 1
            && date.getDate() === day
        );

        if (!isValidDate) {
            return { error: `${label} inválida.` };
        }

        return { date };
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
        params.set('username', loggedUsername || '');

        const response = await fetch(`/api/reports?${params.toString()}`);
        if (!response.ok) {
            if (response.status === 403) {
                throw new Error('Acesso negado ao relatório.');
            }

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
        [
            converterStartDay,
            converterStartMonth,
            converterStartYear,
            converterEndDay,
            converterEndMonth,
            converterEndYear
        ].forEach((selectEl) => {
            selectEl.value = '';
        });
        hideConverterOutput();
    }

    function clearGeneralFilters() {
        [
            generalStartDay,
            generalStartMonth,
            generalStartYear,
            generalEndDay,
            generalEndMonth,
            generalEndYear,
            generalMonth,
            generalMonthYear,
            generalYear
        ].forEach((selectEl) => {
            selectEl.value = '';
        });
        hideGeneralOutput();
    }

    async function generateConverterReport() {
        setLoading('converter', true);

        try {
            hideConverterOutput();

            const selectedConverter = converterSelect.value;
            if (!selectedConverter) {
                alert('Selecione um revendedor para gerar o relatório.');
                return;
            }

            const startParsed = toDateFromParts(
                converterStartDay.value,
                converterStartMonth.value,
                converterStartYear.value,
                'Data inicial'
            );

            const endParsed = toDateFromParts(
                converterEndDay.value,
                converterEndMonth.value,
                converterEndYear.value,
                'Data final'
            );

            if (startParsed.empty || endParsed.empty) {
                alert('Selecione data inicial e data final completas para o relatório por revendedor.');
                return;
            }

            if (startParsed.error) {
                alert(startParsed.error);
                return;
            }

            if (endParsed.error) {
                alert(endParsed.error);
                return;
            }

            if (endParsed.date < startParsed.date) {
                alert('A data final não pode ser menor que a data inicial.');
                return;
            }

            const startDate = formatDateForApi(startParsed.date);
            const endDate = formatDateForApi(endParsed.date);

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
            alert(error.message === 'Acesso negado ao relatório.' ? error.message : 'Erro ao gerar relatório por revendedor. Tente novamente.');
        } finally {
            setLoading('converter', false);
        }
    }

    function hasAnyGeneralDateSelection() {
        return Boolean(
            generalStartDay.value
            || generalStartMonth.value
            || generalStartYear.value
            || generalEndDay.value
            || generalEndMonth.value
            || generalEndYear.value
        );
    }

    function hasAnyGeneralMonthSelection() {
        return Boolean(generalMonth.value || generalMonthYear.value);
    }

    function clearGeneralAlternativeFilters(except) {
        if (except !== 'date') {
            [
                generalStartDay,
                generalStartMonth,
                generalStartYear,
                generalEndDay,
                generalEndMonth,
                generalEndYear
            ].forEach((selectEl) => {
                selectEl.value = '';
            });
        }

        if (except !== 'month') {
            generalMonth.value = '';
            generalMonthYear.value = '';
        }

        if (except !== 'year') {
            generalYear.value = '';
        }
    }

    function buildGeneralDateRange() {
        const hasDateMode = hasAnyGeneralDateSelection();
        const hasMonthMode = hasAnyGeneralMonthSelection();
        const hasYearMode = Boolean(generalYear.value);

        const selectedModeCount = [hasDateMode, hasMonthMode, hasYearMode].filter(Boolean).length;

        if (selectedModeCount === 0) {
            return { error: 'Escolha um filtro: intervalo de datas, mês ou ano.' };
        }

        if (selectedModeCount > 1) {
            return { error: 'Use apenas um tipo de filtro por vez (datas, mês ou ano).' };
        }

        if (hasDateMode) {
            const startParsed = toDateFromParts(
                generalStartDay.value,
                generalStartMonth.value,
                generalStartYear.value,
                'Data inicial'
            );

            const endParsed = toDateFromParts(
                generalEndDay.value,
                generalEndMonth.value,
                generalEndYear.value,
                'Data final'
            );

            if (startParsed.empty || endParsed.empty) {
                return { error: 'Para intervalo de datas, preencha data inicial e data final completas.' };
            }

            if (startParsed.error) return { error: startParsed.error };
            if (endParsed.error) return { error: endParsed.error };

            if (endParsed.date < startParsed.date) {
                return { error: 'A data final não pode ser menor que a data inicial.' };
            }

            return {
                startDate: formatDateForApi(startParsed.date),
                endDate: formatDateForApi(endParsed.date),
                label: `${formatDateToPtBr(startParsed.date)} até ${formatDateToPtBr(endParsed.date)}`
            };
        }

        if (hasMonthMode) {
            if (!generalMonth.value || !generalMonthYear.value) {
                return { error: 'Para filtro por mês, selecione mês e ano.' };
            }

            const month = Number(generalMonth.value);
            const year = Number(generalMonthYear.value);

            if (!Number.isInteger(month) || month < 1 || month > 12) {
                return { error: 'Mês inválido para o filtro mensal.' };
            }

            if (!Number.isInteger(year) || year < YEAR_MIN || year > YEAR_MAX) {
                return { error: `Ano inválido para o filtro mensal (entre ${YEAR_MIN} e ${YEAR_MAX}).` };
            }

            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 0);

            return {
                startDate: formatDateForApi(start),
                endDate: formatDateForApi(end),
                label: `${MONTH_LABELS[month - 1]} de ${year}`
            };
        }

        const yearNum = Number(generalYear.value);
        if (!Number.isInteger(yearNum) || yearNum < YEAR_MIN || yearNum > YEAR_MAX) {
            return { error: `Informe um ano válido entre ${YEAR_MIN} e ${YEAR_MAX}.` };
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
            alert(error.message === 'Acesso negado ao relatório.' ? error.message : 'Erro ao gerar relatório geral. Tente novamente.');
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

    [
        generalStartDay,
        generalStartMonth,
        generalStartYear,
        generalEndDay,
        generalEndMonth,
        generalEndYear
    ].forEach((selectEl) => {
        selectEl.addEventListener('change', () => {
            if (hasAnyGeneralDateSelection()) {
                clearGeneralAlternativeFilters('date');
            }
        });
    });

    [generalMonth, generalMonthYear].forEach((selectEl) => {
        selectEl.addEventListener('change', () => {
            if (hasAnyGeneralMonthSelection()) {
                clearGeneralAlternativeFilters('month');
            }
        });
    });

    generalYear.addEventListener('change', () => {
        if (generalYear.value) {
            clearGeneralAlternativeFilters('year');
        }
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

    initializeDateSelectors();
    hideConverterOutput();
    hideGeneralOutput();
    setActiveTab('converter');
    fetchConverters();
});