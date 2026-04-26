#!/usr/bin/env bash
set -euo pipefail

UUID="prime-select-quick-toggle@rura.local"
HELPER_PATH="/usr/local/sbin/prime-mode-switch"
DEST_DIR="${HOME}/.local/share/gnome-shell/extensions/${UUID}"

REMOVE_HELPER=0

usage() {
    printf 'Usage: %s [--remove-helper]\n' "$0"
}

while (($#)); do
    case "$1" in
        --remove-helper)
            REMOVE_HELPER=1
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            usage >&2
            exit 2
            ;;
    esac
    shift
done

if [[ "${EUID}" -eq 0 ]]; then
    printf 'Do not run this script with sudo. It removes the user extension from your account.\n' >&2
    exit 1
fi

if command -v gnome-extensions >/dev/null 2>&1; then
    gnome-extensions disable "${UUID}" >/dev/null 2>&1 || true
fi

if [[ -d "${DEST_DIR}" ]]; then
    printf 'Removing extension from %s\n' "${DEST_DIR}"
    rm -rf -- "${DEST_DIR}"
else
    printf 'Extension directory was not present: %s\n' "${DEST_DIR}"
fi

if [[ "${REMOVE_HELPER}" -eq 1 ]]; then
    if [[ -e "${HELPER_PATH}" ]]; then
        printf 'Removing root helper from %s\n' "${HELPER_PATH}"
        sudo rm -f -- "${HELPER_PATH}"
    else
        printf 'Root helper was not present: %s\n' "${HELPER_PATH}"
    fi
else
    printf 'Keeping root helper. Run %s --remove-helper to remove %s too.\n' "$0" "${HELPER_PATH}"
fi

printf '\nDone. Log out and back in if GNOME Shell still shows the old tile.\n'
