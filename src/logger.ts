import chalk from 'chalk'
import * as path from 'path'
import * as progress from 'progress-string'
import { replace } from 'ramda'
import { stdout as singleLineLog } from 'single-line-log'
import { sprintf } from 'sprintf-js'
import { createLogger, format, Logger, transports } from 'winston'
import  * as Transport from 'winston-transport'
import { name as pkgName, version as pkgVersion } from '../package.json'
import { logger as colossusLogger } from './clients'
import { configDir } from './conf'

// Setup logging
const VERBOSE = '--verbose'
const UNINDEXED = '_unindexed'
const isVerbose = process.argv.indexOf(VERBOSE) >= 0

const { combine, timestamp, colorize } = format
const bar = progress({
  width: Math.floor(0.75 * 0.5 * process.stdout.columns) - 4,
  total: 100,
  style: (complete, incomplete) => {
    return '#'.repeat(complete.length) + '' + ' '.repeat(incomplete.length)
  },
})

export const DEBUG_LOG_FILE_PATH = path.join(configDir, 'vtex_debug.txt')
const INDENTATION = '    '
const getProgressBar = (value) => {
  return `  [${bar(value)}] ${value}%`
}
const pkgId = `${pkgName}@${pkgVersion}`

class SimpleConsoleTransport extends Transport {
  constructor(opts) {
    super(opts)
  }

  public log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info)
    })
    if (info.message) {
      // console.log(info.message)
      console.log(info)
    }
    callback()
  }
}

class FancyConsoleTransport extends Transport {
  private logs: any
  private renderedLogs: string

  constructor(opts) {
    super(opts)
    this.logs = {}
    this.renderedLogs = ''
  }

  public log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info)
    })
    const { message, clear=false, level, index, progress: progressBarSpecs } = info
    const { append=(['warn', 'error'].indexOf(level) >= 0 ? true : false) } = info
    const newLogText = message ? `- ${message}` : ''
    let newProgressBarText = ''
    let newProgressBarValue = ''
    let newProgressBarSpecs = {}
    if (progressBarSpecs) {
      const { text, value } = progressBarSpecs
      newProgressBarText = text || ''
      newProgressBarValue = value !== undefined ? getProgressBar(value) : ''
      newProgressBarSpecs = { text: newProgressBarText, value: newProgressBarValue }
    }
    if (clear) {
      this.clear(newLogText, newProgressBarSpecs, index)
    } else if (append) {
      this.append(newLogText, newProgressBarSpecs, index)
    } else {
      this.overwriteLine(newProgressBarText, newProgressBar, newLogText, index)
    }
    this.render()
    callback()
  }

  private clear(
    newProgressBarText='',
    newProgressBarValue='',
    newLogText='',
    index=UNINDEXED
  ) {
    singleLineLog()
    console.log(replace(/\n\s*$/, '', this.renderedLogs))
    this.logs[index] = {} newProgressBarText
    this.progressBarValues[index] = newProgressBarValue
    this.logTexts[index] = newLogText
  }

  private append(
    newProgressBarText?: string,
    newProgressBarValue?: string,
    newLogText?: string,
    index=UNINDEXED
  ) {
    if (newProgressBarText) {
      this.progressBarTexts[index] = newProgressBarText
    }
    if (newProgressBarValue) {
      this.progressBarValues[index] = newProgressBarValue
    }
    const indentation = (this.progressBarTexts[index] || this.progressBarValues[index]) ? INDENTATION : ''
    if (this.logText) {
      this.logText = newLogText ? `${this.logText}${indentation}${newLogText}\n` : this.logText
    } else {
      this.logText = newLogText ? `${indentation}${newLogText}\n` : this.logText
    }
  }

  private overwriteLine(
    newProgressBarText?: string,
    newProgressBar?: string,
    newLogText?: string
  ) {
    this.progressBarText = newProgressBarText || this.progressBarText
    this.progressBar = newProgressBar || this.progressBar
    if (this.progressBarText || this.progressBar) {
      this.logText = newLogText ? `${INDENTATION}${newLogText}\n` : ''
    } else {
      this.logText = newLogText ? `${newLogText}\n` : ''
    }
  }

  private render() {
    let formattedProgressLine
    if (this.progressBarText || this.progressBar) {
      const terminalWidth = process.stdout.columns
      const progressBarPadding = terminalWidth - this.progressBarText.length - 1
      formattedProgressLine = chalk.bold(
        sprintf(
          `%s %${progressBarPadding}s`,
          this.progressBarText,
          this.progressBar
        )
      )
      this.fullLog = `${formattedProgressLine}\n${this.logText}`
    } else {
      this.fullLog = this.logText
    }
    singleLineLog(this.fullLog)
  }
}

export class ColossusTransport extends Transport {
  constructor(opts) {
    super(opts)
  }

  public log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info)
    })
    switch (info.level){
    case 'debug':
        colossusLogger.debug(info, pkgId)
    case 'info':
        colossusLogger.info(info, pkgId)
    case 'warn':
        colossusLogger.warn(info, pkgId)
    case 'error':
        colossusLogger.error(info, pkgId)
    }
    callback()
  }
}

const consoleFormatter = format((info, _) => {
  // Formatter for console logs.
  const { level } = info
  if (level === 'error') {
    info.message = chalk.red(info.message)
  }
  return info
})

const messageFormatter = format((info, _) => {
  // Write all relevant information in info.message
  const { timestamp: timeString='', sender='', message } = info
  info.message = `${chalk.black(timeString)} - ${info.level}:  ${message} ${chalk.black(sender)}`
  return info
})

// const filterMessage = format((info, _) => {
  // if (!info.message) { return false }
  // return info
// })

interface ExtendedLogger extends Logger {
  progress?(value: number, text?: string): void
  newInfoSection?(): void
}

const consoleTransport = isVerbose ?
  new SimpleConsoleTransport({
    format: combine(
      // filterMessage(),
      timestamp({ format: 'HH:mm:ss.SSS' }),
      colorize(),
      messageFormatter()
    ),
    level: 'debug',
  }) :
  new FancyConsoleTransport({
      format: consoleFormatter(),
      level: 'info',
    })

const logger = createLogger({
  transports: [
    consoleTransport,
    new transports.File({
      filename: DEBUG_LOG_FILE_PATH,
      format: combine(
        timestamp({ format: 'hh:mm:ss.SSS' }),
        messageFormatter()
      ),
      level: 'debug',
      maxsize: 10E6,
      maxFiles: 1,
    }),
    new ColossusTransport({
      level: 'error',
    }),
  ],
}) as ExtendedLogger


logger.clear = () => logger.log({message: '', level: 'info', clear: true})
logger.progress = (value: number, text?: string) => {
  logger.log({message: '', level: 'info', progress: {text, value}})
}

logger.on('error', (err) => {
  console.error('A problem occured with the logger:')
  console.error(err)
})

logger.on('finish', (info) => {
  console.log(`Logging has finished: ${info}`)
})
export default logger
