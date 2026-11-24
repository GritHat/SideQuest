# SideQuest · Manifesto architetturale

> **Stato:** approvato · **Versione:** 1.1 · **Data:** 24/11/2026
> **Fonti:** traccia ufficiale *SideQuest – Progetto Integrato 2026-2027* (prevale sempre); *SideQuest – Scelte architetturali* Draft v1.0 (le sue proposte qui diventano decisioni).
> **Modalità:** progetto integrato (TECWEB + INGSW) · gruppo di 3 · **percorso anticipato** · pacchetti **D** (R16–R18) ed **E** (R19–R21) · 12 requisiti.

Questo documento fissa le scelte **definitive** del progetto. Codice, PR, documenti e review vi si devono attenere. Una scelta si cambia **solo** con la procedura del §10: non esistono eccezioni "temporanee".

---

## 0. Regole inviolabili

1. **La traccia ufficiale prevale** su questo manifesto e su qualsiasi altro documento. Nel dubbio si rilegge la traccia, non si interpreta.
2. **Tre microservizi applicativi** (`identity`, `quest`, `notifications`), una SPA e un gateway. Non si aggiungono servizi e non se ne fondono.
3. **Ogni servizio possiede i propri dati.** Nessuna query, join o foreign key verso il database di un altro servizio. Tra servizi si comunica solo con HTTP (contratto OpenAPI) o eventi (contratto versionato).
4. **Il server è autorevole.** Timer, segreti, punti, progressi e permessi si decidono sul server. Gli obiettivi segreti non lasciano mai il server prima dell'accettazione: né nel JSON, né negli eventi, né nei log.
5. **Gli schemi zod sono l'unica fonte di verità.** Da essi derivano validazione, OpenAPI, client generato e schemi degli eventi. Nessun DTO scritto a mano in parallelo.
6. **Ogni input esterno viene validato** (`StandardSchemaValidationPipe` globale). Ogni endpoint non pubblico richiede autenticazione, e ogni risorsa ha una policy di accesso verificata nel servizio che la possiede.
7. **Non si fa merge senza CI verde**, review approvata e conversazioni risolte. Nessun push diretto su `main` o `development`.
8. **Ogni modifica a contratti (OpenAPI, eventi) o schema DB** passa da una PR che aggiorna anche contratto, migrazione, client generato e test, nella stessa PR.
9. **Nessun segreto nel repository**, nessuna dipendenza installata né file compilato nelle consegne.
10. **Ogni membro sa spiegare e modificare ogni parte** (traccia §3): niente codice che solo il suo autore capisce.

---

## 1. Calendario vincolante (traccia §6, B.4, C.7)

