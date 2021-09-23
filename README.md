[![License](https://img.shields.io/badge/License-Apache%202.0-green.svg)](https://opensource.org/licenses/Apache-2.0)
[![dependencies Status](https://status.david-dm.org/gh/jcs090218/unity-license-activate.svg)](https://david-dm.org/jcs090218/unity-license-activate)

# unity-license-activate
> A tool to automate the manual activation of unity license using puppeteer

This is a fork from [MizoTake/unity-license-activate](https://github.com/MizoTake/unity-license-activate).

For Unity personal license (free version) , you most likely would have to renew
it every period of time. Then you would have to repeat the step [Activation - Personal License](https://game.ci/docs/github/activation#personal-license)
after some times. This tool is designed to use with [GameCI](https://game.ci/),
so you can do the CI/CD tasks without bothering by the Unity’s licensing system.

## 🔨 Usage

```
usage : unity-license-activate EMAIL [EMAIL ...] PASSWORD [PASSWORD ...] ALF [ALF ...]

Unity License Activate : Activate Unity license through CLI.

positional arguments:
  EMAIL          Username or Email you use to register for Unity account
  PASSWORD       Password to login Unity account
  ALF            Unity activation license file path
```

## 🔗 Links

* https://license.unity3d.com/manual
