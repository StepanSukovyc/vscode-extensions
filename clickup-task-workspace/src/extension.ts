import * as vscode from 'vscode';
import { updateTaskCommand } from './commands/updateTaskCommand.js';
import { clearApiToken, promptAndStoreApiToken } from './configuration.js';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('clickup-task-workspace.updateTask', async () => {
      await updateTaskCommand(context);
    }),
    vscode.commands.registerCommand('clickup-task-workspace.setApiToken', async () => {
      const token = await promptAndStoreApiToken(context.secrets);
      if (token) {
        void vscode.window.showInformationMessage('ClickUp API token byl bezpečně uložen.');
      }
    }),
    vscode.commands.registerCommand('clickup-task-workspace.clearApiToken', async () => {
      const confirmation = await vscode.window.showWarningMessage(
        'Opravdu chcete odstranit uložený ClickUp API token?',
        { modal: true },
        'Odstranit',
      );
      if (confirmation === 'Odstranit') {
        await clearApiToken(context.secrets);
        void vscode.window.showInformationMessage('ClickUp API token byl odstraněn.');
      }
    }),
  );
}

export function deactivate(): void {}
