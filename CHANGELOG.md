# Change Log

All notable changes to this project will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.


## 0.4.x (Unreleased)
> Released N/A

* Correct CLI description.
* Use inject insert instead of keyboard type.
* Handle "terms of service" popup when appeared ([#71](../../pull/71))
* Fix no follow ([#75](../../pull/75) and [#77](../../pull/77))
* TOTP Support ([#101](../../pull/101))
* Upgrade Puppeteer to 25; requires Node.js 22.12 or newer.
* Sign in through Unity's email-first login page and answer its "Security check" step (authenticator or emailed code).
* Bundle unity-verify-code and run it without a shell, so credentials are never parsed as shell code.
* On failure, log a value-free summary of the page instead of uploading screenshots in CI.
* Exit with code 1 when arguments are missing or the alf file does not exist.

## 0.1.0
> Released Sep 17, 2021

* Initial release
