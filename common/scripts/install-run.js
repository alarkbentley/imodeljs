"use strict";
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// See the @microsoft/rush package's LICENSE file for license information.
Object.defineProperty(exports, "__esModule", { value: true });
// THIS FILE WAS GENERATED BY A TOOL. ANY MANUAL MODIFICATIONS WILL GET OVERWRITTEN WHENEVER RUSH IS UPGRADED.
//
// This script is intended for usage in an automated build environment where a Node tool may not have
// been preinstalled, or may have an unpredictable version.  This script will automatically install the specified
// version of the specified tool (if not already installed), and then pass a command-line to it.
// An example usage would be:
//
//    node common/scripts/install-run.js qrcode@1.2.2 qrcode https://rushjs.io
//
// For more information, see: https://rushjs.io/pages/maintainer/setup_new_repo/
const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
exports.RUSH_JSON_FILENAME = 'rush.json';
const RUSH_TEMP_FOLDER_ENV_VARIABLE_NAME = 'RUSH_TEMP_FOLDER';
const INSTALLED_FLAG_FILENAME = 'installed.flag';
const NODE_MODULES_FOLDER_NAME = 'node_modules';
const PACKAGE_JSON_FILENAME = 'package.json';
/**
 * Parse a package specifier (in the form of name\@version) into name and version parts.
 */
function _parsePackageSpecifier(rawPackageSpecifier) {
    rawPackageSpecifier = (rawPackageSpecifier || '').trim();
    const separatorIndex = rawPackageSpecifier.lastIndexOf('@');
    let name;
    let version = undefined;
    if (separatorIndex === 0) {
        // The specifier starts with a scope and doesn't have a version specified
        name = rawPackageSpecifier;
    }
    else if (separatorIndex === -1) {
        // The specifier doesn't have a version
        name = rawPackageSpecifier;
    }
    else {
        name = rawPackageSpecifier.substring(0, separatorIndex);
        version = rawPackageSpecifier.substring(separatorIndex + 1);
    }
    if (!name) {
        throw new Error(`Invalid package specifier: ${rawPackageSpecifier}`);
    }
    return { name, version };
}
/**
 * As a workaround, copyAndTrimNpmrcFile() copies the .npmrc file to the target folder, and also trims
 * unusable lines from the .npmrc file.
 *
 * Why are we trimming the .npmrc lines?  NPM allows environment variables to be specified in
 * the .npmrc file to provide different authentication tokens for different registry.
 * However, if the environment variable is undefined, it expands to an empty string, which
 * produces a valid-looking mapping with an invalid URL that causes an error.  Instead,
 * we'd prefer to skip that line and continue looking in other places such as the user's
 * home directory.
 *
 * IMPORTANT: THIS CODE SHOULD BE KEPT UP TO DATE WITH Utilities.copyAndTrimNpmrcFile()
 */
function _copyAndTrimNpmrcFile(sourceNpmrcPath, targetNpmrcPath) {
    console.log(`Copying ${sourceNpmrcPath} --> ${targetNpmrcPath}`); // Verbose
    let npmrcFileLines = fs.readFileSync(sourceNpmrcPath).toString().split('\n');
    npmrcFileLines = npmrcFileLines.map((line) => (line || '').trim());
    const resultLines = [];
    // This finds environment variable tokens that look like "${VAR_NAME}"
    const expansionRegExp = /\$\{([^\}]+)\}/g;
    // Comment lines start with "#" or ";"
    const commentRegExp = /^\s*[#;]/;
    // Trim out lines that reference environment variables that aren't defined
    for (const line of npmrcFileLines) {
        let lineShouldBeTrimmed = false;
        // Ignore comment lines
        if (!commentRegExp.test(line)) {
            const environmentVariables = line.match(expansionRegExp);
            if (environmentVariables) {
                for (const token of environmentVariables) {
                    // Remove the leading "${" and the trailing "}" from the token
                    const environmentVariableName = token.substring(2, token.length - 1);
                    // Is the environment variable defined?
                    if (!process.env[environmentVariableName]) {
                        // No, so trim this line
                        lineShouldBeTrimmed = true;
                        break;
                    }
                }
            }
        }
        if (lineShouldBeTrimmed) {
            // Example output:
            // "; MISSING ENVIRONMENT VARIABLE: //my-registry.com/npm/:_authToken=${MY_AUTH_TOKEN}"
            resultLines.push('; MISSING ENVIRONMENT VARIABLE: ' + line);
        }
        else {
            resultLines.push(line);
        }
    }
    fs.writeFileSync(targetNpmrcPath, resultLines.join(os.EOL));
}
/**
 * syncNpmrc() copies the .npmrc file to the target folder, and also trims unusable lines from the .npmrc file.
 * If the source .npmrc file not exist, then syncNpmrc() will delete an .npmrc that is found in the target folder.
 *
 * IMPORTANT: THIS CODE SHOULD BE KEPT UP TO DATE WITH Utilities._syncNpmrc()
 */
