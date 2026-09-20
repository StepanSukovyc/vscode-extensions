# ClickUp Task Workspace

Samostatné rozšíření pro Visual Studio Code, které stáhne aktuální stav jednoho ClickUp úkolu do lokální pracovní složky. Nemá runtime ani build závislost na jiném projektu v tomto repozitáři.

## Funkce

- přijímá custom ID (`PROJ-7383`), interní ClickUp ID i celou ClickUp URL;
- ukládá API token do VS Code SecretStorage;
- načítá Markdown popis, metadata, komentáře a přílohy;
- stahuje všechny ClickUp přílohy;
- stahuje veřejné externí obrázky vložené v popisu;
- přepisuje odkazy obrázků na lokální relativní cesty;
- před aktualizací existujícího `popis.md` vždy vyžádá potvrzení;
- ponechává lokální přílohy, které už byly z ClickUpu odstraněny;
- podporuje relativní i absolutní cílovou složku;
- vytváří čitelný Markdown i úplné JSON snapshoty odpovědí API.

Rozšíření ClickUp data pouze čte. Nemění úkol, status, tagy ani komentáře.

## Požadavky

- Visual Studio Code 1.96 nebo novější;
- osobní ClickUp API token;
- ClickUp Workspace ID;
- přístup tokenu k požadovanému úkolu;
- lokální souborový systém. Zápis do vzdáleného SSH/WSL/dev-container filesystemu tato verze nepodporuje.

## Instalace VSIX

1. Otevřete panel Extensions.
2. V nabídce panelu zvolte `Install from VSIX...`.
3. Vyberte soubor ze složky `versions`.
4. Po instalaci případně znovu načtěte okno VS Code.

## Nastavení

Nastavení otevřete přes `Preferences: Open Settings` a vyhledejte `ClickUp Task Workspace`.

| Klíč | Výchozí hodnota | Popis |
|---|---:|---|
| `clickupTaskWorkspace.workspaceId` | prázdná | Povinné číselné ID ClickUp Workspace. Workspace ID z celé URL má pro dané spuštění přednost. |
| `clickupTaskWorkspace.tasksFolder` | `tasks` | Relativní cesta vůči workspace aktivního souboru nebo absolutní cesta. |
| `clickupTaskWorkspace.largeAttachmentWarningMb` | `100` | Velikost, od které se zobrazí varování. Nejde o pevný limit. |

Token se nezapisuje do `settings.json`. Nastavuje se příkazem `ClickUp Task Workspace: Nastavit ClickUp API token` a ukládá se přes VS Code SecretStorage.

## Příkazy

- `ClickUp Task Workspace: Aktualizovat ClickUp úkol`
- `ClickUp Task Workspace: Nastavit ClickUp API token`
- `ClickUp Task Workspace: Odstranit ClickUp API token`

## Použití

1. Nastavte `clickupTaskWorkspace.workspaceId`.
2. Spusťte příkaz `Nastavit ClickUp API token`.
3. Otevřete soubor v cílovém workspace rootu.
4. Spusťte `Aktualizovat ClickUp úkol`.
5. Zadejte jednu z podporovaných hodnot:

```text
PROJ-7383
86abc123
https://app.clickup.com/t/2422460/PROJ-7383
```

U multi-root workspace se relativní `tasksFolder` vyhodnotí vůči workspace aktivního souboru. Pokud aktivní soubor root neurčuje, rozšíření nabídne výběr. Absolutní cesta může ležet mimo workspace; při prvním použití vyžaduje schválení.

## Výstup

Pro task `PROJ-7383` a výchozí konfiguraci vznikne:

```text
tasks/PROJ-7383/
  popis.md
  clickup-task.json
  clickup-comments.json
  .clickup-task-workspace.json
  <stažené přílohy>
```

- `popis.md` obsahuje čitelný název, popis, metadata, komentáře, seznam příloh a kompletní JSON data.
- `clickup-task.json` je bezeztrátový snapshot odpovědi detailu úkolu.
- `clickup-comments.json` je bezeztrátový snapshot komentářů.
- `.clickup-task-workspace.json` uchovává stabilní mapování příloh na lokální názvy.

Přílohy odstraněné z ClickUpu se lokálně nemažou. Rozšíření nikdy nemaže `ai.md` ani jiné nespravované soubory.

## Přílohy a bezpečnost

ClickUp přílohy nemají pevný limit počtu, velikosti ani MIME typu. Stahují se streamovaně na disk a velké soubory vyžadují potvrzení podle nastaveného varovného prahu. Stažené soubory se automaticky nespouštějí.

Externí obrázky z Markdown popisu se stahují automaticky pouze přes HTTP/HTTPS. Rozšíření blokuje URL s přihlašovacími údaji a cíle v loopback, link-local a privátních sítích. Přesměrování se kontrolují jednotlivě a jejich počet je omezen.

API token se neposílá serverům s přílohami ani externím obrázkům; používá se pouze pro ClickUp API požadavky.

## Známá omezení

- ClickUp Docs připojené k úkolu endpoint `Get Task` nevrací.
- Vzdálené VS Code filesystémy nejsou v této verzi podporované.
- Síťové servery nemusí poskytnout `Content-Length`; velikost pak nelze varovat před začátkem stahování.
- Automatická ochrana externích URL omezuje běžná SSRF rizika, ale nenahrazuje síťovou bezpečnost operačního systému.
- Formát ClickUp API se může rozšířit; raw JSON snapshoty proto zůstávají autoritativní úplnou kopií získaných dat.

## Vývoj

Projekt používá pnpm 11, TypeScript, esbuild, ESLint a Vitest.

```powershell
pnpm install
pnpm run check
pnpm run compile
pnpm run package
```

Vývojové spuštění:

1. Otevřete tuto složku samostatně ve VS Code.
2. Spusťte konfiguraci `Spustit rozšíření` klávesou `F5`.
3. V novém Extension Development Host okně spusťte příkaz rozšíření.

Hlavní skripty:

| Skript | Účel |
|---|---|
| `pnpm run check-types` | Přísná kontrola TypeScript typů. |
| `pnpm run lint` | ESLint kontrola zdrojů a testů. |
| `pnpm test` | Unit a integrační testy bez skutečného ClickUp tokenu. |
| `pnpm run compile` | Typecheck a vytvoření vývojového bundle v `dist`. |
| `pnpm run package` | Kompletní kontrola a vytvoření VSIX ve `versions`. |

## Struktura projektu

```text
src/
  clickup/       ClickUp API klient a datové typy
  commands/      uživatelské příkazy
  domain/        parser vstupu, Markdown a plán příloh
  files/         transakční lokální synchronizace
  network/       bezpečné URL a streamované stahování
  extension.ts   registrace rozšíření
```

## Samostatnost a distribuce

Projekt používá vlastní `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, testovací a build konfiguraci. Zdrojový kód neimportuje nic mimo tuto složku. Pro soukromou distribuci vytvořte VSIX příkazem `pnpm run package` a nainstalujte jej přes `Extensions: Install from VSIX...`.

Tato verze má novou identitu `stepansukovyc.clickup-task-workspace`; nenavazuje na nastavení ani token dřívějších extension identit. Po instalaci proto znovu nastavte Workspace ID a ClickUp API token.
