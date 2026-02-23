import logging
from io import BytesIO
import pandas as pd
from typing import Optional
from sqlalchemy.orm import Session
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from app.models.anomaly import Anomaly
from app.models.shop import Shop
from app.models.complaint import Complaint
from app.models.risk_score import RiskScore
from sqlalchemy import func

logger = logging.getLogger(__name__)

class ReportService:
    @staticmethod
    def generate_monthly_district_report(db: Session, district: str, month: str) -> BytesIO:
        """
        Generate a PDF report using ReportLab with a memory buffer.
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        elements = []
        
        # Title
        elements.append(Paragraph(f"Monthly District Governance Report", styles['Title']))
        elements.append(Paragraph(f"District: {district} | Month: {month}", styles['Heading2']))
        elements.append(Spacer(1, 20))

        # We need some dummy or aggregated data for the PDF
        anomaly_dist = db.query(
            Anomaly.anomaly_type, func.count(Anomaly.id)
        ).join(Shop, Anomaly.shop_id == Shop.id).filter(Shop.district == district).group_by(Anomaly.anomaly_type).all()

        # Add Anomaly Table
        elements.append(Paragraph("Anomaly Distribution", styles['Heading3']))
        
        table_data = [["Anomaly Type", "Count"]]
        total_anomalies = 0
        for row in anomaly_dist:
            table_data.append([row[0].replace('_', ' ').title(), str(row[1])])
            total_anomalies += row[1]
            
        table_data.append(["TOTAL", str(total_anomalies)])

        t = Table(table_data, colWidths=[200, 100])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, -1), (-1, -1), colors.lightgrey),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        
        elements.append(t)
        elements.append(Spacer(1, 20))

        # Add Recommendations
        elements.append(Paragraph("System Recommendations", styles['Heading3']))
        if total_anomalies > 50:
             elements.append(Paragraph("CRITICAL: High volume of anomalies detected. Immediate audits required.", styles['Normal']))
        else:
             elements.append(Paragraph("Status: Normal operational variance. Continue standard monitoring.", styles['Normal']))

        doc.build(elements)
        buffer.seek(0)
        return buffer

    @staticmethod
    def generate_shop_performance_report(db: Session, shop_id: str, month: str) -> BytesIO:
        """
        Generate a PDF report for a single shop using a memory buffer.
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        elements = []
        
        shop = db.query(Shop).filter(Shop.id == shop_id).first()
        shop_name = shop.shop_name if shop else "Unknown"
        
        elements.append(Paragraph(f"Shop Performance Audit", styles['Title']))
        elements.append(Paragraph(f"Shop ID: {shop_id} ({shop_name}) | Month: {month}", styles['Heading2']))
        elements.append(Spacer(1, 20))

        # Risk Info
        risk = db.query(RiskScore).filter(RiskScore.shop_id == shop_id).order_by(RiskScore.calculated_at.desc()).first()
        risk_text = f"Current Risk Score: {risk.risk_score}" if risk else "Current Risk Score: N/A"
        elements.append(Paragraph(risk_text, styles['Normal']))
        elements.append(Spacer(1, 20))

        # Complaints
        complaints_count = db.query(Complaint).filter(Complaint.shop_id == shop_id).count()
        elements.append(Paragraph(f"Total Complaints Received: {complaints_count}", styles['Normal']))
        
        doc.build(elements)
        buffer.seek(0)
        return buffer

    @staticmethod
    def export_analytics_excel(db: Session, district: Optional[str] = None) -> BytesIO:
        """
        Stream an Excel workbook with multiple sheets (pandas + openpyxl).
        Avoid index=True.
        """
        buffer = BytesIO()
        
        # 1. Anomalies Data
        query = db.query(Anomaly.shop_id, Anomaly.anomaly_type, Anomaly.severity, Anomaly.created_at)
        if district:
            query = query.join(Shop, Anomaly.shop_id == Shop.id).filter(Shop.district == district)
            
        anomalies_df = pd.read_sql(query.statement, db.get_bind())
        
        # 2. Risk Data
        risk_query = db.query(Shop.mandal, Shop.id.label("shop_id"), RiskScore.risk_score, RiskScore.month)
        if district:
            risk_query = risk_query.join(Shop, RiskScore.shop_id == Shop.id).filter(Shop.district == district)
        else:
             risk_query = risk_query.join(Shop, RiskScore.shop_id == Shop.id)
             
        risk_df = pd.read_sql(risk_query.statement, db.get_bind())
        
        # Write multiple sheets
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            if not anomalies_df.empty:
                 # Convert timezone tz-aware datetimes to tz-naive before exporting to excel which doesn't support tz well
                 if 'created_at' in anomalies_df.columns and pd.api.types.is_datetime64_any_dtype(anomalies_df['created_at']):
                     anomalies_df['created_at'] = anomalies_df['created_at'].dt.tz_localize(None)
                 anomalies_df.to_excel(writer, sheet_name='Anomalies', index=False)
            else:
                 pd.DataFrame([['No data']]).to_excel(writer, sheet_name='Anomalies', index=False, header=False)
                 
            if not risk_df.empty:
                 risk_df.to_excel(writer, sheet_name='Risk Distribution', index=False)
            else:
                 pd.DataFrame([['No data']]).to_excel(writer, sheet_name='Risk Distribution', index=False, header=False)
                 
        buffer.seek(0)
        return buffer