function _syncNpmrc(sourceNpmrcFolder, targetNpmrcFolder, useNpmrcPublish) {
    const sourceNpmrcPath = path.join(sourceNpmrcFolder, !useNpmrcPublish ? '.npmrc' : '.npmrc-publish');
    const targetNpmrcPath = path.join(targetNpmrcFolder, '.npmrc');
    try {
        if (fs.existsSync(sourceNpmrcPath)) {
            _copyAndTrimNpmrcFile(sourceNpmrcPath, targetNpmrcPath);
        }
        else if (fs.existsSync(targetNpmrcPath)) {
            // If the source .npmrc doesn't exist and there is one in the target, delete the one in the target
            console.log(`Deleting ${targetNpmrcPath}`); // Verbose
            fs.unlinkSync(targetNpmrcPath);
        }
    }
    catch (e) {
        throw new Error(`Error syncing .npmrc file: ${e}`);
    }
}
let _npmPath = undefined;
/**
 * Get the absolute path to the npm executable
 */
function getNpmPath() {
    if (!_npmPath) {
        try {
            if (os.platform() === 'win32') {
                // We're on Windows
                const whereOutput = childProcess.execSync('where npm', { stdio: [] }).toString();
                const lines = whereOutput.split(os.EOL).filter((line) => !!line);
                // take the last result, we are looking for a .cmd command
                // see https://github.com/microsoft/rushstack/issues/759
                _npmPath = lines[lines.length - 1];
            }
            else {
                // We aren't on Windows - assume we're on *NIX or Darwin
                _npmPath = childProcess.execSync('command -v npm', { stdio: [] }).toString();
            }
        }
        catch (e) {
            throw new Error(`Unable to determine the path to the NPM tool: ${e}`);
        }
        _npmPath = _npmPath.trim();
        if (!fs.existsSync(_npmPath)) {
            throw new Error('The NPM executable does not exist');
        }
    }
    return _npmPath;
}
exports.getNpmPath = getNpmPath;
function _ensureFolder(folderPath) {
    if (!fs.existsSync(folderPath)) {
        const parentDir = path.dirname(folderPath);
        _ensureFolder(parentDir);
        fs.mkdirSync(folderPath);
    }
}
/**
 * Create missing directories under the specified base directory, and return the resolved directory.
 *
 * Does not support "." or ".." path segments.
 * Assumes the baseFolder exists.
 */
function _ensureAndJoinPath(baseFolder, ...pathSegments) {
    let joinedPath = baseFolder;
    try {
        for (let pathSegment of pathSegments) {
            pathSegment = pathSegment.replace(/[\\\/]/g, '+');
            joinedPath = path.join(joinedPath, pathSegment);
            if (!fs.existsSync(joinedPath)) {
                fs.mkdirSync(joinedPath);
            }
        }
    }
    catch (e) {
        throw new Error(`Error building local installation folder (${path.join(baseFolder, ...pathSegments)}): ${e}`);
    }
    return joinedPath;
}
function _getRushTempFolder(rushCommonFolder) {
    const rushTempFolder = process.env[RUSH_TEMP_FOLDER_ENV_VARIABLE_NAME];
    if (rushTempFolder !== undefined) {
        _ensureFolder(rushTempFolder);
        return rushTempFolder;
    }
    else {
        return _ensureAndJoinPath(rushCommonFolder, 'temp');
    }
}
/**
 * Resolve a package specifier to a static version
 */
