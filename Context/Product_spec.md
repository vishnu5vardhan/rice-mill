# **PRODUCT\_SPEC.md**

# **Rice Mill Intelligence System — Product Specification**

## **1\. Product Name**

Working name:

**Rice Mill Intelligence System**

Other possible names:

* Mill Memory  
* Rice Mill Operating Memory  
* Rice Mill Ledger AI  
* MillMind  
* Mill Saathi

Final name can be decided later. For now, use **Rice Mill Intelligence System** inside the codebase and documentation.

---

## **2\. One-Line Product**

A voice-first and photo-first rice mill operating memory that captures imperfect real-world data, confirms it with the owner, stores it in structured ledgers, detects missing or mismatched entries, explains stock/profit with evidence, learns from corrections, and exports clean reports for the CA.

---

## **3\. Product Philosophy**

This product should not feel like complex software.

The owner should feel:

* I speak.  
* I upload a photo.  
* I confirm.  
* The system remembers.  
* The system warns me when something is missing or wrong.  
* The system shows evidence when I ask questions.  
* The system helps me send clean details to my CA.

The owner should not feel:

* I need to fill long forms.  
* I need to constantly check dashboards.  
* I need to become a software operator.  
* AI is guessing my business.  
* I need to trust a black box.  
* I need to check every external app entry every time.

The product should be practical, boring, trusted, and useful.

Do not build a cool product.

Build a product that works for a tired rice mill owner.

---

## **4\. Core Product Insight**

Many rice mills do not fail because they lack dashboards.

They struggle because business memory is scattered across:

* Owner’s mind  
* Paper books  
* WhatsApp photos  
* Handwritten truck sheets  
* Weighbridge slips  
* Government/OPMS/PPS/app entries  
* Bills  
* Challans  
* Verbal updates  
* Accountant/CA files  
* Staff memory

The product must become the operating memory of the rice mill.

The core loop is:

Capture imperfect data  
→ create draft  
→ human confirmation/correction  
→ save structured event  
→ update ledger  
→ detect missing/mismatch  
→ answer with evidence  
→ export clean reports

---

## **5\. What This Product Is**

This product is:

* Rice mill operating memory  
* Voice/photo-first capture system  
* Document vault  
* Paddy inward tracker  
* Mismatch detection system  
* Stock ledger  
* Milling recovery tracker  
* By-product sale tracker  
* Expense tracker  
* Compliance reminder system  
* Evidence-backed AI assistant  
* CA export system

---

## **6\. What This Product Is Not**

This product is not:

* Generic ERP  
* Generic accounting software  
* Full Tally replacement  
* Full GST automation  
* Government-only paddy software  
* AI accountant  
* Dashboard-first SaaS  
* Prediction-first analytics tool  
* Fully autonomous decision system

AI should assist, extract, explain, and search.

AI should not silently create financial truth.

---

## **7\. Primary User**

### **Rice Mill Owner**

Typical profile:

* 50–60 years old  
* Runs operations through memory and experience  
* Busy and often under pressure  
* Comfortable speaking, calling, and taking photos  
* May not want to type long forms  
* Wants practical answers, not fancy dashboards  
* May forget to enter details when tired or busy  
* Needs simple evidence when there is doubt or dispute

Primary owner needs:

* “What came today?”  
* “What is pending?”  
* “Which truck has mismatch?”  
* “Where is that old challan?”  
* “How much stock do we have?”  
* “Did we sell bran at a low rate?”  
* “What should I send to CA?”  
* “Which license or document is pending?”

---

## **8\. Secondary Users**

### **Manager / Operator**

May enter:

* Truck arrival  
* Actual bag count  
* Moisture  
* Weighbridge details  
* Milling batch output  
* By-product sale details  
* Expenses

Needs:

* Simple entry screens  
* Pending task list  
* Correction flow  
* Upload documents quickly

### **Accountant / CA**

Needs:

* Monthly summary  
* Yearly summary  
* Sales ledger  
* Expense ledger  
* Stock summary  
* Document bundle  
* Excel/PDF export  
* Locked/versioned reports

