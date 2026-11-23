<!-- Titolo nel formato Conventional Commits, es. "feat(quest): add mission draft endpoint". Base: development. -->

## Cosa e perché

<!-- Il problema risolto e la scelta fatta. Se hai scartato un'alternativa tecnica, dilla in una riga. -->

**Requisito:** R__ · **Issue:** Closes #__

## Come provarlo

<!-- Passi, richieste HTTP o schermate (UI: screenshot desktop e mobile). -->

## Checklist (Definition of Done)

- [ ] Rispetta `docs/MANIFESTO.md`; se lo cambia, c'è l'ADR e l'approvazione di tutti
- [ ] Test unit/integrazione/E2E pertinenti aggiunti e verdi (anche i casi 401/403/400)
- [ ] Nessun segreto, nessun obiettivo segreto o dato personale esposto in risposte, log o eventi
- [ ] Contratti aggiornati nella stessa PR: `openapi.json`, migrazioni Prisma, client generato
- [ ] README e documentazione (UML/SRS) aggiornati se cambia il comportamento
- [ ] PR piccola (≈ 400 righe escluse quelle generate) e un collega sa spiegare la modifica
