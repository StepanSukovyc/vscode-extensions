# JSON Text Normalizer

Rozšíření převede JSON uložený v textových hodnotách vybraného JSON dokumentu na skutečné vnořené objekty a výsledek naformátuje.

## Použití

1. Otevřete JSON dokument a případně vyberte pouze část, kterou chcete upravit.
2. V Command Palette spusťte `JSON Text Normalizer: Normalizovat JSON textové hodnoty`.
3. Rozšíření nahradí vybraný text, nebo celý dokument, validním formátovaným JSONem.

Neplatný JSON se nemění a VS Code zobrazí chybu.

## Instalace VSIX

1. V adresáři rozšíření spusťte `pnpm install` a `pnpm run package`.
2. Ve VS Code spusťte `Extensions: Install from VSIX...`.
3. Vyberte `versions/json-text-normalizer.vsix`.

## Vývoj

```powershell
pnpm install
pnpm run compile
pnpm run lint
pnpm test
```

## Licence

MIT License, copyright (c) 2026 Mgr. Stepan Sukovyc.
