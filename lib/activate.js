#!/usr/bin/env node

const fs = require('fs');
const execSync = require('child_process').execSync;

const puppeteer = require('puppeteer');
const totp = require('./totp');

//#region Helper Functions
function sleep(milliSeconds) {
  return new Promise((resolve, reject) => { setTimeout(resolve, milliSeconds); });
}

const RETRY_INTERVAL = 1000 * 30;  /* Let's try every 30 seconds */
const RETRY_COUNT = 9;             /* (30 * 9 = 4 mins 30 seconds), right below 5 mins  */

async function getVerification(email, password, count = 0) {
  let savePath = "./code.txt";
  try {
    console.log(`Retrieving verification code from ${email}, attempt ${count}/${RETRY_COUNT}`);
    fs.rmSync(savePath, { force: true });
    // Make sure you install npm package `unity-verify-code`!
    const cmd = `unity-verify-code "${email}" "${password}" "${savePath}"`;
    const output = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!fs.existsSync(savePath)) {
      throw { stdout: output };
    }
    return fs.readFileSync(savePath, 'utf8');
  } catch (err) {
    // Only the tool's own output is logged: the error message would repeat the command, password included.
    const lines = `${err.stdout || ''}${err.stderr || ''}`.trim().split('\n');
    const errorLines = lines.filter(line => /error/i.test(line));
    const detail = (errorLines.length ? errorLines.slice(0, 2) : lines.slice(-3)).map(line => line.trim()).join(' | ');
    console.log(`[INFO] No verification code yet${detail ? `: ${detail}` : ''}`);
    if (RETRY_COUNT !== count) {
      ++count;
      await sleep(RETRY_INTERVAL);
      return getVerification(email, password, count);
    }
  }
  return -1;
}

// Prints the shape of the current page (path, fields, buttons, headings) without any field values,
// so failures can be diagnosed from CI logs without exposing credentials.
async function describePage(page) {
  try {
    const url = new URL(page.url());
    const shape = await page.evaluate(() => ({
      headings: [...document.querySelectorAll('h1, h2, [role="alert"]')].filter(e => !e.closest('#onetrust-consent-sdk')).map(e => e.innerText.trim()).filter(Boolean).slice(0, 8),
      inputs: [...document.querySelectorAll('input, select, textarea')]
        .filter(e => e.type !== 'hidden' && !e.closest('#onetrust-consent-sdk'))
        .map(e => `${e.tagName.toLowerCase()} type=${e.type} id=${e.id} name=${e.name} autocomplete=${e.autocomplete}`),
      text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 300),
      buttons: [...document.querySelectorAll('button, input[type=submit]')]
        .filter(e => !e.closest('#onetrust-consent-sdk'))
        .map(e => (e.innerText || e.value || '').trim()).filter(Boolean).slice(0, 15),
    }));
    console.log(`[DEBUG] Page: ${url.origin}${url.pathname}`);
    console.log(`[DEBUG] Page shape: ${JSON.stringify(shape)}`);
  } catch (e) {
    console.log(`[DEBUG] Could not describe the page: ${e}`);
  }
}
//#endregion

