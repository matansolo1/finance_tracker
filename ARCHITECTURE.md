# FinControl: Complete System Architecture Documentation

## 🏗️ System Overview

FinControl is a sophisticated multi-user financial tracking and forecasting SaaS application that combines Google OAuth authentication, per-user Excel-based data storage, dynamic time-travel forecasting, and an interactive web dashboard. The system is designed for deployment on Render.com with complete session management and user isolation.

---

## 🔐 Authentication & User Management

### Google OAuth 2.0 Integration
The application implements a complete OAuth 2.0 flow using Google as the identity provider:

**Environment Variables Required:**
- `GOOGLE_CLIENT_ID`: OAuth client identifier
- `GOOGLE_CLIENT_SECRET`: OAuth client secret
- `FLASK_SECRET_KEY`: Session encryption key
- `PORT`: Dynamic port binding (default: 5000)

**OAuth Flow:**
1. **Login Route (`/login`)**: Renders login page if user not authenticated
2. **Google Auth Initiation (`/login/google`)**: Redirects to Google OAuth consent screen
3. **Callback Handler (`/login/callback`)**: 
   - Exchanges authorization code for access token
   - Retrieves user profile (sub, email, name)
   - Creates secure Flask session with `user_google_id`, `user_email`, `user_name`
   - Initializes user-specific directory structure
4. **Logout (`/logout`)**: Clears session and redirects to login

**Session Security:**
- Permanent sessions enabled
- Secure session cookies
- `@login_required` decorator protects all API and data routes
- Returns 401 for unauthorized API calls, redirects to login for page requests

---

## 📂 Multi-User Data Architecture

### User Directory Structure
```
users_data/
├── template_empty.xlsx          # Master template for new users
└── {user_google_id}/            # Per-user isolated directory
    └── expenses.xlsx            # User's personal financial database
```

**User Isolation:**
- Each authenticated user gets a unique directory based on their Google ID (`sub` claim)
- `get_user_excel_file()` dynamically resolves the active user's Excel file path
- New users automatically receive a copy of `template_empty.xlsx`
- Complete data separation between users

### Excel Database Schema

The `expenses.xlsx` workbook contains two critical sheets:

#### 1. `תנועות_בפועל` (Actual Transactions)
Records real-world financial transactions.

**Columns:**
- `תאריך` (Date) - Transaction date (DD/MM/YYYY)
- `קטגוריה` (Category) - Expense/Income category
- `סעיף` (Item) - Specific item/sub-category
- `סכום` (Amount) - Monetary value (₪)
- `הערות` (Notes) - Additional context
- `משולם_באשראי` (Paid via Credit Card) - Boolean flag; when TRUE, this actual transaction is included in the monthly credit card deduction pool and offset against "הוצאות אשראי כלליות"

**Styling:**
- Navy header (`#1F4E79`) with white bold text
- Thin slate borders (`#D9D9D9`)
- Currency format: `"₪"#,##0;[Red]"₪"(-#,##0);"-";@`
- Auto-adjusted column widths

#### 2. `הגדרות_וחוקים` (Rules & Definitions)
Defines recurring budget rules and forecasting templates.

**Columns:**
- `סעיף` (Item) - Rule identifier
- `קטגוריה` (Category) - Category classification
- `סכום_דיפולט` (Default Amount) - Baseline amount
- `סוג_חוק` (Rule Type) - `Fixed Exact` or `Fixed Estimate`
- `תאריך_התחלה` (Start Date) - Rule activation date
- `תאריך_סיום` (End Date) - Optional expiration date
- `משולם_באשראי` (Paid via Credit Card) - Boolean flag for credit card deduction logic

---

## ⚡ Backend API Architecture (`app.py`)

### Core Endpoints

#### `GET /api/data`
**Purpose:** Time-travel engine - calculates financial state for any month/year

**Query Parameters:**
- `year` (int, default: 2026)
- `month` (int, default: 1)

