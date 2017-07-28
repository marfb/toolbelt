import {pathOr} from 'ramda'

import {logAll, onEvent} from '../sse'
import log from '../logger'

type BuildEvent = 'start' | 'success' | 'fail' | 'timeout' | 'logs'

const allEvents: BuildEvent[] = ['start', 'success', 'fail', 'timeout', 'logs']

const flowEvents: BuildEvent[] = ['start', 'success', 'fail']

const onBuildEvent = (appOrKey: string, callback: (type: BuildEvent, message?: Message) => void) => {
  const unlistenLogs = logAll(log.level, appOrKey.split('@')[0])
  const [unlistenStart, unlistenSuccess, unlistenFail] = flowEvents.map((type) => onEvent('vtex.render-builder', `build.${type}`, (message) => callback(type, message)))
  const timer = setTimeout(() => callback('timeout'), 5000)

  const unlistenMap: Record<BuildEvent, Function> = {
    start: unlistenStart,
    success: unlistenSuccess,
    fail: unlistenFail,
    logs: unlistenLogs,
    timeout: () => clearTimeout(timer),
  }

  return (...types: BuildEvent[]) => {
    types.forEach(type => { unlistenMap[type]() })
  }
}

export const listenBuild = (appOrKey: string, triggerBuild: () => Promise<any>) => {
  return new Promise((resolve, reject) => {
    let triggerResponse

    const unlisten = onBuildEvent(appOrKey, (eventType, message) => {
      switch (eventType) {
        case 'start':
          unlisten('start', 'timeout')
          break
        case 'success':
        case 'timeout':
          unlisten(...allEvents)
          resolve(triggerResponse)
          break
        case 'fail':
          const errorMsg = pathOr('Build fail', ['body', 'message'], message)
          unlisten(...allEvents)
          reject(new Error(errorMsg))
          break
      }
    })

    triggerBuild()
      .then(response => {
        triggerResponse = response
      })
      .catch(e => {
        unlisten(...allEvents)
        reject(e)
      })
  })
}