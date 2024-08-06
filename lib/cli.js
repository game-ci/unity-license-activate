#!/usr/bin/env node
/**
 * $File: cli.js $
 * $Date: 2021-09-17 18:27:29 $
 * $Revision: $
 * $Creator: Jen-Chieh Shen $
 * $Notice: See LICENSE.txt for modification and distribution information
 *                   Copyright © 2021 by Shen, Jen-Chieh $
 */

"use strict";

const fs = require('fs');
const activate = require('./activate');
const args = require('./args');

const usage =
      "usage : unity-license-activate EMAIL [EMAIL ...] PASSWORD [PASSWORD ...] ALF [ALF ...]\n" +
      "\n" +
      "Unity License Activate : Activate Unity license through CLI.\n" +
      "\n" +
      "positional arguments:\n" +
      "  EMAIL                  Username or Email you use to register for Unity account\n" +
      "  PASSWORD               Password to login Unity account\n" +
      "  ALF                    Unity activation license file path\n" +
      "\n" +
      "optional arguments:\n" +
      "  --verification-code    Verification code for 2FA\n" +
      "  --email-password       Email Password, for auto EMail 2FA\n" +
      "  --authenticator-key    Authenticator Key, for auto TOTP 2FA\n";

/* CLI */
const cli_md = function () {
  let email = args.getArg(2);
  let password = args.getArg(3);
  let alf = args.getArg(4);
  let verification = args.getArg("--verification-code");
  let emailPassword = args.getArg("--email-password");
  let authenticatorKey = args.getArg("--authenticator-key");

  // Check valid arguments.
  if (args.checkNull(email, password, alf)) {
    console.log("[ERROR] Missing positional arguments, " + email + ", " + password + ", " + alf);
    console.log(usage);
    return;
  }

  // Check directory/file exists.
  if (!fs.existsSync(alf)) {
    console.log("[ERROR] Invalid alf file path, " + alf);
    return;
  }

  activate.start(email, password, alf, verification, emailPassword, authenticatorKey);
};

/** CLI entry */
if (require.main === module) {
  cli_md();
}
