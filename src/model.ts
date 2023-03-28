/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
const { Configuration, OpenAIApi } = require("openai");

let openai: any;
let configuration: any;
let _context: vscode.ExtensionContext;
let didSetApiKey: boolean = false;

interface Message {
    role: string;
    content: string;
    name?: string;
  }

const systemMessage: Message = { role: "system", content: "You are a helpful assistant." };
const conversation: Message[] = [systemMessage];

async function init(context: vscode.ExtensionContext) {
    _context = context;
    const key = context.globalState.get('chatsensei.apiKey');
    key !== undefined ? setKey(decode(key)) : null;
}

async function requestKey() {
    await vscode.window.showInputBox({
        prompt: 'Please enter your OpenAI API key. https://platform.openai.com/account/api-keys',
        placeHolder: 'sk-',
        ignoreFocusOut: true,
    }).then((value) => {
        setKey(value || '');
    });
}

function setKey(key: string) {
    try {
        key = key.trim();
        if (key.length === 0) {
            throw new Error('API key is empty.');
        }
        configuration = new Configuration({ apiKey: key });
        openai = new OpenAIApi(configuration);
        _context.globalState.update('chatsensei.apiKey', encode(key));
        didSetApiKey = true;
    } catch (e) {
        console.log(e);
        vscode.window.showErrorMessage(`Failed to set API key: ${e}`);
        return false;
    }
    return true;
}

function removeKey() {
    openai = new OpenAIApi(new Configuration());
    _context.globalState.update('chatsensei.apiKey', undefined);
    didSetApiKey = false;
}

async function ask(content: string) {
    !didSetApiKey ? await requestKey() : null;

    conversation.push({ role: "user", content: content });
    console.log(conversation);

    openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: conversation
    }).then((response: any) => {

        conversation.push({ role: "assistant", content: response.data.choices[0].message.content });
        console.log(response.data);

    }).catch((error: any) => {
        console.log(error.response.data);
        error.response.data.code === 'invalid_api_key' ? removeKey() : null;
        vscode.window.showErrorMessage(`Error occurred: ${error}`);
    });
}

// Base64 decoding
function decode (str: any) {
    return String(Buffer.from(String(str), 'base64').toString('binary'));
}

// Base64 encoding
function encode (str: any) {
    return String(Buffer.from(String(str), 'binary').toString('base64'));
}

export { init, setKey, ask };
