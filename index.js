var stream = require('stream')
var inherits = require('inherits')
var toBuffer = require('typedarray-to-buffer')

function WorkerStream(path, channel) {
  stream.Stream.call(this)
  this.readable = true
  this.writable = true
  this.channel = channel
  this.worker = typeof path === 'string'
    ? new Worker(path)
    : path
  this.worker.onmessage = this.workerMessage.bind(this)
  this.worker.onerror = this.workerError.bind(this)
}

inherits(WorkerStream, stream.Stream)

module.exports = function(path, channel) {
  return new WorkerStream(path, channel)
}

module.exports.WorkerStream = WorkerStream

WorkerStream.prototype.box = function (data) {
  if(Buffer.isBuffer(data)) {
    var message = { '_isBuffer': true, data: data }
    if (this.channel) {
      message['channel'] = this.channel
    }
    return message
  }

  if (this.channel) {
    return { channel: this.channel, data: data }
  }
  return data
}

WorkerStream.prototype.unbox = function (data) {
  if(data._isBuffer) {
    data.data = toBuffer(data.data)
    return data.data
  }

  if (data.channel) {
    if (data.data && (ArrayBuffer.isView(data.data) || data.data instanceof ArrayBuffer)) {
      return Buffer.from(data)
    }
    return data.data
  }

  if (data && (ArrayBuffer.isView(data) || data instanceof ArrayBuffer)) {
    return Buffer.from(data)
  }
  return data
}

WorkerStream.prototype.workerMessage = function(e) {
  if(this.channel && this.channel !== e.data.channel) {
    return
  }

  this.emit('data', this.unbox(e.data), e)
}

WorkerStream.prototype.workerError = function(err) {
  this.emit('error', err)
}

// opts is for transferable objects
WorkerStream.prototype.write = function(data, opts) {
  this.worker.postMessage(this.box(data), opts)
  return true
}

WorkerStream.prototype.end = function() {
  this.emit('end')
}
