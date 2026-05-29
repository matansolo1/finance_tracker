import os
from flask import Flask, jsonify, request, send_from_directory
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from datetime import datetime, date

app = Flask(__name__)

# Use absolute path to ensure we always load the correct expenses.xlsx located in the same directory as this script.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EXCEL_FILE = os.path.join(BASE_DIR, 'expenses.xlsx')

def parse_date(val):
    if isinstance(val, datetime):
        return val
    if isinstance(val, date):
        return datetime(val.year, val.month, val.day)
    if isinstance(val, (int, float)):
        try:
            from datetime import timedelta
            # Excel date starts from 1900-01-01. Excel leap year bug offset is 1899-12-30.
            if val >= 61:
                return datetime(1899, 12, 30) + timedelta(days=val)
            else:
                return datetime(1899, 12, 31) + timedelta(days=val)
        except Exception:
            pass
    if isinstance(val, str):
        val = val.strip()
        # Support full dates, as well as month-only date patterns (e.g. 5/2026, 05/2026)
        for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d/%m/%y", "%m/%Y", "%Y-%m", "%m/%y"):
            try:
                return datetime.strptime(val, fmt)
            except ValueError:
                pass
    return None

def format_date(dt):
    if not dt:
        return ""
    return dt.strftime("%d/%m/%Y")

def get_sheet_data(sheet_name):
    """Safely loads rows from a given sheet and handles basic cell reading."""
    if not os.path.exists(EXCEL_FILE):
        return []
    wb = openpyxl.load_workbook(EXCEL_FILE, data_only=True)
    if sheet_name not in wb.sheetnames:
        wb.close()
        return []
    sheet = wb[sheet_name]
    rows = []
    for row in sheet.iter_rows(values_only=True):
        rows.append(list(row))
    wb.close()
    return rows

def apply_row_styles(sheet, r_idx, is_header=False):
    """Utility to style newly created or updated expense/rule rows."""
    font_header = Font(name='Segoe UI', size=11, bold=True, color='FFFFFF')
    font_regular = Font(name='Segoe UI', size=11, bold=False, color='000000')
    
    navy_header_fill = PatternFill(start_color='1F4E79', end_color='1F4E79', fill_type='solid')
    align_center = Alignment(horizontal='center', vertical='center')
    align_right = Alignment(horizontal='right', vertical='center')
    
    thin_border = Border(
        left=Side(style='thin', color='D9D9D9'),
        right=Side(style='thin', color='D9D9D9'),
        top=Side(style='thin', color='D9D9D9'),
        bottom=Side(style='thin', color='D9D9D9')
    )
    
    currency_format = '"₪"#,##0;[Red]"₪"(-#,##0);"-";@'
    
    row_cells = list(sheet.iter_rows(min_row=r_idx, max_row=r_idx))[0]
    num_cols = len(row_cells)
    
    for col_idx, cell in enumerate(row_cells, start=1):
        if is_header:
            cell.font = font_header
            cell.fill = navy_header_fill
            cell.alignment = align_center
            cell.border = thin_border
        else:
            cell.font = font_regular
            cell.border = thin_border
            # Guess column format
            # For actuals: col 4 is amount.
            # For rules: col 3 is amount.
            # Let's align center for dates and types, and right for text/amounts.
            cell.alignment = align_right
            
    # Auto-fit columns
    for col in sheet.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = 0
        for cell in col:
            val_str = str(cell.value or '')
            if len(val_str) > max_len:
                max_len = len(val_str)
        sheet.column_dimensions[col_letter].width = max(max_len + 4, 12)

def init_excel_file():
    """Programmatically generates a brand new, empty expenses.xlsx file if it doesn't exist."""
    if not os.path.exists(EXCEL_FILE):
        wb = openpyxl.Workbook()
        
        # Setup Sheet 1: תנועות_בפועל
        sheet1 = wb.active
        sheet1.title = "תנועות_בפועל"
        sheet1.append(["תאריך", "קטגוריה", "סעיף", "סכום", "הערות"])
        apply_row_styles(sheet1, 1, is_header=True)
        
        # Setup Sheet 2: הגדרות_וחוקים
        sheet2 = wb.create_sheet(title="הגדרות_וחוקים")
        sheet2.append(["סעיף", "קטגוריה", "סכום_דיפולט", "סוג_חוק", "תאריך_התחלה", "תאריך_סיום"])
        apply_row_styles(sheet2, 1, is_header=True)
        
        wb.save(EXCEL_FILE)
        wb.close()

