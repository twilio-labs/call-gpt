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

// Initialize Firebase
fb.initializeApp(firebaseConfig);

let fbtranscriptcount = 0;
class FirebaseService extends EventEmitter {
  static async setTranscript(data, id, conId, type) {
    try {
      fbtranscriptcount += 1;
      if (data) {
        // let ndate = Date();
        const dateObj = new Date();
        const md = `${dateObj.toDateString()} | ${dateObj.toTimeString()} | ${conId}`;
        if (fbtranscriptcount > 1) {
          const postListRef = fb.database().ref(`transcripts/${conId}/transcript`);
          const newPostRef = postListRef.push();
          newPostRef.set({
            id,
            body: data,
            datetime: fb.database.ServerValue.TIMESTAMP,
            type,
          });
        } else {
          await fb.database().ref(`transcripts/${conId}`).set({
            conversationId: conId,
            status: 'active',
            datetime: fb.database.ServerValue.TIMESTAMP,
            metadata: md,
            transcript: [
              {
                id,
                body: data,
                datetime: fb.database.ServerValue.TIMESTAMP,
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

  static async setLogs(data, id, conId, type, startdt, enddt) {
    try {
      if (data) {
        const dateObj = new Date();
        const md = `${dateObj.toDateString()} | ${dateObj.toTimeString()} | ${conId}`;
        const latency = enddt - startdt;
        const body = `${type} | ${data} | Latency: ${latency}`;

        if (fbtranscriptcount > 1) {
          const postListRef = fb.database().ref(`logs/${conId}/log`);
          const newPostRef = postListRef.push();
          newPostRef.set({
            id,
            body,
            datetime: fb.database.ServerValue.TIMESTAMP,
            type,
            start: startdt,
            end: enddt,
            latency,
          });
        } else {
          await fb.database().ref(`logs/${conId}`).set({
            conversationId: conId,
            status: 'active',
            datetime: fb.database.ServerValue.TIMESTAMP,
            metadata: md,
            log: [
              {
                id,
                body,
                datetime: fb.database.ServerValue.TIMESTAMP,
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

  static async setErrors(error, conId, data) {
    try {
      if (error) {
        // let ndate = Date();
        const dateObj = new Date();
        const md = `${dateObj.toDateString()} | ${dateObj.toTimeString()} | ${conId}`;
        const msg = error.message;
        await fb.database().ref(`logs/${conId}`).set({
          conversationId: conId,
          status: 'error',
          datetime: fb.database.ServerValue.TIMESTAMP,
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

  static async getTranscriptById(id) {
    const transcript = fb.database().ref(`transcripts/${id}`);
    return transcript;
  }

  // eslint-disable-next-line consistent-return
  static async getAllTranscripts() {
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
  static async getAllLogs() {
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
