#!/bin/bash

# The path to this script must be configured in the POST_BUILD_SCRIPT_PATH variable in
# configuration => application settings: scripts/post-build.sh
#
# Details here => https://github.com/microsoft/Oryx/blob/main/doc/runtimes/python.md#build

echo "-----------------------------------------------------------"
echo "Post build commands - START"
echo "-----------------------------------------------------------"

echo "-----------------------------------------------------------"
echo "Installing NodeJs"
echo "-----------------------------------------------------------"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs

echo "-----------------------------------------------------------"
echo "Running npm commands"
echo "-----------------------------------------------------------"
cd frontend
npm install
npm run build
cd ..

echo "-----------------------------------------------------------"
echo "Post build commands - COMPLETED"
echo "-----------------------------------------------------------"
