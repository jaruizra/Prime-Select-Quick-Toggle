import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Extension from 'resource:///org/gnome/shell/extensions/extension.js';

import * as QuickSettingsView from './ui/QuickSettingsView.js';


export default class PrimeSelectQuickToggle extends Extension.Extension {
    enable() {
        this._indicator = new QuickSettingsView.QuickSettingsIndicator();
        this._indicator.quickSettingsItems.push(new QuickSettingsView.QuickSettingsToggle());
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
        this._indicator.enable();
    }

    disable() {
        this._indicator?.disable();
        this._indicator = null;
    }
}
