const vscode = require('vscode');
const COMMAND_FOLD = 'editor.fold';
const COMMAND_UNFOLD_ALL = 'editor.unfoldAll';
// @FIXME: Don't match with empty block.
const RE_SIG_BLOCK = "^ *sig do$.*?^ *end$";
const RE_SIG_LINE = "^ *sig {.*?} *?$";

var byesigTimeout;
const DELAY_TIMEOUT_MS = 200;

var byesigDecorationType;

function delayedHideSig() {
	if (byesigTimeout) {
		clearTimeout(byesigTimeout);
	}

	byesigTimeout = setTimeout(hideSig, DELAY_TIMEOUT_MS);
}

async function hideAndFoldSig() {
	hideSig();
	await foldSig();
}

function decorationRenderOption() {
	return {
		opacity: vscode.workspace.getConfiguration('byesig').get('opacity').toString(),
		backgroundColor: vscode.workspace.getConfiguration('byesig').get('backgroundColor')
	}
}

function hideSig() {
	let editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}

	if (!isRubyFile(editor)) {
		return;
	}

	if (byesigDecorationType) {
		byesigDecorationType.dispose();
	}
	byesigDecorationType = vscode.window.createTextEditorDecorationType(decorationRenderOption());

	if (!vscode.workspace.getConfiguration('byesig').get('enabled')) {
		return;
	}

	let ranges = [];
	ranges.push(...getMatchPositions(new RegExp(RE_SIG_BLOCK, "gsm"), editor));
	ranges.push(...getMatchPositions(new RegExp(RE_SIG_LINE, "gsm"), editor));

	editor.setDecorations(byesigDecorationType, ranges);
}

async function foldSig() {
	let editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}

	if (!vscode.workspace.getConfiguration('byesig').get('enabled')) {
		return;
	}

	if (!isRubyFile(editor)) {
		return;
	}

	let folded_selections = [];
	let original_selection = editor.selection;

	getMatchPositions(new RegExp(RE_SIG_BLOCK, "gsm"), editor).forEach((range) => {
		// @FIXME: This works on first load, but not on tab change, in which case the selection is always 0:0.
		if (original_selection.active.line < range.start.line || original_selection.active.line > range.end.line) {
			let line_pos = editor.selection.active.with(range.start.line, 0);
			folded_selections.push(new vscode.Selection(line_pos, line_pos));
		}
	});

	if (folded_selections.length > 0) {
		editor.selections = folded_selections;
		await vscode.commands.executeCommand(COMMAND_UNFOLD_ALL);
		await vscode.commands.executeCommand(COMMAND_FOLD);
		editor.selections = [original_selection];
	}
}

function getMatchPositions(re, editor) {
	let match;
	let text = editor.document.getText();
	let ranges = [];

	while ((match = re.exec(text))) {
		let start_pos = editor.document.positionAt(match.index);
		let end_pos = editor.document.positionAt(match.index + match[0].length);
		ranges.push(new vscode.Range(start_pos, end_pos));
	}

	return ranges;
}

function isRubyFile(editor) {
	return editor.document.languageId == "ruby";
}

async function showAndUnfoldSig() {
	let editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}

	if (!isRubyFile(editor)) {
		return;
	}

	if (byesigDecorationType) {
		byesigDecorationType.dispose();
	}
	byesigDecorationType = vscode.window.createTextEditorDecorationType(decorationRenderOption());

	if (!vscode.workspace.getConfiguration('byesig').get('enabled')) {
		return;
	}

	await vscode.commands.executeCommand(COMMAND_UNFOLD_ALL);
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	context.subscriptions.push(vscode.commands.registerCommand('byesig.hideSig', hideAndFoldSig));
	context.subscriptions.push(vscode.commands.registerCommand('byesig.showSig', showAndUnfoldSig));
	vscode.window.onDidChangeActiveTextEditor(hideAndFoldSig, null, context.subscriptions);
	vscode.workspace.onDidChangeTextDocument(delayedHideSig, null, context.subscriptions);

	if (vscode.window.activeTextEditor) {
		hideAndFoldSig();
	}
}
exports.activate = activate;

function deactivate() {}

module.exports = {
	activate,
	deactivate
}
