with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_code = (
    "    function updateWatermarkVisibility() {\r\n"
    "        if (!wm) return;\r\n"
    "        const isAuthActive = document.body.classList.contains('auth-active') || document.body.classList.contains('home-active') === false;\r\n"
    "        const isHelpActive = !document.getElementById('screen-help').classList.contains('hidden');\r\n"
    "        if (isAuthActive || isHelpActive) {\r\n"
    "            wm.style.display = 'block';\r\n"
    "        } else {\r\n"
    "            wm.style.display = 'none';\r\n"
    "        }\r\n"
    "    }"
)

new_code = (
    "    function updateWatermarkVisibility() {\r\n"
    "        if (!wm) return;\r\n"
    "        // Show ONLY when not logged in (on the welcome/login/register screen)\r\n"
    "        const isAuthOnly = !document.body.classList.contains('home-active');\r\n"
    "        wm.style.display = isAuthOnly ? 'block' : 'none';\r\n"
    "    }"
)

if old_code in content:
    content = content.replace(old_code, new_code)
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print('OK - replaced')
else:
    print('NOT FOUND - trying LF')
    old_lf = old_code.replace('\r\n', '\n')
    new_lf = new_code.replace('\r\n', '\n')
    if old_lf in content:
        content = content.replace(old_lf, new_lf)
        with open('app.js', 'w', encoding='utf-8') as f:
            f.write(content)
        print('OK - replaced with LF')
    else:
        print('NOT FOUND either way')
