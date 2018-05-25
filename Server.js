const fs = require('fs')
const path = require('path')
const EventEmitter = require('events')
const exec = require('child_process').spawn
const encoding = require('encoding-japanese')

class Server extends EventEmitter {
  constructor(profile) {
    super()
    this.profile = profile // プロファイル
    this.process = undefined // Javaプロセス
  }

  start() {
    if (!fs.existsSync(this.profile.folder) || !fs.existsSync(this.profile.jar)) {
      return this.emit('error', 'Not found server')
    }
    this.process = exec('java', [
      '-Xmx' + this.profile.max_memory + 'm',
      '-Xms' + this.profile.min_memory + 'm',
      '-jar', this.profile.jar,
      'nogui',
    ], {
      cwd: this.profile.folder,
      encoding: 'utf8',
    })
    this.process.stdout.on('data', data => this.lineCheck(data))
    this.process.stderr.on('data', data => this.lineCheck(data))
    this.process.on('exit', code => this.stopped(code))
  }

  stop() {
    this.sendCommand('stop')
  }

  stopped(code) {
    this.emit('stopped', code)
  }

  kill() {
    if (!this.process) return
    if (!this.process.kill('SIGKILL') && this.process.pid) {
      if (process.platform === 'win32') exec('Taskkill', ['/PID', this.process.pid, '/F'])
      else exec('kill', ['-9', this.process.pid])
    }
  }

  sendCommand(cmd) {
    this.process.stdin.write(new Buffer(encoding.convert(new Buffer(cmd + '\n'), 'SJIS', 'UTF-8')))
  }

  // 行に分割
  lineCheck(text) {
    let ii = 0
    while (true) {
      const i = text.indexOf(13, ii)
      if (i > 0 && text[i + 1] === 10) {
        this.processLog(text.slice(ii, i))
        ii = i + 2
      } else break
    }
  }

  // ログ処理
  processLog(line) {
    this.emit('line', line)
  }

  agreeEula() {
    const eulaPath = path.join(this.profile.folder, 'eula.txt')
    fs.readFile(eulaPath, 'utf8', (err, eula) => {
      if (err) return
      fs.writeFile(eulaPath, eula.replace('false', 'true'), (error) => { /* handle error */ })
    })
  }
}

module.exports = Server
