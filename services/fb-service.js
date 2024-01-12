const EventEmitter = require('events');

const fb = require('firebase-admin');

const serviceAccount = require('../firebase-db.json');

const firebaseConfig = {
  credential: fb.credential.cert(serviceAccount),
  apiKey: 'AIzaSyBTsjJwRelnAAh1x0URdF0UgUTBz4Pj8vM',
  authDomain: 'twilio-hackathon-sko-2024.firebaseapp.com',
  databaseURL: 'https://twilio-hackathon-sko-2024-default-rtdb.firebaseio.com',
  projectId: 'twilio-hackathon-sko-2024',
  storageBucket: 'twilio-hackathon-sko-2024.appspot.com',
  messagingSenderId: '888116972091',
  appId: '1:888116972091:web:90c2705639e9f330b96a1e',
  measurementId: 'G-KLLK96FJCB',
};

fb.initializeApp(firebaseConfig);

<<<<<<< HEAD
let fbtranscriptcount = 0;
class FirebaseService extends EventEmitter {
  static async setTranscript(data, id, conId, type) {
    try {
      fbtranscriptcount += 1;
=======
class FirebaseService extends EventEmitter {
  constructor() {
    super();

    this.fbtranscriptcount = 0;
  }

  async setTranscript(data, id, conId, type) {
    try {
      this.fbtranscriptcount += 1;
>>>>>>> 79f9e95 (Lint all services files)
      if (data) {
        // let ndate = Date();
        const dateObj = new Date();
        const md = `${dateObj.toDateString()} | ${dateObj.toTimeString()} | ${conId}`;
<<<<<<< HEAD
        if (fbtranscriptcount > 1) {
=======
        if (this.fbtranscriptcount > 1) {
>>>>>>> 79f9e95 (Lint all services files)
          const postListRef = fb.database().ref(`transcripts/${conId}/transcript`);
          const newPostRef = postListRef.push();
          newPostRef.set({
            id,
            body: data,
<<<<<<< HEAD
            datetime: fb.database.ServerValue.TIMESTAMP,
=======
            datetime: Date.now(),
>>>>>>> 79f9e95 (Lint all services files)
            type,
          });
        } else {
          await fb.database().ref(`transcripts/${conId}`).set({
            conversationId: conId,
            status: 'active',
<<<<<<< HEAD
            datetime: fb.database.ServerValue.TIMESTAMP,
=======
            datetime: Date.now(),
>>>>>>> 79f9e95 (Lint all services files)
            metadata: md,
            transcript: [
              {
                id,
                body: data,
<<<<<<< HEAD
                datetime: fb.database.ServerValue.TIMESTAMP,
=======
                datetime: Date.now(),
>>>>>>> 79f9e95 (Lint all services files)
                type,
              },
            ],
          });
        }
      }
    } catch (err) {
      console.error('Error occurred in Firebase set Transcript service');
      console.error(err);
    }
  }

<<<<<<< HEAD
  static async setLogs(data, id, conId, type, startdt, enddt) {
=======
  async setLogs(data, id, conId, type, startdt, enddt) {
>>>>>>> 79f9e95 (Lint all services files)
    try {
      if (data) {
        const dateObj = new Date();
        const md = `${dateObj.toDateString()} | ${dateObj.toTimeString()} | ${conId}`;
        const latency = enddt - startdt;
        const body = `${type} | ${data} | Latency: ${latency}`;

<<<<<<< HEAD
        if (fbtranscriptcount > 1) {
=======
        if (this.fbtranscriptcount > 1) {
>>>>>>> 79f9e95 (Lint all services files)
          const postListRef = fb.database().ref(`logs/${conId}/log`);
          const newPostRef = postListRef.push();
          newPostRef.set({
            id,
            body,
<<<<<<< HEAD
            datetime: fb.database.ServerValue.TIMESTAMP,
=======
            datetime: Date.now(),
>>>>>>> 79f9e95 (Lint all services files)
            type,
            start: startdt,
            end: enddt,
            latency,
          });
        } else {
          await fb.database().ref(`logs/${conId}`).set({
            conversationId: conId,
            status: 'active',
<<<<<<< HEAD
            datetime: fb.database.ServerValue.TIMESTAMP,
=======
            datetime: Date.now(),
>>>>>>> 79f9e95 (Lint all services files)
            metadata: md,
            log: [
              {
                id,
                body,
<<<<<<< HEAD
                datetime: fb.database.ServerValue.TIMESTAMP,
=======
                datetime: Date.now(),
>>>>>>> 79f9e95 (Lint all services files)
                type,
                start: startdt,
                end: enddt,
                latency,
              },
            ],

          });
        }
      }
    } catch (err) {
      console.error('Error occurred in Firebase set Logs service');
      console.error(err);
    }
  }

<<<<<<< HEAD
  static async setErrors(error, conId, data) {
=======
  async setErrors(error, conId, data) {
>>>>>>> 79f9e95 (Lint all services files)
    try {
      if (error) {
        // let ndate = Date();
        const dateObj = new Date();
        const md = `${dateObj.toDateString()} | ${dateObj.toTimeString()} | ${conId}`;
        const msg = error.message;
        await fb.database().ref(`logs/${conId}`).set({
          conversationId: conId,
          status: 'error',
<<<<<<< HEAD
          datetime: fb.database.ServerValue.TIMESTAMP,
=======
          datetime: Date.now(),
>>>>>>> 79f9e95 (Lint all services files)
          metadata: md,
          message: msg,
          stacktrace: data,

        });
      }
    } catch (err) {
      console.error('Error occurred in Firebase set Errors service');
      console.error(err);
    }
  }

<<<<<<< HEAD
  static async getTranscriptById(id) {
=======
  async getTranscriptById(id) {
>>>>>>> 79f9e95 (Lint all services files)
    const transcript = fb.database().ref(`transcripts/${id}`);
    return transcript;
  }

  // eslint-disable-next-line consistent-return
<<<<<<< HEAD
  static async getAllTranscripts() {
=======
  async getAllTranscripts() {
>>>>>>> 79f9e95 (Lint all services files)
    try {
      let snap;
      // Get last ten records inserted by datetime
      const allTranscripts = await fb.database().ref('transcripts').orderByChild('datetime').limitToLast(10);
      return await allTranscripts.once('value').then((snapshot) => {
        console.log(snapshot.val());
        snap = snapshot.val();
        return snap;
      });
    } catch (err) {
      console.error('Error occurred in Firebase get all Transcripts service');
      console.error(err);
    }
  }

  // eslint-disable-next-line consistent-return
<<<<<<< HEAD
  static async getAllLogs() {
=======
  async getAllLogs() {
>>>>>>> 79f9e95 (Lint all services files)
    try {
      let snap;
      // Get last ten records inserted by datetime
      const allLogs = await fb.database().ref('logs').orderByChild('datetime').limitToLast(10);
      return await allLogs.once('value').then((snapshot) => {
        console.log(snapshot.val());
        snap = snapshot.val();
        return snap;
      });
    } catch (err) {
      console.error('Error occurred in Firebase get all Logs service');
      console.error(err);
    }
  }
}

module.exports = { FirebaseService };
