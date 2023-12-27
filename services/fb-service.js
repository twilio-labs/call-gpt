
const EventEmitter = require("events");

var fb = require("firebase-admin");


var serviceAccount = require("../firebase-db.json");
const firebaseConfig = {
    credential: fb.credential.cert(serviceAccount),
    apiKey: "AIzaSyBTsjJwRelnAAh1x0URdF0UgUTBz4Pj8vM",
    authDomain: "twilio-hackathon-sko-2024.firebaseapp.com",
    databaseURL: "https://twilio-hackathon-sko-2024-default-rtdb.firebaseio.com",
    projectId: "twilio-hackathon-sko-2024",
    storageBucket: "twilio-hackathon-sko-2024.appspot.com",
    messagingSenderId: "888116972091",
    appId: "1:888116972091:web:90c2705639e9f330b96a1e",
    measurementId: "G-KLLK96FJCB"
};

// Initialize Firebase
fb.initializeApp(firebaseConfig);

global.fbtranscriptcount = 0;
class FirebaseService extends EventEmitter {
    constructor() {
        super();
    }

    async setTranscript(data, id, conId, type) {
        try {
            fbtranscriptcount++;
            if (data) {
                //let ndate = Date();
                let dateObj = new Date();
                let md = dateObj.toDateString() + " | " + dateObj.toTimeString() + " | " + conId;
                if (fbtranscriptcount > 1) {

                    var postListRef = fb.database().ref('transcripts/' + conId + '/transcript');
                    var newPostRef = postListRef.push();
                    newPostRef.set({
                        id: id,
                        body: data,
                        datetime: fb.database.ServerValue.TIMESTAMP,
                        type: type
                    });
                } else {
                    const res = await fb.database().ref('transcripts/' + conId).set({
                        conversationId: conId,
                        status: 'active',
                        datetime: fb.database.ServerValue.TIMESTAMP,
                        metadata: md,
                        transcript: [
                            {
                                id: id,
                                body: data,
                                datetime: fb.database.ServerValue.TIMESTAMP,
                                type: type
                            }
                        ]

                    });
                }

            }
        } catch (err) {
            console.error("Error occurred in Firebase set Transcript service");
            console.error(err);
        }
       
        
    }

    async setLogs(data, id, conId, type, startdt, enddt) {
        try {
            if (data) {
               
                let dateObj = new Date();
                let md = dateObj.toDateString() + " | " + dateObj.toTimeString() + " | " + conId;
                let latency = enddt - startdt;
                let body = type + " | " + data + " | Latency: " + latency;
               
                if (fbtranscriptcount > 1) {

                    var postListRef = fb.database().ref('logs/' + conId + '/log');
                    var newPostRef = postListRef.push();
                    newPostRef.set({
                        id: id,
                        body: body,
                        datetime: fb.database.ServerValue.TIMESTAMP,
                        type: type,
                        start: startdt,
                        end: enddt,
                        latency: latency
                    });
                } else {
                    const res = await fb.database().ref('logs/' + conId).set({
                        conversationId: conId,
                        status: 'active',
                        datetime: fb.database.ServerValue.TIMESTAMP,
                        metadata: md,
                        log: [
                            {
                                id: id,
                                body: body,
                                datetime: fb.database.ServerValue.TIMESTAMP,
                                type: type,
                                start: startdt,
                                end: enddt,
                                latency: latency
                            }
                        ]

                    });
                }

            }
        } catch (err) {
            console.error("Error occurred in Firebase set Logs service");
            console.error(err);
        }     

    }

    async setErrors(err, conId, type) {
        try {
            if (data) {
                //let ndate = Date();
                let dateObj = new Date();
                let md = dateObj.toDateString() + " | " + dateObj.toTimeString() + " | " + conId;
                let msg = err.message;
                const res = await fb.database().ref('logs/' + conId).set({
                    conversationId: conId,
                    status: 'error',
                    datetime: fb.database.ServerValue.TIMESTAMP,
                    metadata: md,
                    message: msg,
                    stacktrace: data
                    
                });
            }
        } catch (err) {
            console.error("Error occurred in Firebase set Errors service");
            console.error(err);
        }

    }

    async getTranscriptById(id) {
        var transcript = fb.database().ref('transcripts/' + id);
        return transcript;
      
    }

    async getAllTranscripts() {
        try {
            let snap;
            //Get last ten records inserted by datetime 
            var allTranscripts = await fb.database().ref('transcripts').orderByChild('datetime').limitToLast(10);
            return await allTranscripts.once('value').then(function (snapshot) {
                console.log(snapshot.val())
                snap = snapshot.val();
                return snap;
            })
        } catch (err) {
            console.error("Error occurred in Firebase get all Transcripts service");
            console.error(err);
        }
       
       
    }

    async getAllLogs() {
        try {
            let snap;
            //Get last ten records inserted by datetime 
            var allLogs = await fb.database().ref('logs').orderByChild('datetime').limitToLast(10);
            return await allLogs.once('value').then(function (snapshot) {
                console.log(snapshot.val())
                snap = snapshot.val();
                return snap;
            })
        } catch (err) {
            console.error("Error occurred in Firebase get all Logs service");
            console.error(err);
        }
       

    }
}

module.exports = { FirebaseService };
