import * as Bluebird from 'bluebird'
import chalk from 'chalk'
import { outputJson, readJson } from 'fs-extra'
import * as inquirer from 'inquirer'
import * as moment from 'moment'
import { join } from 'path'
import { keys, prop } from 'ramda'

import { getAccount } from '../../conf'
import log from '../../logger'
import { MANIFEST_FILE_NAME } from '../../manifest'

import * as git from './git'

const { mapSeries } = Bluebird

const templates = {
  'store-theme': 'store-theme',
}

const titles = {
  'store-theme': 'Store Theme',
}

const descriptions = {
  'store-theme': 'VTEX IO Store Theme',
}

const promptName = async (repo: string) => {
  const message = 'The app name should only contain numbers, lowercase letters, underscores and hyphens.'
  return prop('name', await inquirer.prompt({
    name: 'name',
    message: 'What\'s your VTEX app name?',
    validate: s => /^[a-z0-9\-_]+$/.test(s) || message,
    filter: s => s.trim(),
    default: repo,
  }))
}

const promptVendor = async () => {
  const message = 'The vendor should only contain numbers, lowercase letters, underscores and hyphens.'
  return prop('vendor', await inquirer.prompt({
    name: 'vendor',
    message: 'What\'s your VTEX app vendor?',
    validate: s => /^[a-z0-9\-_]+$/.test(s) || message,
    filter: s => s.trim(),
    default: getAccount(),
  }))
}

const promptTitle = async (repo: string) => {
  return prop('title', await inquirer.prompt({
    name: 'title',
    message: 'What\'s your VTEX app title?',
    filter: s => s.trim(),
    default: titles[repo],
  }))
}

const promptDescription = async (repo: string) => {
  return prop('description', await inquirer.prompt({
    name: 'description',
    message: 'What\'s your VTEX app description?',
    filter: s => s.trim(),
    default: descriptions[repo],
  }))
}

const promptTemplates = async (): Promise<string> => {
  const cancel = 'Cancel'
  const chosen = prop<string>('service', await inquirer.prompt({
    name: 'service',
    message: 'Choose where do you want to start from',
    type: 'list',
    choices: [...keys(templates), cancel],
  }))
  if (chosen === cancel) {
    log.info('Bye o/')
    return process.exit()
  }
  return chosen
}

const promptContinue = async (repoName: string) => {
  const proceed = prop('proceed', await inquirer.prompt({
    name: 'proceed',
    message: `You are about to create the new folder ${process.cwd()}/${repoName}. Do you want to continue?`,
    type: 'confirm',
  }))
  if (!proceed) {
    log.info('Bye o/')
    process.exit()
  }
}

const manifestFromPrompt = async (repo: string) => {
  return mapSeries<any, string>([
    promptName,
    promptVendor,
    promptTitle,
    promptDescription,
  ], f => f(repo))
}

const createManifest = (name: string, vendor: string, title = '', description = ''): Manifest => {
  const [year, ...monthAndDay] = moment().format('YYYY-MM-DD').split('-')
  return {
    name,
    vendor,
    version: '0.1.0',
    title,
    description,
    mustUpdateAt: `${Number(year) + 1}-${monthAndDay.join('-')}`,
    registries: ['smartcheckout'],
  }
}

export default async () => {
  log.debug('Prompting for app info')
  log.info('Hello! I will help you generate basic files and folders for your app.')
  try {
    const repo = templates[await promptTemplates()]
    const manifestPath = join(process.cwd(), repo, MANIFEST_FILE_NAME)
    await promptContinue(repo)
    log.info(`Cloning https://vtex-apps/${repo}.git`)
    const [, [name, vendor, title, description]]: any = await Bluebird.all([
      git.clone(repo),
      manifestFromPrompt(repo),
    ])
    const synthetic = createManifest(name, vendor, title, description)
    const manifest: any = Object.assign(await readJson(manifestPath) || {}, synthetic)
    await outputJson(manifestPath, manifest, { spaces: 2 })
    log.info(`Run ${chalk.bold.green(`cd ${repo}`)} and ${chalk.bold.green('vtex link')} to start developing!`)
  } catch (err) {
    log.error(err.message)
    err.printStackTrace()
  }
}
