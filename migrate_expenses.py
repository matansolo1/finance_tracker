import os
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def migrate():
    # Make sure target directory exists
    os.makedirs('users_data', exist_ok=True)
    
    wb = openpyxl.Workbook()
    # Remove default sheet
    default_sheet = wb.active
    wb.remove(default_sheet)
    
    # Create the two sheets
    ws_actual = wb.create_sheet(title="תנועות_בפועל")
    ws_rules = wb.create_sheet(title="הגדרות_וחוקים")
    
    # Set RTL and GridLines for Hebrew layout
    ws_actual.views.sheetView[0].showGridLines = True
    ws_rules.views.sheetView[0].showGridLines = True
    ws_actual.sheet_view.rightToLeft = True
    ws_rules.sheet_view.rightToLeft = True
    
    # Stylings
    navy_header_fill = PatternFill(start_color='1F4E79', end_color='1F4E79', fill_type='solid') # Deep steel blue
    font_header = Font(name='Segoe UI', size=11, bold=True, color='FFFFFF')
    align_center = Alignment(horizontal='center', vertical='center')
    thin_border = Border(
        left=Side(style='thin', color='D9D9D9'),
        right=Side(style='thin', color='D9D9D9'),
        top=Side(style='thin', color='D9D9D9'),
        bottom=Side(style='thin', color='D9D9D9')
    )
    
    # --- 1. POPULATE תנועות_בפועל ---
    headers_actual = ["תאריך", "קטגוריה", "סעיף", "סכום", "הערות"]
    ws_actual.append(headers_actual)
    
    # Style actual headers
    for col_idx in range(1, len(headers_actual) + 1):
        cell = ws_actual.cell(row=1, column=col_idx)
        cell.font = font_header
        cell.fill = navy_header_fill
        cell.alignment = align_center
        cell.border = thin_border
        
    # --- 2. POPULATE הגדרות_וחוקים ---
    headers_rules = ["סעיף", "קטגוריה", "סכום_דיפולט", "סוג_חוק", "תאריך_התחלה", "תאריך_סיום", "משולם_באשראי"]
    ws_rules.append(headers_rules)
    
    # Style rules headers
    for col_idx in range(1, len(headers_rules) + 1):
        cell = ws_rules.cell(row=1, column=col_idx)
        cell.font = font_header
        cell.fill = navy_header_fill
        cell.alignment = align_center
        cell.border = thin_border

    # --- 3. AUTO-FIT COLUMNS FOR BOTH SHEETS ---
    for ws in [ws_actual, ws_rules]:
        for col in ws.columns:
            col_letter = get_column_letter(col[0].column)
            max_len = 0
            for cell in col:
                val_str = str(cell.value or '')
                if len(val_str) > max_len:
                    max_len = len(val_str)
            ws.column_dimensions[col_letter].width = max(max_len + 4, 12)
            
    template_path = os.path.join('users_data', 'template_empty.xlsx')
    wb.save(template_path)
    wb.close()
    print(f"Empty template successfully generated at {template_path}!")

if __name__ == '__main__':
    migrate()
