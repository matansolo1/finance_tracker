// FinControl Frontend Logic
// Path: /static/app.js

let doughnutChart = null;
let barChart = null;
let lineChart = null;
let analyticsChart = null;

// Helper: Format number to Israeli Shekel (NIS) currency format
function formatNIS(val) {
    const num = parseFloat(val) || 0;
    if (num < 0) {
        return `₪(${Math.abs(num).toLocaleString('he-IL')})`;
    }
    return `₪${num.toLocaleString('he-IL')}`;
}

// Helper: Parse Hebrew date formatted as DD/MM/YYYY into YYYY-MM-DD
function parseDMYtoYMD(dmy) {
    if (!dmy) return '';
    const parts = dmy.split('/');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return dmy;
}

// Tab Switching logic
window.switchTab = function(tabName) {
    // Hide all view panes
    document.querySelectorAll('.view-pane').forEach(el => el.classList.add('hidden'));
    
    // Show the active view pane
    const targetPane = document.getElementById(`view-${tabName}`);
    if (targetPane) {
        targetPane.classList.remove('hidden');
    }

    // Update tab button styles
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('border-emerald-500', 'text-emerald-400', 'font-semibold');
        btn.classList.add('border-transparent', 'text-slate-400', 'font-medium');
    });

    const activeBtn = document.getElementById(`tab-${tabName}`);
    if (activeBtn) {
        activeBtn.classList.remove('border-transparent', 'text-slate-400', 'font-medium');
        activeBtn.classList.add('border-emerald-500', 'text-emerald-400', 'font-semibold');
    }
};

// Fetch data from Flask backend and update all tabs and views
async function fetchTimeTravelData() {
    const year = document.getElementById('year-select').value;
    const month = document.getElementById('month-select').value;
    
    console.log(`[Time Traveler] נסיעה בזמן אל: ${month}/${year}... מבצע קריאת API`);

    try {
        const response = await fetch(`/api/data?year=${year}&month=${month}`);
        const data = await response.json();
        
        console.log('[Time Traveler] התקבלו נתונים מהשרת:', data);
        
        if (data.error) {
            console.error('שגיאה מהשרת:', data.error);
            return;
        }

        // Set active user display info
        if (data.user_email) {
            const displayEl = document.getElementById('user-display-email');
            if (displayEl) {
                displayEl.textContent = data.user_email;
            }
        }

        // Check for onboarding / new user greeting
        if (data.is_new_user) {
            const onboardingEl = document.getElementById('onboarding-banner');
            if (onboardingEl) {
                onboardingEl.classList.remove('hidden');
            }
        }

        // 1. Update Monthly View
        updateMonthlyView(data, month, year);

        // 2. Update Quarterly View
        updateQuarterlyView(data, month, year);

        // 3. Update Yearly View
        updateYearlyView(data, month, year);

    } catch (error) {
        console.error('[Time Traveler] שגיאה בביצוע קריאת API:', error);
    }
}