### **Family / Business Helper**

May need:

* Read-only view  
* Document search  
* Alerts  
* Reports

---

## **9\. Core UX Principle**

Main actions should be:

Speak  
Upload Photo  
Ask  
Confirm

Everything else is secondary.

The app should not force the owner to check every workflow constantly.

It should work like a trusted memory:

* Capture data when available  
* Save incomplete entries when details are missing  
* Remind later  
* Surface alerts only when needed  
* Let owner check details when there is doubt  
* Make OPMS/government/app-related checking easy, not compulsory every time

---

## **10\. OPMS / Government App Behavior**

The rice mill may have to work with external government systems such as OPMS/PPS/Civil Supplies-related entries or screenshots.

Important product rule:

The Rice Mill Intelligence System should not assume the owner will always check the external app immediately.

Real behavior:

* Sometimes owner checks the app carefully.  
* Sometimes operator enters values manually.  
* Sometimes screenshot/photo is uploaded.  
* Sometimes details are checked only when doubt arises.  
* Sometimes mismatch is discovered later.  
* Sometimes the owner does not want to open that flow unless needed.

Therefore, the product should support three modes:

### **Mode 1 — Full Reconciliation**

Used when details are available.

Inputs:

* Government/OPMS/app entry  
* Truck sheet  
* Physical bag count  
* Weighbridge slip  
* Moisture

System compares:

* App quantity  
* Truck sheet quantity  
* Actual count  
* Weighbridge/net weight  
* Moisture  
* Source center  
* Truck number

Output:

* matched  
* incomplete  
* mismatch  
* disputed  
* ready for confirmation

### **Mode 2 — Lightweight Capture**

Used when owner does not want to check everything.

Inputs may be partial:

* Truck sheet photo  
* Voice note  
* Center name  
* Truck number  
* Approximate bag count  
* Moisture if available

System:

* Saves partial entry  
* Marks missing fields  
* Does not fake reconciliation  
* Creates pending tasks  
* Allows later completion

### **Mode 3 — Doubt Check**

Used when owner has suspicion or dispute.

Owner can ask:

* “Check this truck.”  
* “Do we have mismatch for this lot?”  
* “Show OPMS/app details for this truck.”  
* “What did truck sheet say?”  
* “What did we actually receive?”  
* “Which fields are missing?”

System shows:

* All available sources  
* Missing sources  
* Difference between values  
* Documents/photos  
* Confidence level  
* Recommended next action

This is important: the app should not nag the owner all day.

It should stay quiet until needed, but be strong when doubt comes.

---

## **11\. Core Business Areas**

The system should support these areas:

1. Paddy inward  
2. Government paddy / OPMS / IKP / PPC / Civil Supplies-style workflow  
3. Farmer/custom milling  
4. Truck sheet upload  
5. Weighbridge slip upload  
6. Moisture recording  
7. Physical bag count  
8. Paddy lot tracking  
9. Milling batch tracking  
10. Rice output  
11. Bran output  
12. Broken rice output  
13. By-product sales  
14. Labour expenses  
15. Transport expenses  
16. Electricity expenses  
17. Maintenance expenses  
18. Document vault  
19. Compliance reminders  
20. CA export

Government paddy is important, but the product must not become only government-paddy software.

---

## **12\. Data Truth Principle**

The system must always separate:

* AI-extracted data  
* User-confirmed data  
* System-calculated data  
* Estimated data  
* Missing data  
* Disputed data  
* Locked/exported data

AI can create drafts.

AI cannot silently create truth.

Every important field should store:

* value  
* source  
* status  
* confidence  
* user who confirmed/corrected  
* timestamp  
* linked document if available  
* audit trail

Example:

Field: bags  
Value: 462  
Status: user\_confirmed  
Source: physical\_count  
Confirmed by: owner  
Timestamp: 2026-05-29 18:42  
Linked document: truck\_sheet\_001.jpg

---

## **13\. Data Status Model**

Use these statuses across entries and fields:

