"""
AirYatra GST Invoice PDF Generator
Generates GST-compliant tax invoices with QR codes
"""

import io
import os
import qrcode
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT


class GSTInvoiceGenerator:
    """
    Generates GST-compliant Tax Invoices for AirYatra bookings
    Includes: GSTIN, HSN codes, Tax breakup, QR code for verification
    """
    
    def __init__(self):
        # Company Details (AirYatra)
        self.company_name = "AirYatra Aviation Private Limited"
        self.company_address = "123 Aviation House, Andheri East, Mumbai - 400069, Maharashtra, India"
        self.company_gstin = "27AABCA1234B1ZM"  # Maharashtra GSTIN format
        self.company_pan = "AABCA1234B"
        self.company_cin = "U62200MH2024PTC123456"
        self.company_email = "billing@airyatra.co.in"
        self.company_phone = "+91 22 1234 5678"
        self.company_website = "www.airyatra.co.in"
        
        # HSN Code for Air Transport Services
        self.hsn_code = "996411"  # SAC code for passenger air transport
        
        # GST Rates
        self.cgst_rate = 2.5  # 5% GST = 2.5% CGST + 2.5% SGST (for economy)
        self.sgst_rate = 2.5
        self.igst_rate = 5.0  # For inter-state
        
        self.styles = getSampleStyleSheet()
    
    def generate_invoice(self, invoice_data: Dict[str, Any]) -> io.BytesIO:
        """
        Generate a GST-compliant tax invoice PDF
        
        invoice_data should contain:
        - invoice_number: str
        - invoice_date: str
        - booking_id: str
        - customer_name: str
        - customer_address: str
        - customer_gstin: str (optional)
        - customer_email: str
        - customer_phone: str
        - from_city: str
        - to_city: str
        - departure_date: str
        - aircraft_type: str
        - passenger_count: int
        - base_amount: float (excluding GST)
        - gst_amount: float
        - total_amount: float
        - payment_method: str
        - transaction_id: str
        - is_interstate: bool (True = IGST, False = CGST+SGST)
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=20*mm,
            leftMargin=20*mm,
            topMargin=15*mm,
            bottomMargin=15*mm
        )
        
        elements = []
        
        # Custom styles
        title_style = ParagraphStyle(
            'Title',
            parent=self.styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#FF6B00'),
            alignment=TA_CENTER,
            spaceAfter=5
        )
        
        subtitle_style = ParagraphStyle(
            'Subtitle',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=colors.gray,
            alignment=TA_CENTER
        )
        
        header_style = ParagraphStyle(
            'Header',
            parent=self.styles['Heading2'],
            fontSize=12,
            textColor=colors.HexColor('#1a1a2e'),
            spaceBefore=10,
            spaceAfter=5
        )
        
        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=self.styles['Normal'],
            fontSize=9,
            leading=12
        )
        
        # ===== HEADER =====
        elements.append(Paragraph("✈ AirYatra", title_style))
        elements.append(Paragraph("TAX INVOICE", subtitle_style))
        elements.append(Spacer(1, 10))
        
        # Invoice Details Table (Right aligned info)
        invoice_info = [
            ["Invoice No:", invoice_data.get("invoice_number", "INV-000000")],
            ["Invoice Date:", invoice_data.get("invoice_date", datetime.now().strftime("%d-%m-%Y"))],
            ["Booking Ref:", invoice_data.get("booking_id", "")[:12]],
        ]
        
        invoice_table = Table(invoice_info, colWidths=[80, 120])
        invoice_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#333333')),
        ]))
        
        # Company Info
        company_info = [
            [Paragraph(f"<b>{self.company_name}</b>", normal_style)],
            [Paragraph(self.company_address, normal_style)],
            [Paragraph(f"GSTIN: {self.company_gstin}", normal_style)],
            [Paragraph(f"PAN: {self.company_pan} | CIN: {self.company_cin}", normal_style)],
            [Paragraph(f"Email: {self.company_email} | Phone: {self.company_phone}", normal_style)],
        ]
        
        company_table = Table(company_info, colWidths=[280])
        company_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        
        # Header layout
        header_data = [[company_table, invoice_table]]
        header_layout = Table(header_data, colWidths=[300, 200])
        header_layout.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        
        elements.append(header_layout)
        elements.append(Spacer(1, 15))
        
        # Separator line
        line_data = [[""] * 1]
        line = Table(line_data, colWidths=[500])
        line.setStyle(TableStyle([
            ('LINEABOVE', (0, 0), (-1, 0), 1, colors.HexColor('#FF6B00')),
        ]))
        elements.append(line)
        elements.append(Spacer(1, 10))
        
        # ===== BILLING DETAILS =====
        elements.append(Paragraph("BILL TO", header_style))
        
        customer_gstin = invoice_data.get("customer_gstin", "")
        gstin_line = f"GSTIN: {customer_gstin}" if customer_gstin else "GSTIN: N/A (Unregistered)"
        
        billing_info = [
            [Paragraph(f"<b>{invoice_data.get('customer_name', 'Customer')}</b>", normal_style)],
            [Paragraph(invoice_data.get("customer_address", "Address not provided"), normal_style)],
            [Paragraph(gstin_line, normal_style)],
            [Paragraph(f"Email: {invoice_data.get('customer_email', '')} | Phone: {invoice_data.get('customer_phone', '')}", normal_style)],
        ]
        
        billing_table = Table(billing_info, colWidths=[480])
        billing_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8f9fa')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#dee2e6')),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ]))
        
        elements.append(billing_table)
        elements.append(Spacer(1, 15))
        
        # ===== FLIGHT DETAILS =====
        elements.append(Paragraph("FLIGHT DETAILS", header_style))
        
        flight_data = [
            ["Route:", f"{invoice_data.get('from_city', '')} → {invoice_data.get('to_city', '')}"],
            ["Departure:", invoice_data.get("departure_date", "")],
            ["Aircraft:", invoice_data.get("aircraft_type", "Helicopter")],
            ["Passengers:", str(invoice_data.get("passenger_count", 1))],
            ["PNR:", invoice_data.get("pnr", invoice_data.get("booking_id", "")[:8].upper())],
        ]
        
        flight_table = Table(flight_data, colWidths=[100, 380])
        flight_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fff3e6')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#FF6B00')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ]))
        
        elements.append(flight_table)
        elements.append(Spacer(1, 15))
        
        # ===== ITEMIZED CHARGES =====
        elements.append(Paragraph("CHARGES", header_style))
        
        base_amount = float(invoice_data.get("base_amount", 0))
        gst_amount = float(invoice_data.get("gst_amount", 0))
        total_amount = float(invoice_data.get("total_amount", base_amount + gst_amount))
        is_interstate = invoice_data.get("is_interstate", False)
        
        # Calculate GST breakdown
        if is_interstate:
            igst = gst_amount
            cgst = 0
            sgst = 0
            gst_label = f"IGST @ {self.igst_rate}%"
        else:
            igst = 0
            cgst = gst_amount / 2
            sgst = gst_amount / 2
            gst_label = f"CGST @ {self.cgst_rate}% + SGST @ {self.sgst_rate}%"
        
        charges_header = ["Description", "HSN/SAC", "Qty", "Rate (₹)", "Amount (₹)"]
        charges_data = [
            charges_header,
            [
                "Air Charter Service\n(Passenger Transport)",
                self.hsn_code,
                "1",
                f"{base_amount:,.2f}",
                f"{base_amount:,.2f}"
            ],
        ]
        
        # Add GST rows
        if is_interstate:
            charges_data.append([
                f"IGST @ {self.igst_rate}%",
                "",
                "",
                "",
                f"{igst:,.2f}"
            ])
        else:
            charges_data.append([
                f"CGST @ {self.cgst_rate}%",
                "",
                "",
                "",
                f"{cgst:,.2f}"
            ])
            charges_data.append([
                f"SGST @ {self.sgst_rate}%",
                "",
                "",
                "",
                f"{sgst:,.2f}"
            ])
        
        # Total row
        charges_data.append([
            "",
            "",
            "",
            Paragraph("<b>TOTAL</b>", normal_style),
            Paragraph(f"<b>₹{total_amount:,.2f}</b>", normal_style)
        ])
        
        charges_table = Table(charges_data, colWidths=[180, 70, 40, 90, 100])
        charges_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a1a2e')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
            ('ALIGN', (0, 0), (1, -1), 'LEFT'),
            ('GRID', (0, 0), (-1, -2), 0.5, colors.HexColor('#dee2e6')),
            ('LINEABOVE', (0, -1), (-1, -1), 1, colors.HexColor('#1a1a2e')),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f8f9fa')),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        
        elements.append(charges_table)
        elements.append(Spacer(1, 10))
        
        # Amount in words
        amount_words = self._amount_to_words(total_amount)
        elements.append(Paragraph(f"<b>Amount in Words:</b> {amount_words}", normal_style))
        elements.append(Spacer(1, 15))
        
        # ===== PAYMENT DETAILS =====
        elements.append(Paragraph("PAYMENT DETAILS", header_style))
        
        payment_data = [
            ["Payment Method:", invoice_data.get("payment_method", "Online")],
            ["Transaction ID:", invoice_data.get("transaction_id", "N/A")],
            ["Payment Status:", "PAID ✓"],
            ["Payment Date:", invoice_data.get("payment_date", datetime.now().strftime("%d-%m-%Y"))],
        ]
        
        payment_table = Table(payment_data, colWidths=[120, 360])
        payment_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#e8f5e9')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#4caf50')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ]))
        
        elements.append(payment_table)
        elements.append(Spacer(1, 15))
        
        # ===== QR CODE =====
        qr_data = {
            "invoice_no": invoice_data.get("invoice_number", ""),
            "gstin": self.company_gstin,
            "amount": total_amount,
            "date": invoice_data.get("invoice_date", ""),
            "booking": invoice_data.get("booking_id", "")[:12]
        }
        
        qr = qrcode.QRCode(version=1, box_size=4, border=1)
        qr.add_data(json.dumps(qr_data))
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="#1a1a2e", back_color="white")
        
        qr_buffer = io.BytesIO()
        qr_img.save(qr_buffer, format='PNG')
        qr_buffer.seek(0)
        
        qr_image = Image(qr_buffer, width=60, height=60)
        
        # Footer with QR and terms
        terms_text = """
        <b>Terms & Conditions:</b><br/>
        1. This is a computer-generated invoice and does not require signature.<br/>
        2. Subject to Mumbai jurisdiction. E&OE.<br/>
        3. Cancellation and refund as per AirYatra refund policy.<br/>
        4. GST Input Credit can be claimed subject to GST rules.
        """
        
        footer_data = [
            [
                Paragraph(terms_text, ParagraphStyle('Terms', fontSize=7, leading=9, textColor=colors.gray)),
                qr_image
            ]
        ]
        
        footer_table = Table(footer_data, colWidths=[400, 80])
        footer_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ]))
        
        elements.append(footer_table)
        elements.append(Spacer(1, 10))
        
        # Final footer
        elements.append(Paragraph(
            f"<i>Thank you for flying with AirYatra! | {self.company_website}</i>",
            ParagraphStyle('Footer', fontSize=8, textColor=colors.HexColor('#FF6B00'), alignment=TA_CENTER)
        ))
        
        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        
        return buffer
    
    def _amount_to_words(self, amount: float) -> str:
        """Convert amount to words (Indian numbering system)"""
        ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
                'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
                'Seventeen', 'Eighteen', 'Nineteen']
        tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
        
        def two_digits(n):
            if n < 20:
                return ones[n]
            return tens[n // 10] + (' ' + ones[n % 10] if n % 10 else '')
        
        def three_digits(n):
            if n < 100:
                return two_digits(n)
            return ones[n // 100] + ' Hundred' + (' and ' + two_digits(n % 100) if n % 100 else '')
        
        if amount == 0:
            return "Zero Rupees Only"
        
        rupees = int(amount)
        paise = int(round((amount - rupees) * 100))
        
        result = ""
        
        if rupees >= 10000000:  # Crores
            result += three_digits(rupees // 10000000) + ' Crore '
            rupees %= 10000000
        
        if rupees >= 100000:  # Lakhs
            result += two_digits(rupees // 100000) + ' Lakh '
            rupees %= 100000
        
        if rupees >= 1000:  # Thousands
            result += two_digits(rupees // 1000) + ' Thousand '
            rupees %= 1000
        
        if rupees > 0:
            result += three_digits(rupees)
        
        result = result.strip() + ' Rupees'
        
        if paise > 0:
            result += ' and ' + two_digits(paise) + ' Paise'
        
        return result + ' Only'


# Singleton instance
gst_invoice_generator = GSTInvoiceGenerator()
