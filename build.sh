#!/bin/sh
# 配布用ファイルを生成する
#   dist/特別料金表ビルダー.html … ローカル配布用（1ファイル完結）
#   dist/web/index.html          … 静的ホスティング公開用（同内容）
#   dist/artifact.html           … Claude Artifact 公開用（外側のHTMLタグなし・保存はビューア経由）
set -e
cd "$(dirname "$0")"
mkdir -p dist/web
python3 - <<'PY'
import io, re

html = io.open('index.html', encoding='utf-8').read()
for src in ('assets/units.js', 'assets/app.js'):
    js = io.open(src, encoding='utf-8').read()
    tag = '<script src="%s"></script>' % src
    assert tag in html, tag
    html = html.replace(tag, '<script>\n' + js + '\n</script>')

for out in ('dist/特別料金表ビルダー.html', 'dist/web/index.html'):
    io.open(out, 'w', encoding='utf-8').write(html)
    print('生成しました:', out)

# Artifact 版: 外側のタグを外し、ダウンロードの代わりにコピー用ダイアログを使う
art = html
for tag in ('<!doctype html>\n', '<html lang="ja">\n', '<head>\n', '</head>\n',
            '<body>\n', '</body>\n', '</html>\n',
            '<meta charset="utf-8">\n', '<meta name="viewport" content="width=device-width,initial-scale=1">\n'):
    art = art.replace(tag, '')
art = art.replace('<script>\n/* 特別料金表ビルダー',
                  '<script>window.ARTIFACT_BUILD = true;</script>\n<script>\n/* 特別料金表ビルダー', 1)
io.open('dist/artifact.html', 'w', encoding='utf-8').write(art)
print('生成しました: dist/artifact.html')
PY