**Response Structure:**
```json
{
  "transactions": [...],           // Merged actual + estimated transactions
  "month_summary": {
    "total_income": float,
    "fixed_expenses": float,
    "variable_expenses": float,
    "net_savings": float
  },
  "quarter_summary": {
    "total_income": float,
    "fixed_expenses": float,
    "variable_expenses": float,
    "net_savings": float,
    "breakdown": [...]              // Per-month breakdown for quarter
  },
  "year_summary": {
    "total_income": float,
    "fixed_expenses": float,
    "variable_expenses": float,
    "net_savings": float,
    "breakdown": [...]              // YTD monthly breakdown
  },
  "credit_card_deductions": {
    "total_deducted": float,
    "breakdown": [...]
  },
  "user_email": string,
  "user_name": string,
  "is_new_user": boolean
}
```

#### `POST /api/expenses`
**Purpose:** Add or update actual transaction

**Payload:**
```json
{
  "date": "DD/MM/YYYY" or null,
  "year": int (optional if date provided),
  "month": int (optional if date provided),
  "category": string,
  "item": string,
  "amount": float,
  "notes": string
}
```

**Logic:**
- Searches for existing transaction by (date, category, item)
- Updates if found, creates new row if not
- Applies professional styling and currency formatting
- Handles credit card deduction for "הוצאות אשראי כלליות"

#### `POST /api/rules`
**Purpose:** Create or update recurring budget rule

**Payload:**
```json
{
  "item": string,
  "category": string,
  "amount": float,
  "rule_type": string,
  "start_date": string,
  "end_date": string (optional),
  "is_credit_card": boolean
}
```

**Logic:**
- Searches for existing rule by `item`
- Updates if found, creates new row if not
- Applies professional styling

#### File Management Endpoints
- `GET /download-excel` - Download user's current Excel backup
- `GET /download-template` - Download empty template
- `POST /upload-excel` - Upload and replace user's Excel file (with validation)

---

## 🧮 Time-Travel & Forecasting Engine

### Core Algorithm: `get_monthly_calculations(target_year, target_month, excel_file)`

**Step 1: Load Actual Transactions**
- Parse `תנועות_בפועל` sheet
- Filter transactions matching target year/month
- Convert to standardized transaction objects

**Step 2: Evaluate Active Rules**
- Parse `הגדרות_וחוקים` sheet
- For each rule, check if active for target month:
  ```python
  req_dt_compare = date(target_year, target_month, 1)
  start_compare = date(start_dt.year, start_dt.month, 1)
  end_compare = date(end_dt.year, end_dt.month, 1) if end_dt else None
  
  is_active = (req_dt_compare >= start_compare) and 
              (end_compare is None or req_dt_compare <= end_compare)
  ```

**Step 3: Dynamic Override Injection**
- Create set of actual transaction keys: `(item, category)`
- For each active rule NOT in actual transactions:
  - Inject estimated transaction with `status: "estimated"`
  - Amount = rule's default amount
  - Notes = "הערכה דינמית"

**Step 4: Categorization & Aggregation**
- **Income**: `category == "הכנסות"`
- **Fixed Expenses**: All non-income except "הוצאות אשראי כלליות"
- **Variable Expenses**: "הוצאות אשראי כלליות" (net after credit card deductions)
- **Net Savings**: `Income - (Fixed + Variable)`

---

## 💳 Credit Card Deduction Logic

### Purpose
Prevent double-counting of expenses paid via credit card that are already tracked as separate line items (e.g., rent, subscriptions).

### Algorithm: `get_credit_card_deductions(target_year, target_month, excel_file)`

**Step 1: Build Actual Amounts Map**
- Scan `תנועות_בפועל` for target month
- Create dictionary: `{(item, category): amount}`
- Also track which actual transactions have `משולם_באשראי == TRUE`

