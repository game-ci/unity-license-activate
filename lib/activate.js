#!/usr/bin/env node

const fs = require('fs');
const execSync = require('child_process').execSync;

const puppeteer = require('puppeteer');
const totp = require('./totp');

function sleep(milliSeconds) {
  return new Promise((resolve, reject) => { setTimeout(resolve, milliSeconds); });
}

const RETRY_INTERVAL = 1000 * 30;  /* Let's try every 30 seconds */
const RETRY_COUNT = 9;             /* (30 * 9 = 4 mins 30 seconds), right below 5 mins  */

async function getVerification(email, password, count = 0) {
  let savePath = "./code.txt";
  try {
    console.log(`Retrieving verfication code from ${email}, attempt ${count}`);
    // Make sure you install npm package `unity-verify-code`!
    execSync(`unity-verify-code "${email}" "${password}" "${savePath}"`);
    return fs.readFileSync(savePath, 'utf8');
  } catch (err) {
    if (RETRY_COUNT !== count) {
      ++count;
      await sleep(RETRY_INTERVAL);
      return getVerification(email, password, count);
    }
  }
  return -1;
}

async function start(email, password, alf, verification, authenticatorKey) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  const downloadPath = process.cwd();
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadPath
  });

  console.log('[INFO] Navigating to https://license.unity3d.com/manual');

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load' }),
    page.goto('https://license.unity3d.com/manual')
  ]);

  try {

    console.log('[INFO] Check for "No Follow" ...');

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

    await page.waitForSelector('#new_conversations_create_session_form #conversations_create_session_form_password');

    console.log('[INFO] Start login...');

    await page.evaluate((text) => { (document.querySelector('input[type=email]')).value = text; }, email);
    await page.evaluate((text) => { (document.querySelector('input[type=password]')).value = text; }, password);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load', timeout: 10000 }),
      page.click('input[name="commit"]')
    ]);

    console.log('[INFO] Check for "Terms of service" popup...');

    const needTosAccept = await page.$('#new_conversations_accept_updated_tos_form');

    if (needTosAccept) {
      console.log('[INFO] "Terms of service" accept required, submit form...');

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'load' }),
        page.$eval('form', form => form.submit())
      ]);
    }

    if (await page.$('input[class="req"]')) {
      console.log('[INFO] Detect verification code needed, retrieve it from Email...');
      const confirmNumber = verification || await getVerification(email, emailPassword || password);
    await page.waitForFunction(() => document.querySelectorAll('input[class="verify_code"], input[name="licenseFile"]').length, { timeout: 2000 });

    if (await page.$('input[class="verify_code"]')) {
      console.log('[INFO] 2FA (Authenticator App)');
      const confirmNumber = verification || totp(authenticatorKey);

      await page.evaluate((text) => { document.querySelector("input[type=text]").value = text; }, confirmNumber);
      await Promise.all([
        page.waitForNavigation({ waitUntil: "load" }),
        page.click('input[type="submit"]'),
      ]);
    } else {
      console.log('[INFO] No verification code is detected!');
    const licenseFile = 'input[name="licenseFile"]';

    await page.waitForFunction(() => document.querySelectorAll('#new_conversations_accept_updated_tos_form, input[class="verify_code"], input[name="licenseFile"]').length, { timeout: 30000 });

    // it seems that 2FA code is invalidated when ToS popup is shown, so retry the flow in such a case.
    let loop = 5;
    while (!(await page.$(licenseFile)) && loop-- > 0) {
      if (await page.$('#new_conversations_accept_updated_tos_form')) {
        console.log('[INFO] Accepting "Terms of service"...');

        await Promise.all([
          page.waitForNavigation({ waitUntil: 'load', timeout: 10000 }),
          page.click('button[name="conversations_accept_updated_tos_form[accept]"]'),
        ]);
      } else if (await page.$('input[class="verify_code"]')) {
        console.log('[INFO] 2FA (Authenticator App)');
        const confirmNumber = verification || totp(authenticatorKey);

        await page.evaluate((text) => { document.querySelector("input[type=text]").value = text; }, confirmNumber);
        await Promise.all([
          page.waitForNavigation({ waitUntil: "load" }),
          page.click('input[type="submit"]'),
        ]);
      }
    }

    console.log('[INFO] Drag license file...');

    await page.waitForSelector(licenseFile);
    const input = await page.$(licenseFile);

    console.log('[INFO] Uploading alf file...');

    const alfPath = alf;
    await input.uploadFile(alfPath);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load' }),
      page.click('input[name="commit"]')
    ]);

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

    console.log('[INFO] Downloading ulf file...');

    let _ = await (async () => {
      let ulf;
      do {
        for (const file of fs.readdirSync(downloadPath)) {
          ulf |= file.endsWith('.ulf');
        }
        await sleep(1000);
      } while (!ulf)
    })();

    await browser.close();

    console.log('[INFO] Done!');
  } catch (err) {
    console.log(err);
    /* Output screenshot */
    {
      await page.screenshot({ path: 'error.png' });
      console.log('[ERROR] Something went wrong, please check the screenshot `error.png`');
    }
    /* Output HTML */
    {
      const html = await page.evaluate(() => document.querySelector('*').outerHTML);
      fs.writeFile('error.html', html, function (err) { });
    }
    await browser.close();
    process.exit(1);
  }
}

/*
 * Module Exports
 */
module.exports.start = start;
