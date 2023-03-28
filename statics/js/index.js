document.addEventListener('DOMContentLoaded', () => {

    let delta = document.querySelector('#delta');

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
               delta.innerHTML = tmp;
               window.scrollTo(0,document.body.scrollHeight);
               break;
        }
    });
});