| Scadenza | Cosa | Dove |
|---|---|---|
| **ven 04/12/2026** | INGSW: Documento di Specifica dei Requisiti (anticipata: ≥ 1 caso d'uso full-dressed con mockup) | GigaMail + email `[INGSW2627] Consegna anticipata <ID>` |
| **ven 18/12/2026** | TECWEB: scheda sintetica, README, codice sorgente del **backend** (versione preliminare) | GigaMail + email `[TECWEB2627] Consegna anticipata <ID>`, archivio `TW_<ID>.zip` |
| **entro 31/03/2027** | Consegna **e discussione** finali di entrambi gli esami | `TW_<ID>.zip`; `SWE_<ID>.pdf` + `SWE_<ID>.zip` |

Il documento *Scelte architetturali* (§1.2) è **superato** su questi punti: le consegne intermedie sono obbligatorie per il percorso anticipato, la discussione deve avvenire entro marzo e la consegna avviene via GigaMail, non tramite Teams.

**Code freeze:** due settimane prima della prima sessione di discussione utile di marzo 2027. Dopo il freeze si accettano solo fix.

---

## 2. Topologia (ADR-01: **A, tre microservizi**)

| Componente | Responsabilità | Possiede |
|---|---|---|
| `identity` | Account, credenziali, sessioni/refresh, ruoli, profilo; emette access token e pubblica la JWKS | DB `identity`: `users`, `sessions` (famiglie di refresh token), `refresh_tokens`, `outbox` |
| `quest` | Missioni, obiettivi, tentativi, timer, prove e verifica, XP; **modulo Discovery** (pacchetto E: percorsi R19, vicinanza R20, arricchimento esterno R21) | DB `quest` (PostGIS): `missions`, `objectives`, `attempts`, `evidence`, `evidence_blobs`, `reviews`, `trails`, `trail_steps`, `enrichments`, `outbox`, `user_profiles` (proiezione) |
| `notifications` | Inbox persistente e SSE; **modulo Engagement** (pacchetto D: ledger XP, classifiche R16, badge R17, statistiche R18) | DB `notifications`: `notifications`, `inbox`, `xp_ledger`, `badge_awards`, `user_stats`, `user_profiles` (proiezione) |
| `web` | SPA React | nessun dato autorevole |
| `gateway` | Caddy: same-origin, routing, TLS; **nessuna logica di dominio** | nessun dato |

- **Pacchetto D dentro `notifications`.** Le classifiche sono proiezioni di eventi (CQRS selettivo, ADR-16), e badge e notifiche nascono dagli stessi eventi. Niente quarto servizio.
- **Pacchetto E dentro `quest`.** Percorsi e distanze lavorano sulle missioni e sulla loro geografia: dividerli richiederebbe join tra servizi.
- In locale c'è **un solo server PostgreSQL** con tre database e tre utenti distinti, ognuno con permessi solo sul proprio database (documento §4.1).

## 3. Comunicazione

| Interazione | Decisione |
|---|---|
| SPA → servizi | REST/JSON via gateway sullo stesso dominio: `/api/identity/*`, `/api/quests/*`, `/api/notifications/*`, `/.well-known/jwks.json` |
| Autenticazione per richiesta | Access token JWT firmato da `identity`, verificato **localmente** da ogni servizio tramite JWKS (cache e rotazione per `kid`) |
| Eventi | **NATS JetStream** (ADR-04: A) con **transactional outbox** nel servizio produttore e **inbox idempotente** (`eventId` univoco) nel consumer. Client ufficiale `@nats-io/jetstream` con consumer durable pull, **non** il transporter NATS di Nest |
| Real time verso la SPA | **SSE** (ADR-11: A) con `Last-Event-ID`; alla riconnessione si recupera il gap dall'inbox persistente; polling come fallback tramite TanStack Query |
| Consistenza | Transazione ACID locale + outbox (ADR-15: A). **Nessuna saga e nessun 2PC.** Un evento può ritardare la UI, mai cambiare l'esito di un comando già confermato |

**Catalogo eventi v1** (nome `<servizio>.<aggregato>.<fatto>.v<N>`):
`identity.user.registered`, `identity.user.profile-changed`, `identity.user.status-changed`, `quest.mission.published`, `quest.mission.withdrawn`, `quest.attempt.accepted`, `quest.attempt.finished` (esito, categoria, XP, durata), `quest.attempt.invalidated`, `quest.evidence.reviewed`.

Busta dell'evento come nel documento §12.2 (`eventId` UUIDv7, `occurredAt`, `producer`, `aggregateId`, `aggregateVersion`, `correlationId`, `payload`). **Mai** password, token, email od obiettivi segreti negli eventi. I nickname arrivano agli altri servizi tramite `identity.user.*` e sono salvati nella proiezione locale `user_profiles`.

## 4. Decisioni per area

| ADR | Tema | Scelta definitiva | Scartate |
|---|---|---|---|
| 01 | Topologia | **3 microservizi** + SPA + gateway | 5–8 servizi; monolite |
| 02 | Backend | **NestJS 12** (ESM, adapter **Express**), TypeScript strict; controller sottili → use case → dominio puro → adapter (documento §4.2) | Spring Boot; Fastify/Express puri |
| 03 | API | **REST + OpenAPI 3.1** generato con `@nestjs/swagger` dagli schemi **zod** (`standardSchemaConverter`); spec salvata in `packages/contracts`; **Orval** genera hook TanStack Query e mock MSW in `packages/api-client` | GraphQL; tRPC; class-validator/DTO a mano |
| 04 | Messaggistica | **NATS JetStream** + outbox + inbox | RabbitMQ; Kafka |
| 05 | Persistenza | **PostgreSQL 17 + PostGIS 3.5**, un database per servizio | MongoDB; SQLite |
| 06 | ORM | **Prisma 7.x** con driver adapter `pg`, migrazioni versionate per servizio, accesso solo tramite repository. SQL esplicito (TypedSQL/`$queryRaw`) per PostGIS, lock e update condizionali | Drizzle; TypeORM |
| 07 | SPA | **React 19 + Vite + TypeScript strict + React Router 7 + TanStack Query 5 + React Hook Form + zod** (gli stessi schemi dei contratti); organizzazione per feature | Vue; Angular |
| 08 | UI e mappe | **Tailwind CSS 4 + shadcn/ui** con design token; **React Leaflet 5 + Leaflet 1.9** con tile OSM e attribuzione visibile; vista a elenco come fallback senza tile | MUI; CSS modules; MapLibre |
| 09 | Stato SPA | **TanStack Query** per lo stato server; invalidazione su mutazioni ed eventi SSE; nessuno stato autorevole nel browser | Redux; fetch + useEffect |
| 10 | Identità | §5 | Keycloak/OIDC; JWT senza sessioni |
| 11 | Real time | **SSE** + inbox + fallback polling | WebSocket; solo polling |
| 12 | Prove fotografiche | **Postgres (`evidence_blobs`, `bytea`) dietro `EvidenceStoragePort`**: massimo 5 MB, MIME verificato sui byte iniziali, lettura solo per gli autorizzati. Salvataggio atomico con i metadati, quindi niente oggetti orfani | **MinIO** (Community Edition senza immagini ufficiali e non più mantenuta da fine 2025); filesystem |
| 13 | Test | §7 | Solo E2E; solo unit |
| 14 | Repository, CI, deploy | **Monorepo pnpm workspaces + Turborepo**; **Docker Compose** (obbligatorio per INGSW) con healthcheck e seed; **GitHub Actions**; **SonarQube Cloud** per il backend. Flusso dei branch: ADR-19 (§8) | Kubernetes; solo `npm run dev`; squash verso `development` |
| 15 | Consistenza | Transazione locale + outbox | Saga; 2PC |
| 16 | CQRS | **Selettivo**: proiezioni in Engagement (classifiche, statistiche) e `user_profiles`; nessun event sourcing | Event sourcing; CRUD solo sincrono |
| 17 | Gateway | **Caddy** come reverse proxy sottile; preserva `Host`, imposta `X-Forwarded-For` | BFF; service mesh |
| 18 | Osservabilità | **Log JSON** con il logger integrato di Nest, `requestId`/`correlationId` propagati da HTTP fino agli eventi. OpenTelemetry e Jaeger fuori scope; si valutano solo dopo G7 con un nuovo ADR. **Via `@nestjs/observe` e `AGENTS.md`** (SaaS esterno) | OTel subito; osservabilità gestita |

**Pacchetto E, scelte specifiche:**
- R20: posizione `geography(Point,4326)`, ordinamento con `ST_Distance` e filtro con `ST_DWithin`. La posizione di riferimento arriva dalla Geolocation API del browser, previo consenso; in alternativa da un punto scelto sulla mappa (sempre disponibile).
- R21: API esterna **Wikipedia REST** (`page/summary`, geosearch), dietro `EnrichmentPort`, con timeout 1.500 ms, al massimo un retry e risultato salvato in `enrichments` con `status`, `fetchedAt`, fonte e attribuzione (CC BY-SA). Se il servizio non risponde: `status=unavailable` e la missione resta pienamente utilizzabile.
- R19: i percorsi sono sequenze ordinate di missioni; la tappa successiva si sblocca quando la precedente risulta `SUCCEEDED`.

**Pacchetto D, scelte specifiche:**
- Il ledger XP è **append-only**, con chiave `eventId`. Un'invalidazione genera una riga di compensazione negativa, mai una modifica o cancellazione.
- Le classifiche si calcolano con query SQL a finestra sul ledger, per intervallo temporale e con la posizione dell'utente. Niente Redis.
- I badge sono regole dichiarative versionate (codice + condizione verificabile) valutate a ogni evento rilevante. L'assegnazione è idempotente.
- Le statistiche sono una proiezione per utente; visibili solo al proprietario, salvo classifiche pubbliche per nickname.

## 5. Sicurezza e identità (ADR-10)

- **Password:** Argon2id; lunghezza 12–128; confronto con hash fittizio per tempi costanti.
- **Sessione:** refresh token opaco con rotazione e rilevamento del riuso. È salvato **in Postgres** (`sessions` + `refresh_tokens`, solo hash) tramite un `RefreshTokenStore` di `@nestjs/authentication` che supera `authenticationStoreContract({ concurrent: true })`. **Niente Redis.**
- **Access token:** JWT **RS256** con `kid`, `iss` e `aud` obbligatori, **TTL 10 minuti**. Claim: `sub`, `roles`, `amr`, `jti`. **Niente email né dati personali.**
- **Cookie:** `HttpOnly`, `SameSite=Strict`, `Secure` in produzione.
  - `sq_access`: `Path=/api`, durata pari al TTL del token.
  - `sq_refresh`: `Path=/api/identity`, durata 30 giorni.
  - Nessun token accessibile da JavaScript o salvato in `localStorage`.
- **CSRF:** `app.enableCsrfProtection()` di Nest (Fetch Metadata e `Origin`) in **tutti** i servizi, con in più `SameSite=Strict`. Sostituisce il "CSRF token" previsto dall'ADR-10 del documento, che diventa superato.
- **Header di sicurezza:** `app.useSecurityHeaders()` in tutti i servizi.
- **Revoca:** logout (basato sul solo cookie di refresh); `revokeAll` alla sospensione, alla disattivazione e alla cancellazione dell'account. Un access token resta valido fino alla scadenza naturale (al massimo 10 minuti): limite accettato e documentato.
- **Autorizzazione:** i `roles` del token servono solo come guard grossolano. Le policy sulle risorse (autore, partecipante, moderatore) si verificano sempre nel servizio proprietario, sui suoi dati.
- **Rate limit:** `@nestjs/throttler` con `trust proxy` attivo dietro il gateway; limite stretto su login, registrazione e refresh.
- **Configurazione:** `@nestjs/config` con schema zod; se la configurazione non è valida il servizio non parte. Niente `process.env` nel codice applicativo.

## 6. Convenzioni di API e codice

- **Errori:** RFC 9457 `application/problem+json`, con lo stesso formato in tutti i servizi. Codici: 400, 401, 403, 404, 409, 410, 422, 429, 503.
- **Path:** prefisso globale `/api/<servizio>` impostato nel servizio stesso; risorse al plurale; le transizioni di stato sono azioni esplicite (`POST /missions/:id/publish`).
- **Idempotenza:** header `Idempotency-Key` sui comandi critici (accettazione, invio prove, review).
- **Paginazione:** `limit` (massimo 50) e `cursor` per le liste che crescono, cioè notifiche e ledger; `limit`/`offset` per i cataloghi.
- **Identificativi:** UUIDv7. **Tempo:** UTC ISO-8601, porta `Clock` iniettata (vietato chiamare `new Date()` nel dominio).
- **DTO:** viste pubbliche e private sempre distinte (`MissionPublicView` ≠ `MissionParticipantView`).
- **Linguaggio:** codice, commit e nomi in inglese; documentazione d'esame in italiano.
- **Qualità:** TypeScript strict; **oxlint** (type-aware) + **Prettier**; nessun `any` non motivato.

## 7. Test (ADR-13)

| Livello | Strumenti | Obbligo |
|---|---|---|
| Unit / dominio | **Vitest**, repository finti, `FakeClock` | Ogni use case e policy. INGSW: ≥ 2 metodi non banali con ≥ 2 parametri, progettati per classi di equivalenza e valori limite |
| Integrazione API | **Vitest + Supertest + Testcontainers** (Postgres/PostGIS, NATS reali) | Ogni endpoint: caso positivo, 401/403, input non valido |
| Contratti | Confronto OpenAPI, test di contratto degli store, schemi degli eventi | Ogni PR che tocca API o eventi |
| E2E | **Playwright** + `@axe-core/playwright` | ≥ 15 scenari (catalogo E01–E15 + EP-D + EP-E del documento §8.2), almeno uno negativo/autorizzativo per requisito |

Gate di CI per il merge: typecheck, lint, unit, integrazione, diff OpenAPI, E2E smoke. Clock iniettato, mai `sleep` reali. Test plan INGSW su R04 (documento §8.4).

## 8. Repository e flusso di lavoro

```
apps/web · apps/services/{identity,quest,notifications}
packages/{contracts,api-client,messaging,tooling}
infra/{compose.yaml,caddy/} · tests/e2e · docs/{adr,requirements,architecture,testing,ux,delivery}
```

- `packages/messaging` contiene **solo** infrastruttura di protocollo (busta degli eventi, relay outbox, consumer inbox). Nessuna logica di dominio.
- **Branch (ADR-19):** `main` (protetto, solo checkpoint) ← `development` (protetto, integrazione) ← `feature/*`, `fix/*`, `docs/*`. **Merge commit** sia verso `development` sia verso `main`; squash e rebase sono disabilitati. I branch di lavoro restano attivi dopo il merge finché il requisito è aperto, non si riscrivono (niente rebase né force push) e si riallineano con `git merge origin/development`. Ogni commit segue Conventional Commits. `development` entra in `main` solo ai checkpoint e quando sono raggiunti i quality goal, con un tag per ogni checkpoint. Le regole operative sono nella *Guida Git e GitHub*.
- **PR:** al massimo circa 400 righe escluse quelle generate; requisito Rxx nel titolo o nella descrizione; Definition of Done del documento §7.4.
- **Avvio:** `docker compose up` avvia tutto, migrazioni e seed compresi. Account demo: `admin`, `moderator`, `author`, `explorer`.
- **Versioni:** Node 24 LTS; pnpm fissato in `packageManager`; dipendenze con lockfile; nessun aggiornamento di major dopo l'1/03/2027. Le versioni esatte sono in `docs/tech-stack.md`.

## 9. Assunzioni di dominio di partenza (SRS: modificabili solo con ADR)

A-02 un tentativo per utente e missione · A-03 conta l'orario di ricezione sul server; `t = deadline` è **fuori tempo** · A-05 `ABANDONED` è definitivo, senza XP · A-06 la scadenza si verifica a ogni lettura e scrittura, più un job periodico · A-07 pubblico solo il nickname · A-08 XP fissi per versione pubblicata, assegnati una sola volta · A-09 soft delete / invalidazione con compensazione · A-14 l'arricchimento esterno non è mai bloccante.

## 10. Come si modifica questo manifesto

1. Si apre un **ADR** in `docs/adr/` con contesto, alternative, decisione, conseguenze e una prova verificabile (spike, test, misura).
2. Lo approvano **tutti e tre** i membri, nella PR che aggiorna sia l'ADR sia questo file (`CODEOWNERS`: tutti).
3. Si incrementa la versione del manifesto e si annota la modifica qui sotto.

Una PR che viola il manifesto senza questo percorso **non si approva**, anche se funziona.

| Versione | Data | Modifica |
|---|---|---|
| 1.0 | 22/11/2026 | Prima versione: scelte definitive dalle opzioni del documento *Scelte architetturali* Draft v1.0, riallineate alla traccia ufficiale |
| 1.1 | 24/11/2026 | ADR-19: merge commit al posto dello squash verso `development`; branch di lavoro persistenti e mai riscritti |
