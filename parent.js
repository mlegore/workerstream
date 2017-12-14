var stream = require('stream')
var inherits = require('inherits')
var toBuffer = require('typedarray-to-buffer')

function ParentStream(workerGlobal, channel){
  stream.Stream.call(this)
  this.readable = true
  this.writable = true
  this.parent = workerGlobal || self
  this.channel = channel
  this.parent.onmessage = this.parentMessage.bind(this)
  this.parent.onerror = this.parentError.bind(this)
}

inherits(ParentStream, stream.Stream)

module.exports = function(workerGlobal, channel) {
  return new ParentStream(workerGlobal, channel)
}

module.exports.ParentStream = ParentStream

ParentStream.prototype.box = function (data) {
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

ParentStream.prototype.unbox = function (data) {
  if(data._isBuffer) {
    data.data = toBuffer(data.data)
    return data.data
  }

  if (data.channel) {
    if (data.data && (ArrayBuffer.isView(data.data) || data.data instanceof ArrayBuffer)) {
      return Buffer.from(data.data)
    }
    return data.data
  }

  if (data && (ArrayBuffer.isView(data) || data instanceof ArrayBuffer)) {
    return Buffer.from(data)
  }
  return data
}

ParentStream.prototype.parentMessage = function(e) {
  if(this.channel && this.channel !== e.data.channel) {
    return
  }

  this.emit('data', this.unbox(e.data), e)
}

ParentStream.prototype.parentError = function(err) {
  this.emit('error', err)
}

// opts is for transferable objects
ParentStream.prototype.write = function(data, opts) {
  this.parent.postMessage(this.box(data), opts)
  return true
}

ParentStream.prototype.end = function() {
  this.emit('end')
}
