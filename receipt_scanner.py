# receipt_scanner.py
import os
import io
import re
import json
import base64
import datetime
from typing import Optional, Dict, Any, List
from PIL import Image
import numpy as np

# Global singleton for EasyOCR reader so weights are not reloaded on every request
_OCR_READER = None

def get_ocr_reader():
    """Lazily load and cache the EasyOCR reader singleton."""
    global _OCR_READER
    if _OCR_READER is None:
        try:
            import easyocr
            _OCR_READER = easyocr.Reader(['en'], gpu=False)
        except Exception as e:
            print(f"[receipt_scanner] EasyOCR init error: {e}")
            return None
    return _OCR_READER


CATEGORY_KEYWORDS = {
    "Food & Dining": [
        "restaurant", "cafe", "coffee", "latte", "cappuccino", "pizza", "burger",
        "starbucks", "diner", "bistro", "bakery", "kitchen", "bar", "swiggy",
        "zomato", "mcdonald", "subway", "domino", "kfc", "taco", "food", "dining"
    ],
    "Groceries": [
        "groceries", "grocery", "supermarket", "mart", "walmart", "target", "costco",
        "trader joe", "whole foods", "provisions", "vegetables", "fruits", "milk",
        "bread", "eggs", "store", "market", "bazaar"
    ],
    "Transportation": [
        "fuel", "petrol", "diesel", "gas", "shell", "bp", "chevron", "exxon",
        "uber", "ola", "lyft", "taxi", "cab", "parking", "toll", "metro", "transit",
        "railway", "train", "airline", "flight"
    ],
    "Utilities & Bills": [
        "electricity", "electric", "power", "water", "gas bill", "utility", "broadband",
        "internet", "wifi", "telecom", "mobile", "airtel", "jio", "verizon", "at&t",
        "recharge", "cable", "dth"
    ],
    "Healthcare & Medical": [
        "pharmacy", "medical", "hospital", "clinic", "doctor", "chemist", "drug",
        "medicine", "healthcare", "diagnostic", "lab", "dental"
    ],
    "Shopping & Lifestyle": [
        "amazon", "flipkart", "ebay", "clothing", "apparel", "shoes", "fashion",
        "electronics", "mall", "retail", "zara", "h&m", "nike", "adidas"
    ],
    "Entertainment & Leisure": [
        "cinema", "theater", "theatre", "movie", "imax", "netflix", "spotify",
        "concert", "ticket", "game", "bowling", "amusement"
    ],
    "Housing & Rent": [
        "rent", "maintenance", "society", "apartment", "landlord", "lease", "housing"
    ],
    "Personal Care": [
        "salon", "spa", "haircut", "barber", "cosmetics", "skincare", "massage"
    ]
}


def infer_category(text: str, user_categories: List[Dict[str, Any]] = None) -> tuple[str, Optional[int]]:
    """Infers category from text and matches with user_categories."""
    text_lower = text.lower()
    best_cat_name = "Miscellaneous"
    max_matches = 0

    for cat_name, kws in CATEGORY_KEYWORDS.items():
        matches = sum(1 for kw in kws if kw in text_lower)
        if matches > max_matches:
            max_matches = matches
            best_cat_name = cat_name

    # If user categories provided, find closest ID
    matched_id = None
    if user_categories:
        # 1. Exact match on best_cat_name
        for c in user_categories:
            if c.get("name", "").lower() == best_cat_name.lower() and c.get("type") == "expense":
                matched_id = c.get("id")
                break
        # 2. Fuzzy match
        if matched_id is None:
            for c in user_categories:
                if c.get("type") == "expense" and (best_cat_name.lower() in c.get("name", "").lower() or c.get("name", "").lower() in best_cat_name.lower()):
                    matched_id = c.get("id")
                    best_cat_name = c.get("name")
                    break

    return best_cat_name, matched_id


def parse_date_from_text(text: str) -> Optional[str]:
    """Parses date string into YYYY-MM-DD format."""
    # Matches YYYY-MM-DD or YYYY/MM/DD
    m1 = re.search(r'\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b', text)
    if m1:
        y, m, d = m1.groups()
        return f"{y}-{int(m):02d}-{int(d):02d}"

    # Matches DD-MM-YYYY or DD/MM/YYYY or MM/DD/YYYY with slash, dash, dot, or comma (OCR artifact)
    m2 = re.search(r'\b(0?[1-9]|[12]\d|3[01])[-/.,\s](0?[1-9]|1[0-2])[-/.,\s](20\d{2}|\d{2})\b', text)
    if m2:
        d_or_m, m_or_d, y = m2.groups()
        if len(y) == 2:
            y = "20" + y
        p1 = int(d_or_m)
        p2 = int(m_or_d)
        if p1 > 12:
            return f"{y}-{p2:02d}-{p1:02d}"
        else:
            return f"{y}-{p2:02d}-{p1:02d}"

    # Matches "15 Sep 2026" or "Sep 15, 2026"
    m3 = re.search(r'\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+(20\d{2}|\d{2})\b', text, re.IGNORECASE)
    if m3:
        d, m_name, y = m3.groups()
        if len(y) == 2:
            y = "20" + y
        try:
            dt = datetime.datetime.strptime(f"{d} {m_name[:3]} {y}", "%d %b %Y")
            return dt.strftime("%Y-%m-%d")
        except Exception:
            pass

    return None


