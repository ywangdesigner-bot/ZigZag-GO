#!/bin/zsh
set -eu
cd "${0:A:h}"
if ! /usr/bin/python3 dev_server.py --ensure; then
  read 'reply?按回车关闭'
  exit 1
fi
open 'http://127.0.0.1:8741/index.html'