| Status | Meaning |
| ----- | ----- |
| draft | Created but not confirmed |
| ai\_extracted | Extracted by AI from image/audio |
| user\_confirmed | Confirmed by human |
| system\_calculated | Derived by deterministic logic |
| incomplete | Missing required fields |
| disputed | Conflicting sources exist |
| estimated | Calculated with incomplete data |
| reconciled | Matched across required sources |
| locked | Locked after period close/export |
| exported | Sent to CA/reporting export |
| cancelled | Cancelled but not hard-deleted |
| adjusted | Corrected using adjustment event |

Never hard-delete important business data.

Use reversal or adjustment events.

---

## **14\. Evidence Rule**

No evidence, no confident answer.

Every AI answer must be backed by:

* confirmed ledger entries  
* source documents  
* deterministic calculation functions  
* audit logs  
* data completeness score  
* correction history if relevant

Bad answer:

Profit is low because bran rate dropped.

Good answer:

Profit appears lower because average bran sale rate dropped from ₹1,520/qtl to ₹1,360/qtl across 8 confirmed sale entries.

However, 3 milling batches are missing output data, so confidence is medium.

Owner-facing answers should be simple, but internally every answer must have evidence.

---

## **15\. Missing Data Principle**

The system should not fail when the owner forgets details.

If owner says:

Mallapur truck came today.

The system should not reject the entry.

It should save:

Known:  
\- Source: Mallapur  
\- Date: today

Missing:  
\- Truck number  
\- Bag count  
\- Moisture  
\- Truck sheet photo  
\- Weighbridge slip

Status:  
Incomplete

Task:  
Ask owner later / show in pending list

Missing data should create tasks, reminders, and data quality warnings.

---

## **16\. Confirmed / Pending / Disputed Numbers**

Do not show one fake final number when data is incomplete.

Example stock answer:

Confirmed paddy stock: 3,240 qtl  
Pending paddy stock: 280 qtl  
Disputed paddy stock: 64 qtl  
Possible total: 3,584 qtl

Example profit answer:

Confirmed monthly profit: ₹2.4 lakh  
Estimated monthly profit: ₹3.1 lakh  
Confidence: Medium  
Missing: 3 milling outputs and electricity bill

This is a non-negotiable product behavior.

---

## **17\. Correction Memory**

When owner corrects AI, system should remember.

Correction examples:

* AI reads wrong truck number  
* AI misclassifies document type  
* AI reads wrong center name  
* AI reads bad handwriting incorrectly  
* AI misreads bag count  
* AI flags low price but owner marks reason as acceptable  
* AI maps dealer name incorrectly

Every correction should store:

* original AI value  
* corrected value  
* field name  
* document type  
* document ID  
* user ID  
* mill ID  
* timestamp  
* confidence before correction  
* reason if provided

Correction memory should improve future extraction and suggestions.

Do not fine-tune in v1.

Use correction memory as retrieval/context/rules first.

---

## **18\. Product Intelligence Levels**

Build intelligence in levels.

### **Level 1 — Memory**

The system remembers and retrieves.

Examples:

* Find truck sheet.  
* Find bill.  
* Find challan.  
* Show old dealer sale.  
* Show missing documents.

### **Level 2 — Calculation**

The system calculates from confirmed data.

Examples:

* Stock  
* Bran stock  
* Broken rice stock  
* Paddy inward total  
* Expenses  
* Recovery percentage  
* Monthly income/cost

### **Level 3 — Reconciliation**

The system matches conflicting/related sources.

Examples:

* Truck sheet vs physical count  
* Truck sheet vs OPMS/app entry  
* Physical count vs weighbridge  
* Paddy input vs rice output  
* By-product produced vs sold  
* Sale quantity vs payment

### **Level 4 — Pattern Detection**

The system finds abnormal patterns.

Examples:

* Low recovery  
* High moisture  
* Repeated mismatch from same center  
* Low bran/broken sale rate  
* Cost per quintal increase  
* Missing documents before deadline

### **Level 5 — Explanation**

The system explains business movement.