def parse_receipt_nlp(lines: List[str], user_categories: List[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Intelligent rule-based financial parser for raw OCR lines."""
    full_text = "\n".join(lines)
    
    # 1. Total Amount Detection
    total_keywords = [
        r'grand\s*total', r'total\s*amount', r'net\s*payable', r'amount\s*payable',
        r'balance\s*due', r'total\s*due', r'bill\s*amount', r'final\s*amount',
        r'amount\s*paid', r'total', r'sub\s*total'
    ]
    
    amount_val = 0.0
    found_priority_total = False
    
    # Regex matching amounts with decimals or currency signs
    num_pattern = re.compile(r'(?:₹|rs\.?|inr|\$|€|£)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+(?:\.\d{2})|\d{2,6})', re.IGNORECASE)

    # First pass: check lines matching priority total keywords.
    # If the keyword line doesn't have a number, check the next 1-2 lines (common when OCR separates label and price)
    for i, line in enumerate(lines):
        line_clean = line.strip().lower()
        for kw in total_keywords:
            if re.search(r'\b' + kw + r'\b', line_clean):
                # 1. Check current line
                matches = num_pattern.findall(line)
                # 2. If no match on current line, check next line
                if not matches and i + 1 < len(lines):
                    matches = num_pattern.findall(lines[i + 1])
                # 3. If still no match, check line after next
                if not matches and i + 2 < len(lines):
                    matches = num_pattern.findall(lines[i + 2])
                    
                if matches:
                    try:
                        clean_num = float(matches[-1].replace(',', ''))
                        if 0 < clean_num < 1000000:
                            amount_val = clean_num
                            found_priority_total = True
                            break
                    except Exception:
                        pass
        if found_priority_total and ('grand' in line_clean or 'total amount' in line_clean):
            break

    # Second pass: if no explicit total line found, find largest reasonable dollar/rupee amount with decimals
    if not found_priority_total:
        all_numbers = []
        for line in lines:
            # Skip phone numbers, invoice dates, order ids, store numbers
            if re.search(r'\b(phone|tel|mobile|date|inv|invoice|order|tax\s*id|gstin|store|#)\b', line, re.IGNORECASE):
                continue
            for m in num_pattern.findall(line):
                try:
                    # Require decimal point or currency symbol to avoid store IDs like #3412
                    has_decimal = '.' in m
                    v = float(m.replace(',', ''))
                    if 0 < v < 100000 and (has_decimal or v < 1000):
                        all_numbers.append(v)
                except Exception:
                    pass
        if all_numbers:
            amount_val = max(all_numbers)

    # 2. Date Detection
    date_val = None
    for line in lines:
        d = parse_date_from_text(line)
        if d:
            date_val = d
            break
    if not date_val:
        date_val = datetime.date.today().strftime("%Y-%m-%d")

    # 3. Merchant Name Extraction
    # Scan the first few lines of the receipt
    merchant_name = ""
    ignore_headers = [
        "receipt", "tax invoice", "invoice", "bill", "cash memo", "welcome",
        "thank you", "customer copy", "original", "duplicate", "token", "order",
        "retail invoice", "gst invoice"
    ]
    for line in lines[:4]:
        cleaned = re.sub(r'[^\w\s&\'\.-]', '', line).strip()
        if len(cleaned) >= 3 and cleaned.lower() not in ignore_headers and not parse_date_from_text(cleaned):
            # Also check if it's purely numbers
            if not re.match(r'^[\d\s\.,-]+$', cleaned):
                merchant_name = cleaned
                break
    
    if not merchant_name:
        merchant_name = "Scanned Bill"

    # 4. Category Inference
    cat_name, cat_id = infer_category(full_text, user_categories)

    # 5. Build description
    desc = merchant_name if merchant_name != "Scanned Bill" else f"{cat_name} Bill"

    return {
        "success": True,
        "amount": round(amount_val, 2),
        "date": date_val,
        "merchant": merchant_name,
        "description": desc,
        "category_name": cat_name,
        "category_id": cat_id,
        "tax": None,
        "tags": "#receipt-scan",
        "raw_text": full_text
    }


def scan_with_gemini(image_bytes: bytes, user_categories: List[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """Primary Tier 1: Uses Google Gemini 1.5 Flash Vision for state-of-the-art receipt extraction."""
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not gemini_key:
        return None

    try:
        import google.generativeai as genai
        genai.configure(api_key=gemini_key)
        model = genai.GenerativeModel('gemini-1.5-flash')

        pil_img = Image.open(io.BytesIO(image_bytes))

        prompt = """
        You are an expert AI financial receipt, bill, and invoice scanner.
        Carefully examine this bill/receipt image and extract key financial data.
        
        Return STRICT JSON with the following schema:
        {
          "merchant": "Name of the business / store / service provider (e.g. Starbucks, Walmart, Shell, Hospital, Electric Provider)",
          "amount": 42.50,
          "date": "YYYY-MM-DD",
          "category": "One of: Food & Dining, Groceries, Transportation, Housing & Rent, Utilities & Bills, Entertainment & Leisure, Shopping & Lifestyle, Healthcare & Medical, Personal Care, Miscellaneous",
          "tax": 2.50,
          "currency": "INR, USD, EUR, etc.",
          "description": "Brief description of the purchase (e.g. Starbucks - Coffee & Snacks)"
        }
        Notes:
        - "amount" must be the TOTAL / GRAND TOTAL payable amount as a float (not just tax or subtotal).
        - "date" must be formatted as YYYY-MM-DD. If year is missing or 2-digit, convert to 20XX.
        - Return ONLY the JSON object. Do not include markdown codeblocks or extra text.
        """

        response = model.generate_content([prompt, pil_img])
        raw_text = (response.text or "").strip()
        if raw_text.startswith("```"):
            raw_text = re.sub(r'^```(?:json)?\s*', '', raw_text)
            raw_text = re.sub(r'\s*```$', '', raw_text)

        data = json.loads(raw_text)
        amount = float(data.get("amount", 0.0))
        date_str = str(data.get("date", datetime.date.today().strftime("%Y-%m-%d")))
        merchant = str(data.get("merchant", "Scanned Bill"))
        cat_name = str(data.get("category", "Miscellaneous"))
        desc = str(data.get("description", merchant))

        matched_id = None
        if user_categories:
            for c in user_categories:
                if c.get("name", "").lower() == cat_name.lower() and c.get("type") == "expense":
                    matched_id = c.get("id")
                    break
            if matched_id is None:
                for c in user_categories:
                    if c.get("type") == "expense" and (cat_name.lower() in c.get("name", "").lower() or c.get("name", "").lower() in cat_name.lower()):
                        matched_id = c.get("id")
                        cat_name = c.get("name")
                        break

        return {
            "success": True,
            "engine": "gemini-vision",
            "amount": round(amount, 2),
            "date": date_str,
            "merchant": merchant,
            "description": desc,
            "category_name": cat_name,
            "category_id": matched_id,
            "tax": data.get("tax"),
            "tags": "#receipt-scan",
            "raw_text": raw_text
        }
    except Exception as e:
        print(f"[receipt_scanner] Gemini Vision error: {e}")
        return None


def scan_with_easyocr(image_bytes: bytes, user_categories: List[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Tier 2: Uses cached EasyOCR reader and intelligent financial NLP regex."""
    reader = get_ocr_reader()
    if not reader:
        return {
            "success": False,
            "error": "OCR engine could not be initialized.",
            "amount": 0.0,
            "date": datetime.date.today().strftime("%Y-%m-%d"),
            "merchant": "Scanned Bill",
            "description": "Receipt Scan",
            "category_name": "Miscellaneous",
            "category_id": None,
            "tags": "#receipt-scan"
        }

    img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    img_np = np.array(img)

    results = reader.readtext(img_np)
    sorted_results = sorted(results, key=lambda r: r[0][0][1])
    lines = [r[1] for r in sorted_results if r[1] and len(r[1].strip()) > 0]

    parsed = parse_receipt_nlp(lines, user_categories)
    parsed["engine"] = "easyocr"
    return parsed


def process_receipt_image(image_bytes: bytes, user_categories: List[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Unified entry point: tries Gemini Vision AI first, then cached EasyOCR NLP."""
    gemini_result = scan_with_gemini(image_bytes, user_categories)
    if gemini_result and gemini_result.get("amount", 0) > 0:
        return gemini_result

    return scan_with_easyocr(image_bytes, user_categories)
