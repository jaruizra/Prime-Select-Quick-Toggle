Paste this as `CODEX.md`, `AGENTS.md`, or a README section.

````markdown
# Implementation Plan for Codex / AI Agent

## Project

**Prime Select Quick Toggle**

A GNOME Shell Quick Settings extension for Ubuntu laptops that switches NVIDIA PRIME GPU profiles using `prime-select` and reboots to apply the change.

Target environment:

- Ubuntu 26.04
- GNOME Shell 50
- NVIDIA PRIME / `nvidia-prime`
- GNOME Quick Settings menu
- JavaScript / GJS extension

GNOME Quick Settings extensions should use the GNOME 45+ Quick Settings APIs such as `QuickSettings.SystemIndicator`, `QuickSettings.QuickMenuToggle`, and `Main.panel.statusArea.quickSettings.addExternalIndicator(...)`. GNOME’s GNOME 50 porting guide says there were no relevant `metadata.json` changes for GNOME 50.  
References: GNOME Quick Settings docs and GNOME 50 port guide.

## Important policy / quality constraint

This project may be AI-assisted, but the final code must be human-reviewable, simple, and explainable.

GNOME extension review guidelines say extensions must not be AI-generated, must not contain unnecessary code, imaginary APIs, prompt-like comments, or inconsistent style. They also say privileged subprocesses should be avoided, and if needed, must use `pkexec` and must not run a user-writable executable/script.  
Reference: GNOME Shell Extensions review guidelines.

Therefore:

- Do not add “AI prompt” comments.
- Do not add unnecessary `try/catch` blocks.
- Do not invent GNOME APIs.
- Keep code small and idiomatic.
- Do not run `sudo` from the extension.
- Use `pkexec` for privileged actions.
- Any privileged helper must be root-owned and not user-writable.

## Existing upstream to fork

Use this project as the starting point:

```text
LorenzoMorelli/GPU_profile_selector
````

Reason:

* It already targets GNOME Quick Settings.
* It is newer than older PRIME extensions.
* It already has a profile-selector UI pattern.
* Its backend currently uses `envycontrol`; replace that with Ubuntu `prime-select`.

Older projects like PRIME Helper, Prime Indicator, or PRIME GPU Profile Selector can be used for ideas only, but should not be the main base.

## Functional goal

Expose GPU profile options in GNOME Quick Settings:

```text
Intel
On-Demand
NVIDIA
```

Each option should:

1. Ask for administrator permission via `pkexec`.
2. Run the appropriate `prime-select` mode.
3. Reboot the machine after a successful profile switch.

Ubuntu `prime-select` supports:

```bash
prime-select nvidia
prime-select intel
prime-select on-demand
prime-select query
```

Reference: Ubuntu `nvidia-prime` / `prime-select`.

## Repository naming

Use:

```text
Repo name: prime-select-quick-toggle
Extension name: Prime Select Quick Toggle
UUID: prime-select-quick-toggle@rura.local
```

`metadata.json`:

```json
{
  "uuid": "prime-select-quick-toggle@rura.local",
  "name": "Prime Select Quick Toggle",
  "description": "GNOME Quick Settings extension for Ubuntu NVIDIA PRIME profile switching via prime-select.",
  "shell-version": ["50"],
  "url": "https://github.com/YOUR_USERNAME/prime-select-quick-toggle",
  "gettext-domain": "prime-select-quick-toggle"
}
```

Do not claim support for unsupported or future GNOME Shell versions.

## Implementation steps

### 1. Fork and rename

Clone the upstream extension:

```bash
git clone https://github.com/LorenzoMorelli/GPU_profile_selector.git prime-select-quick-toggle
cd prime-select-quick-toggle
```

Rename project metadata:

* Update `metadata.json`
* Update README title
* Replace old UUID with:

```text
prime-select-quick-toggle@rura.local
```

Remove or rename references to:

```text
GPU Profile Selector
envycontrol
```

where appropriate.

### 2. Remove EnvyControl-specific logic

Search the codebase:

```bash
grep -R "envycontrol" -n .
grep -R "rtd3" -n .
grep -R "coolbits" -n .
grep -R "force-composition" -n .
```

Remove or disable features that only apply to `envycontrol`, such as:

```text
rtd3
coolbits
force-composition-pipeline
```

This fork should be minimal:

```text
query current PRIME mode
switch to intel / on-demand / nvidia
reboot
```

### 3. Implement Ubuntu PRIME backend

Create or rewrite the utility backend, for example:

```text
lib/PrimeSelect.js
```

Required behavior:

```js
getCurrentProfile()
switchProfile(profile)
```

Expected profiles:

```js
const PROFILE_INTEL = 'intel';
const PROFILE_ON_DEMAND = 'on-demand';
const PROFILE_NVIDIA = 'nvidia';
const PROFILE_UNKNOWN = 'unknown';
```

`getCurrentProfile()` should run:

```bash
prime-select query
```

and return one of:

```text
intel
on-demand
nvidia
unknown
```

`switchProfile(profile)` should run:

```bash
pkexec /usr/local/sbin/prime-mode-switch profile
```

Do not call `sudo`.

Do not call `prime-select` directly with elevated privileges from inside the extension unless using `pkexec`.

### 4. Add required root helper documentation

The GNOME extension cannot safely install a root-owned helper itself. Document that the user must install this helper manually:

```bash
sudo nano /usr/local/sbin/prime-mode-switch
```

Helper content:

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

Permissions:

```bash
sudo chown root:root /usr/local/sbin/prime-mode-switch
sudo chmod 755 /usr/local/sbin/prime-mode-switch
```

The extension must check whether this helper exists and is executable. If not, show a clear menu item or notification explaining how to install it.

### 5. Implement Quick Settings UI

Use the existing upstream Quick Settings UI as a base.

Required UI:

* One Quick Settings tile named:

```text
GPU
```

* Current subtitle:

```text
Intel
On-Demand
NVIDIA
Unknown
```

* Menu actions:

```text
Switch to Intel
Switch to On-Demand
Switch to NVIDIA
```

Recommended behavior:

* Selecting current mode should do nothing.
* Selecting a different mode should show a confirmation dialog before reboot.
* Confirmation text should mention that the computer will reboot.

Example confirmation text:

```text
Switch GPU profile to NVIDIA?

