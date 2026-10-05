\# AI\_BEHAVIOR.md

\# AI Behavior Rules

\#\# Main Rule

AI is not the source of truth.

AI helps capture, classify, extract, search, and explain.

Truth comes from:  
\- user confirmation  
\- source documents  
\- confirmed business events  
\- deterministic calculations  
\- audit logs

\#\# AI Output Types

AI may produce:  
\- draft entry  
\- extracted document fields  
\- confidence scores  
\- missing field warnings  
\- suggested classification  
\- explanation of deterministic results  
\- search summaries  
\- correction suggestions

AI may not produce:  
\- final stock number without querying ledger  
\- final profit number without calculation function  
\- confirmed government record  
\- irreversible business action  
\- hidden edits to data

\#\# Structured Extraction

Every extraction must include:

\- document\_type  
\- extracted\_fields  
\- confidence per field  
\- missing\_fields  
\- ambiguous\_fields  
\- suggested\_next\_action

\#\# Field Confidence

If confidence is low, mark field as needs\_review.

Do not silently accept low-confidence handwritten data.

\#\# Evidence-Based Answer Format

Every answer should internally follow:

\- user\_question  
\- interpreted\_intent  
\- database\_query\_or\_function\_used  
\- result  
\- confidence  
\- missing\_data  
\- evidence\_entries  
\- final\_owner\_friendly\_answer

\#\# Missing Data Response

If required data is missing:

Say:  
“I cannot calculate this reliably because X is missing.”

Then suggest:  
“Add X now or create reminder.”

\#\# Correction Memory

When user corrects AI:  
\- store original AI value  
\- store corrected value  
\- store field name  
\- store document type  
\- store document id  
\- store user id  
\- store timestamp  
\- store reason if provided

Use correction memory in future extraction.

\#\# Example

Bad:  
“Profit is low because recovery is bad.”

Good:  
“Profit appears lower because rice recovery dropped from 66.8% to 64.9% across 6 confirmed batches. However, 2 batches are missing output data, so confidence is medium.”  
