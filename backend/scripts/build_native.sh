#!/usr/bin/env bash
# Build the native C++ search core: backend/native/solver
set -euo pipefail
cd "$(dirname "$0")/.."
CXX="${CXX:-g++}"
"$CXX" -O3 -std=c++17 -o native/solver native/schedulergod_solver.cpp
echo "built native/solver"
