# ADR-19 · Merge commit verso `development` e branch di lavoro persistenti

> **Stato:** proposto · **Data:** 24/11/2026 · **Modifica:** ADR-14 (Repository, CI, deploy) e manifesto §8

## Contesto

Il manifesto 1.0 prevedeva lo **squash** delle PR verso `development`, con cancellazione del branch dopo il merge. Nell'uso si sono visti due limiti:

- lo squash riduce una PR a un solo commit. In `development` si perde la storia dei singoli passi, utile in review, con `git bisect` e per mostrare ai docenti chi ha fatto cosa (traccia §3);
- un branch di lavoro su un requisito, come `docs/srs-consegna-anticipata` o un `feature/*` di pacchetto, resta utile anche dopo il primo merge. Dopo uno squash, però, i suoi commit non sono più antenati di `development` e il merge successivo genera conflitti o duplicati.

## Alternative

| Opzione | Esito |
|---|---|
| A. Squash verso `development` (attuale) | Scartata: perde la storia e rende inutilizzabili i branch dopo il primo merge |
| B. Rebase and merge | Scartata: riscrive i commit, quindi il branch remoto diverge da `development` come con lo squash |
| C. **Merge commit verso `development`**, branch persistenti | **Scelta** |

## Decisione

1. Le PR `feature/*`, `fix/*`, `docs/*` → `development` si integrano **solo con merge commit**. Squash e rebase sono disabilitati nel repository.
2. I branch di lavoro **non si cancellano** dopo il merge: restano attivi finché il loro requisito è aperto. La cancellazione automatica è disattivata; il proprietario lo cancella a mano quando il lavoro è chiuso.
3. Un branch già pubblicato **non si riscrive**: niente rebase né force push. Per riallinearlo a `development` si usa `git merge origin/development`. Un ruleset blocca il force push su tutti i tipi di branch di lavoro: `feature/*`, `fix/*`, `docs/*`, `test/*`, `refactor/*`, `chore/*`, `ci/*`.
4. Dato che i commit entrano in `development` così come sono, **ogni commit** segue Conventional Commits e lascia il codice compilabile. Prima della PR si sistemano i commit locali non ancora pubblicati.
5. `main` è invariato: riceve solo `development`, con merge commit, ai checkpoint e quando sono raggiunti i quality goal previsti. Ogni merge su `main` ha un tag di checkpoint.

## Conseguenze

- La storia di `development` non è più lineare: ci sono i merge delle PR e quelli di riallineamento. Per una vista per PR si usa `git log --first-parent development`.
- Con il controllo "branch aggiornato" attivo, prima del merge un branch indietro rispetto a `development` va riallineato con un merge, non con un rebase.
- I branch integrati con squash prima di questo ADR vanno riallineati con un merge di `origin/development`, oppure ricreati da `development`, prima di essere riusati.

## Prova verificabile

- Ruleset `development`: `allowed_merge_methods = ["merge"]`, regola `required_linear_history` rimossa.
- Ruleset `working branches`: `non_fast_forward` su `refs/heads/{feature,fix,docs,test,refactor,chore,ci}/**` (id 27996686).
- Impostazioni del repository: `allow_squash_merge = false`, `allow_rebase_merge = false`, `delete_branch_on_merge = false`.
- Verifica: `gh api repos/GritHat/SideQuest/rulesets` e `gh api repos/GritHat/SideQuest`. La PR di questo ADR è la prima integrata con merge commit.
