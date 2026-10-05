\# PROJECT\_CONTEXT.md

\# Rice Mill Intelligence System

\#\# One-Line Product

A voice-first rice mill operating memory that captures data through speech and photos, confirms it with the owner, stores it in structured ledgers, detects mismatches/missing data, explains stock/profit with evidence, learns from corrections, and exports clean reports for the CA.

\#\# Why This Exists

Many rice mills run on the owner’s memory, paper books, WhatsApp photos, handwritten truck sheets, and scattered documents.

This creates problems:  
\- Wrong government paddy confirmation  
\- Truck sheet vs actual bag mismatch  
\- Missing moisture records  
\- Missing challans/documents  
\- Unclear stock  
\- Wrong bran/broken rice sale calculations  
\- Low sale rates not noticed  
\- Profit/loss unclear  
\- CA reporting headache  
\- License/compliance reminders missed  
\- Business depends too much on one person’s memory

The system should reduce memory load and catch operational mistakes.

\#\# Product Positioning

This is not:  
\- Generic ERP  
\- Full accounting software  
\- AI accountant  
\- Government-only system  
\- Dashboard-first SaaS

This is:  
\- Rice mill memory system  
\- Reconciliation engine  
\- Document vault  
\- Evidence-backed business assistant  
\- Voice/photo-first operating layer

\#\# Core User

Primary user:  
\- 50–60 year old rice mill owner  
\- Busy, tired, sometimes stressed  
\- Does not want complex software  
\- Comfortable speaking and taking photos  
\- Wants practical warnings and simple answers

Secondary users:  
\- Manager/operator  
\- Accountant/CA  
\- Family/business helper

\#\# Main Product Promise

“Owner sir just speaks or uploads a photo. The system remembers everything, checks mismatch, shows stock, warns about loss, and prepares CA reports.”

\#\# Main Business Objects

\- Mill  
\- User  
\- Party  
\- IKP/PPC Center  
\- Dealer  
\- Truck Sheet  
\- Truck Arrival  
\- Weighbridge Slip  
\- Moisture Test  
\- Paddy Lot  
\- Stock Event  
\- Milling Batch  
\- Rice Output  
\- Bran Output  
\- Broken Rice Output  
\- By-product Sale  
\- Expense  
\- Payment  
\- Document  
\- Correction Memory  
\- Alert  
\- Task  
\- Audit Log  
\- CA Export

\#\# Core Workflows

\#\#\# Paddy Inward

Inputs:  
\- Truck sheet  
\- Government app entry or screenshot/manual entry  
\- Physical bag count  
\- Weighbridge slip  
\- Moisture  
\- Source center  
\- Truck number

System:  
\- Extracts from document/photo  
\- Creates draft  
\- User confirms  
\- Marks missing fields  
\- Detects mismatch  
\- Creates paddy lot  
\- Updates stock only after confirmation

\#\#\# Farmer/Custom Milling

Inputs:  
\- Farmer name  
\- Paddy weight  
\- Milling output  
\- Rice returned  
\- Bran/broken settlement  
\- Charges

System:  
\- Tracks job  
\- Calculates output/settlement  
\- Stores document proof

\#\#\# Milling Batch

Inputs:  
\- Input paddy lots  
\- Input quantity  
\- Rice output  
\- Bran output  
\- Broken rice output  
\- Shortage/wastage

System:  
\- Calculates recovery  
\- Flags abnormal recovery  
\- Updates stock

\#\#\# By-product Sale

Inputs:  
\- Dealer  
\- Product: bran/broken rice/husk  
\- Quantity  
\- Rate  
\- Payment status  
\- Bill/photo

System:  
\- Calculates total  
\- Compares with historical rate  
\- Flags suspicious low sale  
\- Tracks receivable/payment

\#\#\# Expense

Inputs:  
\- Labour  
\- Transport  
\- Electricity  
\- Maintenance

System:  
\- Tracks monthly cost  
\- Allocates later to batches if needed  
\- Supports CA export

\#\#\# Documents

Inputs:  
\- Truck sheets  
\- Weighbridge slips  
\- Challans  
\- Bills  
\- Licenses  
\- Compliance documents

System:  
\- Stores original  
\- Classifies type  
\- Extracts fields  
\- Links to business object  
\- Makes searchable

\#\#\# CA Export

Inputs:  
\- Confirmed ledgers  
\- Expenses  
\- Sales  
\- Stock  
\- Documents

System:  
\- Generates monthly/yearly summary  
\- Exports Excel/PDF  
\- Locks/version records after export

\#\# Core Insight

The product should not expect perfect input.

Real users forget things.

Therefore:  
\- Save incomplete entries  
\- Create missing-data tasks  
\- Show data quality score  
\- Separate confirmed/pending/disputed numbers  
\- Never fake certainty

\#\# MVP Success Test

The first version is successful if it can reliably answer:

1\. What came today?  
2\. Which entries are incomplete?  
3\. Which truck sheets are missing?  
4\. How much confirmed stock exists?  
5\. What by-products were sold?  
6\. Which sale rate looks low?  
7\. What expenses were recorded this month?  
8\. What data can be sent to CA?  
