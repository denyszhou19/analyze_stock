#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
PORT=5000
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-$PORT}"

# 确保 Python 依赖已安装
ensure_python_deps() {
    cd "${COZE_WORKSPACE_PATH}"
    echo "Checking Python dependencies..."
    
    # 检查 numpy 是否已安装
    if ! python3 -c "import numpy" 2>/dev/null; then
        echo "Installing Python dependencies..."
        pip install -r requirements.txt --quiet 2>&1 || pip install -r requirements.txt
    else
        echo "Python dependencies already installed"
    fi
}

# 执行数据库初始化
run_db_init() {
    cd "${COZE_WORKSPACE_PATH}"
    echo "Running database initialization..."
    
    if [ -n "${DATABASE_URL:-}" ]; then
        npx tsx scripts/db-init.ts 2>&1 || echo "Database initialization completed with warnings"
    else
        echo "No DATABASE_URL found, skipping database initialization"
    fi
}

start_service() {
    cd "${COZE_WORKSPACE_PATH}"
    echo "Starting HTTP service on port ${DEPLOY_RUN_PORT} for deploy..."
    npx next start --port ${DEPLOY_RUN_PORT}
}

# 确保依赖、初始化数据库、启动服务
ensure_python_deps
run_db_init
start_service
