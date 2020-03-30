const puppeteer = require('puppeteer')
const fs = require('fs')

;(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  const page = await browser.newPage()

  const downloadPath = process.cwd()
  const client = await page.target().createCDPSession()
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadPath
  })

  const navigationPromise = page.waitForNavigation({
    waitUntil: 'domcontentloaded'
  })

  await page.goto('https://license.unity3d.com/manual')

  await Promise.all([
    await navigationPromise,
    await page.waitForSelector('#new_conversations_create_session_form #conversations_create_session_form_password')
  ])
  
  const email = `${process.argv[2]}`
  await page.type('input[type=email]', email)

  const password = `${process.argv[3]}`
  await page.type('input[type=password]', password)
  await page.click('input[name="commit"]')

  await navigationPromise

  const confirmNumber = `${process.argv[5]}`
  if (
    confirmNumber.value != null &&
    confirmNumber.value != undefined &&
    confirmNumber.value.length > 0
  ) {
    await page.waitFor(1000)

    await page.type('input[class="verify_code"]', confirmNumber)
    await page.click('input[type=submit]')

    await navigationPromise
  }

  const licenseFile = 'input[name="licenseFile"]'
  await page.waitForSelector(licenseFile)

  const input = await page.$(licenseFile)

  const alfPath = `${process.argv[4]}`
  await input.uploadFile(alfPath)

  await page.click('input[name="commit"]')

  await navigationPromise

  const selectedTypePersonal = 'input[id="type_personal"][value="personal"]'
  await page.waitForSelector(selectedTypePersonal)
  await page.evaluate(
    s => document.querySelector(s).click(),
    selectedTypePersonal
  )

  const selectedPersonalCapacity = 'input[id="option3"][name="personal_capacity"]'
  await page.evaluate(
    s => document.querySelector(s).click(),
    selectedPersonalCapacity
  )

  await page.click('input[class="btn mb10"]')

  await Promise.all([
    await navigationPromise,
    await page.waitFor(1000)
  ])

  await page.click('input[name="commit"]')

  let _ = await (async () => {
    let ulf
    do {
      for (const file of fs.readdirSync(downloadPath)) {
        ulf |= file.endsWith('.ulf')
      }
      await sleep(1000)
    } while (!ulf)
  })()

  function sleep(milliSeconds) {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, milliSeconds)
    })
  }

  await browser.close()
})()
