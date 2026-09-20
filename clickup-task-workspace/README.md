# ClickUp Task Workspace

Samostatné rozšíření pro Visual Studio Code, které stáhne aktuální stav ClickUp úkolu do lokální pracovní složky a převede strukturovaný výkaz z jeho popisu do Clockify. Nemá runtime ani build závislost na jiném projektu v tomto repozitáři.

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
- importuje výkaz z ClickUp úkolu do aktivního Clockify workspace;
- před importem zobrazí náhled vytvářených, existujících, mazatelných a chybných položek;
- rozpozná existující shodné Clockify entry a při opakovaném importu je nepřidává.

Příkaz pro aktualizaci úkolu ClickUp pouze čte. Příkaz pro import výkazu může v ClickUpu změnit Markdown popis odstraněním řádků bez času, vytvořit komentář k chybnému řádku a nastavit stav úkolu.

## Požadavky

- Visual Studio Code 1.96 nebo novější;
- osobní ClickUp API token;
- ClickUp Workspace ID;
- přístup tokenu k požadovanému úkolu;
- osobní Clockify API token pro import výkazů;
- Clockify projekty a štítky uvedené ve výkazu musí již existovat v aktivním workspace;
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
| `clickupTaskWorkspace.clockifyApiBaseUrl` | `https://api.clockify.me/api/v1` | Základní HTTPS URL Clockify API v1; pro regionální Clockify server ji lze změnit. |

Tokeny se nezapisují do `settings.json`. Nastavují se příkazy pro ClickUp a Clockify API token a ukládají se přes VS Code SecretStorage.

## Příkazy

- `ClickUp Task Workspace: Aktualizovat ClickUp úkol`
- `ClickUp Task Workspace: Importovat výkaz do Clockify`
- `ClickUp Task Workspace: Nastavit ClickUp API token`
- `ClickUp Task Workspace: Odstranit ClickUp API token`
- `ClickUp Task Workspace: Nastavit Clockify API token`
- `ClickUp Task Workspace: Odstranit Clockify API token`

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

Clockify token se používá pouze pro Clockify API. Zápisy do Clockify se automaticky neopakují, aby síťová nejistota nemohla vytvářet duplicity.

## Import výkazu do Clockify

1. Nastavte oba API tokeny a `clickupTaskWorkspace.workspaceId`.
2. V Clockify vyberte cílový workspace jako aktivní.
3. Vytvořte úkol, jehož název je přesně datum ve tvaru `D/M/YYYY`, například `12/9/2025`.
4. Do Markdown popisu vložte výkaz a spusťte příkaz `Importovat výkaz do Clockify`.
5. Zkontrolujte náhled a potvrďte import.

Každý výkazový řádek má tvar:

```text
<projekt> : <čas-od> - <čas-do>, <čas-od> - <čas-do> <štítky> : <popis>
```

Například:

```text
various activities: 815 - 830, 1830 - 1835 management: Různé (emaily, aktualizace nástrojů, plánování apod.)
```

- Jedno- a dvouciferný čas označuje celou hodinu: `9` znamená `09:00` a `12` znamená `12:00`.
- Tří- a čtyřciferný čas obsahuje hodiny i minuty: `915` znamená `09:15`, `1230` znamená `12:30` a `1830` znamená `18:30`. Lze použít i zápis se dvojtečkou, například `14:20`.
- Páry lze oddělit čárkou i mezerou. Konec nočního intervalu může zapsat pouze minuty: `2330 - 30` znamená `23:30–00:30` následující kalendářní den.
- Časy jsou vyhodnoceny v `Europe/Prague`; neexistující nebo nejednoznačný čas při změně letního času je chyba.
- Název projektu ani štítku nesmí obsahovat dvojtečku. Popis může obsahovat libovolný text včetně dalších dvojteček a URL.
- Řádek bez časové dvojice se po potvrzení odstraní z ClickUp Markdownu.
- Neúplný čas, neexistující projekt nebo štítek a chyba Clockify vytvoří jeden ClickUp komentář pro daný zdrojový řádek.

Existující Clockify entry se považuje za hotové, pokud se shoduje začátek, konec, projekt, popis a množina štítků. Překrývající se i opakované intervaly uvedené přímo ve výkazu jsou povolené.

Pokud se část entry vytvoří a pozdější zápis selže, rozšíření již vytvořené entry nemaže. Další spuštění je podle shody rozpozná a přeskočí. Při libovolné chybě výkazu nebo zápisu nastaví úkol na `COOPERATION`; při úspěchu na `QA REVIEW`.

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
  clockify/      Clockify API klient a datové typy
  domain/        parser vstupu, Markdown a plán příloh
  files/         transakční lokální synchronizace
  network/       bezpečné URL a streamované stahování
  timesheet/     parser a plán importu výkazu
  extension.ts   registrace rozšíření
```

## Samostatnost a distribuce

Projekt používá vlastní `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, testovací a build konfiguraci. Zdrojový kód neimportuje nic mimo tuto složku. Pro soukromou distribuci vytvořte VSIX příkazem `pnpm run package` a nainstalujte jej přes `Extensions: Install from VSIX...`.

Tato verze má novou identitu `stepansukovyc.clickup-task-workspace`; nenavazuje na nastavení ani token dřívějších extension identit. Po instalaci proto znovu nastavte Workspace ID a ClickUp API token.
