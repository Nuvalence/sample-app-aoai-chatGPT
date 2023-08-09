#!/bin/bash

# The path to this script must be configured in the POST_BUILD_SCRIPT_PATH variable in
# configuration => application settings: scripts/post-build.sh
#
# Details here => https://github.com/microsoft/Oryx/blob/main/doc/runtimes/python.md#build

echo "-----------------------------------------------------------"
echo "Post build commands - START"
echo "-----------------------------------------------------------"

echo "-----------------------------------------------------------"
echo "Installing NodeJs if not present"
echo "-----------------------------------------------------------"

if which npm >/dev/null 2>&1; then
    echo "npm already installed, skipping installation"
else
    echo "npm not found, installing"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs
fi

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
