document.addEventListener('DOMContentLoaded', () => {

    const vscode = acquireVsCodeApi();

    function sendMessage(message) {
        if (message) {
            vscode.postMessage({
                command: 'query_model',
                content: message
            });
        }
    }

    const chatBody = document.getElementById('chatBody');
    const textarea = document.querySelector('#chatInput textarea');
    textarea.focus();
    textarea.addEventListener('keypress', (event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.shiftKey)) {
            event.preventDefault();
            let textBox = event.target;
            let startPos = textBox.selectionStart;
            let endPos = textBox.selectionEnd;
            textBox.value = textBox.value.slice(0, startPos) + "\n" + textBox.value.slice(endPos);
            // set cursor to the new line
            textBox.selectionStart = startPos + 1;
            textBox.selectionEnd = startPos + 1;
        } else if (event.key === 'Enter' && event.target.value) {
            event.preventDefault();
            sendMessage(event.target.value);
            event.target.value = '';
        }
    });

    window.addEventListener('message', event => {
        switch (event.data.command) {

            case 'delta_update':
                let tmp = '';
                for (var i = 0; i < event.data.content.length; i++) {
                    if (event.data.content[i].role === 'user') {
                        tmp += `<div class="user">${event.data.content[i].content}</div>`;
                    }
                    if (event.data.content[i].role === 'assistant') {
                        tmp += `<div class="assistant">${event.data.content[i].content}</div>`;
                    }
                    // Note: system role message is hidden
                }
                chatBody.innerHTML = tmp;
                chatBody.scrollTop = chatBody.scrollHeight;
                break;

            case 'update_finished':
                const pres = document.querySelectorAll('pre');
                pres.forEach(block => {
                    block.style.cursor = 'copy';
                    block.classList.add('copy-cursor');
                    block.addEventListener('click', () => {
                        const textToCopy = block.textContent;
                        navigator.clipboard.writeText(textToCopy)
                            .then(() => {
                                block.classList.add('copy-feedback');
                                setTimeout(() => {
                                    block.classList.remove('copy-feedback');
                                }, 1000);
                            })
                            .catch(err => {
                                console.error('Failed to copy text: ', err);
                            });
                    });
                });
                break;

            case 'disable_input':
                textarea.disabled = true;
                break;

            case 'enable_input':
                textarea.disabled = false;
                textarea.focus();
                break;

            case 'scroll_to_bottom':
                chatBody.scrollTop = chatBody.scrollHeight;
                break;
        }
    });
});