This will run prime-select nvidia and reboot the system.
```

### 6. Reboot confirmation

Before running `pkexec`, show a confirmation dialog.

Acceptance criteria:

* User can cancel.
* Cancel does not run any command.
* Confirm runs the selected switch command.
* The extension does not freeze the Shell while waiting.

Use asynchronous subprocess handling where possible.

### 7. Error handling

Handle these cases:

```text
prime-select missing
helper missing
pkexec cancelled
invalid profile
command failed
unknown current profile
```

Show user-facing errors with GNOME notifications or dialog text.

Do not spam logs.

Only log useful debug/error messages.

### 8. Test locally

Install locally:

```bash
mkdir -p ~/.local/share/gnome-shell/extensions/prime-select-quick-toggle@rura.local
cp -r . ~/.local/share/gnome-shell/extensions/prime-select-quick-toggle@rura.local/
```

Compile schemas only if the extension has schemas:

```bash
glib-compile-schemas ~/.local/share/gnome-shell/extensions/prime-select-quick-toggle@rura.local/schemas/
```

Log out and log back in.

Enable:

```bash
gnome-extensions enable prime-select-quick-toggle@rura.local
```

Check logs:

```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

### 9. Test matrix

Test the following manually:

| Test                                     | Expected result                            |
| ---------------------------------------- | ------------------------------------------ |
| `prime-select query` returns `on-demand` | Tile subtitle shows `On-Demand`            |
| Select current mode                      | No reboot, no command                      |
| Select NVIDIA                            | Confirmation dialog appears                |
| Cancel confirmation                      | Nothing happens                            |
| Confirm NVIDIA                           | `pkexec` prompt appears                    |
| Cancel pkexec                            | No reboot                                  |
| Authenticate pkexec                      | `prime-select nvidia` runs, system reboots |
| Missing helper                           | Extension shows clear install instructions |
| Missing `prime-select`                   | Extension shows dependency error           |
| Unknown query result                     | Tile shows `Unknown`                       |

### 10. Packaging

Package with:

```bash
gnome-extensions pack prime-select-quick-toggle@rura.local
```

Install test package:

```bash
gnome-extensions install --force prime-select-quick-toggle@rura.local.shell-extension.zip
```

Log out/in and enable again.

### 11. README requirements

README must include:

* What the extension does
* Ubuntu-only scope
* GNOME Shell 50 target
* Dependency on `nvidia-prime`
* Manual helper installation
* Why `pkexec` is used instead of `sudo`
* Warning that switching PRIME mode requires reboot
* Troubleshooting section

### 12. Acceptance criteria

The implementation is complete when:

* Extension loads on GNOME Shell 50.
* Quick Settings tile appears.
* Current PRIME profile is displayed.
* Intel, On-Demand, and NVIDIA options are available.
* Switching profile uses `pkexec`.
* Root helper is not user-writable.
* User gets confirmation before reboot.
* Cancel paths are safe.
* Code is small, readable, and reviewable.
* No AI-prompt comments or unnecessary generated-looking code remain.

```

For the citations behind the plan: GNOME documents Quick Settings as the supported GNOME 45+ system-menu extension pattern, GNOME’s GNOME 50 port guide says there were no relevant metadata changes for GNOME 50, Ubuntu’s `prime-select` supports `nvidia|intel|on-demand|query`, and GNOME review guidelines require readable code, careful subprocess handling, `pkexec` for unavoidable privileged subprocesses, and no AI-generated extension submissions. :contentReference[oaicite:0]{index=0}
::contentReference[oaicite:1]{index=1}
```