async function start(email, password, alf, verificationCode, emailPassword, authenticatorKey) {

    // Launch Headless browser, saving downloads (the .ulf file) to the working directory
    const downloadPath = process.cwd();
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      downloadBehavior: { policy: 'allow', downloadPath: downloadPath }
    });
    const page = await browser.newPage();

    // Navigate to Unity Licensing
    console.log('[INFO] Navigating to https://license.unity3d.com/manual');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load' }),
      page.goto('https://license.unity3d.com/manual')
    ]);

  try {

    //#region Selector Definitions
    const licenseFieldSelector = 'input[name="licenseFile"]';
    const tfaTOTPFieldSelector = 'input[name="conversations_tfa_required_form[verify_code]"]'
    const tfaEmailFieldSelector = 'input[name="conversations_email_tfa_required_form[code]"]'
    const tosAcceptButtonSelector = 'button[name="conversations_accept_updated_tos_form[accept]"]'
    const securityCheckSelector = 'input[name="verificationCode"]'
    //#endregion

    //#region No Follow
    console.log('[INFO] Waiting for initial Page Load...');
    await page.waitForNavigation();

    const needFollowJump = await page.$('.g6.connect-scan-group');
    if (needFollowJump) {

      console.log('[INFO] "Follow" action required...');

      let loginBtn = await page.$('a[rel="nofollow"]');
      loginBtn.click();

      await page.waitForNavigation({ waitUntil: 'load' });

      await page.waitForSelector(".g12.phone-login-box.clear.p20");

      //can't click by DOM API
      let emailLogin = await page.$('a[data-event="toMailLogin"]');

      let aBox = await emailLogin.boundingBox();

      await page.mouse.move(aBox.x + 100, aBox.y + 25);
      await page.mouse.down();
      await page.mouse.up();
    }
    //#endregion

    //#region Login Form
    console.log('[INFO] Start login...');
    const legacyPasswordSelector = '#new_conversations_create_session_form #conversations_create_session_form_password';
    const emailFirstSelector = 'input#email[name="email"]';
    await page.waitForSelector(`${legacyPasswordSelector}, ${emailFirstSelector}`);

    if (await page.$(legacyPasswordSelector)) {

      // Legacy single-page form
      await page.evaluate((text) => { (document.querySelector('input[type=email]')).value = text; }, email);
      await page.evaluate((text) => { (document.querySelector('input[type=password]')).value = text; }, password);

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'load', timeout: 10000 }),
        page.click('input[name="commit"]')
      ]);

    } else {

      // Email-first form (login.unity.com): the email and the password are separate steps.
      // It is a React form, so the fields must be typed into rather than assigned.
      console.log('[INFO] Entering email...');
      await page.type(emailFirstSelector, email);
      await page.click('form button[type="submit"]');

      const passwordSelector = 'input[type="password"]';
      const step = await Promise.race([
        page.waitForSelector(passwordSelector, { visible: true }).then(() => 'password'),
        page.waitForFunction(() => document.body.innerText.includes("Couldn't find your Unity account")).then(() => 'unknown-account'),
      ]);
      if (step === 'unknown-account') {
        throw "Unity could not find an account for this email";
      }

      console.log('[INFO] Entering password...');
      await page.type(passwordSelector, password);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }),
        page.click('form button[type="submit"]')
      ]);
    }
    //#endregion login


    //#region 2FA/ToS
    // Attempt Login (Five Retries)
    let retryAttempt = 0;
    const maxRetries = 5;
    while (!(await page.$(licenseFieldSelector)) && retryAttempt < (maxRetries + 1)) {

      retryAttempt++;
      if (retryAttempt > maxRetries) {
        throw "Unable to complete Sign In";
      }

      console.log(`[INFO] Completing Sign In, Attempt ${retryAttempt}/${maxRetries}`);
      await sleep(2000);

      // Try to work out which page we're on
      if (await page.$(tosAcceptButtonSelector)) {

        // If updated ToS are displayed
        console.log('[INFO] Accepting "Terms of service"...');

        // Accept ToS
        await Promise.all([
          sleep(1000),
          page.click(tosAcceptButtonSelector),
        ]);

      } else if (await page.$(securityCheckSelector)) {

        // login.unity.com "Security check": a one-time code from an authenticator app or an email
        const pageText = await page.evaluate(() => document.body.innerText);
        let code;
        if (/authenticator/i.test(pageText)) {
          console.log('[INFO] Security check (authenticator app)');
          if (!verificationCode && !authenticatorKey) {
            throw "Security check asks for an authenticator code, but no authenticatorKey was provided";
          }
          code = verificationCode || totp(authenticatorKey);
        } else {
          console.log('[INFO] Security check (emailed code)');
          code = verificationCode || await getVerification(email, emailPassword || password);
          if (code === -1) {
            throw "Security check asks for an emailed code, which could not be read from the inbox (see unity-verify-code)";
          }
        }

        await page.type(securityCheckSelector, String(code).trim());
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }),
          page.click('form button[type="submit"]'),
        ]);

      } else if (await page.$(tfaEmailFieldSelector)) {


        // If Email Two Factor Authentication form is displayed
        console.log('[INFO] 2FA (Email)');

        // Populate form with generated TOTP
        const verificationCodeFinal = verificationCode || await getVerification(email, emailPassword || password);
        await page.evaluate((field, text) => { document.querySelector(field).value = text; }, tfaEmailFieldSelector, verificationCodeFinal);

        // Submit form
        await Promise.all([
          page.click('input[name="commit"]'),
          page.waitForNavigation({ waitUntil: "load" }),
        ]);

      } else if (await page.$(tfaTOTPFieldSelector)) {

        // If TOTP Two Factor Authentication form is displayed
        console.log('[INFO] 2FA (Authenticator App)');

        // Verify Authenticator Key was provided
        if (authenticatorKey) {

          // Populate form with generated TOTP
          const verificationCodeFinal = verificationCode || totp(authenticatorKey)
          await page.evaluate((field, text) => { document.querySelector(field).value = text; }, tfaTOTPFieldSelector, verificationCodeFinal);

          // Submit form
          await Promise.all([
            page.click('input[type="submit"]'),
            page.waitForNavigation({ waitUntil: "load" }),
          ]);

        } else {
          throw "2FA Required, but no authenticatorKey was provided"
        }

      } else if (await page.$('#alert-tfa-expired')) {
        console.log('[INFO] Two Factor Authentication code has expired, reloading the page...');
        await page.reload({ waitUntil: 'load' });
      }
    }
    //#endregion

    //#region Upload License
    console.log('[INFO] Drag license file...');

    await page.waitForSelector(licenseFieldSelector);
    const input = await page.$(licenseFieldSelector);

    console.log('[INFO] Uploading alf file...');

    const alfPath = alf;
    await input.uploadFile(alfPath);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load' }),
      page.click('input[name="commit"]')
    ]);
    //#endregion

    //#region License Config
    console.log('[INFO] Selecting license type...');

    const selectedTypePersonal = 'input[id="type_personal"][value="personal"]';
    await page.waitForSelector(selectedTypePersonal);
    await page.evaluate(
      s => document.querySelector(s).click(),
      selectedTypePersonal
    );

    console.log('[INFO] Selecting license capacity...');

    const selectedPersonalCapacity = 'input[id="option3"][name="personal_capacity"]';
    await page.evaluate(
      s => document.querySelector(s).click(),
      selectedPersonalCapacity
    );

    const nextButton = 'input[class="btn mb10"]';
    await Promise.all([
      page.waitForNavigation({ waitUntil: "load" }),
      page.evaluate(
        s => document.querySelector(s).click(),
        nextButton
      )
    ]);

    await page.click('input[name="commit"]');
    //#endregion

    //#region ULF Download
    console.log(`[INFO] Saving ulf file to ${downloadPath}...`);

    let _ = await (async () => {
      let ulf;
      do {
        for (const file of fs.readdirSync(downloadPath)) {
          ulf |= file.endsWith('.ulf');
        }
        await sleep(1000);
      } while (!ulf)
    })();
    //#endregion

    await browser.close();
    console.log('[INFO] Done!');

  } catch (err) {

    // Log Errors
    console.log(err);
    await describePage(page);

    // Output Screenshot
    {
      await page.screenshot({ path: 'error.png', fullPage: true });
      console.log('[ERROR] Something went wrong, please check the screenshot `error.png`');
    }

    // Output HTML
    {
      const html = await page.evaluate(() => document.querySelector('*').outerHTML);
      fs.writeFile('error.html', html, function (err) { });
    }

    // Exit
    await browser.close();
    process.exit(1);
  }
}

/*
 * Module Exports
 */
module.exports.start = start;
