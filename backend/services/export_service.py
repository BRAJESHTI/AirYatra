"""
AirYatra Analytics Export Service
Features: CSV export, PDF reports, Chart data export
"""

import os
import io
import csv
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

logger = logging.getLogger(__name__)


class AnalyticsExportService:
    """Export analytics data to CSV and PDF formats"""
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Setup custom PDF styles"""
        self.styles.add(ParagraphStyle(
            name='ReportTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#f97316')
        ))
        
        self.styles.add(ParagraphStyle(
            name='SectionTitle',
            parent=self.styles['Heading2'],
            fontSize=14,
            spaceBefore=20,
            spaceAfter=10,
            textColor=colors.HexColor('#1e293b')
        ))
        
        self.styles.add(ParagraphStyle(
            name='MetricValue',
            parent=self.styles['Normal'],
            fontSize=28,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#f97316')
        ))
    
    def export_delivery_reports_csv(
        self,
        reports: List[Dict[str, Any]],
        stats: Dict[str, Any] = None
    ) -> io.StringIO:
        """Export delivery reports to CSV"""
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            'Report ID', 'Message ID', 'Template ID', 'Category', 
            'Status', 'Provider', 'Recipient', 'Received At', 'Details'
        ])
        
        # Data rows
        for report in reports:
            writer.writerow([
                report.get('report_id', ''),
                report.get('message_id', ''),
                report.get('template_id', ''),
                report.get('category', ''),
                report.get('status', ''),
                report.get('provider', ''),
                report.get('recipient', ''),
                report.get('received_at', ''),
                report.get('details', '')
            ])
        
        # Summary section
        if stats:
            writer.writerow([])
            writer.writerow(['--- Summary Statistics ---'])
            writer.writerow(['Metric', 'Value'])
            for key, value in stats.items():
                writer.writerow([key.replace('_', ' ').title(), value])
        
        output.seek(0)
        return output
    
    def export_notification_queue_csv(
        self,
        queue_items: List[Dict[str, Any]]
    ) -> io.StringIO:
        """Export notification queue to CSV"""
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            'Queue ID', 'Template ID', 'Template Name', 'Category',
            'Recipient', 'Status', 'Scheduled At', 'Sent At',
            'Created By', 'Error'
        ])
        
        # Data rows
        for item in queue_items:
            writer.writerow([
                item.get('queue_id', ''),
                item.get('template_id', ''),
                item.get('template_name', ''),
                item.get('category', ''),
                item.get('recipient', ''),
                item.get('status', ''),
                item.get('scheduled_at', ''),
                item.get('sent_at', ''),
                item.get('created_by', ''),
                item.get('error', '')
            ])
        
        output.seek(0)
        return output
    
    def export_chart_data_csv(
        self,
        line_data: List[Dict[str, Any]],
        bar_data: List[Dict[str, Any]],
        summary: Dict[str, Any]
    ) -> io.StringIO:
        """Export chart data to CSV"""
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Line chart data (Daily trends)
        writer.writerow(['--- Daily Delivery Trends ---'])
        writer.writerow(['Date', 'Total', 'Sent', 'Failed', 'Pending'])
        for row in line_data:
            writer.writerow([
                row.get('date', ''),
                row.get('total', 0),
                row.get('sent', 0),
                row.get('failed', 0),
                row.get('pending', 0)
            ])
        
        writer.writerow([])
        
        # Bar chart data (Category breakdown)
        writer.writerow(['--- Category Performance ---'])
        writer.writerow(['Category', 'Total', 'Sent', 'Failed', 'Success Rate %'])
        for row in bar_data:
            writer.writerow([
                row.get('category', ''),
                row.get('total', 0),
                row.get('sent', 0),
                row.get('failed', 0),
                row.get('success_rate', 0)
            ])
        
        writer.writerow([])
        
        # Summary
        writer.writerow(['--- Summary ---'])
        writer.writerow(['Metric', 'Value'])
        for key, value in summary.items():
            writer.writerow([key.replace('_', ' ').title(), value])
        
        output.seek(0)
        return output
    
    def export_analytics_pdf(
        self,
        title: str,
        period_days: int,
        summary: Dict[str, Any],
        line_data: List[Dict[str, Any]],
        bar_data: List[Dict[str, Any]],
        top_templates: List[Dict[str, Any]] = None
    ) -> io.BytesIO:
        """Export analytics report to PDF"""
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=30,
            leftMargin=30,
            topMargin=30,
            bottomMargin=30
        )
        
        elements = []
        
        # Title
        elements.append(Paragraph(title, self.styles['ReportTitle']))
        elements.append(Paragraph(
            f"Report Period: Last {period_days} Days | Generated: {datetime.now().strftime('%d %b %Y, %I:%M %p')}",
            self.styles['Normal']
        ))
        elements.append(Spacer(1, 20))
        
        # Summary Stats Section
        elements.append(Paragraph("Summary Statistics", self.styles['SectionTitle']))
        
        summary_data = [
            ['Metric', 'Value'],
            ['Total Sent', str(summary.get('total', 0))],
            ['Delivered', str(summary.get('sent', 0))],
            ['Failed', str(summary.get('failed', 0))],
            ['Success Rate', f"{summary.get('success_rate', 0)}%"],
        ]
        
        summary_table = Table(summary_data, colWidths=[200, 150])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f97316')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 20))
        
        # Daily Trends Section
        if line_data:
            elements.append(Paragraph("Daily Delivery Trends", self.styles['SectionTitle']))
            
            trend_data = [['Date', 'Total', 'Sent', 'Failed']]
            for row in line_data[-10:]:  # Last 10 days
                trend_data.append([
                    row.get('date', '')[-5:],  # MM-DD format
                    str(row.get('total', 0)),
                    str(row.get('sent', 0)),
                    str(row.get('failed', 0))
                ])
            
            trend_table = Table(trend_data, colWidths=[100, 100, 100, 100])
            trend_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3b82f6')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]))
            elements.append(trend_table)
            elements.append(Spacer(1, 20))
        
        # Category Performance Section
        if bar_data:
            elements.append(Paragraph("Category Performance", self.styles['SectionTitle']))
            
            cat_data = [['Category', 'Total', 'Sent', 'Failed', 'Success %']]
            for row in bar_data:
                cat_data.append([
                    row.get('category', ''),
                    str(row.get('total', 0)),
                    str(row.get('sent', 0)),
                    str(row.get('failed', 0)),
                    f"{row.get('success_rate', 0)}%"
                ])
            
            cat_table = Table(cat_data, colWidths=[100, 80, 80, 80, 80])
            cat_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#22c55e')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0fdf4')]),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]))
            elements.append(cat_table)
            elements.append(Spacer(1, 20))
        
        # Top Templates Section
        if top_templates:
            elements.append(Paragraph("Top Performing Templates", self.styles['SectionTitle']))
            
            top_data = [['Rank', 'Template Name', 'Usage Count']]
            for i, t in enumerate(top_templates[:5], 1):
                top_data.append([
                    f"#{i}",
                    t.get('name', '')[:30],
                    str(t.get('usage_count', 0))
                ])
            
            top_table = Table(top_data, colWidths=[60, 280, 100])
            top_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#8b5cf6')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (0, -1), 'CENTER'),
                ('ALIGN', (1, 0), (1, -1), 'LEFT'),
                ('ALIGN', (2, 0), (2, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#faf5ff')]),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]))
            elements.append(top_table)
        
        # Footer
        elements.append(Spacer(1, 40))
        elements.append(Paragraph(
            "Generated by AirYatra Template Management System",
            ParagraphStyle(name='Footer', parent=self.styles['Normal'], fontSize=8, textColor=colors.gray, alignment=TA_CENTER)
        ))
        
        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        return buffer
    
    def export_alerts_csv(
        self,
        alerts: List[Dict[str, Any]],
        history: List[Dict[str, Any]]
    ) -> io.StringIO:
        """Export alerts and history to CSV"""
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Active Alerts
        writer.writerow(['--- Active Alerts ---'])
        writer.writerow(['Alert ID', 'Metric', 'Threshold', 'Comparison', 'Template ID', 'Status', 'Trigger Count'])
        for alert in alerts:
            writer.writerow([
                alert.get('alert_id', ''),
                alert.get('metric', ''),
                alert.get('threshold', ''),
                alert.get('comparison', ''),
                alert.get('template_id', ''),
                'Active' if alert.get('is_active') else 'Paused',
                alert.get('trigger_count', 0)
            ])
        
        writer.writerow([])
        
        # Alert History
        writer.writerow(['--- Alert History ---'])
        writer.writerow(['History ID', 'Alert ID', 'Metric', 'Threshold', 'Actual Value', 'Triggered At'])
        for h in history:
            writer.writerow([
                h.get('history_id', ''),
                h.get('alert_id', ''),
                h.get('metric', ''),
                h.get('threshold', ''),
                h.get('actual_value', ''),
                h.get('triggered_at', '')
            ])
        
        output.seek(0)
        return output


# Singleton instance
export_service = AnalyticsExportService()
