const hmacsha1 = require('crypto-js/hmac-sha1');
const encHex = require('crypto-js/enc-hex');

function decodeBase32Group(group, isLast) {
  const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = [];

  for (let i = 0; i < 8; i++) {
    const c = group.charAt(i);

    if (c === '=') {
      if (!isLast || group.substring(i).split('').some((x) => x != '=')) {
        throw new Error("'=' is found at wrong position");
      }
      const byteLength = Math.floor(i * 5 / 8);
      if (Math.ceil(byteLength * 8 / 5) != i) {
        throw new Error("Invalid padding length");
      }
      return parseInt(bits.join('').substring(0, byteLength * 8), 2).toString(16);
    }
    const v = base32Chars.indexOf(group.charAt(i).toUpperCase());
    bits.push(v.toString(2).padStart(5, "0"));
  }

  return parseInt(bits.join(''), 2).toString(16);
}

function decodeBase32(base32) {
  if (base32.length % 8 != 0) {
    throw new Error("Invalid base32 string");
  }
  const groups = [];

  for (let i = 0; i < base32.length; i += 8) {
    const group = base32.substring(i, i + 8);
    groups.push(decodeBase32Group(group, (i + 8) === base32.length));
  }
  return groups.join("");
}

function truncate(str, digit = 6) {
  const offset = parseInt(str[39], 16);
  const p = str.substring(offset * 2, offset * 2 + 8);
  const snum = parseInt(p, 16) & 0x7fffffff;
  return snum % Math.pow(10, digit);
}

function hotp(key, counter, digit = 6) {
  const message = counter.toString(16).padStart(16, 0);
  const hmac = hmacsha1(encHex.parse(message), encHex.parse(key)).toString(encHex);
  return truncate(hmac, digit);
}

function totp(key, digit = 6, period = 30, t0 = 0) {
  const epoch = Math.floor(new Date().getTime() / 1000);
  const counter = Math.floor((epoch - t0) / period);
  return hotp(decodeBase32(key), counter, digit);
}

module.exports = totp;
