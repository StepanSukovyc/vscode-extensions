# Sukovyc VS Code Extensions

Kolekce samostatných rozšíření pro Visual Studio Code.

## Rozšíření

| Rozšíření | Účel |
|---|---|
| `clickup-task-workspace` | Stáhne ClickUp úkol včetně popisu, komentářů a příloh do lokální pracovní složky. |
| `json-text-normalizer` | Převede JSON uložený v textových hodnotách na vnořené JSON objekty. |

Každá složka je samostatný TypeScript package s vlastním lockfilem a lze ji sestavit nezávisle na ostatních.

## Lokální instalace

V adresáři konkrétního rozšíření spusťte:

```powershell
pnpm install
pnpm run package
```

Vzniklý soubor `.vsix` nainstalujte ve VS Code příkazem `Extensions: Install from VSIX...`.

## Bezpečnost a kvalita

GitHub Actions ověřují oba packages při každém pushi a pull requestu pomocí typechecku, lintu a testů. Dále probíhá kontrola produkčních závislostí přes `pnpm audit`, CodeQL analýza TypeScriptu a dependency review pull requestů.

Dependabot každý týden vytváří návrhy aktualizací npm/pnpm závislostí. GitHub Secret Scanning a Push Protection je nutné zapnout v nastavení repozitáře na GitHubu; neukládejte tokeny ani jiné přihlašovací údaje do zdrojového kódu nebo GitHub Actions workflow.

## Licence

Zdrojové kódy v tomto repozitáři jsou licencovány pod MIT licencí. Podrobnosti jsou v souboru `LICENSE.txt` každého rozšíření.

Copyright (c) 2026 Mgr. Stepan Sukovyc
