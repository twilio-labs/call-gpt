const EventEmitter = require('events');

class TextService extends EventEmitter {
  constructor(websocket) {
    super();
    this.ws = websocket;
  }

  sendText (text, last) {
    console.log('Sending text: ', text, last);
    this.ws.send(
      JSON.stringify({
        type: 'text',
        token: text,
        last: last,
      })
    );
  }
}

module.exports = {TextService};