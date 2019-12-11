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

  await page.goto('https://license.unity3d.com/manual')

  await page.waitForNavigation({
    timeout: 60000,
    waitUntil: 'domcontentloaded'
  })

  const email = `${process.argv[2]}`
  await page.type('input[type=email]', email)

  const password = `${process.argv[3]}`
  await page.type('input[type=password]', password)
  await page.click('input[name="commit"]')

  try {
    await page.waitForNavigation({
      timeout: 60000,
      waitUntil: 'domcontentloaded'
    })
  } catch (e) {
    console.log(`timeout error: wait current page ${page.url()}`)
  }

  const confirmNumber = `${process.argv[5]}`
  if (confirmNumber != '') {
    await page.type('input[class="verify_code"]', confirmNumber)
    await page.click('input[type=submit]')

    try {
      await page.waitForNavigation({
        timeout: 60000,
        waitUntil: 'domcontentloaded'
      })
    } catch (e) {
      console.log(`timeout error: wait current page ${page.url()}`)
    }
  }

  const input = await page.$('input[name="licenseFile"]')

  const alfPath = `${process.argv[4]}`
  await input.uploadFile(alfPath)

  await page.click('input[name="commit"]')

  try {
    await page.waitForNavigation({
      timeout: 60000,
      waitUntil: 'domcontentloaded'
    })
  } catch (e) {
    console.log(`timeout error: wait current page ${page.url()}`)
  }

  const selectedTypePersonal = 'input[id="type_personal"][value="personal"]'
  await page.evaluate(
    s => document.querySelector(s).click(),
    selectedTypePersonal
  )

  const selectedPersonalCapacity =
    'input[id="option3"][name="personal_capacity"]'
  await page.evaluate(
    s => document.querySelector(s).click(),
    selectedPersonalCapacity
  )

  await page.click('input[class="btn mb10"]')

  try {
    await page.waitForNavigation({
      timeout: 60000,
      waitUntil: 'domcontentloaded'
    })
  } catch (e) {
    console.log(`timeout error: wait current page ${page.url()}`)
  }
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
