#!/usr/bin/env node

const fs = require('fs');
const execSync = require('child_process').execSync;

const puppeteer = require('puppeteer');

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

async function start(email, password, alf, verification, emailPassword) {
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

  const navigationPromise = page.waitForNavigation({
    waitUntil: 'load'
  });

  console.log('[INFO] Navigating to https://license.unity3d.com/manual');

  await page.goto('https://license.unity3d.com/manual');

  try {
    await Promise.all([
      await navigationPromise,
      await page.waitForSelector('#new_conversations_create_session_form #conversations_create_session_form_password')
    ]);

    console.log('[INFO] Start login...');

    await page.evaluate((text) => { (document.querySelector('input[type=email]')).value = text; }, email);

    await page.evaluate((text) => { (document.querySelector('input[type=password]')).value = text; }, password);
    await page.click('input[name="commit"]');

    await navigationPromise;
    await page.waitFor(10000);

    const needVerify = await page.$('input[class="req"]');

    if (needVerify) {
      console.log('[INFO] Detect verification code needed, retrieve it from Email...');
      const confirmNumber = verification || await getVerification(email, emailPassword || password);

      console.log('[INFO] Verification code: ' + confirmNumber);

      await page.waitFor(1000);

      await page.evaluate((text) => { (document.querySelector('input[type=text]')).value = text; }, confirmNumber);
      await page.click('input[name="commit"]');

      await navigationPromise;
      await page.waitFor(10000);
    } else {
      console.log('[INFO] No verification code is detected!');
    }

    console.log('[INFO] Drag license file...');

    const licenseFile = 'input[name="licenseFile"]';
    await page.waitFor(10000);

    const input = await page.$(licenseFile);

    console.log('[INFO] Uploading alf file...');

    const alfPath = alf;
    await input.uploadFile(alfPath);

    await page.click('input[name="commit"]');

    await navigationPromise;

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
    await page.evaluate(
      s => document.querySelector(s).click(),
      nextButton
    );

    await Promise.all([
      await navigationPromise,
      await page.waitFor(2000)
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
    await page.screenshot({ path: 'error.png' });
    console.log('[ERROR] Something went wrong, please check the screenshot `error.png`');
    await browser.close();
    process.exit(1);
  }
}

/*
 * Module Exports
 */
module.exports.start = start;
