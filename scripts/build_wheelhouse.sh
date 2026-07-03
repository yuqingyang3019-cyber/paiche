#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

rm -rf agent/wheelhouse
mkdir -p agent/wheelhouse

if [ "$(uname -s)" = "Linux" ]; then
  python3 -m pip install --upgrade pip
  python3 -m pip wheel --wheel-dir agent/wheelhouse -r agent/requirements.txt
  echo "wheelhouse ready (linux native): agent/wheelhouse"
  exit 0
fi

echo "非 Linux 环境，优先用 pip download 拉取 manylinux wheel..."
python3 -m pip install --upgrade pip
if python3 -m pip download -r agent/requirements.txt -d agent/wheelhouse \
  --platform manylinux2014_x86_64 --python-version 3.12 --only-binary=:all:; then
  echo "wheelhouse ready (pip download): agent/wheelhouse"
  exit 0
fi

echo "pip download 失败，尝试 Docker 构建 manylinux wheel..."
docker pull quay.io/pypa/manylinux_2_28_x86_64

for attempt in 1 2 3; do
  echo "wheelhouse build attempt ${attempt}/3"
  if docker run --rm --platform linux/amd64 \
    -v "$PWD":/io \
    -w /io \
    quay.io/pypa/manylinux_2_28_x86_64 \
    /opt/python/cp312-cp312/bin/python -m pip wheel \
      --wheel-dir agent/wheelhouse \
      -r agent/requirements.txt; then
    echo "wheelhouse ready (docker): agent/wheelhouse"
    exit 0
  fi
  sleep 15
done

echo "wheelhouse build failed" >&2
exit 1
