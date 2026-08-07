"""
AirYatra Payment Receipt PDF Generator
Generates branded PDF receipts with transaction details, breakdown, and QR code
"""

import io
import os
import logging
import qrcode
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

logger = logging.getLogger(__name__)


class PaymentReceiptGenerator:
    """Generates branded PDF receipts for AirYatra payments"""
    
    # Brand colors
    PRIMARY_COLOR = colors.HexColor('#f97316')  # Orange
    SECONDARY_COLOR = colors.HexColor('#0f172a')  # Dark slate
    ACCENT_COLOR = colors.HexColor('#22c55e')  # Green
    LIGHT_BG = colors.HexColor('#f8fafc')
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Setup custom paragraph styles"""
        self.styles.add(ParagraphStyle(
            name='BrandTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=self.PRIMARY_COLOR,
            spaceAfter=6,
            alignment=TA_CENTER
        ))
        
        self.styles.add(ParagraphStyle(
            name='SubTitle',
            parent=self.styles['Normal'],
            fontSize=12,
            textColor=colors.gray,
            alignment=TA_CENTER
        ))
        
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=14,
            textColor=self.SECONDARY_COLOR,
            spaceBefore=12,
            spaceAfter=6,
            borderWidth=1,
            borderColor=self.PRIMARY_COLOR,
            borderPadding=4
        ))
        
        self.styles.add(ParagraphStyle(
            name='AmountLarge',
            parent=self.styles['Normal'],
            fontSize=20,
            textColor=self.ACCENT_COLOR,
            fontName='Helvetica-Bold',
            alignment=TA_CENTER
        ))
        
        self.styles.add(ParagraphStyle(
            name='Footer',
            parent=self.styles['Normal'],
            fontSize=8,
            textColor=colors.gray,
            alignment=TA_CENTER
        ))
    
    def generate_qr_code(self, data: str) -> io.BytesIO:
        """Generate QR code image"""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=2
        )
        qr.add_data(data)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        return buffer
    
    def generate_receipt(
        self,
        transaction_id: str,
        booking_id: str,
        customer_name: str,
        customer_email: str,
        payment_gateway: str,
        amount_inr: float,
        amount_foreign: Optional[float] = None,
        foreign_currency: Optional[str] = None,
        payment_method: Optional[str] = None,
        payment_date: Optional[datetime] = None,
        booking_details: Optional[Dict] = None,
        breakdown: Optional[Dict] = None,
        include_qr: bool = True
    ) -> io.BytesIO:
        """
        Generate a complete payment receipt PDF
        
        Args:
            transaction_id: Unique transaction identifier
            booking_id: Related booking ID
            customer_name: Customer's full name
            customer_email: Customer's email
            payment_gateway: Payment gateway used (razorpay, paypal, stripe, cashfree)
            amount_inr: Amount in INR
            amount_foreign: Amount in foreign currency (if applicable)
            foreign_currency: Foreign currency code (USD, EUR, etc.)
            payment_method: Specific payment method (UPI, Card, etc.)
            payment_date: Payment timestamp
            booking_details: Dict with route, date, passengers, etc.
            breakdown: Dict with base_amount, taxes, fees, etc.
            include_qr: Whether to include QR code
        
        Returns:
            BytesIO buffer containing the PDF
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=20*mm,
            leftMargin=20*mm,
            topMargin=20*mm,
            bottomMargin=20*mm
        )
        
        story = []
        payment_date = payment_date or datetime.now(timezone.utc)
        
        # ===== HEADER =====
        story.append(Paragraph("🚁 AirYatra", self.styles['BrandTitle']))
        story.append(Paragraph("India's Premium Helicopter Charter Service", self.styles['SubTitle']))
        story.append(Spacer(1, 10))
        
        # Receipt Title
        story.append(HRFlowable(width="100%", thickness=2, color=self.PRIMARY_COLOR))
        story.append(Spacer(1, 10))
        story.append(Paragraph("PAYMENT RECEIPT", ParagraphStyle(
            'ReceiptTitle',
            parent=self.styles['Heading1'],
            fontSize=18,
            textColor=self.SECONDARY_COLOR,
            alignment=TA_CENTER
        )))
        story.append(Spacer(1, 5))
        
        # Receipt Number & Date
        receipt_info = [
            ['Receipt No:', transaction_id],
            ['Date:', payment_date.strftime('%d %B %Y, %I:%M %p')],
        ]
        receipt_table = Table(receipt_info, colWidths=[100, 300])
        receipt_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.gray),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ]))
        story.append(receipt_table)
        story.append(Spacer(1, 15))
        
        # ===== CUSTOMER DETAILS =====
        story.append(Paragraph("Customer Details", self.styles['SectionHeader']))
        customer_data = [
            ['Name:', customer_name],
            ['Email:', customer_email],
            ['Booking ID:', booking_id],
        ]
        customer_table = Table(customer_data, colWidths=[100, 350])
        customer_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.gray),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(customer_table)
        story.append(Spacer(1, 15))
        
        # ===== BOOKING DETAILS (if provided) =====
        if booking_details:
            story.append(Paragraph("Booking Details", self.styles['SectionHeader']))
            booking_data = []
            
            if booking_details.get('route'):
                booking_data.append(['Route:', booking_details['route']])
            if booking_details.get('date'):
                booking_data.append(['Flight Date:', booking_details['date']])
            if booking_details.get('time'):
                booking_data.append(['Flight Time:', booking_details['time']])
            if booking_details.get('passengers'):
                booking_data.append(['Passengers:', str(booking_details['passengers'])])
            if booking_details.get('helicopter'):
                booking_data.append(['Helicopter:', booking_details['helicopter']])
            
            if booking_data:
                booking_table = Table(booking_data, colWidths=[100, 350])
                booking_table.setStyle(TableStyle([
                    ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('TEXTCOLOR', (0, 0), (0, -1), colors.gray),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ]))
                story.append(booking_table)
                story.append(Spacer(1, 15))
        
        # ===== PAYMENT BREAKDOWN =====
        story.append(Paragraph("Payment Breakdown", self.styles['SectionHeader']))
        
        breakdown_data = []
        if breakdown:
            if breakdown.get('base_amount'):
                breakdown_data.append(['Base Amount:', f"₹{breakdown['base_amount']:,.2f}"])
            if breakdown.get('taxes'):
                breakdown_data.append(['GST (18%):', f"₹{breakdown['taxes']:,.2f}"])
            if breakdown.get('convenience_fee'):
                breakdown_data.append(['Convenience Fee:', f"₹{breakdown['convenience_fee']:,.2f}"])
            if breakdown.get('discount'):
                breakdown_data.append(['Discount:', f"-₹{breakdown['discount']:,.2f}"])
        
        breakdown_data.append(['', ''])  # Spacer row
        breakdown_data.append(['TOTAL PAID', f"₹{amount_inr:,.2f}"])
        
        if amount_foreign and foreign_currency:
            breakdown_data.append([f'Equivalent ({foreign_currency})', f"{foreign_currency} {amount_foreign:,.2f}"])
        
        breakdown_table = Table(breakdown_data, colWidths=[300, 150])
        breakdown_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -2), 'Helvetica'),
            ('FONTNAME', (0, -2), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -3), 10),
            ('FONTSIZE', (0, -2), (-1, -1), 12),
            ('TEXTCOLOR', (0, 0), (0, -3), colors.gray),
            ('TEXTCOLOR', (0, -2), (-1, -1), self.ACCENT_COLOR),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LINEABOVE', (0, -2), (-1, -2), 1, colors.gray),
        ]))
        story.append(breakdown_table)
        story.append(Spacer(1, 15))
        
        # ===== PAYMENT METHOD =====
        story.append(Paragraph("Payment Information", self.styles['SectionHeader']))
        
        gateway_names = {
            'razorpay': 'Razorpay',
            'paypal': 'PayPal',
            'stripe': 'Stripe',
            'cashfree': 'Cashfree'
        }
        
        payment_info = [
            ['Payment Gateway:', gateway_names.get(payment_gateway, payment_gateway.title())],
            ['Transaction ID:', transaction_id],
            ['Status:', 'SUCCESSFUL'],
        ]
        if payment_method:
            payment_info.insert(1, ['Payment Method:', payment_method])
        
        payment_table = Table(payment_info, colWidths=[120, 330])
        payment_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.gray),
            ('TEXTCOLOR', (1, -1), (1, -1), self.ACCENT_COLOR),
            ('FONTNAME', (1, -1), (1, -1), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(payment_table)
        story.append(Spacer(1, 20))
        
        # ===== QR CODE =====
        if include_qr:
            qr_data = f"AIRYATRA|TXN:{transaction_id}|BKG:{booking_id}|AMT:{amount_inr}"
            qr_buffer = self.generate_qr_code(qr_data)
            qr_image = Image(qr_buffer, width=80, height=80)
            
            qr_table = Table([[qr_image, Paragraph(
                "Scan to verify this receipt<br/>or visit airyatra.com/verify",
                ParagraphStyle('QRText', fontSize=9, textColor=colors.gray)
            )]], colWidths=[100, 350])
            qr_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (0, 0), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            story.append(qr_table)
            story.append(Spacer(1, 15))
        
        # ===== FOOTER =====
        story.append(HRFlowable(width="100%", thickness=1, color=colors.lightgrey))
        story.append(Spacer(1, 10))
        
        footer_text = """
        This is a computer-generated receipt and does not require a signature.<br/>
        For any queries, contact us at support@airyatra.com or call +91-1800-XXX-XXXX<br/>
        AirYatra Aviation Pvt. Ltd. | CIN: U51909MH2024PTC123456 | GSTIN: 27XXXXX1234X1Z5
        """
        story.append(Paragraph(footer_text, self.styles['Footer']))
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer
    
    def generate_refund_receipt(
        self,
        refund_id: str,
        original_transaction_id: str,
        booking_id: str,
        customer_name: str,
        customer_email: str,
        original_amount: float,
        refund_amount: float,
        deductions: Dict,
        refund_reason: str,
        refund_date: Optional[datetime] = None,
        payment_gateway: str = 'unknown'
    ) -> io.BytesIO:
        """Generate refund receipt PDF"""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=20*mm,
            leftMargin=20*mm,
            topMargin=20*mm,
            bottomMargin=20*mm
        )
        
        story = []
        refund_date = refund_date or datetime.now(timezone.utc)
        
        # Header
        story.append(Paragraph("🚁 AirYatra", self.styles['BrandTitle']))
        story.append(Paragraph("India's Premium Helicopter Charter Service", self.styles['SubTitle']))
        story.append(Spacer(1, 10))
        story.append(HRFlowable(width="100%", thickness=2, color=self.PRIMARY_COLOR))
        story.append(Spacer(1, 10))
        
        story.append(Paragraph("REFUND RECEIPT", ParagraphStyle(
            'RefundTitle',
            parent=self.styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#ef4444'),
            alignment=TA_CENTER
        )))
        story.append(Spacer(1, 15))
        
        # Refund Info
        info_data = [
            ['Refund ID:', refund_id],
            ['Original Transaction:', original_transaction_id],
            ['Booking ID:', booking_id],
            ['Date:', refund_date.strftime('%d %B %Y, %I:%M %p')],
        ]
        info_table = Table(info_data, colWidths=[150, 300])
        info_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.gray),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 15))
        
        # Customer
        story.append(Paragraph("Customer Details", self.styles['SectionHeader']))
        customer_data = [
            ['Name:', customer_name],
            ['Email:', customer_email],
        ]
        customer_table = Table(customer_data, colWidths=[100, 350])
        customer_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
        ]))
        story.append(customer_table)
        story.append(Spacer(1, 15))
        
        # Refund Breakdown
        story.append(Paragraph("Refund Breakdown", self.styles['SectionHeader']))
        
        breakdown_data = [
            ['Original Amount:', f"₹{original_amount:,.2f}"],
        ]
        
        if deductions:
            if deductions.get('cancellation_deduction'):
                cd = deductions['cancellation_deduction']
                breakdown_data.append([
                    f"Cancellation Charge ({cd.get('percent', 0)}%):",
                    f"-₹{cd.get('amount', 0):,.2f}"
                ])
            if deductions.get('processing_fee'):
                pf = deductions['processing_fee']
                breakdown_data.append([
                    f"Processing Fee ({pf.get('percent', 0)}%):",
                    f"-₹{pf.get('amount', 0):,.2f}"
                ])
            if deductions.get('admin_fee'):
                breakdown_data.append([
                    'Admin Fee:',
                    f"-₹{deductions['admin_fee']:,.2f}"
                ])
        
        breakdown_data.append(['', ''])
        breakdown_data.append(['NET REFUND AMOUNT', f"₹{refund_amount:,.2f}"])
        
        breakdown_table = Table(breakdown_data, colWidths=[250, 200])
        breakdown_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -2), 'Helvetica'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -2), 10),
            ('FONTSIZE', (0, -1), (-1, -1), 12),
            ('TEXTCOLOR', (1, 1), (1, -2), colors.HexColor('#ef4444')),
            ('TEXTCOLOR', (0, -1), (-1, -1), self.ACCENT_COLOR),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('LINEABOVE', (0, -1), (-1, -1), 1, colors.gray),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(breakdown_table)
        story.append(Spacer(1, 15))
        
        # Reason
        story.append(Paragraph("Cancellation Reason", self.styles['SectionHeader']))
        story.append(Paragraph(refund_reason, self.styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Footer
        story.append(HRFlowable(width="100%", thickness=1, color=colors.lightgrey))
        story.append(Spacer(1, 10))
        footer_text = """
        Refund will be credited to your original payment method within 5-7 business days.<br/>
        For any queries, contact support@airyatra.com
        """
        story.append(Paragraph(footer_text, self.styles['Footer']))
        
        doc.build(story)
        buffer.seek(0)
        return buffer


# Singleton instance
receipt_generator = PaymentReceiptGenerator()
