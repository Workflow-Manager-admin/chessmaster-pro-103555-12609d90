#!/bin/bash
cd /home/kavia/workspace/code-generation/chessmaster-pro-103555-12609d90/chessmaster_pro
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