**Step 2: Identify Flagged Rules**
- Scan `הגדרות_וחוקים` for active rules where `משולם_באשראי == TRUE`
- For each flagged rule:
  - Use actual amount if exists in map
  - Otherwise use default amount from rule
  - Add to deduction pool

**Step 3: Identify Flagged Actual Transactions**
- Scan actual transactions with `משולם_באשראי == TRUE`
- For each flagged actual transaction NOT already covered by a rule:
  - Add to deduction pool
- This ensures one-off credit card expenses are also deducted

**Step 4: Net Credit Card Calculation**
When processing "הוצאות אשראי כלליות" transaction:
```python
net_amount = max(0.0, entered_amount - deductions_sum)
```

This ensures the credit card line item only reflects **variable/unpredicted** spending.

### Example Scenario
**Rules (הגדרות_וחוקים):**
- Netflix: ₪50, `משולם_באשראי=TRUE`
- Rent: ₪4000, `משולם_באשראי=TRUE`

**Actual Transactions (תנועות_בפועל):**
- Netflix: ₪50 (actual matches rule)
- Rent: ₪4000 (actual matches rule)
- One-time purchase: ₪200, `משולם_באשראי=TRUE`
- Credit Card Total: ₪5000

**Deduction Calculation:**
- Netflix: ₪50 (from rule)
- Rent: ₪4000 (from rule)
- One-time purchase: ₪200 (from actual, not covered by rule)
- **Total Deducted:** ₪4250

**Net Credit Card Display:**
- Original: ₪5000
- Deducted: -₪4250
- **Net Variable Spending:** ₪750

---

## 🎨 Frontend Architecture

### Technology Stack
- **HTML5** with semantic markup
- **Tailwind CSS** for utility-first styling
- **Vanilla JavaScript (ES6+)** for interactivity
- **Chart.js** for data visualization
- **Google Fonts (Rubik)** for typography

### Key Components

#### 1. Time Traveler Controls
- Year selector (2026-2030)
- Month selector (1-12)
- Triggers `fetchTimeTravelData()` on change

#### 2. Three-View Navigation
- **Monthly View**: Detailed transaction table, KPIs, doughnut chart
- **Quarterly View**: Quarter aggregates, bar chart comparison
- **Yearly View**: YTD aggregates, savings trend line chart

#### 3. Transaction Table
- Dynamic rendering from API data
- Visual distinction between actual (✔️) and estimated (⏰) transactions
- Inline edit buttons for amount updates
- "Convert to Rule" button for estimated transactions
- Credit card deduction tooltips

#### 4. Rules Form
- Add/update recurring budget rules
- Auto-fill from estimated transactions
- Date range selection
- Credit card flag checkbox

#### 5. Data Management
- Excel backup download
- Template download
- Excel file upload with validation
- Upload status banners

### State Management (`app.js`)

**Global State:**
- `window.currentTransactions` - Current month's transaction array
- Chart instances: `doughnutChart`, `barChart`, `lineChart`

**Key Functions:**
- `fetchTimeTravelData()` - Main API orchestrator
- `updateMonthlyView(data)` - Renders monthly tab
- `updateQuarterlyView(data)` - Renders quarterly tab
- `updateYearlyView(data)` - Renders yearly tab
- `fillRulesForm(idx)` - Auto-populate rules form from transaction
- `editTransaction(idx)` - Inline amount editor

---

## 🚀 Deployment Architecture (Render.com)

### Environment Configuration
```bash
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
FLASK_SECRET_KEY=<random-secure-key>
PORT=10000  # Render assigns dynamically
```

### Dynamic Port Binding
```python
port = int(os.environ.get("PORT", 5000))
app.run(host="0.0.0.0", port=port)
```

### Redirect URI Handling
The app detects `X-Forwarded-Proto` header to construct correct OAuth redirect URIs:
```python
scheme = request.headers.get('X-Forwarded-Proto', request.scheme)
redirect_uri = url_for('oauth_callback', _external=True, _scheme=scheme)
```