function _resolvePackageVersion(rushCommonFolder, { name, version }) {
    if (!version) {
        version = '*'; // If no version is specified, use the latest version
    }
    if (version.match(/^[a-zA-Z0-9\-\+\.]+$/)) {
        // If the version contains only characters that we recognize to be used in static version specifiers,
        // pass the version through
        return version;
    }
    else {
        // version resolves to
        try {
            const rushTempFolder = _getRushTempFolder(rushCommonFolder);
            const sourceNpmrcFolder = path.join(rushCommonFolder, 'config', 'rush');
            _syncNpmrc(sourceNpmrcFolder, rushTempFolder);
            const npmPath = getNpmPath();
            // This returns something that looks like:
            //  @microsoft/rush@3.0.0 '3.0.0'
            //  @microsoft/rush@3.0.1 '3.0.1'
            //  ...
            //  @microsoft/rush@3.0.20 '3.0.20'
            //  <blank line>
            const npmVersionSpawnResult = childProcess.spawnSync(npmPath, ['view', `${name}@${version}`, 'version', '--no-update-notifier'], {
                cwd: rushTempFolder,
                stdio: []
            });
            if (npmVersionSpawnResult.status !== 0) {
                throw new Error(`"npm view" returned error code ${npmVersionSpawnResult.status}`);
            }
            const npmViewVersionOutput = npmVersionSpawnResult.stdout.toString();
            const versionLines = npmViewVersionOutput.split('\n').filter((line) => !!line);
            const latestVersion = versionLines[versionLines.length - 1];
            if (!latestVersion) {
                throw new Error('No versions found for the specified version range.');
            }
            const versionMatches = latestVersion.match(/^.+\s\'(.+)\'$/);
            if (!versionMatches) {
                throw new Error(`Invalid npm output ${latestVersion}`);
            }
            return versionMatches[1];
        }
        catch (e) {
            throw new Error(`Unable to resolve version ${version} of package ${name}: ${e}`);
        }
    }
}
let _rushJsonFolder;
/**
 * Find the absolute path to the folder containing rush.json
 */
function findRushJsonFolder() {
    if (!_rushJsonFolder) {
        let basePath = __dirname;
        let tempPath = __dirname;
        do {
            const testRushJsonPath = path.join(basePath, exports.RUSH_JSON_FILENAME);
            if (fs.existsSync(testRushJsonPath)) {
                _rushJsonFolder = basePath;
                break;
            }
            else {
                basePath = tempPath;
            }
        } while (basePath !== (tempPath = path.dirname(basePath))); // Exit the loop when we hit the disk root
        if (!_rushJsonFolder) {
            throw new Error('Unable to find rush.json.');
        }
    }
    return _rushJsonFolder;
}
exports.findRushJsonFolder = findRushJsonFolder;
/**
 * Detects if the package in the specified directory is installed
 */
function _isPackageAlreadyInstalled(packageInstallFolder) {
    try {
        const flagFilePath = path.join(packageInstallFolder, INSTALLED_FLAG_FILENAME);
        if (!fs.existsSync(flagFilePath)) {
            return false;
        }
        const fileContents = fs.readFileSync(flagFilePath).toString();
        return fileContents.trim() === process.version;
    }
    catch (e) {
        return false;
    }
}
/**
 * Removes the following files and directories under the specified folder path:
 *  - installed.flag
 *  -
 *  - node_modules
 */
function _cleanInstallFolder(rushTempFolder, packageInstallFolder) {
    try {
        const flagFile = path.resolve(packageInstallFolder, INSTALLED_FLAG_FILENAME);
        if (fs.existsSync(flagFile)) {
            fs.unlinkSync(flagFile);
        }
        const packageLockFile = path.resolve(packageInstallFolder, 'package-lock.json');
        if (fs.existsSync(packageLockFile)) {
            fs.unlinkSync(packageLockFile);
        }
        const nodeModulesFolder = path.resolve(packageInstallFolder, NODE_MODULES_FOLDER_NAME);
        if (fs.existsSync(nodeModulesFolder)) {
            const rushRecyclerFolder = _ensureAndJoinPath(rushTempFolder, 'rush-recycler');
            fs.renameSync(nodeModulesFolder, path.join(rushRecyclerFolder, `install-run-${Date.now().toString()}`));
        }
    }
    catch (e) {
        throw new Error(`Error cleaning the package install folder (${packageInstallFolder}): ${e}`);
    }
}
function _createPackageJson(packageInstallFolder, name, version) {
    try {
        const packageJsonContents = {
            name: 'ci-rush',
            version: '0.0.0',
            dependencies: {
                [name]: version
            },
            description: "DON'T WARN",
            repository: "DON'T WARN",
            license: 'MIT'
        };
        const packageJsonPath = path.join(packageInstallFolder, PACKAGE_JSON_FILENAME);
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJsonContents, undefined, 2));
    }
    catch (e) {
        throw new Error(`Unable to create package.json: ${e}`);
    }
}
/**
 * Run "npm install" in the package install folder.
 */
function _installPackage(packageInstallFolder, name, version) {
    try {
        console.log(`Installing ${name}...`);
        const npmPath = getNpmPath();
        const result = childProcess.spawnSync(npmPath, ['install'], {
            stdio: 'inherit',
            cwd: packageInstallFolder,
            env: process.env
        });
        if (result.status !== 0) {
            throw new Error('"npm install" encountered an error');
        }
        console.log(`Successfully installed ${name}@${version}`);
    }
    catch (e) {
        throw new Error(`Unable to install package: ${e}`);
    }
}
/**
 * Get the ".bin" path for the package.
 */
