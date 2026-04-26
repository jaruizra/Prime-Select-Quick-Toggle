# Prime Select Quick Toggle

Prime Select Quick Toggle is a GNOME Shell 50 Quick Settings extension for Ubuntu laptops with NVIDIA PRIME. It shows the current PRIME profile and offers three actions:

- Switch to Intel
- Switch to On-Demand
- Switch to NVIDIA

Switching PRIME mode requires a reboot. The extension asks for confirmation, requests administrator authentication with `pkexec`, and then runs a small root-owned helper that calls `prime-select` and reboots.

## Scope

This extension targets:

- Ubuntu 26.04
- GNOME Shell 50
- NVIDIA PRIME through Ubuntu's `nvidia-prime` package

It is not intended for non-Ubuntu PRIME tools.

## Dependencies

Install the Ubuntu PRIME tooling and PolicyKit helper packages:

```bash
sudo apt install nvidia-prime pkexec polkitd
```

Confirm that `prime-select` works:

```bash
prime-select query
```

## Root Helper

GNOME Shell extensions should not run `sudo`, and this extension does not install privileged files itself. Install the helper manually:

```bash
sudo nano /usr/local/sbin/prime-mode-switch
```

Use this content:

```bash
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
```

Set safe ownership and permissions:

```bash
sudo chown root:root /usr/local/sbin/prime-mode-switch
sudo chmod 755 /usr/local/sbin/prime-mode-switch
```

The helper must be root-owned and not writable by non-root users. The extension calls it through:

```bash
pkexec /usr/local/sbin/prime-mode-switch <mode>
```

`pkexec` is used because GNOME extension review guidance expects PolicyKit for unavoidable privileged subprocesses. `sudo` is terminal-oriented and should not be used from the Shell UI.

## Script Installation

From the repository root:

```bash
./install.sh
```

The installer copies the extension into `~/.local/share/gnome-shell/extensions/prime-select-quick-toggle@rura.local`, installs the root-owned helper with `sudo install`, and tries to enable the extension.

To install only the extension and skip the helper:

```bash
./install.sh --no-helper
```

To remove the extension:

```bash
./uninstall.sh
```

To remove both the extension and helper:

```bash
./uninstall.sh --remove-helper
```

Log out and log back in if GNOME Shell has not loaded or unloaded the extension yet.

## Packaging

From the repository root:

```bash
gnome-extensions pack . --force \
  --extra-source=README.md \
  --extra-source=LICENSE \
  --extra-source=lib \
  --extra-source=ui \
  --extra-source=img/icon.png
gnome-extensions install --force prime-select-quick-toggle@rura.local.shell-extension.zip
```

## Troubleshooting

- Tile shows `Unknown`: run `prime-select query` in a terminal and verify it returns `intel`, `on-demand`, or `nvidia`.
- Setup notification says `prime-select` is missing: install `nvidia-prime`.
- Setup notification says the helper is missing: create `/usr/local/sbin/prime-mode-switch` with the script above.
- Setup notification says the helper has unsafe permissions: run the `chown` and `chmod` commands above.
- No authentication prompt appears: confirm a PolicyKit authentication agent is running in your session.
- Switching appears to do nothing: check the GNOME Shell log with `journalctl -f -o cat /usr/bin/gnome-shell`.

## Credits

This fork is based on GPU Profile Selector by Lorenzo Morelli and contributors, released under GPL-3.0-or-later.