### File Persistence
- User data stored in `users_data/` directory
- Render's ephemeral filesystem requires external storage for production
- Consider mounting persistent volume or migrating to cloud storage (S3, Google Drive API)

---

## 🔒 Security Features

1. **Session Management**
   - Secure session cookies
   - Server-side session storage
   - Automatic session expiration

2. **User Isolation**
   - Per-user directory structure
   - Session-based file path resolution
   - No cross-user data access

3. **File Lock Protection**
   - `PermissionError` handling for open Excel files
   - Returns HTTP 409 with user-friendly message
   - Prevents data corruption

4. **Input Validation**
   - Date parsing with multiple format support
   - Required field validation
   - Excel sheet structure validation on upload

---

## 📊 Data Flow Diagram

```
User Browser
    │
    ├─► GET /login ──────────────► Render login.html
    │
    ├─► GET /login/google ───────► Redirect to Google OAuth
    │
    ├─► GET /login/callback ─────► Exchange code for token
    │                               Create session
    │                               Initialize user directory
    │                               Redirect to /
    │
    ├─► GET / ───────────────────► Render index.html (if authenticated)
    │
    ├─► GET /api/data?year=X&month=Y
    │       │
    │       ├─► get_user_excel_file() ──► users_data/{google_id}/expenses.xlsx
    │       │
    │       ├─► get_monthly_calculations()
    │       │       ├─► Load actuals from תנועות_בפועל
    │       │       ├─► Load rules from הגדרות_וחוקים
    │       │       ├─► Evaluate active rules
    │       │       ├─► Merge & override logic
    │       │       └─► Aggregate summaries
    │       │
    │       ├─► get_credit_card_deductions()
    │       │
    │       └─► Return JSON response
    │
    ├─► POST /api/expenses
    │       ├─► Validate payload
    │       ├─► Apply credit card deduction if needed
    │       ├─► Update/insert row in תנועות_בפועל
    │       ├─► Apply styling
    │       └─► Save Excel file
    │
    └─► POST /api/rules
            ├─► Validate payload
            ├─► Update/insert row in הגדרות_וחוקים
            ├─► Apply styling
            └─► Save Excel file
```

---

## 🎯 Key Design Patterns

1. **Decorator Pattern**: `@login_required` for route protection
2. **Factory Pattern**: Dynamic user file path resolution
3. **Strategy Pattern**: Different rule types (Fixed Exact, Fixed Estimate)
4. **Observer Pattern**: Frontend auto-refresh on data changes
5. **Template Method**: Consistent Excel styling via `apply_row_styles()`

---

## 🔄 Current Limitations & Future Enhancements

### Current Limitations
1. **Static Categories**: Hardcoded category dropdowns
2. **No Analytics Dashboard**: Limited trend analysis across time periods
3. **Manual Transaction Entry**: No dedicated form for actual transactions (uses edit flow)
4. **Ephemeral Storage**: Render's filesystem not persistent

### Planned Enhancements (This Upgrade)
1. ✅ **Dynamic Categories**: Extract from Excel data
2. ✅ **Analytics Dashboard**: Multi-period category trends with averages
3. ✅ **Dedicated Transaction Form**: Clean UI for logging actual expenses
4. ⏳ **Persistent Storage**: Cloud storage integration

---

## 📝 Code Quality & Maintenance

### Styling Standards
- Hebrew RTL support throughout
- Consistent color palette (Navy, Emerald, Slate)
- Responsive design (mobile-first)
- Accessibility considerations

### Error Handling
- Try-catch blocks for all API calls
- User-friendly error messages in Hebrew
- File lock detection and guidance
- Excel validation on upload

### Performance Optimizations
- Lazy chart rendering
- Efficient Excel parsing (data_only=True)
- Minimal DOM manipulation
- Async/await for all network calls

---

**Last Updated:** June 6, 2026  
**Version:** 2.0 (Pre-Analytics Upgrade)
