#!/usr/bin/env node
/**
 * $File: args.js $
 * $Date: 2021-09-21 02:18:26 $
 * $Revision: $
 * $Creator: Jen-Chieh Shen $
 * $Notice: See LICENSE.txt for modification and distribution information
 *                   Copyright © 2021 by Shen, Jen-Chieh $
 */

"use strict";

/**
 * Return true, if there is one invalid arguments.
 */
function checkNull() {
  for (let index = 0; index < arguments.length; ++index) {
    if (!arguments[index])
      return true;
  }
  return false;
}

/**
 * Return argument by it's `name`.
 * @param { string } name - The name of the argument.
 * @param { any } defaultValue - Default value, this is for optional arguments.
 */
function getArg(name, defaultValue = null) {
  let args = process.argv;
  if (typeof name === 'number') {
    return args[name];
  } else {
    for (let index = 0; index < args.length; ++index) {
      if (args[index] === name && args.length > index + 1) {
        return args[index +1];
      }
    }
  }
  return defaultValue;
}

/*
 * Module Exports
 */
module.exports.checkNull = checkNull;
module.exports.getArg = getArg;
