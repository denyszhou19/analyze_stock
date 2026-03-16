#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

cd "${COZE_WORKSPACE_PATH}"

# 1. 安装 Node.js 依赖
echo "Installing Node.js dependencies..."
pnpm install

# 2. 安装 Python 依赖
echo "Installing Python dependencies..."
pip install -r requirements.txt --quiet 2>&1 || pip install -r requirements.txt

# 3. 构建 Next.js 应用
echo "Building Next.js application..."
npx next build

echo "Build completed successfully!"
