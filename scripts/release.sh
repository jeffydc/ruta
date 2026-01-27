#!/usr/bin/env bash

set -xeu

SCRIPT_DIR="$(dirname "$(realpath "${0}")")"
PKGS_DIR="$(realpath "${SCRIPT_DIR}/../packages")"
JSON_FILES="$(find "${PKGS_DIR}" -depth -maxdepth 2 -type f -name 'package.json' -o -name 'deno.json')"

version="0.0.$(date +%s)"
for file in ${JSON_FILES}; do
	updated="$(jq ".version = \"${version}\"" "${file}")"
	echo "${updated}" > "${file}"
done

for dir in "${PKGS_DIR}"/*; do
	cp "${SCRIPT_DIR}/../README.md" "${dir}"
	cp "${SCRIPT_DIR}/../LICENSE" "${dir}"
done

echo '' > "${PKGS_DIR}/ruta-vue/components.ts"
echo '' > "${PKGS_DIR}/ruta-svelte/components.ts"

set +x

echo ===================================================================
for file in ${JSON_FILES}; do
	echo "Updated version to ${version} in ${file}"
done

echo "Publishing with deno publish..."
deno publish --no-check --allow-dirty "${@}"
echo ===================================================================
