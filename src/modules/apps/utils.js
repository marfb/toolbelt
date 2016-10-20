import chalk from 'chalk'
import {join} from 'path'
import {createReadStream} from 'fs'
import {manifest} from '../../manifest'
import userAgent from '../../user-agent'
import {AppsClient, RegistryClient} from '@vtex/api'
import {getToken, getAccount, getWorkspace} from '../../conf'
import endpoint from '../../endpoint'

export const id = `${manifest.vendor}.${manifest.name}@${manifest.version}`

const appsOptions = {authToken: getToken(), userAgent}
export const appsClient = () => new AppsClient(endpoint('api'), appsOptions)

const registryOptions = {authToken: getToken(), userAgent}
export const registryClient = () => new RegistryClient(endpoint('api'), registryOptions)

export const installApp = (id) => {
  const [vendorAndName, version] = id.split('@')
  const [vendor, name] = vendorAndName.split('.')
  return appsClient().installApp(
    getAccount(),
    getWorkspace(),
    {vendor, name, version}
  )
}

export const publishApp = (files, isDevelopment = false) => {
  return registryClient().publishApp(
    getAccount(),
    getWorkspace(),
    files,
    isDevelopment
  )
}

export const mapFileObject = (files) => {
  return files.map(path => {
    return {
      path,
      contents: createReadStream(join(process.cwd(), path)),
    }
  })
}

export const workspaceMasterMessage = `${chalk.green('master')} is ${chalk.red('read-only')}, please use another workspace`