# Call initialization logic right at startup
init_excel_file()

def get_monthly_calculations(target_year, target_month):
    """
    Retrieves, parses, merges and aggregates transactions for a given month & year.
    Returns: (list of merged transactions, summary dict)
    """
    actuals_raw = get_sheet_data("תנועות_בפועל")
    rules_raw = get_sheet_data("הגדרות_וחוקים")
    
    actual_txs = []
    if len(actuals_raw) > 1:
        headers_act = actuals_raw[0]
        for r in actuals_raw[1:]:
            if not any(val is not None for val in r):
                continue
            # "תאריך", "קטגוריה", "סעיף", "סכום", "הערות"
            dt_parsed = parse_date(r[0])
            if dt_parsed and dt_parsed.year == target_year and dt_parsed.month == target_month:
                actual_txs.append({
                    "date": format_date(dt_parsed),
                    "category": str(r[1] or "").strip(),
                    "item": str(r[2] or "").strip(),
                    "amount": float(r[3] or 0),
                    "notes": str(r[4] or "").strip(),
                    "is_estimate": False,
                    "status": "actual"
                })
                
    active_rules = []
    if len(rules_raw) > 1:
        headers_rules = rules_raw[0]
        # "סעיף", "קטגוריה", "סכום_דיפולט", "סוג_חוק", "תאריך_התחלה", "תאריך_סיום"
        for r in rules_raw[1:]:
            if not any(val is not None for val in r):
                continue
            item = str(r[0] or "").strip()
            category = str(r[1] or "").strip()
            default_amount = float(r[2] or 0)
            rule_type = str(r[3] or "").strip()
            start_dt = parse_date(r[4])
            end_dt = parse_date(r[5]) if r[5] else None
            
            if start_dt:
                # Compare only Month & Year
                req_dt_compare = date(target_year, target_month, 1)
                start_compare = date(start_dt.year, start_dt.month, 1)
                end_compare = date(end_dt.year, end_dt.month, 1) if end_dt else None
                
                is_active = (req_dt_compare >= start_compare) and (end_compare is None or req_dt_compare <= end_compare)
                if is_active:
                    active_rules.append({
                        "item": item,
                        "category": category,
                        "default_amount": default_amount,
                        "rule_type": rule_type,
                        "start_date": format_date(start_dt),
                        "end_date": format_date(end_dt) if end_dt else ""
                    })

    # Merge & Override
    merged_txs = list(actual_txs)
    actual_items = { (tx["item"], tx["category"]) for tx in actual_txs }
    
    for rule in active_rules:
        rule_key = (rule["item"], rule["category"])
        if rule_key not in actual_items:
            # Dynamically inject rule as pending/estimated
            merged_txs.append({
                "date": f"01/{target_month:02d}/{target_year}",
                "category": rule["category"],
                "item": rule["item"],
                "amount": rule["default_amount"],
                "notes": "הערכה דינמית",
                "is_estimate": True,
                "status": "estimated"
            })
            
    # Aggregations
    total_income = 0.0
    fixed_expenses = 0.0
    variable_expenses = 0.0
    
    # Classify transactions
    # To determine if a transaction is a fixed expense or variable:
    # 1. Income is always "הכנסות" category.
    # 2. Expense (not Income) is Fixed if there is an active rule for it with rule_type starting with "Fixed".
    # 3. Expense is Variable if there is no matching active rule with type starting with "Fixed".
    active_rule_types = { rule["item"]: rule["rule_type"] for rule in active_rules }
    
    for tx in merged_txs:
        cat = tx["category"]
        amt = tx["amount"]
        item = tx["item"]
        if cat == "הכנסות":
            total_income += amt
        else:
            r_type = active_rule_types.get(item, "")
            if r_type.startswith("Fixed"):
                fixed_expenses += amt
            else:
                variable_expenses += amt
                
    net_savings = total_income - (fixed_expenses + variable_expenses)
    
    summary = {
        "total_income": total_income,
        "fixed_expenses": fixed_expenses,
        "variable_expenses": variable_expenses,
        "net_savings": net_savings
    }
    
    return merged_txs, summary

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/data', methods=['GET'])
def get_data():
    try:
        year = int(request.args.get('year', 2026))
        month = int(request.args.get('month', 1))
        
        # Current Month Merged Data and Summary
        merged_transactions, month_summary = get_monthly_calculations(year, month)
        
        # Financial Quarter determination
        if 1 <= month <= 3:
            quarter_months = [1, 2, 3]
        elif 4 <= month <= 6:
            quarter_months = [4, 5, 6]
        elif 7 <= month <= 9:
            quarter_months = [7, 8, 9]
        else:
            quarter_months = [10, 11, 12]
            
        q_income = q_fixed = q_variable = q_net = 0.0
        q_breakdown = []
        for qm in quarter_months:
            _, qm_summary = get_monthly_calculations(year, qm)
            q_income += qm_summary["total_income"]
            q_fixed += qm_summary["fixed_expenses"]
            q_variable += qm_summary["variable_expenses"]
            q_net += qm_summary["net_savings"]
            q_breakdown.append({
                "month": qm,
                "summary": qm_summary
            })
            
        quarter_summary = {
            "total_income": q_income,
            "fixed_expenses": q_fixed,
            "variable_expenses": q_variable,
            "net_savings": q_net,
            "breakdown": q_breakdown
        }
        
        # Year-to-Date (YTD) Summary
        ytd_income = ytd_fixed = ytd_variable = ytd_net = 0.0
        ytd_breakdown = []
        for m in range(1, month + 1):
            _, m_summary = get_monthly_calculations(year, m)
            ytd_income += m_summary["total_income"]
            ytd_fixed += m_summary["fixed_expenses"]
            ytd_variable += m_summary["variable_expenses"]
            ytd_net += m_summary["net_savings"]
            ytd_breakdown.append({
                "month": m,
                "summary": m_summary
            })
            
        year_summary = {
            "total_income": ytd_income,
            "fixed_expenses": ytd_fixed,
            "variable_expenses": ytd_variable,
            "net_savings": ytd_net,
            "breakdown": ytd_breakdown
        }
        
        return jsonify({
            "transactions": merged_transactions,
            "month_summary": month_summary,
            "quarter_summary": quarter_summary,
            "year_summary": year_summary
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/expenses', methods=['POST'])
def add_expense():
    try:
        req_data = request.json
        category = req_data.get('category', '').strip()
        item = req_data.get('item', '').strip()
        amount = float(req_data.get('amount') or 0)
        notes = req_data.get('notes', '').strip()
        
        year = req_data.get('year')
        month = req_data.get('month')
        date_str = req_data.get('date', '').strip()
        
        if year and month:
            target_year = int(year)
            target_month = int(month)
            # Default to 1st of the month if no exact date is found/defined
            formatted_dt_str = f"01/{target_month:02d}/{target_year}"
        elif date_str:
            dt = parse_date(date_str)
            if not dt:
                return jsonify({'error': 'Invalid date format'}), 400
            target_year = dt.year
            target_month = dt.month
            formatted_dt_str = format_date(dt)
        else:
            return jsonify({'error': 'Year/Month or Date is required'}), 400
            
        if not category or not item:
            return jsonify({'error': 'Category and item are required'}), 400
            
        # Load workbook and select active sheet (תנועות_בפועל)
        wb = openpyxl.load_workbook(EXCEL_FILE)
        if "תנועות_בפועל" not in wb.sheetnames:
            wb.close()
            return jsonify({'error': 'Sheet תנועות_בפועל not found'}), 500
            
        sheet = wb["תנועות_בפועל"]
        
        # Search for an existing transaction to update
        found_row_idx = -1
        for r_idx in range(2, sheet.max_row + 1):
            cell_date_val = sheet.cell(row=r_idx, column=1).value
            cell_cat_val = sheet.cell(row=r_idx, column=2).value
            cell_item_val = sheet.cell(row=r_idx, column=3).value
            
            if cell_date_val is None or cell_cat_val is None or cell_item_val is None:
                continue
                
            dt_parsed = parse_date(cell_date_val)
            if dt_parsed and dt_parsed.year == target_year and dt_parsed.month == target_month:
                if str(cell_cat_val).strip() == category and str(cell_item_val).strip() == item:
                    found_row_idx = r_idx
                    break
                    
        if found_row_idx != -1:
            # Update the existing row
            sheet.cell(row=found_row_idx, column=4, value=amount)
            if notes:
                sheet.cell(row=found_row_idx, column=5, value=notes)
            
            # Style/format the updated row
            apply_row_styles(sheet, found_row_idx)
            sheet.cell(row=found_row_idx, column=4).number_format = '"₪"#,##0;[Red]"₪"(-#,##0);"-";@'
            msg = 'Transaction updated successfully'
        else:
            # Append a new row
            new_row_idx = sheet.max_row + 1
            sheet.cell(row=new_row_idx, column=1, value=formatted_dt_str)
            sheet.cell(row=new_row_idx, column=2, value=category)
            sheet.cell(row=new_row_idx, column=3, value=item)
            sheet.cell(row=new_row_idx, column=4, value=amount)
            sheet.cell(row=new_row_idx, column=5, value=notes or "עדכון ידני")
            
            # Style the new row
            apply_row_styles(sheet, new_row_idx)
            sheet.cell(row=new_row_idx, column=4).number_format = '"₪"#,##0;[Red]"₪"(-#,##0);"-";@'
            msg = 'Transaction added successfully'
            
        wb.save(EXCEL_FILE)
        wb.close()
        
        return jsonify({'success': True, 'message': msg})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/rules', methods=['POST'])
def handle_rule():
    try:
        req_data = request.json
        item = req_data.get('item', '').strip()
        category = req_data.get('category', '').strip()
        amount = float(req_data.get('amount') or 0)
        rule_type = req_data.get('rule_type', 'Fixed Exact').strip()
        start_date = req_data.get('start_date', '').strip()
        end_date = req_data.get('end_date', '').strip()
        
        if not item:
            return jsonify({'error': 'Item is required'}), 400
            
        start_dt = parse_date(start_date) if start_date else datetime.now()
        end_dt = parse_date(end_date) if end_date else None
        
        formatted_start = format_date(start_dt)
        formatted_end = format_date(end_dt) if end_dt else ""
        
        wb = openpyxl.load_workbook(EXCEL_FILE)
        if "הגדרות_וחוקים" not in wb.sheetnames:
            wb.close()
            return jsonify({'error': 'Sheet הגדרות_וחוקים not found'}), 500
            
        sheet = wb["הגדרות_וחוקים"]
        
        # Search if rule with matching item already exists
        found_row_idx = -1
        for r_idx in range(2, sheet.max_row + 1):
            val = sheet.cell(row=r_idx, column=1).value
            if val and str(val).strip() == item:
                found_row_idx = r_idx
                break
                
        if found_row_idx != -1:
            # Update existing rule
            if category:
                sheet.cell(row=found_row_idx, column=2, value=category)
            sheet.cell(row=found_row_idx, column=3, value=amount)
            if rule_type:
                sheet.cell(row=found_row_idx, column=4, value=rule_type)
            sheet.cell(row=found_row_idx, column=5, value=formatted_start)
            sheet.cell(row=found_row_idx, column=6, value=formatted_end)
            
            # Re-apply styles
            apply_row_styles(sheet, found_row_idx)
            # Ensure proper currency formatting for the amount
            sheet.cell(row=found_row_idx, column=3).number_format = '"₪"#,##0;[Red]"₪"(-#,##0);"-";@'
            msg = 'Rule updated successfully'
        else:
            # Add new rule
            if not category:
                category = "שונות" # default fallback
            new_row_idx = sheet.max_row + 1
            sheet.cell(row=new_row_idx, column=1, value=item)
            sheet.cell(row=new_row_idx, column=2, value=category)
            sheet.cell(row=new_row_idx, column=3, value=amount)
            sheet.cell(row=new_row_idx, column=4, value=rule_type)
            sheet.cell(row=new_row_idx, column=5, value=formatted_start)
            sheet.cell(row=new_row_idx, column=6, value=formatted_end)
            
            # Style the new row
            apply_row_styles(sheet, new_row_idx)
            sheet.cell(row=new_row_idx, column=3).number_format = '"₪"#,##0;[Red]"₪"(-#,##0);"-";@'
            msg = 'Rule created successfully'
            
        wb.save(EXCEL_FILE)
        wb.close()
        
        return jsonify({'success': True, 'message': msg})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)