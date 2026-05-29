# FinControl: Advanced Multi-Sheet Local Expense Management & Forecasting System

An elegant, robust, and highly optimized financial tracking and forecasting system. This upgraded architecture turns standard spreadsheets into styled database engines with dynamic forecasting, automated monthly projections, rule-based estimation, and an interactive single-page web dashboard.

---

## 📂 System Architecture Overview

The application utilizes a multi-sheet local Excel workbook (`expenses.xlsx`) as its database, a Python-Flask backend for transaction management and forecasting, and a decoupled CSS/JS-driven single-page web frontend.

```
┌──────────────────────────────────────────────────────────┐
│                    expenses.xlsx                         │
│   ┌──────────────────────────┬────────────────────────┐  │
│   │ תנועות_בפועל (Actuals)   │ הגדרות_וחוקים (Rules)  │  │
│   └──────────────────────────┴────────────────────────┘  │
└──────────────────────────┬───────────────────────────────┘
                           │
             Reads & Writes via openpyxl
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│                       app.py                             │
│               (Flask Local API Server)                   │
├──────────────────────────────────────────────────────────┤
│  • GET /api/data - Core Time-Travel & Forecast Engine    │
│  • POST /api/expenses - Appends actual transactions      │
│  • POST /api/rules - Configures dynamic budget rules     │
└──────────────────────────┬───────────────────────────────┘
                           │
                 Exposes RESTful JSON API
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│              HTML/JS Decoupled Frontend                  │
├──────────────────────────────────────────────────────────┤
│  • index.html - Structured Semantic Dashboard Markup     │
│  • static/app.js - DOM, Chart.js, and API Async Sync     │
└──────────────────────────────────────────────────────────┘
```

---

## 📊 Dual-Sheet Excel Database Design

The local `expenses.xlsx` is structured into two purpose-built sheets to clean-cut the boundary between actual cash-flows and recurring budget rule definitions.

1. **`תנועות_בפועל` (Actual Transactions)**
   - Records every real-world expense and income item.
   - **Columns**: `תאריך` (Date), `קטגוריה` (Category), `סעיף` (Item/Sub-category), `סכום` (Amount), `הערות` (Notes).
   - Styled with a sleek Classic Navy header (`#1F4E79`), clean Slate cell borders, custom currency formatters (`₪#,##0;[Red]₪(-#,##0);"-"`), and auto-adjusting column widths.

2. **`הגדרות_וחוקים` (Rules & Definitions)**
   - Holds the system's dynamic instructions for estimating recurring payments (e.g., Rent, Subscription plans, Insurance policies).
   - **Columns**: `סעיף` (Item), `קטגוריה` (Category), `סכום_דיפולט` (Default Amount), `סוג_חוק` (Rule Type, e.g., `Fixed Exact`), `תאריך_התחלה` (Start Date), `תאריך_סיום` (End Date).

---

## ⚡ Flask API Endpoints (`app.py`)

A fast Python/Flask server serves as the application's synchronization engine and computational backbone.

### 1. `GET /api/data`
- **Purpose**: Evaluates actual and estimated data for any selected month and year, providing comprehensive summaries across three temporal scopes.
- **Query Parameters**:
  - `year` (int, default: 2026)
  - `month` (int, default: 1)
- **Response Structure**:
  - `transactions`: Combined list of actual transactions and dynamically injected rule forecasts.
  - `month_summary`: Aggregates for the requested month (`total_income`, `fixed_expenses`, `variable_expenses`, `net_savings`).
  - `quarter_summary`: Aggregated metrics for the matching fiscal quarter (Q1-Q4) with monthly breakdowns.
  - `year_summary`: Year-to-Date (YTD) aggregates starting from January up to the chosen month, alongside monthly breakdowns.

### 2. `POST /api/expenses`
- **Purpose**: Appends a new actual transaction to the `תנועות_בפועל` sheet.
- **Payload**: `{ "date", "category", "item", "amount", "notes" }`
- **Operation**: Validates and normalizes date inputs, appends the row to the Excel sheet, applies professional accounting formatting and alignment, and saves the file.

