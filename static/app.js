// FinControl Frontend Logic
// Path: /static/app.js

let doughnutChart = null;
let barChart = null;
let lineChart = null;

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
            const rowClass = isEstimate ? 'opacity-70 bg-slate-900/40 hover:bg-slate-900/60' : 'hover:bg-[#1F2937]/30';
            
            // Icon and styling for estimates vs actuals
            const estimateIcon = isEstimate 
                ? `<span class="inline-flex items-center text-amber-400 mr-1" title="הערכה דינמית קבועה">
                     <svg class="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                       <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                     </svg>
                   </span>`
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

// Set up event listeners on load
document.addEventListener('DOMContentLoaded', () => {
    // Register selectors
    document.getElementById('year-select').addEventListener('change', fetchTimeTravelData);
    document.getElementById('month-select').addEventListener('change', fetchTimeTravelData);

    // Initial Fetch
    fetchTimeTravelData();

    // Set today's date for rule form start-date by default
    const today = new Date();
    const formattedToday = today.toISOString().split('T')[0];
    const ruleStartDateInput = document.getElementById('rule-start-date');
    if (ruleStartDateInput && !ruleStartDateInput.value) {
        ruleStartDateInput.value = formattedToday;
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
});

// Edit dynamic estimate or actual transaction amount
window.editTransaction = window.editTransactionByIndex = async function(idx) {
    if (!window.currentTransactions || !window.currentTransactions[idx]) return;
    const tx = window.currentTransactions[idx];
    
    const newAmountStr = prompt(`עדכון סכום עבור "${tx.item}" (${tx.category}):\nהסכום הנוכחי: ₪${tx.amount.toLocaleString('he-IL')}\nאנא הזן את הסכום החדש:`, tx.amount);
    if (newAmountStr === null) return; // User cancelled
    
    const newAmount = parseFloat(newAmountStr.trim());
    if (isNaN(newAmount) || newAmount < 0) {
        alert("אנא הזן סכום מספרי תקין וחיובי.");
        return;
    }
    
    const year = document.getElementById('year-select').value;
    const month = document.getElementById('month-select').value;
    
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
                notes: tx.notes && tx.notes !== 'הערכה דינמית' ? tx.notes : 'עדכון ידני'
            })
        });
        
        const result = await res.json();
        if (result.success) {
            // Trigger dynamic background sync
            await fetchTimeTravelData();
        } else {
            alert('שגיאה בעדכון הסכום: ' + (result.error || 'שגיאה לא ידועה'));
        }
    } catch (err) {
        console.error('Error in editTransactionByIndex:', err);
        alert('שגיאה בתקשורת עם השרת.');
    }
};
