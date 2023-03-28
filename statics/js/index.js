document.addEventListener('DOMContentLoaded', () => {
    let delta = document.querySelector('#delta');
    window.addEventListener('message', event => {
        switch (event.data.command) {
            case 'delta_update':
                let tmp = '';
                for (var i = 0; i < event.data.content.length; i++) {
                    tmp += event.data.content[i].content;
                }
               delta.innerHTML = tmp;
               break;
        }
    });
});
