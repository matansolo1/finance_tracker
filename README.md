# Smart Expense & Budget Manager 📊

A lightweight, local-first financial management application designed to track expenses, manage recurring budgets, and analyze monthly trends without relying on third-party cloud databases.

## 🚀 Key Features
- **Automated Excel Backend:** Programmatically generates and structures the `expenses.xlsx` template files on startup if missing.
- **Smart Rule Engine:** Advanced transaction filtering with `Fixed Exact` and `Fixed Estimate` rule processing for automated monthly projections.
- **Interactive Analytics:** Responsive charts and summaries breakdown (Month, Quarter, YTD) with smooth theme transitions.
- **Privacy-First:** All data remains locally in your Excel sheet, completely decoupled from any cloud storage.

## 🛠️ Tech Stack
- **Backend:** Python, Flask, OpenPyxl
- **Frontend:** HTML5, Tailwind CSS, JavaScript (ES6+), Chart.js
- **Database:** Local Excel Ledger (`.xlsx`)

---

## 📂 Data Architecture
The system operates entirely on a local Excel database (`expenses.xlsx`) utilizing a robust two-sheet layout:
1. **`תנועות_בפועל` (Actual Transactions):** Tracks one-off monthly actual spends, incomes, and custom override transactions. Fields include:
   - `תאריך` (Date)
   - `קטגוריה` (Category)
   - `סעיף` (Item name)
   - `סכום` (Amount)
   - `הערות` (Notes)
2. **`הגדרות_וחוקים` (Settings & Rules):** Houses templates for recurring monthly expenses/incomes. Fields include:
   - `סעיף` (Item name)
   - `קטגוריה` (Category)
   - `סכום_דיפולט` (Default amount)
   - `סוג_חוק` (Rule type - e.g., `Fixed Exact` or `Fixed Estimate`)
   - `תאריך_התחלה` (Start date)
   - `תאריך_סיום` (End date)
   - `משולם_באשראי` (Paid via Credit Card - boolean flag)

---

## 💳 Automated Credit Card Deduction
To prevent double-counting of recurring expenses on the dashboard, the system features an intelligent credit card deduction mechanism:
1. **Deduction Scanning:** Whenever calculating the selected month's summary or adding an expense, the backend scans `הגדרות_וחוקים` for rules flagged with `משולם_באשראי = TRUE` that are active for the target month.
2. **Amount Determination:** For each flagged active rule, the system checks if a corresponding actual transaction has been logged in `תנועות_בפועל` for that month. If it exists, the system uses the actual amount; otherwise, it falls back to the default amount in the rule.
3. **Net Credit Card Balance:** The sum of these flagged amounts is dynamically subtracted from the user-entered `"הוצאות אשראי כלליות"` (General Credit Card) transaction:
   $$\text{Net Credit Card Amount} = \max(0.0, \text{Total Entered} - \text{Flagged Rules Sum})$$
   The resulting net value is saved or displayed as the floating/unpredicted spend, avoiding double-counting with rent, car loans, etc., that are paid via credit card.

---

## 📊 Expense Categorization (Fixed vs Variable)
The monthly dashboard breaks down expenses dynamically into two distinct summary cards to give complete transparency:
- **Variable Expenses (תשלומים משתנים):** Strictly represents the computed net balance of the `"הוצאות אשראי כלליות"` (General Credit Card) row for the selected month (the unpredictable monthly floating spend).
- **Fixed Expenses (תשלומים קבועים):** Represents the sum of all other active expense rows for that month (e.g., Rent, Car Loan, Utilities, active rule estimations, etc.), excluding the net general credit card balance.
- **Mathematical Integrity:** This strict division guarantees that:
  $$\text{Fixed Expenses} + \text{Variable Expenses} = \text{Total Expenses}$$

---

## 🔒 File-Lock Safeguard
When managing local spreadsheets on Windows, users often keep `expenses.xlsx` open in Excel, which locks writing permissions. To prevent data corruption and application crashes:
- The backend wraps all spreadsheet save operations with safe handling for `PermissionError`.
- If a write is blocked, it returns a user-friendly JSON warning response (`HTTP 409 Conflict`) stating:
  > `"קובץ ה-Excel (expenses.xlsx) פתוח כרגע בתוכנה אחרת. אנא סגור אותו באקסל ונסה שוב כדי שהשינויים יישמרו."`
- The frontend intercepts this response and presents a polite alert, prompting the user to close Microsoft Excel before retrying their operation.
