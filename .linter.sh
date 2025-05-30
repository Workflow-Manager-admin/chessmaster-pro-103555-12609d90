#!/bin/bash
cd /home/kavia/workspace/code-generation/chessmaster-pro-103555-12609d90/chessweb_app
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

