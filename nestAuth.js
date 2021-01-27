/* eslint-disable no-console */
'use strict'
const fs = require('fs').promises
// get config parameters //
const config = require('./config.json')
const puppeteer = require('puppeteer-extra')
// Need this plug in to avoid automation countermeasures on the login page.
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())
const isPi = require('detect-rpi')

const waitTillHTMLRendered = async (browser, page, timeout = 360000) => {
  // Props to Anand Mahajan https://stackoverflow.com/users/4345716/anand-mahajan
  // this function waits for the size of the page to settle -
  // required as some scripts on the page are writing to it even though
  // it's loaded.
  const checkDurationMsecs = 4000
  const maxChecks = timeout / checkDurationMsecs
  let lastHTMLSize = 0
  let checkCounts = 1
  let countStableSizeIterations = 0
  const minStableSizeIterations = 4

  console.log('Waiting for page content to settle')

  try {
    while (checkCounts++ <= maxChecks) {
      const html = await page.content()
      const currentHTMLSize = html.length
      const bodyHTMLSize = await page.evaluate(() => document.body.innerHTML.length)
      console.log('last: ', lastHTMLSize, ' <> curr: ', currentHTMLSize, ' body html size: ', bodyHTMLSize)
      if (lastHTMLSize !== 0 && currentHTMLSize === lastHTMLSize) {
        countStableSizeIterations++
      } else {
        countStableSizeIterations = 0 // reset the counter
      }
      if (countStableSizeIterations >= minStableSizeIterations) {
        console.log('Page rendered fully.')
        break
      }
      lastHTMLSize = currentHTMLSize
      await page.waitForTimeout(checkDurationMsecs)
    }
  } catch (err) {
    console.error(err.name)
    console.error(err.message)
    console.log('Screenshot: error.png')
    if (page) {
      page.screenshot({
        path: 'error.png',
        fullPage: true
      })
      // close browser so that we exit gracefully - otherwise we leave eventlisteners active & node won't shutdown
      browser.close()
      console.log(err)
      throw new Error('Error waiting for page to be fully rendered see error.png screenshot')
    }
  }
}

// create  listener for a specifc network event and instances in an object
async function createNetworkListener ({
  page, // calling page
  eventType, // Type of netork event to listen to requestWillBeSent / responseReceieved
  objectType, // Root property to interrogate if RequestWIllBeSent s.b 'request' if repsonseReceieved s.b. 'response'
  propertyToMatch, // Sub-property we want to check in the objectType e.g 'url'
  stringToFind, // Setting for sub-property we're looking for e.g 'issueToken'
  headerToReturn, // if we find the value in the sub-property what do we want to return e.g
  propertyToMatch2, // if specifcied the 2ns property to check
  subPropertyToReturn, // item we're sending back if a second property is there
  headerKey, // key for the item we return in the returned object
  debug // whether we should just create a debug object
}) {
  if (!debug) {
    console.log('Listening for:')
    console.table({
      eventType,
      objectType,
      propertyToMatch,
      stringToFind,
      headerToReturn,
      propertyToMatch2,
      subPropertyToReturn,
      headerKey
    })
  }
  const cdpClient = await page.target().createCDPSession()
  await cdpClient.send('Network.enable')
  const cdpData = {}

  // for this simpler type of search we just want to look for the value in the request property and return whatever matches
  // requried for finding issueToken
  const addNetworkListenerProperty = (eventName) => {
    cdpClient.on(eventName, request => {
      if (request[objectType][propertyToMatch].includes(stringToFind)) {
        Object.assign(cdpData, {
          [headerKey]: request[objectType][propertyToMatch]
        })
      }
    })
  }

  // for this type of search we locate traffic that matches the property and has the additional header we want
  // e.g apikey or cookie
  const addNetworkListenerHeader = (eventName) => {
    cdpClient.on(eventName, request => {
      if (request[objectType][propertyToMatch].includes(stringToFind)) {
        if (request[objectType].headers[headerToReturn] !== undefined) {
          Object.assign(cdpData, {
            [headerKey]: request[objectType].headers[headerToReturn]
          })
        }
      }
    })
  }

  const addNetworkListenerSubProperty = (eventName) => {
    cdpClient.on(eventName, request => {
      if (request[objectType][propertyToMatch].includes(stringToFind)) {
        if (request[objectType][propertyToMatch2] !== undefined) {
          Object.assign(cdpData, {
            [headerKey]: request[objectType][propertyToMatch2][subPropertyToReturn]
          })
        }
      }
    })
  }

  const addNetworkListenerDebug = (eventName) => {
    cdpClient.on(eventName, request => {
      cdpData[request.requestId] = cdpData[request.requestId] || {}
      Object.assign(cdpData[request.requestId], {
        [eventName]: request
      })
    })
  }

  if (!debug) {
    // if there is no headerToReturn value then we are asking to just return a top level property
    if (!headerToReturn && !propertyToMatch2) {
      addNetworkListenerProperty(eventType)
    } else {
      if (!propertyToMatch2) {
        // so we're doing a property and header search
        addNetworkListenerHeader(eventType)
      } else {
        // otherwise were looking for a property of a header
        addNetworkListenerSubProperty(eventType)
      }
    }
  } else {
    // create debug item(s)
    console.log('Debug on. Network traffic will be stored in debugDump.json')
    addNetworkListenerDebug('Network.requestWillBeSent')
    addNetworkListenerDebug('Network.responseReceived')
  }
  return cdpData
}

