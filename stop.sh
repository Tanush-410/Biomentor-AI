#!/bin/bash
# Stop the VYDRA CORE dev servers started by start.sh.
cd "$(dirname "$0")"

stop_pid_file() {
    local name="$1"
    local pid_file=".run/$1.pid"
    if [ -f "$pid_file" ]; then
        local pid
        pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null
            echo "Stopped $name (pid $pid)."
        else
            echo "$name was not running."
        fi
        rm -f "$pid_file"
    else
        echo "No pid file for $name."
    fi
}

stop_pid_file backend
stop_pid_file frontend

# --reload and `npm run dev` spawn child processes, so also clear
# whatever ends up listening on the app's ports as a safety net.
for port in 8000 3000; do
    pids=$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null)
    if [ -n "$pids" ]; then
        echo "$pids" | xargs kill 2>/dev/null
        echo "Cleared remaining process(es) on port $port."
    fi
done
