#!/bin/sh
# assets/*.js を index.html に埋め込み、1枚で動く単体HTMLを dist/ に生成する
set -e
cd "$(dirname "$0")"
mkdir -p dist
out="dist/特別料金表ビルダー.html"
python3 - "$out" <<'PY'
import sys, io
out = sys.argv[1]
html = io.open('index.html', encoding='utf-8').read()
for src in ('assets/units.js', 'assets/app.js'):
    js = io.open(src, encoding='utf-8').read()
    tag = '<script src="%s"></script>' % src
    assert tag in html, tag
    html = html.replace(tag, '<script>\n' + js + '\n</script>')
io.open(out, 'w', encoding='utf-8').write(html)
print('生成しました:', out)
PY