// 1. Update Monthly Tab
function updateMonthlyView(data, month, year) {
    // Save to window for index-based access
    window.currentTransactions = data.transactions;

    // KPI Cards
    if (data.month_summary) {
        document.getElementById('monthly-kpi-income').textContent = formatNIS(data.month_summary.total_income);
        document.getElementById('monthly-kpi-fixed').textContent = formatNIS(data.month_summary.fixed_expenses_total);
        document.getElementById('monthly-kpi-variable').textContent = formatNIS(data.month_summary.variable_expenses_total);
        document.getElementById('monthly-kpi-savings').textContent = formatNIS(data.month_summary.net_savings);
    }

    // Render Transaction Table
    const tableContainer = document.getElementById('transaction-table-container');
    if (!tableContainer) return;

    if (!data.transactions || data.transactions.length === 0) {
        tableContainer.innerHTML = `
            <div class="p-8 text-center text-slate-500">
                אין תנועות זמינות לחודש זה.
            </div>
        `;
    } else {
        let rowsHtml = '';
        data.transactions.forEach((tx, idx) => {
            const isEstimate = tx.is_estimate === true;
            const isCreditCard = tx.is_credit_card === true;
            const rowClass = isEstimate ? 'opacity-70 bg-slate-900/40 hover:bg-slate-900/60' : 'hover:bg-[#1F2937]/30';
            
            // Icon and styling for estimates vs actuals
            const estimateIcon = isEstimate 
                ? `<span class="inline-flex items-center text-amber-400 mr-1" title="הערכה דינמית קבועה">
                     <svg class="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                       <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                     </svg>
                   </span>`
                : '';

            // Credit card badge for actual transactions
            const creditCardBadge = (!isEstimate && isCreditCard)
                ? `<span class="inline-flex items-center text-blue-400 mr-1" title="משולם באשראי - מנוכה מהוצאות אשראי כלליות">💳</span>`
                : '';

            const convertBtn = isEstimate
                ? `<button onclick="fillRulesForm(${idx})" class="text-xs bg-[#1F2937] border border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-emerald-400 font-medium py-1 px-2.5 rounded transition shadow-sm whitespace-nowrap">
                     הפוך לקבוע / ערוך חוק 🔄
                   </button>`
                : `<span class="text-xs text-slate-500 font-mono">בפועל ✔️</span>`;

            const editBtn = `
                <button onclick="editTransaction(${idx})" class="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-1 px-2.5 rounded transition shadow-sm hover:shadow-emerald-950/20 flex items-center gap-1 mx-auto whitespace-nowrap">
                    <span>עריכה / אישור תנועה ✏️</span>
                </button>
            `;

            let ccHintHtml = '';
            if (tx.item === 'הוצאות אשראי כלליות' && data.credit_card_deductions && data.credit_card_deductions.total_deducted > 0) {
                const originalTotal = tx.amount + data.credit_card_deductions.total_deducted;
                ccHintHtml = `
                    <div class="text-[11px] text-slate-400 mt-0.5 font-normal" title="חוקים ששולמו באשראי וקוזזו אוטומטית: ${data.credit_card_deductions.breakdown.map(b => `${b.item} (₪${b.amount})`).join(', ')}">
                        <span>סך אשראי מקורי: ₪${originalTotal.toLocaleString('he-IL')}</span><br/>
                        <span class="text-emerald-400 font-medium">קוזז לחוקים: -₪${data.credit_card_deductions.total_deducted.toLocaleString('he-IL')}</span>
                    </div>
                `;
            }

            rowsHtml += `
                <tr class="border-b border-slate-800 transition ${rowClass}">
                    <td class="px-6 py-4 text-sm text-slate-300 font-medium whitespace-nowrap">${tx.date}</td>
                    <td class="px-6 py-4 text-sm text-slate-300 whitespace-nowrap">
                        <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            tx.category === 'הכנסות' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' : 'bg-slate-800 text-slate-300 border border-slate-700/50'
                        }">
                            ${tx.category}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-sm text-slate-100 font-semibold whitespace-nowrap">
                        <div class="flex items-center gap-1">
                            ${estimateIcon}
                            ${creditCardBadge}
                            <span>${tx.item}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-sm font-bold whitespace-nowrap ${
                        tx.category === 'הכנסות' ? 'text-emerald-400' : tx.amount > 1500 ? 'text-rose-400' : 'text-slate-100'
                    }">
                        ${formatNIS(tx.amount)}
                        ${tx.amount > 1500 && tx.category !== 'הכנסות' ? '<span class="mr-1 text-[10px] bg-rose-950/40 text-rose-400 px-1.5 py-0.5 rounded border border-rose-900/30 font-normal">חריג</span>' : ''}
                        ${ccHintHtml}
                    </td>
                    <td class="px-6 py-4 text-sm text-slate-400 whitespace-normal max-w-xs">${tx.notes || ''}</td>
                    <td class="px-6 py-4 text-sm text-center whitespace-nowrap">${convertBtn}</td>
                    <td class="px-6 py-4 text-sm text-center whitespace-nowrap">${editBtn}</td>
                </tr>
            `;
        });

        tableContainer.innerHTML = `
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-slate-800 text-right">
                    <thead class="bg-[#1F2937]/40 text-xs font-bold uppercase text-slate-400 tracking-wider">
                        <tr>
                            <th scope="col" class="px-6 py-3.5">תאריך</th>
                            <th scope="col" class="px-6 py-3.5">קטגוריה</th>
                            <th scope="col" class="px-6 py-3.5">סעיף</th>
                            <th scope="col" class="px-6 py-3.5">סכום</th>
                            <th scope="col" class="px-6 py-3.5">הערות</th>
                            <th scope="col" class="px-6 py-3.5 text-center">סטטוס</th>
                            <th scope="col" class="px-6 py-3.5 text-center">פעולות</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800">
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Expense doughnut chart logic
    const expenseCategories = {};
    let hasExpenses = false;

    if (data.transactions) {
        data.transactions.forEach(tx => {
            if (tx.category !== 'הכנסות') {
                expenseCategories[tx.category] = (expenseCategories[tx.category] || 0) + tx.amount;
                hasExpenses = true;
            }
        });
    }

    const chartCanvas = document.getElementById('expense-doughnut-chart');
    if (!chartCanvas) return;

    if (doughnutChart) {
        doughnutChart.destroy();
    }

    if (!hasExpenses) {
        // Render a placeholder text or empty state instead
        chartCanvas.classList.add('hidden');
        document.getElementById('chart-empty-state').classList.remove('hidden');
    } else {
        chartCanvas.classList.remove('hidden');
        document.getElementById('chart-empty-state').classList.add('hidden');

        const labels = Object.keys(expenseCategories);
        const values = Object.values(expenseCategories);

        const ctx = chartCanvas.getContext('2d');
        doughnutChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: [
                        '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6366F1'
                    ],
                    borderColor: '#111827',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#F3F4F6',
                            font: { family: 'Rubik', size: 12 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` ${context.label}: ${formatNIS(context.raw)}`;
                            }
                        }
                    }
                }
            }
        });
    }
}

// 2. Update Quarterly Tab
function updateQuarterlyView(data, month, year) {
    if (!data.quarter_summary) return;
    
    // KPI Cards
    document.getElementById('quarter-kpi-income').textContent = formatNIS(data.quarter_summary.total_income);
    document.getElementById('quarter-kpi-fixed').textContent = formatNIS(data.quarter_summary.fixed_expenses);
    document.getElementById('quarter-kpi-variable').textContent = formatNIS(data.quarter_summary.variable_expenses);
    document.getElementById('quarter-kpi-savings').textContent = formatNIS(data.quarter_summary.net_savings);

    // Update Bar Chart comparison
    const barCanvas = document.getElementById('quarter-bar-chart');
    if (!barCanvas) return;

    if (barChart) {
        barChart.destroy();
    }

    const breakdown = data.quarter_summary.breakdown || [];
    const monthNames = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
    
    const labels = breakdown.map(item => monthNames[item.month - 1]);
    const incomes = breakdown.map(item => item.summary.total_income);
    const fixedExpenses = breakdown.map(item => item.summary.fixed_expenses);
    const variableExpenses = breakdown.map(item => item.summary.variable_expenses);
    const savings = breakdown.map(item => item.summary.net_savings);

    const ctx = barCanvas.getContext('2d');
    barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'הכנסות',
                    data: incomes,
                    backgroundColor: '#10B981',
                    borderRadius: 6
                },
                {
                    label: 'הוצאות קבועות',
                    data: fixedExpenses,
                    backgroundColor: '#EF4444',
                    borderRadius: 6
                },
                {
                    label: 'הוצאות משתנות',
                    data: variableExpenses,
                    backgroundColor: '#F59E0B',
                    borderRadius: 6
                },
                {
                    label: 'חיסכון נטו',
                    data: savings,
                    backgroundColor: '#3B82F6',
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#F3F4F6', font: { family: 'Rubik' } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` ${context.dataset.label}: ${formatNIS(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#9CA3AF', font: { family: 'Rubik' } },
                    grid: { color: '#1F2937' }
                },
                y: {
                    ticks: { color: '#9CA3AF', font: { family: 'Rubik' } },
                    grid: { color: '#1F2937' }
                }
            }
        }
    });
}

