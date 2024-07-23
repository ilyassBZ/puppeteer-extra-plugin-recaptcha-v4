export const PROVIDER_ID = 'capmonster'

import * as types from '../types'

import Debug from 'debug'
const debug = Debug(`puppeteer-extra-plugin:recaptcha:${PROVIDER_ID}`)

import * as solver from './capMonster-api'

const secondsBetweenDates = (before: Date, after: Date) =>
  (after.getTime() - before.getTime()) / 1000

export interface DecodeRecaptchaAsyncResult {
  err?: any
  result?: any
  invalid?: any
}

export interface TwoCaptchaProviderOpts {
  useEnterpriseFlag?: boolean
  useActionValue?: boolean
}

const providerOptsDefaults: TwoCaptchaProviderOpts = {
  useEnterpriseFlag: false, // Seems to make solving chance worse?
  useActionValue: true,
}
async function decodeRecaptchaAsync(
  token: string,
  type: string,
  vendor: types.CaptchaVendor,
  sitekey: string,
  url: string,
  extraData: any,
  opts = { pollingInterval: 2000 },
): Promise<DecodeRecaptchaAsyncResult> {
  return new Promise((resolve) => {
    const cb = (err: any, result: any, invalid: any) =>
      resolve({ err, result, invalid })
    try {
      solver.setApiKey(token)

      if (vendor === 'hcaptcha' && !type) {
        type = 'HCaptchaTaskProxyless'
      }
      solver.decodeReCaptcha(type, sitekey, url, extraData, opts, cb)
    } catch (error) {
      return resolve({ err: error })
    }
  })
}

export async function getSolutions(
  captchas: types.CaptchaInfo[] = [],
  token: string = '',
  type: string = '',
  opts: TwoCaptchaProviderOpts = {},
): Promise<types.GetSolutionsResult> {
  opts = { ...providerOptsDefaults, ...opts }
  const solutions = await Promise.all(
    captchas.map((c) => getSolution(c, token, type)),
  )
  return { solutions, error: solutions.find((s) => !!s.error) }
}

async function getSolution(
  captcha: types.CaptchaInfo,
  token: string,
  type: string,
): Promise<types.CaptchaSolution> {
  const solution: types.CaptchaSolution = {
    _vendor: captcha._vendor,
    provider: PROVIDER_ID,
  }
  try {
    if (!captcha || !captcha.sitekey || !captcha.url || !captcha.id) {
      throw new Error('Missing data in captcha')
    }
    solution.id = captcha.id
    solution.requestAt = new Date()
    debug('Requesting solution..', solution)
    const extraData = {}
    if (captcha.s) {
      extraData['recaptchaDataSValue'] = captcha.s // google site specific property
    }
    // if (opts.useActionValue && captcha.action) {
    //   extraData['action'] = captcha.action // Optional v3/enterprise action
    // }
    // if (opts.useEnterpriseFlag && captcha.isEnterprise) {
    //   extraData['enterprise'] = 1
    // }

    if (type && !type.includes('Proxyless')) {
      if (
        process.env['CAPMONSTER_PROXY_TYPE'] &&
        process.env['CAPMONSTER_PROXY_ADDRESS']
      ) {
        extraData['proxyType'] =
          process.env['CAPMONSTER_PROXY_TYPE'].toUpperCase()
        extraData['proxyAddress'] = process.env['CAPMONSTER_PROXY_ADDRESS']
        extraData['proxyPort'] = process.env['CAPMONSTER_PROXY_PORT']
      }
    }
    if (!type) {
      type = 'RecaptchaV2TaskProxyless'
    }

    const { err, result, invalid } = await decodeRecaptchaAsync(
      token,
      type,
      captcha._vendor,
      captcha.sitekey,
      captcha.url,
      extraData,
    )

    debug('Got response', { err, result, invalid })
    if (err) throw new Error(`${err}`)
    if (!result || !result.text || !result.id) {
      throw new Error(`${PROVIDER_ID} error: Missing response data: ${result}`)
    }
    solution.providerCaptchaId = result.id
    solution.text = result.text
    solution.responseAt = new Date()
    solution.hasSolution = !!solution.text
    solution.duration = secondsBetweenDates(
      solution.requestAt,
      solution.responseAt,
    )
  } catch (error) {
    debug('Error', error)
    solution.error = error.toString()
  }
  return solution
}
