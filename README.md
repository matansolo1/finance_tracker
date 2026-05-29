# Smart Expense & Budget Manager 📊

A lightweight, local-first financial management application designed to track expenses, manage recurring budgets, and analyze monthly trends without relying on third-party cloud databases.

## 🚀 Key Features
- **Automated Excel Backend:** Programmatically generates and structures the `expenses.xlsx` template files on startup if missing.
- **Smart Rule Engine:** Advanced transaction filtering with `Fixed Exact` and `Fixed Estimate` rule processing for automated monthly projections.
- **Interactive Analytics:** Responsive charts and summaries breakdown (Month, Quarter, YTD) with smooth theme transitions.
- **Privacy-First:** All data remains locally in your Excel sheet, completely decoupled from any cloud storage.

## 🛠️ Tech Stack
- **Backend:** Python, Flask, Pandas, OpenPyxl
- **Frontend:** HTML5, Tailwind CSS, JavaScript (ES6+), Chart.js
- **Database:** Local Excel Ledger (`.xlsx`)