// 3. Update Yearly Tab
function updateYearlyView(data, month, year) {
    if (!data.year_summary) return;

    // YTD KPIs
    document.getElementById('yearly-kpi-income').textContent = formatNIS(data.year_summary.total_income);
    document.getElementById('yearly-kpi-fixed').textContent = formatNIS(data.year_summary.fixed_expenses);
    document.getElementById('yearly-kpi-variable').textContent = formatNIS(data.year_summary.variable_expenses);
    document.getElementById('yearly-kpi-savings').textContent = formatNIS(data.year_summary.net_savings);

    // Update Savings Line Chart YTD
    const lineCanvas = document.getElementById('yearly-line-chart');
    if (!lineCanvas) return;

    if (lineChart) {
        lineChart.destroy();
    }

    const breakdown = data.year_summary.breakdown || [];
    const monthNames = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

    const labels = breakdown.map(item => monthNames[item.month - 1]);
    const savingsYTD = breakdown.map(item => item.summary.net_savings);

    const ctx = lineCanvas.getContext('2d');
    lineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'חיסכון חודשי נטו',
                data: savingsYTD,
                borderColor: '#10B981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#10B981',
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#F3F4F6', font: { family: 'Rubik' } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` חיסכון: ${formatNIS(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#9CA3AF', font: { family: 'Rubik' } },
                    grid: { color: '#1F2937' }
                },
                y: {
                    ticks: { color: '#9CA3AF', font: { family: 'Rubik' } },
                    grid: { color: '#1F2937' }
                }
            }
        }
    });
}

