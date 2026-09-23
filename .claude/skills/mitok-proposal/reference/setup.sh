#!/usr/bin/env bash
# MiTok提案書ビルド環境のセットアップ（クラウドコンテナは毎回まっさらなので、最初に1回実行する）
# 使い方: bash setup.sh <作業ディレクトリ(スクラッチパッド推奨)>
set -euo pipefail
WORK="${1:?usage: setup.sh <work_dir>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$WORK/thumbs"

# 1) Node依存（pptxgenjs はグローバルに無いことがある）
cd "$WORK"
[ -f package.json ] || npm init -y >/dev/null
node -e "require('pptxgenjs');require('react-icons/fa');require('sharp')" 2>/dev/null \
  || npm install pptxgenjs react-icons react react-dom sharp >/dev/null 2>&1

# 2) 日本語フォント（Chromiumはプロキシ証明書の都合でGoogle Fontsを直接読めないため、ローカルに入れる）
mkdir -p ~/.fonts
G=https://raw.githubusercontent.com/google/fonts/main/ofl
[ -f ~/.fonts/NotoSansJP.ttf ] || curl -sSfL -o ~/.fonts/NotoSansJP.ttf "$G/notosansjp/NotoSansJP%5Bwght%5D.ttf"
[ -f ~/.fonts/ZenMaruGothic-Black.ttf ] || curl -sSfL -o ~/.fonts/ZenMaruGothic-Black.ttf "$G/zenmarugothic/ZenMaruGothic-Black.ttf"
[ -f ~/.fonts/ZenMaruGothic-Bold.ttf ] || curl -sSfL -o ~/.fonts/ZenMaruGothic-Bold.ttf "$G/zenmarugothic/ZenMaruGothic-Bold.ttf"
fc-cache -f >/dev/null

# 3) 目視QA用（LibreOffice Impress と pdftoppm、検証スクリプトの依存）
if ! ls /usr/lib/libreoffice/program 2>/dev/null | grep -q libsdlo; then
  (apt-get install -y -q libreoffice-impress poppler-utils >/dev/null 2>&1) \
    || (apt-get update -q >/dev/null 2>&1 && apt-get install -y -q libreoffice-impress poppler-utils >/dev/null 2>&1)
fi
command -v pdftoppm >/dev/null || apt-get install -y -q poppler-utils >/dev/null 2>&1
python3 -c "import defusedxml, lxml" 2>/dev/null || pip install -q defusedxml lxml >/dev/null 2>&1

# 4) 参考スクリプトを作業ディレクトリへコピー（既にあれば上書きしない）
cp -n "$HERE/build.js" "$WORK/build.js"
cp -n "$HERE/thumbs/render.js" "$HERE/thumbs/chars.js" "$WORK/thumbs/"
echo "setup done: $WORK"
