// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import axios from 'axios';


async function ask(question: string): Promise<string> {
    const url = "https://www.blackbox.ai/api/chat";
    const headers = {
        "Host": "www.blackbox.ai",
        "Content-Type": "application/json",
        "Accept": "*/*",
        "Origin": "https://www.blackbox.ai",
        "Referer": "https://www.blackbox.ai/chat",
    };

    const data = {
        "messages": [{"id": "None", "content": question, "role": "user"}],
        "previewToken": null,
        "codeModelMode": true,
        "agentMode": {},
        "trendingAgentMode": {"mode": true},
        "isMicMode": false,
    };

    try {
        console.log("request sending...");
        const response = await axios.post(url, data, { headers });
        console.log("status code: ", response.status);
        console.log("response: ", response);
        
        // console.log("Response Code:", response.status);
        // console.log("Response Content:", response.data);

        // eslint-disable-next-line eqeqeq
        if (response.status != 200) {
            vscode.window.showInformationMessage("Please check your network...");
            process.exit();
        }

        return response.data;
    } catch (error) {
        console.error("Error making the request:", error);
        process.exit();
    }
}

function parser(answer:string){
	const regex = /```([\s\S]*?)```/g;
	const matches = answer.match(regex);

	if (matches) {
		const code = matches[0].slice(matches[0].indexOf("\n"), matches[0].length - 3);
		//console.log(code);
		return code;
	} else {
		vscode.window.showInformationMessage("Code block not found.");
		return "";
	}
}

async function insertQuestionCommentWithCode(question: string, codeRange1: vscode.Range, codeRange2: vscode.Range) {
    const editor = vscode.window.activeTextEditor;
	
    if (editor) {
		//```
		vscode.window.showInformationMessage('Generating code: ' + question);
        const position = editor.selection.active;


        let answer = await ask(question);

		let code = parser(answer);
        const edit = new vscode.TextEdit(
            new vscode.Range(position, position),
            `${code}\n`
        );

        const deleteRange = new vscode.Range(
            codeRange1.start, 
            codeRange2.end 
        );

        await editor.edit(editBuilder => {
            editBuilder.delete(deleteRange);
        });

        await editor.edit(editBuilder => {
            editBuilder.insert(position, edit.newText);
        });
        
    } else {
        vscode.window.showErrorMessage('No active text editor found.');
    }
}


async function insertQuestionComment(question: string, languageId: string, helpRange1: vscode.Range, helpRange2: vscode.Range) {
    const editor = vscode.window.activeTextEditor;

    if (editor) {
		vscode.window.showInformationMessage('Generating answer: ' + question);
        const position = editor.selection.active;
        let commentStart = '';
        let commentEnd = '';

        switch (languageId) {
            case 'python':
                commentStart = '\n"""\n';
                commentEnd = '\n"""';
                break;
            default:
                commentStart = '\n/*\n';
                commentEnd = '\n*/';
                break;
        }
		
        const answer = await ask(question);
        const edit = new vscode.TextEdit(
            new vscode.Range(position, position),
            `${commentStart}${answer}\n${commentEnd}`
        );

        const deleteRange = new vscode.Range(
            helpRange1.start,
            helpRange2.end
        );

        await editor.edit(editBuilder => {
            editBuilder.delete(deleteRange);

        });
        


        await editor.edit(editBuilder => {
            editBuilder.insert(position, edit.newText);
        });

        
    } else {
        vscode.window.showErrorMessage('No active text editor found.');
    }
}



async function insertFixedCodeAll(fullText:string) {
	const editor = vscode.window.activeTextEditor;

	if (editor){
		vscode.window.showInformationMessage('Fixing all code: ' + fullText);
        const position = editor.selection.active;
		const wholeDocumentRange = new vscode.Range(
			editor.document.positionAt(0),
			editor.document.positionAt(editor.document.getText().length)
		);

		
		
        
		let answer = await ask("Fix this code: ".concat(fullText));
        
		let code = parser(answer);

        console.log(code);

        const edit = new vscode.TextEdit(
            new vscode.Range(position, position),
            `${code}\n`
        );

        await editor.edit(editBuilder => {
            editBuilder.delete(wholeDocumentRange);
        });

        await editor.edit(editBuilder => {
            editBuilder.insert(position, edit.newText);
        });
	}
	
}



