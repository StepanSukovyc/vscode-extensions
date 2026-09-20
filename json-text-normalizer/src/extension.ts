import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

	let disposable = vscode.commands.registerCommand('json-text-normalizer.normalizeJsonText', async () => {

		const editor = vscode.window.activeTextEditor;
		if (!editor)
			return;

		const document = editor.document;
		const selection = editor.selection;
		const range = selection && !selection.isEmpty
			? selection
			: document.validateRange(new vscode.Range(0, 0, document.lineCount, 0));

		const text = document.getText(range);
		let parsedData;

		try {
			let outer = JSON.parse(text);
			convertObject(outer, replaceFn);
			parsedData = JSON.stringify(outer, null, 2);
		} catch (error) {
			vscode.window.showErrorMessage('Invalid JSON');
			return;
		}

		editor.edit(editBuilder => {
			editBuilder.replace(range, parsedData);
		});
	});

	context.subscriptions.push(disposable);
}

function convert(outer: any, replaceFn: any): boolean {
	if (typeof outer === 'object')
		for (let key in outer)
			if (typeof outer[key] === 'string')
				outer[key] = replaceFn(outer[key]);

	return true;
}

const replaceFn = (value: any): any => {
	if (value === null)
		return value;
	else
		try {
			if (typeof value === 'string')
				return JSON.parse(value);
		} catch (error) {
			vscode.window.showErrorMessage(`${value} -> replaceFn error: ${error}`);
		}
	return value;
}

function convertObject(obj: any, replaceFn: (value: any) => any): void {
	if (convert(obj, replaceFn) && typeof obj === 'object')
		for (const key in obj)
			if (obj.hasOwnProperty(key)) {
				const keyValue = obj[key];
				if (Array.isArray(keyValue)) {
					let pole = [];
					for (let index = 0; index < keyValue.length; index++) {
						let pItem = keyValue[index];
						convertObject(pItem, replaceFn);
						pole.push(pItem);
					}
					obj[key] = pole;
				} else if (typeof keyValue === 'string') {
					convert(keyValue, replaceFn);
					convertObject(keyValue, replaceFn);
				} else if (typeof keyValue === 'object')
					convertObject(keyValue, replaceFn);
			}
}

export function deactivate() { }