async function pageNavigation (page, browser, userId, password) {
  // navigate browser from nest main page to authorisation completed
  // set user agent may help with avoiding bot-countermeasures
  await page.setUserAgent('Mozilla/5.0 (Macintosh Intel Mac OS X 11_1_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 Safari/537.36')

  // go to nest page  & wait till it's loaded
  console.log('Navigating to : https://home.nest.com')
  await page.goto('https://home.nest.com', {
    waitUntil: 'domcontentloaded',
    setDefaultNavigationTimeOut: 240000
  })

  // locate login button
  const btnGoogleLogin = await page.waitForSelector('[data-test="google-button-login"]', {
    waitUntil: 'domcontentloaded'
  })

  console.log('Logging in ...')

  // click login
  await waitTillHTMLRendered(browser, page)
  btnGoogleLogin.click()

  // wait for userid field to render
  await page.waitForNavigation({
    waitUntil: 'domcontentloaded'
  })
  await page.waitForSelector('#identifierId', {
    timeout: 120000
  })

  // type userid & hit enter
  await page.focus('#identifierId')
  await page.keyboard.type(userId, {
    delay: 100
  })
  await page.keyboard.press('Enter')

  // type password
  await page.waitForNavigation()
  await page.waitForSelector('#password')
  await page.focus('#password')

  // send enter
  await waitTillHTMLRendered(browser, page)
  await page.keyboard.type(password, {
    delay: 100
  })
  await page.keyboard.press('Enter')

  // and wait for authorisation process to complete
  await Promise.all([page.waitForNavigation({
    waitUntil: 'domcontentloaded'
  }),
  await waitTillHTMLRendered(browser, page)])
}