async function insertFixedCode(question:string, fixRange1: vscode.Range, fixRange2: vscode.Range) {
    const editor = vscode.window.activeTextEditor;

	if (editor){
		vscode.window.showInformationMessage('Code fixing: ' + question);
        const position = editor.selection.active;
		
        let answer = await ask("Fix this code: ".concat(question));
        
		let code = parser(answer);

        console.log(code);



        const edit = new vscode.TextEdit(
            new vscode.Range(position, position),
            `${code}\n`
        );
        const deleteRange = new vscode.Range(
            fixRange1.start, 
            fixRange2.end 
        );

        await editor.edit(editBuilder => {
            editBuilder.delete(deleteRange);
        });



        await editor.edit(editBuilder => {
            editBuilder.insert(position, edit.newText);
        });
    }
}


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    
    // Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "copilotv1" is now active!');

    // The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('copilotv1.codeNavigator', () => {
        // The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from copilotv1!');
    });

    context.subscriptions.push(disposable);

	let onDidChangeTextDocumentDisposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
        if (event.contentChanges.length > 0) {
            let document = event.document;
            let question;
            
            let timeout = 3.5; // second
    
            const text = document.getText();
            const helpMatch = text.match(/<help>([\s\S]*?)<\/help>/);
            const codeMatch = text.match(/<code>([\s\S]*?)<\/code>/);
            const fixMatch = text.match(/<fix>([\s\S]*?)<\/fix>/);
            const fixAllMatch = text.includes('<fixAll>');


            setTimeout(async () => {
                const updatedText = vscode.workspace.textDocuments.find(doc => doc.uri === event.document.uri)?.getText();
                const tagsStillPresent = updatedText?.includes('<help>') || updatedText?.includes('<code>') || updatedText?.includes('<fix>') || updatedText?.includes('<fixAll>');

                if (tagsStillPresent) {


                    if (fixMatch){


                        question = fixMatch[1].trim();
                        const edit = new vscode.WorkspaceEdit();
                        const fixRange1 = new vscode.Range(
                            document.positionAt(text.indexOf('<fix>')),
                            document.positionAt(text.indexOf('<fix>') + '<fix>'.length)
                        );
                        const fixRange2 = new vscode.Range(
                            document.positionAt(text.indexOf('</fix>')),
                            document.positionAt(text.indexOf('</fix>') + '</fix>'.length)
                        );
                        
                        await vscode.workspace.applyEdit(edit);
                        await insertFixedCode(question, fixRange1, fixRange2);
                    }

                    if (helpMatch) {
                        question = helpMatch[1].trim();
                        const edit = new vscode.WorkspaceEdit();
                        const helpRange1 = new vscode.Range(
                            document.positionAt(text.indexOf('<help>')),
                            document.positionAt(text.indexOf('<help>') + '<help>'.length)
                        );
                        const helpRange2 = new vscode.Range(
                            document.positionAt(text.indexOf('</help>')),
                            document.positionAt(text.indexOf('</help>') + '</help>'.length)
                        );
                        
                        await vscode.workspace.applyEdit(edit);
                        await insertQuestionComment(question, document.languageId.toLowerCase(), helpRange1, helpRange2);
                    }
            
                    if (codeMatch) {
                        question = codeMatch[1].trim();
                        const codeRange1 = new vscode.Range(
                            document.positionAt(text.indexOf('<code>')),
                            document.positionAt(text.indexOf('<code>') + '<code>'.length)
                        );
                        const codeRange2 = new vscode.Range(
                            document.positionAt(text.indexOf('</code>')),
                            document.positionAt(text.indexOf('</code>') + '</code>'.length)
                        );

                        await insertQuestionCommentWithCode(question, codeRange1, codeRange2);
                    }
            
                    if (fixAllMatch) {
                        const edit = new vscode.WorkspaceEdit();
                        const fixAllRange = new vscode.Range(
                            document.positionAt(text.indexOf('<fixAll>')), 
                            document.positionAt(text.indexOf('<fixAll>') + '<fixAll>'.length)
                        );
                        edit.delete(document.uri, fixAllRange);
                        await vscode.workspace.applyEdit(edit);
                        const fullText = document.getText();
                        await insertFixedCodeAll(fullText);
                    }
        
        }
    }, timeout * 1000);
}
});
    
    context.subscriptions.push(onDidChangeTextDocumentDisposable);

}


// This method is called when your extension is deactivated
export function deactivate() {}