function _getBinPath(packageInstallFolder, binName) {
    const binFolderPath = path.resolve(packageInstallFolder, NODE_MODULES_FOLDER_NAME, '.bin');
    const resolvedBinName = os.platform() === 'win32' ? `${binName}.cmd` : binName;
    return path.resolve(binFolderPath, resolvedBinName);
}
/**
 * Write a flag file to the package's install directory, signifying that the install was successful.
 */
function _writeFlagFile(packageInstallFolder) {
    try {
        const flagFilePath = path.join(packageInstallFolder, INSTALLED_FLAG_FILENAME);
        fs.writeFileSync(flagFilePath, process.version);
    }
    catch (e) {
        throw new Error(`Unable to create installed.flag file in ${packageInstallFolder}`);
    }
}
function installAndRun(packageName, packageVersion, packageBinName, packageBinArgs) {
    const rushJsonFolder = findRushJsonFolder();
    const rushCommonFolder = path.join(rushJsonFolder, 'common');
    const rushTempFolder = _getRushTempFolder(rushCommonFolder);
    const packageInstallFolder = _ensureAndJoinPath(rushTempFolder, 'install-run', `${packageName}@${packageVersion}`);
    if (!_isPackageAlreadyInstalled(packageInstallFolder)) {
        // The package isn't already installed
        _cleanInstallFolder(rushTempFolder, packageInstallFolder);
        const sourceNpmrcFolder = path.join(rushCommonFolder, 'config', 'rush');
        _syncNpmrc(sourceNpmrcFolder, packageInstallFolder);
        _createPackageJson(packageInstallFolder, packageName, packageVersion);
        _installPackage(packageInstallFolder, packageName, packageVersion);
        _writeFlagFile(packageInstallFolder);
    }
    const statusMessage = `Invoking "${packageBinName} ${packageBinArgs.join(' ')}"`;
    const statusMessageLine = new Array(statusMessage.length + 1).join('-');
    console.log(os.EOL + statusMessage + os.EOL + statusMessageLine + os.EOL);
    const binPath = _getBinPath(packageInstallFolder, packageBinName);
    const binFolderPath = path.resolve(packageInstallFolder, NODE_MODULES_FOLDER_NAME, '.bin');
    // Windows environment variables are case-insensitive.  Instead of using SpawnSyncOptions.env, we need to
    // assign via the process.env proxy to ensure that we append to the right PATH key.
    const originalEnvPath = process.env.PATH || '';
    let result;
    try {
        process.env.PATH = [binFolderPath, originalEnvPath].join(path.delimiter);
        result = childProcess.spawnSync(binPath, packageBinArgs, {
            stdio: 'inherit',
            cwd: process.cwd(),
            env: process.env
        });
    }
    finally {
        process.env.PATH = originalEnvPath;
    }
    if (result.status !== null) {
        return result.status;
    }
    else {
        throw result.error || new Error('An unknown error occurred.');
    }
}
exports.installAndRun = installAndRun;
function runWithErrorAndStatusCode(fn) {
    process.exitCode = 1;
    try {
        const exitCode = fn();
        process.exitCode = exitCode;
    }
    catch (e) {
        console.error(os.EOL + os.EOL + e.toString() + os.EOL + os.EOL);
    }
}
exports.runWithErrorAndStatusCode = runWithErrorAndStatusCode;
function _run() {
    const [nodePath /* Ex: /bin/node */, scriptPath /* /repo/common/scripts/install-run-rush.js */, rawPackageSpecifier /* qrcode@^1.2.0 */, packageBinName /* qrcode */, ...packageBinArgs /* [-f, myproject/lib] */] = process.argv;
    if (!nodePath) {
        throw new Error('Unexpected exception: could not detect node path');
    }
    if (path.basename(scriptPath).toLowerCase() !== 'install-run.js') {
        // If install-run.js wasn't directly invoked, don't execute the rest of this function. Return control
        // to the script that (presumably) imported this file
        return;
    }
    if (process.argv.length < 4) {
        console.log('Usage: install-run.js <package>@<version> <command> [args...]');
        console.log('Example: install-run.js qrcode@1.2.2 qrcode https://rushjs.io');
        process.exit(1);
    }
    runWithErrorAndStatusCode(() => {
        const rushJsonFolder = findRushJsonFolder();
        const rushCommonFolder = _ensureAndJoinPath(rushJsonFolder, 'common');
        const packageSpecifier = _parsePackageSpecifier(rawPackageSpecifier);
        const name = packageSpecifier.name;
        const version = _resolvePackageVersion(rushCommonFolder, packageSpecifier);
        if (packageSpecifier.version !== version) {
            console.log(`Resolved to ${name}@${version}`);
        }
        return installAndRun(name, version, packageBinName, packageBinArgs);
    });
}
_run();
//# sourceMappingURL=install-run.js.map
