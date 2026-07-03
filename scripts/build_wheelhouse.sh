#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

rm -rf agent/wheelhouse
mkdir -p agent/wheelhouse

docker pull quay.io/pypa/manylinux_2_28_x86_64

for attempt in 1 2 3; do
  echo "wheelhouse build attempt ${attempt}/3"
  if docker run --rm \
    -v "$PWD":/io \
    -w /io \
    quay.io/pypa/manylinux_2_28_x86_64 \
    /opt/python/cp312-cp312/bin/python -m pip wheel \
      --wheel-dir agent/wheelhouse \
      -r agent/requirements.txt; then
    echo "wheelhouse ready: agent/wheelhouse"
    exit 0
  fi
  sleep 15
done

echo "wheelhouse build failed" >&2
exit 1
