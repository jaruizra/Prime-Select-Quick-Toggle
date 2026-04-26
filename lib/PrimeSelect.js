import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export const PROFILE_INTEL = 'intel';
export const PROFILE_ON_DEMAND = 'on-demand';
export const PROFILE_NVIDIA = 'nvidia';
export const PROFILE_UNKNOWN = 'unknown';

export const HELPER_PATH = '/usr/local/sbin/prime-mode-switch';

const SWITCHABLE_PROFILES = [
    PROFILE_INTEL,
    PROFILE_ON_DEMAND,
    PROFILE_NVIDIA,
];

const PROFILE_LABELS = {
    [PROFILE_INTEL]: 'Intel',
    [PROFILE_ON_DEMAND]: 'On-Demand',
    [PROFILE_NVIDIA]: 'NVIDIA',
    [PROFILE_UNKNOWN]: 'Unknown',
};

export function isValidProfile(profile) {
    return SWITCHABLE_PROFILES.includes(profile);
}

export function getProfileLabel(profile) {
    return PROFILE_LABELS[profile] ?? PROFILE_LABELS[PROFILE_UNKNOWN];
}

export function getCurrentProfile() {
    if (!isPrimeSelectAvailable())
        return PROFILE_UNKNOWN;

    try {
        const proc = Gio.Subprocess.new(
            ['prime-select', 'query'],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );
        const [, stdout] = proc.communicate_utf8(null, null);
        const profile = (stdout ?? '').trim().toLowerCase();

        if (proc.get_successful() && isValidProfile(profile))
            return profile;
    } catch (e) {
        logError(e, 'Failed to query prime-select');
    }

    return PROFILE_UNKNOWN;
}

export function switchProfile(profile, onComplete) {
    if (!isValidProfile(profile)) {
        _finish(onComplete, {
            ok: false,
            status: 2,
            error: 'Invalid PRIME profile.',
        });
        return;
    }

    let proc;
    try {
        proc = Gio.Subprocess.new(
            ['pkexec', HELPER_PATH, profile],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );
    } catch (e) {
        logError(e, 'Failed to start PRIME profile switch');
        _finish(onComplete, {
            ok: false,
            status: -1,
            error: e.message,
        });
        return;
    }

    proc.communicate_utf8_async(null, null, (source, result) => {
        try {
            const [, stdout, stderr] = source.communicate_utf8_finish(result);
            const errorText = (stderr ?? '').trim();
            const status = source.get_exit_status();

            _finish(onComplete, {
                ok: source.get_successful(),
                status,
                stdout: (stdout ?? '').trim(),
                stderr: errorText,
                error: _getSwitchError(status, errorText),
            });
        } catch (e) {
            logError(e, 'Failed while switching PRIME profile');
            _finish(onComplete, {
                ok: false,
                status: -1,
                error: e.message,
            });
        }
    });
}

export function getSetupProblem() {
    if (!isPrimeSelectAvailable()) {
        return {
            title: 'prime-select is missing',
            message: 'Install the Ubuntu nvidia-prime package so prime-select is available.',
        };
    }

    return _getHelperProblem();
}

export function isPrimeSelectAvailable() {
    return GLib.find_program_in_path('prime-select') !== null;
}

function _getHelperProblem() {
    if (!GLib.file_test(HELPER_PATH, GLib.FileTest.EXISTS)) {
        return {
            title: 'Root helper is missing',
            message: `Install the root-owned helper at ${HELPER_PATH}. See the README for the exact script.`,
        };
    }

    if (!GLib.file_test(HELPER_PATH, GLib.FileTest.IS_REGULAR)) {
        return {
            title: 'Root helper is not a regular file',
            message: `Replace ${HELPER_PATH} with the helper script documented in the README.`,
        };
    }

    if (!GLib.file_test(HELPER_PATH, GLib.FileTest.IS_EXECUTABLE)) {
        return {
            title: 'Root helper is not executable',
            message: `Run: sudo chmod 755 ${HELPER_PATH}`,
        };
    }

    try {
        const info = Gio.File.new_for_path(HELPER_PATH).query_info(
            'unix::uid,unix::mode',
            Gio.FileQueryInfoFlags.NONE,
            null
        );
        const uid = info.get_attribute_uint32('unix::uid');
        const mode = info.get_attribute_uint32('unix::mode');

        if (uid !== 0) {
            return {
                title: 'Root helper must be owned by root',
                message: `Run: sudo chown root:root ${HELPER_PATH}`,
            };
        }

        if ((mode & 0o022) !== 0) {
            return {
                title: 'Root helper is writable by non-root users',
                message: `Run: sudo chmod 755 ${HELPER_PATH}`,
            };
        }
    } catch (e) {
        logError(e, 'Failed to inspect PRIME helper');
        return {
            title: 'Root helper cannot be checked',
            message: `Check ownership and permissions for ${HELPER_PATH}.`,
        };
    }

    return null;
}

function _getSwitchError(status, stderr) {
    if (status === 0)
        return '';

    if (status === 126 || status === 127 || /cancel|dismiss|not authorized/i.test(stderr))
        return 'Authentication was cancelled or failed.';

    return stderr || `Profile switch failed with exit status ${status}.`;
}

function _finish(callback, result) {
    if (typeof callback === 'function')
        callback(result);
}
