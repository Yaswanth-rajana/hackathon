from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.suspension_record import SuspensionRecord

router = APIRouter(tags=["Public Proof"])


@router.get("/proof/{public_id}", response_class=HTMLResponse)
def get_public_proof(public_id: str, db: Session = Depends(get_db)):
    rec = db.query(SuspensionRecord).filter(SuspensionRecord.public_id == public_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Proof record not found")

    factors = rec.ai_factors or {}
    factors_lines = "".join(
        f"<li><strong>{k}</strong>: {v}</li>"
        for k, v in factors.items()
    )

    html = f"""
    <html>
      <head>
        <title>RationShield Public Proof</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          body {{ font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; margin: 0; background: #f5f7fb; color: #111827; }}
          .wrap {{ max-width: 900px; margin: 30px auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 24px; }}
          .badge {{ display:inline-block; padding:6px 10px; border-radius:999px; background:#fee2e2; color:#991b1b; font-weight:700; font-size:12px; }}
          .grid {{ display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px 18px; margin-top: 16px; }}
          .k {{ color:#6b7280; font-size:12px; text-transform:uppercase; letter-spacing:.08em; }}
          .v {{ font-weight:700; margin-top:3px; }}
          .muted {{ color:#6b7280; font-size:12px; }}
          .hash {{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; }}
          ul {{ margin-top:8px; }}
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="badge">Public Suspension Proof (Immutable)</div>
          <h2>RationShield Governance Enforcement Record</h2>
          <p class="muted">This proof is publicly accessible and cryptographically anchored to blockchain transaction data.</p>

          <div class="grid">
            <div><div class="k">Proof ID</div><div class="v">{rec.public_id}</div></div>
            <div><div class="k">Timestamp</div><div class="v">{rec.created_at}</div></div>
            <div><div class="k">Shop</div><div class="v">{rec.shop_name or rec.shop_id}</div></div>
            <div><div class="k">Dealer ID</div><div class="v">{rec.dealer_id or "N/A"}</div></div>
            <div><div class="k">Risk Score (Before -> After)</div><div class="v">{rec.risk_score_before} -> {rec.risk_score_after}</div></div>
            <div><div class="k">Reason for Suspension</div><div class="v">{rec.reason}</div></div>
            <div><div class="k">Enforcement Block Index</div><div class="v">{rec.enforcement_block_index}</div></div>
            <div><div class="k">Enforcement Txn ID</div><div class="v hash">{rec.enforcement_txn_id}</div></div>
            <div><div class="k">Block Hash</div><div class="v hash">{rec.block_hash}</div></div>
            <div><div class="k">Previous Hash</div><div class="v hash">{rec.previous_hash}</div></div>
          </div>

          <h3>AI Factors</h3>
          <ul>
            {factors_lines or "<li>No factors captured.</li>"}
          </ul>
          <p class="muted">This record is immutable once written.</p>
        </div>
      </body>
    </html>
    """
    return HTMLResponse(content=html)