Examples:

* Why profit appears low  
* Where stock mismatch happened  
* Which dealer rate seems low  
* Which center has repeated shortage  
* Which data is missing before CA export

Do not jump directly to Level 5\.

---

## **19\. First MVP Scope**

The first MVP should prove the core loop:

Photo/voice input  
→ AI draft  
→ owner confirmation  
→ correction memory  
→ business event  
→ ledger update  
→ missing/mismatch detection  
→ evidence-backed answer

First supported workflows:

1. Truck sheet upload → AI extract → confirm → paddy inward draft  
2. Voice paddy inward → confirm → save  
3. By-product sale entry → compare with historical rate  
4. Expense entry → monthly cost tracking  
5. Document search → find old bills/challans/truck sheets  
6. Ask simple questions → answer with evidence  
7. CA export → basic Excel/PDF summary

---

## **20\. MVP Non-Goals**

Do not build these in v1:

* Full ERP  
* Full accounting system  
* GST filing  
* Full Tally integration  
* Automatic government portal confirmation  
* Complex dashboards  
* Prediction model  
* Custom trained handwriting model  
* Multi-mill SaaS admin  
* Play Store mobile app  
* Autonomous financial decisions

These may come later.

---

## **21\. First Screens**

The first product should have only a few simple screens.

### **Home**

Main actions:

* Speak  
* Upload photo  
* Ask  
* Pending tasks  
* Alerts

### **Confirm Entry**

Shows:

* AI extracted fields  
* confidence  
* missing fields  
* edit option  
* confirm/save button

### **Documents**

Shows:

* uploaded documents  
* document type  
* linked entry  
* search  
* missing documents

### **Paddy / Stock**

Shows:

* confirmed stock  
* pending stock  
* disputed stock  
* lots  
* linked documents

### **By-product Sales**

Shows:

* bran sales  
* broken rice sales  
* dealer  
* quantity  
* rate  
* low-rate alerts

### **Expenses**

Shows:

* labour  
* transport  
* electricity  
* maintenance  
* monthly totals

### **Ask**

Owner can ask:

* How much paddy came today?  
* Which entries are incomplete?  
* Show truck sheet for this truck.  
* How much bran sold this month?  
* Which sales had low rate?  
* What expenses are recorded this month?  
* What can I send to CA?

### **CA Export**

Shows:

* monthly summary  
* yearly summary  
* missing data before export  
* Excel export  
* PDF export  
* document bundle export

---

## **22\. Paddy Inward Workflow**

### **Inputs**

Possible inputs:

* Voice entry  
* Truck sheet photo  
* Government/OPMS/app screenshot/manual entry  
* Physical bag count  
* Weighbridge slip  
* Moisture  
* Center name  
* Truck number

### **Flow**

Input received  
→ classify input  
→ extract fields  
→ create draft paddy inward record  
→ show confirmation  
→ user confirms/corrects  
→ save correction memory  
→ create paddy lot  
→ create stock event if allowed  
→ create missing tasks if needed  
→ run mismatch checks

### **Status Outcomes**

| Outcome | Meaning |
| ----- | ----- |
| complete | Required data present |
| incomplete | Some required data missing |
| disputed | Conflicting data found |
| confirmed | Human accepted entry |
| reconciled | Required sources match |
| blocked | Cannot proceed without critical field |

---

## **23\. OPMS / App Checking UX**

The product should support OPMS/app-related details without making them annoying.

Possible flows:

### **Manual App Entry**

User enters:

* app quantity  
* app bags  
* app date  
* app center  
* app truck number

### **Screenshot Upload**

User uploads screenshot.

System:

* classifies as app/government screenshot  
* extracts fields  
* links to paddy lot  
* compares with truck sheet / actual count

### **Doubt-Based Check**

Owner asks:

Check this truck against app details.

System shows:

Truck: TS09AB1234

Truck sheet:  
\- 480 bags

App entry:  
\- Not uploaded / not entered

Actual count:  
\- 462 bags

Status:  
Cannot fully reconcile. App details missing.

