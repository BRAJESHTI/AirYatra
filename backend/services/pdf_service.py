"""
PDF Receipt Generator Service
Generates professional booking receipts with AirYatra branding
"""
import io
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT


class PDFReceiptGenerator:
    """Generate professional booking receipts"""
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Setup custom paragraph styles"""
        self.styles.add(ParagraphStyle(
            name='Title_Custom',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#f97316'),
            alignment=TA_CENTER,
            spaceAfter=20
        ))
        
        self.styles.add(ParagraphStyle(
            name='Subtitle',
            parent=self.styles['Normal'],
            fontSize=12,
            textColor=colors.HexColor('#64748b'),
            alignment=TA_CENTER,
            spaceAfter=30
        ))
        
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#1e293b'),
            spaceBefore=20,
            spaceAfter=10
        ))
        
        self.styles.add(ParagraphStyle(
            name='Footer',
            parent=self.styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor('#94a3b8'),
            alignment=TA_CENTER,
            spaceBefore=30
        ))
    
    def generate_booking_receipt(self, booking_data: dict) -> bytes:
        """
        Generate a booking receipt PDF
        
        Args:
            booking_data: Dictionary containing booking details
            
        Returns:
            PDF file as bytes
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
        
        elements = []
        
        # Header
        elements.append(Paragraph("AirYatra", self.styles['Title_Custom']))
        elements.append(Paragraph("India's Premium Aviation Platform", self.styles['Subtitle']))
        
        # Receipt Title
        elements.append(Paragraph(
            f"<b>BOOKING CONFIRMATION</b>",
            ParagraphStyle(
                name='ReceiptTitle',
                fontSize=18,
                textColor=colors.HexColor('#1e293b'),
                alignment=TA_CENTER,
                spaceBefore=10,
                spaceAfter=5
            )
        ))
        
        # Booking ID
        booking_id = booking_data.get('booking_id', booking_data.get('id', 'N/A'))
        elements.append(Paragraph(
            f"Receipt #{booking_id}",
            ParagraphStyle(
                name='BookingID',
                fontSize=11,
                textColor=colors.HexColor('#64748b'),
                alignment=TA_CENTER,
                spaceAfter=20
            )
        ))
        
        # Status Badge
        status = booking_data.get('status', 'confirmed').upper()
        status_color = '#22c55e' if status in ['CONFIRMED', 'PAID', 'COMPLETED'] else '#f97316'
        elements.append(Paragraph(
            f"<font color='{status_color}'><b>STATUS: {status}</b></font>",
            ParagraphStyle(name='Status', fontSize=12, alignment=TA_CENTER, spaceAfter=25)
        ))
        
        elements.append(Spacer(1, 10))
        
        # Flight Details Section
        elements.append(Paragraph("FLIGHT DETAILS", self.styles['SectionHeader']))
        
        flight_data = [
            ['Route:', f"{booking_data.get('from_location', booking_data.get('origin', 'N/A'))} → {booking_data.get('to_location', booking_data.get('destination', 'N/A'))}"],
            ['Date:', booking_data.get('travel_date', booking_data.get('departure_date', 'N/A'))],
            ['Aircraft:', booking_data.get('aircraft_type', 'Helicopter')],
            ['Passengers:', str(booking_data.get('passengers', booking_data.get('passenger_count', 1)))],
        ]
        
        if booking_data.get('departure_time'):
            flight_data.append(['Departure Time:', booking_data.get('departure_time')])
        
        flight_table = Table(flight_data, colWidths=[120, 350])
        flight_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#64748b')),
            ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#1e293b')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ]))
        elements.append(flight_table)
        
        elements.append(Spacer(1, 15))
        
        # Customer Details Section
        elements.append(Paragraph("CUSTOMER DETAILS", self.styles['SectionHeader']))
        
        customer_data = [
            ['Name:', booking_data.get('customer_name', booking_data.get('name', 'N/A'))],
            ['Email:', booking_data.get('customer_email', booking_data.get('email', 'N/A'))],
            ['Phone:', booking_data.get('customer_phone', booking_data.get('phone', 'N/A'))],
        ]
        
        customer_table = Table(customer_data, colWidths=[120, 350])
        customer_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#64748b')),
            ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#1e293b')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(customer_table)
        
        elements.append(Spacer(1, 15))
        
        # Payment Details Section
        elements.append(Paragraph("PAYMENT SUMMARY", self.styles['SectionHeader']))
        
        base_amount = booking_data.get('base_amount', booking_data.get('amount', 0))
        gst = booking_data.get('gst_amount', round(base_amount * 0.18, 2))
        discount = booking_data.get('discount_amount', 0)
        total = booking_data.get('total_amount', booking_data.get('amount', base_amount + gst - discount))
        
        payment_data = [
            ['Base Fare:', f"₹{base_amount:,.2f}"],
            ['GST (18%):', f"₹{gst:,.2f}"],
        ]
        
        if discount > 0:
            payment_data.append(['Discount:', f"-₹{discount:,.2f}"])
        
        payment_data.append(['', ''])  # Separator row
        payment_data.append(['TOTAL AMOUNT:', f"₹{total:,.2f}"])
        
        payment_table = Table(payment_data, colWidths=[350, 120])
        payment_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -2), 'Helvetica'),
            ('FONTNAME', (1, 0), (1, -2), 'Helvetica'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -2), 11),
            ('FONTSIZE', (0, -1), (-1, -1), 14),
            ('TEXTCOLOR', (0, 0), (0, -2), colors.HexColor('#64748b')),
            ('TEXTCOLOR', (1, 0), (1, -2), colors.HexColor('#1e293b')),
            ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor('#f97316')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('LINEABOVE', (0, -1), (-1, -1), 1, colors.HexColor('#e2e8f0')),
        ]))
        elements.append(payment_table)
        
        # Payment Status
        payment_status = booking_data.get('payment_status', 'pending').upper()
        if payment_status == 'PAID':
            elements.append(Spacer(1, 15))
            elements.append(Paragraph(
                f"<font color='#22c55e'><b>✓ PAYMENT RECEIVED</b></font>",
                ParagraphStyle(name='PaymentStatus', fontSize=12, alignment=TA_RIGHT)
            ))
            if booking_data.get('payment_date'):
                elements.append(Paragraph(
                    f"<font color='#64748b'>Paid on: {booking_data.get('payment_date')}</font>",
                    ParagraphStyle(name='PaymentDate', fontSize=10, alignment=TA_RIGHT)
                ))
        
        elements.append(Spacer(1, 30))
        
        # Terms & Conditions
        elements.append(Paragraph("TERMS & CONDITIONS", self.styles['SectionHeader']))
        terms = [
            "• This booking is subject to weather conditions and DGCA regulations.",
            "• Please arrive at the helipad 30 minutes before departure.",
            "• Carry a valid government-issued photo ID.",
            "• Baggage limit: 7kg per passenger.",
            "• Cancellation charges apply as per our policy.",
        ]
        for term in terms:
            elements.append(Paragraph(
                term,
                ParagraphStyle(
                    name='Terms',
                    fontSize=9,
                    textColor=colors.HexColor('#64748b'),
                    spaceBefore=3
                )
            ))
        
        elements.append(Spacer(1, 30))
        
        # Footer
        elements.append(Paragraph(
            "Thank you for choosing AirYatra!",
            ParagraphStyle(
                name='ThankYou',
                fontSize=14,
                textColor=colors.HexColor('#f97316'),
                alignment=TA_CENTER,
                spaceBefore=20
            )
        ))
        
        elements.append(Paragraph(
            f"Generated on: {datetime.now().strftime('%d %B %Y, %H:%M IST')}",
            self.styles['Footer']
        ))
        
        elements.append(Paragraph(
            "AirYatra Aviation Pvt Ltd | support@airyatra.com | +91-XXXXXXXXXX",
            self.styles['Footer']
        ))
        
        elements.append(Paragraph(
            "This is a computer-generated receipt and does not require a signature.",
            self.styles['Footer']
        ))
        
        # Build PDF
        doc.build(elements)
        
        buffer.seek(0)
        return buffer.getvalue()


# Singleton instance
pdf_service = PDFReceiptGenerator()
