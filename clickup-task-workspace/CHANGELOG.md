# Changelog

Všechny významné změny tohoto rozšíření jsou uvedeny v tomto souboru. Formát vychází z Keep a Changelog a projekt používá sémantické verzování.

## [Unreleased]

### Přidáno

- Import strukturovaných výkazů z ClickUp Markdownu do aktivního Clockify workspace.
- Bezpečné uložení samostatného Clockify API tokenu ve VS Code SecretStorage.
- Náhled importu, přeskočení existujících entry a komentáře ClickUp pro chybné zdrojové řádky.

### Změněno

- Import výkazu může odstranit řádky bez časů z ClickUp Markdownu a nastavuje stav `QA REVIEW` nebo `COOPERATION`.
- Popis rozšíření nyní zahrnuje synchronizaci výkazů do Clockify.

## [0.1.0] - 2026-09-20

### Přidáno

- První veřejně licencované vydání ClickUp Task Workspace.
- Soukromá distribuce přes VSIX.

### Změněno

- Nová extension identita `stepansukovyc.clickup-task-workspace`.
- Neutrální command a configuration namespace `clickup-task-workspace` a `clickupTaskWorkspace`.
- Lokální manifest tasku je nově `.clickup-task-workspace.json`.
