import axios from 'axios'
import chalk from 'chalk'

import { workspaces } from '../../clients'
import { getAccount, getToken } from '../../conf'
import { region } from '../../env'
import { CommandError } from '../../errors'
import log from '../../logger'

const VALID_WORKSPACE = /^[a-z][a-z0-9-]{0,126}[a-z0-9]$/
const routeMapURL = (workspace) => `http://colossus.${region()}.vtex.io/${getAccount()}/${workspace}/routes`

export default async (name: string, options: any) => {
  if (!VALID_WORKSPACE.test(name)) {
    throw new CommandError('Whoops! That\'s not a valid workspace name. Please use only lowercase letters, numbers and hyphens.')
  }
  log.debug('Creating workspace', name)
  let production = false
  if (options.p || options.production) {
    production = true
  }
  try {
    await workspaces.create(getAccount(), name, production)
    log.info(`Workspace ${chalk.green(name)} created ${chalk.green('successfully')} with ${chalk.green(`production=${production}`)}`)
    // First request on a brand new workspace takes very long because of route map generation, so we warm it up.
    const token = getToken()
    await axios.get(routeMapURL(name), {headers: {Authorization: token}})
    log.debug('Warmed up route map')
  } catch (err) {
    if (err.response && err.response.data.code === 'WorkspaceAlreadyExists') {
      log.error(err.response.data.message)
      return
    }
    throw err
  }
}
