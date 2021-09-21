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
      "  EMAIL          Username or Email you use to register for Unity account\n" +
      "  PASSWORD       Password to login Unity account\n" +
      "  ALF            Unity activation license file path\n";

/* CLI */
const cli_md = function () {
  let email = args.getArg(2);
  let password = args.getArg(3);
  let alf = args.getArg(4);

  console.log(alf);

  // Check valid args.
  if (args.checkNull(email, password, alf)) {
    console.log("[ERROR] Missing positional arguments, " + email + ", " + password + ", " + alf);
    console.log(usage);
  }
  // Check directory/file exists.
  else if (!fs.existsSync(alf)) {
    console.log("[ERROR] Invalid alf file path, " + alf);
  }
  // Do build action.
  else {
    activate.start(email, password, alf);
  }
};

/** CLI entry */
if (require.main === module) {
  cli_md();
}
