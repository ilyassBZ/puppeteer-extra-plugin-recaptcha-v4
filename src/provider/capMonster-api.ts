// TODO: Create our own API wrapper

var https = require('https')
var querystring = require('querystring')

var apiKey
var apiUrl = 'api.capmonster.cloud'

var defaultOptions = {
  pollingInterval: 2500,
  retries: 2,
}

function pollCaptcha(captchaId, options, invalid, callback) {
  const startTimer = Date.now()
  invalid = invalid.bind({ options: options, captchaId: captchaId })
  var postData = {
    clientKey: apiKey,
    taskId: captchaId,
  }
  var postDataJson = JSON.stringify(postData)

  var intervalId = setInterval(function () {
    var httpsRequestOptions = {
      method: 'POST',
      hostname: apiUrl,
      path: '/getTaskResult',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postDataJson),
        Host: apiUrl,
      },
    }
    var request = https.request(httpsRequestOptions, function (response) {
      var body = ''

      response.on('data', function (chunk) {
        body += chunk
      })

      response.on('end', function () {
        var result = JSON.parse(body)
        if (result.status === 'processing') {
          return
        }
        clearInterval(intervalId)

        if (result.status !== 'ready') {
          callback(result.status) // error
        } else {
          callback(
            null,
            {
              id: captchaId,
              text: result.solution.gRecaptchaResponse,
            },
            invalid,
          )
        }
        callback = function () {} // prevent the callback from being called more than once, if multiple https requests are open at the same time.
      })
    })
    request.write(postDataJson)
    request.on('error', function (e) {
      request.destroy()
      callback(e)
    })
    request.end()
  }, options.pollingInterval || defaultOptions.pollingInterval)

  console.log('Time', Date.now() - startTimer)
}

export const setApiKey = function (key) {
  apiKey = key
}

export const decodeReCaptcha = function (
  captchaMethod,
  captcha,
  pageUrl,
  extraData,
  options,
  callback,
) {
  if (!callback) {
    callback = options
    options = defaultOptions
  }

  var postData = {
    key: apiKey,
    method: captchaMethod,
    pageURL: pageUrl,
    ...extraData,
  }

  if (captchaMethod === 'userrecaptcha') {
    postData.googlekey = captcha
  }
  if (captchaMethod === 'hcaptcha') {
    postData.sitekey = captcha
  }
  postData.nocache = 1

  //Sending the request to the API to get the captcha ID im using the in.php endpoint : https://api.capmonster.cloud/in.php

  postData = querystring.stringify(postData)
  var httpsRequestOptions = {
    method: 'POST',
    hostname: apiUrl,
    path: `/in.php?${postData}`,
  }

  //var httpsRequestOptions = url.parse(apiInUrl + '?' + postData)
  //httpsRequestOptions.method = 'POST'

  var request = https.request(httpsRequestOptions, function (response) {
    var body = ''

    response.on('data', function (chunk) {
      body += chunk
    })

    response.on('end', function () {
      if (body.includes('ERROR')) {
        return callback(body)
      }

      const taskId = body.split('|')[1]
      pollCaptcha(
        taskId,
        options,
        function (error) {
          var callbackToInitialCallback = callback

          report(this.captchaId)

          if (error) {
            return callbackToInitialCallback('CAPTCHA_FAILED')
          }

          if (!this.options.retries) {
            this.options.retries = defaultOptions.retries
          }
          if (this.options.retries > 1) {
            this.options.retries = this.options.retries - 1
            decodeReCaptcha(
              captchaMethod,
              captcha,
              pageUrl,
              extraData,
              this.options,
              callback,
            )
          } else {
            callbackToInitialCallback('CAPTCHA_FAILED_TOO_MANY_TIMES')
          }
        },
        callback,
      )
    })
  })
  request.on('error', function (e) {
    request.destroy()
    callback(e)
  })
  request.end()
}

export const report = function (captchaId) {
  var postData = {
    clientKey: apiKey,
    taskId: captchaId,
  }
  var postDataJson = JSON.stringify(postData)

  var options = {
    method: 'POST',
    hostname: apiUrl,
    path: '/reportIncorrectTokenCaptcha',
    headers: {
      'Content-Type': 'application/json',
    },
  }
  var request = https.request(options, function (response) {
    // var body = ''
    // response.on('data', function(chunk) {
    //   body += chunk
    // })
    // response.on('end', function() {})
  })
  request.write(postDataJson)
}
