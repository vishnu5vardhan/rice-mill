# BYPRODUCT_ALIASES.md

# Telangana Rice Mill By-Product Alias Context

These aliases help the AI and draft screens understand local rice mill shorthand.

Important rule:
- Aliases may create draft suggestions.
- Aliases must not create confirmed ledger truth without user confirmation.

## Canonical Product Mapping

| Canonical product | Local / slang aliases |
| --- | --- |
| `bran` | thoudu, thodu, thoodu, thavudu, tavudu, tavdu, tavida, rice bran |
| `broken_rice` | param, para, nuka, nooka, nookalu, nukulu, broken, broken rice, rice brokens |
| `husk` | unka, uka, ooka, ookka, pottu, husk, rice husk, paddy husk |

## Expected Behavior

If a rough note says:

```text
30,000 - Thoudu
20,000 - Param
10,000 - Unka
```

The app should infer:

```text
Thoudu -> bran
Param -> broken_rice
Unka -> husk
```

The app may then offer `Create sale draft`, prefilled with the inferred product.

The user must still confirm missing sale details such as quantity, rate, dealer, date, and payment status before the ledger is updated.

## Notes

Spelling can vary by handwriting, village, and language mixing. Treat this as correction-memory context and keep improving it from owner corrections.