Suggested action:  
Upload app screenshot or enter app quantity.

### **Quiet Mode**

If owner does not check app details:

System should still save the entry as incomplete and not block all work.

It should show a pending task:

App details missing for 3 government paddy lots.

---

## **24\. By-product Sale Workflow**

Inputs:

* dealer  
* product type: bran / broken rice / husk  
* quantity  
* rate  
* payment status  
* bill/photo

System:

* calculates total  
* compares rate with historical average  
* flags suspicious low rate  
* tracks payment status  
* links bill/photo  
* updates by-product stock

Example alert:

Bran sale rate looks low.

Today rate: ₹1,350/qtl  
Your 30-day average: ₹1,520/qtl  
Difference: ₹170/qtl  
Quantity: 50 qtl  
Possible impact: ₹8,500

Confirm if this was intentional.

Owner can mark reason:

* low quality  
* wet bran  
* urgent sale  
* trusted dealer  
* mistake  
* other

Reason is saved for future learning.

---

## **25\. Milling Batch Workflow**

Inputs:

* input paddy lot(s)  
* input quantity  
* rice output  
* bran output  
* broken rice output  
* shortage/wastage  
* date

System:

* calculates recovery percentage  
* updates stock  
* flags abnormal recovery  
* links output to source paddy lots  
* marks incomplete if output data missing

Example:

Input paddy: 100 qtl  
Rice output: 66 qtl  
Bran output: 8 qtl  
Broken rice output: 4 qtl  
Shortage/wastage: 22 qtl  
Recovery: 66%

If output is missing:

Milling batch started but output not recorded.  
Recovery cannot be calculated.

---

## **26\. Expense Workflow**

Expense categories for v1:

* labour  
* transport  
* electricity  
* maintenance

Inputs:

* amount  
* date  
* category  
* bill/photo  
* notes  
* linked batch/month if available

System:

* tracks monthly cost  
* supports CA export  
* later supports cost-per-quintal and batch allocation

---

## **27\. Document Vault**

Supported document types:

* truck sheet  
* weighbridge slip  
* moisture/quality note  
* government/app screenshot  
* delivery challan  
* sale bill  
* by-product sale bill  
* transport bill  
* labour note  
* electricity bill  
* maintenance bill  
* license/compliance document  
* CA/accounting document  
* unknown document

Every document should have:

* original file  
* document type  
* upload date  
* linked business object  
* extracted fields  
* confidence  
* user corrections  
* search keywords  
* audit trail

---

## **28\. Compliance and Reminder System**

The product should track reminders for:

* license renewal  
* pollution board-related document  
* FSSAI/license-related document if applicable  
* challan due dates  
* CA report deadlines  
* pending documents  
* missing government/app details  
* pending CMR/challan items if added later

Reminder behavior:

* do not spam  
* show pending list  
* daily/weekly summary  
* urgent alerts when deadline is near

---

## **29\. CA Export**

CA export should be part of the product from early stage.

CA export should include:

* monthly income summary  
* by-product sales  
* expense summary  
* stock opening/closing  
* receivables/payments if tracked  
* document links or document bundle  
* yearly summary  
* Excel export  
* PDF summary

Before export, system should show:

Data quality before CA export:

Complete:  
\- By-product sales  
\- Electricity expenses

Missing:  
\- 3 transport bills  
\- 2 milling output entries  
\- 1 sale bill photo

Confidence:  
Medium

After export:

* create export snapshot  
* mark exported records  
* lock or version records  
* future edits create adjustment events

---

## **30\. Ask/Search Behavior**

The owner should be able to ask simple questions.

Examples:

How much paddy came today?  
Which truck entries are incomplete?  
Show truck sheet for TS09AB1234.  
How much bran sold this month?  
Which bran sale rate was low?  
What expenses are recorded this month?  
What documents are missing?  
What can I send to CA?  
Why is profit lower this month?

The system should answer with:

* simple explanation  
* confirmed/pending/disputed separation  
* missing data warning  
* source entries/documents  
* confidence level

---