// Convert recurring click in table -> Fill Rules Form and scroll
window.fillRulesForm = function(txOrIdx) {
    let tx = txOrIdx;
    if (typeof txOrIdx === 'number' || typeof txOrIdx === 'string') {
        const idx = parseInt(txOrIdx, 10);
        if (window.currentTransactions && window.currentTransactions[idx]) {
            tx = window.currentTransactions[idx];
        } else {
            return;
        }
    }
    if (!tx) return;
    
    // Switch view to monthly where the rules form resides
    if (typeof window.switchTab === 'function') {
        window.switchTab('monthly');
    }
    
    // Fill the inputs of the rules form (checking both rule-* and raw IDs)
    const itemInput = document.getElementById('rule-item') || document.getElementById('item_name');
    const categoryInput = document.getElementById('rule-category') || document.getElementById('category');
    const amountInput = document.getElementById('rule-amount') || document.getElementById('amount');
    const typeInput = document.getElementById('rule-type');
    const startDateInput = document.getElementById('rule-start-date');
    const endDateInput = document.getElementById('rule-end-date');

    if (itemInput) itemInput.value = tx.item || '';
    if (categoryInput) categoryInput.value = tx.category || 'אשראי';
    if (amountInput) amountInput.value = tx.amount || 0;
    if (typeInput) typeInput.value = 'Fixed Exact'; // Default logical recurring option
    
    const isCreditCardCheckbox = document.getElementById('rule-is-credit-card');
    if (isCreditCardCheckbox) {
        isCreditCardCheckbox.checked = tx.is_credit_card === true;
    }
    
    // Get formatted start date or fallback to current month first date
    const start_date_val = tx.date ? parseDMYtoYMD(tx.date) : '';
    if (startDateInput) startDateInput.value = start_date_val;
    if (endDateInput) endDateInput.value = '';

    // Scroll to Rules Form smoothly
    const formElement = document.getElementById('rules-form-card');
    if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Flash visual highlight to highlight the auto-filled form
        formElement.classList.add('ring-2', 'ring-emerald-500');
        setTimeout(() => {
            formElement.classList.remove('ring-2', 'ring-emerald-500');
        }, 1500);
    }
};

