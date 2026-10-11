# Code signing policy

Free code signing provided by [SignPath.io](https://about.signpath.io), certificate by [SignPath Foundation](https://signpath.org).

## What is signed

On Windows, every release signs these files:

- `ShareGo.exe`, inside `ShareGo-windows.zip` and inside both installers
- `ShareGo-windows-setup.exe`
- `ShareGo-windows.msi`

The signature names SignPath Foundation. Only files built from this repository are signed. The Flutter engine, plugin and Visual C++ runtime DLLs that ship next to `ShareGo.exe` are not built by this project, so they are not signed with this certificate.

The macOS app and disk image are signed with the author's own Apple Developer ID and notarized by Apple. SignPath does not sign them.

## How a release is signed

1. A maintainer pushes a `v*` tag. GitHub Actions builds the release on GitHub-hosted runners from that tag ([release.yml](../.github/workflows/release.yml)).
2. The workflow sends the unsigned files to SignPath. SignPath checks that they came from that workflow run on this repository, and that the product name and version match ([artifact configurations](../.signpath/artifact-configurations)).
3. An approver reviews the request in SignPath and approves it by hand. Nothing is signed without that approval.
4. The signed files are attached to a draft GitHub Release, which a maintainer publishes.

## Team

| Role | Members |
| --- | --- |
| Committers and reviewers | [Mehdi Mamas (@MehdiMamas)](https://github.com/MehdiMamas) |
| Approvers | [Mehdi Mamas (@MehdiMamas)](https://github.com/MehdiMamas) |

Changes from anyone outside this team are reviewed by a reviewer before they are merged. Every team member uses multi-factor authentication on GitHub and on SignPath.

## Privacy

ShareGo does not send any information to a networked system unless you ask it to, with one exception: the desktop apps ask GitHub for the latest release when they start and every 6 hours. Both Windows installers show this before installing and let you turn it off. See the [privacy policy](PRIVACY.md).

## Reporting a problem

If a file signed with this certificate looks wrong, or you think it was not built from this repository, open an issue at [github.com/MehdiMamas/ShareGo/issues](https://github.com/MehdiMamas/ShareGo/issues) or email mehdimamasxd@gmail.com.