## **31\. Alert Types**

Initial alert types:

* missing truck sheet  
* missing actual bag count  
* missing moisture  
* missing weighbridge slip  
* truck sheet vs physical count mismatch  
* OPMS/app details missing  
* OPMS/app vs truck sheet mismatch  
* negative stock  
* milling output missing  
* abnormal recovery  
* low by-product sale rate  
* unpaid by-product sale  
* missing expense bill  
* CA export incomplete  
* compliance reminder

Alerts should be actionable.

Bad alert:

Data missing.

Good alert:

Moisture missing for Mallapur truck TS09AB1234. Add now or remind later?

---

## **32\. Data Quality Score**

Each lot, month, and report should have a data quality/completeness score.

Example lot:

Lot GOV-042  
Completeness: 72%

Present:  
\- Truck sheet  
\- Truck number  
\- Center  
\- Date

Missing:  
\- Actual bag count  
\- Moisture  
\- App details

Status:  
Incomplete

Example monthly report:

May 2026 data quality:  
\- Paddy inward: 82%  
\- Milling output: 70%  
\- By-product sales: 92%  
\- Expenses: 64%

Profit confidence: Medium

---

## **33\. Trust and Safety Rules**

The system must not:

* silently edit confirmed entries  
* delete records permanently  
* guess unreadable handwriting as truth  
* hide missing data  
* mix government and farmer/custom stock casually  
* generate profit without calculation  
* answer confidently without evidence  
* finalize risky/government actions automatically

The system must:

* store original documents  
* store corrections  
* show audit trail  
* show missing fields  
* separate confirmed/pending/disputed  
* use deterministic calculations  
* allow manual correction  
* create adjustment records for old locked data

---

## **34\. Design Style**

The design should be:

* mobile-first  
* clean  
* calm  
* simple  
* high contrast  
* big touch targets  
* minimal text  
* simple Telugu/Hindi/English-ready wording later  
* not dashboard-heavy  
* alerts-first  
* evidence-available-on-demand

The app should feel like:

A smart assistant \+ business memory

Not:

A corporate ERP dashboard

---

## **35\. MVP Success Criteria**

The MVP is successful if one real rice mill can use it for real entries and answer:

1. What came today?  
2. Which entries are incomplete?  
3. Which truck sheets are missing?  
4. Which app/government details are missing?  
5. Which lot has mismatch?  
6. How much confirmed stock exists?  
7. What by-products were sold?  
8. Which sale rate looks low?  
9. What expenses were recorded this month?  
10. What data can be sent to CA?

The MVP is not successful just because screens exist.

It is successful only if the capture-confirm-ledger-evidence loop works.

---

## **36\. Build Priority**

Priority order:

1. Correctness  
2. Recoverability  
3. Auditability  
4. Owner trust  
5. Simple UX  
6. Fast pilot  
7. Clean abstraction  
8. Visual polish

Visual polish matters only after the core loop works.

---

## **37\. Open Questions**

These need to be answered during field discovery:

1. What exact fields exist in the truck sheet?  
2. What exact fields exist in OPMS/app entries or screenshots?  
3. Who usually enters/confirms government app details?  
4. What happens when there is a mismatch?  
5. What is the actual moisture recording process?  
6. How are lots named today?  
7. How are milling batches recorded today?  
8. How are bran/broken rice sales recorded today?  
9. What does the CA ask for yearly?  
10. Which documents are mandatory to keep?  
11. Which fields are critical and which are optional?  
12. What language should the owner interface use first?  
13. What is the minimum daily summary the owner wants?  
14. Who is allowed to edit confirmed entries?  
15. When should data be locked?

---

## **38\. First Codex Task After This Spec**

After reading this file along with AGENTS.md, PROJECT\_CONTEXT.md, BUILD\_PLAN.md, and AI\_BEHAVIOR.md, Codex should produce:

1. MVP database schema  
2. First migration plan  
3. First 5 screens  
4. First API routes  
5. First AI extraction schemas  
6. Risk/assumption list

Do not start coding before these are clear.

