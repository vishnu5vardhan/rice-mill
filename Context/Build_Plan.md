\# BUILD\_PLAN.md

\# Rice Mill Intelligence System Build Plan

\#\# Build Strategy

Do not build the full product first.

Build the core loop:

Document/voice input  
→ AI draft  
→ human confirmation  
→ correction memory  
→ business event  
→ ledger update  
→ missing/mismatch detection  
→ evidence-backed answer/export

\#\# Phase 1 — Foundation

Build:  
\- Next.js app  
\- Supabase setup  
\- Auth  
\- Mill setup  
\- User roles  
\- Document upload  
\- File storage  
\- Basic audit log  
\- Manual paddy inward entry  
\- Manual by-product sale entry  
\- Manual expense entry

Goal:  
The system can store real operational data manually.

\#\# Phase 2 — AI Document Draft

Build:  
\- Document classification  
\- Truck sheet extraction schema  
\- Extraction confidence per field  
\- Draft entry creation  
\- Confirm/edit screen  
\- Save confirmed entry  
\- Save corrections  
\- Missing field detection

Goal:  
Upload photo → AI extracts → owner confirms → event saved.

\#\# Phase 3 — Voice Entry

Build:  
\- Voice recording/upload  
\- Speech-to-text  
\- Voice-to-draft parser  
\- Confirmation screen  
\- Incomplete entry handling

Goal:  
Owner can speak a paddy inward/by-product/expense entry.

\#\# Phase 4 — Ledger and Tasks

Build:  
\- Business events  
\- Stock events  
\- Paddy lot status  
\- Missing data tasks  
\- Disputed status  
\- Basic stock calculation

Goal:  
System handles imperfect data and does not fake totals.

\#\# Phase 5 — Mismatch and Alerts

Build:  
\- Truck sheet vs physical count comparison  
\- Truck sheet vs government/manual app entry comparison  
\- Missing moisture alert  
\- Missing document alert  
\- Low by-product sale rate alert  
\- Negative stock alert

Goal:  
System warns owner before mistakes become losses.

\#\# Phase 6 — Ask/Search

Build:  
\- Search documents  
\- Ask simple questions  
\- Query deterministic functions  
\- Explain results with evidence

Supported questions:  
\- How much paddy came today?  
\- Which entries are incomplete?  
\- Show truck sheet for this truck number.  
\- How much bran sold this month?  
\- Which sales had low rate?  
\- What expenses are recorded this month?

\#\# Phase 7 — CA Export

Build:  
\- Monthly summary  
\- Yearly summary  
\- Excel export  
\- PDF export  
\- Document bundle export  
\- Export snapshot/lock/versioning

Goal:  
Owner can send clean data to CA.

\#\# Phase 8 — Pilot Hardening

Build:  
\- Better error handling  
\- Backups  
\- Audit views  
\- Admin correction tools  
\- Data completeness report  
\- Owner daily summary  
\- WhatsApp notification later

Goal:  
Use in one real rice mill.  
