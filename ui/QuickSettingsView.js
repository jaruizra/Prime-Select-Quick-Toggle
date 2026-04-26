import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import GObject from 'gi://GObject';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

import * as PrimeSelect from '../lib/PrimeSelect.js';

const PROFILE_ACTIONS = [
    [PrimeSelect.PROFILE_INTEL, 'Switch to Intel'],
    [PrimeSelect.PROFILE_ON_DEMAND, 'Switch to On-Demand'],
    [PrimeSelect.PROFILE_NVIDIA, 'Switch to NVIDIA'],
];

export const QuickSettingsToggle = GObject.registerClass(
class QuickSettingsToggle extends QuickSettings.QuickMenuToggle {  
    _init() {
        this._profile = PrimeSelect.getCurrentProfile();
        this._switching = false;

        super._init({
            title: 'GPU',
            subtitle: PrimeSelect.getProfileLabel(this._profile),
            iconName: 'power-profile-performance-symbolic',
            toggleMode: false,
            checked: this._profile === PrimeSelect.PROFILE_ON_DEMAND ||
                this._profile === PrimeSelect.PROFILE_NVIDIA,
        });

        this.menu.setHeader('power-profile-performance-symbolic', this.title, 'Current PRIME mode');
        this._openStateId = this.menu.connect('open-state-changed', (_menu, open) => {
            if (open)
                this._refresh();
        });

        this._itemsSection = new PopupMenu.PopupMenuSection();
        this._profileItems = [];
        for (const [profile, label] of PROFILE_ACTIONS) {
            const item = this._itemsSection.addAction(label, () => this._confirmSwitch(profile));
            this._profileItems.push([profile, item]);
        }
        this.menu.addMenuItem(this._itemsSection);

        this._setupSeparator = new PopupMenu.PopupSeparatorMenuItem();
        this.menu.addMenuItem(this._setupSeparator);
        this._setupItem = this.menu.addAction('Setup required', () => this._showSetupProblem());

        this._refresh();
    }

    _refresh() {
        this._setupProblem = PrimeSelect.getSetupProblem();
        this._profile = PrimeSelect.getCurrentProfile();
        this.subtitle = PrimeSelect.getProfileLabel(this._profile);
        this.checked = this._profile === PrimeSelect.PROFILE_ON_DEMAND ||
            this._profile === PrimeSelect.PROFILE_NVIDIA;
        this._setupSeparator.visible = this._setupProblem !== null;
        this._setupItem.visible = this._setupProblem !== null;
        this.menu.setHeader(
            'power-profile-performance-symbolic',
            this.title,
            this._setupProblem?.title ?? 'Current PRIME mode'
        );

        for (const [profile, item] of this._profileItems) {
            item.setSensitive(
                this._setupProblem === null &&
                !this._switching &&
                profile !== this._profile
            );
        }
    }

    _confirmSwitch(profile) {
        if (this._switching || profile === this._profile)
            return;

        if (this._setupProblem) {
            this._showSetupProblem();
            return;
        }

        const label = PrimeSelect.getProfileLabel(profile);
        const dialog = new ModalDialog.ModalDialog();

        dialog.contentLayout.add_child(new St.Label({
            text: `Switch GPU profile to ${label}?`,
            style_class: 'message-dialog-title',
        }));
        dialog.contentLayout.add_child(new St.Label({
            text: `This will run prime-select ${profile} and reboot the system.`,
            style_class: 'message-dialog-description',
        }));
        dialog.setButtons([
            {
                label: 'Cancel',
                action: () => dialog.close(),
                key: Clutter.KEY_Escape,
            },
            {
                label: 'Switch and Reboot',
                action: () => {
                    dialog.close();
                    this._switchProfile(profile);
                },
                default: true,
            },
        ]);
        dialog.open();
    }

    _switchProfile(profile) {
        this._switching = true;
        this.subtitle = 'Switching...';
        this.menu.setHeader(
            'power-profile-performance-symbolic',
            this.title,
            `Switching to ${PrimeSelect.getProfileLabel(profile)}`
        );
        for (const [, item] of this._profileItems)
            item.setSensitive(false);

        PrimeSelect.switchProfile(profile, result => this._onSwitchComplete(result));
    }

    _onSwitchComplete(result) {
        this._switching = false;

        if (result.ok) {
            this.subtitle = 'Rebooting...';
            this.menu.setHeader('power-profile-performance-symbolic', this.title, 'Rebooting');
            return;
        }

        this._refresh();
        Main.notifyError('Prime Select Quick Toggle', result.error || 'Unable to switch PRIME profile.');
    }

    _showSetupProblem() {
        const problem = this._setupProblem ?? PrimeSelect.getSetupProblem();
        if (problem)
            Main.notifyError(problem.title, problem.message);
    }

    destroy() {
        if (this._openStateId) {
            this.menu.disconnect(this._openStateId);
            this._openStateId = 0;
        }
        super.destroy();
    }
});

export const QuickSettingsIndicator = GObject.registerClass(
class QuickSettingsIndicator extends QuickSettings.SystemIndicator {
    _init() {
        super._init();
    }

    enable() {
        this._indicator = this._addIndicator();
        this._indicator.icon_name = 'power-profile-performance-symbolic';
        this._indicator.visible = false;
    }

    disable() {
        this.quickSettingsItems.forEach(item => item.destroy());
        this.quickSettingsItems = [];
        this._indicator?.destroy();
        this._indicator = null;
        this.destroy();
    }
});
