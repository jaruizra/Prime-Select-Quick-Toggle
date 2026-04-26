#!/usr/bin/env bash
set -euo pipefail

UUID="prime-select-quick-toggle@rura.local"
HELPER_PATH="/usr/local/sbin/prime-mode-switch"
SRC_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEST_DIR="${HOME}/.local/share/gnome-shell/extensions/${UUID}"

INSTALL_HELPER=1
ENABLE_EXTENSION=1

usage() {
    printf 'Usage: %s [--no-helper] [--no-enable]\n' "$0"
}

while (($#)); do
    case "$1" in
        --no-helper)
            INSTALL_HELPER=0
            ;;
        --no-enable)
            ENABLE_EXTENSION=0
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
    printf 'Do not run this script with sudo. It installs the extension for your user account.\n' >&2
    exit 1
fi

if [[ ! -f "${SRC_DIR}/metadata.json" || ! -f "${SRC_DIR}/extension.js" ]]; then
    printf 'Run this script from the Prime Select Quick Toggle repository.\n' >&2
    exit 1
fi

install_extension() {
    printf 'Installing extension to %s\n' "${DEST_DIR}"
    rm -rf -- "${DEST_DIR}"
    install -d -- "${DEST_DIR}"

    cp -a -- \
        "${SRC_DIR}/extension.js" \
        "${SRC_DIR}/metadata.json" \
        "${SRC_DIR}/lib" \
        "${SRC_DIR}/ui" \
        "${SRC_DIR}/README.md" \
        "${SRC_DIR}/LICENSE" \
        "${DEST_DIR}/"
    install -d -- "${DEST_DIR}/img"
    cp -a -- "${SRC_DIR}/img/icon.png" "${DEST_DIR}/img/"

    if [[ -d "${SRC_DIR}/schemas" ]] && find "${SRC_DIR}/schemas" -name '*.xml' -print -quit | grep -q .; then
        cp -a -- "${SRC_DIR}/schemas" "${DEST_DIR}/"
        glib-compile-schemas "${DEST_DIR}/schemas"
    fi
}

install_helper() {
    if ! command -v sudo >/dev/null 2>&1; then
        printf 'sudo is required to install %s\n' "${HELPER_PATH}" >&2
        return 1
    fi

    local tmp_helper
    tmp_helper="$(mktemp)"
    trap 'rm -f -- "${tmp_helper}"; trap - RETURN' RETURN

    cat > "${tmp_helper}" <<'HELPER'
#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"

case "$MODE" in
  nvidia|on-demand|intel)
    ;;
  *)
    echo "Usage: prime-mode-switch nvidia|on-demand|intel" >&2
    exit 2
    ;;
esac

/usr/bin/prime-select "$MODE"
/usr/bin/systemctl reboot
HELPER

    printf 'Installing root helper to %s\n' "${HELPER_PATH}"
    sudo install -o root -g root -m 0755 -- "${tmp_helper}" "${HELPER_PATH}"
}

warn_missing_dependency() {
    local command_name="$1"
    local package_hint="$2"

    if ! command -v "${command_name}" >/dev/null 2>&1; then
        printf 'Warning: %s was not found. Install %s before using the extension.\n' \
            "${command_name}" "${package_hint}" >&2
    fi
}

enable_extension() {
    if [[ "${ENABLE_EXTENSION}" -eq 0 ]]; then
        return
    fi

    if ! command -v gnome-extensions >/dev/null 2>&1; then
        printf 'gnome-extensions was not found. Enable %s manually after logging in again.\n' "${UUID}" >&2
        return
    fi

    if ! gnome-extensions enable "${UUID}"; then
        printf 'Installed, but GNOME Shell could not enable it yet. Log out and back in, then run:\n'
        printf '  gnome-extensions enable %s\n' "${UUID}"
    fi
}

install_extension

if [[ "${INSTALL_HELPER}" -eq 1 ]]; then
    install_helper
else
    printf 'Skipped root helper installation. The extension will show setup required until %s exists.\n' "${HELPER_PATH}"
fi

warn_missing_dependency prime-select 'the Ubuntu nvidia-prime package'
warn_missing_dependency pkexec 'the pkexec and polkitd packages'

enable_extension

printf '\nDone. If the tile does not appear immediately, log out and back in.\n'