### 3. `POST /api/rules`
- **Purpose**: Creates or updates a dynamic estimation rule in the `הגדרות_וחוקים` sheet.
- **Payload**: `{ "item", "category", "amount", "rule_type", "start_date", "end_date" }`
- **Operation**: Searches for an existing rule by `item`. If found, updates the definition in place; if not, appends a new rule row. Styles the updated/created row with professional styling.

---

## ⏱️ Time-Travel Logic & Rule Evaluation

One of FinControl's most powerful features is its **Time-Travel and Forecasting Engine**. When a user selects any month/year in the UI, the backend evaluates the exact financial state using the following sequence:

### 1. Date Alignment & Parsing
The backend converts raw strings and Excel date formats into strict Python datetime objects, checking the targets at the start of the specified month:
- Requested target month start date: `date(target_year, target_month, 1)`

### 2. Rule Validity Window
For every rule in the `הגדרות_וחוקים` sheet, the engine evaluates its active time-range:
- **Active condition**: `(target_month_start >= rule_start_month) AND (rule_end_month is NULL OR target_month_start <= rule_end_month)`
- Rules outside of this date interval are safely ignored for that target month.

### 3. Dynamic Override Injection
To prevent double-counting while assuring reliable budgeting:
- The system loads all **Actual Transactions** for the targeted month/year.
- The engine checks each active rule. **If an active rule's unique key (`item`, `category`) does not exist as an actual transaction for that month, the system dynamically injects an Estimated Transaction (`status: "estimated"`)** with the rule's default amount and notes set to "הערכה דינמית".
- Once a real expense is recorded (an actual transaction matching the key), the dynamic estimate is automatically suppressed, letting the real-world value override the projection.

### 4. Expense Categorization & Aggregations
- **Income**: Transactions belonging to the `הכנסות` category.
- **Fixed Expenses**: Any transaction (actual or estimated) whose item matches an active rule where `rule_type` begins with `"Fixed"`.
- **Variable Expenses**: Any remaining non-income transaction.
- **Net Savings**: Calculated dynamically as `Total Income - (Fixed Expenses + Variable Expenses)`.

---

## 🖥️ HTML/app.js Split Layout

The user interface utilizes a clean decoupled client-server pattern to manage views and data updates asynchronously.

### `index.html` (The Presentation Layer)
- Serves as a single-page responsive viewport styled with modern utility classes.
- Includes quick-access dashboards containing interactive cards for Month, Quarter, and YTD balances.
- Features dual-form tabs for seamlessly recording both actual transactions and forecasting rules.
- Contains an anomaly highlights section showing transactions that exceed ₪1,500.
- Implements a high-contrast theme toggle (Dark/Light Mode) persisted via `localStorage`.

### `static/app.js` (The Interaction Layer)
- **State Management**: Keeps track of the currently selected target month and year, calling the `/api/data` endpoint on adjustment.
- **Asynchronous AJAX Handlers**: Listens to form submissions, posting transaction and rule creations to the server without page refreshes, and triggers smooth visual UI updates.
- **Dynamic DOM Rendering**: Rebuilds transaction tables on the fly. Projections/estimated items are highlighted with a distinct badge indicating they are placeholder calculations, whereas actual transactions display clean, finalized stamps.
- **Visual Analytics**: Instantiates and updates interactive doughnut charts using **Chart.js**, cleanly grouping real-time expenditures into visual slices.

---

## 🚀 Running the Application

1. **Install Dependencies**:
   Ensure you have Python 3 and the required libraries installed:
   ```bash
   pip install flask openpyxl
   ```

2. **Run the Application**:
   Start the local Flask development server by running:
   ```bash
   python app.py
   ```

3. **Open the Dashboard**:
   Navigate to [http://127.0.0.1:5000](http://127.0.0.1:5000) in your web browser.