const nestLogin = async ({
  userId,
  password
}) => {
  // for storage of authorisation items
  const googleAuth = {}
  // array to contain raw network data we're extracting
  const networkData = []
  let debug = false
  let browser, page, debugDump // used for launcher & page object define here as try/catch are block scoped
  // opens nest.hom page and logs in with userID and password provided
  console.log('Launching chromium headless')

  try {
    // ! Need to run this headless otherwise some XHRs do not appear!

    if (isPi()) {
      console.log('Raspberry Pi detected, lauching chromium at /usr/bin/chromium-browser')
      browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', headless: true })
    } else {
      browser = await puppeteer.launch({
        headless: true
      })
    }
    // ...
    page = await browser.newPage()
    // increase default timeout if we're runnign this on a low end machine render times can be slow
    await page.setDefaultNavigationTimeout(120000)
    // set up network event capture

    // convert config.json keys into enumerable array
    const configKeys = Object.keys(config)

    // check the debug flag in the config.json
    if (config.debug !== undefined) {
      if (config.debug === true) {
        console.log('Debug mode on')
      }
      debug = config.debug
      configKeys.pop()
    }
    // check for a debug flag on the config.json. If we have one set up debug mode and remove from token list

    if (debug) {
      // create unfiltered listeners to capture everything
      debugDump = await createNetworkListener({
        page: page,
        debug: true
      })
    }
    configKeys.forEach(async (token) => {
      const networkListener = await createNetworkListener({
        page: page,
        eventType: config[token].eventType,
        objectType: config[token].objectType,
        propertyToMatch: config[token].propertyToMatch,
        stringToFind: config[token].stringToFind,
        headerToReturn: config[token].headerToReturn,
        propertyToMatch2: config[token].propertyToMatch2,
        subPropertyToReturn: config[token].subPropertyToReturn,
        headerKey: config[token].headerKey
      })
      networkData.push(networkListener)
    })

    await pageNavigation(page, browser, userId, password)

    console.log('Collecting authorisation items ...')

    // Network traffic detected and filtered by each listener will be stored in members in the networkData array
    // aggregate listener object array into a single object, by taking last item from each stack
    networkData.forEach(
      dataSet => {
        Object.assign(googleAuth, {
          [Object.keys(dataSet).pop()]: Object.values(dataSet).pop()
        })
      })

    await browser.close()
    //  <-- browser navigation ends here
  } catch (err) {
    console.error(err.name)
    console.error(err.message)
    console.log('Screenshot: error.png')
    if (page) {
      page.screenshot({
        path: 'error.png',
        fullPage: true
      })
      // close browser so that we exit gracefully - otherwise we leave eventlisteners active & node won't exit
      browser.close()
      console.log(err)
      throw new Error('Error navigating login steps in browser check error.png screenshot')
    }
  }

  console.log('Parameters extracted:')
  console.log(googleAuth)

  try {
    await fs.writeFile('googleAuth.json', JSON.stringify({
      googleAuth: googleAuth
    }), null, 4)
    console.log('Response data written to googleAuth.json.')
  } catch (err) {
    console.error('Error writing to googleAuth.json')
    console.error(err.name)
    console.error(err.message)
    console.log(err)
    // rethrow so we can terminate at the top of the call stack
    throw new Error('Error writing to googleAuth.json')
  }

  if (debug) {
    try {
      await fs.writeFile('debugDump.json', JSON.stringify({
        debug: debugDump
      }), null, 4)
      console.log('Debug data written to debugDump.json.')
    } catch (err) {
      console.error('Error writing to debuDump.json')
      console.error(err.name)
      console.error(err.message)
      console.log(err)
      // rethrow so we can terminate at the top of the call stack
      throw new Error('Error writing to googleAuth.json')
    }
  }
}

const getCredentials = (args) => {
  // check that we have valid user and password line end parameters
  // return userID and password
  const userDetails = {}
  // first check that no parameters are missing ... should have 2
  if (args.length < 2) {
    throw new Error('Password or UserId missing. Usage: $node nestAuth.js u={userid} p={password}')
  } else {
    // Now check that the parameters we have are valid
    // first split on '=' so we have parameter so we can check the names are valid - only 'u' and 'p' are valid
    const paramNames = args.map(param => {
      const keyValuePairs = param.split('=')
      return keyValuePairs[0] // return key
    })

    if (!(paramNames.join() === 'p,u' || paramNames.join() === 'u,p')) {
      throw new Error('Invalid parameter(s) specified. Usage: $node nestAuth.js u={userid} p={password}')
    } else {
      // now we know we have valid parameters build an object containing them as key: value pairs
      args.forEach(element => {
        const keyValuePairs = element.split('=')
        userDetails[keyValuePairs[0]] = keyValuePairs[1]
      })
    }
  }
  // now return the object to the caller
  return {
    userId: userDetails.u.toString(),
    password: userDetails.p.toString()
  }
}

// send the line end parameters for processing
// don't need first two as these are 'node' and the name of the file itself
const userDetails = getCredentials(process.argv.slice(2))
nestLogin(userDetails).then(() => {
  console.log('Job completed')
}).catch(err => {
  console.error(`Job failed with :${err}`)
})
