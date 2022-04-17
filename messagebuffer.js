// A class built to ensure we ingest messages to our buffer in full, as opposed to in incomplete chunks
class MessageBuffer {
  constructor(delimiter) {
    this.delimiter = delimiter;
    this.buffer = "";
  }

  isFinished() {
    if (
      this.buffer.length === 0 ||
      this.buffer.indexOf(this.delimiter) === -1
    ) {
      return false;
    }
    return true;
  }

  push(data) {
    this.buffer += data;
  }

  getMessage() {
    const delimiterIndex = this.buffer.indexOf(this.delimiter);
    if (delimiterIndex !== -1) {
      const message = this.buffer.slice(0, delimiterIndex);
      this.buffer = this.buffer.replace(message + this.delimiter, "");
      return message;
    }
    return null;
  }

  handleData() {
    /**
     * Try to accumulate the buffer with messages
     *
     * If the server isnt sending delimiters for some reason
     * then nothing will ever come back for these requests
     */
    const message = this.getMessage();
    return message;
  }
}

module.exports = {
  MessageBuffer: MessageBuffer,
};