// Load categories from backend
async function loadCategories() {
    try {
        const res = await fetch('/api/categories');
        const data = await res.json();
        
        if (data.categories && data.categories.length > 0) {
            // Populate actual transaction form category dropdown
            const actualCategorySelect = document.getElementById('actual-category');
            if (actualCategorySelect) {
                actualCategorySelect.innerHTML = '<option value="">בחר קטגוריה...</option>';
                data.categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat;
                    option.textContent = cat;
                    actualCategorySelect.appendChild(option);
                });
            }
            
            // Populate rules form category dropdown
            const ruleCategorySelect = document.getElementById('rule-category');
            if (ruleCategorySelect) {
                ruleCategorySelect.innerHTML = '<option value="">בחר קטגוריה...</option>';
                data.categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat;
                    option.textContent = cat;
                    ruleCategorySelect.appendChild(option);
                });
            }

            // Populate edit transaction form category dropdown
            const editCategorySelect = document.getElementById('edit-category');
            if (editCategorySelect) {
                editCategorySelect.innerHTML = '<option value="">בחר קטגוריה...</option>';
                data.categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat;
                    option.textContent = cat;
                    editCategorySelect.appendChild(option);
                });
            }
            
            // Populate analytics category dropdown
            const analyticsCategorySelect = document.getElementById('analytics-category');
            if (analyticsCategorySelect) {
                analyticsCategorySelect.innerHTML = '<option value="">בחר קטגוריה...</option>';
                data.categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat;
                    option.textContent = cat;
                    analyticsCategorySelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Load analytics trends
async function loadAnalyticsTrends() {
    const category = document.getElementById('analytics-category').value;
    const periodType = document.getElementById('analytics-period').value;
    const year = document.getElementById('year-select').value;
    const month = document.getElementById('month-select').value;
    
    if (!category) {
        alert('אנא בחר קטגוריה לניתוח');
        return;
    }
    
    const loadBtn = document.getElementById('analytics-load-btn');
    const originalText = loadBtn.textContent;
    loadBtn.disabled = true;
    loadBtn.textContent = 'טוען נתונים... ⏳';
    
    try {
        const res = await fetch(`/api/analytics/trends?category=${encodeURIComponent(category)}&period_type=${periodType}&year=${year}&month=${month}`);
        const data = await res.json();
        
        if (data.error) {
            alert('שגיאה: ' + data.error);
            return;
        }
        
        // Show average card
        const avgCard = document.getElementById('analytics-average-card');
        const avgAmount = document.getElementById('analytics-average-amount');
        const avgSubtitle = document.getElementById('analytics-average-subtitle');
        
        avgAmount.textContent = formatNIS(data.average_per_month);
        avgSubtitle.textContent = `מחושב על פני ${data.month_count} חודשים`;
        avgCard.classList.remove('hidden');
        
        // Show chart container
        const chartContainer = document.getElementById('analytics-chart-container');
        chartContainer.classList.remove('hidden');
        
        // Hide empty state
        document.getElementById('analytics-empty-state').classList.add('hidden');
        
        // Render chart
        const canvas = document.getElementById('analytics-trends-chart');
        if (analyticsChart) {
            analyticsChart.destroy();
        }
        
        const monthNames = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
        
        const labels = data.monthly_data.map(item => {
            if (periodType === 'multi_year') {
                return `${monthNames[item.month - 1]} ${item.year}`;
            }
            return monthNames[item.month - 1];
        });
        
        const amounts = data.monthly_data.map(item => item.amount);
        
        const ctx = canvas.getContext('2d');
        analyticsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `${category} - הוצאות חודשיות`,
                    data: amounts,
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: '#10B981',
                    pointHoverRadius: 7,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#F3F4F6', font: { family: 'Rubik', size: 13 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` ${context.dataset.label}: ${formatNIS(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#9CA3AF', font: { family: 'Rubik' } },
                        grid: { color: '#1F2937' }
                    },
                    y: {
                        ticks: { 
                            color: '#9CA3AF', 
                            font: { family: 'Rubik' },
                            callback: function(value) {
                                return '₪' + value.toLocaleString('he-IL');
                            }
                        },
                        grid: { color: '#1F2937' }
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('Error loading analytics:', error);
        alert('שגיאה בטעינת הניתוח');
    } finally {
        loadBtn.disabled = false;
        loadBtn.textContent = originalText;
    }
}

// Set up event listeners on load
document.addEventListener('DOMContentLoaded', () => {
    // Get current date
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // JavaScript months are 0-indexed
    
    // Define date range: Start from November 2023, end at current year + 5
    const START_YEAR = 2023;
    const endYear = currentYear + 5;
    
    // Populate year selector dynamically
    const yearSelect = document.getElementById('year-select');
    if (yearSelect) {
        yearSelect.innerHTML = ''; // Clear existing options
        
        for (let year = START_YEAR; year <= endYear; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === currentYear) {
                option.selected = true; // Set current year as default
            }
            yearSelect.appendChild(option);
        }
    }
    
    // Set month selector to current month
    const monthSelect = document.getElementById('month-select');
    if (monthSelect) {
        monthSelect.value = currentMonth; // Set current month as default
    }
    
    // Register selectors
    document.getElementById('year-select').addEventListener('change', fetchTimeTravelData);
    document.getElementById('month-select').addEventListener('change', fetchTimeTravelData);

    // Load categories
    loadCategories();

    // Initial Fetch - will load data for current month/year
    fetchTimeTravelData();

    // Set today's date for rule form start-date by default
    const today = new Date();
    const formattedToday = today.toISOString().split('T')[0];
    const ruleStartDateInput = document.getElementById('rule-start-date');
    if (ruleStartDateInput && !ruleStartDateInput.value) {
        ruleStartDateInput.value = formattedToday;
    }

    // Actual Transaction Form Submit Handler
    const actualTransactionForm = document.getElementById('actual-transaction-form');
    if (actualTransactionForm) {
        actualTransactionForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = actualTransactionForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'שומר תנועה... ⏳';

            const payload = {
                date: document.getElementById('actual-date').value,
                category: document.getElementById('actual-category').value,
                item: document.getElementById('actual-item').value,
                amount: parseFloat(document.getElementById('actual-amount').value) || 0,
                notes: document.getElementById('actual-notes').value || '',
                is_credit_card: document.getElementById('actual-is-credit-card') ? document.getElementById('actual-is-credit-card').checked : false
            };

            try {
                const res = await fetch('/api/expenses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();

                if (result.success) {
                    alert('התנועה נשמרה בהצלחה ב-Excel! 🎉');
                    actualTransactionForm.reset();
                    // Set today's date again
                    const today = new Date().toISOString().split('T')[0];
                    document.getElementById('actual-date').value = today;
                    // Fetch data to refresh view instantly
                    fetchTimeTravelData();
                } else {
                    alert('שגיאה בשמירת התנועה: ' + (result.error || 'שגיאה לא ידועה'));
                }
            } catch (error) {
                console.error('Error saving actual transaction:', error);
                alert('שגיאה בתקשורת עם השרת.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

    // Edit Transaction Form Submit Handler
    const editTransactionForm = document.getElementById('edit-transaction-form');
    if (editTransactionForm) {
        editTransactionForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = editTransactionForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'שומר עריכה... ⏳';

            const payload = {
                date: document.getElementById('edit-orig-date').value,
                category: document.getElementById('edit-orig-category').value,
                item: document.getElementById('edit-orig-item').value,
                amount: parseFloat(document.getElementById('edit-amount').value) || 0,
                notes: document.getElementById('edit-notes').value || '',
                is_credit_card: document.getElementById('edit-is-credit-card') ? document.getElementById('edit-is-credit-card').checked : false
            };

            try {
                const res = await fetch('/api/expenses', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();

                if (result.success) {
                    alert('התנועה עודכנה בהצלחה ב-Excel! 🎉');
                    // Hide edit form
                    const editCard = document.getElementById('edit-transaction-form-card');
                    if (editCard) editCard.classList.add('hidden');
                    editTransactionForm.reset();
                    // Refresh data
                    fetchTimeTravelData();
                } else {
                    alert('שגיאה בעדכון התנועה: ' + (result.error || 'שגיאה לא ידועה'));
                }
            } catch (error) {
                console.error('Error editing transaction:', error);
                alert('שגיאה בתקשורת עם השרת.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

    // Rules Form Submit Handler
    const rulesForm = document.getElementById('rules-form');
    if (rulesForm) {
        rulesForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = rulesForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'שומר חוק... ⏳';

            const payload = {
                item: document.getElementById('rule-item').value,
                category: document.getElementById('rule-category').value,
                amount: parseFloat(document.getElementById('rule-amount').value) || 0,
                rule_type: document.getElementById('rule-type').value,
                start_date: document.getElementById('rule-start-date').value,
                end_date: document.getElementById('rule-end-date').value || null,
                is_credit_card: document.getElementById('rule-is-credit-card') ? document.getElementById('rule-is-credit-card').checked : false
            };

            try {
                const res = await fetch('/api/rules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();

                if (result.success) {
                    alert('החוק נשמר והתעדכן בהצלחה ב-Excel! 🎉');
                    rulesForm.reset();
                    // Keep default date
                    if (ruleStartDateInput) {
                        ruleStartDateInput.value = formattedToday;
                    }
                    // Fetch data to refresh view instantly
                    fetchTimeTravelData();
                } else {
                    alert('שגיאה בשמירת החוק: ' + (result.error || 'שגיאה לא ידועה'));
                }
            } catch (error) {
                console.error('Error saving rule:', error);
                alert('שגיאה בתקשורת עם השרת.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

    // Analytics load button
    const analyticsLoadBtn = document.getElementById('analytics-load-btn');
    if (analyticsLoadBtn) {
        analyticsLoadBtn.addEventListener('click', loadAnalyticsTrends);
    }

    // Set today's date for actual transaction form
    const actualDateInput = document.getElementById('actual-date');
    if (actualDateInput) {
        const today = new Date().toISOString().split('T')[0];
        actualDateInput.value = today;
    }
});

// Edit actual transaction - fill the edit form card (replaces old prompt-based approach)
window.editTransaction = window.editTransactionByIndex = function(idx) {
    if (!window.currentTransactions || !window.currentTransactions[idx]) return;
    const tx = window.currentTransactions[idx];

    // For estimated transactions, use the inline edit approach (prompt) since they don't exist in actuals yet
    if (tx.is_estimate) {
        editEstimatedTransaction(idx, tx);
        return;
    }

    // For actual transactions, show the edit form card
    const editCard = document.getElementById('edit-transaction-form-card');
    if (!editCard) return;

    // Store original key for lookup
    document.getElementById('edit-orig-date').value = tx.date || '';
    document.getElementById('edit-orig-category').value = tx.category || '';
    document.getElementById('edit-orig-item').value = tx.item || '';

    // Fill editable fields
    const dateInput = document.getElementById('edit-date');
    if (dateInput) dateInput.value = parseDMYtoYMD(tx.date) || '';

    const categorySelect = document.getElementById('edit-category');
    if (categorySelect) categorySelect.value = tx.category || '';

    const itemInput = document.getElementById('edit-item');
    if (itemInput) itemInput.value = tx.item || '';

    const amountInput = document.getElementById('edit-amount');
    if (amountInput) amountInput.value = tx.amount || 0;

    const notesInput = document.getElementById('edit-notes');
    if (notesInput) notesInput.value = (tx.notes && tx.notes !== 'הערכה דינמית') ? tx.notes : '';

    const ccCheckbox = document.getElementById('edit-is-credit-card');
    if (ccCheckbox) ccCheckbox.checked = tx.is_credit_card === true;

    // Show the edit card and scroll to it
    editCard.classList.remove('hidden');
    editCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    editCard.classList.add('ring-2', 'ring-amber-500');
    setTimeout(() => {
        editCard.classList.remove('ring-2', 'ring-amber-500');
    }, 1500);
};

// For estimated transactions - use the old POST approach (creates actual from estimate)
async function editEstimatedTransaction(idx, tx) {
    const year = document.getElementById('year-select').value;
    const month = document.getElementById('month-select').value;

    const newAmountStr = prompt(`אישור / עדכון סכום עבור "${tx.item}" (${tx.category}):\nסכום הערכה: ₪${tx.amount.toLocaleString('he-IL')}\nאנא הזן את הסכום הסופי בפועל:`, tx.amount);
    if (newAmountStr === null) return;

    const newAmount = parseFloat(newAmountStr.trim());
    if (isNaN(newAmount) || newAmount < 0) {
        alert("אנא הזן סכום מספרי תקין וחיובי.");
        return;
    }

    try {
        const res = await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                year: year,
                month: month,
                category: tx.category,
                item: tx.item,
                amount: newAmount,
                notes: tx.notes && tx.notes !== 'הערכה דינמית' ? tx.notes : 'עדכון ידני',
                is_credit_card: false
            })
        });

        const result = await res.json();
        if (result.success) {
            await fetchTimeTravelData();
        } else {
            alert('שגיאה בעדכון הסכום: ' + (result.error || 'שגיאה לא ידועה'));
        }
    } catch (err) {
        console.error('Error in editEstimatedTransaction:', err);
        alert('שגיאה בתקשורת עם השרת.');
    }
}

// Cancel edit transaction form
window.cancelEditTransaction = function() {
    const editCard = document.getElementById('edit-transaction-form-card');
    if (editCard) {
        editCard.classList.add('hidden');
        document.getElementById('edit-transaction-form').reset();
    }
};

// Onboarding and upload status logic
window.updateUploadLabel = function(input) {
    const label = document.getElementById('upload-file-label');
    if (input.files && input.files[0]) {
        label.textContent = `נבחר: ${input.files[0].name}`;
        label.classList.add('text-emerald-400');
    } else {
        label.textContent = 'בחר קובץ .xlsx במחשב';
        label.classList.remove('text-emerald-400');
    }
};

window.dismissOnboarding = function() {
    const onboardingEl = document.getElementById('onboarding-banner');
    if (onboardingEl) {
        onboardingEl.classList.add('hidden');
    }
};

window.scrollToDataManagement = function() {
    const card = document.getElementById('data-management-card');
    if (card) {
        card.scrollIntoView({ behavior: 'smooth' });
        // Highlight card briefly
        card.classList.add('ring-2', 'ring-emerald-500');
        setTimeout(() => {
            card.classList.remove('ring-2', 'ring-emerald-500');
        }, 1500);
    }
};

window.dismissUploadStatus = function() {
    const banner = document.getElementById('upload-status-banner');
    if (banner) {
        banner.classList.add('hidden');
    }
};

// Check for redirect status parameters on load
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const banner = document.getElementById('upload-status-banner');
    const msgEl = document.getElementById('upload-status-message');
    const iconEl = document.getElementById('upload-status-icon');

    if (banner && msgEl && iconEl) {
        if (urlParams.has('upload_error')) {
            msgEl.textContent = urlParams.get('upload_error');
            iconEl.textContent = '❌';
            banner.className = 'flex rounded-2xl p-4 shadow-xl items-center justify-between border bg-red-950/40 border-red-800 text-red-200 transition-all duration-300';
            banner.classList.remove('hidden');
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (urlParams.has('upload_success')) {
            msgEl.textContent = 'קובץ ה-Excel הועלה ועודכן במערכת בהצלחה! 🎉';
            iconEl.textContent = '✅';
            banner.className = 'flex rounded-2xl p-4 shadow-xl items-center justify-between border bg-emerald-950/40 border-emerald-800 text-emerald-200 transition-all duration-300';
            banner.classList.remove('hidden');
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
});
